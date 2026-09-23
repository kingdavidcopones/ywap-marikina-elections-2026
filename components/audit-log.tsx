'use client';

import {useEffect, useState} from 'react';
import {ClipboardTextIcon} from '@phosphor-icons/react/ClipboardText';
import {Card} from '@astryxdesign/core/Card';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';
import {isNetworkError, reportNetworkError} from '@/lib/network-error';

type AuditEvent = {id: number; action: string; change_summary: Record<string, unknown>; created_at: string; elections: {title?: string} | null};

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    void fetch('/api/admin/audit', {cache: 'no-store'})
      .then((response) => {
        if (!response.ok) throw new Error('Audit events could not be loaded.');
        return response.json();
      })
      .then((body: {events?: AuditEvent[]}) => setEvents(body.events ?? []))
      .catch((cause) => {
        if (isNetworkError(cause)) reportNetworkError();
      })
      .finally(() => setIsLoading(false));
  }, []);
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <VStack gap={2}>
          <Heading level={1}>Audit log</Heading>
          <Text color="secondary">See what changed and when. This version doesn’t record which administrator made each change.</Text>
        </VStack>
      </header>

      <Card padding={0} className="audit-surface">
        {isLoading ? (
          <VStack gap={5} className="collection-loading-state" aria-label="Loading audit log" aria-busy="true">
            {[0, 2, 4].map((index) => (
              <VStack key={index} gap={2}>
                <Skeleton width="45%" height="var(--spacing-5)" index={index} />
                <Skeleton width="72%" height="var(--spacing-4)" index={index + 1} />
              </VStack>
            ))}
          </VStack>
        ) : events.length ? (
          <ol className="audit-list">
            {events.map((event) => (
            <li key={event.id}>
              <HStack gap={4} align="start">
                <StatusDot variant={event.action === 'ballot_submitted' ? 'success' : 'accent'} label={event.action.replaceAll('_', ' ')} />
                <VStack gap={1} className="audit-copy">
                  <HStack justify="between" gap={4}>
                    <Text weight="semibold">{event.action.replaceAll('_', ' ')}</Text>
                    <Text type="supporting" color="secondary" hasTabularNumbers>{new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'}).format(new Date(event.created_at))}</Text>
                  </HStack>
                  <Text color="secondary">{event.elections?.title ?? String(event.change_summary.title ?? 'Election activity')}</Text>
                </VStack>
              </HStack>
            </li>
            ))}
          </ol>
        ) : (
          <EmptyState
            icon={<Icon icon={ClipboardTextIcon} size="lg" />}
            title="No activity yet"
            description="Election changes and submitted ballots will be recorded here as they happen."
          />
        )}
      </Card>
    </main>
  );
}
