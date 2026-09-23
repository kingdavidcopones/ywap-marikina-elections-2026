import Image from 'next/image';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Card} from '@astryxdesign/core/Card';
import {Grid} from '@astryxdesign/core/Grid';
import {HStack, VStack} from '@astryxdesign/core/Layout';
import {Section} from '@astryxdesign/core/Section';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Spinner} from '@astryxdesign/core/Spinner';

export function VoterEntryLoading() {
  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <Section variant="transparent" padding={6} className="access-page animated-mesh-gradient-background" width="100%" aria-busy="true" aria-label="Loading election">
        <VStack gap={6} className="access-stack" hAlign="center">
          <header className="access-brand">
            <Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} priority />
          </header>
          <Spinner size="lg" label="Loading election…" />
        </VStack>
      </Section>
    </AppShell>
  );
}

function PageHeadingSkeleton({hasAction = false}: {hasAction?: boolean}) {
  return (
    <header className="admin-page-header" aria-label="Loading page heading">
      <VStack gap={2} width="100%">
        <Skeleton width="38%" height="var(--spacing-8)" index={0} />
        <Skeleton width="64%" height="var(--spacing-4)" index={1} />
      </VStack>
      {hasAction ? <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-10)" index={2} /> : null}
    </header>
  );
}

function ElectionCardSkeleton({index}: {index: number}) {
  return (
    <Card padding={6} className="event-card">
      <VStack gap={5}>
        <VStack gap={2}>
          <Skeleton width="calc(var(--spacing-8) * 2)" height="var(--spacing-5)" radius="rounded" index={index} />
          <Skeleton width="58%" height="var(--spacing-6)" index={index + 1} />
          <Skeleton width="86%" height="var(--spacing-4)" index={index + 2} />
        </VStack>
        <HStack gap={4}>
          <Skeleton width="33%" height="var(--spacing-12)" index={index + 3} />
          <Skeleton width="33%" height="var(--spacing-12)" index={index + 4} />
          <Skeleton width="33%" height="var(--spacing-12)" index={index + 5} />
        </HStack>
        <HStack gap={3} justify="end">
          <Skeleton width="calc(var(--spacing-8) * 3)" height="var(--spacing-9)" index={index + 6} />
          <Skeleton width="calc(var(--spacing-8) * 3)" height="var(--spacing-9)" index={index + 7} />
        </HStack>
      </VStack>
    </Card>
  );
}

export function ElectionsPageSkeleton() {
  return (
    <main className="admin-page" aria-busy="true" aria-label="Loading elections">
      <PageHeadingSkeleton hasAction />
      <section className="event-grid" aria-hidden="true">
        <ElectionCardSkeleton index={3} />
        <ElectionCardSkeleton index={7} />
        <ElectionCardSkeleton index={11} />
        <ElectionCardSkeleton index={15} />
      </section>
    </main>
  );
}

export function ResultsIndexSkeleton() {
  return (
    <main className="admin-page admin-results-index" aria-busy="true" aria-label="Loading live results">
      <PageHeadingSkeleton />
      <Section padding={5} className="results-election-list">
        <VStack gap={5} aria-hidden="true">
          {[0, 3, 6, 9].map((index) => (
            <HStack key={index} gap={4} justify="between" align="center">
              <VStack gap={2} width="100%">
                <Skeleton width="42%" height="var(--spacing-5)" index={index} />
                <Skeleton width="72%" height="var(--spacing-4)" index={index + 1} />
              </VStack>
              <Skeleton width="var(--spacing-6)" height="var(--spacing-6)" radius="rounded" index={index + 2} />
            </HStack>
          ))}
        </VStack>
      </Section>
    </main>
  );
}

function MetricsSkeleton() {
  return (
    <section className="event-overview live-result-overview" aria-hidden="true">
      {[0, 2, 4, 6].map((index) => (
        <article key={index}>
          <Skeleton width="72%" height="var(--spacing-4)" index={index} />
          <Skeleton width="45%" height="var(--spacing-8)" index={index + 1} />
        </article>
      ))}
    </section>
  );
}

