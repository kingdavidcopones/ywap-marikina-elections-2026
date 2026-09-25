'use client';

import {FormEvent, useState} from 'react';
import {useRouter} from 'next/navigation';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {FileInput} from '@astryxdesign/core/FileInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {HStack, Layout, LayoutContent, LayoutFooter, VStack} from '@astryxdesign/core/Layout';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useToast} from '@astryxdesign/core/Toast';
import {
  ELIGIBLE_VOTER_CSV_COLUMNS,
  MEMBER_CSV_REQUIRED_COLUMNS,
  getMemberCsvHeaders,
  isCsvEligibilityValue,
  isCsvEligible,
  normalizeGender,
  parseVoters,
} from '@/lib/csv';
import {type ElectionEvent, type EligibleVoter} from '@/lib/election-data';
import {createElection} from '@/lib/api';

interface VoterPreviewRow extends Record<string, unknown> {
  rowId: string;
  memberId: string;
  lastName: string;
  firstName: string;
  gender: string;
  age: string;
  birthDate: string;
  ageGroup: string;
  voterEligibility: 'Yes' | 'No';
  nomineeEligibility: 'Yes' | 'No';
  voterEligible: boolean;
  nomineeEligible: boolean;
  importStatus: string;
  isValid: boolean;
  attributes: Record<string, string>;
}

type UploadStatus = {type: 'error' | 'warning' | 'success'; message: string};

function validateVoterRows(csv: string) {
  const headers = getMemberCsvHeaders(csv);
  const missingColumns = ELIGIBLE_VOTER_CSV_COLUMNS.filter((column) => !headers.includes(column));
  if (missingColumns.length) return {rows: [], missingColumns};

  const records = parseVoters(csv);
  const seenMemberIds = new Set<string>();
  const rows = records.map<VoterPreviewRow>((record, index) => {
    const memberId = record.member_id.trim();
    const age = record.age.trim();
    const voterEligible = isCsvEligible(record.voter);
    const nomineeEligible = isCsvEligible(record.nominee);
    const errors: string[] = [];
    const missingValues = MEMBER_CSV_REQUIRED_COLUMNS.filter((column) => !record[column]?.trim());
    if (missingValues.length) errors.push(`Missing ${missingValues.map((column) => column.replaceAll('_', ' ')).join(', ')}`);
    if (age && (!/^\d+$/.test(age) || Number(age) > 120)) errors.push('Invalid age');
    if (record.birth_date.trim() && Number.isNaN(Date.parse(record.birth_date))) errors.push('Invalid birth date');
    if (!isCsvEligibilityValue(record.voter)) errors.push('Voter must be YES, NO, or blank');
    if (!isCsvEligibilityValue(record.nominee)) errors.push('Nominee must be YES, NO, or blank');
    if (memberId && seenMemberIds.has(memberId.toLocaleUpperCase('en'))) errors.push('Duplicate Member ID');
    if (memberId) seenMemberIds.add(memberId.toLocaleUpperCase('en'));

    return {
      rowId: `${index + 1}-${memberId || 'missing'}`,
      memberId,
      lastName: record.last_name.trim(),
      firstName: record.first_name.trim(),
      gender: normalizeGender(record.gender),
      age,
      birthDate: record.birth_date.trim(),
      ageGroup: record.age_group.trim(),
      voterEligibility: voterEligible ? 'Yes' : 'No',
      nomineeEligibility: nomineeEligible ? 'Yes' : 'No',
      voterEligible,
      nomineeEligible,
      attributes: {...record, voter: voterEligible ? 'YES' : 'NO', nominee: nomineeEligible ? 'YES' : 'NO'},
      importStatus: errors.length ? errors.join('; ') : 'Valid',
      isValid: errors.length === 0,
    };
  });
  return {rows, missingColumns};
}

