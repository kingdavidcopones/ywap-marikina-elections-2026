'use client';

import {useEffect, useRef, useState} from 'react';
import dynamic from 'next/dynamic';
import {fetchElectionAvailability, type ElectionAvailability} from '@/lib/api';
import {consumeVerificationTransition, getSubmissionReceipt, getVoterSession} from '@/lib/voter-session';
import {VerifiedBallotSkeleton, VoterEntryLoading, VoterFlowSkeleton} from './loading-states';
import {VoterLinkState} from './voter-link-state';

const BallotFlow = dynamic(
  () => import('./ballot-flow').then((module) => module.BallotFlow),
  {loading: () => <VoterFlowSkeleton />},
);
const VerifiedBallotFlow = dynamic(
  () => import('./ballot-flow').then((module) => module.BallotFlow),
  {loading: () => <VerifiedBallotSkeleton />},
);
const BallotConfirmation = dynamic(
  () => import('./ballot-confirmation').then((module) => module.BallotConfirmation),
  {loading: () => <VoterEntryLoading />},
);
const VoterAccess = dynamic(
  () => import('./voter-access').then((module) => module.VoterAccess),
  {loading: () => <VoterEntryLoading />},
);

export function EventBallot({ballotSlug}: {ballotSlug: string}) {
  const transitionRef = useRef<{ballotSlug: string; fromVerification: boolean} | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);
  const [availability, setAvailability] = useState<ElectionAvailability | null | undefined>(undefined);
  const [fromVerification, setFromVerification] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const session = getVoterSession();
    const receipt = getSubmissionReceipt();
    if (transitionRef.current?.ballotSlug !== ballotSlug) {
      transitionRef.current = {ballotSlug, fromVerification: consumeVerificationTransition(ballotSlug)};
    }
    setFromVerification(transitionRef.current.fromVerification);
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

  if (verified === null || hasSubmitted === null || availability === undefined) return <VoterEntryLoading />;
  if (hasSubmitted) return <BallotConfirmation onDone={() => {
    setHasSubmitted(false);
    setVerified(false);
  }} />;
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
  if (!verified) return <VoterAccess ballotSlug={ballotSlug} onVerified={() => {
    transitionRef.current = {ballotSlug, fromVerification: true};
    setFromVerification(true);
    setVerified(true);
  }} />;
  return fromVerification
    ? <VerifiedBallotFlow ballotSlug={ballotSlug} fromVerification />
    : <BallotFlow ballotSlug={ballotSlug} />;
}
