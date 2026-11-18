#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs'

const args = process.argv.slice(2)
const leagueIndex = args.indexOf('--league')
const argLeague = leagueIndex !== -1 ? args[leagueIndex + 1] : null
const outIndex = args.indexOf('--out')
const outPath = outIndex !== -1
  ? args[outIndex + 1]
  : 'public/gems-data.json'
const visceraOutIndex = args.indexOf('--viscera-out')
const visceraOutPath = visceraOutIndex !== -1
  ? args[visceraOutIndex + 1]
  : 'public/viscera-data.json'
const logoOutPath = 'public/Logo.png'

const USER_AGENT = 'divine-font-helper/3.0.0 github:maciejszaman'
const WIKI_API = 'https://www.poewiki.net/w/api.php'

// Where each viscera drops comes from poedb. It sits behind Cloudflare, so the
// last successful scrape is kept in the repo as a fallback.
const POEDB_VISCERA_URL = 'https://poedb.tw/us/Viscera'
const VISCERA_SOURCES_PATH = new URL('./viscera-sources.json', import.meta.url)

async function getCurrentLeague() {
  const res = await fetch(
    'https://www.pathofexile.com/api/leagues?type=main&realm=pc&limit=50',
    {
      headers: {
        'User-Agent': USER_AGENT
      }
    }
  )

  if (!res.ok) {
    throw new Error(`Failed to get leagues: HTTP ${res.status}`)
  }

  const leagues = await res.json()

  const now = new Date()

  // Newest softcore trade league that is running. endAt stays null until GGG
  // announces the next league, so it can't be required. Hardcore, SSF and
  // Ruthless variants all have rules set.
  const activeLeague = leagues
    .filter(l =>
      (l.rules ?? []).length === 0 &&
      l.startAt &&
      new Date(l.startAt) <= now &&
      (!l.endAt || new Date(l.endAt) > now)
    )
    .sort((a, b) => new Date(b.startAt) - new Date(a.startAt))[0]

  if (activeLeague) {
    return activeLeague.id
  }

  return 'Standard'
}

async function fetchNinjaLines(league, type) {
  const API_URL =
    `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${encodeURIComponent(league)}&type=${type}`

  const res = await fetch(API_URL)

  if (!res.ok) {
    throw new Error(`poe.ninja ${type}: HTTP ${res.status}`)
  }

  const { lines = [] } = await res.json()

  if (lines.length === 0) {
    throw new Error(`No ${type} data for this league: ${league}`)
  }

  return lines
}

function isTransfigured(g) {
  return !!g.tradeFilter?.query?.type?.discriminator
}

async function updateGems(league) {
  const lines = await fetchNinjaLines(league, 'SkillGem')

  const top10 = lines
    .filter(g =>
      isTransfigured(g) &&
      g.gemLevel === 1 &&
      (g.gemQuality ?? 0) === 0 &&
      !g.corrupted &&
      !g.name.includes("Trarthus")
    )
    .sort((a, b) => (b.chaosValue ?? 0) - (a.chaosValue ?? 0))
    .slice(0, 10)
    .map(g => ({
      name: g.name,
      chaosValue: g.chaosValue ?? 0,
      icon: g.icon ?? null,
    }))

  const output = {
    league,
    lastUpdated: new Date().toISOString(),
    gems: top10
  }

  writeFileSync(outPath, JSON.stringify(output, null, 2))
}

// ---------------------------------------------------------------- Viscera --

// poedb tiers are Low/Med/High, poe.ninja names them "Lesser X" / "X" / "Greater X"
const TIERS = ['lesser', 'normal', 'greater']
const POEDB_TIERS = { Low: 'lesser', Med: 'normal', High: 'greater' }

// Item art filename, e.g. "VisceraFireFury". Unlike names (there are three
// different "Artificial Appendage"), it is unique per viscera and identical
// on poe.ninja and poedb, so it is what the two are joined on.
const iconKey = url => url.split('/').pop().replace(/\.\w+$/, '')

const round = n => Math.round(n * 10) / 10

