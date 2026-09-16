'use client';

import {useEffect, useState} from 'react';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArrowClockwiseIcon} from '@phosphor-icons/react/ArrowClockwise';
import {CaretRightIcon} from '@phosphor-icons/react/CaretRight';
import {ChartBarIcon} from '@phosphor-icons/react/ChartBar';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {List, ListItem} from '@astryxdesign/core/List';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import {
  type ElectionResult,
  type ElectionEvent,
  type ElectionSummary,
} from '@/lib/election-data';
import {fetchElections, fetchResults} from '@/lib/api';
import {LiveResultSkeleton, ResultsIndexSkeleton} from '@/components/loading-states';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
});

function formatElectionDate(event: ElectionSummary) {
  if (!event.electionDate) return 'Not scheduled';
  return dateFormatter.format(new Date(`${event.electionDate}T00:00:00+08:00`));
}

function statusVariant(status: ElectionEvent['status']) {
  if (status === 'Open' || status === 'Published') return 'success' as const;
  if (status === 'Scheduled') return 'warning' as const;
  return 'neutral' as const;
}

export function AdminResults() {
  const [events, setEvents] = useState<ElectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetchElections().then(setEvents).catch(() => setEvents([])).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <ResultsIndexSkeleton />;

  return (
    <main className="admin-page admin-results-index">
      <header className="admin-page-header">
        <VStack gap={2}>
          <Heading level={1}>Live results</Heading>
          <Text color="secondary">Choose an election to open its complete results and track every position.</Text>
        </VStack>
      </header>

      <section className="results-election-list" aria-label="Election results">
        {events.length ? (
          <List density="spacious" hasDividers>
            {events.map((event) => {
            const turnout = event.eligibleVoters
              ? event.ballotsSubmitted / event.eligibleVoters * 100
              : 0;
            return (
              <ListItem
                key={event.id}
                href={`/admin/results/${event.id}`}
                label={event.title}
                description={
                  <HStack className="results-election-description" gap={4} align="center">
                    <Badge
                      variant={statusVariant(event.status)}
                      label={event.status === 'Published' ? 'Open' : event.status}
                    />
                    <Text type="supporting" color="secondary">{formatElectionDate(event)}</Text>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {event.ballotsSubmitted} of {event.eligibleVoters} ballots · {turnout.toFixed(1)}% turnout
                    </Text>
                  </HStack>
                }
                endContent={<CaretRightIcon aria-hidden="true" />}
              />
            );
            })}
          </List>
        ) : (
          <EmptyState
            icon={<Icon icon={ChartBarIcon} size="lg" />}
            title="No elections to show"
            description="Create an election first. Its turnout and results will appear here once ballots are available."
            actions={
              <Button
                label="Create an election"
                variant="primary"
                icon={<PlusIcon />}
                onClick={() => window.dispatchEvent(new Event('open-create-election'))}
              />
            }
          />
        )}
      </section>
    </main>
  );
}

