import type {Metadata} from 'next';
import {AdminLiveResult} from '@/components/admin-results';

export const metadata: Metadata = {title: 'Election live results'};

export default async function AdminLiveResultPage({params}: {params: Promise<{eventId: string}>}) {
  const {eventId} = await params;
  return <AdminLiveResult eventId={eventId} />;
}
