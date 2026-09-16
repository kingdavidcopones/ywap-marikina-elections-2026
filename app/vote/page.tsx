import type {Metadata} from 'next';
import {BallotFlow} from '@/components/ballot-flow';

export const metadata: Metadata = {title: 'Your ballot'};

export default function VotePage() {
  return <BallotFlow />;
}
