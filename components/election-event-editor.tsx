'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArchiveIcon} from '@phosphor-icons/react/Archive';
import {CopySimpleIcon} from '@phosphor-icons/react/CopySimple';
import {PencilSimpleIcon} from '@phosphor-icons/react/PencilSimple';
import {TrashIcon} from '@phosphor-icons/react/Trash';
import {ListChecksIcon} from '@phosphor-icons/react/ListChecks';
import {UserCircleDashedIcon} from '@phosphor-icons/react/UserCircleDashed';
import {UserListIcon} from '@phosphor-icons/react/UserList';
import {UploadSimpleIcon} from '@phosphor-icons/react/UploadSimple';
import {AlertDialog} from '@astryxdesign/core/AlertDialog';
import {Avatar} from '@astryxdesign/core/Avatar';
import {Badge} from '@astryxdesign/core/Badge';
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
import {HStack, Layout, LayoutContent, LayoutFooter, StackItem, VStack} from '@astryxdesign/core/Layout';
import {Icon} from '@astryxdesign/core/Icon';
import {Pagination} from '@astryxdesign/core/Pagination';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useToast} from '@astryxdesign/core/Toast';
import {Typeahead, TypeaheadItem, type SearchSource, type SearchableItem} from '@astryxdesign/core/Typeahead';
import {parseVoters} from '@/lib/csv';
import {ElectionEditorSkeleton} from '@/components/loading-states';
import {fetchElection, fetchVoters, removeElection, saveElection} from '@/lib/api';
import {
  eligibleVotersForEvent,
  type ElectionEvent,
  type ElectionStatus,
  type EligibleVoter,
  type Nominee,
  type Position,
} from '@/lib/election-data';

interface VoterItem extends SearchableItem<{voter: EligibleVoter}> {
  auxiliaryData: {voter: EligibleVoter};
}

interface VoterRow extends Record<string, unknown> {
  memberId: string;
  name: string;
  ageGroup: string;
  eligible: 'Yes' | 'No';
}

type UploadStatus = {type: 'error' | 'success'; message: string};
type CandidateTarget = {positionId: string; nomineeId: string; name: string};
type PositionTarget = {positionId: string; name: string; candidateCount: number};
type PositionErrors = {name?: string; description?: string; responsibilities?: string};
type StatusAction = 'publish' | 'unpublish' | 'archive' | 'restore';
type PublicationIntent = 'publish' | 'schedule';
type VoterUploadMode = 'add' | 'replace';
const VOTERS_PAGE_SIZE = 10;

function toVoterItem(voter: EligibleVoter): VoterItem {
  return {id: voter.memberId, label: voter.name, auxiliaryData: {voter}};
}

function voterSource(voters: EligibleVoter[]): SearchSource<VoterItem> {
  const items = voters.map(toVoterItem);
  return {
    search: (query) => {
      const normalized = query.toLocaleLowerCase('en');
      return items.filter((item) => `${item.label} ${item.id} ${item.auxiliaryData.voter.ageGroup}`.toLocaleLowerCase('en').includes(normalized));
    },
    bootstrap: () => items.slice(0, 10),
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function statusVariant(status: ElectionEvent['status']) {
  if (status === 'Open' || status === 'Published') return 'success' as const;
  if (status === 'Scheduled') return 'warning' as const;
  return 'neutral' as const;
}

function isDeletionLocked(status: ElectionStatus) {
  return status === 'Scheduled' || status === 'Open' || status === 'Published';
}

function parseElectionDateTime(value: ISODateTimeString) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const dateTime = value.length === 16 ? `${value}:00` : value;
  return new Date(hasTimeZone ? value : `${dateTime}+08:00`);
}

function currentManilaDateTime() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) as ISODateTimeString;
}

function formatElectionDate(date: string) {
  if (!date) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-PH', {dateStyle: 'medium'}).format(new Date(`${date}T00:00:00`));
}

function formatElectionDateTime(dateTime: string) {
  if (!dateTime) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(dateTime));
}

