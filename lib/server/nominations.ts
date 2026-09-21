import 'server-only';
import {createServerSupabaseClient} from '@/lib/supabase';
import {normalizeGender} from '@/lib/csv';
import {NominationError} from '@/lib/server/nomination-errors';
import {isNominationAgeGroup, positionVisibleToAgeGroup, type Nomination, type NominationEntry, type NominationPosition, type NominationStatus, type NominationSummary, type YouthRecord} from '@/lib/nomination-data';

type RecordInput = Omit<YouthRecord, 'id' | 'name' | 'importedAt'>;
const statuses: Record<string, NominationStatus> = {draft: 'Draft', scheduled: 'Scheduled', published: 'Published', archived: 'Archived'};

function check(error: {message: string; code?: string} | null) {
  if (!error) return;
  if (error.code === 'P0001') throw new NominationError(error.message, error.message.includes('not accepting') ? 409 : 400);
  if (error.code === '23505' || error.code === '23503') throw new NominationError('This change conflicts with an existing nomination record.', 409);
  if (error.code === '22P02' || error.code === '23514') throw new NominationError('Check the submitted nomination data.', 400);
  console.error('Nomination database error', error);
  throw new NominationError('The nomination service is temporarily unavailable.', 503);
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function allRows<T>(load: (from: number, to: number) => PromiseLike<{data: T[] | null; error: {message: string} | null}>): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const response = await load(offset, offset + 499);
    check(response.error);
    const batch = response.data ?? [];
    rows.push(...batch);
    if (batch.length < 500) return rows;
  }
}

function mapPosition(row: any): NominationPosition {
  return {id: row.id, name: row.name, required: row.required, shortDescription: row.short_description,
    eligibleAgeGroups: Array.isArray(row.eligible_age_groups) ? row.eligible_age_groups.filter(isNominationAgeGroup) : []};
}

function mapNomineeEntry(entry: any, names: Map<string, string>): NominationEntry {
  return {id: entry.id, nomineeName: entry.nominee_name, positionId: entry.position_id,
    positionName: names.get(entry.position_id) ?? 'Deleted position', youthRecordId: entry.youth_record_id ?? undefined,
    submittedAt: entry.submitted_at, nominatorName: entry.nomination_submissions?.nominator_name ?? undefined};
}

function mapRecord(row: any): YouthRecord {
  return {id: row.id, memberId: row.member_id, name: `${row.first_name} ${row.last_name}`, firstName: row.first_name,
    lastName: row.last_name, ageGroup: row.age_group, gender: row.gender ?? undefined, age: row.age ?? undefined,
    birthDate: row.birth_date ?? undefined, attributes: row.attributes ?? {}, importedAt: row.imported_at};
}

function publicOpen(row: any) {
  const now = Date.now();
  return (row.status === 'published' || (row.status === 'scheduled' && row.opens_at && Date.parse(row.opens_at) <= now))
    && (!row.closes_at || Date.parse(row.closes_at) >= now);
}

export async function listNominations(): Promise<NominationSummary[]> {
  const {data, error} = await createServerSupabaseClient().from('nominations')
    .select('id, slug, name, description, status, opens_at, closes_at, created_at, nomination_positions(count), nomination_entries(count), nomination_youth_records(count)')
    .order('created_at', {ascending: false});
  check(error);
  return (data ?? []).map((row: any) => ({id: row.id, slug: row.slug, name: row.name, description: row.description,
    status: statuses[row.status], opensAt: row.opens_at ?? '', closesAt: row.closes_at ?? '', createdAt: row.created_at,
    positionCount: Number(row.nomination_positions?.[0]?.count ?? 0), nomineeCount: Number(row.nomination_entries?.[0]?.count ?? 0),
    youthRecordCount: Number(row.nomination_youth_records?.[0]?.count ?? 0)}));
}

export async function getNomination(identifier: string, admin = false): Promise<Nomination | null> {
  const supabase = createServerSupabaseClient();
  const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
  const {data: row, error} = await supabase.from('nominations').select('*, nomination_entries(count), nomination_youth_records(count)').eq(isId ? 'id' : 'slug', identifier).maybeSingle();
  check(error);
  if (!row || (!admin && !publicOpen(row))) return null;
  const positions = await allRows<any>((from, to) => supabase.from('nomination_positions').select('*').eq('nomination_id', row.id).order('display_order').range(from, to));
  return {id: row.id, slug: row.slug, name: row.name, description: row.description, status: statuses[row.status],
    opensAt: row.opens_at ?? '', closesAt: row.closes_at ?? '', createdAt: row.created_at, updatedAt: row.updated_at,
    positions: positions.map(mapPosition), nomineeCount: admin ? Number(row.nomination_entries?.[0]?.count ?? 0) : 0,
    youthRecordCount: admin ? Number(row.nomination_youth_records?.[0]?.count ?? 0) : 0,
    youthRecords: [], nominees: []};
}

