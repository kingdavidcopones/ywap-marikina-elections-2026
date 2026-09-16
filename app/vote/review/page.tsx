import type {Metadata} from 'next';
import {BallotReview} from '@/components/ballot-review';

export const metadata: Metadata = {title: 'Review your ballot'};

export default function ReviewPage() {
  return <BallotReview />;
}
