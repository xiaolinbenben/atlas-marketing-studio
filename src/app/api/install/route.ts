import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  return NextResponse.json({ required: !(await prisma.adminUser.count()) });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (username.length < 3 || password.length < 10) return NextResponse.json({ error: 'invalid_setup_input' }, { status: 400 });
  const result = await prisma.$transaction(async (tx) => {
    if (await tx.adminUser.count()) throw new Error('setup_already_completed');
    return tx.adminUser.create({ data: { username, passwordHash: hashPassword(password) } });
  }).catch((error) => ({ error: String(error.message || error) }));
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, username: result.username });
}
