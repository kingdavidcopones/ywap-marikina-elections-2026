import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  clearVoterSession,
  getBallotDraft,
  getSubmissionReceipt,
  getVoterSession,
  markSubmitted,
  saveBallotDraft,
  saveVoterSession,
} from '../lib/voter-session.ts';

const firstVoter = {
  memberId: 'YWAP-1', firstName: 'Elisha', ageGroup: 'Teens',
  ballotSlug: 'election', eligiblePositionIds: ['general'],
};
const secondVoter = {
  memberId: 'YWAP-2', firstName: 'Asher', ageGroup: 'Young People',
  ballotSlug: 'election', eligiblePositionIds: ['general', 'young-people'],
};

function withSessionStorage(run) {
  const previousWindow = globalThis.window;
  const values = new Map();
  globalThis.window = {sessionStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }};
  try {
    run();
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
}

test('a different member ID with the same last name gets a fresh ballot state', () => withSessionStorage(() => {
  saveVoterSession(firstVoter);
  markSubmitted('2026-09-17T04:00:00Z', 'Election', 'election');
  saveBallotDraft({positionIndex: 1, selections: {'general': 'first-choice'}});

  saveVoterSession(secondVoter);

  assert.equal(getVoterSession()?.memberId, secondVoter.memberId);
  assert.equal(getSubmissionReceipt(), null);
  assert.deepEqual(getBallotDraft(), {positionIndex: 0, selections: {}});
}));

test('eligibility refresh for the same member keeps their draft and receipt', () => withSessionStorage(() => {
  saveVoterSession(firstVoter);
  saveBallotDraft({positionIndex: 0, selections: {'general': 'first-choice'}});
  saveVoterSession({...firstVoter, eligiblePositionIds: ['general', 'teens']});
  assert.deepEqual(getBallotDraft().selections, {'general': 'first-choice'});

  markSubmitted('2026-09-17T04:00:00Z', 'Election', 'election');
  saveVoterSession({...firstVoter, eligiblePositionIds: ['general', 'teens']});
  assert.equal(getSubmissionReceipt()?.submittedAt, '2026-09-17T04:00:00Z');
}));

test('changing elections or clearing the voter session removes old ballot state', () => withSessionStorage(() => {
  saveVoterSession(firstVoter);
  markSubmitted('2026-09-17T04:00:00Z', 'Election', 'election');
  saveVoterSession({...firstVoter, ballotSlug: 'another-election'});
  assert.equal(getSubmissionReceipt(), null);

  markSubmitted('2026-09-17T05:00:00Z', 'Another election', 'another-election');
  clearVoterSession();
  assert.equal(getVoterSession(), null);
  assert.equal(getSubmissionReceipt(), null);
}));
