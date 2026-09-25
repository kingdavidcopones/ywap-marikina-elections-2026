import {expect, test} from '@playwright/test';

test('eligible voter CSV applies Voter and Nominee flags independently', async ({page}) => {
  const eventId = '22222222-2222-4222-8222-222222222221';
  const positionId = '22222222-2222-4222-8222-222222222222';
  let election = {
    id: eventId, ballotSlug: 'member-eligibility', title: 'Member eligibility', description: 'Test election',
    status: 'Draft', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 0,
    eligibleVoterIds: [] as string[], ballotsSubmitted: 0,
    positions: [{id: positionId, name: 'President', group: 'General', description: 'Leads the group.',
      responsibilities: ['Lead.'], abstainEnabled: true, votingRule: {type: 'all', filters: []}, nominees: []}],
  };
  let savedVoters: Array<{memberId: string; eligible: boolean; nomineeEligible: boolean}> = [];

  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters: []}}));
  await page.route(`**/api/admin/elections/${eventId}`, async (route) => {
    const body = route.request().postDataJSON() as {election: typeof election; voters: typeof savedVoters};
    election = body.election;
    savedVoters = body.voters;
    await route.fulfill({json: {election}});
  });

  await page.goto(`/elections/${eventId}`);
  await page.getByRole('tab', {name: 'Eligible voters'}).click();
  await page.getByLabel('Add eligible voters from CSV').setInputFiles({
    name: 'member-eligibility.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from([
      'member_id,first_name,last_name,gender,age,birth_date,age_group,Voter,Nominee',
      'YWAP-1,Vote,Only,F,20,2006-01-01,Young People,YES,NO',
      'YWAP-2,Nominee,Only,M,21,2005-01-01,Young People,NO,YES',
      'YWAP-3,Neither,Role,F,22,2004-01-01,Young People,,',
    ].join('\n')),
  });

  await expect(page.getByText('3 member records imported. 1 voter and 1 nominee eligible.')).toBeVisible();
  expect(election.eligibleVoterIds).toEqual(['YWAP-1']);
  expect(savedVoters.map(({memberId, eligible, nomineeEligible}) => ({memberId, eligible, nomineeEligible}))).toEqual([
    {memberId: 'YWAP-1', eligible: true, nomineeEligible: false},
    {memberId: 'YWAP-2', eligible: false, nomineeEligible: true},
    {memberId: 'YWAP-3', eligible: false, nomineeEligible: false},
  ]);

  await page.getByRole('tab', {name: 'Positions'}).click();
  await page.getByRole('button', {name: 'Add candidate for President'}).click();
  await page.getByRole('combobox', {name: 'Candidate'}).click();
  await expect(page.getByRole('option', {name: /Nominee Only/})).toBeVisible();
  await expect(page.getByRole('option', {name: /Vote Only|Neither Role/})).toHaveCount(0);
});
