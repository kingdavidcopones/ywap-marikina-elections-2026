'use client';

import {useEffect, useMemo, useState} from 'react';
import {useRouter} from 'next/navigation';
import Image from 'next/image';
import {CheckCircleIcon} from '@phosphor-icons/react/CheckCircle';
import {ListChecksIcon} from '@phosphor-icons/react/ListChecks';
import {UserCircleDashedIcon} from '@phosphor-icons/react/UserCircleDashed';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, Layout, LayoutContent, LayoutFooter, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {Text} from '@astryxdesign/core/Text';
import {
  deterministicShuffle,
  type ElectionEvent,
  type Position,
} from '@/lib/election-data';
import {fetchElection, fetchEligiblePositionIds} from '@/lib/api';
import {getBallotDraft, getVoterSession, saveBallotDraft, saveVoterSession, type VoterSession} from '@/lib/voter-session';
import {AccessGate} from './access-gate';
import {VoterFlowSkeleton} from './loading-states';

export function BallotFlow({ballotSlug}: {ballotSlug?: string}) {
  const router = useRouter();
  const [voter, setVoter] = useState<VoterSession | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [showError, setShowError] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [election, setElection] = useState<ElectionEvent | null>(null);

  useEffect(() => {
    const session = getVoterSession();
    const draft = getBallotDraft();
    const activeSlug = ballotSlug ?? session?.ballotSlug;
    setVoter(session);
    setActiveIndex(draft.positionIndex);
    setSelections(draft.selections);
    if (!activeSlug) {
      setReady(true);
      return;
    }
    void Promise.all([fetchElection(activeSlug), fetchEligiblePositionIds()])
      .then(([loadedElection, eligiblePositionIds]) => {
        setElection(loadedElection);
        if (session) {
          const updatedSession = {...session, eligiblePositionIds};
          setVoter(updatedSession);
          saveVoterSession(updatedSession);
        }
        const eligibleCount = loadedElection.positions.filter((position) => eligiblePositionIds.includes(position.id)).length;
        setActiveIndex(Math.min(draft.positionIndex, Math.max(eligibleCount - 1, 0)));
      })
      .catch(() => setElection(null))
      .finally(() => setReady(true));
  }, [ballotSlug]);

  const ballotPositions = useMemo(
    () => voter && election ? election.positions.filter((position) => voter.eligiblePositionIds?.includes(position.id)) : [],
    [election, voter],
  );
  const current = ballotPositions[activeIndex];

  const nominees = useMemo(
    () => current && voter
      ? deterministicShuffle(current.nominees, `${voter.memberId}:${current.id}`)
      : [],
    [current, voter],
  );

  function select(position: Position, nomineeId: string) {
    const next = {...selections, [position.id]: nomineeId};
    setSelections(next);
    setShowError(false);
    saveBallotDraft({positionIndex: activeIndex, selections: next});
  }

  function moveTo(index: number) {
    setActiveIndex(index);
    saveBallotDraft({positionIndex: index, selections});
  }

  function continueFlow() {
    if (!current || !selections[current.id]) {
      setShowError(true);
      return;
    }
    if (activeIndex === ballotPositions.length - 1) {
      saveBallotDraft({positionIndex: activeIndex, selections});
      router.push('/vote/review');
      return;
    }
    moveTo(activeIndex + 1);
  }

  function leaveBallot() {
    setIsLeaveDialogOpen(false);
    router.push('/');
  }

  if (!ready) return <VoterFlowSkeleton />;
  if (!voter || !election) return <AccessGate />;
  if (!current) {
    return (
      <AppShell height="fill" variant="wash" contentPadding={0}>
        <main className="gate-page">
          <Card maxWidth={520} width="100%" padding={8}>
            <EmptyState
              icon={<Icon icon={ListChecksIcon} size="lg" />}
              title="This ballot has no positions yet"
              description="The election committee is still preparing this ballot. Check back after the election is ready."
              actions={<Button label="Return to voter sign-in" href="/" variant="primary" />}
              headingLevel={1}
            />
          </Card>
        </main>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell height="fill" variant="wash" contentPadding={0}>
        <main className="ballot-page">
        <header className="ballot-topbar">
          <Image
            src="/brand/ywap-marikina-elections-logo-word.svg"
            alt="YWAP Marikina Elections 2026"
            width={138}
            height={40}
            priority
          />
          <Text type="supporting" color="secondary">
            {election.title} · Voting as {voter.firstName}
          </Text>
        </header>

        <section className="ballot-progress" aria-label="Ballot progress">
          <progress max={ballotPositions.length} value={activeIndex + 1} aria-label={`${activeIndex + 1} of ${ballotPositions.length} ballot choices`} />
        </section>

        <section className="ballot-grid">
          <aside className="role-panel" aria-labelledby="role-heading">
            <VStack gap={8}>
              <VStack gap={1}>
                <Text type="label" color="secondary">Position {activeIndex + 1} of {ballotPositions.length}</Text>
                <Heading level={1} id="role-heading">{current.name}</Heading>
              </VStack>

              <Card variant="muted" padding={6}>
                <VStack gap={3}>
                  <Heading level={3}>About this role</Heading>
                  <Text as="p">{current.description}</Text>
                </VStack>
              </Card>

              <Card variant="muted" padding={6}>
                <VStack gap={4}>
                  <Heading level={3}>Responsibilities</Heading>
                  <ul className="responsibility-list">
                    {current.responsibilities.map((responsibility) => (
                      <li key={responsibility}>
                        <Icon icon={CheckCircleIcon} color="accent" size="sm" />
                        <Text>{responsibility}</Text>
                      </li>
                    ))}
                  </ul>
                </VStack>
              </Card>
            </VStack>
          </aside>

          <section className="choice-panel" aria-labelledby="choice-heading">
            <VStack gap={6}>
              <header className="choice-header">
                <VStack gap={1}>
                  <Heading level={2} id="choice-heading">Choose a candidate for {current.name}</Heading>
                  <Text color="secondary">Select one candidate{current.abstainEnabled ? ', or choose not to vote for this position' : ''}. The order is randomized for fairness.</Text>
                </VStack>
                <Text type="supporting" color="secondary">Choices saved on this device</Text>
              </header>

              {showError ? (
                  <Banner
                    status="error"
                    title="Choose before continuing"
                    description={current.abstainEnabled ? 'Select a candidate, or choose not to vote for this position.' : 'Select one candidate for this position.'}
                  container="section"
                />
              ) : null}

              <fieldset className="choice-fieldset">
                <legend className="sr-only">Candidates for {current.name}</legend>
                <VStack gap={4}>
                  {!nominees.length ? (
                    <EmptyState
                      isCompact
                      icon={<Icon icon={UserCircleDashedIcon} size="lg" />}
                      title="No candidates are listed"
                      description="The election committee has not added candidates for this position yet."
                    />
                  ) : null}
                  {nominees.map((nominee) => {
                    const selected = selections[current.id] === nominee.id;
                    return (
                      <SelectableCard
                        key={nominee.id}
                        label={`Select ${nominee.name} for ${current.name}`}
                        isSelected={selected}
                        onChange={() => select(current, nominee.id)}
                        padding={5}
                        elevation={selected ? 'low' : 'none'}
                        className="nominee-card"
                      >
                        <HStack gap={4} align="center">
                          <Avatar name={nominee.name} src={nominee.imageUrl} size="lg" shape="rounded" tooltip={false} />
                          <VStack gap={1} className="nominee-copy">
                            <Text type="large" weight="semibold">{nominee.name}</Text>
                          </VStack>
                          {selected ? <Text type="label" color="accent">Selected</Text> : null}
                        </HStack>
                      </SelectableCard>
                    );
                  })}

                  {current.abstainEnabled ? (
                    <SelectableCard
                      label={`Abstain from ${current.name}`}
                      isSelected={selections[current.id] === 'abstain'}
                      onChange={() => select(current, 'abstain')}
                      padding={5}
                      className="nominee-card abstain-card"
                    >
                      <HStack gap={4} align="center">
                        <Text className="abstain-mark" aria-hidden="true">—</Text>
                        <VStack gap={1} className="nominee-copy">
                          <Text type="large" weight="semibold">Abstain</Text>
                          <Text type="supporting" color="secondary">Choose no candidate for this position.</Text>
                        </VStack>
                      </HStack>
                    </SelectableCard>
                  ) : null}
                </VStack>
              </fieldset>
            </VStack>
          </section>
        </section>

        <footer className="ballot-actions">
          <Button label="Leave ballot" variant="ghost" onClick={() => setIsLeaveDialogOpen(true)} />
          <HStack gap={3}>
            <Button
              label="Back"
              variant="secondary"
              onClick={() => moveTo(activeIndex - 1)}
              isDisabled={activeIndex === 0}
            />
            <Button
              label={activeIndex === ballotPositions.length - 1 ? 'Review ballot' : 'Next position'}
              variant="primary"
              onClick={continueFlow}
            />
          </HStack>
        </footer>
        </main>
      </AppShell>

      <Dialog
        isOpen={isLeaveDialogOpen}
        onOpenChange={setIsLeaveDialogOpen}
        width={400}
        purpose="form"
      >
        <Layout
          header={<DialogHeader title="Leave your ballot?" onOpenChange={setIsLeaveDialogOpen} />}
          content={
            <LayoutContent>
              <Text>Your choices are saved on this device. You can return to this ballot and continue where you left off.</Text>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={2} hAlign="end">
                <Button label="Cancel" variant="secondary" onClick={() => setIsLeaveDialogOpen(false)} />
                <Button label="Leave ballot" variant="primary" onClick={leaveBallot} />
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
