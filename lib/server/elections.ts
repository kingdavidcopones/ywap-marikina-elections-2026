import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase';
import {normalizeGender} from '@/lib/csv';
import {normalizeCandidateImageUrl, signCandidateImageUrls} from '@/lib/server/candidate-images';
import type {ElectionEvent, ElectionResult, ElectionSummary, EligibleVoter, IndividualVoteRecord, Position} from '@/lib/election-data';

export type ElectionAvailability = Pick<ElectionEvent, 'ballotSlug' | 'title' | 'status' | 'opensAt' | 'closesAt'>;

const statusFromDb: Record<string, ElectionEvent['status']> = {
  draft: 'Draft', scheduled: 'Scheduled', open: 'Open', closed: 'Closed', published: 'Published', archived: 'Archived',
};
const groupFromDb: Record<string, Position['group']> = {
  general: 'General', teens: 'Teens', young_people: 'Young People', young_adults: 'Young Adults',
};

function assertData<T>(data: T | null, error: {message: string} | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('Supabase returned no data.');
  return data;
}

async function fetchAllRows<T>(loadPage: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {message: string} | null}>): Promise<T[]> {
  const pageSize = 500;
  const rows: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await loadPage(offset, offset + pageSize - 1);
    const batch = assertData(page.data, page.error);
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
}

async function mapElection(row: any): Promise<ElectionEvent> {
  const eligibleVoters = Number(row.eligible_voters?.[0]?.count ?? 0);
  const ballotsSubmitted = Number(row.anonymous_ballots?.[0]?.count ?? 0);
  const signedImages = await signCandidateImageUrls((row.positions ?? []).flatMap((position: any) => (
    (position.nominees ?? []).map((nominee: any) => nominee.image_url)
  ))).catch(() => new Map<string, string>());
  const positions = (row.positions ?? []).sort((a: any, b: any) => a.display_order - b.display_order).map((position: any) => ({
    id: position.id,
    name: position.name,
    group: groupFromDb[position.group_scope] ?? 'General',
    description: position.description,
    responsibilities: Array.isArray(position.responsibilities) ? position.responsibilities : [],
    abstainEnabled: position.abstain_enabled,
    votingRule: position.voting_rule ?? {type: 'all', filters: []},
    nominees: (position.nominees ?? []).filter((item: any) => item.active).sort((a: any, b: any) => a.display_order - b.display_order).map((nominee: any) => ({
      id: nominee.id,
      name: nominee.full_name,
      profile: nominee.short_profile ?? '',
      ageGroup: nominee.age_group ? groupFromDb[nominee.age_group] : undefined,
      imageUrl: signedImages.get(nominee.image_url) ?? (nominee.image_url?.startsWith('candidate-image://') ? undefined : nominee.image_url ?? undefined),
    })),
  }));
  return {
    id: row.id, ballotSlug: row.ballot_slug, anonymousVoting: row.anonymous_voting ?? true, title: row.title, description: row.description,
    status: statusFromDb[row.status] ?? 'Draft', electionDate: row.election_date ?? '', opensAt: row.opens_at ?? '', closesAt: row.closes_at ?? '',
    eligibleVoters, ballotsSubmitted, positions,
  };
}

const electionSelect = '*, positions(*, nominees(*)), eligible_voters(count), anonymous_ballots(count)';
const electionSummarySelect = 'id, ballot_slug, anonymous_voting, title, description, status, election_date, opens_at, closes_at, positions(count), eligible_voters(count), anonymous_ballots(count)';

function mapElectionSummary(row: any): ElectionSummary {
  return {
    id: row.id,
    ballotSlug: row.ballot_slug,
    anonymousVoting: row.anonymous_voting ?? true,
    title: row.title,
    description: row.description,
    status: statusFromDb[row.status] ?? 'Draft',
    electionDate: row.election_date ?? '',
    opensAt: row.opens_at ?? '',
    closesAt: row.closes_at ?? '',
    eligibleVoters: Number(row.eligible_voters?.[0]?.count ?? 0),
    ballotsSubmitted: Number(row.anonymous_ballots?.[0]?.count ?? 0),
    positionCount: Number(row.positions?.[0]?.count ?? 0),
  };
}

