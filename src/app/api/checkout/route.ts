import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { alipayPagePay } from '@/lib/alipay';
import { getCreditPacks } from '@/lib/catalog';
import { prisma } from '@/lib/prisma';
import { publicOrigin } from '@/lib/settings';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { packId } = await req.json().catch(() => ({}));
  const pack = (await getCreditPacks()).find((candidate) => candidate.id === packId);
  if (!pack) return NextResponse.json({ error: 'unknown_pack' }, { status: 400 });
  try {
    const order = await prisma.paymentOrder.create({ data: { outTradeNo: `AMS${Date.now()}${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`, userId: session.user.id, packId: pack.id, amountCents: pack.priceCents, credits: pack.credits } });
    const origin = await publicOrigin(req);
    const url = await alipayPagePay({ outTradeNo: order.outTradeNo, subject: `Marketing Studio · ${pack.name}`, amountCents: pack.priceCents, notifyUrl: `${origin}/api/payment/alipay/notify`, returnUrl: `${origin}/pricing?paid=1` });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: 'checkout_failed', detail: String(e) }, { status: 502 });
  }
}
