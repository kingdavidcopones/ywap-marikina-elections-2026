'use client';

import {useEffect, useState} from 'react';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Text} from '@astryxdesign/core/Text';
import {getVoterSession, type VoterSession} from '@/lib/voter-session';
import type {ElectionEvent, ElectionResult} from '@/lib/election-data';
import {fetchElections, fetchResults} from '@/lib/api';
import {AccessGate} from './access-gate';

export function VoterResults() {
  const [voter, setVoter] = useState<VoterSession | null | undefined>(undefined);
  const [election, setElection] = useState<ElectionEvent | null>(null);
  const [results, setResults] = useState<ElectionResult[]>([]);
  useEffect(() => {
    setVoter(getVoterSession());
    void fetchElections().then((events) => {
      const published = events.find((event) => event.status === 'Published');
      if (!published) return;
      return fetchResults(published.id).then((payload) => {
        setElection(payload.election);
        setResults(payload.results);
      });
    });
  }, []);
  if (voter === undefined) return null;
  if (!voter) return <AccessGate />;

  return (
    <AppShell height="auto" variant="wash" contentPadding={0}>
      <main className="public-results-page">
        <header className="public-results-header">
          <VStack gap={2}>
            <Text type="label" color="accent">Official results</Text>
            <Heading level={1}>{election?.title ?? 'Published election results'}</Heading>
            <Text color="secondary">{election ? `${election.ballotsSubmitted} of ${election.eligibleVoters} eligible voters took part. ` : ''}Results show totals only—never individual ballots.</Text>
          </VStack>
          <Button label="Back to voter sign-in" href="/" variant="secondary" />
        </header>
        <section className="results-grid">
          {results.map((result) => {
            const winner = [...result.nominees].sort((a, b) => b.votes - a.votes)[0];
            return (
              <Card key={result.position} padding={6}>
                <VStack gap={5}>
                  <VStack gap={1}>
                    <Text type="supporting" color="secondary">{result.group}</Text>
                    <Heading level={2}>{result.position}</Heading>
                    <Text weight="semibold" color="accent">Elected · {winner.name}</Text>
                  </VStack>
                  <VStack gap={4}>
                    {result.nominees.map((nominee) => (
                      <section key={nominee.name} className="result-line">
                        <HStack justify="between" gap={3}>
                          <Text>{nominee.name}</Text>
                          <Text hasTabularNumbers weight="semibold">{nominee.votes}</Text>
                        </HStack>
                        <progress max={result.total} value={nominee.votes} aria-label={`${nominee.name}: ${nominee.votes} votes`} />
                      </section>
                    ))}
                  </VStack>
                </VStack>
              </Card>
            );
          })}
        </section>
      </main>
    </AppShell>
  );
}