export function ElectionEventEditor({eventId}: {eventId: string}) {
  const router = useRouter();
  const [election, setElection] = useState<ElectionEvent | null>(null);
  const [voters, setVoters] = useState<EligibleVoter[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [tab, setTab] = useState('positions');
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<PositionTarget | null>(null);
  const [positionErrors, setPositionErrors] = useState<PositionErrors>({});
  const [candidatePositionId, setCandidatePositionId] = useState<string | null>(null);
  const [positionName, setPositionName] = useState('');
  const [aboutRole, setAboutRole] = useState('');
  const [responsibilities, setResponsibilities] = useState(['']);
  const [abstainEnabled, setAbstainEnabled] = useState(true);
  const [selectedVoter, setSelectedVoter] = useState<VoterItem | null>(null);
  const [candidateImage, setCandidateImage] = useState<File | null>(null);
  const [voterUploadStatus, setVoterUploadStatus] = useState<UploadStatus>();
  const [isReplaceVotersOpen, setIsReplaceVotersOpen] = useState(false);
  const [votersPage, setVotersPage] = useState(1);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<StatusAction | null>(null);
  const [publicationIntent, setPublicationIntent] = useState<PublicationIntent | null>(null);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleStep, setScheduleStep] = useState<'edit' | 'confirm'>('edit');
  const [scheduleOpensAt, setScheduleOpensAt] = useState<ISODateTimeString>();
  const [scheduleClosesAt, setScheduleClosesAt] = useState<ISODateTimeString>();
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [eventBallotSlug, setEventBallotSlug] = useState('');
  const [eventEditError, setEventEditError] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<CandidateTarget | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<CandidateTarget | null>(null);
  const [candidateVoter, setCandidateVoter] = useState<VoterItem | null>(null);
  const [candidateEditImage, setCandidateEditImage] = useState<File | null>(null);
  const addVotersInputRef = useRef<HTMLInputElement>(null);
  const replaceVotersInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    void Promise.all([fetchElection(eventId), fetchVoters(eventId)])
      .then(([loadedElection, loadedVoters]) => {
        setElection({...loadedElection, eligibleVoterIds: loadedVoters.filter((voter) => voter.eligible).map((voter) => voter.memberId)});
        setVoters(loadedVoters);
      })
      .catch(() => setElection(null))
      .finally(() => setIsReady(true));
  }, [eventId]);

  const eventVoters = useMemo(
    () => election ? eligibleVotersForEvent(election, voters) : [],
    [election, voters],
  );
  const eligibleIds = useMemo(() => new Set(eventVoters.map((voter) => voter.memberId)), [eventVoters]);
  const voterRows = useMemo<VoterRow[]>(() => voters.map((voter) => ({
    ...voter,
    eligible: eligibleIds.has(voter.memberId) ? 'Yes' : 'No',
  })), [eligibleIds, voters]);
  const searchSource = useMemo(() => voterSource(eventVoters), [eventVoters]);
  const votersPageStart = (votersPage - 1) * VOTERS_PAGE_SIZE;
  const visibleVoterRows = voterRows.slice(votersPageStart, votersPageStart + VOTERS_PAGE_SIZE);

  function persist(updated: ElectionEvent, nextVoters?: EligibleVoter[]) {
    setElection(updated);
    if (nextVoters) setVoters(nextVoters);
    void saveElection(updated, nextVoters).then(setElection).catch((cause) => {
      toast({body: cause instanceof Error ? cause.message : 'The election could not be saved.', type: 'error', uniqueID: 'election-save-error'});
    });
  }

  function openEventEditor() {
    if (!election) return;
    setEventTitle(election.title);
    setEventDescription(election.description);
    setEventBallotSlug(election.ballotSlug);
    setEventEditError(null);
    setIsEditingEvent(true);
  }

  function updateEventDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!election) return;
    if (!eventTitle.trim() || !eventDescription.trim() || !eventBallotSlug.trim()) {
      setEventEditError('Complete every election detail before saving.');
      return;
    }
    const ballotSlug = eventBallotSlug.trim().toLocaleLowerCase('en').replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '');
    if (!ballotSlug) {
      setEventEditError('Use at least one letter or number in the voting link ending.');
      return;
    }
    const updated = {
      ...election,
      title: eventTitle.trim(),
      description: eventDescription.trim(),
      ballotSlug,
    };
    persist(updated);
    setIsEditingEvent(false);
    toast({body: `${updated.title} is up to date.`, uniqueID: 'election-event-updated'});
  }

  function openScheduleDialog() {
    if (!election) return;
    setScheduleOpensAt(election.opensAt ? election.opensAt as ISODateTimeString : undefined);
    setScheduleClosesAt(election.closesAt ? election.closesAt as ISODateTimeString : undefined);
    setScheduleError(null);
    setScheduleStep('edit');
    setIsScheduleDialogOpen(true);
  }

  function requestPublication(intent: PublicationIntent) {
    if (!election) return;
    const hasNoPositions = election.positions.length === 0;
    const hasPositionsWithoutCandidates = election.positions.some((position) => position.nominees.length === 0);
    if (!eventVoters.length || hasNoPositions || hasPositionsWithoutCandidates) {
      setPublicationIntent(intent);
      return;
    }

    if (intent === 'publish') {
      setPendingStatusAction('publish');
    } else {
      openScheduleDialog();
    }
  }

  function openReadinessTab(nextTab: 'positions' | 'eligible-voters') {
    setPublicationIntent(null);
    setTab(nextTab);
  }

  function closeScheduleDialog() {
    setIsScheduleDialogOpen(false);
    setScheduleError(null);
    setScheduleStep('edit');
  }

  function reviewSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!scheduleOpensAt || !scheduleClosesAt) {
      setScheduleError('Choose when voting opens and closes.');
      return;
    }

    const opensAt = parseElectionDateTime(scheduleOpensAt);
    const closesAt = parseElectionDateTime(scheduleClosesAt);
    if (Number.isNaN(opensAt.getTime()) || Number.isNaN(closesAt.getTime())) {
      setScheduleError('Enter a valid opening and closing date and time.');
      return;
    }
    if (opensAt.getTime() <= Date.now()) {
      setScheduleError('Choose an opening date and time in the future.');
      return;
    }
    if (closesAt <= opensAt) {
      setScheduleError('Choose a closing date and time after voting opens.');
      return;
    }

    setScheduleError(null);
    setScheduleStep('confirm');
  }

  function confirmSchedule() {
    if (!election || !scheduleOpensAt || !scheduleClosesAt) return;
    persist({...election, status: 'Scheduled', electionDate: scheduleOpensAt.slice(0, 10), opensAt: scheduleOpensAt, closesAt: scheduleClosesAt});
    closeScheduleDialog();
    toast({body: `${election.title} is scheduled to open ${formatElectionDateTime(scheduleOpensAt)}.`, uniqueID: 'election-scheduled'});
  }

  function confirmStatusChange() {
    if (!election || !pendingStatusAction) return;
    const nextStatus: ElectionStatus = pendingStatusAction === 'publish'
      ? 'Open'
      : pendingStatusAction === 'archive'
        ? 'Archived'
        : 'Draft';
    const messages: Record<StatusAction, string> = {
      publish: `${election.title} is now open for voting.`,
      unpublish: `${election.title} is now a draft.`,
      archive: `${election.title} was archived.`,
      restore: `${election.title} was restored as a draft.`,
    };
    const now = new Date();
    const closesAt = election.closesAt && new Date(election.closesAt) > now
      ? election.closesAt
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    persist({
      ...election,
      status: nextStatus,
      ...(pendingStatusAction === 'publish' ? {opensAt: now.toISOString(), closesAt, electionDate: now.toISOString().slice(0, 10)} : {}),
    });
    toast({body: messages[pendingStatusAction], uniqueID: `election-${pendingStatusAction}`});
    setPendingStatusAction(null);
  }

  async function deleteEvent() {
    if (!election) return;
    if (isDeletionLocked(election.status)) {
      toast({body: `This election can’t be deleted while it is ${election.status.toLocaleLowerCase('en')}.`, type: 'error', uniqueID: 'election-delete-blocked'});
      setIsDeletingEvent(false);
      return;
    }
    await removeElection(election.id);
    setIsDeletingEvent(false);
    router.push('/admin');
  }

  function openCandidateEditor(positionId: string, nominee: Nominee) {
    setEditingCandidate({positionId, nomineeId: nominee.id, name: nominee.name});
    const voter = eventVoters.find((item) => item.name === nominee.name);
    setCandidateVoter(voter ? toVoterItem(voter) : toVoterItem({
      memberId: nominee.id,
      name: nominee.name,
      ageGroup: nominee.ageGroup ?? nominee.profile,
    }));
    setCandidateEditImage(null);
  }

  async function updateCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!election || !editingCandidate || !candidateVoter) return;
    const voter = candidateVoter.auxiliaryData.voter;
    const position = election.positions.find((item) => item.id === editingCandidate.positionId);
    const isDuplicate = position?.nominees.some((nominee) => (
      nominee.id !== editingCandidate.nomineeId && nominee.name === voter.name
    ));
    if (isDuplicate) {
      toast({body: `${voter.name} is already a candidate for ${position?.name}.`, type: 'error', uniqueID: 'candidate-update-duplicate'});
      return;
    }
    const imageUrl = candidateEditImage ? await fileToDataUrl(candidateEditImage) : undefined;
    const updatedPositions = election.positions.map((position) => position.id === editingCandidate.positionId ? {
      ...position,
      nominees: position.nominees.map((nominee) => nominee.id === editingCandidate.nomineeId ? {
        ...nominee,
        name: voter.name,
        profile: voter.ageGroup,
        ageGroup: voter.ageGroup,
        imageUrl: imageUrl ?? nominee.imageUrl,
      } : nominee),
    } : position);
    persist({...election, positions: updatedPositions});
    setEditingCandidate(null);
    setCandidateVoter(null);
    setCandidateEditImage(null);
    toast({body: `${voter.name}’s candidate details were saved.`, uniqueID: 'candidate-updated'});
  }

  function deleteCandidate() {
    if (!election || !deletingCandidate) return;
    if (isDeletionLocked(election.status)) {
      toast({body: `Candidates can’t be removed while this election is ${election.status.toLocaleLowerCase('en')}.`, type: 'error', uniqueID: 'candidate-delete-blocked'});
      setDeletingCandidate(null);
      return;
    }
    const updatedPositions = election.positions.map((position) => position.id === deletingCandidate.positionId ? {
      ...position,
      nominees: position.nominees.filter((nominee) => nominee.id !== deletingCandidate.nomineeId),
    } : position);
    persist({...election, positions: updatedPositions});
    toast({body: `${deletingCandidate.name} was removed from this ballot.`, uniqueID: 'candidate-removed'});
    setDeletingCandidate(null);
  }

  function resetPositionForm() {
    setPositionName('');
    setAboutRole('');
    setResponsibilities(['']);
    setAbstainEnabled(true);
    setEditingPositionId(null);
    setPositionErrors({});
  }

  function closePositionDialog() {
    resetPositionForm();
    setIsPositionDialogOpen(false);
  }

  function openPositionCreator() {
    resetPositionForm();
    setIsPositionDialogOpen(true);
  }

  function openPositionEditor(position: Position) {
    setPositionName(position.name);
    setAboutRole(position.description);
    setResponsibilities(position.responsibilities.length ? position.responsibilities : ['']);
    setAbstainEnabled(position.abstainEnabled);
    setEditingPositionId(position.id);
    setPositionErrors({});
    setIsPositionDialogOpen(true);
  }

  function savePosition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!election) return;

    const name = positionName.trim();
    const description = aboutRole.trim();
    const responsibilityItems = responsibilities.map((item) => item.trim()).filter(Boolean);
    const isDuplicateName = election.positions.some((position) => (
      position.id !== editingPositionId && position.name.toLocaleLowerCase('en') === name.toLocaleLowerCase('en')
    ));
    const errors: PositionErrors = {};

    if (!name) errors.name = 'Enter the position name.';
    else if (isDuplicateName) errors.name = 'A position with this name is already on the ballot.';
    if (!description) errors.description = 'Explain what this position does and how the person will serve.';
    if (!responsibilityItems.length) errors.responsibilities = 'Add at least one responsibility.';

    if (Object.keys(errors).length) {
      setPositionErrors(errors);
      return;
    }

    const existingPosition = election.positions.find((position) => position.id === editingPositionId);
    const position: Position = {
      id: existingPosition?.id ?? crypto.randomUUID(),
      name,
      group: existingPosition?.group ?? 'General',
      description,
      responsibilities: responsibilityItems,
      abstainEnabled,
      nominees: existingPosition?.nominees ?? [],
    };

    const updatedPositions = existingPosition
      ? election.positions.map((item) => item.id === existingPosition.id ? position : item)
      : [...election.positions, position];
    try {
      persist({...election, positions: updatedPositions});
      closePositionDialog();
      toast({
        body: existingPosition ? `${position.name} was updated.` : `${position.name} was added to the ballot.`,
        uniqueID: existingPosition ? 'position-updated' : 'position-added',
      });
    } catch {
      toast({body: 'We couldn’t save this position. Your changes are still here—please try again.', type: 'error', uniqueID: 'position-save-error'});
    }
  }

  function deletePosition() {
    if (!election || !deletingPosition) return;
    if (isDeletionLocked(election.status)) {
      toast({body: `Positions can’t be deleted while ${election.title} is ${election.status.toLocaleLowerCase('en')}.`, type: 'error', uniqueID: 'position-delete-blocked'});
      setDeletingPosition(null);
      return;
    }

    persist({...election, positions: election.positions.filter((position) => position.id !== deletingPosition.positionId)});
    if (candidatePositionId === deletingPosition.positionId) setCandidatePositionId(null);
    toast({body: `${deletingPosition.name} was deleted from the ballot.`, uniqueID: 'position-deleted'});
    setDeletingPosition(null);
  }

  async function addCandidate(event: FormEvent<HTMLFormElement>, position: Position) {
    event.preventDefault();
    if (!election || !selectedVoter) return;
    const voter = selectedVoter.auxiliaryData.voter;
    if (position.nominees.some((nominee) => nominee.name === voter.name)) {
      toast({body: `${voter.name} is already a candidate for ${position.name}.`, type: 'error', uniqueID: 'candidate-add-duplicate'});
      return;
    }
    const imageUrl = candidateImage ? await fileToDataUrl(candidateImage) : undefined;
    const updatedPositions = election.positions.map((item) => item.id === position.id ? {
      ...item,
      nominees: [...item.nominees, {
        id: crypto.randomUUID(),
        name: voter.name,
        profile: voter.ageGroup,
        ageGroup: voter.ageGroup,
        imageUrl,
      }],
    } : item);
    persist({...election, positions: updatedPositions});
    setSelectedVoter(null);
    setCandidateImage(null);
    setCandidatePositionId(null);
    toast({body: `${voter.name} was added as a candidate for ${position.name}.`, uniqueID: 'candidate-added'});
  }

  async function uploadVoterFile(file: File | null, mode: VoterUploadMode) {
    setVoterUploadStatus(undefined);
    if (!file || !election) return;
    if (election.status === 'Open' || election.status === 'Published') {
      setVoterUploadStatus({type: 'error', message: 'Unpublish this election before changing its eligible voter data.'});
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setVoterUploadStatus({type: 'error', message: 'Choose a CSV smaller than 2 MB.'});
      return;
    }

    const records = parseVoters(await file.text());
    const importedVoters: EligibleVoter[] = records.filter((record) => record.member_id?.trim()).map((record) => ({
      memberId: record.member_id.trim(),
      firstName: record.first_name?.trim(),
      lastName: record.last_name?.trim(),
      name: `${record.first_name?.trim() ?? ''} ${record.last_name?.trim() ?? ''}`.trim(),
      gender: record.gender?.trim(),
      age: Number(record.age),
      birthDate: new Date(record.birth_date).toISOString().slice(0, 10),
      ageGroup: record.age_group?.trim(),
    }));
    if (!importedVoters.length) {
      setVoterUploadStatus({type: 'error', message: 'We couldn’t find a member_id column with voter records. Check the CSV and try again.'});
      return;
    }
    const mergedVoters = mode === 'add'
      ? [...voters.filter((voter) => !new Set(importedVoters.map((item) => item.memberId)).has(voter.memberId)), ...importedVoters]
      : importedVoters;
    const eligibleVoterIds = mergedVoters.map((voter) => voter.memberId);
    persist({...election, eligibleVoterIds, eligibleVoters: eligibleVoterIds.length}, mergedVoters);
    setVotersPage(1);
    const result = mode === 'add'
      ? `${importedVoters.length} eligible voter${importedVoters.length === 1 ? '' : 's'} imported.`
      : `Eligible voter list replaced with ${eligibleVoterIds.length} voter${eligibleVoterIds.length === 1 ? '' : 's'}.`;
    setVoterUploadStatus({type: 'success', message: result});
    toast({body: mode === 'add' ? 'Eligible voters added.' : 'Eligible voter list replaced.', uniqueID: 'eligible-voters-imported'});
  }

  async function copyVoteLink() {
    if (!election) return;
    const url = `${window.location.origin}/vote/${election.ballotSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({body: 'Voting link copied.', uniqueID: 'vote-link-copied'});
    } catch {
      toast({body: 'We couldn’t copy the voting link. Try again, or copy it from the election summary.', type: 'error', uniqueID: 'vote-link-copy-error'});
    }
  }

  if (!isReady) return <ElectionEditorSkeleton />;
  if (!election) {
    return (
      <main className="admin-page">
        <Card padding={8}>
          <VStack gap={2}>
            <Heading level={1}>We couldn’t find this election</Heading>
            <Text color="secondary">It may have been deleted or the link may be incorrect.</Text>
          </VStack>
        </Card>
      </main>
    );
  }

  const isOpen = election.status === 'Open' || election.status === 'Published';
  const ballotLabel = isOpen ? 'View ballot' : 'Preview ballot';
  const statusLabel = election.status === 'Published' ? 'Open' : election.status;
  const deletionLocked = isDeletionLocked(election.status);
  const positionsWithoutCandidates = election.positions.filter((position) => position.nominees.length === 0);
  const publicationIssues = [
    ...(!eventVoters.length ? ['Add at least one eligible voter.'] : []),
    ...(!election.positions.length ? ['Add at least one position.'] : []),
    ...positionsWithoutCandidates.map((position) => `Add at least one candidate for ${position.name}.`),
  ];
  const hasPositionReadinessIssue = election.positions.length === 0 || positionsWithoutCandidates.length > 0;
  const statusDialogCopy: Record<StatusAction, {title: string; description: string; actionLabel: string}> = {
    publish: {
      title: 'Publish this election now?',
      description: 'The status will change to Open and voting can begin immediately.',
      actionLabel: 'Publish now',
    },
    unpublish: {
      title: 'Unpublish this election?',
      description: election.status === 'Scheduled'
        ? 'The voting schedule will be removed and the election will return to Draft.'
        : 'Voting will stop and the election will return to Draft.',
      actionLabel: 'Unpublish',
    },
    archive: {
      title: 'Archive this election?',
      description: 'The election will move to Archived. You can restore it to Draft later.',
      actionLabel: 'Archive election',
    },
    restore: {
      title: 'Restore this election?',
      description: 'The election will return to Draft so you can update and publish it again.',
      actionLabel: 'Restore to draft',
    },
  };
  const activeStatusDialog = pendingStatusAction ? statusDialogCopy[pendingStatusAction] : null;

  return (
    <main className="admin-page event-editor-page">
      <Button label="Back to elections" href="/admin" variant="ghost" icon={<ArrowLeftIcon />}>Back to elections</Button>

      <header className="admin-page-header event-editor-header">
        <VStack gap={2}>
          <HStack gap={3} align="center" wrap="wrap">
            <Heading level={1}>{election.title}</Heading>
            <Badge variant={statusVariant(election.status)} label={statusLabel} />
          </HStack>
          <Text color="secondary">{election.description}</Text>
          {election.opensAt && election.closesAt ? (
            <HStack className="event-schedule" gap={4} align="center" wrap="wrap">
              <Text type="supporting" color="secondary">Election day: {formatElectionDate(election.electionDate)}</Text>
              <Text type="supporting" color="secondary">Opens: {formatElectionDateTime(election.opensAt)}</Text>
              <Text type="supporting" color="secondary">Closes: {formatElectionDateTime(election.closesAt)}</Text>
            </HStack>
          ) : <Text type="supporting" color="secondary">Voting schedule not set</Text>}
        </VStack>
        <HStack gap={3}>
          <Button label="Copy voting link" variant="secondary" icon={<CopySimpleIcon />} onClick={() => void copyVoteLink()} />
          <DropdownMenu
            button={{label: 'Edit event', variant: 'secondary'}}
            items={[
              {label: 'Edit details', icon: PencilSimpleIcon, onClick: openEventEditor},
              {type: 'divider'},
              ...(election.status !== 'Archived' ? [{
                label: 'Archive',
                description: 'Move this election out of the active list.',
                icon: ArchiveIcon,
                onClick: () => setPendingStatusAction('archive'),
              } as const, {type: 'divider'} as const] : []),
              {
                label: 'Delete election',
                description: deletionLocked ? `Unavailable while the election is ${election.status.toLocaleLowerCase('en')}.` : undefined,
                icon: TrashIcon,
                variant: 'destructive',
                isDisabled: deletionLocked,
                onClick: () => setIsDeletingEvent(true),
              },
            ]}
            presentation="adaptive"
            alignment="end"
          />
          <Button label={`${ballotLabel}: ${election.title}`} href={`/vote/${election.ballotSlug}`} variant="secondary">{ballotLabel}</Button>
          {election.status === 'Draft' ? (
            <DropdownMenu
              button={{label: 'Publish', variant: 'primary'}}
              items={[
                {label: 'Publish now', description: 'Open voting immediately.', onClick: () => requestPublication('publish')},
                {label: 'Schedule later', description: 'Choose a future opening and closing time.', onClick: () => requestPublication('schedule')},
              ]}
              presentation="adaptive"
              alignment="end"
            />
          ) : null}
          {election.status === 'Scheduled' || isOpen ? (
            <Button label="Unpublish election" variant="primary" onClick={() => setPendingStatusAction('unpublish')}>Unpublish</Button>
          ) : null}
          {election.status === 'Archived' ? (
            <Button label="Restore election to draft" variant="primary" onClick={() => setPendingStatusAction('restore')}>Restore</Button>
          ) : null}
        </HStack>
      </header>

      <section className="event-overview" aria-label="Election event summary">
        <article><Text type="supporting" color="secondary">Eligible voters</Text><Text type="display-3" hasTabularNumbers>{eventVoters.length}</Text></article>
        <article><Text type="supporting" color="secondary">Positions</Text><Text type="display-3" hasTabularNumbers>{election.positions.length}</Text></article>
        <article><Text type="supporting" color="secondary">Candidates</Text><Text type="display-3" hasTabularNumbers>{election.positions.reduce((total, position) => total + position.nominees.length, 0)}</Text></article>
        <article><Text type="supporting" color="secondary">Voting link</Text><Text weight="semibold">/vote/{election.ballotSlug}</Text></article>
      </section>

      <TabList value={tab} onChange={setTab} role="tablist" hasDivider size="lg">
        <Tab value="positions" label="Positions" panelId="positions-panel" />
        <Tab value="eligible-voters" label="Eligible voters" panelId="eligible-voters-panel" />
      </TabList>

      {tab === 'positions' ? (
        <section id="positions-panel" role="tabpanel" className="dashboard-section" aria-label="Election positions">
          <header className="section-heading-row">
            <VStack gap={1}>
              <Heading level={2}>Positions and candidates</Heading>
              <Text color="secondary">Saved changes appear on the voter ballot right away.</Text>
            </VStack>
            <Button label="Add position" variant="primary" onClick={openPositionCreator} />
          </header>

          {!eventVoters.length ? (
            <Banner status="warning" title="Add eligible voters first" description="Candidates must come from this election’s voter list. Open Eligible voters to upload the list." container="section" />
          ) : null}

          <VStack gap={5}>
            {election.positions.map((position) => (
              <Card key={position.id} padding={6} className="position-card">
                <VStack gap={5}>
                  <HStack gap={4} align="start" justify="between">
                    <VStack gap={2}>
                      <Heading level={2}>{position.name}</Heading>
                      <Text color="secondary">{position.description}</Text>
                    </VStack>
                    <HStack gap={3} align="center">
                      <Button
                        label={`Add candidate for ${position.name}`}
                        variant="secondary"
                        onClick={() => {
                          setCandidatePositionId((current) => current === position.id ? null : position.id);
                          setSelectedVoter(null);
                          setCandidateImage(null);
                        }}
                      >Add candidate</Button>
                      <DropdownMenu
                        button={{label: `Manage ${position.name}`, children: 'Manage', variant: 'ghost'}}
                        items={[
                          {label: 'Edit position', icon: PencilSimpleIcon, onClick: () => openPositionEditor(position)},
                          {type: 'divider'},
                          {
                            label: 'Delete position',
                            description: deletionLocked ? `Unavailable while the election is ${election.status.toLocaleLowerCase('en')}.` : undefined,
                            icon: TrashIcon,
                            variant: 'destructive',
                            isDisabled: deletionLocked,
                            onClick: () => setDeletingPosition({positionId: position.id, name: position.name, candidateCount: position.nominees.length}),
                          },
                        ]}
                        presentation="adaptive"
                        alignment="end"
                      />
                    </HStack>
                  </HStack>

                  <section className="position-responsibilities">
                    <Text type="supporting" weight="semibold">Responsibilities</Text>
                    <ul>{position.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul>
                    <Text type="supporting" color="secondary">Abstain option {position.abstainEnabled ? 'available' : 'not available'}</Text>
                  </section>

                  {candidatePositionId === position.id ? (
                    <form onSubmit={(event) => void addCandidate(event, position)} className="candidate-form">
                      <VStack gap={4}>
                        <Heading level={3}>Add candidate</Heading>
                        <section className="candidate-form-grid">
                          <Typeahead<VoterItem>
                            label="Candidate"
                            description="Choose someone from this election’s eligible voter list."
                            placeholder="Search by name or Member ID"
                            searchSource={searchSource}
                            value={selectedVoter}
                            onChange={setSelectedVoter}
                            hasEntriesOnFocus
                            width="100%"
                            renderItem={(item) => <TypeaheadItem item={item} description={`${item.auxiliaryData.voter.ageGroup} · ${item.id}`} />}
                          />
                          <TextInput label="Age group" value={selectedVoter?.auxiliaryData.voter.ageGroup ?? ''} onChange={() => undefined} placeholder="Added from the voter record" isReadOnly width="100%" />
                        </section>
                        <FileInput label="Candidate photo" description="Upload a PNG, JPG, or SVG up to 2 MB." value={candidateImage} onChange={(file) => setCandidateImage(file as File | null)} accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" maxSize={2 * 1024 * 1024} width="100%" />
                        <HStack gap={3} justify="end">
                          <Button label="Cancel adding candidate" variant="ghost" onClick={() => setCandidatePositionId(null)}>Cancel</Button>
                          <Button type="submit" label="Save candidate" variant="primary" isDisabled={!selectedVoter} />
                        </HStack>
                      </VStack>
                    </form>
                  ) : null}

                  <section className="candidate-list" aria-label={`Candidates for ${position.name}`}>
                    {position.nominees.length ? position.nominees.map((nominee) => (
                      <article key={nominee.id} className="candidate-row">
                        <HStack gap={3} align="center" justify="between">
                          <HStack gap={3} align="center">
                            <Avatar name={nominee.name} src={nominee.imageUrl} size="lg" shape="rounded" tooltip={false} />
                            <VStack gap={1}>
                              <Text weight="semibold">{nominee.name}</Text>
                              <Text type="supporting" color="secondary">{nominee.ageGroup ?? 'Age group not set'}</Text>
                            </VStack>
                          </HStack>
                          <DropdownMenu
                            button={{label: `Edit ${nominee.name}`, children: 'Edit', variant: 'ghost', size: 'sm'}}
                            items={[
                              {label: 'Edit candidate details', icon: PencilSimpleIcon, onClick: () => openCandidateEditor(position.id, nominee)},
                              {type: 'divider'},
                              {
                                label: 'Remove candidate',
                                description: deletionLocked ? `Unavailable while the election is ${election.status.toLocaleLowerCase('en')}.` : undefined,
                                icon: TrashIcon,
                                variant: 'destructive',
                                isDisabled: deletionLocked,
                                onClick: () => setDeletingCandidate({positionId: position.id, nomineeId: nominee.id, name: nominee.name}),
                              },
                            ]}
                            presentation="adaptive"
                            alignment="end"
                          />
                        </HStack>
                      </article>
                    )) : (
                      <EmptyState
                        isCompact
                        icon={<Icon icon={UserCircleDashedIcon} size="lg" />}
                        title="No candidates yet"
                        description="Add an eligible voter as the first candidate for this position."
                        actions={
                          <Button
                            label={`Add a candidate for ${position.name}`}
                            variant="secondary"
                            size="sm"
                            onClick={() => setCandidatePositionId(position.id)}
                          />
                        }
                      />
                    )}
                  </section>
                </VStack>
              </Card>
            ))}

            {!election.positions.length ? (
              <Card variant="muted" padding={8}>
                <EmptyState
                  icon={<Icon icon={ListChecksIcon} size="lg" />}
                  title="No positions yet"
                  description="Add a position to start building the ballot and its candidate list."
                  actions={<Button label="Add the first position" variant="primary" onClick={openPositionCreator} />}
                />
              </Card>
            ) : null}
          </VStack>
        </section>
      ) : (
        <section id="eligible-voters-panel" role="tabpanel" className="dashboard-section" aria-label="Eligible voters">
          <header className="section-heading-row">
            <VStack gap={1}>
              <Heading level={2}>Eligible voters</Heading>
              <Text color="secondary">See who can vote in this election, or replace the list with a new CSV.</Text>
            </VStack>
            {voterRows.length ? (
              <DropdownMenu
                button={{
                  label: 'Upload voter data',
                  variant: 'secondary',
                  icon: <UploadSimpleIcon />,
                  isDisabled: isOpen,
                  tooltip: isOpen ? 'Voter data can’t be changed while this election is open.' : undefined,
                }}
                items={[
                  {
                    label: 'Add data from CSV',
                    description: 'Keep the current list and add matching Member IDs.',
                    onClick: () => addVotersInputRef.current?.click(),
                  },
                  {
                    label: 'Replace entire list',
                    description: 'Remove the current list and replace it with this CSV.',
                    variant: 'destructive',
                    onClick: () => setIsReplaceVotersOpen(true),
                  },
                ]}
                presentation="adaptive"
                alignment="end"
              />
            ) : (
              <Button
                label="Upload voter data"
                variant="secondary"
                icon={<UploadSimpleIcon />}
                onClick={() => addVotersInputRef.current?.click()}
                isDisabled={isOpen}
                tooltip={isOpen ? 'Voter data can’t be changed while this election is open.' : undefined}
              />
            )}
            <input
              ref={addVotersInputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              aria-label="Add eligible voters from CSV"
              onChange={(event) => {
                void uploadVoterFile(event.currentTarget.files?.[0] ?? null, 'add');
                event.currentTarget.value = '';
              }}
            />
            <input
              ref={replaceVotersInputRef}
              className="sr-only"
              type="file"
              accept=".csv,text/csv"
              aria-label="Replace eligible voters from CSV"
              onChange={(event) => {
                void uploadVoterFile(event.currentTarget.files?.[0] ?? null, 'replace');
                event.currentTarget.value = '';
              }}
            />
          </header>

          {isOpen ? (
            <Banner status="warning" title="Voter uploads are locked" description="Unpublish this election before changing its eligible voter data." container="section" />
          ) : voterUploadStatus ? (
            <Banner
              status={voterUploadStatus.type}
              title={voterUploadStatus.type === 'success' ? 'Voter data updated' : 'Couldn’t update voter data'}
              description={voterUploadStatus.message}
              container="section"
            />
          ) : null}

          <section className="table-surface" aria-label={`Eligible voters for ${election.title}`}>
            {voterRows.length ? (
              <Table<VoterRow>
              data={visibleVoterRows}
              idKey="memberId"
              density="balanced"
              dividers="rows"
              hasHover
              rowIndexStart={votersPageStart + 1}
              rowCount={voterRows.length}
              columns={[
                {key: 'eligible', header: 'Eligible', width: pixel(100)},
                {key: 'memberId', header: 'Member ID', width: pixel(160)},
                {key: 'name', header: 'Member name', width: proportional(2)},
                {key: 'ageGroup', header: 'Age group', width: proportional(1)},
              ]}
              />
            ) : (
              <EmptyState
                icon={<Icon icon={UserListIcon} size="lg" />}
                title="No eligible voters yet"
                description="Upload a CSV to add the people who can vote in this election."
                actions={
                  <Button
                    label="Upload voter data"
                    variant="primary"
                    icon={<UploadSimpleIcon />}
                    onClick={() => addVotersInputRef.current?.click()}
                    isDisabled={isOpen}
                  />
                }
              />
            )}
            {voterRows.length > VOTERS_PAGE_SIZE ? (
              <footer className="table-pagination">
                <Pagination
                  page={votersPage}
                  onChange={setVotersPage}
                  totalItems={voterRows.length}
                  pageSize={VOTERS_PAGE_SIZE}
                  variant="pages"
                  size="sm"
                  label="Eligible voters pages"
                />
              </footer>
            ) : null}
          </section>
        </section>
      )}

      <Dialog isOpen={publicationIntent !== null} onOpenChange={(open) => { if (!open) setPublicationIntent(null); }} purpose="info" width={520}>
        <Layout
          height="auto"
          header={
            <DialogHeader
              title={publicationIntent === 'schedule' ? 'This election isn’t ready to schedule' : 'This election isn’t ready to publish'}
              subtitle="Finish the items below, then try again."
              onOpenChange={(open) => { if (!open) setPublicationIntent(null); }}
            />
          }
          content={
            <LayoutContent>
              <VStack gap={3}>
                <Text as="p">Every ballot needs eligible voters and a complete candidate list.</Text>
                <Banner
                  status="warning"
                  title="Complete the election setup"
                  description={publicationIssues.join(' ')}
                  container="section"
                />
              </VStack>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end" wrap="wrap">
                <Button label="Close publication checklist" variant="ghost" onClick={() => setPublicationIntent(null)}>Close</Button>
                {hasPositionReadinessIssue ? (
                  <Button
                    label="Go to positions"
                    variant={eventVoters.length ? 'primary' : 'secondary'}
                    onClick={() => openReadinessTab('positions')}
                  >Go to positions</Button>
                ) : null}
                <Button
                  label="Go to eligible voters"
                  variant={!eventVoters.length ? 'primary' : 'secondary'}
                  onClick={() => openReadinessTab('eligible-voters')}
                >Go to eligible voters</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={isScheduleDialogOpen} onOpenChange={(open) => { if (!open) closeScheduleDialog(); }} purpose="form" width={560}>
        <Layout
          height="auto"
          header={
            <DialogHeader
              title={scheduleStep === 'edit' ? 'Schedule this election' : 'Confirm the voting schedule'}
              subtitle={scheduleStep === 'edit'
                ? 'Choose a future opening time and when voting should close.'
                : 'Check the schedule before making it active.'}
              onOpenChange={(open) => { if (!open) closeScheduleDialog(); }}
            />
          }
          content={
            <LayoutContent>
              {scheduleStep === 'edit' ? (
                <form id="schedule-election-form" onSubmit={reviewSchedule} noValidate>
                  <VStack gap={4}>
                    {scheduleError ? <Banner status="error" title="Check the voting schedule" description={scheduleError} container="section" /> : null}
                    <FormLayout>
                      <DateTimeInput
                        label="Voting opens"
                        value={scheduleOpensAt}
                        onChange={(value) => { setScheduleOpensAt(value); setScheduleError(null); }}
                        min={currentManilaDateTime()}
                        hourFormat="12h"
                        timeIncrement={15}
                        isRequired
                        width="100%"
                      />
                      <DateTimeInput
                        label="Voting closes"
                        value={scheduleClosesAt}
                        onChange={(value) => { setScheduleClosesAt(value); setScheduleError(null); }}
                        min={scheduleOpensAt ?? currentManilaDateTime()}
                        hourFormat="12h"
                        timeIncrement={15}
                        isRequired
                        width="100%"
                      />
                    </FormLayout>
                  </VStack>
                </form>
              ) : (
                <VStack gap={4}>
                  <Text as="p">This election will open and close automatically at these times:</Text>
                  <dl className="summary-list">
                    <dt>Opens</dt><dd>{scheduleOpensAt ? formatElectionDateTime(scheduleOpensAt) : 'Not set'}</dd>
                    <dt>Closes</dt><dd>{scheduleClosesAt ? formatElectionDateTime(scheduleClosesAt) : 'Not set'}</dd>
                  </dl>
                </VStack>
              )}
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end">
                {scheduleStep === 'edit' ? (
                  <>
                    <Button label="Cancel scheduling" variant="ghost" onClick={closeScheduleDialog}>Cancel</Button>
                    <Button type="submit" form="schedule-election-form" label="Review voting schedule" variant="primary">Continue</Button>
                  </>
                ) : (
                  <>
                    <Button label="Change voting schedule" variant="secondary" onClick={() => setScheduleStep('edit')}>Back</Button>
                    <Button label="Confirm voting schedule" variant="primary" onClick={confirmSchedule}>Schedule election</Button>
                  </>
                )}
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={isPositionDialogOpen} onOpenChange={(open) => { if (!open) closePositionDialog(); }} purpose="form" width={560}>
        <Layout
          height="auto"
          header={
            <DialogHeader
              title={editingPositionId ? 'Edit position' : 'Add a position'}
              subtitle="Describe what this position does and how the person in the role will serve."
              onOpenChange={(open) => { if (!open) closePositionDialog(); }}
            />
          }
          content={
            <LayoutContent>
              <form id="position-form" onSubmit={savePosition} noValidate>
                <FormLayout>
                  <TextInput
                    label="Position"
                    value={positionName}
                    onChange={(value) => {
                      setPositionName(value);
                      setPositionErrors((current) => ({...current, name: undefined}));
                    }}
                    placeholder="e.g. President"
                    status={positionErrors.name ? {type: 'error', message: positionErrors.name} : undefined}
                    statusVariant="detached"
                    isRequired
                    width="100%"
                  />
                  <TextArea
                    label="About the role"
                    value={aboutRole}
                    onChange={(value) => {
                      setAboutRole(value);
                      setPositionErrors((current) => ({...current, description: undefined}));
                    }}
                    placeholder="Describe what this position does and how the person will serve"
                    status={positionErrors.description ? {type: 'error', message: positionErrors.description} : undefined}
                    statusVariant="detached"
                    isRequired
                    width="100%"
                  />
                  <VStack gap={3}>
                    <VStack gap={1}>
                      <Text weight="semibold">Responsibilities</Text>
                      <Text type="supporting" color="secondary">Add at least one responsibility for this position.</Text>
                    </VStack>
                    {responsibilities.map((responsibility, index) => (
                      <HStack key={index} gap={2} align="end">
                        <StackItem size="fill">
                          <TextInput
                            label={`Responsibility ${index + 1}`}
                            isLabelHidden
                            value={responsibility}
                            onChange={(value) => {
                              setResponsibilities((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
                              setPositionErrors((current) => ({...current, responsibilities: undefined}));
                            }}
                            placeholder="What will this person be responsible for?"
                            status={index === 0 && positionErrors.responsibilities ? {type: 'error', message: positionErrors.responsibilities} : undefined}
                            statusVariant="detached"
                            width="100%"
                          />
                        </StackItem>
                        <Button label={`Remove responsibility ${index + 1}`} variant="ghost" isDisabled={responsibilities.length === 1} onClick={() => setResponsibilities((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
                      </HStack>
                    ))}
                    <Button label="Add another responsibility" variant="secondary" onClick={() => setResponsibilities((current) => [...current, ''])}>Add responsibility</Button>
                  </VStack>
                  <CheckboxInput label="Offer an abstain option" description="Voters can choose not to vote for a candidate in this position." value={abstainEnabled} onChange={setAbstainEnabled} />
                </FormLayout>
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end">
                <Button label="Cancel position changes" variant="ghost" onClick={closePositionDialog}>Cancel</Button>
                <Button
                  type="submit"
                  form="position-form"
                  label={editingPositionId ? 'Save position changes' : 'Save position'}
                  variant="primary"
                >{editingPositionId ? 'Save changes' : 'Save position'}</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={isEditingEvent} onOpenChange={setIsEditingEvent} purpose="form" width={640}>
        <Layout
          height="auto"
          header={<DialogHeader title="Edit election details" subtitle="Saved changes appear on the voter ballot right away." onOpenChange={setIsEditingEvent} />}
          content={
            <LayoutContent>
              <form id="edit-election-form" onSubmit={updateEventDetails} noValidate>
                <VStack gap={4}>
                  {eventEditError ? <Banner status="error" title="Check the election details" description={eventEditError} container="section" /> : null}
                  <FormLayout>
                    <TextInput label="Election title" value={eventTitle} onChange={(value) => { setEventTitle(value); setEventEditError(null); }} isRequired width="100%" />
                    <TextArea label="Description" value={eventDescription} onChange={(value) => { setEventDescription(value); setEventEditError(null); }} isRequired width="100%" />
                    <TextInput label="Voting link ending" description="This appears after /vote/ in the link shared with voters." value={eventBallotSlug} onChange={(value) => { setEventBallotSlug(value); setEventEditError(null); }} isRequired width="100%" />
                  </FormLayout>
                </VStack>
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end">
                <Button label="Cancel editing event" variant="ghost" onClick={() => setIsEditingEvent(false)}>Cancel</Button>
                <Button type="submit" form="edit-election-form" label="Save election details" variant="primary">Save changes</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <Dialog isOpen={editingCandidate !== null} onOpenChange={(open) => { if (!open) { setEditingCandidate(null); setCandidateVoter(null); } }} purpose="form" width={560}>
        <Layout
          height="auto"
          header={<DialogHeader title="Edit candidate" subtitle="Candidate names come from this election’s eligible voter list." onOpenChange={(open) => { if (!open) { setEditingCandidate(null); setCandidateVoter(null); } }} />}
          content={
            <LayoutContent>
              <form id="edit-candidate-form" onSubmit={(event) => void updateCandidate(event)}>
                <FormLayout>
                  <Typeahead<VoterItem>
                    label="Candidate name"
                    description="Choose someone from this election’s eligible voter list."
                    placeholder="Search by name or Member ID"
                    searchSource={searchSource}
                    value={candidateVoter}
                    onChange={setCandidateVoter}
                    hasEntriesOnFocus
                    isRequired
                    width="100%"
                    renderItem={(item) => <TypeaheadItem item={item} description={`${item.auxiliaryData.voter.ageGroup} · ${item.id}`} />}
                  />
                  <TextInput label="Age group" value={candidateVoter?.auxiliaryData.voter.ageGroup ?? ''} onChange={() => undefined} placeholder="Added from the voter record" isReadOnly width="100%" />
                  <FileInput
                    label="New candidate photo"
                    description="Leave this empty to keep the current photo, or upload a PNG, JPG, or SVG up to 2 MB."
                    value={candidateEditImage}
                    onChange={(file) => setCandidateEditImage(file as File | null)}
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                    maxSize={2 * 1024 * 1024}
                    width="100%"
                  />
                </FormLayout>
              </form>
            </LayoutContent>
          }
          footer={
            <LayoutFooter>
              <HStack gap={3} justify="end">
                <Button label="Cancel editing candidate" variant="ghost" onClick={() => { setEditingCandidate(null); setCandidateVoter(null); }}>Cancel</Button>
                <Button type="submit" form="edit-candidate-form" label="Save candidate details" variant="primary" isDisabled={!candidateVoter}>Save changes</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={isReplaceVotersOpen}
        onOpenChange={setIsReplaceVotersOpen}
        title="Replace all eligible voters?"
        description="The current eligible voter list will be lost and replaced by the Member IDs in the CSV you choose. This can’t be undone."
        actionLabel="Choose replacement CSV"
        actionVariant="destructive"
        onAction={() => replaceVotersInputRef.current?.click()}
      />

      <AlertDialog
        isOpen={activeStatusDialog !== null}
        onOpenChange={(open) => { if (!open) setPendingStatusAction(null); }}
        title={activeStatusDialog?.title ?? 'Change election status?'}
        description={activeStatusDialog?.description ?? 'Confirm this election status change.'}
        actionLabel={activeStatusDialog?.actionLabel ?? 'Confirm change'}
        actionVariant="primary"
        onAction={confirmStatusChange}
      />

      <AlertDialog
        isOpen={deletingPosition !== null}
        onOpenChange={(open) => { if (!open) setDeletingPosition(null); }}
        title={`Delete ${deletingPosition?.name ?? 'this position'}?`}
        description={deletingPosition?.candidateCount
          ? `This permanently deletes the position and its ${deletingPosition.candidateCount} candidate${deletingPosition.candidateCount === 1 ? '' : 's'} from the ballot.`
          : 'This permanently deletes the position from the ballot.'}
        actionLabel="Delete position"
        onAction={deletePosition}
      />

      <AlertDialog
        isOpen={isDeletingEvent}
        onOpenChange={setIsDeletingEvent}
        title="Delete this election?"
        description={`This permanently deletes ${election.title}, including its positions, candidates, eligible voter list, and voting link.`}
        actionLabel="Delete election"
        onAction={deleteEvent}
      />

      <AlertDialog
        isOpen={deletingCandidate !== null}
        onOpenChange={(open) => { if (!open) setDeletingCandidate(null); }}
        title="Remove this candidate?"
        description={`${deletingCandidate?.name ?? 'This candidate'} will no longer appear on this ballot.`}
        actionLabel="Remove candidate"
        onAction={deleteCandidate}
      />
    </main>
  );
}
