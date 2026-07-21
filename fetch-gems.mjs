#!/usr/bin/env node

import { writeFileSync } from 'fs'

const args = process.argv.slice(2)
const leagueIndex = args.indexOf('--league')
const argLeague = leagueIndex !== -1 ? args[leagueIndex + 1] : null
const outIndex = args.indexOf('--out')
const outPath = outIndex !== -1
  ? args[outIndex + 1]
  : 'public/gems-data.json'

async function getCurrentLeague() {
  const res = await fetch(
    'https://www.pathofexile.com/api/leagues?type=main&realm=pc&limit=50',
    {
      headers: {
        'User-Agent': 'divine-font-helper/3.0.0 github:maciejszaman'
      }
    }
  )

  if (!res.ok) {
    throw new Error(`Failed to get leagues: HTTP ${res.status}`)
  }

  const leagues = await res.json()

  const now = new Date()

  const activeLeague = leagues.find(l =>
    l.endAt &&
    new Date(l.startAt) <= now &&
    new Date(l.endAt) > now
  )

  if (activeLeague) {
    return activeLeague.id
  }

  return 'Standard'
}

function isTransfigured(g) {
  return !!g.tradeFilter?.query?.type?.discriminator
}

async function main() {
  const league = argLeague ?? await getCurrentLeague()

  const API_URL =
    `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${encodeURIComponent(league)}&type=SkillGem`

  const res = await fetch(API_URL)

  if (!res.ok) {
    throw new Error(res.status)
  }

  const { lines = [] } = await res.json()

  if (lines.length === 0) {
    throw new Error(`No gems data for this league: ${league}`)
  }

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

main().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})