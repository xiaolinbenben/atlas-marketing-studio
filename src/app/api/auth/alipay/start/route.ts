import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { alipayLoginUrl } from '@/lib/alipay';
import { publicOrigin } from '@/lib/settings';

export async function GET(request: Request) {
  try {
    const origin = await publicOrigin(request);
    const state = crypto.randomBytes(24).toString('base64url');
    const callback = `${origin}/api/auth/alipay/callback`;
    const target = new URL(request.url).searchParams.get('callbackUrl') || '/';
    const response = NextResponse.redirect(await alipayLoginUrl(callback, state));
    response.cookies.set('alipay.oauth.state', state, { httpOnly: true, sameSite: 'lax', secure: request.headers.get('x-forwarded-proto') === 'https', maxAge: 600, path: '/' });
    response.cookies.set('alipay.oauth.target', target, { httpOnly: true, sameSite: 'lax', secure: request.headers.get('x-forwarded-proto') === 'https', maxAge: 600, path: '/' });
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'alipay_login_not_configured', detail: String(error) }, { status: 503 });
  }
}
