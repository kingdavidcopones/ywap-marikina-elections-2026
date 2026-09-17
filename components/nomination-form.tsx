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
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {fetchNominationAvailability, fetchPublicNomination, type NominationAvailability} from '@/lib/api';
import {VoterLinkState} from '@/components/voter-link-state';
import {NOMINATION_AGE_GROUPS, positionVisibleToAgeGroup, type Nomination, type NominationAgeGroup, type NominationPosition} from '@/lib/nomination-data';

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
    <TextInput label={position.name} value={value.name} onChange={(name) => {onChange({name}); setSuggestions([]);}}
      placeholder={`Nominate for ${position.name}`} description="Choose a Youth Record suggestion, or enter a name." width="100%" size="lg" isRequired autoComplete="off" status={error ? {type: 'error', message: error} : undefined} />
    {position.showRoleDetails && (position.aboutRole || position.responsibilities.length) ? <VStack gap={1}>
      {position.aboutRole ? <Text color="secondary">{position.aboutRole}</Text> : null}
      {position.responsibilities.length ? <section className="position-responsibilities" aria-label={`${position.name} responsibilities`}>
        <Text type="supporting" weight="semibold">Responsibilities</Text><ul>{position.responsibilities.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>
      </section> : null}
    </VStack> : null}
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
  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [availability, setAvailability] = useState<NominationAvailability | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [step, setStep] = useState<0 | 1>(0);
  const [ageGroup, setAgeGroup] = useState<NominationAgeGroup | null>(null);
  const [ageGroupError, setAgeGroupError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void fetchNominationAvailability(slug).then((result) => {if (active) setAvailability(result);})
      .catch(() => {if (active) setAvailability(null);});
    return () => {active = false;};
  }, [slug]);

  useEffect(() => {
    if (availability?.status !== 'Scheduled' || !availability.opensAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [availability?.status, availability?.opensAt]);

  const startsAt = availability?.opensAt ? Date.parse(availability.opensAt) : Number.NaN;
  const closesAt = availability?.closesAt ? Date.parse(availability.closesAt) : Number.NaN;
  const isBeforeStart = Number.isFinite(startsAt) && now < startsAt;
  const isAfterClose = Number.isFinite(closesAt) && now > closesAt;
  const isActive = availability && (availability.status === 'Published' || availability.status === 'Scheduled') && !isBeforeStart && !isAfterClose;
  const visiblePositions = ageGroup ? nomination?.positions.filter((position) => positionVisibleToAgeGroup(position, ageGroup)) ?? [] : [];
  const selectedAgeGroup = NOMINATION_AGE_GROUPS.find((group) => group.value === ageGroup);

  useEffect(() => {
    if (!isActive) return;
    let active = true;
    setLoading(true);
    void fetchPublicNomination(slug).then((result) => {if (active) setNomination(result.nomination);})
      .catch((cause) => {if (active) setError(cause instanceof Error ? cause.message : 'This nomination is unavailable.');})
      .finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, [slug, isActive]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nomination || !ageGroup || !visiblePositions.length) return;
    const invalid = Object.fromEntries(visiblePositions.flatMap((position) => {
      const length = choices[position.id]?.name.trim().length ?? 0;
      return length >= 2 && length <= 160 ? [] : [[position.id, length < 2 ? 'Enter at least 2 characters.' : 'Use at most 160 characters.']];
    }));
    if (Object.keys(invalid).length) {setFieldErrors(invalid); return;}
    setSubmitting(true); setError('');
    try {
      const submittedChoices = Object.fromEntries(visiblePositions.map((position) => [position.id, choices[position.id]]));
      const response = await fetch(`/api/nominations/${encodeURIComponent(slug)}/submit`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ageGroup, choices: submittedChoices}),
      });
      const body = await response.json() as {message?: string};
      if (!response.ok) throw new Error(body.message ?? 'Your nomination could not be submitted.');
      setSubmitted(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your nomination could not be submitted.'); }
    finally { setSubmitting(false); }
  }

  if (availability?.status === 'Scheduled' && isBeforeStart) {
    return <VoterLinkState kind="scheduled" subject="nomination" electionTitle={availability.name} startsAt={availability.opensAt} now={now} />;
  }
  if (availability === null || (availability && !isActive)) return <VoterLinkState kind="unavailable" subject="nomination" />;

  return <AppShell height="fill" variant="wash" contentPadding={0}>
    <Section variant="transparent" padding={6} className="access-page animated-mesh-gradient-background" width="100%">
      <VStack gap={6} hAlign="center" width="100%">
        <header className="access-brand"><Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} priority /></header>
        <Card maxWidth={720} width="100%" padding={8} elevation="low" className="verification-card">
          {availability === undefined || loading || (isActive && !nomination && !error) ? <VStack gap={5} aria-busy="true" aria-label="Loading nomination"><Skeleton width="70%" height="var(--spacing-8)" index={0} /><Skeleton width="100%" height="var(--spacing-4)" index={1} /><Skeleton width="100%" height="var(--spacing-12)" index={2} /></VStack> : submitted ? <VStack gap={4}>
            <Heading level={1}>Nomination submitted</Heading>
            <Text>Thank you. Your nominations have been recorded.</Text>
          </VStack> : nomination ? <VStack gap={6}>
            <VStack gap={2}><Heading level={1}>Submit your nomination</Heading><Text weight="semibold">{nomination.name}</Text>{nomination.description ? <Text color="secondary">{nomination.description}</Text> : null}</VStack>
            <Divider />
            {step === 0 ? <VStack gap={5}>
              <VStack gap={1}><Text type="supporting" color="secondary">Step 1 of 2</Text><Heading level={2}>Choose your age group</Heading><Text color="secondary">Your age group determines which positions you can nominate for.</Text></VStack>
              <section aria-label="Age groups"><VStack gap={3} width="100%">
                {NOMINATION_AGE_GROUPS.map((group) => <SelectableCard key={group.value} label={`${group.label}, ${group.ages}`} isSelected={ageGroup === group.value} onChange={() => {setAgeGroup(group.value); setAgeGroupError('');}} width="100%" padding={5}>
                  <VStack gap={1}><Text weight="semibold">{group.label}</Text><Text color="secondary">{group.ages}</Text></VStack>
                </SelectableCard>)}
              </VStack></section>
              {ageGroupError ? <Banner status="error" title="Age group required" description={ageGroupError} container="section" /> : null}
              <Button label="Continue to nominations" variant="primary" size="lg" width="100%" onClick={() => {if (!ageGroup) {setAgeGroupError('Select your age group to continue.'); return;} setStep(1);}} />
            </VStack> : <form onSubmit={(event) => void submit(event)} noValidate><VStack gap={6}>
              <VStack gap={1}><Text type="supporting" color="secondary">Step 2 of 2 · {selectedAgeGroup?.label}</Text><Heading level={2}>Nominate</Heading>{visiblePositions.length ? <Text color="secondary">Enter a nominee for each position below.</Text> : null}</VStack>
              {error ? <Banner status="error" title="We couldn’t submit your nomination" description={error} container="section" /> : null}
              {visiblePositions.length ? visiblePositions.map((position, index) => <VStack key={position.id} gap={5} width="100%">
                {index ? <Divider /> : null}
                <NomineeField position={position} slug={slug} value={choices[position.id] ?? {name: ''}} error={fieldErrors[position.id]}
                  onChange={(choice) => {setChoices((current) => ({...current, [position.id]: choice})); setFieldErrors((current) => ({...current, [position.id]: ''})); setError('');}} />
              </VStack>) : <Text color="secondary">No positions are available for your age group. Contact the election committee if you think this is a mistake.</Text>}
              <Button label="Back to age groups" variant="secondary" width="100%" onClick={() => setStep(0)} />
              {visiblePositions.length ? <Button type="submit" label="Submit nomination" variant="primary" size="lg" width="100%" isLoading={submitting} /> : null}
            </VStack></form>}
          </VStack> : <VStack gap={3}><Heading level={1}>Nomination unavailable</Heading><Text color="secondary">{error || 'This form is not accepting responses right now.'}</Text></VStack>}
        </Card>
      </VStack>
    </Section>
  </AppShell>;
}
