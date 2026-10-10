import {expect, test} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

test('anonymous ballots save each candidate and abstention with accurate totals', async ({page}) => {
  test.skip(process.env.RUN_DATABASE_E2E !== '1', 'Requires an explicitly enabled database-backed test run.');
  test.setTimeout(120_000);

  const adminPassword = process.env.ADMIN_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminPassword || !supabaseUrl || !serviceRole) throw new Error('Admin and Supabase test credentials are required.');
  const database = createClient(supabaseUrl, serviceRole, {auth: {persistSession: false, autoRefreshToken: false}});

  const electionId = crypto.randomUUID();
  const suffix = electionId.slice(0, 8).toUpperCase();
  const slug = `e2e-anonymous-vote-${electionId.slice(0, 8)}`;
  const positionIds = {president: crypto.randomUUID(), auditor: crypto.randomUUID()};
  const nomineeIds = {first: crypto.randomUUID(), second: crypto.randomUUID(), auditor: crypto.randomUUID()};
  const voters = [
    {memberId: `CODEX-ANON-A-${suffix}`, firstName: 'SyntheticFirst', lastName: 'Voter',
      name: 'SyntheticFirst Voter', ageGroup: 'Teens'},
    {memberId: `CODEX-ANON-B-${suffix}`, firstName: 'SyntheticSecond', lastName: 'Voter',
      name: 'SyntheticSecond Voter', ageGroup: 'Young People'},
  ];
  const now = Date.now();
  const election = {
    id: electionId, ballotSlug: slug, title: `CODEX anonymous vote ${suffix}`,
    description: 'Disposable election for vote accuracy verification.',
    status: 'Draft', anonymousVoting: true, electionDate: new Date(now).toISOString().slice(0, 10),
    opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString(),
    eligibleVoters: voters.length, eligibleVoterIds: voters.map((voter) => voter.memberId), ballotsSubmitted: 0,
    positions: [
      {id: positionIds.president, name: 'President', group: 'General', description: 'Leads the test election.',
        responsibilities: ['Lead.'], abstainEnabled: false, votingRule: {type: 'all', filters: []},
        nominees: [
          {id: nomineeIds.first, name: 'First Candidate', profile: 'Synthetic candidate'},
          {id: nomineeIds.second, name: 'Second Candidate', profile: 'Synthetic candidate'},
        ]},
      {id: positionIds.auditor, name: 'Auditor', group: 'General', description: 'Reviews the test election.',
        responsibilities: ['Review.'], abstainEnabled: true, votingRule: {type: 'all', filters: []},
        nominees: [{id: nomineeIds.auditor, name: 'Auditor Candidate', profile: 'Synthetic candidate'}]},
    ],
  };
  let created = false;

  async function assertOk(response: Awaited<ReturnType<typeof page.request.post>>) {
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  async function vote(memberId: string, presidentName: string, abstain: boolean) {
    await page.getByLabel('YWAP Marikina Member ID').fill(memberId);
    await page.getByLabel('Last name').fill('Voter');
    await page.getByRole('button', {name: 'Find my ballot'}).click();
    await expect(page.getByRole('heading', {name: 'President', exact: true}).first()).toBeVisible();
    await expect.poll(() => page.locator('.nominee-card:not(.abstain-card) .nominee-copy').allTextContents())
      .toEqual(['First Candidate', 'Second Candidate']);
    await page.getByLabel(`Select ${presidentName} for President`).check({force: true});
    await page.getByRole('button', {name: 'Next position'}).click();
    await expect(page.getByRole('heading', {name: 'Auditor', exact: true}).first()).toBeVisible();
    await page.getByLabel(abstain ? 'Abstain from Auditor' : 'Select Auditor Candidate for Auditor').check({force: true});
    await page.getByRole('button', {name: 'Review ballot'}).click();
    await expect(page.getByRole('heading', {name: 'Review your ballot'})).toBeVisible();
    await page.getByRole('button', {name: 'Submit ballot'}).first().click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Submit ballot'}).click();
    await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();
  }

  try {
    await page.goto('/');
    await page.getByLabel('Username').fill(process.env.ADMIN_USERNAME ?? 'admin');
    await page.getByLabel('Password').fill(adminPassword);
    await page.getByRole('button', {name: 'Sign in'}).click();
    await expect(page.getByRole('heading', {name: /^\d+ elections?$/})).toBeVisible();
    await assertOk(await page.request.post('/api/admin/elections', {data: {election, voters}}));
    created = true;
    await assertOk(await page.request.put(`/api/admin/elections/${electionId}`, {data: {election: {...election, status: 'Open'}}}));

    await page.goto(`/vote/${slug}`);
    await page.getByLabel('YWAP Marikina Member ID').fill(voters[0].memberId);
    await page.getByLabel('Last name').fill('Voter');
    await page.getByRole('button', {name: 'Find my ballot'}).click();
    await expect(page.getByRole('heading', {name: 'President', exact: true}).first()).toBeVisible();

    for (const selections of [
      {[positionIds.president]: nomineeIds.first},
      {[positionIds.president]: nomineeIds.auditor, [positionIds.auditor]: nomineeIds.auditor},
      {[positionIds.president]: 'abstain', [positionIds.auditor]: nomineeIds.auditor},
    ]) {
      const invalid = await page.request.post('/api/ballots', {data: {selections}});
      expect(invalid.status(), await invalid.text()).toBe(400);
    }
    const before = await database.from('anonymous_ballots')
      .select('id', {count: 'exact', head: true}).eq('election_id', electionId);
    expect(before.error).toBeNull();
    expect(before.count).toBe(0);

    await page.getByLabel('Select First Candidate for President').check({force: true});
    await page.getByRole('button', {name: 'Next position'}).click();
    await page.getByLabel('Abstain from Auditor').check({force: true});
    await page.getByRole('button', {name: 'Review ballot'}).click();
    await page.getByRole('button', {name: 'Submit ballot'}).first().click();
    await page.getByRole('alertdialog').getByRole('button', {name: 'Submit ballot'}).click();
    await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();
    await page.getByRole('button', {name: 'Done'}).click();
    await expect(page.getByRole('heading', {name: 'Let’s find your voter record'})).toBeVisible();
    await vote(voters[1].memberId, 'Second Candidate', false);

    const {data: ballots, error: ballotError} = await database.from('anonymous_ballots')
      .select('id, eligible_voter_id, submitted_at').eq('election_id', electionId)
      .order('submitted_at').order('id');
    expect(ballotError).toBeNull();
    expect(ballots).toHaveLength(2);
    expect(ballots?.every((ballot) => ballot.eligible_voter_id === null)).toBeTruthy();

    const {data: selections, error: selectionError} = await database.from('ballot_selections')
      .select('anonymous_ballot_id, position_id, nominee_id, is_abstain, anonymous_ballots!inner(election_id)')
      .eq('anonymous_ballots.election_id', electionId);
    expect(selectionError).toBeNull();
    expect(selections).toHaveLength(4);
    const choicesFor = (ballotId: string) => Object.fromEntries(selections!.filter((row) => row.anonymous_ballot_id === ballotId)
      .map((row) => [row.position_id, row.is_abstain ? 'abstain' : row.nominee_id]));
    expect(choicesFor(ballots![0].id)).toEqual({
      [positionIds.president]: nomineeIds.first, [positionIds.auditor]: 'abstain',
    });
    expect(choicesFor(ballots![1].id)).toEqual({
      [positionIds.president]: nomineeIds.second, [positionIds.auditor]: nomineeIds.auditor,
    });

    const resultsResponse = await page.request.get(`/api/elections/${slug}/results`);
    await assertOk(resultsResponse);
    const {election: persisted, results} = await resultsResponse.json() as {
      election: {ballotsSubmitted: number};
      results: Array<{position: string; total: number; abstentions: number; nominees: Array<{id: string; votes: number}>}>;
    };
    expect(persisted.ballotsSubmitted).toBe(2);
    expect(results.map((result) => ({position: result.position, total: result.total,
      abstentions: result.abstentions, votes: result.nominees.map((nominee) => [nominee.id, nominee.votes])}))).toEqual([
      {position: 'President', total: 2, abstentions: 0, votes: [[nomineeIds.first, 1], [nomineeIds.second, 1]]},
      {position: 'Auditor', total: 2, abstentions: 1, votes: [[nomineeIds.auditor, 1]]},
    ]);

    const {data: participation, error: participationError} = await database.from('participation')
      .select('eligible_voter_id, submitted_at').eq('election_id', electionId);
    expect(participationError).toBeNull();
    expect(participation).toHaveLength(2);
    expect(participation?.every((row) => row.submitted_at)).toBeTruthy();
    expect(new Set(participation?.map((row) => row.eligible_voter_id)).size).toBe(2);

    const duplicate = await page.request.post('/api/ballots', {data: {selections: {
      [positionIds.president]: nomineeIds.first, [positionIds.auditor]: nomineeIds.auditor,
    }}});
    expect(duplicate.status()).toBe(409);
    const after = await database.from('anonymous_ballots')
      .select('id', {count: 'exact', head: true}).eq('election_id', electionId);
    expect(after.error).toBeNull();
    expect(after.count).toBe(2);
  } finally {
    if (created) {
      await assertOk(await page.request.put(`/api/admin/elections/${electionId}`, {data: {election}}));
      await assertOk(await page.request.delete(`/api/admin/elections/${electionId}`));
      const {data, error} = await database.from('elections').select('id').eq('id', electionId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    }
  }
});
