'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InstallPage() {
  const router = useRouter();
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/install').then((r) => r.json()).then((body) => { if (!body.required) router.replace('/'); }); }, [router]);
  async function submit(event: FormEvent) { event.preventDefault(); setMessage(''); const response = await fetch('/api/install', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) }); const body = await response.json().catch(() => ({})); if (!response.ok) { setMessage(body.error || '安装失败'); return; } router.replace('/admin/login'); }
  return <main className="grid min-h-screen place-items-center bg-[#131416] px-4 text-white"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8"><h1 className="text-2xl font-bold">初始化管理员</h1><p className="mt-2 text-sm text-white/50">首次启动时创建管理员账号，完成后安装入口会关闭。</p><label className="mt-6 block text-sm">管理员账号<input required minLength={3} value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label><label className="mt-4 block text-sm">管理员密码（至少 10 位）<input required minLength={10} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label>{message && <p className="mt-4 text-sm text-red-300">{message}</p>}<button className="mt-6 w-full rounded-lg bg-[#7036F0] px-4 py-2.5 font-semibold">创建管理员</button></form></main>;
}
