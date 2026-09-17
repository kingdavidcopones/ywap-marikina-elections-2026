'use client';

import {useEffect, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowUpRightIcon} from '@phosphor-icons/react/ArrowUpRight';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {Button} from '@astryxdesign/core/Button';
import {Banner} from '@astryxdesign/core/Banner';
import {Card} from '@astryxdesign/core/Card';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, Layout, LayoutContent, LayoutFooter, VStack} from '@astryxdesign/core/Layout';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useToast} from '@astryxdesign/core/Toast';
import {createNomination, fetchNominations} from '@/lib/api';
import type {NominationSummary} from '@/lib/nomination-data';

const dateFormat = new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeZone: 'Asia/Manila'});

export function NominationDashboard() {
  const router = useRouter();
  const toast = useToast();
  const [nominations, setNominations] = useState<NominationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void fetchNominations().then((items) => {setNominations(items); setLoadError('');}).catch((cause) => {
      const message = cause instanceof Error ? cause.message : 'Nominations could not be loaded.';
      setLoadError(message);
      toast({body: message, type: 'error'});
    }).finally(() => setLoading(false));
  }, [toast, reloadKey]);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2 || name.trim().length > 160 || description.length > 2000) { setError('Use 2–160 characters for the name and up to 2,000 for the description.'); return; }
    setError('');
    setSaving(true);
    try {
      const nomination = await createNomination(name, description);
      setCreateOpen(false);
      toast({body: 'Nomination draft created.'});
      router.push(`/admin/nominations/${nomination.id}`);
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Could not create nomination.'; setError(message); toast({body: message, type: 'error'}); }
    finally { setSaving(false); }
  }

  return (
    <main className="admin-page">
      <header className="admin-page-header">
        <VStack gap={2}>
          <Heading level={1}>{loading ? 'Nominations' : `${nominations.length} nomination${nominations.length === 1 ? '' : 's'}`}</Heading>
          <Text color="secondary">Create a nomination, collect names, and manage Youth Records.</Text>
        </VStack>
        <Button label="Create nomination" variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)} />
      </header>
      {loadError ? <VStack gap={3}><Banner status="error" title="Nominations could not be loaded" description={loadError} container="section" /><Button label="Try loading again" variant="secondary" onClick={() => {setLoading(true); setReloadKey((value) => value + 1);}} /></VStack> : loading ? <section className="event-grid" aria-label="Loading nominations" aria-busy="true">{[0, 1, 2].map((index) => <Card key={index} padding={6} className="event-card"><VStack gap={5}><Skeleton width="25%" height="var(--spacing-4)" index={index} /><Skeleton width="65%" height="var(--spacing-7)" index={index + 1} /><Skeleton width="90%" height="var(--spacing-4)" index={index + 2} /></VStack></Card>)}</section> : (
        <section className="event-grid" aria-label="Nominations">
          {nominations.length ? nominations.map((nomination) => (
            <Card key={nomination.id} padding={6} className="event-card">
              <VStack gap={5}>
                <HStack gap={3} align="center" justify="between">
                  <HStack gap={2} align="center"><StatusDot label={nomination.status} variant={nomination.status === 'Published' ? 'success' : nomination.status === 'Scheduled' ? 'warning' : 'neutral'} /><Text type="supporting">{nomination.status}</Text></HStack>
                  <Text type="supporting" color="secondary">{dateFormat.format(new Date(nomination.createdAt))}</Text>
                </HStack>
                <VStack gap={2}>
                  <Heading level={2}>{nomination.name}</Heading>
                  <Text color="secondary">{nomination.description || 'No description yet.'}</Text>
                </VStack>
                <section className="event-metrics" aria-label={`${nomination.name} summary`}>
                  <article><Text type="supporting" color="secondary">Positions</Text><Text type="large" weight="semibold">{nomination.positionCount}</Text></article>
                  <article><Text type="supporting" color="secondary">Nominees</Text><Text type="large" weight="semibold">{nomination.nomineeCount}</Text></article>
                  <article><Text type="supporting" color="secondary">Youth Records</Text><Text type="large" weight="semibold">{nomination.youthRecordCount}</Text></article>
                </section>
                <HStack gap={3} justify="end">
                  <Button label={`Manage ${nomination.name}`} href={`/admin/nominations/${nomination.id}`} variant="secondary">Manage nomination</Button>
                  {nomination.status === 'Published' || nomination.status === 'Scheduled' ? (
                    <Button label={`Open form for ${nomination.name}`} href={`/nominate/${nomination.slug}`} target="_blank" rel="noopener noreferrer" variant="secondary" endContent={<ArrowUpRightIcon />}>Form</Button>
                  ) : null}
                </HStack>
              </VStack>
            </Card>
          )) : <Card padding={8} className="collection-empty-state"><EmptyState title="No nominations yet" description="Create a draft to add positions and upload Youth Records." actions={<Button label="Create nomination" variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)} />} /></Card>}
        </section>
      )}
      <Dialog isOpen={createOpen} onOpenChange={setCreateOpen} purpose="form" width={560}>
        <Layout defaultHasDividers header={<DialogHeader title="Create a nomination" subtitle="Start with a draft, then add positions and publish when ready." onOpenChange={setCreateOpen} />}
          content={<LayoutContent><form id="create-nomination-form" onSubmit={(event) => void create(event)}><VStack gap={4}>
            <FormLayout direction="vertical" defaultOptionality="required">
              <TextInput label="Nomination name" value={name} onChange={(value) => {setName(value); setError('');}} width="100%" isRequired status={error ? {type: 'error', message: error} : undefined} />
              <TextArea label="Description" value={description} onChange={setDescription} width="100%" isOptional />
            </FormLayout>
          </VStack></form></LayoutContent>}
          footer={<LayoutFooter><HStack gap={3} justify="end"><Button label="Cancel" variant="ghost" onClick={() => setCreateOpen(false)} /><Button type="submit" form="create-nomination-form" label="Save as draft" variant="primary" isLoading={saving} /></HStack></LayoutFooter>} />
      </Dialog>
    </main>
  );
}
