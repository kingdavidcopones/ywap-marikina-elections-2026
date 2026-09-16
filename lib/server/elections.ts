import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase';
import type {ElectionEvent, ElectionResult, EligibleVoter, Position} from '@/lib/election-data';

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

async function counts(electionId: string) {
  const supabase = createServerSupabaseClient();
  const [eligible, ballots] = await Promise.all([
    supabase.from('eligible_voters').select('*', {count: 'exact', head: true}).eq('election_id', electionId).eq('eligible', true),
    supabase.from('anonymous_ballots').select('*', {count: 'exact', head: true}).eq('election_id', electionId),
  ]);
  if (eligible.error) throw new Error(eligible.error.message);
  if (ballots.error) throw new Error(ballots.error.message);
  return {eligibleVoters: eligible.count ?? 0, ballotsSubmitted: ballots.count ?? 0};
}

async function mapElection(row: any): Promise<ElectionEvent> {
  const totals = await counts(row.id);
  const positions = (row.positions ?? []).sort((a: any, b: any) => a.display_order - b.display_order).map((position: any) => ({
    id: position.id,
    name: position.name,
    group: groupFromDb[position.group_scope] ?? 'General',
    description: position.description,
    responsibilities: Array.isArray(position.responsibilities) ? position.responsibilities : [],
    abstainEnabled: position.abstain_enabled,
    nominees: (position.nominees ?? []).filter((item: any) => item.active).sort((a: any, b: any) => a.display_order - b.display_order).map((nominee: any) => ({
      id: nominee.id, name: nominee.full_name, profile: nominee.short_profile ?? '', ageGroup: nominee.age_group ? groupFromDb[nominee.age_group] : undefined, imageUrl: nominee.image_url ?? undefined,
    })),
  }));
  return {
    id: row.id, ballotSlug: row.ballot_slug, title: row.title, description: row.description,
    status: statusFromDb[row.status] ?? 'Draft', electionDate: row.election_date ?? '', opensAt: row.opens_at ?? '', closesAt: row.closes_at ?? '',
    ...totals, positions,
  };
}

const electionSelect = '*, positions(*, nominees(*))';

export async function listElections(options?: {publicOnly?: boolean}) {
  const supabase = createServerSupabaseClient();
  let query = supabase.from('elections').select(electionSelect).order('created_at', {ascending: false});
  if (options?.publicOnly) query = query.in('status', ['open', 'closed', 'published']);
  const {data, error} = await query;
  const rows = assertData(data, error);
  return Promise.all((rows as any[]).map(mapElection));
}

export async function getElection(identifier: string, options?: {publicOnly?: boolean}) {
  const supabase = createServerSupabaseClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  let query = supabase.from('elections').select(electionSelect).eq(isUuid ? 'id' : 'ballot_slug', identifier);
  if (options?.publicOnly) query = query.in('status', ['open', 'closed', 'published']);
  const {data, error} = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapElection(data) : null;
}

export async function getElectionResults(identifier: string, publicOnly = false) {
  const election = await getElection(identifier, {publicOnly});
  if (!election) return null;
  const supabase = createServerSupabaseClient();
  const {data, error} = await supabase.from('ballot_selections').select('position_id, nominee_id, is_abstain, anonymous_ballots!inner(election_id)').eq('anonymous_ballots.election_id', election.id);
  const selections = assertData(data, error);
  const results: ElectionResult[] = election.positions.map((position) => {
    const rows = selections.filter((selection: any) => selection.position_id === position.id);
    return {
      position: position.name, group: position.group, total: election.ballotsSubmitted,
      abstentions: rows.filter((selection: any) => selection.is_abstain).length,
      nominees: position.nominees.map((nominee) => ({...nominee, votes: rows.filter((selection: any) => selection.nominee_id === nominee.id).length})),
    };
  });
  return {election, results};
}

export async function getElectionVoters(electionId: string): Promise<EligibleVoter[]> {
  const supabase = createServerSupabaseClient();
  const {data, error} = await supabase.from('eligible_voters').select('member_id, first_name, last_name, gender, age, birth_date, age_group, eligible, participation(submitted_at)').eq('election_id', electionId).order('last_name');
  return assertData(data, error).map((row: any) => ({
    memberId: row.member_id, name: `${row.first_name} ${row.last_name}`, ageGroup: groupFromDb[row.age_group], gender: row.gender, age: row.age, birthDate: row.birth_date,
    eligible: row.eligible, hasVoted: Boolean(row.participation?.some((item: any) => item.submitted_at)),
  }));
}

export async function syncElection(election: ElectionEvent, voters?: EligibleVoter[]) {
  const supabase = createServerSupabaseClient();
  const {error} = await supabase.rpc('sync_election', {p_election: election, p_voters: voters ?? null});
  if (error) throw new Error(error.message);
  const saved = await getElection(election.id);
  if (!saved) throw new Error('The election was not saved.');
  return saved;
}

export async function deleteElection(id: string) {
  const {error} = await createServerSupabaseClient().rpc('delete_election', {p_election_id: id});
  if (error) throw new Error(error.message);
}
