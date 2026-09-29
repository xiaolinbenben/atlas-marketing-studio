import crypto from 'node:crypto';
import { encode } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import { exchangeAlipayCode } from '@/lib/alipay';
import { prisma } from '@/lib/prisma';
import { getSetting, publicOrigin } from '@/lib/settings';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const code = url.searchParams.get('auth_code') || url.searchParams.get('code') || '';
  const cookies = request.headers.get('cookie') || '';
  const expectedState = /(?:^|; )alipay\.oauth\.state=([^;]+)/.exec(cookies)?.[1] || '';
  const stateMatches = state.length === expectedState.length && state.length > 0 && crypto.timingSafeEqual(Buffer.from(state), Buffer.from(expectedState));
  if (!stateMatches || !code) {
    return NextResponse.json({ error: 'invalid_alipay_state' }, { status: 400 });
  }
  try {
    const profile = await exchangeAlipayCode(code);
    let user = await prisma.user.findUnique({ where: { alipayUserId: profile.userId } });
    let isNew = false;
    if (!user) {
      user = await prisma.user.create({ data: { alipayUserId: profile.userId, name: profile.name || '支付宝用户', image: profile.avatar } });
      isNew = true;
    } else if (profile.name || profile.avatar) {
      user = await prisma.user.update({ where: { id: user.id }, data: { name: profile.name || user.name, image: profile.avatar || user.image } });
    }
    if (isNew) {
      const bonus = Number.parseInt(await getSetting('credits.signupBonus', '0'), 10) || 0;
      if (bonus > 0) await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { credits: { increment: bonus } } }), prisma.creditLedger.create({ data: { userId: user.id, delta: bonus, reason: 'signup' } })]);
    }
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) throw new Error('NEXTAUTH_SECRET is required');
    const token = await encode({ token: { sub: user.id, name: user.name, picture: user.image, role: user.role, credits: user.credits }, secret, maxAge: 30 * 24 * 60 * 60 });
    const origin = await publicOrigin(request);
    const targetCookie = /(?:^|; )alipay\.oauth\.target=([^;]+)/.exec(cookies)?.[1] || '/';
    let target = decodeURIComponent(targetCookie);
    try { const targetUrl = new URL(target, origin); target = targetUrl.origin === origin ? `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}` : '/'; } catch { target = '/'; }
    const response = NextResponse.redirect(new URL(target || '/', origin));
    response.cookies.set('next-auth.session-token', token, { httpOnly: true, sameSite: 'lax', secure: false, path: '/', maxAge: 30 * 24 * 60 * 60 });
    response.cookies.delete('alipay.oauth.state'); response.cookies.delete('alipay.oauth.target');
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'alipay_login_failed', detail: String(error) }, { status: 502 });
  }
}
