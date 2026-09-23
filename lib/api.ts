import type {ElectionEvent, ElectionResult, ElectionSummary, EligibleVoter, IndividualVoteRecord} from './election-data';
import type {Nomination, NominationEntry, NominationSummary, YouthRecord} from './nomination-data';
import {isNetworkError, reportNetworkError} from './network-error';

export type ElectionAvailability = Pick<ElectionEvent, 'ballotSlug' | 'title' | 'status' | 'opensAt' | 'closesAt'>;

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {'Content-Type': 'application/json', ...init?.headers},
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({})) as {message?: string} & T;
    if (!response.ok) throw new Error(body.message ?? 'The request could not be completed.');
    return body;
  } catch (error) {
    if (isNetworkError(error)) reportNetworkError();
    throw error;
  }
}

export async function fetchElections() {
  return (await jsonRequest<{elections: ElectionSummary[]}>('/api/elections')).elections;
}

export async function fetchNominations() {
  return (await jsonRequest<{nominations: NominationSummary[]}>('/api/admin/nominations')).nominations;
}

export async function createNomination(name: string, description: string) {
  return (await jsonRequest<{nomination: Nomination}>('/api/admin/nominations', {
    method: 'POST', body: JSON.stringify({name, description}),
  })).nomination;
}

export async function fetchAdminNomination(id: string) {
  return (await jsonRequest<{nomination: Nomination}>(`/api/admin/nominations/${encodeURIComponent(id)}`)).nomination;
}

export async function fetchNominationNominees(id: string, page: number, all = false) {
  const params = all ? 'all=true' : `page=${page}`;
  return jsonRequest<{nominees: NominationEntry[]; total: number}>(`/api/admin/nominations/${encodeURIComponent(id)}/nominees?${params}`);
}

export async function fetchNominationYouthRecords(id: string, page: number) {
  return jsonRequest<{records: YouthRecord[]; total: number}>(`/api/admin/nominations/${encodeURIComponent(id)}/youth-records?page=${page}`);
}

export async function updateAdminNomination(id: string, action: Record<string, unknown>) {
  return (await jsonRequest<{nomination: Nomination}>(`/api/admin/nominations/${encodeURIComponent(id)}`, {
    method: 'PATCH', body: JSON.stringify(action),
  })).nomination;
}

export async function removeNomination(id: string) {
  await jsonRequest<{ok: true}>(`/api/admin/nominations/${encodeURIComponent(id)}`, {method: 'DELETE'});
}

export async function fetchPublicNomination(slug: string) {
  return jsonRequest<{nomination: Nomination; preview: boolean}>(`/api/nominations/${encodeURIComponent(slug)}`);
}

export type NominationAvailability = Pick<Nomination, 'name' | 'status' | 'opensAt' | 'closesAt'>;

export async function fetchNominationAvailability(slug: string) {
  return (await jsonRequest<{availability: NominationAvailability}>(`/api/nominations/${encodeURIComponent(slug)}/availability`)).availability;
}

export async function fetchElection(identifier: string) {
  return (await jsonRequest<{election: ElectionEvent}>(`/api/elections/${encodeURIComponent(identifier)}`)).election;
}

export async function fetchEligiblePositionIds() {
  return (await jsonRequest<{eligiblePositionIds: string[]}>('/api/ballots')).eligiblePositionIds;
}

export async function fetchElectionAvailability(identifier: string) {
  return (await jsonRequest<{election: ElectionAvailability}>(`/api/elections/${encodeURIComponent(identifier)}/availability`)).election;
}

export async function fetchResults(identifier: string) {
  return jsonRequest<{election: ElectionEvent; results: ElectionResult[]}>(`/api/elections/${encodeURIComponent(identifier)}/results`);
}

export async function fetchIndividualResults(eventId: string) {
  return (await jsonRequest<{records: IndividualVoteRecord[]}>(`/api/admin/elections/${encodeURIComponent(eventId)}/individual-results`)).records;
}

export async function uploadCandidateImage(nomineeId: string, file: File) {
  const formData = new FormData();
  formData.set('file', file);
  const response = await fetch(`/api/admin/nominees/${encodeURIComponent(nomineeId)}/image`, {
    method: 'POST',
    body: formData,
  });
  const body = await response.json().catch(() => ({})) as {imageUrl?: string; message?: string};
  if (!response.ok || !body.imageUrl) throw new Error(body.message ?? 'The candidate image could not be uploaded.');
  return body.imageUrl;
}

export async function saveElection(election: ElectionEvent, voters?: EligibleVoter[]) {
  return (await jsonRequest<{election: ElectionEvent}>(`/api/admin/elections/${election.id}`, {
    method: 'PUT', body: JSON.stringify({election, voters}),
  })).election;
}

export async function createElection(election: ElectionEvent, voters: EligibleVoter[]) {
  return (await jsonRequest<{election: ElectionEvent}>('/api/admin/elections', {
    method: 'POST', body: JSON.stringify({election, voters}),
  })).election;
}

export async function removeElection(id: string) {
  await jsonRequest<{ok: true}>(`/api/admin/elections/${id}`, {method: 'DELETE'});
}

export async function fetchVoters(electionId: string) {
  return (await jsonRequest<{voters: EligibleVoter[]}>(`/api/admin/elections/${electionId}/voters`)).voters;
}
