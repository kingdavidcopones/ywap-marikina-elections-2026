'use client';

import {useEffect, useState} from 'react';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArrowClockwiseIcon} from '@phosphor-icons/react/ArrowClockwise';
import {ChartBarIcon} from '@phosphor-icons/react/ChartBar';
import {DownloadSimpleIcon} from '@phosphor-icons/react/DownloadSimple';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Grid} from '@astryxdesign/core/Grid';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {Pagination} from '@astryxdesign/core/Pagination';
import {ProgressBar} from '@astryxdesign/core/ProgressBar';
import {Section} from '@astryxdesign/core/Section';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import type {ElectionEvent, ElectionResult, IndividualVoteRecord} from '@/lib/election-data';
import {fetchIndividualResults, fetchResults} from '@/lib/api';
import {LiveResultSkeleton} from '@/components/loading-states';

const submittedAtFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
});
const INDIVIDUAL_PAGE_SIZE = 10;

function statusVariant(status: ElectionEvent['status']) {
  if (status === 'Open' || status === 'Published') return 'success' as const;
  if (status === 'Scheduled') return 'warning' as const;
  return 'neutral' as const;
}

function NomineeAvatar({name, imageUrl}: {name: string; imageUrl?: string}) {
  const [loaded, setLoaded] = useState(!imageUrl);

  useEffect(() => {
    setLoaded(!imageUrl);
    if (!imageUrl) return;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setLoaded(true); };
    image.onerror = () => { if (active) setLoaded(true); };
    image.src = imageUrl;
    return () => { active = false; };
  }, [imageUrl]);

  return loaded
    ? <Avatar name={name} src={imageUrl} size="lg" shape="rounded" tooltip={false} />
    : <Skeleton width={48} height={48} radius={2} />;
}

export function AdminLiveResult({eventId}: {eventId: string}) {
  const [event, setEvent] = useState<ElectionEvent | null>(null);
  const [results, setResults] = useState<ElectionResult[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [view, setView] = useState<'summary' | 'individual'>('summary');
  const [individualRecords, setIndividualRecords] = useState<IndividualVoteRecord[]>([]);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [individualError, setIndividualError] = useState<string | null>(null);
  const [individualPage, setIndividualPage] = useState(1);

  useEffect(() => {
    setIsReady(false);
    setLoadError(null);
    setView('summary');
    setIndividualRecords([]);
    setIndividualPage(1);
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

  useEffect(() => {
    if (view !== 'individual' || !event) return;
    let active = true;
    setIndividualLoading(true);
    setIndividualError(null);
    void fetchIndividualResults(event.id).then((records) => {
      if (active) setIndividualRecords(records);
    }).catch((cause) => {
      if (active) setIndividualError(cause instanceof Error ? cause.message : 'Individual records could not be loaded.');
    }).finally(() => {
      if (active) setIndividualLoading(false);
    });
    return () => { active = false; };
  }, [view, event?.id, event?.anonymousVoting]);

  async function refreshResults() {
    setIsRefreshing(true);
    try {
      const payload = await fetchResults(eventId);
      setEvent(payload.election);
      setResults(payload.results);
      if (view === 'individual' && !payload.election.anonymousVoting) {
        setIndividualRecords(await fetchIndividualResults(eventId));
        setIndividualError(null);
      }
      setRefreshMessage('Results refreshed just now.');
    } catch {
      setRefreshMessage('Results could not be refreshed. Try again.');
    } finally {
      setIsRefreshing(false);
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
          actions={<Button label="Back to live results" href="/live-results" variant="primary" />}
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
            <Button label="Back to live results" href="/live-results" variant="ghost" size="sm" icon={<ArrowLeftIcon />} />
          </HStack>
          <VStack gap={2}>
            <HStack gap={3} align="center" wrap="wrap">
              <Heading level={1} className="live-result-title">{event.title}</Heading>
              <Badge
                variant={statusVariant(event.status)}
                label={event.status === 'Open' || event.status === 'Published' ? 'Live results' : `${event.status} results`}
              />
            </HStack>
            <Text color="secondary">{event.anonymousVoting
              ? 'Totals are grouped by position and never reveal an individual voter’s choices.'
              : 'Totals are grouped by position. Open Individual to see each voter’s recorded choices.'}</Text>
          </VStack>
        </VStack>
        <VStack gap={2} hAlign="end">
          <Button
            label="Refresh results"
            variant="secondary"
            icon={<ArrowClockwiseIcon />}
            onClick={refreshResults}
            isLoading={isRefreshing}
          />
          <Text type="supporting" color="secondary" aria-live="polite">
            {isRefreshing ? 'Refreshing results. Please wait.' : (refreshMessage || 'Showing the latest saved totals')}
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

      <TabList value={view} onChange={(value) => setView(value as 'summary' | 'individual')} role="tablist" hasDivider>
        <Tab value="summary" label="Summary" panelId="live-summary-panel" />
        <Tab value="individual" label="Individual" panelId="live-individual-panel" />
      </TabList>

      {view === 'summary' ? <section id="live-summary-panel" role="tabpanel" aria-label="Summary">
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
                      <NomineeAvatar name={nominee.name} imageUrl={nominee.imageUrl} />
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
      </section> : (
        <section id="live-individual-panel" role="tabpanel" aria-label="Individual vote records">
          <header className="section-heading-row">
            <VStack gap={1}><Heading level={2}>Individual vote records</Heading><Text color="secondary">Each row is one voter's recorded choice for a position.</Text></VStack>
            {individualRecords.length ? <HStack gap={2} align="center" wrap="wrap">
              {individualRecords.length > INDIVIDUAL_PAGE_SIZE ? <Pagination page={individualPage} onChange={setIndividualPage} totalItems={individualRecords.length} pageSize={INDIVIDUAL_PAGE_SIZE} variant="compact" size="sm" label="Individual vote record pages" /> : null}
              <Button label="Download responses" href={`/api/admin/elections/${event.id}/individual-results/export`} variant="secondary" icon={<DownloadSimpleIcon />} />
            </HStack> : null}
          </header>
          {individualLoading ? (
            <Text color="secondary">Loading individual vote records…</Text>
          ) : individualError ? (
            <EmptyState title="Individual records could not be loaded" description={individualError} />
          ) : individualRecords.length ? (
            <section className="table-surface" aria-label="Individual vote records" tabIndex={0}>
              <Table<IndividualVoteRecord>
                data={individualRecords.slice((individualPage - 1) * INDIVIDUAL_PAGE_SIZE, individualPage * INDIVIDUAL_PAGE_SIZE).map((record) => ({
                  ...record,
                  submittedAt: submittedAtFormatter.format(new Date(record.submittedAt)),
                }))}
                idKey="id"
                density="compact"
                dividers="rows"
                columns={[
                  ...(event.anonymousVoting ? [] : [
                    {key: 'voterName', header: 'Voter', width: proportional(1), renderCell: (row: IndividualVoteRecord) => <VStack gap={0}><Text weight="semibold">{row.voterName}</Text><Text type="supporting" color="secondary">{row.ageGroup}</Text></VStack>},
                    {key: 'memberId', header: 'Member ID', width: pixel(150)},
                  ]),
                  {key: 'position', header: 'Position', width: proportional(1)},
                  {key: 'choice', header: 'Vote', width: proportional(1)},
                  {key: 'submittedAt', header: 'Submitted at', width: pixel(180)},
                ]}
              />
            </section>
          ) : (
            <EmptyState title="No individual votes yet" description="Voter choices will appear here as ballots are submitted." />
          )}
        </section>
      )}
    </main>
  );
}