export function LiveResultSkeleton() {
  return (
    <main className="admin-page admin-live-result" aria-busy="true" aria-label="Loading election results">
      <PageHeadingSkeleton hasAction />
      <MetricsSkeleton />
      <Grid columns={{minWidth: 320, max: 2, repeat: 'fit'}} gap={5} aria-hidden="true">
        {[0, 5].map((index) => (
          <Section key={index} className="result-position-section" padding={6}>
            <VStack gap={5}>
              <Skeleton width="48%" height="var(--spacing-6)" index={index} />
              <Skeleton width="100%" height="var(--spacing-12)" index={index + 1} />
              <Skeleton width="100%" height="var(--spacing-12)" index={index + 2} />
              <Skeleton width="82%" height="var(--spacing-12)" index={index + 3} />
            </VStack>
          </Section>
        ))}
      </Grid>
    </main>
  );
}

export function ElectionEditorSkeleton() {
  return (
    <main className="admin-page event-editor-page" aria-busy="true" aria-label="Loading election details">
      <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-8)" index={0} />
      <header className="admin-page-header event-editor-header" aria-hidden="true">
        <VStack gap={2} width="100%">
          <Skeleton width="44%" height="var(--spacing-8)" index={1} />
          <Skeleton width="70%" height="var(--spacing-4)" index={2} />
          <Skeleton width="52%" height="var(--spacing-4)" index={3} />
        </VStack>
        <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-10)" index={4} />
      </header>
      <MetricsSkeleton />
      <VStack gap={5} aria-hidden="true">
        <Skeleton width="calc(var(--spacing-8) * 6)" height="var(--spacing-10)" index={5} />
        <ElectionCardSkeleton index={6} />
        <ElectionCardSkeleton index={10} />
      </VStack>
    </main>
  );
}

export function VoterFlowSkeleton() {
  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <main className="ballot-page" aria-busy="true" aria-label="Loading your ballot">
        <header className="ballot-topbar" aria-hidden="true">
          <Skeleton width="calc(var(--spacing-8) * 5)" height="var(--spacing-10)" index={0} />
          <Skeleton width="32%" height="var(--spacing-4)" index={1} />
        </header>
        <section className="ballot-progress" aria-hidden="true">
          <Skeleton width="100%" height="var(--spacing-2)" radius="rounded" index={2} />
        </section>
        <section className="ballot-grid" aria-hidden="true">
          <VStack gap={6}>
            <Skeleton width="42%" height="var(--spacing-4)" index={3} />
            <Skeleton width="78%" height="var(--spacing-8)" index={4} />
            <Skeleton width="100%" height="calc(var(--spacing-8) * 4)" index={5} />
          </VStack>
          <VStack gap={4}>
            <Skeleton width="62%" height="var(--spacing-8)" index={6} />
            <Skeleton width="100%" height="calc(var(--spacing-10) * 2)" index={7} />
            <Skeleton width="100%" height="calc(var(--spacing-10) * 2)" index={8} />
            <Skeleton width="100%" height="calc(var(--spacing-10) * 2)" index={9} />
          </VStack>
        </section>
        <footer className="ballot-actions" aria-hidden="true">
          <Skeleton width="calc(var(--spacing-8) * 3)" height="var(--spacing-10)" index={10} />
          <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-10)" index={11} />
        </footer>
      </main>
    </AppShell>
  );
}

