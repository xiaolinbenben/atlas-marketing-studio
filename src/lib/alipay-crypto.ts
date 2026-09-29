import crypto from 'node:crypto';

function privateKey(value: string): string | crypto.KeyObject {
  if (value.includes('BEGIN')) return value.replace(/\\n/g, '\n');
  const der = Buffer.from(value.replace(/\s/g, ''), 'base64');
  try {
    return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch {
    return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs1' });
  }
}

function publicKey(value: string): string | crypto.KeyObject {
  if (value.includes('BEGIN')) return value.replace(/\\n/g, '\n');
  const der = Buffer.from(value.replace(/\s/g, ''), 'base64');
  try {
    return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch {
    return crypto.createPublicKey({ key: der, format: 'der', type: 'pkcs1' });
  }
}

function signContent(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

export function signAlipay(params: Record<string, string>, key: string): string {
  return crypto.createSign('RSA-SHA256').update(signContent(params)).sign(privateKey(key), 'base64');
}

export function verifyAlipay(params: Record<string, string>, key: string): boolean {
  if (params.sign_type && params.sign_type !== 'RSA2') return false;
  return crypto.createVerify('RSA-SHA256').update(signContent(params)).verify(publicKey(key), params.sign || '', 'base64');
}
