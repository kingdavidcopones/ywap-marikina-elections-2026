'use client';

import {useEffect, useState} from 'react';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArrowUpRightIcon} from '@phosphor-icons/react/ArrowUpRight';
import {CopySimpleIcon} from '@phosphor-icons/react/CopySimple';
import {PlusIcon} from '@phosphor-icons/react/Plus';
import {TrashIcon} from '@phosphor-icons/react/Trash';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Banner} from '@astryxdesign/core/Banner';
import {Button} from '@astryxdesign/core/Button';
import {Card} from '@astryxdesign/core/Card';
import {CheckboxInput} from '@astryxdesign/core/CheckboxInput';
import {DateTimeInput, type ISODateTimeString} from '@astryxdesign/core/DateTimeInput';
import {Dialog, DialogHeader} from '@astryxdesign/core/Dialog';
import {DropdownMenu} from '@astryxdesign/core/DropdownMenu';
import {EmptyState} from '@astryxdesign/core/EmptyState';
import {FileInput} from '@astryxdesign/core/FileInput';
import {FormLayout} from '@astryxdesign/core/FormLayout';
import {Heading} from '@astryxdesign/core/Heading';
import {HStack, Layout, LayoutContent, LayoutFooter, VStack} from '@astryxdesign/core/Layout';
import {Pagination} from '@astryxdesign/core/Pagination';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useToast} from '@astryxdesign/core/Toast';
import {fetchAdminNomination, fetchNominationNominees, fetchNominationYouthRecords, updateAdminNomination} from '@/lib/api';
import {ElectionEditorSkeleton} from '@/components/loading-states';
import {parseVoters} from '@/lib/csv';
import type {Nomination, NominationEntry, NominationPosition, NominationStatus, YouthRecord} from '@/lib/nomination-data';

interface PositionRow extends Record<string, unknown> { id: string; name: string; about: string; responsibilities: string; }
interface NomineeRow extends Record<string, unknown> { id: string; nomineeName: string; positionName: string; submittedAt: string; }
interface YouthRow extends Record<string, unknown> { id: string; memberId: string; name: string; ageGroup: string; importedAt: string; }
type UploadRecord = Omit<YouthRecord, 'id' | 'name' | 'importedAt'>;
type RemoveTarget = {type: 'delete-position' | 'delete-nominee'; id: string; name: string};
const PAGE_SIZE = 10;

const dateTimeFormat = new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila'});
function formatDate(value: string) { return value ? dateTimeFormat.format(new Date(value)) : 'Not set'; }
function manilaInput(value: string): ISODateTimeString | undefined {
  return value ? new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) as ISODateTimeString : undefined;
}
function toIso(value?: ISODateTimeString) {
  if (!value) return '';
  const timestamp = Date.parse(`${value.length === 16 ? `${value}:00` : value}+08:00`);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function parseYouthCsv(csv: string): UploadRecord[] {
  const records = parseVoters(csv);
  if (!records.length) throw new Error('Add a CSV with member_id, first_name, last_name, gender, age, birth_date, and age_group columns.');
  if (records.length > 10000) throw new Error('Upload up to 10,000 Youth Records at a time.');
  const required = ['member_id', 'first_name', 'last_name', 'gender', 'age', 'birth_date', 'age_group'];
  const seen = new Set<string>();
  return records.map((record, index) => {
    const missing = required.filter((key) => !record[key]?.trim());
    if (missing.length) throw new Error(`Row ${index + 1}: missing ${missing.join(', ')}.`);
    const memberId = record.member_id.trim();
    if (seen.has(memberId.toUpperCase())) throw new Error(`Duplicate Member ID: ${memberId}.`);
    seen.add(memberId.toUpperCase());
    const age = Number(record.age);
    if (!Number.isInteger(age) || age < 0 || age > 120) throw new Error(`Row ${index + 1}: invalid age.`);
    const birthDate = record.birth_date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || Number.isNaN(Date.parse(birthDate)) || new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) !== birthDate) throw new Error(`Row ${index + 1}: invalid birth date. Use YYYY-MM-DD.`);
    return {memberId, firstName: record.first_name.trim(), lastName: record.last_name.trim(), ageGroup: record.age_group.trim(),
      gender: record.gender.trim(), age, birthDate, attributes: record};
  });
}

