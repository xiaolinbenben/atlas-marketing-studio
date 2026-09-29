'use client';

export function startAlipayLogin(callbackUrl = window.location.href): void {
  window.location.assign(`/api/auth/alipay/start?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
