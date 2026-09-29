import { alipayConfig, verifyAlipay } from '@/lib/alipay';
import { prisma } from '@/lib/prisma';

function amountCents(value: string): number {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error('invalid_amount');
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) throw new Error('invalid_amount');
  return cents;
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 1_000_000) return new Response('failure', { status: 400 });
    const form = await request.formData();
    const params: Record<string, string> = {};
    form.forEach((value, key) => { if (typeof value === 'string') params[key] = value; });
    const config = await alipayConfig();
    if (params.app_id !== config.appId || !verifyAlipay(params, config.publicKey)) return new Response('failure', { status: 400 });
    if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status || '')) return new Response('success');
    const paidAmount = amountCents(params.total_amount || '');
    await prisma.$transaction(async (tx) => {
      const order = await tx.paymentOrder.findUnique({ where: { outTradeNo: params.out_trade_no } });
      if (!order) throw new Error('order_not_found');
      if (order.amountCents !== paidAmount) throw new Error('payment_amount_mismatch');
      const claimed = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending', amountCents: paidAmount },
        data: { status: 'paid', tradeNo: params.trade_no || null, paidAt: new Date() },
      });
      if (claimed.count === 0) return;
      await tx.user.update({ where: { id: order.userId }, data: { credits: { increment: order.credits } } });
      await tx.creditLedger.create({ data: { userId: order.userId, delta: order.credits, reason: 'purchase', ref: order.outTradeNo } });
    });
    return new Response('success');
  } catch (error) {
    console.error('[alipay/notify]', String(error));
    return new Response('failure', { status: 400 });
  }
}
