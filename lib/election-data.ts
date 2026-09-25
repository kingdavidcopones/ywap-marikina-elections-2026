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
  nomineeEligible?: boolean;
  attributes?: Record<string, string>;
};

export type PositionFilter = {
  column: string;
  condition: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_empty' | 'is_not_empty';
  value: string;
  join?: 'and' | 'or';
};

export type VotingRule = {type: 'all' | 'custom'; filters: PositionFilter[]};

export type Position = {
  id: string;
  name: string;
  group: 'General' | 'Teens' | 'Young People' | 'Young Adults';
  description: string;
  responsibilities: string[];
  abstainEnabled: boolean;
  votingRule?: VotingRule;
  nominees: Nominee[];
};

export type ElectionEvent = {
  id: string;
  ballotSlug: string;
  anonymousVoting: boolean;
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

export type ElectionSummary = Omit<ElectionEvent, 'positions'> & {
  positionCount: number;
};

export type ElectionResult = {
  position: string;
  group: Position['group'];
  total: number;
  abstentions: number;
  nominees: Array<Nominee & {votes: number}>;
};

export interface IndividualVoteRecord extends Record<string, unknown> {
  id: string;
  ballotId: string;
  memberId: string;
  voterName: string;
  ageGroup: string;
  submittedAt: string;
  position: string;
  choice: string;
}

export function positionsForEventGroup(event: ElectionEvent, group: string) {
  return event.positions.filter((position) => position.group === 'General' || position.group === group);
}

export function positionMatchesVoter(position: Pick<Position, 'group' | 'votingRule'>, voter: EligibleVoter) {
  const rule = position.votingRule;
  if (!rule || rule.type === 'all') return position.group === 'General' || position.group === voter.ageGroup;
  if (rule.type !== 'custom') return false;
  if (!rule.filters.length || rule.filters.length > 5) return false;
  let matches = false;
  for (const [index, filter] of rule.filters.entries()) {
    const actual = (voter.attributes?.[filter.column] ?? '').trim().toLocaleLowerCase('en');
    const expected = filter.value.trim().toLocaleLowerCase('en');
    const result = filter.condition === 'equals' ? actual === expected
      : filter.condition === 'not_equals' ? actual !== expected
      : filter.condition === 'contains' ? actual.includes(expected)
      : filter.condition === 'not_contains' ? !actual.includes(expected)
      : filter.condition === 'is_empty' ? actual === ''
      : filter.condition === 'is_not_empty' ? actual !== ''
      : false;
    matches = index === 0 ? result : filter.join === 'or' ? matches || result : matches && result;
  }
  return matches;
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
