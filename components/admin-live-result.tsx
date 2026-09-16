'use client';

import {useEffect, useState} from 'react';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArrowClockwiseIcon} from '@phosphor-icons/react/ArrowClockwise';
import {ChartBarIcon} from '@phosphor-icons/react/ChartBar';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import type {ElectionEvent, ElectionResult} from '@/lib/election-data';
import {fetchResults} from '@/lib/api';
import {LiveResultSkeleton} from '@/components/loading-states';

function statusVariant(status: ElectionEvent['status']) {
  if (status === 'Open' || status === 'Published') return 'success' as const;
  if (status === 'Scheduled') return 'warning' as const;
  return 'neutral' as const;
}

export function AdminLiveResult({eventId}: {eventId: string}) {
  const [event, setEvent] = useState<ElectionEvent | null>(null);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState('');

  useEffect(() => {
    setIsReady(false);
    setLoadError(null);
    void fetchResults(eventId).then((payload) => {
      setEvent(payload.election);
      setResults(payload.results);
      setIsReady(true);
    }).catch((cause) => {
      setEvent(null);
      setLoadError(cause instanceof Error ? cause.message : 'Results could not be loaded.');
      setIsReady(true);
    });
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
          title={loadError === 'Election results were not found.' ? 'Election not found' : 'Results could not be loaded'}
          description={loadError === 'Election results were not found.' ? 'This election may have been removed.' : loadError ?? 'Please try again.'}
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
