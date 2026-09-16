import type {Metadata} from 'next';
import {AdminShell} from '@/components/admin-shell';

export const metadata: Metadata = {title: 'Election admin'};

export default function AdminLayout({children}: {children: React.ReactNode}) {
  return <AdminShell>{children}</AdminShell>;
}
