'use client';

import Image from 'next/image';
import {ClockCountdownIcon} from '@phosphor-icons/react/ClockCountdown';
import {LinkBreakIcon} from '@phosphor-icons/react/LinkBreak';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {Icon} from '@astryxdesign/core/Icon';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import {VStack} from '@astryxdesign/core/VStack';
import {MeshGradient} from './mesh-gradient';

function formatStart(dateTime: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(dateTime));
}

function countdownParts(startsAt: string, now: number) {
  const secondsRemaining = Math.max(0, Math.ceil((new Date(startsAt).getTime() - now) / 1000));
  return [
    {label: 'Days', value: Math.floor(secondsRemaining / 86400)},
    {label: 'Hours', value: Math.floor(secondsRemaining % 86400 / 3600)},
    {label: 'Minutes', value: Math.floor(secondsRemaining % 3600 / 60)},
    {label: 'Seconds', value: secondsRemaining % 60},
  ];
}

export function VoterLinkState({
  kind,
  electionTitle,
  startsAt,
  now = Date.now(),
  subject = 'voting',
}: {
  kind: 'scheduled' | 'unavailable';
  electionTitle?: string;
  startsAt?: string;
  now?: number;
  subject?: 'voting' | 'nomination';
}) {
  const countdown = startsAt ? countdownParts(startsAt, now) : [];
  const isNomination = subject === 'nomination';

  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <Section variant="transparent" padding={6} className="access-page animated-mesh-gradient-background" width="100%">
        <MeshGradient />
        <VStack gap={6} className="access-stack">
          <header className="access-brand">
            <Image
              src="/brand/ywap-marikina-elections-logo-word.svg"
              alt="YWAP Marikina Elections 2026"
              width={172}
              height={50}
              priority
            />
          </header>

          <Card maxWidth={520} width="100%" padding={8} elevation="low" className="verification-card voter-link-state-card">
            <VStack gap={6} hAlign="center">
              <Icon
                icon={kind === 'scheduled' ? ClockCountdownIcon : LinkBreakIcon}
                color={kind === 'scheduled' ? 'accent' : 'secondary'}
                size="lg"
              />
              <VStack gap={2} hAlign="center">
                <Heading level={1} justify="center">
                  {kind === 'scheduled' ? (isNomination ? 'Nominations start soon' : 'Voting starts soon') : `This ${subject} link is unavailable`}
                </Heading>
                <Text color="secondary" as="p" justify="center">
                  {kind === 'scheduled'
                    ? `${electionTitle ?? (isNomination ? 'This nomination' : 'This election')} opens ${startsAt ? formatStart(startsAt) : 'at its scheduled time'}.`
                    : isNomination ? 'This nomination is not accepting responses. It may still be a draft, already closed, or archived.' : 'This election is not accepting votes. It may still be a draft, already closed, or archived.'}
                </Text>
              </VStack>

              {kind === 'scheduled' && countdown.length ? (
                <section className="voter-countdown" aria-label={`Time until ${isNomination ? 'nominations' : 'voting'} start`}>
                  {countdown.map((part) => (
                    <article key={part.label}>
                      <Text type="display-3" weight="semibold" hasTabularNumbers>{String(part.value).padStart(2, '0')}</Text>
                      <Text type="supporting" color="secondary">{part.label}</Text>
                    </article>
                  ))}
                </section>
              ) : null}
            </VStack>
          </Card>

          <footer className="access-support">
            <Text type="supporting" color="secondary" as="p" justify="center">
              Need help? Contact the YWAP Marikina election committee.
            </Text>
          </footer>
        </VStack>
      </Section>
    </AppShell>
  );
}
