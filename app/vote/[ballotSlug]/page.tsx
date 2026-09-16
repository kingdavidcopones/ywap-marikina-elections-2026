import type {Metadata} from 'next';
import {EventBallot} from '@/components/event-ballot';

export const metadata: Metadata = {title: 'Your ballot'};

export default async function EventBallotPage({params}: {params: Promise<{ballotSlug: string}>}) {
  const {ballotSlug} = await params;
  return <EventBallot ballotSlug={ballotSlug} />;
}
