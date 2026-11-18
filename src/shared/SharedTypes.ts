export interface Gem {
  name: string;
  chaosValue: number;
  icon: string;
}

export interface GemsData {
  league: string;
  lastUpdated: string;
  gems: Gem[];
}
export type VisceraTier = "lesser" | "normal" | "greater";

export interface VisceraMod {
  text: string;
  chaos: number | null;
}

export interface VisceraTierInfo {
  // Average over the tier's variants, null when nobody is selling it
  chaos: number | null;
  mods: VisceraMod[];
}

export interface AreaViscera {
  name: string;
  boss: string;
  icon: string;
  tiers: Record<VisceraTier, VisceraTierInfo>;
}

// A map, or a campaign zone when act is set
export interface VisceraArea {
  area: string;
  act?: number;
  drops: AreaViscera[];
}

export interface BossVariant {
  tier: VisceraTier;
  text: string;
  chaos: number;
  listings: number;
}

export interface BossViscera {
  name: string;
  icon: string;
  sources: string[];
  variants: BossVariant[];
}

export interface VisceraData {
  league: string;
  lastUpdated: string;
  divineChaos: number | null;
  maps: VisceraArea[];
  campaign: VisceraArea[];
  bosses: BossViscera[];
}
