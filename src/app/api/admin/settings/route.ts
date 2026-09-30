import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSettings, maskSecret, saveSettings } from '@/lib/settings';

const SETTING_GROUPS = [
  { key: 'public', label: '公开域名' },
  { key: 'alipay', label: '支付宝配置' },
  { key: 'openai', label: 'OpenAI API 配置' },
  { key: 'seedance', label: 'Seedance API 配置' },
  { key: 's3', label: 'S3 配置' },
  { key: 'signup', label: '注册赠送积分配置' },
  { key: 'packs', label: '套餐配置' },
  { key: 'video', label: '视频生成费用配置' },
] as const;

type Field = { key: string; label: string; secret: boolean; group: (typeof SETTING_GROUPS)[number]['key'] };

// Provider model IDs intentionally do not appear here. They are fixed in code.
const FIELDS: readonly Field[] = [
  { key: 'app.baseUrl', label: '公开域名', secret: false, group: 'public' },
  { key: 'alipay.appId', label: 'APPID', secret: false, group: 'alipay' },
  { key: 'alipay.gateway', label: '网关地址', secret: false, group: 'alipay' },
  { key: 'alipay.privateKey', label: '应用私钥', secret: true, group: 'alipay' },
  { key: 'alipay.publicKey', label: '支付宝公钥', secret: true, group: 'alipay' },
  { key: 'provider.openai.baseUrl', label: 'API 地址', secret: false, group: 'openai' },
  { key: 'provider.openai.apiKey', label: 'API Key', secret: true, group: 'openai' },
  { key: 'provider.seedance.baseUrl', label: 'API 地址', secret: false, group: 'seedance' },
  { key: 'provider.seedance.apiKey', label: 'API Key', secret: true, group: 'seedance' },
  { key: 's3.endpoint', label: 'Endpoint', secret: false, group: 's3' },
  { key: 's3.region', label: 'Region', secret: false, group: 's3' },
  { key: 's3.bucket', label: 'Bucket', secret: false, group: 's3' },
  { key: 's3.accessKeyId', label: 'Access Key', secret: true, group: 's3' },
  { key: 's3.secretAccessKey', label: 'Secret Key', secret: true, group: 's3' },
  { key: 's3.publicUrl', label: 'S3 Public URL', secret: false, group: 's3' },
  { key: 'credits.signupBonus', label: '注册赠送积分', secret: false, group: 'signup' },
];

async function admin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'admin' ? session : null;
}

export async function GET() {
  if (!(await admin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const values = await getSettings(FIELDS.map((field) => field.key));
  return NextResponse.json({
    groups: SETTING_GROUPS,
    fields: FIELDS.map((field) => ({
      ...field,
      configured: Boolean(values[field.key]),
      value: field.secret ? '' : values[field.key] || '',
      hint: field.secret ? maskSecret(values[field.key] || '') : '',
    })),
  });
}

export async function PUT(request: Request) {
  if (!(await admin())) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const input = body?.values && typeof body.values === 'object' ? body.values as Record<string, unknown> : {};
  const allowed = new Map(FIELDS.map((field) => [field.key, field.secret]));
  const updates: Record<string, { value: string; encrypted: boolean }> = {};
  for (const [key, raw] of Object.entries(input)) {
    if (!allowed.has(key) || typeof raw !== 'string') return NextResponse.json({ error: 'unsupported_setting' }, { status: 400 });
    if (allowed.get(key) && !raw.trim()) continue;
    updates[key] = { value: raw.trim(), encrypted: allowed.get(key) === true };
  }
  if (Object.keys(updates).length) await saveSettings(updates);
  return NextResponse.json({ ok: true });
}
