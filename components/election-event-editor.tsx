'use client';

import {FormEvent, useEffect, useMemo, useRef, useState} from 'react';
import {useRouter} from 'next/navigation';
import {ArrowLeftIcon} from '@phosphor-icons/react/ArrowLeft';
import {ArrowUpRightIcon} from '@phosphor-icons/react/ArrowUpRight';
import {ArchiveIcon} from '@phosphor-icons/react/Archive';
import {CopySimpleIcon} from '@phosphor-icons/react/CopySimple';
import {DownloadSimpleIcon} from '@phosphor-icons/react/DownloadSimple';
import {PencilSimpleIcon} from '@phosphor-icons/react/PencilSimple';
import {PlusIcon} from '@phosphor-icons/react/Plus';
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
import {Selector} from '@astryxdesign/core/Selector';
import {StatusDot} from '@astryxdesign/core/StatusDot';
import {Tab, TabList} from '@astryxdesign/core/TabList';
import {Table, pixel, proportional} from '@astryxdesign/core/Table';
import {Text} from '@astryxdesign/core/Text';
import {TextArea} from '@astryxdesign/core/TextArea';
import {TextInput} from '@astryxdesign/core/TextInput';
import {useToast} from '@astryxdesign/core/Toast';
import {Typeahead, TypeaheadItem, type SearchSource, type SearchableItem} from '@astryxdesign/core/Typeahead';
import {
  ELIGIBLE_VOTER_CSV_COLUMNS,
  getMemberCsvHeaders,
  isCsvEligibilityValue,
  isCsvEligible,
  normalizeCsvBirthDate,
  normalizeGender,
  parseVoters,
} from '@/lib/csv';
import {ElectionEditorSkeleton} from '@/components/loading-states';
import {fetchElection, fetchVoters, removeElection, saveElection, uploadCandidateImage} from '@/lib/api';
import {
  eligibleVotersForEvent,
  positionMatchesVoter,
  type ElectionEvent,
  type ElectionStatus,
  type EligibleVoter,
  type Nominee,
  type Position,
  type PositionFilter,
  type VotingRule,
} from '@/lib/election-data';

interface VoterItem extends SearchableItem<{voter: EligibleVoter}> {
  auxiliaryData: {voter: EligibleVoter};
}

interface VoterRow extends Record<string, unknown> {
  memberId: string;
  name: string;
  ageGroup: string;
  voterEligibility: 'Yes' | 'No';
  nomineeEligibility: 'Yes' | 'No';
}

type UploadStatus = {type: 'error' | 'success'; message: string};
type CandidateTarget = {positionId: string; nomineeId: string; name: string};
type PositionTarget = {positionId: string; name: string; candidateCount: number};
type PositionErrors = {name?: string; description?: string; responsibilities?: string; votingRule?: string};
type StatusAction = 'publish' | 'unpublish' | 'archive' | 'restore';
type PublicationIntent = 'publish' | 'schedule';
type VoterUploadMode = 'add' | 'replace';
const VOTERS_PAGE_SIZE = 10;
const EMPTY_FILTER: PositionFilter = {column: '', condition: 'equals', value: ''};
const FILTER_CONDITIONS = [
  {value: 'equals', label: 'Equals'},
  {value: 'not_equals', label: 'Does not equal'},
  {value: 'contains', label: 'Contains'},
  {value: 'not_contains', label: 'Does not contain'},
  {value: 'is_empty', label: 'Is empty'},
  {value: 'is_not_empty', label: 'Is not empty'},
];

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

