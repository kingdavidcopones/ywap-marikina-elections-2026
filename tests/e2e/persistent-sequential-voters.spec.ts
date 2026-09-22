import {expect, test} from '@playwright/test';
import {createClient} from '@supabase/supabase-js';

test('two same-surname voters submit only filtered positions and persist separate results', async ({page}) => {
  test.skip(process.env.RUN_DATABASE_E2E !== '1', 'Requires an explicitly enabled database-backed test run.');
  test.setTimeout(120_000);

  const adminPassword = process.env.ADMIN_PASSWORD;
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!adminPassword || !supabaseUrl || !serviceRole) throw new Error('Admin and Supabase test credentials are required.');
  const database = createClient(supabaseUrl, serviceRole, {auth: {persistSession: false, autoRefreshToken: false}});

  const eventId = crypto.randomUUID();
  const suffix = eventId.slice(0, 8).toUpperCase();
  const slug = `e2e-filtered-vote-${eventId.slice(0, 8)}`;
  const teenMemberId = `CODEX-E2E-TEEN-${suffix}`;
  const youngMemberId = `CODEX-E2E-YOUNG-${suffix}`;
  const positionIds = {general: crypto.randomUUID(), teens: crypto.randomUUID(), older: crypto.randomUUID()};
  const nomineeIds = {general: crypto.randomUUID(), teens: crypto.randomUUID(), older: crypto.randomUUID()};
  const now = Date.now();
  const voters = [
    {memberId: teenMemberId, firstName: 'SyntheticTeen', lastName: 'Testfamily', name: 'SyntheticTeen Testfamily',
      ageGroup: 'Teens', attributes: {member_id: teenMemberId, first_name: 'SyntheticTeen', last_name: 'Testfamily', age_group: 'Teens'}},
    {memberId: youngMemberId, firstName: 'SyntheticYoung', lastName: 'Testfamily', name: 'SyntheticYoung Testfamily',
      ageGroup: 'Young People', attributes: {member_id: youngMemberId, first_name: 'SyntheticYoung', last_name: 'Testfamily', age_group: 'Young People'}},
  ];
  const election = {
    id: eventId, ballotSlug: slug, title: `CODEX E2E filtered voting ${suffix}`,
    description: 'Disposable synthetic election for database-backed voting verification.',
    status: 'Draft', anonymousVoting: false, electionDate: new Date(now).toISOString().slice(0, 10),
    opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString(),
    eligibleVoters: voters.length, eligibleVoterIds: voters.map((voter) => voter.memberId), ballotsSubmitted: 0,
    positions: [
      {id: positionIds.general, name: 'President', group: 'General', description: 'Leads the test election.',
        responsibilities: ['Lead.'], abstainEnabled: false, votingRule: {type: 'all', filters: []},
        nominees: [{id: nomineeIds.general, name: 'General Candidate', profile: 'Synthetic candidate'}]},
      {id: positionIds.teens, name: 'Teens Representative', group: 'Young People', description: 'Represents teens.',
        responsibilities: ['Represent.'], abstainEnabled: false,
        votingRule: {type: 'custom', filters: [{column: 'age_group', condition: 'equals', value: 'Teens'}]},
        nominees: [{id: nomineeIds.teens, name: 'Teens Candidate', profile: 'Synthetic candidate'}]},
      {id: positionIds.older, name: 'Youth Delegate', group: 'Teens', description: 'Represents older youth.',
        responsibilities: ['Represent.'], abstainEnabled: false,
        votingRule: {type: 'custom', filters: [
          {column: 'age_group', condition: 'equals', value: 'Young People'},
          {column: 'age_group', condition: 'equals', value: 'Young Adults', join: 'or'},
        ]}, nominees: [{id: nomineeIds.older, name: 'Youth Candidate', profile: 'Synthetic candidate'}]},
    ],
  };
  let created = false;

  async function assertOk(response: Awaited<ReturnType<typeof page.request.post>>) {
    expect(response.ok(), await response.text()).toBeTruthy();
  }

  async function vote(memberId: string, secondPosition: string, secondCandidate: string) {
    await page.getByLabel('YWAP Marikina Member ID').fill(memberId);
    await page.getByLabel('Last name').fill('Testfamily');
    await page.getByRole('button', {name: 'Find my ballot'}).click();
    await expect(page.getByRole('heading', {name: 'President', exact: true}).first()).toBeVisible();
    await expect(page.getByRole('progressbar', {name: '1 of 2 ballot choices'})).toHaveAttribute('max', '2');
    if (memberId === teenMemberId) {
      const invalidBallots = [
        {[positionIds.general]: nomineeIds.general},
        {[positionIds.general]: nomineeIds.general, [positionIds.older]: nomineeIds.older},
        {[positionIds.general]: nomineeIds.general, [positionIds.teens]: nomineeIds.older},
        {[positionIds.general]: nomineeIds.general, [positionIds.teens]: 'abstain'},
      ];
      for (const selections of invalidBallots) {
        const response = await page.request.post('/api/ballots', {data: {selections}});
        expect(response.status(), await response.text()).toBe(400);
      }
      const {count, error} = await database.from('anonymous_ballots')
        .select('id', {count: 'exact', head: true}).eq('election_id', eventId);
      expect(error).toBeNull();
      expect(count).toBe(0);
    }
    await page.getByLabel('Select General Candidate for President').check({force: true});
    await page.getByRole('button', {name: 'Next position'}).click();
    await expect(page.getByRole('heading', {name: secondPosition, exact: true}).first()).toBeVisible();
    await page.getByLabel(`Select ${secondCandidate} for ${secondPosition}`).check({force: true});
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
    await assertOk(await page.request.put(`/api/admin/elections/${eventId}`, {data: {election: {...election, status: 'Open'}}}));
    const unverified = await page.request.post('/api/ballots', {data: {selections: {
      [positionIds.general]: nomineeIds.general,
    }}});
    expect(unverified.status()).toBe(401);

    await page.goto(`/vote/${slug}`);
    await vote(teenMemberId, 'Teens Representative', 'Teens Candidate');
    await page.getByRole('link', {name: 'Done'}).click();
    await expect(page.getByRole('heading', {name: 'Let’s find your voter record'})).toBeVisible();
    await vote(youngMemberId, 'Youth Delegate', 'Youth Candidate');

    const individualResponse = await page.request.get(`/api/admin/elections/${eventId}/individual-results`);
    await assertOk(individualResponse);
    const {records} = await individualResponse.json() as {records: Array<{memberId: string; position: string; choice: string}>};
    expect(records).toHaveLength(4);
    expect(records.filter((record) => record.memberId === teenMemberId).map((record) => record.position).sort()).toEqual(['President', 'Teens Representative']);
    expect(records.filter((record) => record.memberId === youngMemberId).map((record) => record.position).sort()).toEqual(['President', 'Youth Delegate']);
    expect(records.find((record) => record.memberId === teenMemberId && record.position === 'Teens Representative')?.choice).toBe('Teens Candidate');
    expect(records.find((record) => record.memberId === youngMemberId && record.position === 'Youth Delegate')?.choice).toBe('Youth Candidate');

    const resultsResponse = await page.request.get(`/api/elections/${slug}/results`);
    await assertOk(resultsResponse);
    const {election: persistedElection, results} = await resultsResponse.json() as {
      election: {ballotsSubmitted: number}; results: Array<{position: string; total: number}>;
    };
    expect(persistedElection.ballotsSubmitted).toBe(2);
    expect(Object.fromEntries(results.map((result) => [result.position, result.total]))).toEqual({President: 2, 'Teens Representative': 1, 'Youth Delegate': 1});

    const {data: participation, error: participationError} = await database.from('participation')
      .select('eligible_voter_id, submitted_at').eq('election_id', eventId);
    expect(participationError).toBeNull();
    expect(participation).toHaveLength(2);
    expect(participation?.every((row) => row.submitted_at)).toBeTruthy();
    expect(new Set(participation?.map((row) => row.eligible_voter_id)).size).toBe(2);
    const {data: ballots, error: ballotsError} = await database.from('anonymous_ballots')
      .select('id, eligible_voter_id').eq('election_id', eventId);
    expect(ballotsError).toBeNull();
    expect(ballots).toHaveLength(2);
    expect(new Set(ballots?.map((ballot) => ballot.eligible_voter_id)).size).toBe(2);

    const duplicate = await page.request.post('/api/ballots', {data: {selections: {
      [positionIds.general]: nomineeIds.general, [positionIds.older]: nomineeIds.older,
    }}});
    expect(duplicate.status()).toBe(409);
    const {data: remainingBallots, error: remainingError} = await database.from('anonymous_ballots')
      .select('id').eq('election_id', eventId);
    expect(remainingError).toBeNull();
    expect(remainingBallots).toHaveLength(2);
  } finally {
    if (created) {
      await assertOk(await page.request.put(`/api/admin/elections/${eventId}`, {data: {election}}));
      await assertOk(await page.request.delete(`/api/admin/elections/${eventId}`));
      const {data, error} = await database.from('elections').select('id').eq('id', eventId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    }
  }
});
