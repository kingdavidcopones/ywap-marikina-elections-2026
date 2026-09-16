import type {Metadata} from 'next';
import {BallotConfirmation} from '@/components/ballot-confirmation';

export const metadata: Metadata = {title: 'Ballot submitted'};

export default function ConfirmationPage() {
  return <BallotConfirmation />;
}
