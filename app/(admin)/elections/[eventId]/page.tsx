import type {Metadata} from 'next';
import {ElectionEventEditor} from '@/components/election-event-editor';

export const metadata: Metadata = {title: 'Manage election'};

export default async function ElectionEventPage({params}: {params: Promise<{eventId: string}>}) {
  const {eventId} = await params;
  return <ElectionEventEditor eventId={eventId} />;
}
