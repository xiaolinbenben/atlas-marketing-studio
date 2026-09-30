import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

type SettingRow = { key: string; value: string; encrypted: boolean };

function keyMaterial(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('NEXTAUTH_SECRET is required');
  return crypto.createHash('sha256').update(`atlas-settings:${secret}`).digest();
}

export function encryptSetting(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSetting(value: string): string {
  const [ivText, tagText, dataText] = value.split('.');
  if (!ivText || !tagText || !dataText) throw new Error('invalid_encrypted_setting');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyMaterial(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}

export async function getSetting(key: string, fallback = ''): Promise<string> {
  const row = await prisma.appSetting.findUnique({ where: { key }, select: { value: true, encrypted: true } });
  if (!row) return fallback;
  return row.encrypted ? decryptSetting(row.value) : row.value;
}

export async function getSettings(keys?: string[]): Promise<Record<string, string>> {
  const rows = await prisma.appSetting.findMany({
    where: keys?.length ? { key: { in: keys } } : undefined,
    select: { key: true, value: true, encrypted: true },
  });
  return Object.fromEntries(rows.map((row: SettingRow) => [row.key, row.encrypted ? decryptSetting(row.value) : row.value]));
}

export async function saveSettings(values: Record<string, { value: string; encrypted?: boolean }>): Promise<void> {
  await prisma.$transaction(
    Object.entries(values).map(([key, input]) => prisma.appSetting.upsert({
      where: { key },
      create: { key, value: input.encrypted ? encryptSetting(input.value) : input.value, encrypted: input.encrypted === true },
      update: { value: input.encrypted ? encryptSetting(input.value) : input.value, encrypted: input.encrypted === true },
    })),
  );
}

export function maskSecret(value: string): string {
  if (!value) return '';
  return value.length <= 4 ? '****' : `****${value.slice(-4)}`;
}

export async function publicOrigin(request?: Request): Promise<string> {
  const domain = (await getSetting('app.baseUrl')).trim();
  if (domain) return `https://${domain}`;
  if (request) {
    const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'http';
    const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host');
    if (host) return `${proto}://${host}`.replace(/\/+$/, '');
    return new URL(request.url).origin;
  }
  return 'http://localhost:3000';
}
