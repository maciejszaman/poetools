import { useEffect, useState } from "react";
import { Link } from "react-router";
import * as Shared from "../../shared/SharedTypes";
import ChaosOrb from "../Icons/ChaosOrb";
import DivineOrb from "../Icons/DivineOrb";

// Covens of Umbra promo art, from pathofexile.com/covens
const COVENS_BG =
  "https://web.poecdn.com/protected/image/promo/covensofumbra/endgame-bg.webp?key=GkT_vaNwTuZebvuqeiv-jg";

// Lists start with only the most expensive entries
const TOP = 20;

const TABS = [
  { id: "maps", label: "Map bosses" },
  { id: "pinnacle", label: "Pinnacle bosses" },
  { id: "campaign", label: "Campaign bosses" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const TIERS: { id: Shared.VisceraTier; label: string }[] = [
  { id: "lesser", label: "Lesser" },
  { id: "normal", label: "Normal" },
  { id: "greater", label: "Greater" },
];

const tierLabel = (tier: Shared.VisceraTier) =>
  TIERS.find((t) => t.id === tier)?.label ?? tier;

const formatChaos = (chaos: number) =>
  chaos < 10 ? chaos.toFixed(1) : chaos.toFixed(0);

const Price = ({
  chaos,
  divineChaos,
  large = false,
}: {
  chaos: number | null;
  divineChaos: number | null;
  large?: boolean;
}) => {
  const size = large ? "text-xl" : "";
  const icon = large ? "h-8 w-8" : "h-6 w-6";

  if (chaos === null) {
    return <span className={`opacity-40 ${size}`}>-</span>;
  }

  if (divineChaos !== null && chaos >= divineChaos) {
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap ${size}`}
      >
        {(chaos / divineChaos).toFixed(1)}
        <DivineOrb className={icon} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap ${size}`}
    >
      {formatChaos(chaos)}
      <ChaosOrb className={icon} />
    </span>
  );
};

const ItemIcon = ({ src, alt }: { src: string; alt: string }) => (
  <div className="bg-base border border-text shrink-0">
    <img
      src={src}
      alt={alt}
      className="h-12 w-12 object-contain"
      loading="lazy"
    />
  </div>
);

const ShowMore = ({
  hidden,
  onClick,
}: {
  hidden: number;
  onClick: () => void;
}) =>
  hidden > 0 ? (
    <button
      onClick={onClick}
      className="mx-auto px-4 py-1 border border-text hover:bg-surface transition-all cursor-pointer"
    >
      Show more ({hidden})
    </button>
  ) : null;

// Total of all viscera an area's bosses drop, null when none of them has a price
const areaValue = (area: Shared.VisceraArea, tier: Shared.VisceraTier) => {
  const prices = area.drops
    .map((d) => d.tiers[tier].chaos)
    .filter((c): c is number => c !== null);
  return prices.length ? prices.reduce((sum, c) => sum + c, 0) : null;
};

const modsTooltip = (drop: Shared.AreaViscera, tier: Shared.VisceraTier) => {
  const { mods } = drop.tiers[tier];
  if (mods.length === 0) return `${tierLabel(tier)} ${drop.name}: no data`;
  return mods
    .map((m) =>
      m.chaos === null
        ? `${m.text} (no listings)`
        : `${m.text}: ${formatChaos(m.chaos)}c`,
    )
    .join("\n");
};

// Maps and campaign zones, ranked by the value of their bosses' viscera
const AreaList = ({
  areas,
  divineChaos,
  description,
}: {
  areas: Shared.VisceraArea[];
  divineChaos: number | null;
  description: string;
}) => {
  const [tier, setTier] = useState<Shared.VisceraTier>("greater");
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const q = query.trim().toLowerCase();
  const rows = areas
    .map((area) => ({ ...area, value: areaValue(area, tier) }))
    .sort(
      (a, b) =>
        (b.value ?? -1) - (a.value ?? -1) || a.area.localeCompare(b.area),
    )
    // Rank before filtering, so searching still shows where an area stands
    .map((area, i) => ({ ...area, rank: i + 1 }))
    .filter(
      (area) =>
        !q ||
        [area.area, ...area.drops.flatMap((d) => [d.name, d.boss])].some((s) =>
          s.toLowerCase().includes(q),
        ),
    );
  const visible = showAll ? rows : rows.slice(0, TOP);

  return (
    <section className="flex flex-col gap-4">
      <p className="px-4 text-sm opacity-60">{description}</p>

      <div className="flex flex-wrap items-center gap-4 px-4">
        <div
          className="flex border border-text"
          role="group"
          aria-label="Viscera tier"
        >
          {TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTier(t.id)}
              aria-pressed={tier === t.id}
              className={`px-3 py-1 transition-all cursor-pointer ${
                tier === t.id
                  ? "bg-accent text-(color:--color-base)"
                  : "hover:bg-surface"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search area, boss or viscera"
          className="flex-1 min-w-48 bg-base border border-text px-3 py-1 placeholder:text-text/50"
        />
      </div>

      <div className="flex flex-col gap-2">
        {visible.map((area) => (
          <div
            key={`${area.act ?? "map"} ${area.area}`}
            className="bg-surface px-4 py-2"
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-xl tracking-tighter">
                <span className="opacity-50 text-sm mr-2">#{area.rank}</span>
                {area.act !== undefined && (
                  <span className="opacity-50 text-sm mr-2">
                    Act {area.act}
                  </span>
                )}
                {area.area}
              </p>
              <Price chaos={area.value} divineChaos={divineChaos} large />
            </div>

            <ul className="flex flex-col gap-2 mt-2">
              {area.drops.map((drop) => (
                <li
                  key={drop.icon}
                  title={modsTooltip(drop, tier)}
                  className="flex items-center gap-3"
                >
                  <ItemIcon src={drop.icon} alt={drop.name} />
                  <div className="flex-1 min-w-0">
                    <p className="leading-tight">
                      <span className="opacity-60">{tierLabel(tier)} </span>
                      {drop.name}
                    </p>
                    <p className="text-sm opacity-60 leading-tight">
                      {drop.boss}
                    </p>
                  </div>
                  {area.drops.length > 1 && (
                    <Price
                      chaos={drop.tiers[tier].chaos}
                      divineChaos={divineChaos}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="text-center opacity-60 py-4">
            Nothing matches "{query}"
          </p>
        )}
      </div>

      <ShowMore
        hidden={rows.length - visible.length}
        onClick={() => setShowAll(true)}
      />

      <p className="px-4 text-sm opacity-60">
        "-" means nobody is selling that tier right now. Tiers with several
        possible modifiers are valued at their average price.
      </p>
    </section>
  );
};

const BossRow = ({
  boss,
  divineChaos,
}: {
  boss: Shared.BossViscera;
  divineChaos: number | null;
}) => {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const count = boss.variants.length;
  const visible = showAll ? boss.variants : boss.variants.slice(0, TOP);

  return (
    <div className="bg-surface">
      <button
        onClick={() => setOpen(!open)}
        disabled={count === 0}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-2 text-left enabled:hover:brightness-110 enabled:cursor-pointer transition-all"
      >
        <ItemIcon src={boss.icon} alt={boss.name} />
        <div className="flex-1 min-w-0">
          <p className="text-lg leading-tight">{boss.name}</p>
          <p className="text-sm opacity-60 leading-tight">
            {boss.sources.join(" · ")}
          </p>
        </div>
        <div className="flex flex-col items-end shrink-0">
          {count > 0 && <span className="text-xs opacity-60">up to</span>}
          <Price
            chaos={boss.variants[0]?.chaos ?? null}
            divineChaos={divineChaos}
            large
          />
          <span className="text-xs opacity-60">
            {count === 0
              ? "no listings"
              : `${count} ${count === 1 ? "drop" : "drops"} ${open ? "▴" : "▾"}`}
          </span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-text/30 pb-2">
          <ul>
            {visible.map((v, i) => (
              <li
                key={i}
                title={`${v.listings} listed`}
                className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 px-4 py-1 text-sm odd:bg-base/40"
              >
                <span
                  className={
                    v.tier === "greater" ? "text-accent" : "opacity-60"
                  }
                >
                  {tierLabel(v.tier)}
                </span>
                <span>{v.text}</span>
                <Price chaos={v.chaos} divineChaos={divineChaos} />
              </li>
            ))}
          </ul>
          <ShowMore
            hidden={count - visible.length}
            onClick={() => setShowAll(true)}
          />
        </div>
      )}
    </div>
  );
};

const BossList = ({
  bosses,
  divineChaos,
}: {
  bosses: Shared.BossViscera[];
  divineChaos: number | null;
}) => {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? bosses : bosses.slice(0, TOP);

  return (
    <section className="flex flex-col gap-4">
      <p className="px-4 text-sm opacity-60">
        Pinnacle, conqueror, guardian and T17 boss viscera roll one of several
        modifiers. Click a boss to see every possible drop and its price.
      </p>
      <div className="flex flex-col gap-2">
        {visible.map((boss) => (
          <BossRow key={boss.name} boss={boss} divineChaos={divineChaos} />
        ))}
      </div>
      <ShowMore
        hidden={bosses.length - visible.length}
        onClick={() => setShowAll(true)}
      />
    </section>
  );
};

const Viscera = () => {
  const [data, setData] = useState<Shared.VisceraData | null>(null);
  const [error, setError] = useState<string>("");
  const [tab, setTab] = useState<Tab>("maps");

  useEffect(() => {
    fetch("./viscera-data.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <main
      className="theme-covens w-screen min-h-screen bg-base bg-cover bg-center bg-no-repeat bg-fixed"
      style={{ backgroundImage: `url(${COVENS_BG})` }}
    >
      <section className="w-full min-h-screen bg-black/40 flex flex-col items-center py-8 px-4">
        <section className="max-w-200 w-full flex flex-col items-center gap-4 text-text">
          <div className="bg-base border-2 w-full border-text">
            <div className="flex justify-between bg-surface px-4 py-2 items-center gap-4">
              <Link
                to="/"
                className="hover:brightness-125 hover:underline transition-all opacity-50"
              >
                ← back
              </Link>
              <a
                href="https://github.com/maciejszaman/poetools"
                className="hover:brightness-125 hover:underline transition-all opacity-50"
              >
                github
              </a>
            </div>

            <div className="flex flex-col items-center gap-4 px-4 py-2">
              <img
                src="./Logo.png"
                className="w-1/3"
                alt="Current path of exile league logo"
              />
              <div className="py-2 text-center">
                <p className="text-2xl">Viscera calculator</p>
                <h3 className="opacity-50 tracking-widest">
                  {`Updated: ${data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : "never"}`}
                </h3>
              </div>
            </div>

            <div
              className="grid grid-cols-3 border-y-2 border-text mb-4"
              role="tablist"
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-2 py-2 border-b-4 transition-all cursor-pointer ${
                    tab === t.id
                      ? "bg-surface border-accent text-accent"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {(data && (
              <div className="flex flex-col gap-4 pb-4">
                {tab === "maps" && (
                  <AreaList
                    key="maps"
                    areas={data.maps}
                    divineChaos={data.divineChaos}
                    description="Value of the viscera dropped by each map's boss. Hover a viscera to see its modifier."
                  />
                )}
                {tab === "pinnacle" && (
                  <BossList
                    bosses={data.bosses}
                    divineChaos={data.divineChaos}
                  />
                )}
                {tab === "campaign" && (
                  <AreaList
                    key="campaign"
                    areas={data.campaign}
                    divineChaos={data.divineChaos}
                    description="Value of the viscera dropped by campaign bosses. Some of these have no map boss source. Hover a viscera to see its modifier."
                  />
                )}
                <p className="px-4 text-sm opacity-60">
                  Prices from poe.ninja ({data.league}), drop sources from
                  poedb.
                </p>
              </div>
            )) ||
              (error && (
                <div className="bg-red-600/50 text-center text-text px-8 w-full py-4 mb-4">
                  <h1 className="text-4xl pb-4">ERROR</h1>
                  <p className="opacity-75">{error}</p>
                  <a href="https://github.com/maciejszaman/poetools">
                    <div className="mt-6 border border-text w-fit mx-auto px-4 py-2 text-3xl hover:scale-105">
                      <span>github</span>
                    </div>
                  </a>
                </div>
              ))}
          </div>
        </section>
      </section>
    </main>
  );
};

export default Viscera;