export async function getNominationAvailability(slug: string) {
  const {data, error} = await createServerSupabaseClient().from('nominations')
    .select('name, status, opens_at, closes_at').eq('slug', slug).maybeSingle();
  check(error);
  return data ? {name: data.name, status: statuses[data.status], opensAt: data.opens_at ?? '', closesAt: data.closes_at ?? ''} : null;
}

export async function getNominationNominees(id: string, page: number) {
  const nomination = await getNomination(id, true);
  if (!nomination) throw new NominationError('Nomination not found.', 404);
  if (!Number.isInteger(page) || page < 1) throw new NominationError('Choose a valid page.');
  const from = (page - 1) * 10;
  const {data, count, error} = await createServerSupabaseClient().from('nomination_entries')
    .select('id, nominee_name, position_id, youth_record_id, submitted_at, nomination_submissions(nominator_name)', {count: 'exact'})
    .eq('nomination_id', nomination.id).order('submitted_at', {ascending: false}).order('id').range(from, from + 9);
  check(error);
  const names = new Map(nomination.positions.map((position) => [position.id, position.name]));
  return {nominees: (data ?? []).map((entry) => mapNomineeEntry(entry, names)), total: count ?? 0};
}

export async function getAllNominationNominees(id: string) {
  const nomination = await getNomination(id, true);
  if (!nomination) throw new NominationError('Nomination not found.', 404);
  const rows = await allRows<any>((from, to) => createServerSupabaseClient().from('nomination_entries')
    .select('id, nominee_name, position_id, youth_record_id, submitted_at, nomination_submissions(nominator_name)')
    .eq('nomination_id', nomination.id).order('submitted_at', {ascending: false}).order('id').range(from, to));
  const names = new Map(nomination.positions.map((position) => [position.id, position.name]));
  return rows.map((entry) => mapNomineeEntry(entry, names));
}

export async function getNominationYouthRecords(id: string, page: number) {
  const nomination = await getNomination(id, true);
  if (!nomination) throw new NominationError('Nomination not found.', 404);
  if (!Number.isInteger(page) || page < 1) throw new NominationError('Choose a valid page.');
  const from = (page - 1) * 10;
  const {data, count, error} = await createServerSupabaseClient().from('nomination_youth_records')
    .select('id, member_id, first_name, last_name, age_group, gender, age, birth_date, attributes, imported_at', {count: 'exact'})
    .eq('nomination_id', nomination.id).order('last_name').order('id').range(from, from + 9);
  check(error);
  return {records: (data ?? []).map(mapRecord), total: count ?? 0};
}

export async function createNomination(name: string, description: string) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < 2 || trimmed.length > 160 || typeof description !== 'string' || description.length > 2000) throw new NominationError('Enter a nomination name of 2–160 characters and a description under 2,000 characters.');
  const slug = `${trimmed.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 36) || 'nomination'}-${crypto.randomUUID().replaceAll('-', '').slice(0, 8)}`;
  const {data, error} = await createServerSupabaseClient().from('nominations').insert({slug, name: trimmed, description: description.trim()}).select('id').single();
  check(error);
  return getNomination(data!.id, true);
}