export function CreateElectionDialog({isOpen, onOpenChange}: {isOpen: boolean; onOpenChange: (isOpen: boolean) => void}) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [anonymousVoting, setAnonymousVoting] = useState(true);
  const [voterFile, setVoterFile] = useState<File | null>(null);
  const [voterRows, setVoterRows] = useState<VoterPreviewRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>();
  const [isVoterPreviewOpen, setIsVoterPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const invalidVoterCount = voterRows.filter((row) => !row.isValid).length;
  const validVoterCount = voterRows.length - invalidVoterCount;
  const canUseVoterList = voterRows.length > 0 && invalidVoterCount === 0;

  function resetForm() {
    setTitle('');
    setDescription('');
    setAnonymousVoting(true);
    setVoterFile(null);
    setVoterRows([]);
    setUploadStatus(undefined);
    setIsVoterPreviewOpen(false);
    setError(null);
  }

  function closeCreationDialog() {
    resetForm();
    onOpenChange(false);
  }

  function removeVoterFile() {
    setVoterFile(null);
    setVoterRows([]);
    setUploadStatus(undefined);
    setIsVoterPreviewOpen(false);
    setError(null);
  }

  async function selectVoterFile(file: File | null) {
    setVoterFile(file);
    setVoterRows([]);
    setUploadStatus(undefined);
    setError(null);
    if (!file) return;

    const {rows, missingColumns} = validateVoterRows(await file.text());
    if (missingColumns.length) {
      setUploadStatus({
        type: 'error',
        message: `Missing required column${missingColumns.length === 1 ? '' : 's'}: ${missingColumns.join(', ')}.`,
      });
      setIsVoterPreviewOpen(true);
      return;
    }
    if (!rows.length) {
      setUploadStatus({type: 'error', message: 'This CSV does not contain any voter records.'});
      setIsVoterPreviewOpen(true);
      return;
    }

    const invalidCount = rows.filter((row) => !row.isValid).length;
    setVoterRows(rows);
    setUploadStatus(invalidCount
      ? {type: 'warning', message: `${invalidCount} row${invalidCount === 1 ? '' : 's'} need attention.`}
      : {type: 'success', message: `${rows.length} member record${rows.length === 1 ? '' : 's'} ready.`});
    setIsVoterPreviewOpen(true);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError('Add an election name before creating the draft.');
      return;
    }
    if (voterFile && (!voterRows.length || invalidVoterCount)) {
      setError('Fix the voter list errors or remove the CSV before creating the election.');
      return;
    }

    setIsCreating(true);
    const eligibleVoterIds = voterRows.filter((row) => row.voterEligible).map((row) => row.memberId);
    const newEvent: ElectionEvent = {
      id: crypto.randomUUID(),
      ballotSlug: `${title.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36) || 'election'}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`,
      anonymousVoting,
      title: title.trim(),
      description: description.trim() || 'Election details will be shared before voting opens.',
      status: 'Draft',
      electionDate: '',
      opensAt: '',
      closesAt: '',
      eligibleVoters: eligibleVoterIds.length,
      eligibleVoterIds,
      ballotsSubmitted: 0,
      positions: [],
    };
    const voters: EligibleVoter[] = voterRows.map((row) => ({
      memberId: row.memberId,
      name: `${row.firstName} ${row.lastName}`,
      firstName: row.firstName,
      lastName: row.lastName,
      ageGroup: row.ageGroup,
      gender: row.gender,
      age: Number(row.age),
      birthDate: new Date(row.birthDate).toISOString().slice(0, 10),
      eligible: row.voterEligible,
      nomineeEligible: row.nomineeEligible,
      attributes: row.attributes,
    }));
    try {
      const saved = await createElection(newEvent, voters);
      toast({body: `${saved.title} draft created.`, uniqueID: 'election-created'});
      closeCreationDialog();
      router.push(`/elections/${saved.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The election could not be created.');
      setIsCreating(false);
    }
  }

  return (
    <>
      <Dialog isOpen={isOpen && !isVoterPreviewOpen} onOpenChange={(open) => { if (!open) closeCreationDialog(); }} purpose="required" width={560}>
        <Layout
          defaultHasDividers
          header={
            <DialogHeader
              title="Create an election"
              subtitle="Start the draft now. You’ll build the ballot and choose when to publish it next."
              onOpenChange={(open) => { if (!open) closeCreationDialog(); }}
            />
          }
          content={
            <LayoutContent>
              <form id="create-election-form" onSubmit={create} noValidate>
                <VStack gap={5}>
                  {error ? <Banner status="error" title="Check the election details" description={error} container="section" /> : null}
                  <FormLayout direction="vertical">
                    <TextInput
                      label="Election name"
                      value={title}
                      onChange={(value) => { setTitle(value); setError(null); }}
                      placeholder="e.g. Youth Elections"
                      isRequired
                      width="100%"
                    />
                    <TextArea
                      label="Description"
                      value={description}
                      onChange={setDescription}
                      placeholder="Tell voters what this election is for"
                      isOptional
                      width="100%"
                    />
                    <CheckboxInput
                      label="Anonymous voting"
                      description="When enabled, ballots are not linked to voter records."
                      value={anonymousVoting}
                      onChange={setAnonymousVoting}
                    />
                    <FileInput
                      label="Voter list"
                      description="Optional member CSV. Use YES in Voter or Nominee for each eligibility; NO and blank mean not eligible."
                      value={voterFile}
                      onChange={(file) => void selectVoterFile(file as File | null)}
                      accept=".csv,text/csv"
                      maxSize={2 * 1024 * 1024}
                      mode="input"
                      isOptional
                      status={uploadStatus}
                      statusVariant="detached"
                      width="100%"
                    />
                  </FormLayout>
                  {voterFile && uploadStatus ? (
                    <HStack gap={3} justify="between" align="center" wrap="wrap">
                      <Text type="supporting" color="secondary">{uploadStatus.message}</Text>
                      <Button label="Review voter list" variant="ghost" size="sm" onClick={() => setIsVoterPreviewOpen(true)}>Review CSV</Button>
                    </HStack>
                  ) : null}
                </VStack>
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end">
                <Button label="Cancel creating election" variant="ghost" onClick={closeCreationDialog}>Cancel</Button>
                <Button type="submit" form="create-election-form" label="Create election draft" variant="primary" isLoading={isCreating}>Create draft</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={isOpen && isVoterPreviewOpen} onOpenChange={(open) => { if (!open) setIsVoterPreviewOpen(false); }} purpose="form" width={1040}>
        <Layout
          defaultHasDividers
          header={
            <DialogHeader
              title="Review voter list"
              subtitle={voterFile?.name ?? 'Check the CSV before adding it to this election.'}
              onOpenChange={(open) => { if (!open) setIsVoterPreviewOpen(false); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={4}>
                {voterRows.length ? (
                  <>
                    <HStack gap={4} wrap="wrap">
                      <Text weight="semibold">{validVoterCount} valid</Text>
                      <Text weight={invalidVoterCount ? 'semibold' : undefined} color="secondary">{invalidVoterCount} need attention</Text>
                    </HStack>
                    {invalidVoterCount ? <Banner status="warning" title="Some voter records need attention" description="Replace the CSV after correcting the validation messages shown below." container="section" /> : null}
                    <section className="table-surface voter-preview-table" aria-label="Voter list preview" tabIndex={0}>
                      <Table<VoterPreviewRow>
                        data={voterRows}
                        idKey="rowId"
                        density="compact"
                        dividers="rows"
                        verticalAlign="top"
                        columns={[
                          {key: 'memberId', header: 'Member ID', width: pixel(150)},
                          {key: 'lastName', header: 'Last name', width: proportional(1)},
                          {key: 'firstName', header: 'First name', width: proportional(1)},
                          {key: 'gender', header: 'Gender', width: pixel(90)},
                          {key: 'age', header: 'Age', width: pixel(70)},
                          {key: 'birthDate', header: 'Birth date', width: pixel(150)},
                          {key: 'ageGroup', header: 'Age group', width: pixel(140)},
                          {key: 'voterEligibility', header: 'Voter', width: pixel(100), renderCell: (row) => <HStack gap={1} align="center"><StatusDot variant={row.voterEligible ? 'success' : 'neutral'} label={`Voter eligible: ${row.voterEligibility}`} /><Text>{row.voterEligibility}</Text></HStack>},
                          {key: 'nomineeEligibility', header: 'Nominee', width: pixel(110), renderCell: (row) => <HStack gap={1} align="center"><StatusDot variant={row.nomineeEligible ? 'success' : 'neutral'} label={`Nominee eligible: ${row.nomineeEligibility}`} /><Text>{row.nomineeEligibility}</Text></HStack>},
                          {key: 'importStatus', header: 'Validation', width: proportional(2)},
                        ]}
                      />
                    </section>
                  </>
                ) : (
                  <Banner
                    status="error"
                    title="This voter list can’t be used"
                    description={uploadStatus?.message ?? 'Choose a CSV containing the required voter columns.'}
                    container="section"
                  />
                )}
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="between">
                <Button label="Remove voter CSV" variant="ghost" onClick={removeVoterFile}>Remove CSV</Button>
                <Button
                  label={canUseVoterList ? 'Use voter list' : 'Return to election form'}
                  variant="primary"
                  onClick={() => setIsVoterPreviewOpen(false)}
                >{canUseVoterList ? 'Use voter list' : 'Back to form'}</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>
    </>
  );
}