export async function listElections(options?: {publicOnly?: boolean}): Promise<ElectionSummary[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('elections').select(electionSummarySelect).eq('eligible_voters.eligible', true).order('created_at', {ascending: false});
  if (options?.publicOnly) query = query.in('status', ['open', 'closed', 'published']);
  const response = await query;
  if (response.error?.code === '42703' && response.error.message.includes('anonymous_voting')) {
    const legacySelect = electionSummarySelect.replace('anonymous_voting, ', '');
    let legacyQuery = supabase.from('elections').select(legacySelect).eq('eligible_voters.eligible', true).order('created_at', {ascending: false});
    if (options?.publicOnly) legacyQuery = legacyQuery.in('status', ['open', 'closed', 'published']);
    const legacy = await legacyQuery;
    return (assertData(legacy.data, legacy.error) as any[]).map(mapElectionSummary);
  }
  const rows = assertData(response.data, response.error);
  return (rows as any[]).map(mapElectionSummary);
}

export async function getElection(identifier: string, options?: {publicOnly?: boolean}) {
  const supabase = createServerSupabaseClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  let query = supabase.from('elections').select(electionSelect).eq('eligible_voters.eligible', true).eq(isUuid ? 'id' : 'ballot_slug', identifier);
  if (options?.publicOnly) query = query.in('status', ['open', 'closed', 'published']);
  const {data, error} = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? await mapElection(data) : null;
}

export async function getElectionAvailability(identifier: string): Promise<ElectionAvailability | null> {
  const supabase = createServerSupabaseClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const {data, error} = await supabase
    .from('elections')
    .select('ballot_slug, title, status, opens_at, closes_at')
    .eq(isUuid ? 'id' : 'ballot_slug', identifier)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    ballotSlug: data.ballot_slug,
    title: data.title,
    status: statusFromDb[data.status] ?? 'Draft',
    opensAt: data.opens_at ?? '',
    closesAt: data.closes_at ?? '',
  };
}

export async function getElectionResults(identifier: string, publicOnly = false) {
  const election = await getElection(identifier, {publicOnly});
  if (!election) return null;
  const supabase = createServerSupabaseClient();
  const selections = await fetchAllRows((from, to) => supabase.from('ballot_selections')
    .select('id, position_id, nominee_id, is_abstain, anonymous_ballots!inner(election_id)')
    .eq('anonymous_ballots.election_id', election.id).order('id').range(from, to));
  const results: ElectionResult[] = election.positions.map((position) => {
    const rows = selections.filter((selection: any) => selection.position_id === position.id);
    return {
      position: position.name, group: position.group, total: rows.length,
      abstentions: rows.filter((selection: any) => selection.is_abstain).length,
      nominees: position.nominees.map((nominee) => ({...nominee, votes: rows.filter((selection: any) => selection.nominee_id === nominee.id).length})),
    };
  });
  return {election, results};
}

export async function getIndividualElectionResults(identifier: string): Promise<IndividualVoteRecord[] | null> {
  const election = await getElection(identifier);
  if (!election) return null;

  const supabase = createServerSupabaseClient();
  const submittedBallots = await fetchAllRows((from, to) => supabase.from('anonymous_ballots')
    .select('id, eligible_voter_id, submitted_at')
    .eq('election_id', election.id)
    .order('submitted_at', {ascending: false}).order('id').range(from, to));
  if (!submittedBallots.length) return [];

  const [voters, selections] = await Promise.all([
    election.anonymousVoting ? Promise.resolve([]) : fetchAllRows((from, to) => supabase.from('eligible_voters').select('id, member_id, first_name, last_name, age_group')
      .eq('election_id', election.id).order('id').range(from, to)),
    fetchAllRows((from, to) => supabase.from('ballot_selections')
      .select('id, anonymous_ballot_id, position_id, nominee_id, is_abstain, anonymous_ballots!inner(election_id)')
      .eq('anonymous_ballots.election_id', election.id).order('id').range(from, to)),
  ]);
  const voterById = new Map(voters.map((voter) => [voter.id, voter]));
  const ballotById = new Map(submittedBallots.map((ballot) => [ballot.id, ballot]));
  const positionById = new Map(election.positions.map((position) => [position.id, position]));

  return selections.map((selection) => {
    const ballot = ballotById.get(selection.anonymous_ballot_id);
    const voter = ballot?.eligible_voter_id ? voterById.get(ballot.eligible_voter_id) : undefined;
    const position = positionById.get(selection.position_id);
    return {
      id: selection.id,
      memberId: voter?.member_id ?? 'Unknown',
      voterName: voter ? `${voter.first_name} ${voter.last_name}` : 'Unknown voter',
      ageGroup: voter?.age_group ? groupFromDb[voter.age_group] ?? voter.age_group : 'Unknown',
      submittedAt: ballot?.submitted_at ?? '',
      position: position?.name ?? 'Unknown position',
      choice: selection.is_abstain ? 'Abstain' : position?.nominees.find((nominee) => nominee.id === selection.nominee_id)?.name ?? 'Unknown candidate',
    };
  }).sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
}

