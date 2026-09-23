'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {fetchElection} from '@/lib/api';
import {
  getSubmissionReceipt,
  getVoterSession,
  markSubmitted,
  type SubmissionReceipt,
} from '@/lib/voter-session';
import {AccessGate} from './access-gate';
import {BallotConfetti} from './ballot-confetti';

export function BallotConfirmation() {
  const [receipt, setReceipt] = useState<SubmissionReceipt | null | undefined>(undefined);

  useEffect(() => {
    let isActive = true;

    async function loadReceipt() {
      const savedReceipt = getSubmissionReceipt();
      if (!savedReceipt) {
        if (isActive) setReceipt(null);
        return;
      }

      let electionTitle = savedReceipt.electionTitle;
      let anonymousVoting = savedReceipt.anonymousVoting;
      const ballotSlug = savedReceipt.ballotSlug ?? getVoterSession()?.ballotSlug;

      if ((!electionTitle || anonymousVoting === undefined) && ballotSlug) {
        try {
          const election = await fetchElection(ballotSlug);
          electionTitle = election.title;
          anonymousVoting = election.anonymousVoting;
          markSubmitted(savedReceipt.submittedAt, electionTitle, ballotSlug, anonymousVoting);
        } catch {
          // Keep the confirmation available even if the election lookup fails.
        }
      }

      if (isActive) {
        setReceipt({...savedReceipt, ...(electionTitle ? {electionTitle} : {}), ...(typeof anonymousVoting === 'boolean' ? {anonymousVoting} : {})});
      }
    }

    void loadReceipt();
    return () => {
      isActive = false;
    };
  }, []);

  if (receipt === undefined) return null;
  if (!receipt) return <AccessGate title="We couldn’t find a submitted ballot" />;

  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <BallotConfetti />
      <main className="confirmation-page">
        <VStack gap={6} className="confirmation-stack">
          <Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} />
          <Card maxWidth={520} width="100%" padding={10} elevation="low" className="confirmation-card">
            <VStack gap={6}>
              <Text className="confirmation-mark" aria-hidden="true">✓</Text>
              <VStack gap={2}>
                <Heading level={1}>Your ballot is in</Heading>
                <Text color="secondary" as="p">
                  Thank you for making your voice count in {receipt.electionTitle ?? 'this election'}.
                </Text>
              </VStack>
              <dl className="confirmation-details">
                <dt>Submitted at</dt>
                <dd>{new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'}).format(new Date(receipt.submittedAt))}</dd>
                <dt>Status</dt>
                <dd>Recorded</dd>
              </dl>
              <Text type="supporting" color="secondary" as="p">
                {receipt.anonymousVoting === false
                  ? 'Your ballot has been successfully recorded.'
                  : 'To protect your privacy, we don’t show your choices or create a code that could be linked back to them.'}
              </Text>
              <Button label="Done" href={receipt.ballotSlug ? `/vote/${receipt.ballotSlug}` : '/vote'} as="a" variant="primary" width="100%" />
            </VStack>
          </Card>
        </VStack>
      </main>
    </AppShell>
  );
}