export function NominationEditor({id}: {id: string}) {
  const toast = useToast();
  const [nomination, setNomination] = useState<Nomination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('positions');
  const [nomineesPage, setNomineesPage] = useState(1);
  const [youthPage, setYouthPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [positionOpen, setPositionOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<NominationPosition | null>(null);
  const [positionName, setPositionName] = useState('');
  const [showRoleDetails, setShowRoleDetails] = useState(false);
  const [aboutRole, setAboutRole] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [opensAt, setOpensAt] = useState<ISODateTimeString>();
  const [closesAt, setClosesAt] = useState<ISODateTimeString>();
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [nomineeEntries, setNomineeEntries] = useState<NominationEntry[]>([]);
  const [youthRecords, setYouthRecords] = useState<YouthRecord[]>([]);
  const [nomineeTotal, setNomineeTotal] = useState(0);
  const [youthTotal, setYouthTotal] = useState(0);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailsError, setDetailsError] = useState('');
  const [positionError, setPositionError] = useState('');
  const [scheduleError, setScheduleError] = useState('');

  useEffect(() => {
    void fetchAdminNomination(id).then(setNomination).catch((cause) => setError(cause instanceof Error ? cause.message : 'Nomination could not be loaded.')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!nomination || tab === 'positions') return;
    let active = true;
    setCollectionLoading(true);
    setCollectionError('');
    const request = tab === 'nominees' ? fetchNominationNominees(id, nomineesPage) : fetchNominationYouthRecords(id, youthPage);
    void request.then((result) => {
      if (!active) return;
      if ('nominees' in result) {setNomineeEntries(result.nominees); setNomineeTotal(result.total);}
      else {setYouthRecords(result.records); setYouthTotal(result.total);}
    }).catch((cause) => {
      if (active) setCollectionError(cause instanceof Error ? cause.message : 'Records could not be loaded.');
    }).finally(() => {if (active) setCollectionLoading(false);});
    return () => {active = false;};
  }, [id, nomination?.id, tab, nomineesPage, youthPage, refreshKey]);

  async function mutate(action: Record<string, unknown>) {
    if (!nomination) return false;
    setBusy(true);
    setError('');
    try {
      const updated = await updateAdminNomination(nomination.id, action);
      setNomination(updated);
      setRefreshKey((value) => value + 1);
      if (action.type === 'delete-nominee' && nomineesPage > Math.max(1, Math.ceil(updated.nomineeCount / PAGE_SIZE))) setNomineesPage(Math.max(1, Math.ceil(updated.nomineeCount / PAGE_SIZE)));
      toast({body: action.type === 'status' ? `Nomination ${String(action.status).toLowerCase()}.` : action.type === 'position' ? 'Position saved.' : action.type === 'delete-position' ? 'Position removed.' : action.type === 'delete-nominee' ? 'Nominee removed.' : action.type === 'details' ? 'Nomination details saved.' : 'Youth Records saved.'});
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The change could not be saved.';
      setError(message);
      toast({body: message, type: 'error'});
      return false;
    } finally { setBusy(false); }
  }

  function editDetails() {
    if (!nomination) return;
    setName(nomination.name); setDescription(nomination.description); setDetailsError(''); setDetailsOpen(true);
  }
  function editPosition(position?: NominationPosition) {
    setEditingPosition(position ?? null);
    setPositionName(position?.name ?? '');
    setShowRoleDetails(position?.showRoleDetails ?? false);
    setAboutRole(position?.aboutRole ?? '');
    setResponsibilities(position?.responsibilities.join('\n') ?? '');
    setPositionError('');
    setPositionOpen(true);
  }
  async function savePosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = positionName.trim();
    if (trimmed.length < 2 || trimmed.length > 120) {setPositionError('Use 2–120 characters for the position name.'); return;}
    if (nomination?.positions.some((position) => position.id !== editingPosition?.id && position.name.toLocaleLowerCase('en') === trimmed.toLocaleLowerCase('en'))) {setPositionError('A position with this name already exists.'); return;}
    if (aboutRole.length > 2000 || responsibilities.split('\n').length > 20 || responsibilities.split('\n').some((line) => line.length > 500)) {setPositionError('Keep role details under 2,000 characters and up to 20 responsibilities of 500 characters each.'); return;}
    setPositionError('');
    if (await mutate({type: 'position', positionId: editingPosition?.id, name: positionName,
      showRoleDetails, aboutRole, responsibilities: responsibilities.split('\n')})) setPositionOpen(false);
  }
  async function setStatus(status: NominationStatus, schedule?: {opensAt: string; closesAt: string}) {
    if (status === 'Scheduled' && (!schedule?.opensAt || !schedule?.closesAt || Date.parse(schedule.opensAt) <= Date.now() || Date.parse(schedule.closesAt) <= Date.parse(schedule.opensAt))) {setScheduleError('Choose a future opening time and a later closing time.'); return;}
    setScheduleError('');
    if (await mutate({type: 'status', status, ...schedule})) setScheduleOpen(false);
  }
  async function copyLink() {
    if (!nomination) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/nominate/${nomination.slug}`); toast({body: 'Nomination link copied.'}); }
    catch { toast({body: 'Could not copy the link.', type: 'error'}); }
  }
  async function selectFile(file: File | null) {
    setUploadFile(file); setUploadRecords([]); setUploadError('');
    if (!file) return;
    try { setUploadRecords(parseYouthCsv(await file.text())); }
    catch (cause) { setUploadError(cause instanceof Error ? cause.message : 'The CSV could not be read.'); }
  }
  async function upload(mode: 'add' | 'replace') {
    if (!uploadRecords.length) return;
    if (await mutate({type: 'records', mode, records: uploadRecords})) {
      setUploadFile(null); setUploadRecords([]);
    }
  }

  if (loading) return <ElectionEditorSkeleton />;
  if (!nomination) return <main className="admin-page"><Card padding={6}><Heading level={1}>Nomination unavailable</Heading><Text>{error || 'It may have been removed.'}</Text></Card></main>;
  const positionRows: PositionRow[] = nomination.positions.map((position) => ({id: position.id, name: position.name,
    about: position.showRoleDetails ? position.aboutRole || 'Shown, no description' : 'Hidden',
    responsibilities: position.showRoleDetails ? position.responsibilities.join(' · ') || 'None added' : 'Hidden'}));
  const nomineeRows: NomineeRow[] = nomineeEntries.map((entry: NominationEntry) => ({id: entry.id, nomineeName: entry.nomineeName,
    positionName: entry.positionName, submittedAt: entry.submittedAt}));
  const youthRows: YouthRow[] = youthRecords.map((record) => ({id: record.id, memberId: record.memberId, name: record.name,
    ageGroup: record.ageGroup, importedAt: record.importedAt}));
  const currentNomineesPage = nomineesPage;
  const currentYouthPage = youthPage;
  const canEdit = nomination.status === 'Draft';

  return <main className="admin-page event-editor-page">
    <Button label="Back to nominations" href="/admin/nominations" variant="ghost" icon={<ArrowLeftIcon />}>Back to nominations</Button>
    <header className="admin-page-header event-editor-header">
      <VStack gap={2}>
        <HStack gap={3} align="center" wrap="wrap"><Heading level={1}>{nomination.name}</Heading>
          <StatusDot label={nomination.status} variant={nomination.status === 'Published' ? 'success' : nomination.status === 'Scheduled' ? 'warning' : 'neutral'} /><Text type="supporting">{nomination.status}</Text></HStack>
        <Text color="secondary">{nomination.description || 'No description yet.'}</Text>
        {nomination.opensAt ? <Text type="supporting" color="secondary">Opens {formatDate(nomination.opensAt)}{nomination.closesAt ? ` · Closes ${formatDate(nomination.closesAt)}` : ''}</Text> : null}
      </VStack>
      <HStack gap={3} wrap="wrap" justify="end">
        <Button label="Copy nomination link" variant="secondary" icon={<CopySimpleIcon />} onClick={() => void copyLink()} />
        <Button label="Edit details" variant="secondary" onClick={editDetails}>Edit details</Button>
        <Button label={canEdit ? 'Preview nomination form' : 'Open nomination form'} href={`/nominate/${nomination.slug}`} target="_blank" rel="noopener noreferrer" variant="secondary" endContent={<ArrowUpRightIcon />}>{canEdit ? 'Preview form' : 'Form'}</Button>
        {canEdit ? <DropdownMenu button={{label: 'Publish', variant: 'primary'}} items={[
          {label: 'Publish now', onClick: () => void setStatus('Published')},
          {label: 'Schedule later', onClick: () => {setOpensAt(manilaInput(nomination.opensAt)); setClosesAt(manilaInput(nomination.closesAt)); setScheduleOpen(true);}},
        ]} presentation="adaptive" alignment="end" /> : null}
        {nomination.status === 'Published' || nomination.status === 'Scheduled' ? <Button label="Unpublish nomination" variant="destructive" onClick={() => void setStatus('Draft')}>Unpublish</Button> : null}
        {nomination.status !== 'Archived' ? <Button label="Archive nomination" variant="ghost" onClick={() => void setStatus('Archived')}>Archive</Button> : null}
        {nomination.status === 'Archived' ? <Button label="Restore to draft" variant="primary" onClick={() => void setStatus('Draft')}>Restore to draft</Button> : null}
      </HStack>
    </header>
    {error ? <Banner status="error" title="Change not saved" description={error} container="section" /> : null}
    <VStack gap={6}>
      <section className="event-overview" aria-label="Nomination summary">
        <article><Text type="supporting" color="secondary">Positions</Text><Text type="display-3">{nomination.positions.length}</Text></article>
        <article><Text type="supporting" color="secondary">Nominees</Text><Text type="display-3">{nomination.nomineeCount}</Text></article>
        <article><Text type="supporting" color="secondary">Youth Records</Text><Text type="display-3">{nomination.youthRecordCount}</Text></article>
        <article><Text type="supporting" color="secondary">Form link</Text><Text weight="semibold">/nominate/{nomination.slug}</Text></article>
      </section>
      <TabList value={tab} onChange={setTab} role="tablist" hasDivider size="lg">
        <Tab value="positions" label="Positions" panelId="nomination-positions-panel" />
        <Tab value="nominees" label="Nominees" panelId="nomination-nominees-panel" />
        <Tab value="youth" label="Youth Records" panelId="nomination-youth-panel" />
      </TabList>
    </VStack>
    {tab === 'positions' ? <section id="nomination-positions-panel" role="tabpanel" className="dashboard-section" aria-label="Nomination positions">
      <header className="section-heading-row"><VStack gap={1}><Heading level={2}>Positions</Heading><Text color="secondary">Choose which role details appear on the public form.</Text></VStack>
        <Button label="Create position" icon={<PlusIcon />} variant="primary" onClick={() => editPosition()} isDisabled={!canEdit} /></header>
      {!canEdit ? <Banner status="warning" title="Positions are locked" description="Unpublish or restore this nomination to edit its positions." container="section" /> : null}
      {positionRows.length ? <section className="table-surface" aria-label="Position list"><Table<PositionRow> data={positionRows} idKey="id" columns={[
        {key: 'name', header: 'Position', width: proportional(2)},
        {key: 'about', header: 'About the role', width: proportional(3)},
        {key: 'responsibilities', header: 'Responsibilities', width: proportional(3)},
        {key: 'id', header: 'Actions', width: pixel(190), renderCell: (row) => <HStack gap={2}><Button label={`Edit ${row.name}`} size="sm" variant="ghost" isDisabled={!canEdit} onClick={() => editPosition(nomination.positions.find((item) => item.id === row.id))}>Edit</Button><Button label={`Delete ${row.name}`} size="sm" variant="ghost" icon={<TrashIcon />} isDisabled={!canEdit} onClick={() => setRemoveTarget({type: 'delete-position', id: row.id, name: row.name})}>Remove</Button></HStack>},
      ]} /></section> : <Card padding={6}><EmptyState title="No positions yet" description="Create the first position to build the nomination form." /></Card>}
    </section> : null}
    {tab === 'nominees' ? <section id="nomination-nominees-panel" role="tabpanel" className="dashboard-section" aria-label="Nominee list">
      <header className="section-heading-row"><VStack gap={1}><Heading level={2}>Nominees</Heading><Text color="secondary">Each submitted nomination appears as a separate row.</Text></VStack></header>
      {collectionError ? <Banner status="error" title="Nominees could not be loaded" description={collectionError} container="section" /> : null}
      {collectionLoading ? <Skeleton width="100%" height="var(--spacing-12)" index={0} /> : nomineeRows.length ? <section className="table-surface" aria-label="Nominees"><Table<NomineeRow> data={nomineeRows} idKey="id" rowIndexStart={(currentNomineesPage - 1) * PAGE_SIZE + 1} rowCount={nomineeTotal} columns={[
        {key: 'nomineeName', header: 'Name', width: proportional(2)},
        {key: 'positionName', header: 'Position nominated', width: proportional(2)},
        {key: 'submittedAt', header: 'Submitted at', width: proportional(2), renderCell: (row) => formatDate(row.submittedAt)},
        {key: 'id', header: 'Action', width: pixel(120), renderCell: (row) => <Button label={`Remove ${row.nomineeName}`} size="sm" variant="ghost" icon={<TrashIcon />} onClick={() => setRemoveTarget({type: 'delete-nominee', id: row.id, name: row.nomineeName})}>Remove</Button>},
      ]} />{nomineeTotal > PAGE_SIZE ? <footer className="table-pagination"><Pagination page={currentNomineesPage} onChange={setNomineesPage} totalItems={nomineeTotal} pageSize={PAGE_SIZE} variant="pages" size="sm" label="Nominee pages" /></footer> : null}</section> : !collectionError ? <Card padding={6}><EmptyState title="No nominees yet" description="Submitted nominations will appear here." /></Card> : null}
    </section> : null}
    {tab === 'youth' ? <section id="nomination-youth-panel" role="tabpanel" className="dashboard-section" aria-label="Youth Records">
      <header className="section-heading-row"><VStack gap={1}><Heading level={2}>Youth Records</Heading><Text color="secondary">Upload a CSV for name suggestions on this nomination form.</Text></VStack></header>
      <VStack gap={4}>
        {!canEdit ? <Banner status="warning" title="Youth Record uploads are locked" description="Unpublish or restore this nomination to change its Youth Records." container="section" /> : null}
        <FileInput label="Upload Youth Records" description="CSV columns: member_id, first_name, last_name, gender, age, birth_date, age_group." value={uploadFile}
          onChange={(file) => void selectFile(file as File | null)} accept=".csv,text/csv" maxSize={2 * 1024 * 1024} mode="input" width="100%" isDisabled={!canEdit} />
        {uploadError ? <Banner status="error" title="CSV needs attention" description={uploadError} container="section" /> : null}
        {uploadRecords.length ? <HStack gap={3} align="center" wrap="wrap"><Text>{uploadRecords.length} records ready</Text>
          <Button label="Add or update records" variant="primary" onClick={() => void upload('add')} isLoading={busy} />
          <Button label="Replace all records" variant="secondary" onClick={() => void upload('replace')} isDisabled={busy} /></HStack> : null}
        {collectionError ? <Banner status="error" title="Youth Records could not be loaded" description={collectionError} container="section" /> : null}
        {collectionLoading ? <Skeleton width="100%" height="var(--spacing-12)" index={0} /> : youthRows.length ? <section className="table-surface" aria-label="Youth Records table"><Table<YouthRow> data={youthRows} idKey="id" rowIndexStart={(currentYouthPage - 1) * PAGE_SIZE + 1} rowCount={youthTotal} columns={[
          {key: 'memberId', header: 'Member ID', width: proportional(1)},
          {key: 'name', header: 'Name', width: proportional(2)},
          {key: 'ageGroup', header: 'Age group', width: proportional(1)},
          {key: 'importedAt', header: 'Imported at', width: proportional(2), renderCell: (row) => formatDate(row.importedAt)},
        ]} />{youthTotal > PAGE_SIZE ? <footer className="table-pagination"><Pagination page={currentYouthPage} onChange={setYouthPage} totalItems={youthTotal} pageSize={PAGE_SIZE} variant="pages" size="sm" label="Youth Record pages" /></footer> : null}</section> : !collectionError ? <Card padding={6}><EmptyState title="No Youth Records yet" description="Upload a CSV to provide suggestions for the public form." /></Card> : null}
      </VStack>
    </section> : null}

    <Dialog isOpen={detailsOpen} onOpenChange={setDetailsOpen} purpose="form" width={560}>
      <Layout defaultHasDividers header={<DialogHeader title="Edit nomination details" onOpenChange={setDetailsOpen} />}
        content={<LayoutContent><form id="nomination-details-form" onSubmit={(event) => {event.preventDefault(); if (name.trim().length < 2 || name.trim().length > 160 || description.length > 2000) {setDetailsError('Use 2–160 characters for the name and up to 2,000 for the description.'); return;} setDetailsError(''); void mutate({type: 'details', name, description}).then((saved) => {if (saved) setDetailsOpen(false);});}}><FormLayout direction="vertical" defaultOptionality="required">
          <TextInput label="Nomination name" value={name} onChange={(value) => {setName(value); setDetailsError('');}} width="100%" isRequired status={detailsError ? {type: 'error', message: detailsError} : undefined} />
          <TextArea label="Description" value={description} onChange={(value) => {setDescription(value); setDetailsError('');}} width="100%" isOptional />
        </FormLayout></form></LayoutContent>}
        footer={<LayoutFooter><HStack gap={3} justify="end"><Button label="Cancel" variant="ghost" onClick={() => setDetailsOpen(false)} /><Button label="Save details" type="submit" form="nomination-details-form" variant="primary" isLoading={busy} /></HStack></LayoutFooter>} />
    </Dialog>
    <Dialog isOpen={positionOpen} onOpenChange={setPositionOpen} purpose="form" width={620}>
      <Layout defaultHasDividers header={<DialogHeader title={editingPosition ? 'Edit position' : 'Create position'} onOpenChange={setPositionOpen} />}
        content={<LayoutContent><form id="nomination-position-form" onSubmit={(event) => void savePosition(event)}><VStack gap={4}>
          <TextInput label="Position name" value={positionName} onChange={(value) => {setPositionName(value); setPositionError('');}} isRequired width="100%" status={positionError ? {type: 'error', message: positionError} : undefined} />
          <CheckboxInput label="Display about the role and responsibilities" description="These details will appear on the public nomination form." value={showRoleDetails} onChange={setShowRoleDetails} />
          {showRoleDetails ? <FormLayout direction="vertical" defaultOptionality="optional"><TextArea label="About the role" value={aboutRole} onChange={setAboutRole} width="100%" />
            <TextArea label="Responsibilities" description="Enter one responsibility per line." value={responsibilities} onChange={setResponsibilities} width="100%" /></FormLayout> : null}
        </VStack></form></LayoutContent>}
        footer={<LayoutFooter><HStack gap={3} justify="end"><Button label="Cancel" variant="ghost" onClick={() => setPositionOpen(false)} /><Button label="Save position" type="submit" form="nomination-position-form" variant="primary" isLoading={busy} /></HStack></LayoutFooter>} />
    </Dialog>
    <Dialog isOpen={scheduleOpen} onOpenChange={setScheduleOpen} purpose="form" width={560}>
      <Layout defaultHasDividers header={<DialogHeader title="Schedule nomination" subtitle="Times are in Philippine time." onOpenChange={setScheduleOpen} />}
        content={<LayoutContent><form id="nomination-schedule-form" onSubmit={(event) => {event.preventDefault(); void setStatus('Scheduled', {opensAt: toIso(opensAt), closesAt: toIso(closesAt)});}}><FormLayout direction="vertical" defaultOptionality="required">
          <DateTimeInput label="Opens at" value={opensAt} onChange={(value) => {setOpensAt(value); setScheduleError('');}} isRequired width="100%" status={scheduleError ? {type: 'error', message: scheduleError} : undefined} />
          <DateTimeInput label="Closes at" value={closesAt} onChange={(value) => {setClosesAt(value); setScheduleError('');}} isRequired width="100%" />
          {scheduleError ? <Banner status="error" title="Schedule needs attention" description={scheduleError} container="section" /> : null}
        </FormLayout></form></LayoutContent>}
        footer={<LayoutFooter><HStack gap={3} justify="end"><Button label="Cancel" variant="ghost" onClick={() => setScheduleOpen(false)} /><Button label="Schedule" type="submit" form="nomination-schedule-form" variant="primary" isLoading={busy} /></HStack></LayoutFooter>} />
    </Dialog>
    <AlertDialog isOpen={Boolean(removeTarget)} onOpenChange={(open) => {if (!open) setRemoveTarget(null);}} title={`Remove ${removeTarget?.name ?? 'item'}?`}
      description={removeTarget?.type === 'delete-position' ? 'This also removes all submitted nominees for this position.' : 'This removes this nominee row from the nomination.'} actionLabel="Remove" actionVariant="destructive"
      onAction={() => {if (!removeTarget) return; void mutate({type: removeTarget.type, [removeTarget.type === 'delete-position' ? 'positionId' : 'nomineeId']: removeTarget.id}).then((saved) => {if (saved) setRemoveTarget(null);});}} />
  </main>;
}
