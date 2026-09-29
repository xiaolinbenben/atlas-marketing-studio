import { prisma } from '@/lib/prisma';
import { ensureDefaultVideoPricingRules } from '@/lib/video-pricing';

const DEFAULT_PACKS = [
  { id: 'starter', name: 'Starter', credits: 100, priceCents: 9000, currency: 'CNY', active: true, sortOrder: 0 },
  { id: 'pro', name: 'Pro', credits: 600, priceCents: 39000, currency: 'CNY', active: true, sortOrder: 1 },
  { id: 'elite', name: 'Elite', credits: 2000, priceCents: 99000, currency: 'CNY', active: true, sortOrder: 2 },
];

export async function ensureDefaultPacks() {
  if (await prisma.creditPack.count()) return;
  await prisma.$transaction(DEFAULT_PACKS.map((pack) => prisma.creditPack.create({ data: pack })));
}

export async function ensureDefaultCatalog() {
  await ensureDefaultPacks();
  await ensureDefaultVideoPricingRules();
}

export async function getCreditPacks(activeOnly = true) {
  await ensureDefaultPacks();
  return prisma.creditPack.findMany({ where: activeOnly ? { active: true } : undefined, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
}