export function VerifiedBallotSkeleton() {
  return (
    <AppShell height="fill" variant="wash" contentPadding={0}>
      <main className="ballot-page" aria-busy="true" aria-label="Loading your ballot">
        <header className="ballot-topbar" aria-hidden="true">
          <Skeleton width="calc(var(--spacing-8) * 5)" height="var(--spacing-10)" index={0} />
          <Skeleton width="32%" height="var(--spacing-4)" index={1} />
        </header>
        <section className="ballot-progress" aria-hidden="true">
          <Skeleton width="100%" height="var(--spacing-2)" radius="rounded" index={2} />
        </section>
        <section className="ballot-grid" aria-hidden="true">
          <VStack gap={8}>
            <VStack gap={1}>
              <Skeleton width="34%" height="var(--spacing-4)" index={3} />
              <Skeleton width="68%" height="var(--spacing-8)" index={4} />
            </VStack>
            <Card variant="muted" padding={6}>
              <VStack gap={3}>
                <Skeleton width="44%" height="var(--spacing-5)" index={5} />
                <VStack gap={2}>
                  <Skeleton width="100%" height="var(--spacing-4)" index={6} />
                  <Skeleton width="88%" height="var(--spacing-4)" index={7} />
                  <Skeleton width="56%" height="var(--spacing-4)" index={8} />
                </VStack>
              </VStack>
            </Card>
            <Card variant="muted" padding={6}>
              <VStack gap={4}>
                <Skeleton width="48%" height="var(--spacing-5)" index={9} />
                <VStack gap={3}>
                  {[0, 1, 2].map((index) => (
                    <HStack key={index} gap={3} align="center">
                      <Skeleton width="var(--spacing-4)" height="var(--spacing-4)" radius="rounded" index={index + 10} />
                      <Skeleton width={index === 2 ? '64%' : '82%'} height="var(--spacing-4)" index={index + 13} />
                    </HStack>
                  ))}
                </VStack>
              </VStack>
            </Card>
          </VStack>
          <section className="choice-panel">
            <VStack gap={6}>
              <header className="choice-header">
                <VStack gap={2} width="100%">
                  <Skeleton width="62%" height="var(--spacing-7)" index={16} />
                  <Skeleton width="74%" height="var(--spacing-4)" index={17} />
                </VStack>
                <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-4)" index={18} />
              </header>
              <VStack gap={4}>
                {[0, 1, 2].map((index) => (
                  <Card key={index} padding={5} className="nominee-card">
                    <HStack gap={4} align="center">
                      <Skeleton width="var(--spacing-12)" height="var(--spacing-12)" radius="rounded" index={index + 19} />
                      <VStack gap={2} width="100%">
                        <Skeleton width={index === 1 ? '48%' : '58%'} height="var(--spacing-5)" index={index + 22} />
                        <Skeleton width="34%" height="var(--spacing-4)" index={index + 25} />
                      </VStack>
                    </HStack>
                  </Card>
                ))}
              </VStack>
            </VStack>
          </section>
        </section>
        <footer className="ballot-actions" aria-hidden="true">
          <Skeleton width="calc(var(--spacing-8) * 3)" height="var(--spacing-10)" index={28} />
          <HStack gap={3}>
            <Skeleton width="calc(var(--spacing-8) * 3)" height="var(--spacing-10)" index={29} />
            <Skeleton width="calc(var(--spacing-8) * 4)" height="var(--spacing-10)" index={30} />
          </HStack>
        </footer>
      </main>
    </AppShell>
  );
}

export function PublicResultsSkeleton() {
  return (
    <AppShell height="auto" variant="wash" contentPadding={0}>
      <main className="public-results-page" aria-busy="true" aria-label="Loading published results">
        <header className="public-results-header" aria-hidden="true">
          <VStack gap={2} width="100%">
            <Skeleton width="22%" height="var(--spacing-4)" index={0} />
            <Skeleton width="48%" height="var(--spacing-8)" index={1} />
            <Skeleton width="68%" height="var(--spacing-4)" index={2} />
          </VStack>
        </header>
        <section className="results-grid" aria-hidden="true">
          {[0, 5].map((index) => (
            <Card key={index} padding={6}>
              <VStack gap={5}>
                <Skeleton width="55%" height="var(--spacing-6)" index={index + 3} />
                <Skeleton width="100%" height="var(--spacing-12)" index={index + 4} />
                <Skeleton width="86%" height="var(--spacing-12)" index={index + 5} />
              </VStack>
            </Card>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