function stripTags(html) {
  return html
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/—/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePoedbViscera(html) {
  // Only the first tab ("Viscera Item") lists drop sources
  const start = html.indexOf('id="VisceraItem"')
  const end = html.indexOf('id="Viscera" class="tab-pane', start)
  if (start === -1 || end === -1) {
    throw new Error('page layout changed')
  }

  return html
    .slice(start, end)
    .split('<div class="col">')
    .slice(1)
    .map(card => {
      const img = card.match(/<img[^>]+src="([^"]+)"/)?.[1]
      const name = card.match(/class="flex-grow-1[^"]*"><a [^>]*>(.*?)<\/a>/)?.[1]
      if (!img || !name) return null

      const mods = {}
      for (const [, tier, text] of card.matchAll(/target="_blank">(Low|Med|High)<\/a>(.*?)<\/div>/gs)) {
        (mods[POEDB_TIERS[tier]] ??= []).push(stripTags(text))
      }

      return {
        name: stripTags(name),
        icon: iconKey(img),
        // e.g. "Act1" or "PinnacleAndMapBosses"
        category: img.split('/').at(-2),
        img,
        drops: [...card.matchAll(/<div class="property">Drop: (.*?)<\/div>/g)]
          .map(m => stripTags(m[1])),
        mods,
      }
    })
    .filter(Boolean)
}

