'use client';

import {FormEvent, useState} from 'react';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack} from '@astryxdesign/core/Layout';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {saveVoterSession, type VoterSession} from '@/lib/voter-session';
import {isNetworkError, reportNetworkError} from '@/lib/network-error';

export function VoterAccess({ballotSlug, onVerified}: {ballotSlug?: string; onVerified?: () => void}) {
  const router = useRouter();
  const [memberId, setMemberId] = useState('');
  const [lastName, setLastName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberId.trim() || !lastName.trim()) {
      setMessage('Enter your Member ID and last name so we can find your voter record.');
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({memberId, lastName, ballotSlug}),
      });
      const result = await response.json() as {ok: boolean; message?: string; voter?: VoterSession};
      if (!response.ok || !result.voter) {
        setMessage(result.message ?? 'We couldn’t find a matching voter record. Check both entries and try again.');
        return;
      }
      saveVoterSession(result.voter);
      onVerified?.();
      router.push(`/vote/${result.voter.ballotSlug}`);
    } catch (cause) {
      if (isNetworkError(cause)) reportNetworkError();
      setMessage('We can’t check your voter record right now. Check your connection, then try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <Section
        variant="transparent"
        padding={6}
        className="access-page animated-mesh-gradient-background"
        width="100%"
      >
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

          <Card maxWidth={440} width="100%" padding={8} elevation="low" className="verification-card">
            <form onSubmit={handleSubmit} noValidate>
              <VStack gap={6}>
                <VStack gap={2}>
                  <Heading level={1}>Let’s find your voter record</Heading>
                  <Text color="secondary" as="p">
                    Enter the Member ID and last name used in the official voter list.
                  </Text>
                </VStack>

                {message ? (
                  <Banner
                    status="error"
                    title="We couldn’t continue"
                    description={message}
                    container="section"
                  />
                ) : null}

                <VStack gap={4}>
                  <TextInput
                    label="YWAP Marikina Member ID"
                    value={memberId}
                    onChange={setMemberId}
                    placeholder="YWAP-02139"
                    autoComplete="off"
                    isRequired
                    size="lg"
                    width="100%"
                  />
                  <TextInput
                    label="Last name"
                    value={lastName}
                    onChange={setLastName}
                    placeholder="Enter your last name"
                    autoComplete="family-name"
                    isRequired
                    size="lg"
                    width="100%"
                  />
                </VStack>

                <Button
                  type="submit"
                  label="Find my ballot"
                  variant="primary"
                  size="lg"
                  width="100%"
                  isLoading={isLoading}
                />
              </VStack>
            </form>
          </Card>

          <footer className="access-support">
            <Text type="supporting" color="secondary" as="p" justify="center">
              Can’t find your record? The YWAP Marikina election committee can help.
            </Text>
          </footer>
        </VStack>
      </Section>
    </AppShell>
  );
}