export async function getElectionVoters(electionId: string): Promise<EligibleVoter[]> {
  const supabase = createServerSupabaseClient();
  const current = await supabase.from('eligible_voters').select('member_id, first_name, last_name, gender, age, birth_date, age_group, attributes, eligible, participation(submitted_at)').eq('election_id', electionId).order('last_name');
  let rows: any[];
  if (current.error?.code === '42703' && current.error.message.includes('eligible_voters.attributes')) {
    const legacy = await supabase.from('eligible_voters').select('member_id, first_name, last_name, gender, age, birth_date, age_group, eligible, participation(submitted_at)').eq('election_id', electionId).order('last_name');
    rows = assertData(legacy.data, legacy.error);
  } else {
    rows = assertData(current.data, current.error);
  }
  return rows.map((row: any) => ({
    memberId: row.member_id, name: `${row.first_name} ${row.last_name}`, ageGroup: groupFromDb[row.age_group], gender: row.gender, age: row.age, birthDate: row.birth_date,
    attributes: row.attributes ?? {member_id: row.member_id, first_name: row.first_name, last_name: row.last_name, gender: row.gender ?? '', age: String(row.age ?? ''), birth_date: row.birth_date ?? '', age_group: groupFromDb[row.age_group]},
    eligible: row.eligible, hasVoted: Boolean(row.participation?.some((item: any) => item.submitted_at)),
  }));
}

export async function syncElection(election: ElectionEvent, voters?: EligibleVoter[]) {
  const supabase = createServerSupabaseClient();
  const {error: anonymitySchemaError} = await supabase.from('elections').select('anonymous_voting').limit(0);
  if (anonymitySchemaError?.code === '42703') throw new Error('Anonymous voting settings need the latest database migration before elections can be saved.');
  if (anonymitySchemaError) throw new Error(anonymitySchemaError.message);
  if (election.positions.some((position) => position.votingRule?.type === 'custom')) {
    const {error: schemaError} = await supabase.from('positions').select('voting_rule').limit(0);
    if (schemaError?.code === '42703') throw new Error('Custom voting filters need the latest database migration before they can be saved.');
    if (schemaError) throw new Error(schemaError.message);
  }
  const normalizedElection = {
    ...election,
    positions: election.positions.map((position) => ({
      ...position,
      nominees: position.nominees.map((nominee) => ({
        ...nominee,
        imageUrl: normalizeCandidateImageUrl(nominee.imageUrl),
      })),
    })),
  };
  const normalizedVoters = voters?.map((voter) => ({...voter, gender: voter.gender ? normalizeGender(voter.gender) : voter.gender}));
  const {error} = await supabase.rpc('sync_election', {p_election: normalizedElection, p_voters: normalizedVoters ?? null});
  if (error) throw new Error(error.message);
  const saved = await getElection(election.id);
  if (!saved) throw new Error('The election was not saved.');
  return saved;
}

export async function deleteElection(id: string) {
  const {error} = await createServerSupabaseClient().rpc('delete_election', {p_election_id: id});
  if (error) throw new Error(error.message);
}
