import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import AdminSettingsClient from '../settings-client';

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') redirect('/admin/login');
  return <AdminSettingsClient />;
}