function manilaInput(value: string): ISODateTimeString | undefined {
  return value ? new Date(Date.parse(value) + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) as ISODateTimeString : undefined;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState('positions');
  const [isPositionDialogOpen, setIsPositionDialogOpen] = useState(false);
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [deletingPosition, setDeletingPosition] = useState<PositionTarget | null>(null);
  const [positionErrors, setPositionErrors] = useState<PositionErrors>({});
  const [candidatePositionId, setCandidatePositionId] = useState<string | null>(null);
  const [positionName, setPositionName] = useState('');
  const [aboutRole, setAboutRole] = useState('');
  const [responsibilities, setResponsibilities] = useState(['']);
  const [votingRule, setVotingRule] = useState<VotingRule>({type: 'all', filters: []});
  const [abstainEnabled, setAbstainEnabled] = useState(true);
  const [isSavingPosition, setIsSavingPosition] = useState(false);
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
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
  const [eventAnonymousVoting, setEventAnonymousVoting] = useState(true);
  const [eventEditError, setEventEditError] = useState<string | null>(null);
  const [editingCandidate, setEditingCandidate] = useState<CandidateTarget | null>(null);
  const [deletingCandidate, setDeletingCandidate] = useState<CandidateTarget | null>(null);
  const [isRemovingCandidate, setIsRemovingCandidate] = useState(false);
  const [candidateVoter, setCandidateVoter] = useState<VoterItem | null>(null);
  const [candidateEditImage, setCandidateEditImage] = useState<File | null>(null);
  const [isUpdatingCandidate, setIsUpdatingCandidate] = useState(false);
  const addVotersInputRef = useRef<HTMLInputElement>(null);
  const replaceVotersInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    setIsReady(false);
    setLoadError(null);
    void fetchElection(eventId)
      .then(async (loadedElection) => {
        setElection(loadedElection);
        try {
          const loadedVoters = await fetchVoters(eventId);
          setElection({...loadedElection, eligibleVoterIds: loadedVoters.filter((voter) => voter.eligible).map((voter) => voter.memberId)});
          setVoters(loadedVoters);
        } catch (cause) {
          setLoadError(cause instanceof Error ? cause.message : 'Voter records could not be loaded.');
        }
      })
      .catch((cause) => {
        setElection(null);
        setLoadError(cause instanceof Error ? cause.message : 'The election could not be loaded.');
      })
      .finally(() => setIsReady(true));
  }, [eventId]);

  useEffect(() => {
    if (voterUploadStatus?.type !== 'success') return;
    const timer = window.setTimeout(() => setVoterUploadStatus(undefined), 3000);
    return () => window.clearTimeout(timer);
  }, [voterUploadStatus]);

  const eventVoters = useMemo(
    () => election ? eligibleVotersForEvent(election, voters) : [],
    [election, voters],
  );
  const eligibleIds = useMemo(() => new Set(eventVoters.map((voter) => voter.memberId)), [eventVoters]);
  const nomineeVoters = useMemo(() => voters.filter((voter) => (
    voter.nomineeEligible ?? voter.eligible ?? false
  )), [voters]);
  const voterRows = useMemo<VoterRow[]>(() => voters.map((voter) => ({
    ...voter,
    voterEligibility: eligibleIds.has(voter.memberId) ? 'Yes' : 'No',
    nomineeEligibility: (voter.nomineeEligible ?? eligibleIds.has(voter.memberId)) ? 'Yes' : 'No',
  })), [eligibleIds, voters]);
  const searchSource = useMemo(() => voterSource(nomineeVoters), [nomineeVoters]);
  const filterColumns = useMemo(() => Array.from(new Set(eventVoters.flatMap((voter) => Object.keys(voter.attributes ?? {})))).sort(), [eventVoters]);
  const filterValues = useMemo(() => Object.fromEntries(filterColumns.map((column) => {
    const unique = new Map<string, string>();
    for (const voter of eventVoters) {
      const value = voter.attributes?.[column]?.trim();
      if (value && !unique.has(value.toLocaleLowerCase('en'))) unique.set(value.toLocaleLowerCase('en'), value);
    }
    return [column, Array.from(unique.values()).sort((left, right) => left.localeCompare(right))];
  })) as Record<string, string[]>, [eventVoters, filterColumns]);
  const filtersComplete = votingRule.type === 'custom' && votingRule.filters.length > 0 && votingRule.filters.length <= 5 && votingRule.filters.every((filter) => (
    filterColumns.includes(filter.column) && FILTER_CONDITIONS.some((condition) => condition.value === filter.condition) &&
    (['is_empty', 'is_not_empty'].includes(filter.condition) || (
      ['equals', 'not_equals'].includes(filter.condition)
        ? (filterValues[filter.column] ?? []).some((value) => value.toLocaleLowerCase('en') === filter.value.trim().toLocaleLowerCase('en'))
        : Boolean(filter.value.trim())
    ))
  ));
  const matchingVoterCount = useMemo(() => {
    if (!filtersComplete || !election) return 0;
    const group = election.positions.find((position) => position.id === editingPositionId)?.group ?? 'General';
    return eventVoters.filter((voter) => positionMatchesVoter({group, votingRule}, voter)).length;
  }, [election, editingPositionId, eventVoters, filtersComplete, votingRule]);
  const votersPageStart = (votersPage - 1) * VOTERS_PAGE_SIZE;
  const visibleVoterRows = voterRows.slice(votersPageStart, votersPageStart + VOTERS_PAGE_SIZE);

  function persist(updated: ElectionEvent, nextVoters?: EligibleVoter[]) {
    setElection(updated);
    if (nextVoters) setVoters(nextVoters);
    void saveElection(updated, nextVoters).then((saved) => {
      setElection({...saved, eligibleVoterIds: updated.eligibleVoterIds});
    }).catch((cause) => {
      toast({body: cause instanceof Error ? cause.message : 'The election could not be saved.', type: 'error', uniqueID: 'election-save-error'});
    });
  }

  function openEventEditor() {
    if (!election) return;
    setEventTitle(election.title);
    setEventDescription(election.description);
    setEventBallotSlug(election.ballotSlug);
    setEventAnonymousVoting(election.anonymousVoting);
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
      anonymousVoting: eventAnonymousVoting,
    };
    persist(updated);
    setIsEditingEvent(false);
    toast({body: `${updated.title} is up to date.`, uniqueID: 'election-event-updated'});
  }

  function openScheduleDialog() {
    if (!election) return;
    setScheduleOpensAt(manilaInput(election.opensAt));
    setScheduleClosesAt(manilaInput(election.closesAt));
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
    const opensAt = parseElectionDateTime(scheduleOpensAt).toISOString();
    const closesAt = parseElectionDateTime(scheduleClosesAt).toISOString();
    persist({...election, status: 'Scheduled', electionDate: scheduleOpensAt.slice(0, 10), opensAt, closesAt});
    closeScheduleDialog();
    toast({body: `${election.title} is scheduled to open ${formatElectionDateTime(opensAt)}.`, uniqueID: 'election-scheduled'});
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
    persist({
      ...election,
      status: nextStatus,
      ...(pendingStatusAction === 'publish' ? {opensAt: now.toISOString(), closesAt: '', electionDate: now.toISOString().slice(0, 10)} : {}),
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
    try {
      await removeElection(election.id);
      setIsDeletingEvent(false);
      toast({body: `${election.title} was deleted.`, uniqueID: 'election-deleted'});
      router.push('/');
    } catch (cause) {
      toast({body: cause instanceof Error ? cause.message : 'The election could not be deleted.', type: 'error', uniqueID: 'election-delete-error'});
    }
  }

  function openCandidateEditor(positionId: string, nominee: Nominee) {
    setEditingCandidate({positionId, nomineeId: nominee.id, name: nominee.name});
    const voter = voters.find((item) => item.name === nominee.name);
    setCandidateVoter(voter ? toVoterItem(voter) : toVoterItem({
      memberId: nominee.id,
      name: nominee.name,
      ageGroup: nominee.ageGroup ?? nominee.profile,
    }));
    setCandidateEditImage(null);
  }

  async function updateCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!election || !editingCandidate || !candidateVoter || isUpdatingCandidate) return;
    const voter = candidateVoter.auxiliaryData.voter;
    const position = election.positions.find((item) => item.id === editingCandidate.positionId);
    const isDuplicate = position?.nominees.some((nominee) => (
      nominee.id !== editingCandidate.nomineeId && nominee.name === voter.name
    ));
    if (isDuplicate) {
      toast({body: `${voter.name} is already a candidate for ${position?.name}.`, type: 'error', uniqueID: 'candidate-update-duplicate'});
      return;
    }
    setIsUpdatingCandidate(true);
    try {
      const imageUrl = candidateEditImage ? await uploadCandidateImage(editingCandidate.nomineeId, candidateEditImage) : undefined;
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
      const saved = await saveElection({...election, positions: updatedPositions});
      setElection({...saved, eligibleVoterIds: election.eligibleVoterIds});
      setEditingCandidate(null);
      setCandidateVoter(null);
      setCandidateEditImage(null);
      toast({body: `${voter.name}’s candidate details were saved.`, uniqueID: 'candidate-updated'});
    } catch (error) {
      toast({body: error instanceof Error ? error.message : 'The candidate could not be saved.', type: 'error', uniqueID: 'candidate-update-error'});
    } finally {
      setIsUpdatingCandidate(false);
    }
  }

  async function deleteCandidate() {
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
    setIsRemovingCandidate(true);
    try {
      const saved = await saveElection({...election, positions: updatedPositions});
      setElection({...saved, eligibleVoterIds: election.eligibleVoterIds});
      toast({body: `${deletingCandidate.name} was removed from this ballot.`, uniqueID: 'candidate-removed'});
      setDeletingCandidate(null);
    } catch (cause) {
      toast({body: cause instanceof Error ? cause.message : 'The candidate could not be removed.', type: 'error', uniqueID: 'candidate-delete-error'});
    } finally {
      setIsRemovingCandidate(false);
    }
  }

  function resetPositionForm() {
    setPositionName('');
    setAboutRole('');
    setResponsibilities(['']);
    setVotingRule({type: 'all', filters: []});
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
    setVotingRule(position.votingRule?.type === 'custom' ? position.votingRule : {type: 'all', filters: []});
    setAbstainEnabled(position.abstainEnabled);
    setEditingPositionId(position.id);
    setPositionErrors({});
    setIsPositionDialogOpen(true);
  }

  async function savePosition(event: FormEvent<HTMLFormElement>) {
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
    if (votingRule.type === 'custom') {
      if (!filterColumns.length) errors.votingRule = 'Upload a voter CSV before adding a custom filter.';
      else if (!filtersComplete) errors.votingRule = 'Choose a CSV column, condition, and value for every filter.';
    }

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
      votingRule: votingRule.type === 'custom' ? {type: 'custom', filters: votingRule.filters.map((filter, index) => ({...filter, value: filter.value.trim(), ...(index === 0 ? {join: undefined} : {})}))} : {type: 'all', filters: []},
      nominees: existingPosition?.nominees ?? [],
    };

    const updatedPositions = existingPosition
      ? election.positions.map((item) => item.id === existingPosition.id ? position : item)
      : [...election.positions, position];
    try {
      setIsSavingPosition(true);
      const saved = await saveElection({...election, positions: updatedPositions});
      setElection({...saved, eligibleVoterIds: election.eligibleVoterIds});
      closePositionDialog();
      toast({
        body: existingPosition ? `${position.name} was updated.` : `${position.name} was added to the ballot.`,
        uniqueID: existingPosition ? 'position-updated' : 'position-added',
      });
    } catch (cause) {
      toast({body: cause instanceof Error ? cause.message : 'We couldn’t save this position. Your changes are still here—please try again.', type: 'error', uniqueID: 'position-save-error'});
    } finally {
      setIsSavingPosition(false);
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
    if (!election || !selectedVoter || isAddingCandidate) return;
    const voter = selectedVoter.auxiliaryData.voter;
    if (position.nominees.some((nominee) => nominee.name === voter.name)) {
      toast({body: `${voter.name} is already a candidate for ${position.name}.`, type: 'error', uniqueID: 'candidate-add-duplicate'});
      return;
    }
    setIsAddingCandidate(true);
    try {
      const nomineeId = crypto.randomUUID();
      const imageUrl = candidateImage ? await uploadCandidateImage(nomineeId, candidateImage) : undefined;
      const updatedPositions = election.positions.map((item) => item.id === position.id ? {
        ...item,
        nominees: [...item.nominees, {
          id: nomineeId,
          name: voter.name,
          profile: voter.ageGroup,
          ageGroup: voter.ageGroup,
          imageUrl,
        }],
      } : item);
      const saved = await saveElection({...election, positions: updatedPositions});
      setElection({...saved, eligibleVoterIds: election.eligibleVoterIds});
      setSelectedVoter(null);
      setCandidateImage(null);
      setCandidatePositionId(null);
      toast({body: `${voter.name} was added as a candidate for ${position.name}.`, uniqueID: 'candidate-added'});
    } catch (error) {
      toast({body: error instanceof Error ? error.message : 'The candidate could not be saved.', type: 'error', uniqueID: 'candidate-add-error'});
    } finally {
      setIsAddingCandidate(false);
    }
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

    const csv = await file.text();
    const headers = getMemberCsvHeaders(csv);
    const missingColumns = ELIGIBLE_VOTER_CSV_COLUMNS.filter((column) => !headers.includes(column));
    if (missingColumns.length) {
      setVoterUploadStatus({
        type: 'error',
        message: `Missing required column${missingColumns.length === 1 ? '' : 's'}: ${missingColumns.join(', ')}.`,
      });
      return;
    }

    const records = parseVoters(csv);
    const invalidEligibilityRow = records.findIndex((record) => (
      !isCsvEligibilityValue(record.voter) || !isCsvEligibilityValue(record.nominee)
    ));
    if (invalidEligibilityRow >= 0) {
      setVoterUploadStatus({
        type: 'error',
        message: `Row ${invalidEligibilityRow + 1}: Voter and Nominee must be YES, NO, or blank.`,
      });
      return;
    }

    const importedVoters: EligibleVoter[] = records.filter((record) => record.member_id?.trim()).map((record) => ({
      memberId: record.member_id.trim(),
      firstName: record.first_name?.trim(),
      lastName: record.last_name?.trim(),
      name: `${record.first_name?.trim() ?? ''} ${record.last_name?.trim() ?? ''}`.trim(),
      gender: record.gender?.trim() ? normalizeGender(record.gender) : undefined,
      age: Number(record.age),
      birthDate: normalizeCsvBirthDate(record.birth_date ?? '') ?? undefined,
      ageGroup: record.age_group?.trim(),
      eligible: isCsvEligible(record.voter),
      nomineeEligible: isCsvEligible(record.nominee),
      attributes: {
        ...record,
        voter: isCsvEligible(record.voter) ? 'YES' : 'NO',
        nominee: isCsvEligible(record.nominee) ? 'YES' : 'NO',
      },
    }));
    if (!importedVoters.length) {
      setVoterUploadStatus({type: 'error', message: 'We couldn’t find any member records. Check the CSV and try again.'});
      return;
    }
    const mergedVoters = mode === 'add'
      ? [...voters.filter((voter) => !new Set(importedVoters.map((item) => item.memberId)).has(voter.memberId)), ...importedVoters]
      : importedVoters;
    const eligibleVoterIds = mergedVoters.filter((voter) => voter.eligible).map((voter) => voter.memberId);
    persist({...election, eligibleVoterIds, eligibleVoters: eligibleVoterIds.length}, mergedVoters);
    setVotersPage(1);
    const nomineeCount = mergedVoters.filter((voter) => voter.nomineeEligible).length;
    const result = `${mode === 'add' ? `${importedVoters.length} member record${importedVoters.length === 1 ? '' : 's'} imported` : `Member list replaced with ${mergedVoters.length} record${mergedVoters.length === 1 ? '' : 's'}`}. ${eligibleVoterIds.length} voter${eligibleVoterIds.length === 1 ? '' : 's'} and ${nomineeCount} nominee${nomineeCount === 1 ? '' : 's'} eligible.`;
    setVoterUploadStatus({type: 'success', message: result});
    toast({body: mode === 'add' ? 'Member eligibility added.' : 'Member eligibility list replaced.', uniqueID: 'eligible-voters-imported'});
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
            <Heading level={1}>{loadError === 'Election not found.' ? 'We couldn’t find this election' : 'We couldn’t load this election'}</Heading>
            <Text color="secondary">{loadError === 'Election not found.' ? 'It may have been deleted or the link may be incorrect.' : loadError ?? 'Please try again.'}</Text>
          </VStack>
        </Card>
      </main>
    );
  }

  const isOpen = election.status === 'Open' || election.status === 'Published';
  const ballotLabel = isOpen ? 'View ballot' : 'Open voting link';
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
      {loadError ? <Banner status="error" title="Voter records could not be loaded" description={loadError} container="section" /> : null}
      <Button label="Back to elections" href="/" variant="ghost" icon={<ArrowLeftIcon />}>Back to elections</Button>

      <header className="admin-page-header event-editor-header">
        <VStack gap={2}>
          <HStack gap={3} align="center" wrap="wrap">
            <Heading level={1}>{election.title}</Heading>
            <Badge variant={statusVariant(election.status)} label={statusLabel} />
          </HStack>
          <Text color="secondary">{election.description}</Text>
          {election.opensAt ? (
            <HStack className="event-schedule" gap={4} align="center" wrap="wrap">
              <Text type="supporting" color="secondary">Election day: {formatElectionDate(election.electionDate)}</Text>
              <Text type="supporting" color="secondary">Opens: {formatElectionDateTime(election.opensAt)}</Text>
              <Text type="supporting" color="secondary">Closes: {election.closesAt ? formatElectionDateTime(election.closesAt) : 'Open indefinitely'}</Text>
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
          <Button
            label={`${ballotLabel}: ${election.title}`}
            href={`/vote/${election.ballotSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="secondary"
            endContent={<ArrowUpRightIcon aria-hidden="true" />}
          >{ballotLabel}</Button>
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
            <Button label="Unpublish election" variant="destructive" onClick={() => setPendingStatusAction('unpublish')}>Unpublish</Button>
          ) : null}
          {election.status === 'Archived' ? (
            <Button label="Restore election to draft" variant="primary" onClick={() => setPendingStatusAction('restore')}>Restore</Button>
          ) : null}
        </HStack>
      </header>

      <VStack gap={6}>
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
      </VStack>

      {tab === 'positions' ? (
        <section id="positions-panel" role="tabpanel" className="dashboard-section" aria-label="Election positions">
          <header className="section-heading-row">
            <VStack gap={1}>
              <Heading level={2}>Positions and candidates</Heading>
              <Text color="secondary">Saved changes appear on the voter ballot right away.</Text>
            </VStack>
            <Button label="Add position" variant="primary" icon={<PlusIcon />} onClick={openPositionCreator} />
          </header>

          {!eventVoters.length ? (
            <Banner status="warning" title="Add eligible voters before publishing" description="Open Eligible voters and mark at least one member YES in the Voter column." container="section" />
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
                        icon={<PlusIcon />}
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
                            description="Choose a member marked YES in the Nominee column."
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
                          <Button label="Cancel adding candidate" variant="ghost" onClick={() => setCandidatePositionId(null)} isDisabled={isAddingCandidate}>Cancel</Button>
                          <Button type="submit" label="Save candidate" variant="primary" isDisabled={!selectedVoter || isAddingCandidate} isLoading={isAddingCandidate} />
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
                        description="Add a nominee-eligible member as the first candidate for this position."
                        actions={
                          <Button
                            label={`Add a candidate for ${position.name}`}
                            variant="secondary"
                            size="sm"
                            icon={<PlusIcon />}
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
                  actions={<Button label="Add the first position" variant="primary" icon={<PlusIcon />} onClick={openPositionCreator} />}
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
              <Text color="secondary">Upload member eligibility. YES enables Voter or Nominee eligibility; NO and blank disable it.</Text>
            </VStack>
            <HStack gap={2} align="center" wrap="wrap">
              <Button label="Download CSV Template" href="/api/csv-template/eligible-voters" variant="secondary" icon={<DownloadSimpleIcon />} />
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
            </HStack>
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
                {key: 'voterEligibility', header: 'Voter', width: pixel(110), renderCell: (row) => <HStack gap={1} align="center"><StatusDot variant={row.voterEligibility === 'Yes' ? 'success' : 'neutral'} label={`Voter eligible: ${row.voterEligibility}`} /><Text>{row.voterEligibility}</Text></HStack>},
                {key: 'nomineeEligibility', header: 'Nominee', width: pixel(120), renderCell: (row) => <HStack gap={1} align="center"><StatusDot variant={row.nomineeEligibility === 'Yes' ? 'success' : 'neutral'} label={`Nominee eligible: ${row.nomineeEligibility}`} /><Text>{row.nomineeEligibility}</Text></HStack>},
                {key: 'memberId', header: 'Member ID', width: pixel(160)},
                {key: 'name', header: 'Member name', width: proportional(2)},
                {key: 'ageGroup', header: 'Age group', width: proportional(1)},
              ]}
              />
            ) : (
              <EmptyState
                icon={<Icon icon={UserListIcon} size="lg" />}
                title="No member eligibility records yet"
                description="Upload the CSV template to set who can vote and who can be a nominee."
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
                  <VStack gap={3}>
                    <Selector
                      label="Who can vote for this position"
                      options={[{value: 'all', label: 'All'}, {value: 'custom', label: 'Custom Filter', disabled: !filterColumns.length, description: !filterColumns.length ? 'Upload a voter CSV first' : undefined}]}
                      value={votingRule.type}
                      onChange={(value) => {
                        setVotingRule((current) => value === 'custom'
                          ? {type: 'custom', filters: current.filters.length ? current.filters : [{...EMPTY_FILTER}]}
                          : {type: 'all', filters: []});
                        setPositionErrors((current) => ({...current, votingRule: undefined}));
                      }}
                      width="100%"
                    />
                    {votingRule.type === 'custom' ? (
                      <VStack gap={4}>
                        <Text weight="semibold">Filter</Text>
                        <Text type="supporting" color="secondary">Only voters whose CSV data matches these filters can vote for this position. Filters are evaluated from top to bottom.</Text>
                        {votingRule.filters.map((filter, index) => (
                          <VStack key={index} gap={2}>
                            {index > 0 ? (
                              <Selector
                                label={`Combine filter ${index + 1} with previous filters`}
                                isLabelHidden
                                options={[{value: 'and', label: 'AND'}, {value: 'or', label: 'OR'}]}
                                value={filter.join ?? 'and'}
                                onChange={(value) => setVotingRule((current) => ({...current, filters: current.filters.map((item, itemIndex) => itemIndex === index ? {...item, join: value as 'and' | 'or'} : item)}))}
                                width="fit-content"
                              />
                            ) : null}
                            <HStack gap={2} align="end">
                              <StackItem size="fill">
                                <Selector
                                  label={`Filter ${index + 1} CSV column`}
                                  isLabelHidden
                                  options={filterColumns.map((column) => ({value: column, label: column.replaceAll('_', ' ')}))}
                                  placeholder={filterColumns.length ? 'Select a CSV column' : 'Upload a voter CSV first'}
                                  value={filter.column}
                                  onChange={(value) => {
                                    setVotingRule((current) => ({...current, filters: current.filters.map((item, itemIndex) => itemIndex === index ? {...item, column: value, value: ''} : item)}));
                                    setPositionErrors((current) => ({...current, votingRule: undefined}));
                                  }}
                                  isDisabled={!filterColumns.length}
                                  width="100%"
                                />
                              </StackItem>
                              <Button label={`Remove filter ${index + 1}`} variant="ghost" isDisabled={votingRule.filters.length === 1} onClick={() => setVotingRule((current) => ({...current, filters: current.filters.filter((_, itemIndex) => itemIndex !== index)}))}>Remove</Button>
                            </HStack>
                            <HStack gap={2} align="end">
                              <StackItem size="fill">
                                <Selector
                                  label={`Filter ${index + 1} condition`}
                                  isLabelHidden
                                  options={FILTER_CONDITIONS}
                                  value={filter.condition}
                                  onChange={(value) => {
                                    setVotingRule((current) => ({...current, filters: current.filters.map((item, itemIndex) => itemIndex === index ? {...item, condition: value as PositionFilter['condition'], value: ['is_empty', 'is_not_empty'].includes(value) ? '' : item.value} : item)}));
                                    setPositionErrors((current) => ({...current, votingRule: undefined}));
                                  }}
                                  width="100%"
                                />
                              </StackItem>
                              <StackItem size="fill">
                                {filter.condition === 'equals' || filter.condition === 'not_equals' ? (
                                  <Selector
                                    label={`Filter ${index + 1} value`}
                                    isLabelHidden
                                    options={(filterValues[filter.column] ?? []).map((value) => ({value, label: value}))}
                                    value={(filterValues[filter.column] ?? []).find((value) => value.toLocaleLowerCase('en') === filter.value.trim().toLocaleLowerCase('en')) ?? ''}
                                    onChange={(value) => {
                                      setVotingRule((current) => ({...current, filters: current.filters.map((item, itemIndex) => itemIndex === index ? {...item, value} : item)}));
                                      setPositionErrors((current) => ({...current, votingRule: undefined}));
                                    }}
                                    placeholder={filter.column ? 'Select a CSV value' : 'Choose a column first'}
                                    isDisabled={!filter.column || !(filterValues[filter.column] ?? []).length}
                                    hasSearch={(filterValues[filter.column] ?? []).length > 20}
                                    width="100%"
                                  />
                                ) : (
                                  <TextInput
                                    label={`Filter ${index + 1} value`}
                                    isLabelHidden
                                    value={filter.value}
                                    onChange={(value) => {
                                      setVotingRule((current) => ({...current, filters: current.filters.map((item, itemIndex) => itemIndex === index ? {...item, value} : item)}));
                                      setPositionErrors((current) => ({...current, votingRule: undefined}));
                                    }}
                                    placeholder="Enter a value"
                                    isDisabled={filter.condition === 'is_empty' || filter.condition === 'is_not_empty'}
                                    width="100%"
                                  />
                                )}
                              </StackItem>
                            </HStack>
                          </VStack>
                        ))}
                        {positionErrors.votingRule ? <Banner status="error" title="Check voting filters" description={positionErrors.votingRule} container="section" /> : null}
                        {filtersComplete ? <Text type="supporting" color="secondary" hasTabularNumbers>{matchingVoterCount} of {eventVoters.length} eligible voters match</Text> : null}
                        <Button label="Add filter" variant="secondary" icon={<PlusIcon />} isDisabled={votingRule.filters.length >= 5} onClick={() => setVotingRule((current) => ({...current, filters: [...current.filters, {...EMPTY_FILTER, join: 'and'}]}))}>Add filter</Button>
                        <Text type="supporting" color="secondary">{votingRule.filters.length} of 5 filters</Text>
                      </VStack>
                    ) : null}
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
                  isLoading={isSavingPosition}
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
                    <CheckboxInput
                      label="Anonymous voting"
                      description="When enabled, ballots are not linked to voter records."
                      value={eventAnonymousVoting}
                      onChange={setEventAnonymousVoting}
                      isDisabled={election.status !== 'Draft' || election.ballotsSubmitted > 0}
                      disabledMessage={election.ballotsSubmitted > 0 ? 'This setting cannot change after voting has begun.' : 'This setting can only be changed while the election is a draft.'}
                    />
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

      <Dialog isOpen={editingCandidate !== null} onOpenChange={(open) => { if (!open && !isUpdatingCandidate) { setEditingCandidate(null); setCandidateVoter(null); } }} purpose="form" width={560}>
        <Layout
          height="auto"
          header={<DialogHeader title="Edit candidate" subtitle="Candidate names come from members marked YES in the Nominee column." onOpenChange={(open) => { if (!open && !isUpdatingCandidate) { setEditingCandidate(null); setCandidateVoter(null); } }} />}
          content={
            <LayoutContent>
              <form id="edit-candidate-form" onSubmit={(event) => void updateCandidate(event)}>
                <FormLayout>
                  <Typeahead<VoterItem>
                    label="Candidate name"
                    description="Choose a member marked YES in the Nominee column."
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
                <Button label="Cancel editing candidate" variant="ghost" onClick={() => { setEditingCandidate(null); setCandidateVoter(null); }} isDisabled={isUpdatingCandidate}>Cancel</Button>
                <Button type="submit" form="edit-candidate-form" label="Save candidate details" variant="primary" isDisabled={!candidateVoter || isUpdatingCandidate} isLoading={isUpdatingCandidate}>Save changes</Button>
              </HStack>
            </LayoutFooter>
          }
        />
      </Dialog>

      <AlertDialog
        isOpen={isReplaceVotersOpen}
        onOpenChange={setIsReplaceVotersOpen}
        title="Replace all member eligibility?"
        description="The current voter and nominee eligibility will be replaced by the Member IDs and Voter/Nominee values in the CSV you choose. This can’t be undone."
        actionLabel="Choose replacement CSV"
        actionVariant="destructive"
        onAction={() => {setIsReplaceVotersOpen(false); replaceVotersInputRef.current?.click();}}
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
        isActionLoading={isRemovingCandidate}
        onAction={deleteCandidate}
      />
    </main>
  );
}
