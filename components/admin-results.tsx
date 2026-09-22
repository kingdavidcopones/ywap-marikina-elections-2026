'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {CaretRightIcon} from '@phosphor-icons/react/CaretRight';
import {ChartBarIcon} from '@phosphor-icons/react/ChartBar';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {Badge} from '@astryxdesign/core/Badge';
import {Button} from '@astryxdesign/core/Button';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {List, ListItem} from '@astryxdesign/core/List';
import {Text} from '@astryxdesign/core/Text';
import {
  type ElectionEvent,
  type ElectionSummary,
} from '@/lib/election-data';
import {fetchElections} from '@/lib/api';
import {ResultsIndexSkeleton} from '@/components/loading-states';

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
  const router = useRouter();
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
                href={`/live-results/${event.id}`}
                onClick={() => router.push(`/live-results/${event.id}`)}
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
