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
    out_trade_no: 'AMS1',
    total_amount: '0.10',
    trade_status: 'TRADE_SUCCESS',
    sign_type: 'RSA2',
  };
  const content = { ...params };
  delete content.sign_type;
  const signed = { ...params, sign: signAlipay(content, privatePem) };
  assert.equal(verifyAlipay(signed, publicPem), true);
  const derPrivate = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  const derPublic = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const derSigned = { ...params, sign: signAlipay(content, derPrivate) };
  assert.equal(verifyAlipay(derSigned, derPublic), true);
  assert.equal(verifyAlipay({ ...signed, total_amount: '0.01' }, publicPem), false);
});
