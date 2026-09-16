'use client';

import {useEffect, useState} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Text} from '@astryxdesign/core/Text';

type AuditEvent = {id: number; action: string; change_summary: Record<string, unknown>; created_at: string; elections: {title?: string} | null};

export function AuditLog() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  useEffect(() => {
    void fetch('/api/admin/audit', {cache: 'no-store'}).then((response) => response.json()).then((body: {events?: AuditEvent[]}) => setEvents(body.events ?? []));
  }, []);
  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <VStack gap={2}>
          <Text type="label" color="accent">Election history</Text>
          <Heading level={1}>Audit log</Heading>
          <Text color="secondary">See what changed and when. This version doesn’t record which administrator made each change.</Text>
        </VStack>
      </header>

      <Card padding={0} className="audit-surface">
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
      </Card>
    </main>
  );
}
