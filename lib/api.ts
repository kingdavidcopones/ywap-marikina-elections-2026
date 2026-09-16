import type {ElectionEvent, ElectionResult, EligibleVoter} from './election-data';

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {'Content-Type': 'application/json', ...init?.headers},
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({})) as {message?: string} & T;
  if (!response.ok) throw new Error(body.message ?? 'The request could not be completed.');
  return body;
}

export async function fetchElections() {
  return (await jsonRequest<{elections: ElectionEvent[]}>('/api/elections')).elections;
}

export async function fetchElection(identifier: string) {
  return (await jsonRequest<{election: ElectionEvent}>(`/api/elections/${encodeURIComponent(identifier)}`)).election;
}

export async function fetchResults(identifier: string) {
  return jsonRequest<{election: ElectionEvent; results: ElectionResult[]}>(`/api/elections/${encodeURIComponent(identifier)}/results`);
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
