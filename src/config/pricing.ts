export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  highlight?: boolean;
}

// Credit packs your end-users buy. Credits are YOUR in-app currency —
// set the price to whatever margin you want over Atlas's per-call cost.
export const CREDIT_PACKS: CreditPack[] = [
  { id: 'starter', name: 'Starter', credits: 100, priceCents: 9000 },
  { id: 'pro', name: 'Pro', credits: 600, priceCents: 39000, highlight: true },
  { id: 'elite', name: 'Elite', credits: 2000, priceCents: 99000 },
];

export const getPack = (id: string) => CREDIT_PACKS.find((p) => p.id === id);
