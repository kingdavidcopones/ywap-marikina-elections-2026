'use client';

import {useEffect, useMemo, useState} from 'react';
import Image from 'next/image';
import {AppShell} from '@astryxdesign/core/AppShell';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, Layout, LayoutContent, LayoutFooter, VStack} from '@astryxdesign/core/Layout';
import {Section} from '@astryxdesign/core/Section';
import {Step, Stepper} from '@astryxdesign/core/Stepper';
import {Text} from '@astryxdesign/core/Text';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {SelectableCard} from '@astryxdesign/core/SelectableCard';
import {Typeahead, TypeaheadItem, type SearchSource, type SearchableItem} from '@astryxdesign/core/Typeahead';
import {fetchNominationAvailability, fetchPublicNomination, type NominationAvailability} from '@/lib/api';
import {NominationConfirmation} from '@/components/nomination-confirmation';
import {VoterLinkState} from '@/components/voter-link-state';
import {NOMINATION_AGE_GROUPS, positionVisibleToAgeGroup, type Nomination, type NominationAgeGroup, type NominationPosition} from '@/lib/nomination-data';

type Choice = {name: string; youthRecordId?: string};
type Suggestion = {id: string; name: string};
interface NomineeItem extends SearchableItem<{name: string; youthRecordId?: string}> {
  auxiliaryData: {name: string; youthRecordId?: string};
}

function NomineeField({position, slug, value, error, onChange}: {position: NominationPosition; slug: string; value: Choice; error?: string; onChange: (choice: Choice) => void}) {
  const [lookupError, setLookupError] = useState(false);
  const searchSource = useMemo<SearchSource<NomineeItem>>(() => {
    let controller: AbortController | null = null;
    return {
      bootstrap: () => [],
      cancel: () => controller?.abort(),
      async search(query) {
        const name = query.trim();
        if (name.length < 2) return [];
        controller?.abort();
        const requestController = new AbortController();
        controller = requestController;
        setLookupError(false);
        let records: Suggestion[] = [];
        try {
          const response = await fetch(`/api/nominations/${encodeURIComponent(slug)}/lookup?q=${encodeURIComponent(name)}`, {
            signal: requestController.signal,
            cache: 'no-store',
          });
          if (!response.ok) throw new Error('Lookup unavailable.');
          const body = await response.json() as {records?: Suggestion[]};
          records = body.records ?? [];
        } catch {
          if (requestController.signal.aborted) return [];
          setLookupError(true);
        }
        const matches: NomineeItem[] = records.map((record) => ({
          id: record.id,
          label: record.name,
          auxiliaryData: {name: record.name, youthRecordId: record.id},
        }));
        if (!matches.some((item) => item.label.toLocaleLowerCase('en') === name.toLocaleLowerCase('en'))) {
          matches.push({id: `typed:${name}`, label: name, auxiliaryData: {name}});
        }
        return matches;
      },
    };
  }, [slug]);
  const selected: NomineeItem | null = value.name ? {
    id: value.youthRecordId ?? `typed:${value.name}`,
    label: value.name,
    auxiliaryData: {name: value.name, youthRecordId: value.youthRecordId},
  } : null;

  return <VStack gap={3}>
    <Typeahead<NomineeItem>
      label={position.name}
      description={position.shortDescription || undefined}
      placeholder="Search or enter a name"
      searchSource={searchSource}
      value={selected}
      onChange={(item) => {onChange(item ? item.auxiliaryData : {name: ''}); setLookupError(false);}}
      renderItem={(item) => <TypeaheadItem item={item} />}
      minQueryLength={2}
      debounceMs={200}
      width="100%"
      size="lg"
      isRequired={position.required}
      isOptional={!position.required}
      status={error ? {type: 'error', message: error} : undefined}
    />
    {lookupError ? <Text type="supporting" color="secondary">Youth Record search is unavailable. You can still use the name you entered.</Text> : null}
  </VStack>;
}

