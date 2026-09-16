export type ElectionStatus = 'Draft' | 'Scheduled' | 'Open' | 'Closed' | 'Published' | 'Archived';

export type Nominee = {
  id: string;
  name: string;
  profile: string;
  ageGroup?: string;
  imageUrl?: string;
  votes?: number;
};

export type EligibleVoter = {
  memberId: string;
  name: string;
  firstName?: string;
  lastName?: string;
  ageGroup: string;
  gender?: string;
  age?: number;
  birthDate?: string;
  hasVoted?: boolean;
  eligible?: boolean;
};

export type Position = {
  id: string;
  name: string;
  group: 'General' | 'Teens' | 'Young People' | 'Young Adults';
  description: string;
  responsibilities: string[];
  abstainEnabled: boolean;
  nominees: Nominee[];
};

export type ElectionEvent = {
  id: string;
  ballotSlug: string;
  title: string;
  description: string;
  status: ElectionStatus;
  electionDate: string;
  opensAt: string;
  closesAt: string;
  eligibleVoters: number;
  eligibleVoterIds?: string[];
  ballotsSubmitted: number;
  positions: Position[];
};

export type ElectionResult = {
  position: string;
  group: Position['group'];
  total: number;
  abstentions: number;
  nominees: Array<Nominee & {votes: number}>;
};

export function positionsForEventGroup(event: ElectionEvent, group: string) {
  return event.positions.filter((position) => position.group === 'General' || position.group === group);
}

export function eligibleVotersForEvent(event: ElectionEvent, voters: EligibleVoter[]) {
  if (!event.eligibleVoterIds) return voters;
  const eligibleIds = new Set(event.eligibleVoterIds);
  return voters.filter((voter) => eligibleIds.has(voter.memberId));
}

export function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const next = [...items];
  let hash = Array.from(seed).reduce((value, character) => ((value << 5) - value + character.charCodeAt(0)) | 0, 0);
  for (let index = next.length - 1; index > 0; index -= 1) {
    hash = (hash * 1664525 + 1013904223) | 0;
    const target = Math.abs(hash) % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}