export async function updateNomination(id: string, action: any) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) throw new NominationError('Choose a valid nomination action.');
  const supabase = createServerSupabaseClient();
  const current = await getNomination(id, true);
  if (!current) throw new NominationError('Nomination not found.', 404);
  if (action.type === 'details') {
    if (typeof action.name !== 'string' || action.name.trim().length < 2 || action.name.trim().length > 160 || typeof action.description !== 'string' || action.description.length > 2000) throw new NominationError('Enter a nomination name of 2–160 characters and a description under 2,000 characters.');
    const slug = typeof action.slug === 'string' ? action.slug.trim().toLocaleLowerCase('en').replace(/[^a-z0-9-]+/g, '-').replace(/(^-|-$)/g, '') : '';
    if (!slug) throw new NominationError('Use at least one letter or number in the nomination link ending.');
    check((await supabase.from('nominations').update({name: action.name.trim(), description: action.description.trim(), slug, updated_at: new Date().toISOString()}).eq('id', id)).error);
  } else if (action.type === 'status') {
    const status = action.status as NominationStatus;
    if (!['Draft', 'Scheduled', 'Published', 'Archived'].includes(status)) throw new NominationError('Invalid nomination status.');
    const allowed: Record<NominationStatus, NominationStatus[]> = {
      Draft: ['Draft', 'Scheduled', 'Published', 'Archived'],
      Scheduled: ['Draft', 'Archived'],
      Published: ['Draft', 'Archived'],
      Archived: ['Draft'],
    };
    if (!allowed[current.status].includes(status)) throw new NominationError('Unpublish or restore this nomination before changing its status.', 409);
    if ((status === 'Published' || status === 'Scheduled') && !current.positions.length) throw new NominationError('Add at least one position before publishing.');
    let opensAt: string | null = null;
    let closesAt: string | null = null;
    if (status === 'Scheduled') {
      if (typeof action.opensAt !== 'string' || typeof action.closesAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(action.opensAt) || !/^\d{4}-\d{2}-\d{2}T/.test(action.closesAt)) throw new NominationError('Choose valid opening and closing times.');
      const openTime = Date.parse(action.opensAt);
      const closeTime = Date.parse(action.closesAt);
      if (!Number.isFinite(openTime) || !Number.isFinite(closeTime) || openTime <= Date.now() || closeTime <= openTime) throw new NominationError('Choose a future opening time and a later closing time.');
      opensAt = new Date(openTime).toISOString();
      closesAt = new Date(closeTime).toISOString();
    }
    check((await supabase.from('nominations').update({status: status.toLowerCase(), opens_at: opensAt, closes_at: closesAt, updated_at: new Date().toISOString()}).eq('id', id)).error);
  } else if (action.type === 'position') {
    if (current.status !== 'Draft') throw new NominationError('Unpublish the nomination before editing positions.', 409);
    const name = typeof action.name === 'string' ? action.name.trim() : '';
    if (name.length < 2 || name.length > 120) throw new NominationError('Enter a position name of 2–120 characters.');
    if (current.positions.some((position) => position.id !== action.positionId && position.name.toLocaleLowerCase('en') === name.toLocaleLowerCase('en'))) throw new NominationError('A position with this name already exists.', 409);
    const eligibleAgeGroups = action.eligibleAgeGroups === undefined
      ? current.positions.find((position) => position.id === action.positionId)?.eligibleAgeGroups ?? []
      : action.eligibleAgeGroups;
    if (!Array.isArray(eligibleAgeGroups) || eligibleAgeGroups.length > 3 || eligibleAgeGroups.some((group: unknown) => !isNominationAgeGroup(group)) || new Set(eligibleAgeGroups).size !== eligibleAgeGroups.length) throw new NominationError('Choose valid age groups for this position.');
    if (typeof action.required !== 'boolean' || typeof action.shortDescription !== 'string' || action.shortDescription.length > 80) throw new NominationError('Check the required flag and short role description.');
    const values = {name, eligible_age_groups: eligibleAgeGroups, required: action.required, short_description: action.shortDescription.trim()};
    if (action.positionId) {
      if (!current.positions.some((position) => position.id === action.positionId)) throw new NominationError('Position not found.', 404);
      check((await supabase.from('nomination_positions').update(values).eq('id', action.positionId).eq('nomination_id', id)).error);
    } else {
      const {data: lastPosition, error: orderError} = await supabase.from('nomination_positions').select('display_order')
        .eq('nomination_id', id).order('display_order', {ascending: false}).limit(1);
      check(orderError);
      check((await supabase.from('nomination_positions').insert({...values, nomination_id: id,
        display_order: Number(lastPosition?.[0]?.display_order ?? 0) + 1})).error);
    }
  } else if (action.type === 'delete-position') {
    if (current.status !== 'Draft') throw new NominationError('Unpublish the nomination before editing positions.', 409);
    if (!current.positions.some((position) => position.id === action.positionId)) throw new NominationError('Position not found.', 404);
    check((await supabase.from('nomination_positions').delete().eq('id', action.positionId).eq('nomination_id', id)).error);
  } else if (action.type === 'records') {
    if (current.status !== 'Draft') throw new NominationError('Unpublish the nomination before changing Youth Records.', 409);
    if (action.mode !== 'add' && action.mode !== 'replace') throw new NominationError('Choose add or replace for the Youth Records upload.');
    const records = action.records as RecordInput[];
    if (!Array.isArray(records) || !records.length || records.length > 10000) throw new NominationError('Choose a CSV with 1–10,000 Youth Records.');
    const seen = new Set<string>();
    records.forEach((record) => {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw new NominationError('Each Youth Record must be a valid row.');
      const memberId = typeof record.memberId === 'string' ? record.memberId.trim() : '';
      const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : '';
      const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : '';
      const ageGroup = typeof record.ageGroup === 'string' ? record.ageGroup.trim() : '';
      if (!memberId || memberId.length > 120 || !firstName || firstName.length > 120 || !lastName || lastName.length > 120 || !ageGroup || ageGroup.length > 80 || !Number.isInteger(record.age) || record.age! < 0 || record.age! > 120 || !validDate(record.birthDate) || (record.gender && (typeof record.gender !== 'string' || record.gender.length > 80))) throw new NominationError('Every Youth Record needs a valid Member ID, name, age, birth date, and age group.');
      if (!record.attributes || typeof record.attributes !== 'object' || Array.isArray(record.attributes) || Object.keys(record.attributes).length > 100 || Object.values(record.attributes).some((value) => typeof value !== 'string') || JSON.stringify(record.attributes).length > 20000) throw new NominationError('Youth Record columns must contain text and stay under 20 KB per row.');
      const normalized = memberId.toUpperCase();
      if (seen.has(normalized)) throw new NominationError(`Duplicate Member ID: ${memberId}.`);
      seen.add(normalized);
    });
    const normalizedRecords = records.map((record) => ({...record, gender: record.gender ? normalizeGender(record.gender) : record.gender}));
    check((await supabase.rpc('save_nomination_youth_records', {p_nomination_id: id, p_mode: action.mode, p_records: normalizedRecords})).error);
  } else if (action.type === 'delete-nominee') {
    const {data: deleted, error: deleteError} = await supabase.from('nomination_entries').delete().eq('id', action.nomineeId).eq('nomination_id', id).select('id').maybeSingle();
    check(deleteError);
    if (!deleted) throw new NominationError('Nominee not found.', 404);
  } else {
    throw new NominationError('Unknown nomination action.');
  }
  if (action.type !== 'details' && action.type !== 'status') {
    check((await supabase.from('nominations').update({updated_at: new Date().toISOString()}).eq('id', id)).error);
  }
  return getNomination(id, true);
}

