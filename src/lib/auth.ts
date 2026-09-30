import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { publicOrigin } from '@/lib/settings';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'admin',
      name: 'Admin',
      credentials: { username: { label: 'Username', type: 'text' }, password: { label: 'Password', type: 'password' } },
      async authorize(credentials) {
        const username = String(credentials?.username || '').trim();
        const password = String(credentials?.password || '');
        const admin = username ? await prisma.adminUser.findUnique({ where: { username } }) : null;
        if (!admin || !verifyPassword(password, admin.passwordHash)) return null;
        return { id: `admin:${admin.id}`, name: admin.username, email: null, role: 'admin', credits: 0 };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  // The public domain is configured after installation, so no public URL
  // environment variable is required. Keep the cookie name stable until then.
  useSecureCookies: false,
  logger: {
    warn(code) {
      if (code !== 'NEXTAUTH_URL') console.warn(`[next-auth][warn][${code}]`);
    },
  },
  callbacks: {
    async redirect({ url }) {
      const origin = await publicOrigin();
      const target = new URL(url, origin);
      return target.origin === origin ? target.href : origin;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.role = (user as { role?: string }).role || 'user';
        token.credits = (user as { credits?: number }).credits ?? 0;
      }
      if (token.sub && token.role !== 'admin' && !String(token.sub).startsWith('admin:')) {
        const current = await prisma.user.findUnique({ where: { id: String(token.sub) }, select: { credits: true, role: true, name: true, image: true, email: true } });
        if (current) Object.assign(token, { credits: current.credits, role: current.role, name: current.name, picture: current.image, email: current.email });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub || '');
        session.user.credits = Number(token.credits || 0);
        session.user.role = String(token.role || 'user');
        session.user.name = typeof token.name === 'string' ? token.name : session.user.name;
        session.user.image = typeof token.picture === 'string' ? token.picture : session.user.image;
      }
      return session;
    },
  },
  pages: { signIn: '/' },
};

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [salt, expected] = encoded.split(':');
  if (!salt || !expected || !/^[0-9a-f]{128}$/i.test(expected)) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}
