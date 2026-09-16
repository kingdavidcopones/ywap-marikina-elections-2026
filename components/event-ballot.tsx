'use client';

import {useEffect, useState} from 'react';
import dynamic from 'next/dynamic';
import {fetchElectionAvailability, type ElectionAvailability} from '@/lib/api';
import {getSubmissionReceipt, getVoterSession} from '@/lib/voter-session';
import {VoterFlowSkeleton} from './loading-states';
import {VoterLinkState} from './voter-link-state';

const BallotFlow = dynamic(
  () => import('./ballot-flow').then((module) => module.BallotFlow),
  {loading: () => <VoterFlowSkeleton />},
);
const BallotConfirmation = dynamic(
  () => import('./ballot-confirmation').then((module) => module.BallotConfirmation),
  {loading: () => <VoterFlowSkeleton />},
);
const VoterAccess = dynamic(
  () => import('./voter-access').then((module) => module.VoterAccess),
  {loading: () => <VoterFlowSkeleton />},
);

export function EventBallot({ballotSlug}: {ballotSlug: string}) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<ElectionAvailability | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const session = getVoterSession();
    const receipt = getSubmissionReceipt();
    setVerified(session?.ballotSlug === ballotSlug);
    setHasSubmitted(Boolean(
      receipt
      && session?.ballotSlug === ballotSlug
      && (!receipt.ballotSlug || receipt.ballotSlug === ballotSlug),
    ));
    void fetchElectionAvailability(ballotSlug).then(setAvailability).catch(() => setAvailability(null));
  }, [ballotSlug]);

  useEffect(() => {
    if (!availability?.opensAt && !availability?.closesAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [availability?.closesAt, availability?.opensAt]);

  if (verified === null || hasSubmitted === null || availability === undefined) return <VoterFlowSkeleton />;
  if (hasSubmitted) return <BallotConfirmation />;
  if (!availability) return <VoterLinkState kind="unavailable" />;

  const startsAt = availability.opensAt ? new Date(availability.opensAt).getTime() : Number.NaN;
  const closesAt = availability.closesAt ? new Date(availability.closesAt).getTime() : Number.NaN;
  const isBeforeStart = Number.isFinite(startsAt) && now < startsAt;
  const isAfterClose = Number.isFinite(closesAt) && now > closesAt;
  const isVotingStatus = availability.status === 'Open' || availability.status === 'Published' || availability.status === 'Scheduled';

  if (availability.status === 'Scheduled' && isBeforeStart) {
    return <VoterLinkState kind="scheduled" electionTitle={availability.title} startsAt={availability.opensAt} now={now} />;
  }
  if (!isVotingStatus || isBeforeStart || isAfterClose) {
    return <VoterLinkState kind="unavailable" electionTitle={availability.title} />;
  }
  if (!verified) return <VoterAccess ballotSlug={ballotSlug} onVerified={() => setVerified(true)} />;
  return <BallotFlow ballotSlug={ballotSlug} />;
}
