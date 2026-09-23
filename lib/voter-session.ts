export type VoterSession = {
  memberId: string;
  firstName: string;
  ageGroup: string;
  eligiblePositionIds: string[];
  ballotSlug?: string;
};

export type BallotDraft = {
  positionIndex: number;
  selections: Record<string, string>;
};

export type SubmissionReceipt = {
  submittedAt: string;
  electionTitle?: string;
  ballotSlug?: string;
  anonymousVoting?: boolean;
};

const VOTER_KEY = 'ywap-voter-session';
const DRAFT_KEY = 'ywap-ballot-draft';
const SUBMITTED_KEY = 'ywap-ballot-submitted';
const VERIFICATION_TRANSITION_KEY = 'ywap-verification-transition';

export function markVerificationTransition(ballotSlug: string) {
  window.sessionStorage.setItem(VERIFICATION_TRANSITION_KEY, JSON.stringify({ballotSlug, startedAt: Date.now()}));
}

export function consumeVerificationTransition(ballotSlug: string): boolean {
  if (typeof window === 'undefined') return false;
  const value = window.sessionStorage.getItem(VERIFICATION_TRANSITION_KEY);
  window.sessionStorage.removeItem(VERIFICATION_TRANSITION_KEY);
  if (!value) return false;
  try {
    const transition = JSON.parse(value) as {ballotSlug?: string; startedAt?: number};
    return transition.ballotSlug === ballotSlug && typeof transition.startedAt === 'number'
      && Date.now() - transition.startedAt < 60_000;
  } catch {
    return false;
  }
}

export function getVoterSession(): VoterSession | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(VOTER_KEY);
  return value ? JSON.parse(value) as VoterSession : null;
}

export function saveVoterSession(voter: VoterSession) {
  const previous = getVoterSession();
  if (!previous || previous.memberId !== voter.memberId || previous.ballotSlug !== voter.ballotSlug) {
    window.sessionStorage.removeItem(DRAFT_KEY);
    window.sessionStorage.removeItem(SUBMITTED_KEY);
  }
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

export function markSubmitted(submittedAt = new Date().toISOString(), electionTitle?: string, ballotSlug?: string, anonymousVoting?: boolean) {
  const receipt: SubmissionReceipt = {
    submittedAt,
    ...(electionTitle ? {electionTitle} : {}),
    ...(ballotSlug ? {ballotSlug} : {}),
    ...(typeof anonymousVoting === 'boolean' ? {anonymousVoting} : {}),
  };
  window.sessionStorage.setItem(SUBMITTED_KEY, JSON.stringify(receipt));
  window.sessionStorage.removeItem(DRAFT_KEY);
}

export function getSubmissionReceipt(): SubmissionReceipt | null {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(SUBMITTED_KEY);
  if (!value) return null;

  try {
    const receipt = JSON.parse(value) as Partial<SubmissionReceipt>;
    if (typeof receipt.submittedAt === 'string') {
      return {
        submittedAt: receipt.submittedAt,
        ...(typeof receipt.electionTitle === 'string' ? {electionTitle: receipt.electionTitle} : {}),
        ...(typeof receipt.ballotSlug === 'string' ? {ballotSlug: receipt.ballotSlug} : {}),
        ...(typeof receipt.anonymousVoting === 'boolean' ? {anonymousVoting: receipt.anonymousVoting} : {}),
      };
    }
  } catch {
    // Older sessions stored only the ISO submission time as plain text.
  }

  return {submittedAt: value};
}

export function getSubmissionTime() {
  return getSubmissionReceipt()?.submittedAt ?? null;
}

export function clearVoterSession() {
  window.sessionStorage.removeItem(VOTER_KEY);
  window.sessionStorage.removeItem(DRAFT_KEY);
  window.sessionStorage.removeItem(SUBMITTED_KEY);
  window.sessionStorage.removeItem(VERIFICATION_TRANSITION_KEY);
}
