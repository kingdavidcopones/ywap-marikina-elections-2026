import type {Metadata} from 'next';
import {AdminResults} from '@/components/admin-results';

export const metadata: Metadata = {title: 'Live results'};

export default function AdminResultsPage() {
  return <AdminResults />;
}
