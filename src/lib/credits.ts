import { prisma } from '@/lib/prisma';

export async function getCredits(userId: string): Promise<number> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  return u?.credits ?? 0;
}

export async function grantCredits(
  userId: string,
  amount: number,
  reason: string,
  ref?: string,
): Promise<void> {
  if (amount <= 0) return;
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { credits: { increment: amount } } }),
    prisma.creditLedger.create({ data: { userId, delta: amount, reason, ref } }),
  ]);
}

/** Atomically spend credits. Throws INSUFFICIENT_CREDITS if balance too low. */
export async function deductCredits(
  userId: string,
  amount: number,
  reason: string,
  ref?: string,
): Promise<void> {
  if (amount <= 0) return;
  await prisma.$transaction(async (tx) => {
    // 条件扣减和流水写入在同一个 SQLite 事务中，余额不足时整个事务回滚。
    const res = await tx.user.updateMany({
      where: { id: userId, credits: { gte: amount } },
      data: { credits: { decrement: amount } },
    });
    if (res.count === 0) throw new Error('INSUFFICIENT_CREDITS');
    await tx.creditLedger.create({ data: { userId, delta: -amount, reason, ref } });
  });
}
