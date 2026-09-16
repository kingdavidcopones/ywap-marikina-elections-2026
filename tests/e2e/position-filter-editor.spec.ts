import {expect, test} from '@playwright/test';

test('position editor saves CSV filters and limits them to five', async ({page}) => {
  test.setTimeout(60_000);
  const eventId = '11111111-1111-4111-8111-111111111111';
  let election = {
    id: eventId, ballotSlug: 'filter-regression', title: 'Filter regression', description: 'Test election',
    status: 'Draft', electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 1,
    eligibleVoterIds: ['YWAP-1'], ballotsSubmitted: 0, positions: [] as Array<Record<string, unknown>>,
  };
  const voters = [{memberId: 'YWAP-1', name: 'Test Voter', firstName: 'Test', lastName: 'Voter',
    ageGroup: 'Young Adults', eligible: true, attributes: {member_id: 'YWAP-1', department: 'North District', chapter: 'Marikina'}}];

  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters}}));
  await page.route(`**/api/admin/elections/${eventId}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fulfill({status: 405});
    const body = route.request().postDataJSON() as {election: typeof election};
    election = body.election;
    await route.fulfill({json: {election}});
  });

  await page.goto(`/admin/elections/${eventId}`);
  await page.getByRole('button', {name: 'Add position'}).click();
  await page.getByPlaceholder('e.g. President').fill('District Representative');
  await page.getByRole('textbox', {name: /About the role/}).fill('Represents the district.');
  await page.getByPlaceholder('What will this person be responsible for?').fill('Listen to members.');
  await page.getByRole('combobox', {name: 'Who can vote for this position'}).click();
  await page.getByRole('option', {name: 'Custom Filter'}).click();
  await page.getByRole('combobox', {name: 'Filter 1 CSV column'}).click();
  await page.getByRole('option', {name: 'department'}).click();
  await page.getByRole('textbox', {name: 'Filter 1 value'}).fill('North District');
  await expect(page.getByText('1 of 1 eligible voters match')).toBeVisible();

  for (let index = 2; index <= 5; index += 1) await page.getByRole('button', {name: 'Add filter'}).click();
  await expect(page.getByRole('button', {name: 'Add filter'})).toBeDisabled();
  for (let index = 5; index >= 2; index -= 1) await page.getByRole('button', {name: `Remove filter ${index}`}).click();
  await page.getByRole('button', {name: 'Save position'}).click();
  await expect(page.getByRole('heading', {name: 'District Representative'})).toBeVisible();
  expect(election.positions[0]?.votingRule).toEqual({type: 'custom', filters: [{column: 'department', condition: 'equals', value: 'North District'}]});

  await page.getByRole('button', {name: 'Manage District Representative'}).click();
  await page.getByRole('menuitem', {name: 'Edit position'}).click();
  await expect(page.getByRole('combobox', {name: 'Who can vote for this position'})).toContainText('Custom Filter');
  await expect(page.getByRole('textbox', {name: 'Filter 1 value'})).toHaveValue('North District');
});

test('ballot refreshes eligibility and omits a position the voter cannot vote for', async ({page}) => {
  const slug = 'filter-regression';
  const positions = [
    {id: 'allowed', name: 'President', group: 'General', description: 'Leads the team.', responsibilities: ['Lead.'], abstainEnabled: true,
      nominees: [{id: 'candidate', name: 'Test Candidate', profile: 'Candidate'}]},
    {id: 'excluded', name: 'District Representative', group: 'General', description: 'Represents a district.', responsibilities: ['Represent.'], abstainEnabled: true,
      nominees: [{id: 'candidate-2', name: 'Other Candidate', profile: 'Candidate'}]},
  ];
  const election = {id: '11111111-1111-4111-8111-111111111111', ballotSlug: slug, title: 'Filter regression',
    description: 'Test election', status: 'Open', electionDate: '', opensAt: '', closesAt: '',
    eligibleVoters: 1, ballotsSubmitted: 0, positions};
  await page.addInitScript(() => {
    window.sessionStorage.setItem('ywap-voter-session', JSON.stringify({memberId: 'YWAP-1', firstName: 'Test', ageGroup: 'Young Adults',
      ballotSlug: 'filter-regression', eligiblePositionIds: ['allowed', 'excluded']}));
  });
  await page.route(`**/api/elections/${slug}/availability`, (route) => route.fulfill({json: {election: {
    ballotSlug: slug, title: election.title, status: 'Open',
    opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt: new Date(Date.now() + 60_000).toISOString(),
  }}}));
  await page.route(`**/api/elections/${slug}`, (route) => route.fulfill({json: {election}}));
  await page.route('**/api/ballots', (route) => route.fulfill({json: {eligiblePositionIds: ['allowed']}}));

  await page.goto(`/vote/${slug}`);
  await expect(page.getByRole('heading', {name: 'President', exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'District Representative'})).toHaveCount(0);
  await expect(page.getByRole('progressbar', {name: '1 of 1 ballot choices'})).toHaveAttribute('max', '1');
  await expect.poll(() => page.evaluate(() => JSON.parse(window.sessionStorage.getItem('ywap-voter-session') ?? '{}').eligiblePositionIds)).toEqual(['allowed']);
});
