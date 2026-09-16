'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {getSubmissionTime} from '@/lib/voter-session';
import {AccessGate} from './access-gate';

export function BallotConfirmation() {
  const [submittedAt, setSubmittedAt] = useState<string | null | undefined>(undefined);

  useEffect(() => setSubmittedAt(getSubmissionTime()), []);

  if (submittedAt === undefined) return null;
  if (!submittedAt) return <AccessGate title="We couldn’t find a submitted ballot" />;

  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <main className="confirmation-page">
        <VStack gap={6} className="confirmation-stack">
          <Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} />
          <Card maxWidth={520} width="100%" padding={10} elevation="low" className="confirmation-card">
            <VStack gap={6}>
              <Text className="confirmation-mark" aria-hidden="true">✓</Text>
              <VStack gap={2}>
                <Heading level={1}>Your ballot is in</Heading>
                <Text color="secondary" as="p">
                  Thank you for making your voice count in the YWAP Marikina General Election 2026.
                </Text>
              </VStack>
              <dl className="confirmation-details">
                <dt>Submitted at</dt>
                <dd>{new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'}).format(new Date(submittedAt))}</dd>
                <dt>Status</dt>
                <dd>Recorded</dd>
              </dl>
              <Text type="supporting" color="secondary" as="p">
                To protect your privacy, we don’t show your choices or create a code that could be linked back to them.
              </Text>
              <Button label="Done" href="/" variant="primary" width="100%" />
            </VStack>
          </Card>
        </VStack>
      </main>
    </AppShell>
  );
}
