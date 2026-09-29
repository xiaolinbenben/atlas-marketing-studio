'use client';

import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const router = useRouter(); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); const result = await signIn('admin', { username, password, redirect: false }); if (result?.ok) router.replace('/admin/settings'); else setMessage('账号或密码错误'); }
  return <main className="grid min-h-screen place-items-center bg-[#131416] px-4 text-white"><form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-8"><h1 className="text-2xl font-bold">管理端登录</h1><label className="mt-6 block text-sm">账号<input required value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label><label className="mt-4 block text-sm">密码<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2" /></label>{message && <p className="mt-4 text-sm text-red-300">{message}</p>}<button className="mt-6 w-full rounded-lg bg-[#7036F0] px-4 py-2.5 font-semibold">登录</button></form></main>;
}