async function getVisceraSources() {
  try {
    const res = await fetch(POEDB_VISCERA_URL, {
      headers: { 'User-Agent': USER_AGENT }
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const sources = parsePoedbViscera(await res.text())
    if (sources.length < 100) {
      throw new Error(`only ${sources.length} viscera found`)
    }

    writeFileSync(VISCERA_SOURCES_PATH, JSON.stringify(sources, null, 2) + '\n')
    return sources
  } catch (err) {
    console.warn(`poedb unavailable (${err.message}), using viscera-sources.json snapshot`)
    return JSON.parse(readFileSync(VISCERA_SOURCES_PATH, 'utf8'))
  }
}

function tierOf(name) {
  if (name.startsWith('Lesser ')) return 'lesser'
  if (name.startsWith('Greater ')) return 'greater'
  return 'normal'
}

async function updateViscera(league) {
  const [lines, sources] = await Promise.all([
    fetchNinjaLines(league, 'Viscera'),
    getVisceraSources(),
  ])

  // poe.ninja has one line per tier and modifier variant
  const linesByIcon = new Map()
  for (const line of lines) {
    const key = iconKey(line.icon)
    if (!linesByIcon.has(key)) linesByIcon.set(key, [])
    linesByIcon.get(key).push(line)
  }

  const knownIcons = new Set(sources.map(s => s.icon))
  const unmatched = new Set(lines.filter(l => !knownIcons.has(iconKey(l.icon))).map(l => l.name))
  if (unmatched.size) {
    console.warn(`No drop source on poedb for: ${[...unmatched].join(', ')}`)
  }

  const maps = new Map()
  const campaign = new Map()
  const bosses = []

  for (const source of sources) {
    const itemLines = linesByIcon.get(source.icon) ?? []
    const icon = itemLines[0]?.icon ?? source.img
    const variants = itemLines
      .map(l => ({
        tier: tierOf(l.name),
        text: (l.implicitModifiers ?? []).map(m => m.text).join(' / ') || l.variant || '',
        chaos: round(l.chaosValue ?? 0),
        listings: l.listingCount ?? l.count ?? 0,
      }))
      .sort((a, b) => b.chaos - a.chaos)

    // Pinnacle, conqueror, guardian, T17 and Coven Queen viscera roll one of
    // many modifiers, so they get their own table listing every variant
    if (source.category === 'PinnacleAndMapBosses') {
      bosses.push({ name: source.name, icon, sources: source.drops, variants })
      continue
    }

    const tiers = Object.fromEntries(TIERS.map(tier => {
      const priced = variants.filter(v => v.tier === tier)
      return [tier, {
        // A few viscera have several variants in one tier (Greater Gemling
        // Torso). Drop weights are unknown, so value them at the average.
        chaos: priced.length
          ? round(priced.reduce((sum, v) => sum + v.chaos, 0) / priced.length)
          : null,
        mods: priced.length
          ? priced.map(v => ({ text: v.text, chaos: v.chaos }))
          : (source.mods[tier] ?? []).map(text => ({ text, chaos: null })),
      }]
    }))

    for (const drop of source.drops) {
      // "Act 1, Fire Fury, The Coast" is a campaign boss, "Megaera, Crater" a map boss
      const parts = drop.split(', ')
      const act = parts[0].match(/^Act (\d+)$/)?.[1]
      if (act) parts.shift()
      const area = parts.pop()
      if (parts.length === 0 || area === '?') continue

      // Some zone names repeat between acts (The Reliquary in Act 5 and 10)
      const areas = act ? campaign : maps
      const key = act ? `${act}, ${area}` : area
      if (!areas.has(key)) {
        areas.set(key, act ? { area, act: Number(act), drops: [] } : { area, drops: [] })
      }
      areas.get(key).drops.push({ name: source.name, boss: parts.join(', '), icon, tiers })
    }
  }

  bosses.sort((a, b) => (b.variants[0]?.chaos ?? 0) - (a.variants[0]?.chaos ?? 0))

  // Chaos per divine, for showing big prices in divines like poe.ninja does
  const rates = lines
    .filter(l => l.divineValue >= 1)
    .map(l => l.chaosValue / l.divineValue)
    .sort((a, b) => a - b)

  const output = {
    league,
    lastUpdated: new Date().toISOString(),
    divineChaos: rates.length ? round(rates[Math.floor(rates.length / 2)]) : null,
    maps: [...maps.values()].sort((a, b) => a.area.localeCompare(b.area)),
    campaign: [...campaign.values()].sort((a, b) => a.act - b.act || a.area.localeCompare(b.area)),
    bosses,
  }

  writeFileSync(visceraOutPath, JSON.stringify(output, null, 2))
}

// ------------------------------------------------------------ League logo --

async function wikiQuery(params) {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', redirects: '1', ...params })
  const res = await fetch(`${WIKI_API}?${query}`, {
    headers: { 'User-Agent': USER_AGENT }
  })
  if (!res.ok) {
    throw new Error(`poewiki: HTTP ${res.status}`)
  }
  return res.json()
}

const wikitext = async page =>
  (await wikiQuery({ action: 'parse', page, prop: 'wikitext' })).parse?.wikitext ?? ''

// The big logo on top of every tool is the logo of the expansion the current
// league is part of. poewiki's "Covens league" page says it launched "as part
// of ''[[Path of Exile: Covens of Umbra]]''", whose infobox image is the logo.
async function updateLeagueLogo(league) {
  const expansion = (await wikitext(`${league} league`))
    .match(/as part of ''\[\[([^\]|]+)/)?.[1]
  if (!expansion) {
    throw new Error(`no expansion found on the "${league} league" wiki page`)
  }

  const file = (await wikitext(expansion))
    .match(/^\|[ \t]*image[ \t]*=[ \t]*(\S[^\n]*?)[ \t]*$/m)?.[1]
  if (!file) {
    throw new Error(`no logo on the "${expansion}" wiki page`)
  }

  const { query } = await wikiQuery({ action: 'query', titles: `File:${file}`, prop: 'imageinfo', iiprop: 'url' })
  const url = query?.pages?.[0]?.imageinfo?.[0]?.url
  if (!url) {
    throw new Error(`no URL for wiki file "${file}"`)
  }

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`logo download failed: HTTP ${res.status}`)
  }

  writeFileSync(logoOutPath, Buffer.from(await res.arrayBuffer()))
}

async function main() {
  const league = argLeague ?? await getCurrentLeague()

  const [gems, viscera, logo] = await Promise.allSettled([
    updateGems(league),
    updateViscera(league),
    updateLeagueLogo(league),
  ])

  // Viscera are a Covens league mechanic and may be gone in later leagues, and
  // the logo falls back to the committed one, so neither may stop the gem data
  // from being deployed
  if (viscera.status === 'rejected') {
    console.warn(`::warning::Viscera data not updated: ${viscera.reason.message}`)
  }
  if (logo.status === 'rejected') {
    console.warn(`::warning::League logo not updated: ${logo.reason.message}`)
  }

  if (gems.status === 'rejected') {
    throw gems.reason
  }
}

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