export async function deleteNomination(id: string) {
  const current = await getNomination(id, true);
  if (!current) throw new NominationError('Nomination not found.', 404);
  if (current.status !== 'Draft' && current.status !== 'Archived') throw new NominationError('Unpublish the nomination before deleting it.', 409);
  const {data, error} = await createServerSupabaseClient().from('nominations').delete().eq('id', current.id).select('id').maybeSingle();
  check(error);
  if (!data) throw new NominationError('Nomination not found.', 404);
}

export async function searchYouthRecords(identifier: string, term: string, admin = false) {
  const nomination = await getNomination(identifier, admin);
  if (!nomination) throw new NominationError('This nomination is unavailable.', 404);
  if (typeof term !== 'string' || term.trim().length < 2) return [];
  const query = term.trim().replaceAll('%', '\\%').replaceAll('_', '\\_').slice(0, 80);
  const {data, error} = await createServerSupabaseClient().from('nomination_youth_records')
    .select('id, member_id, first_name, last_name, age_group').eq('nomination_id', nomination.id)
    .ilike('full_name', `%${query}%`).ilike('attributes->>nominee', 'yes').order('last_name').limit(10);
  check(error);
  return (data ?? []).map((row) => ({id: row.id, name: `${row.first_name} ${row.last_name}`, ageGroup: row.age_group}));
}

export async function submitNomination(identifier: string, ageGroup: unknown, name: unknown, choices: Record<string, {name: string; youthRecordId?: string}>) {
  const nomination = await getNomination(identifier);
  if (!nomination) throw new NominationError('This nomination is not accepting responses.', 404);
  if (!isNominationAgeGroup(ageGroup)) throw new NominationError('Choose your age group before submitting.');
  if (name !== undefined && (typeof name !== 'string' || name.trim().length > 160)) throw new NominationError('Use at most 160 characters for your name.');
  const positions = nomination.positions.filter((position) => positionVisibleToAgeGroup(position, ageGroup));
  if (!choices || typeof choices !== 'object' || Array.isArray(choices) || !positions.length
    || Object.keys(choices).some((id) => !positions.some((position) => position.id === id))) throw new NominationError('Complete every required position available to your age group.');
  for (const position of positions) {
    const choice = choices[position.id];
    if (choice !== undefined && (!choice || typeof choice !== 'object' || Array.isArray(choice) || typeof choice.name !== 'string')) throw new NominationError(`Enter a valid nominee for ${position.name}.`);
    const nomineeName = choice?.name.trim() ?? '';
    if (!nomineeName) {
      if (position.required) throw new NominationError(`Enter a nominee for ${position.name}.`);
      continue;
    }
    if (nomineeName.length < 2 || nomineeName.length > 160 || (choice.youthRecordId !== undefined && !validUuid(choice.youthRecordId))) throw new NominationError(`Enter a valid nominee for ${position.name}.`);
  }
  const {data, error} = await createServerSupabaseClient().rpc('submit_nomination', {p_nomination_id: nomination.id, p_age_group: ageGroup,
    p_nominator_name: typeof name === 'string' && name.trim() ? name.trim() : null, p_choices: choices});
  if (error?.code === 'PGRST202') {
    console.error('The nomination age-group database migration has not been applied.', error);
    throw new NominationError('We couldn’t record your nominations right now. Please contact the election committee.', 503);
  }
  check(error);
  return data as string;
}
