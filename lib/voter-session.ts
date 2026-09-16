export type VoterSession = {
  memberId: string;
  firstName: string;
  ageGroup: string;
  ballotSlug?: string;
};

export type BallotDraft = {
  positionIndex: number;
  selections: Record<string, string>;
};

const VOTER_KEY = 'ywap-voter-session';
const DRAFT_KEY = 'ywap-ballot-draft';
const SUBMITTED_KEY = 'ywap-ballot-submitted';

export function getVoterSession(): VoterSession | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(VOTER_KEY);
  return value ? JSON.parse(value) as VoterSession : null;
}

export function saveVoterSession(voter: VoterSession) {
  window.sessionStorage.setItem(VOTER_KEY, JSON.stringify(voter));
}

export function getBallotDraft(): BallotDraft {
  if (typeof window === 'undefined') return {positionIndex: 0, selections: {}};
  const value = window.sessionStorage.getItem(DRAFT_KEY);
  return value ? JSON.parse(value) as BallotDraft : {positionIndex: 0, selections: {}};
}

export function saveBallotDraft(draft: BallotDraft) {
  window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function markSubmitted(submittedAt = new Date().toISOString()) {
  window.sessionStorage.setItem(SUBMITTED_KEY, submittedAt);
  window.sessionStorage.removeItem(DRAFT_KEY);
}

export function getSubmissionTime() {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(SUBMITTED_KEY);
}

export function clearVoterSession() {
  window.sessionStorage.removeItem(VOTER_KEY);
  window.sessionStorage.removeItem(DRAFT_KEY);
}
