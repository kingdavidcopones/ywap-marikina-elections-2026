'use client';

import {useEffect, useState} from 'react';
import {getVoterSession} from '@/lib/voter-session';
import {BallotFlow} from './ballot-flow';
import {VoterAccess} from './voter-access';

export function EventBallot({ballotSlug}: {ballotSlug: string}) {
  const [verified, setVerified] = useState<boolean | null>(null);

  useEffect(() => {
    setVerified(getVoterSession()?.ballotSlug === ballotSlug);
  }, [ballotSlug]);

  if (verified === null) return null;
  if (!verified) return <VoterAccess ballotSlug={ballotSlug} onVerified={() => setVerified(true)} />;
  return <BallotFlow ballotSlug={ballotSlug} />;
}