export function AdminLiveResult({eventId}: {eventId: string}) {
  const [event, setEvent] = useState<ElectionEvent | null>(null);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState('');

  useEffect(() => {
    void fetchResults(eventId).then((payload) => {
      setEvent(payload.election);
      setResults(payload.results);
      setIsReady(true);
    }).catch(() => setIsReady(true));
  }, [eventId]);

  async function refreshResults() {
    try {
      const payload = await fetchResults(eventId);
      setEvent(payload.election);
      setResults(payload.results);
      setRefreshMessage('Results refreshed just now.');
    } catch {
      setRefreshMessage('Results could not be refreshed. Try again.');
    }
  }

  if (!isReady) return <LiveResultSkeleton />;

  if (!event) {
    return (
      <main className="admin-page">
        <EmptyState
          title="Election not found"
          description="This election may have been removed or is no longer available on this device."
          headingLevel={1}
          actions={<Button label="Back to live results" href="/admin/results" variant="primary" />}
        />
      </main>
    );
  }

  const turnout = event.eligibleVoters
    ? event.ballotsSubmitted / event.eligibleVoters * 100
    : 0;

  return (
    <main className="admin-page admin-live-result">
      <header className="admin-page-header live-result-header">
        <VStack gap={3}>
          <HStack>
            <Button label="Back to live results" href="/admin/results" variant="ghost" size="sm" icon={<ArrowLeftIcon />} />
          </HStack>
          <VStack gap={2}>
            <HStack gap={3} align="center" wrap="wrap">
              <Heading level={1} className="live-result-title">{event.title}</Heading>
              <Badge
                variant={statusVariant(event.status)}
                label={event.status === 'Open' || event.status === 'Published' ? 'Live results' : `${event.status} results`}
              />
            </HStack>
            <Text color="secondary">Totals are grouped by position and never reveal an individual voter’s choices.</Text>
          </VStack>
        </VStack>
        <VStack gap={2} hAlign="end">
          <Button
            label="Refresh results"
            variant="secondary"
            icon={<ArrowClockwiseIcon />}
            onClick={refreshResults}
          />
          <Text type="supporting" color="secondary" aria-live="polite">
            {refreshMessage || 'Showing the latest saved totals'}
          </Text>
        </VStack>
      </header>

      <section className="event-overview live-result-overview" aria-label="Live election totals">
        <article><Text type="supporting" color="secondary">Eligible voters</Text><Text type="display-3" hasTabularNumbers>{event.eligibleVoters}</Text></article>
        <article><Text type="supporting" color="secondary">Ballots submitted</Text><Text type="display-3" hasTabularNumbers>{event.ballotsSubmitted}</Text></article>
        <article><Text type="supporting" color="secondary">People voted</Text><Text type="display-3" hasTabularNumbers>{event.ballotsSubmitted} / {event.eligibleVoters}</Text></article>
        <article><Text type="supporting" color="secondary">Turnout</Text><Text type="display-3" hasTabularNumbers>{turnout.toFixed(1)}%</Text></article>
        <article><Text type="supporting" color="secondary">Positions counted</Text><Text type="display-3" hasTabularNumbers>{results.length} / {event.positions.length}</Text></article>
      </section>

      {results.length ? (
        <Grid columns={{minWidth: 320, max: 2, repeat: 'fit'}} gap={5}>
          {results.map((result) => {
          const validVotes = result.nominees.reduce((total, nominee) => total + nominee.votes, 0);
          const sortedNominees = [...result.nominees].sort((a, b) => b.votes - a.votes);
          return (
            <Section key={`${result.group}-${result.position}`} className="result-position-section" padding={6}>
              <VStack gap={5}>
                <HStack className="result-position-header" justify="between" gap={3} align="start">
                  <VStack gap={1}>
                    <Heading level={2}>{result.position}</Heading>
                  </VStack>
                  <Text type="supporting" color="secondary" hasTabularNumbers>
                    {validVotes} vote{validVotes === 1 ? '' : 's'} · {result.abstentions} abstention{result.abstentions === 1 ? '' : 's'}
                  </Text>
                </HStack>

                <VStack gap={5}>
                  {sortedNominees.length ? sortedNominees.map((nominee) => (
                    <HStack key={nominee.id} gap={4} align="center">
                      <Avatar name={nominee.name} src={nominee.imageUrl} size="lg" shape="rounded" tooltip={false} />
                      <VStack gap={2} width="100%">
                        <HStack justify="between" gap={3} align="center">
                          <Text weight="semibold">{nominee.name}</Text>
                          <Text weight="semibold" hasTabularNumbers>
                            {nominee.votes} vote{nominee.votes === 1 ? '' : 's'}
                          </Text>
                        </HStack>
                        <ProgressBar
                          label={`${nominee.name}: ${nominee.votes} of ${validVotes} candidate votes`}
                          value={nominee.votes}
                          max={Math.max(validVotes, 1)}
                          isLabelHidden
                          variant="accent"
                        />
                      </VStack>
                    </HStack>
                  )) : (
                    <EmptyState
                      isCompact
                      title="No candidate totals yet"
                      description="Candidate totals will appear after the ballot is fully configured."
                    />
                  )}
                </VStack>
              </VStack>
            </Section>
          );
          })}
        </Grid>
      ) : (
        <Section className="collection-empty-state" padding={8}>
          <EmptyState
            icon={<Icon icon={ChartBarIcon} size="lg" />}
            title="No results yet"
            description="Results will appear here after this election has positions and submitted ballots."
          />
        </Section>
      )}
    </main>
  );
}
