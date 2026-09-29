import { getCreditPacks } from '@/lib/catalog';
import PricingClient from './PricingClient';

export const dynamic = 'force-dynamic';

export default async function PricingPage() {
  const packs = (await getCreditPacks()).map((pack) => ({ id: pack.id, name: pack.name, credits: pack.credits, priceCents: pack.priceCents, highlight: pack.sortOrder === 1 }));
  return <PricingClient packs={packs} />;
}
