import { getSettings } from '@/lib/settings';
import { signAlipay, verifyAlipay } from '@/lib/alipay-crypto';

export { signAlipay, verifyAlipay } from '@/lib/alipay-crypto';

export type AlipayConfig = { appId: string; gateway: string; privateKey: string; publicKey: string };

export async function alipayConfig(): Promise<AlipayConfig> {
  const values = await getSettings(['alipay.appId', 'alipay.gateway', 'alipay.privateKey', 'alipay.publicKey']);
  const config = { appId: values['alipay.appId'] || '', gateway: values['alipay.gateway'] || 'https://openapi.alipay.com/gateway.do', privateKey: values['alipay.privateKey'] || '', publicKey: values['alipay.publicKey'] || '' };
  if (!config.appId || !config.privateKey || !config.publicKey) throw new Error('alipay_not_configured');
  return config;
}

function formEncode(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

export async function alipayRequest(method: string, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const config = await alipayConfig();
  const params: Record<string, string> = { app_id: config.appId, method, format: 'JSON', charset: 'utf-8', sign_type: 'RSA2', timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '), version: '1.0', ...fields };
  params.sign = signAlipay(params, config.privateKey);
  const response = await fetch(config.gateway, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: formEncode(params), cache: 'no-store' });
  if (!response.ok) throw new Error(`alipay_http_${response.status}`);
  const json = await response.json() as Record<string, Record<string, unknown>>;
  const result = json[method.replaceAll('.', '_') + '_response'] || json.error_response;
  if (!result) throw new Error('alipay_empty_response');
  if (result.code && result.code !== '10000') throw new Error(`alipay_${String(result.sub_msg || result.msg || result.code)}`);
  return result;
}

export async function alipayLoginUrl(callbackUrl: string, state: string): Promise<string> {
  const config = await alipayConfig();
  const url = new URL('https://openauth.alipay.com/oauth2/publicAppAuthorize.htm');
  url.searchParams.set('app_id', config.appId);
  url.searchParams.set('scope', 'auth_user');
  url.searchParams.set('redirect_uri', callbackUrl);
  url.searchParams.set('state', state);
  return url.toString();
}

export async function alipayPagePay(args: { outTradeNo: string; subject: string; amountCents: number; notifyUrl: string; returnUrl: string }): Promise<string> {
  const config = await alipayConfig();
  const params: Record<string, string> = { app_id: config.appId, method: 'alipay.trade.page.pay', format: 'JSON', charset: 'utf-8', sign_type: 'RSA2', timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '), version: '1.0', notify_url: args.notifyUrl, return_url: args.returnUrl, biz_content: JSON.stringify({ subject: args.subject, out_trade_no: args.outTradeNo, total_amount: (args.amountCents / 100).toFixed(2), product_code: 'FAST_INSTANT_TRADE_PAY' }) };
  params.sign = signAlipay(params, config.privateKey);
  const url = new URL(config.gateway);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

export async function exchangeAlipayCode(code: string): Promise<string> {
  const result = await alipayRequest('alipay.system.oauth.token', { grant_type: 'authorization_code', code });
  if (typeof result.open_id !== 'string' || !result.open_id) throw new Error('alipay_user_missing');
  return result.open_id;
}
