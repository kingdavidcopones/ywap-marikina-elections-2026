'use client';

import {useEffect, useState} from 'react';
import Image from 'next/image';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack} from '@astryxdesign/core/Layout';
import {Section} from '@astryxdesign/core/Section';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {useToast} from '@astryxdesign/core/Toast';
import {fetchPublicNomination} from '@/lib/api';
import type {Nomination, NominationPosition} from '@/lib/nomination-data';

type Choice = {name: string; youthRecordId?: string};
type Suggestion = {id: string; name: string; ageGroup: string};

function NomineeField({position, slug, value, error, onChange}: {position: NominationPosition; slug: string; value: Choice; error?: string; onChange: (choice: Choice) => void}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  useEffect(() => {
    const query = value.name.trim();
    if (query.length < 2 || value.youthRecordId) {setSuggestions([]); setSearching(false); return;}
    const controller = new AbortController();
    setLookupError(false);
    const timer = window.setTimeout(() => {
      setSearching(true);
      fetch(`/api/nominations/${encodeURIComponent(slug)}/lookup?q=${encodeURIComponent(query)}`, {signal: controller.signal, cache: 'no-store'})
        .then((response) => {if (!response.ok) throw new Error('Lookup unavailable.'); return response.json();})
        .then((body: {records?: Suggestion[]}) => setSuggestions(body.records ?? []))
        .catch(() => { if (!controller.signal.aborted) {setSuggestions([]); setLookupError(true);} })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 200);
    return () => {window.clearTimeout(timer); controller.abort();};
  }, [slug, value.name, value.youthRecordId]);

  return <VStack gap={3}>
    <VStack gap={1}>
      <Heading level={2}>{position.name}</Heading>
      {position.showRoleDetails && position.aboutRole ? <Text color="secondary">{position.aboutRole}</Text> : null}
      {position.showRoleDetails && position.responsibilities.length ? <section className="position-responsibilities" aria-label={`${position.name} responsibilities`}>
        <Text type="supporting" weight="semibold">Responsibilities</Text><ul>{position.responsibilities.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      </section> : null}
    </VStack>
    <TextInput label={`Nominee for ${position.name}`} value={value.name} onChange={(name) => {onChange({name}); setSuggestions([]);}}
      placeholder="Search Youth Records or enter a name" description="Choose a suggestion, or keep the name you typed." width="100%" size="lg" isRequired autoComplete="off" status={error ? {type: 'error', message: error} : undefined} />
    {searching ? <Text type="supporting" color="secondary">Searching Youth Records…</Text> : null}
    {lookupError ? <Text type="supporting" color="secondary">Youth Record search is unavailable. You can still enter a name.</Text> : null}
    {!value.youthRecordId && suggestions.length ? <section aria-label={`Youth Record suggestions for ${position.name}`}><VStack gap={1}>
      {suggestions.map((suggestion) => <Button key={suggestion.id} label={`Choose ${suggestion.name}`} variant="ghost" width="100%"
        onClick={() => {onChange({name: suggestion.name, youthRecordId: suggestion.id}); setSuggestions([]);}}>{suggestion.name} · {suggestion.ageGroup}</Button>)}
    </VStack></section> : null}
    {value.youthRecordId ? <Text type="supporting" color="secondary">Selected from Youth Records. Edit the name to enter free text instead.</Text> : null}
  </VStack>;
}

export function NominationForm({slug}: {slug: string}) {
  const toast = useToast();
  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [preview, setPreview] = useState(false);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchPublicNomination(slug).then((result) => {setNomination(result.nomination); setPreview(result.preview);}).catch((cause) => setError(cause instanceof Error ? cause.message : 'This nomination is unavailable.')).finally(() => setLoading(false));
  }, [slug]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) { setError('This is a preview. Publish the nomination to accept responses.'); return; }
    if (!nomination) return;
    const invalid = Object.fromEntries(nomination.positions.flatMap((position) => {
      const length = choices[position.id]?.name.trim().length ?? 0;
      return length >= 2 && length <= 160 ? [] : [[position.id, length < 2 ? 'Enter at least 2 characters.' : 'Use at most 160 characters.']];
    }));
    if (Object.keys(invalid).length) {setFieldErrors(invalid); setError('Check the nominee names below.'); return;}
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/nominations/${encodeURIComponent(slug)}/submit`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({choices}),
      });
      const body = await response.json() as {message?: string};
      if (!response.ok) throw new Error(body.message ?? 'Your nomination could not be submitted.');
      setSubmitted(true);
      toast({body: 'Nomination submitted.'});
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'Your nomination could not be submitted.'; setError(message); toast({body: message, type: 'error'}); }
    finally { setSubmitting(false); }
  }

  return <AppShell height="fill" variant="wash" contentPadding={0}>
    <Section variant="transparent" padding={6} className="access-page animated-mesh-gradient-background" width="100%">
      <VStack gap={6} hAlign="center" width="100%">
        <header className="access-brand"><Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} priority /></header>
        <Card maxWidth={560} width="100%" padding={8} elevation="low" className="verification-card">
          {loading ? <VStack gap={5} aria-busy="true" aria-label="Loading nomination"><Skeleton width="70%" height="var(--spacing-8)" index={0} /><Skeleton width="100%" height="var(--spacing-4)" index={1} /><Skeleton width="100%" height="var(--spacing-12)" index={2} /></VStack> : submitted ? <VStack gap={4}>
            <Heading level={1}>Nomination submitted</Heading>
            <Text>Thank you. Your nominees have been recorded.</Text>
          </VStack> : nomination ? <form onSubmit={(event) => void submit(event)} noValidate><VStack gap={6}>
            <VStack gap={2}><Heading level={1}>{nomination.name}</Heading><Text color="secondary">{nomination.description || 'Nominate one person for each position.'}</Text></VStack>
            {preview ? <Banner status="info" title="Preview only" description="This nomination is not accepting responses right now." container="section" /> : null}
            {error ? <Banner status="error" title="We couldn’t continue" description={error} container="section" /> : null}
            {nomination.positions.map((position, index) => <VStack key={position.id} gap={5} width="100%">
              {index ? <Divider /> : null}
              <NomineeField position={position} slug={slug} value={choices[position.id] ?? {name: ''}} error={fieldErrors[position.id]}
                onChange={(choice) => {setChoices((current) => ({...current, [position.id]: choice})); setFieldErrors((current) => ({...current, [position.id]: ''})); setError('');}} />
            </VStack>)}
            <Button type="submit" label="Submit nomination" variant="primary" size="lg" width="100%" isLoading={submitting} isDisabled={preview} />
          </VStack></form> : <VStack gap={3}><Heading level={1}>Nomination unavailable</Heading><Text color="secondary">{error || 'This form is not accepting responses right now.'}</Text></VStack>}
        </Card>
        <footer className="access-support"><Text type="supporting" color="secondary" as="p" justify="center">Names can be chosen from Youth Records or entered manually.</Text></footer>
      </VStack>
    </Section>
  </AppShell>;
}
