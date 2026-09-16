import type {Metadata} from 'next';
import {VoterResults} from '@/components/voter-results';

export const metadata: Metadata = {title: 'Published results'};

export default function ResultsPage() {
  return <VoterResults />;
}
