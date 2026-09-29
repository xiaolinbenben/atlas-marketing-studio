import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureDefaultCatalog, getCreditPacks } from '@/lib/catalog';
import { prisma } from '@/lib/prisma';
import { DEFAULT_VIDEO_PRICING_RULES } from '@/lib/video-pricing';

async function allowed() { const session = await getServerSession(authOptions); return session?.user?.role === 'admin'; }

export async function GET() {
  if (!(await allowed())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await ensureDefaultCatalog();
  return NextResponse.json({ packs: await getCreditPacks(false), rules: await prisma.videoPricingRule.findMany({ orderBy: [{ model: 'asc' }, { resolution: 'asc' }] }) });
}

export async function PUT(request: Request) {
  if (!(await allowed())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const packs = Array.isArray(body.packs) ? body.packs : [];
  const rules = Array.isArray(body.rules) ? body.rules : [];
  await prisma.$transaction(async (tx) => {
    for (const pack of packs) {
      if (!pack || typeof pack.id !== 'string' || typeof pack.name !== 'string') continue;
      await tx.creditPack.upsert({ where: { id: pack.id }, create: { id: pack.id, name: pack.name.trim(), credits: Math.max(0, Math.round(Number(pack.credits) || 0)), priceCents: Math.max(0, Math.round(Number(pack.priceCents) || 0)), currency: String(pack.currency || 'CNY'), active: pack.active !== false, sortOrder: Math.round(Number(pack.sortOrder) || 0) }, update: { name: pack.name.trim(), credits: Math.max(0, Math.round(Number(pack.credits) || 0)), priceCents: Math.max(0, Math.round(Number(pack.priceCents) || 0)), currency: String(pack.currency || 'CNY'), active: pack.active !== false, sortOrder: Math.round(Number(pack.sortOrder) || 0) } });
    }
    const fixedRules = new Set(DEFAULT_VIDEO_PRICING_RULES.map((rule) => `${rule.model}\0${rule.resolution}`));
    for (const rule of rules) {
      if (!rule || typeof rule.model !== 'string' || typeof rule.resolution !== 'string') continue;
      if (!fixedRules.has(`${rule.model}\0${rule.resolution}`)) continue;
      await tx.videoPricingRule.updateMany({
        where: { model: rule.model, resolution: rule.resolution },
        data: { creditsPerSecond: Math.max(0.01, Number(rule.creditsPerSecond) || 0.01) },
      });
    }
  });
  return NextResponse.json({ ok: true });
}
