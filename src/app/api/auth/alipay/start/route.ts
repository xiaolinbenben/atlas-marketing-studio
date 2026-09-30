import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { alipayLoginUrl } from '@/lib/alipay';
import { publicOrigin } from '@/lib/settings';

export async function GET(request: Request) {
  try {
    const origin = await publicOrigin();
    const state = crypto.randomBytes(24).toString('base64url');
    const callbackUrl = new URL(request.url).searchParams.get('callbackUrl');
    if (!callbackUrl) throw new Error('callback_url_missing');
    const parsed = new URL(callbackUrl);
    const target = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const response = NextResponse.redirect(await alipayLoginUrl(`${origin}/api/auth/alipay/callback`, state));
    response.cookies.set('alipay.oauth.state', state, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600, path: '/' });
    response.cookies.set('alipay.oauth.target', target, { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 600, path: '/' });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'alipay_login_not_configured', detail: String(error) }, { status: 503 });
  }
}
