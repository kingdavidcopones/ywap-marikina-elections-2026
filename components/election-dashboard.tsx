'use client';

import {useEffect, useState} from 'react';
import {ArrowUpRightIcon} from '@phosphor-icons/react/ArrowUpRight';
import {CalendarBlankIcon} from '@phosphor-icons/react/CalendarBlank';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {Button} from '@astryxdesign/core/Button';
import {Badge} from '@astryxdesign/core/Badge';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {Text} from '@astryxdesign/core/Text';
import {
  type ElectionSummary,
} from '@/lib/election-data';
import {fetchElections} from '@/lib/api';
import {ElectionsPageSkeleton} from '@/components/loading-states';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila',
});

function formatSchedule(event: ElectionSummary) {
  if (!event.electionDate) return 'Not scheduled';
  return dateFormatter.format(new Date(`${event.electionDate}T00:00:00+08:00`));
}

function statusVariant(status: ElectionSummary['status']) {
  if (status === 'Open' || status === 'Published') return 'success' as const;
  if (status === 'Scheduled') return 'warning' as const;
  return 'neutral' as const;
}

export function ElectionDashboard() {
  const [events, setEvents] = useState<ElectionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void fetchElections().then(setEvents).catch(() => setEvents([])).finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <ElectionsPageSkeleton />;

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <VStack gap={2}>
          <Heading level={1}>{events.length} election{events.length === 1 ? '' : 's'}</Heading>
          <Text color="secondary">Set up each ballot, manage who can vote, and share the voting link when you’re ready.</Text>
        </VStack>
        <Button
          label="Create election"
          variant="primary"
          icon={<PlusIcon />}
          onClick={() => window.dispatchEvent(new Event('open-create-election'))}
        />
      </header>

      <section className="event-grid" aria-label="Election events">
        {events.length ? events.map((event) => {
          const turnout = event.eligibleVoters ? event.ballotsSubmitted / event.eligibleVoters * 100 : 0;
          const isOpen = event.status === 'Open' || event.status === 'Published';
          const statusLabel = event.status === 'Published' ? 'Open' : event.status;
          const ballotLabel = isOpen ? 'View ballot' : 'Preview ballot';
          const ballotSlug = event.ballotSlug || `${event.id}-preview`;
          return (
            <Card key={event.id} padding={6} className="event-card">
              <VStack gap={5}>
                <HStack gap={4} align="start" justify="between">
                  <VStack gap={2}>
                    <HStack>
                      <Badge variant={statusVariant(event.status)} label={statusLabel} />
                    </HStack>
                    <Heading level={2}>{event.title}</Heading>
                    <Text color="secondary">{event.description}</Text>
                  </VStack>
                  <Text type="supporting" color="secondary">{formatSchedule(event)}</Text>
                </HStack>

                <section className="event-metrics" aria-label={`${event.title} summary`}>
                  <article><Text type="supporting" color="secondary">Eligible voters</Text><Text type="large" weight="semibold" hasTabularNumbers>{event.eligibleVoters}</Text></article>
                  <article><Text type="supporting" color="secondary">Positions</Text><Text type="large" weight="semibold" hasTabularNumbers>{event.positionCount}</Text></article>
                  <article><Text type="supporting" color="secondary">Turnout</Text><Text type="large" weight="semibold" hasTabularNumbers>{turnout.toFixed(1)}%</Text></article>
                </section>

                <HStack gap={3} justify="end">
                  <Button label={`Manage ${event.title}`} href={`/admin/elections/${event.id}`} variant="secondary">Manage event</Button>
                  <Button
                    label={`${ballotLabel}: ${event.title}`}
                    href={`/vote/${ballotSlug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="secondary"
                    endContent={<ArrowUpRightIcon aria-hidden="true" />}
                  >{ballotLabel}</Button>
                </HStack>
              </VStack>
            </Card>
          );
        }) : (
          <Card padding={8} className="collection-empty-state">
            <EmptyState
              icon={<Icon icon={CalendarBlankIcon} size="lg" />}
              title="No elections yet"
              description="Create an election to start building its ballot and adding eligible voters."
              actions={
                <Button
                  label="Create your first election"
                  variant="primary"
                  icon={<PlusIcon />}
                  onClick={() => window.dispatchEvent(new Event('open-create-election'))}
                />
              }
            />
          </Card>
        )}
      </section>
    </main>
  );
}
