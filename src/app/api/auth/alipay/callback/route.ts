import crypto from 'node:crypto';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { exchangeAlipayCode } from '@/lib/alipay';
import { prisma } from '@/lib/prisma';
import { getSetting, publicOrigin } from '@/lib/settings';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('auth_code') || '';
  const cookies = request.headers.get('cookie') || '';
  const expectedState = /(?:^|; )alipay\.oauth\.state=([^;]+)/.exec(cookies)?.[1] || '';
  const stateMatches = state.length === expectedState.length && state.length > 0 && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  if (!stateMatches || !code) {
    return NextResponse.json({ error: 'invalid_alipay_state' }, { status: 400 });
  }
  try {
    const alipayUserId = await exchangeAlipayCode(code);
    let user = await prisma.user.findUnique({ where: { alipayUserId } });
    let isNew = false;
    if (!user) {
      user = await prisma.user.create({ data: { alipayUserId, name: '支付宝用户' } });
      isNew = true;
    }
    if (isNew) {
      const bonus = Number.parseInt(await getSetting('credits.signupBonus', '0'), 10) || 0;
      if (bonus > 0) await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { credits: { increment: bonus } } }), prisma.creditLedger.create({ data: { userId: user.id, delta: bonus, reason: 'signup' } })]);
    }
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');
    const token = await encode({ token: { sub: user.id, name: user.name, picture: user.image, role: user.role, credits: user.credits }, secret, maxAge: 30 * 24 * 60 * 60 });
    const origin = await publicOrigin();
    const target = decodeURIComponent(/(?:^|; )alipay\.oauth\.target=([^;]+)/.exec(cookies)![1]);
    const response = NextResponse.redirect(new URL(target, origin));
    response.cookies.set('next-auth.session-token', token, { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 30 * 24 * 60 * 60 });
    response.cookies.delete('alipay.oauth.state'); response.cookies.delete('alipay.oauth.target');
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'alipay_login_failed', detail: String(error) }, { status: 502 });
  }
}
