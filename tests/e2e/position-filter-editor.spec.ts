import {expect, test} from '@playwright/test';

test('position editor saves CSV filters and limits them to five', async ({page}) => {
  test.setTimeout(60_000);
  const eventId = '11111111-1111-4111-8111-111111111111';
  let election = {
    id: eventId, ballotSlug: 'filter-regression', title: 'Filter regression', description: 'Test election',
    status: 'Draft', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 2,
    eligibleVoterIds: ['YWAP-1', 'YWAP-2'], ballotsSubmitted: 0, positions: [] as Array<Record<string, unknown>>,
  };
  const voters = [
    {memberId: 'YWAP-1', name: 'Test Voter', firstName: 'Test', lastName: 'Voter',
      ageGroup: 'Young Adults', eligible: true, attributes: {member_id: 'YWAP-1', department: 'North District', chapter: 'Marikina'}},
    {memberId: 'YWAP-2', name: 'Other Voter', firstName: 'Other', lastName: 'Voter',
      ageGroup: 'Young Adults', eligible: true, attributes: {member_id: 'YWAP-2', department: 'South District', chapter: 'Marikina'}},
  ];

  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters}}));
  await page.route(`**/api/admin/elections/${eventId}`, async (route) => {
    if (route.request().method() !== 'PUT') return route.fulfill({status: 405});
    const body = route.request().postDataJSON() as {election: typeof election};
    election = body.election;
    await route.fulfill({json: {election}});
  });

  await page.goto(`/elections/${eventId}`);
  await page.getByRole('button', {name: 'Add position'}).click();
  await page.getByPlaceholder('e.g. President').fill('District Representative');
  await page.getByRole('textbox', {name: /About the role/}).fill('Represents the district.');
  await page.getByPlaceholder('What will this person be responsible for?').fill('Listen to members.');
  await page.getByRole('combobox', {name: 'Who can vote for this position'}).click();
  await page.getByRole('option', {name: 'Custom Filter'}).click();
  await expect(page.getByText('Filter', {exact: true})).toBeVisible();
  await page.getByRole('combobox', {name: 'Filter 1 CSV column'}).click();
  await page.getByRole('option', {name: 'department'}).click();
  await page.getByRole('combobox', {name: 'Filter 1 value'}).click();
  await expect(page.getByRole('option', {name: 'North District'})).toBeVisible();
  await expect(page.getByRole('option', {name: 'South District'})).toBeVisible();
  await page.getByRole('option', {name: 'North District'}).click();
  await expect(page.getByText('1 of 2 eligible voters match')).toBeVisible();
  await page.getByRole('combobox', {name: 'Filter 1 CSV column'}).click();
  await page.getByRole('option', {name: 'chapter'}).click();
  await expect(page.getByRole('combobox', {name: 'Filter 1 value'})).toContainText('Select a CSV value');
  await page.getByRole('combobox', {name: 'Filter 1 value'}).click();
  await expect(page.getByRole('option', {name: 'Marikina'})).toBeVisible();
  await expect(page.getByRole('option', {name: 'North District'})).toHaveCount(0);
  await page.getByRole('option', {name: 'Marikina'}).click();
  await page.getByRole('combobox', {name: 'Filter 1 CSV column'}).click();
  await page.getByRole('option', {name: 'department'}).click();
  await page.getByRole('combobox', {name: 'Filter 1 value'}).click();
  await page.getByRole('option', {name: 'North District'}).click();
  await page.getByRole('combobox', {name: 'Filter 1 condition'}).click();
  await page.getByRole('option', {name: 'Does not equal'}).click();
  await expect(page.getByRole('combobox', {name: 'Filter 1 value'})).toContainText('North District');
  await expect(page.getByText('1 of 2 eligible voters match')).toBeVisible();
  await page.getByRole('combobox', {name: 'Filter 1 condition'}).click();
  await page.getByRole('option', {name: 'Contains', exact: true}).click();
  await page.getByRole('textbox', {name: 'Filter 1 value'}).fill('North');
  await expect(page.getByText('1 of 2 eligible voters match')).toBeVisible();
  await page.getByRole('combobox', {name: 'Filter 1 condition'}).click();
  await page.getByRole('option', {name: 'Equals', exact: true}).click();
  await page.getByRole('combobox', {name: 'Filter 1 value'}).click();
  await page.getByRole('option', {name: 'North District'}).click();

  for (let index = 2; index <= 5; index += 1) await page.getByRole('button', {name: 'Add filter'}).click();
  const andOrControl = await page.getByRole('combobox', {name: 'Combine filter 2 with previous filters'}).boundingBox();
  expect(andOrControl).not.toBeNull();
  expect(andOrControl!.width).toBeLessThan(200);
  await expect(page.getByRole('button', {name: 'Add filter'})).toBeDisabled();
  await expect(page.getByRole('dialog', {name: 'Add a position'}).getByRole('button', {name: 'Save position'})).toBeInViewport();
  await expect(page.getByRole('button', {name: 'Remove filter 5'})).toHaveText('Remove');
  for (let index = 5; index >= 2; index -= 1) await page.getByRole('button', {name: `Remove filter ${index}`}).click();
  await page.getByRole('button', {name: 'Save position'}).click();
  await expect(page.getByRole('heading', {name: 'District Representative'})).toBeVisible();
  expect(election.positions[0]?.votingRule).toEqual({type: 'custom', filters: [{column: 'department', condition: 'equals', value: 'North District'}]});

  await page.getByRole('button', {name: 'Manage District Representative'}).click();
  await page.getByRole('menuitem', {name: 'Edit position'}).click();
  await expect(page.getByRole('combobox', {name: 'Who can vote for this position'})).toContainText('Custom Filter');
  await expect(page.getByRole('combobox', {name: 'Filter 1 value'})).toContainText('North District');
  await expect(page.getByRole('dialog', {name: 'Edit position'}).getByRole('checkbox', {name: 'Anonymous voting'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Save position changes'}).click();
  await page.getByRole('button', {name: 'Edit event'}).click();
  await page.getByRole('menuitem', {name: 'Edit details'}).click();
  await expect(page.getByRole('checkbox', {name: 'Anonymous voting'})).toBeChecked();
  await page.getByRole('checkbox', {name: 'Anonymous voting'}).uncheck();
  await page.getByRole('button', {name: 'Save election details'}).click();
  await expect.poll(() => election.anonymousVoting).toBe(false);

  election = {...election, status: 'Scheduled'};
  await page.reload();
  await page.getByRole('button', {name: 'Edit event'}).click();
  await page.getByRole('menuitem', {name: 'Edit details'}).click();
  await expect(page.getByRole('checkbox', {name: 'Anonymous voting'})).toBeDisabled();
});

test('custom position filter is unavailable without voter CSV data', async ({page}) => {
  const eventId = '22222222-2222-4222-8222-222222222222';
  const election = {
    id: eventId, ballotSlug: 'no-voters', title: 'No voters', description: 'Test election', status: 'Draft',
    anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 0,
    eligibleVoterIds: [], ballotsSubmitted: 0, positions: [],
  };
  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters: []}}));

  await page.goto(`/elections/${eventId}`);
  await page.getByRole('button', {name: 'Add position'}).click();
  await page.getByRole('combobox', {name: 'Who can vote for this position'}).click();
  await expect(page.getByRole('option', {name: /Custom Filter/})).toHaveAttribute('aria-disabled', 'true');
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
    description: 'Test election', status: 'Open', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '',
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
