import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { signAlipay, verifyAlipay } from '../src/lib/alipay-crypto.ts';

test('signs and verifies an Alipay RSA2 parameter set', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const params = {
    app_id: '2026000000000000',
    method: 'alipay.trade.page.pay',
    sign_type: 'RSA2',
    charset: 'utf-8',
    biz_content: '{"total_amount":"39.00"}',
  };
  const signed = { ...params, sign: signAlipay(params, privatePem) };
  assert.equal(verifyAlipay(signed, publicPem), true);
  const derPrivate = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const derPublic = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const derSigned = { ...params, sign: signAlipay(params, derPrivate) };
  assert.equal(verifyAlipay(derSigned, derPublic), true);
  assert.equal(verifyAlipay({ ...signed, biz_content: '{"total_amount":"0.01"}' }, publicPem), false);
});