export function NominationForm({slug}: {slug: string}) {
  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [availability, setAvailability] = useState<NominationAvailability | null | undefined>(undefined);
  const [now, setNow] = useState(() => Date.now());
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<NominationAgeGroup | null>(null);
  const [ageGroupError, setAgeGroupError] = useState('');
  const [detailsError, setDetailsError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
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

  function continueToNominate() {
    const trimmedName = name.trim();
    if (trimmedName.length > 160) { setDetailsError('Use at most 160 characters for your name.'); return; }
    if (!ageGroup) { setAgeGroupError('Select your age group to continue.'); return; }
    setDetailsError(''); setAgeGroupError('');
    setStep(1);
  }

  function reviewChoices() {
    if (!visiblePositions.length) return;
    const invalid = Object.fromEntries(visiblePositions.flatMap((position) => {
      const length = choices[position.id]?.name.trim().length ?? 0;
      if (length === 0) return position.required ? [[position.id, 'Choose a name from the suggestions.']] : [];
      return length >= 2 && length <= 160 ? [] : [[position.id, 'Use at most 160 characters.']];
    }));
    if (Object.keys(invalid).length) {setFieldErrors(invalid); return;}
    setStep(2);
  }

  async function submit() {
    if (!nomination || !ageGroup || !visiblePositions.length || submitting) return;
    setSubmitting(true); setError('');
    try {
      const submittedChoices = Object.fromEntries(visiblePositions.flatMap((position) => {
        const choice = choices[position.id];
        return choice?.name.trim() ? [[position.id, choice]] : [];
      }));
      const response = await fetch(`/api/nominations/${encodeURIComponent(slug)}/submit`, {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ageGroup, name: name.trim(), choices: submittedChoices}),
      });
      const body = await response.json() as {message?: string; submittedAt?: string};
      if (!response.ok) throw new Error(body.message ?? 'Your nomination could not be submitted.');
      setSubmittedAt(body.submittedAt ?? new Date().toISOString());
    } catch (cause) {
      setConfirmOpen(false);
      setError(cause instanceof Error ? cause.message : 'Your nomination could not be submitted.');
    }
    finally { setSubmitting(false); }
  }

  if (submittedAt && nomination) return <NominationConfirmation nominationName={nomination.name} submittedAt={submittedAt} slug={slug} />;
  if (availability?.status === 'Scheduled' && isBeforeStart) {
    return <VoterLinkState kind="scheduled" subject="nomination" electionTitle={availability.name} startsAt={availability.opensAt} now={now} />;
  }
  if (availability === null || (availability && !isActive)) return <VoterLinkState kind="unavailable" subject="nomination" />;

  return <AppShell height="fill" variant="wash" contentPadding={0}>
    <Section variant="transparent" padding={6} className="access-page nomination-access-page animated-mesh-gradient-background" width="100%">
      <VStack gap={6} hAlign="center" width="100%">
        <header className="access-brand"><Image src="/brand/ywap-marikina-elections-logo-word.svg" alt="YWAP Marikina Elections 2026" width={172} height={50} priority /></header>
        <Card maxWidth={720} width="100%" padding={8} elevation="low" className="verification-card nomination-wizard-card">
          {availability === undefined || loading || (isActive && !nomination && !error) ? <VStack gap={5} aria-busy="true" aria-label="Loading nomination"><Skeleton width="70%" height="var(--spacing-8)" index={0} /><Skeleton width="100%" height="var(--spacing-4)" index={1} /><Skeleton width="100%" height="var(--spacing-12)" index={2} /></VStack> : nomination ? <VStack gap={6} width="100%" className="nomination-wizard-content">
            <VStack gap={2}><Heading level={1}>Submit your nomination</Heading><Text weight="semibold">{nomination.name}</Text>{nomination.description ? <Text color="secondary">{nomination.description}</Text> : null}</VStack>
            <Stepper activeStep={step} density="compact" label="Nomination steps" horizontalOptions={{minimumStepWidth: 112, collapsedVariant: 'hiddenLabel'}}>
              <Step step={0} label="Details" />
              <Step step={1} label="Nominate" />
              <Step step={2} label="Review" />
            </Stepper>
            <Divider />
            {step === 0 ? <VStack gap={5}>
              <VStack gap={1}><Text type="supporting" color="secondary">Step 1 of 3</Text><Heading level={2}>Your details</Heading><Text color="secondary">Tell us who you are, then choose your age group. Your age group determines which positions you can nominate for.</Text></VStack>
              <TextInput label="Name" placeholder="Enter your name" value={name} onChange={(value) => {setName(value); setDetailsError('');}} width="100%" isOptional />
              <section aria-label="Age groups"><VStack gap={3} width="100%">
                <Text weight="semibold">Choose your age group</Text>
                {NOMINATION_AGE_GROUPS.map((group) => <SelectableCard key={group.value} label={`${group.label}, ${group.ages}`} isSelected={ageGroup === group.value} onChange={() => {setAgeGroup(group.value); setAgeGroupError('');}} width="100%" padding={5}>
                  <VStack gap={1}><Text weight="semibold">{group.label}</Text><Text color="secondary">{group.ages}</Text></VStack>
                </SelectableCard>)}
              </VStack></section>
              {(detailsError || ageGroupError) ? <Banner status="error" title="Check your details" description={detailsError || ageGroupError} container="section" /> : null}
              <Button label="Continue to nominations" variant="primary" size="lg" width="100%" onClick={continueToNominate} />
            </VStack> : step === 1 ? <VStack gap={6} width="100%">
              <VStack gap={1}><Text type="supporting" color="secondary">Step 2 of 3 · {selectedAgeGroup?.label}</Text><Heading level={2}>Nominate</Heading>{visiblePositions.length ? <Text color="secondary">Choose or enter a nominee for each position.</Text> : null}</VStack>
              {visiblePositions.length ? visiblePositions.map((position, index) => <VStack key={position.id} gap={5} width="100%">
                {index ? <Divider /> : null}
                <NomineeField position={position} slug={slug} value={choices[position.id] ?? {name: ''}} error={fieldErrors[position.id]}
                  onChange={(choice) => {setChoices((current) => ({...current, [position.id]: choice})); setFieldErrors((current) => ({...current, [position.id]: ''})); setError('');}} />
              </VStack>) : <Text color="secondary">No positions are available for your age group. Contact the election committee if you think this is a mistake.</Text>}
              <HStack gap={3} justify="between" align="center" wrap="wrap" width="100%">
                <Button label="Back" variant="secondary" size="lg" onClick={() => setStep(0)} />
                {visiblePositions.length ? <Button label="Review" variant="primary" size="lg" onClick={reviewChoices} /> : null}
              </HStack>
            </VStack> : <VStack gap={6} width="100%">
              <VStack gap={1}><Text type="supporting" color="secondary">Step 3 of 3 · {selectedAgeGroup?.label}</Text><Heading level={2}>Review your nominations</Heading><Text color="secondary">Check each name before submitting.</Text></VStack>
              {error ? <Banner status="error" title="We couldn’t submit your nomination" description={error} container="section" /> : null}
              <VStack gap={4} width="100%">
                {visiblePositions.map((position, index) => <section key={position.id} aria-label={position.name}>
                  {index ? <Divider /> : null}
                  <VStack gap={1} paddingBlockStart={index ? 4 : 0}>
                    <Text type="supporting" color="secondary">{position.name}</Text>
                    <Text weight="semibold">{choices[position.id]?.name || 'Not nominated'}</Text>
                  </VStack>
                </section>)}
              </VStack>
              <HStack gap={3} justify="between" align="center" wrap="wrap" width="100%">
                <Button label="Back" variant="secondary" size="lg" onClick={() => setStep(1)} />
                <Button label="Submit" variant="primary" size="lg" onClick={() => setConfirmOpen(true)} />
              </HStack>
            </VStack>}
          </VStack> : <VStack gap={3}><Heading level={1}>Nomination unavailable</Heading><Text color="secondary">{error || 'This form is not accepting responses right now.'}</Text></VStack>}
        </Card>
      </VStack>
    </Section>
    <Dialog isOpen={confirmOpen} onOpenChange={setConfirmOpen} purpose="form" width={480}>
      <Layout height="auto" defaultHasDividers
        header={<DialogHeader title="Submit your nominations?" />}
        content={<LayoutContent><Text>Once submitted, your nominations will be recorded. You can go back to review them first.</Text></LayoutContent>}
        footer={<LayoutFooter><HStack gap={3} justify="end" align="center" wrap="wrap" width="100%">
          <Button label="Cancel" variant="secondary" onClick={() => setConfirmOpen(false)} isDisabled={submitting} />
          <Button label="Confirm submission" variant="primary" onClick={() => void submit()} isLoading={submitting} />
        </HStack></LayoutFooter>}
      />
    </Dialog>
  </AppShell>;
}
