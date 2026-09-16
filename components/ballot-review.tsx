'use client';

import {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {ListChecksIcon} from '@phosphor-icons/react/ListChecks';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {Text} from '@astryxdesign/core/Text';
import {Banner} from '@astryxdesign/core/Banner';
import {type ElectionEvent} from '@/lib/election-data';
import {fetchElection, fetchEligiblePositionIds} from '@/lib/api';
import {getBallotDraft, getVoterSession, markSubmitted, saveBallotDraft, saveVoterSession, type VoterSession} from '@/lib/voter-session';
import {isNetworkError, reportNetworkError} from '@/lib/network-error';
import {AccessGate} from './access-gate';
import {VoterFlowSkeleton} from './loading-states';

export function BallotReview() {
  const router = useRouter();
  const [voter, setVoter] = useState<VoterSession | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [election, setElection] = useState<ElectionEvent | null>(null);
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const session = getVoterSession();
    setVoter(session);
    setSelections(getBallotDraft().selections);
    if (!session?.ballotSlug) {
      setReady(true);
      return;
    }
    void Promise.all([fetchElection(session.ballotSlug), fetchEligiblePositionIds()])
      .then(([loadedElection, eligiblePositionIds]) => {
        setElection(loadedElection);
        const updatedSession = {...session, eligiblePositionIds};
        setVoter(updatedSession);
        saveVoterSession(updatedSession);
      })
      .catch(() => setElection(null))
      .finally(() => setReady(true));
  }, []);

  const ballotPositions = useMemo(() => voter && election ? election.positions.filter((position) => voter.eligiblePositionIds?.includes(position.id)) : [], [election, voter]);
  const complete = ballotPositions.every((position) => selections[position.id]);

  function edit(index: number) {
    saveBallotDraft({positionIndex: index, selections});
    router.push(voter?.ballotSlug ? `/vote/${voter.ballotSlug}` : '/vote');
  }

  function requestSubmission() {
    if (!complete) return;
    setIsSubmitDialogOpen(true);
  }

  async function submit() {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const allowedSelections = Object.fromEntries(ballotPositions.map((position) => [position.id, selections[position.id]]));
      const response = await fetch('/api/ballots', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({selections: allowedSelections})});
      const body = await response.json().catch(() => ({})) as {submittedAt?: string; message?: string};
      if (!response.ok || !body.submittedAt) {
        setSubmitError(body.message ?? 'The ballot could not be submitted. Please try again.');
        setIsSubmitDialogOpen(false);
        return;
      }
      markSubmitted(body.submittedAt, election?.title, voter?.ballotSlug, election?.anonymousVoting);
      router.push('/vote/confirmation');
    } catch (cause) {
      if (isNetworkError(cause)) reportNetworkError();
      setSubmitError('The ballot could not be submitted. Check your connection and try again.');
      setIsSubmitDialogOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!ready) return <VoterFlowSkeleton />;
  if (!voter || !election) return <AccessGate />;

  return (
    <AppShell height="auto" variant="wash" contentPadding={0}>
      <main className="review-page">
        <header className="review-header">
          <Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={138} height={40} />
          <Button label="Back to ballot" variant="ghost" onClick={() => router.push(voter?.ballotSlug ? `/vote/${voter.ballotSlug}` : '/vote')} />
        </header>
        <section className="review-content">
          {ballotPositions.length ? (
            <VStack gap={8}>
            {submitError ? <Banner status="error" title="Your ballot was not submitted" description={submitError} container="section" /> : null}
            <VStack gap={2}>
              <Heading level={1}>Review your ballot</Heading>
              <Text weight="semibold">{election.title}</Text>
              <Text color="secondary" as="p">
                Take a moment to check each choice. Once you submit, you won’t be able to make changes or vote again.
              </Text>
            </VStack>

            <VStack gap={3}>
              {ballotPositions.map((position, index) => {
                const nomineeId = selections[position.id];
                const nominee = position.nominees.find((item) => item.id === nomineeId);
                return (
                  <Card key={position.id} padding={5} className="review-row">
                    <HStack gap={4} align="center" justify="between">
                      <HStack gap={4} align="center">
                        {nomineeId === 'abstain' ? (
                          <Text className="abstain-mark" aria-hidden="true">—</Text>
                        ) : (
                          <Avatar
                            name={nominee?.name ?? 'No selection'}
                            src={nominee?.imageUrl}
                            size="lg"
                            shape="rounded"
                            tooltip={false}
                          />
                        )}
                        <VStack gap={1}>
                          <Text type="supporting" color="secondary">{position.name}</Text>
                          <Heading level={3}>{nomineeId === 'abstain' ? 'Abstain' : nominee?.name ?? 'No selection'}</Heading>
                        </VStack>
                      </HStack>
                      <Button label={`Edit ${position.name}`} variant="secondary" size="sm" onClick={() => edit(index)}>Edit</Button>
                    </HStack>
                  </Card>
                );
              })}
            </VStack>

            <Card variant="yellow" padding={6}>
              <VStack gap={2}>
                {election.anonymousVoting ? (
                  <>
                    <Heading level={3}>Your choices stay private</Heading>
                    <Text as="p">We record that you voted, but keep that record separate from the choices on your ballot.</Text>
                  </>
                ) : (
                  <>
                    <Heading level={3}>Your choices are recorded with your identity</Heading>
                    <Text as="p">Election administrators can see your choices together with your name and member ID after you submit.</Text>
                  </>
                )}
              </VStack>
            </Card>

            <footer className="review-actions">
              <Button label="Make changes" variant="secondary" onClick={() => router.push(voter?.ballotSlug ? `/vote/${voter.ballotSlug}` : '/vote')} />
              <Button label="Submit ballot" variant="primary" onClick={requestSubmission} isDisabled={!complete} />
            </footer>
            </VStack>
          ) : (
            <Card padding={8}>
              <EmptyState
                icon={<Icon icon={ListChecksIcon} size="lg" />}
                title="There are no ballot choices to review"
                description="Return to the ballot or contact the election committee if you expected to see positions here."
                actions={<Button label="Return to ballot" variant="primary" onClick={() => router.push(voter.ballotSlug ? `/vote/${voter.ballotSlug}` : '/vote')} />}
                headingLevel={1}
              />
            </Card>
          )}
        </section>
      </main>
      <AlertDialog
        isOpen={isSubmitDialogOpen}
        onOpenChange={setIsSubmitDialogOpen}
        title="Submit your ballot?"
        description="Once submitted, you won’t be able to change your choices or submit another ballot."
        actionLabel="Submit ballot"
        actionVariant="primary"
        cancelLabel="Keep reviewing"
        onAction={submit}
        isActionLoading={isSubmitting}
      />
    </AppShell>
  );
}
