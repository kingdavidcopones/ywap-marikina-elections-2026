import {expect, test} from '@playwright/test';

const eventId = '11111111-1111-4111-8111-111111111111';
const election = {
  id: eventId, ballotSlug: 'navigation-regression', title: 'Navigation regression', description: 'Test election',
  status: 'Draft', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 0,
  eligibleVoterIds: [], ballotsSubmitted: 0, positions: [],
};

test.beforeEach(async ({page}) => {
  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
});

test('election detail stays visible when voter records fail to load', async ({page}) => {
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({status: 503, json: {message: 'Voter records are temporarily unavailable.'}}));

  await page.goto(`/admin/elections/${eventId}`);
  await expect(page.getByRole('heading', {name: election.title})).toBeVisible();
  await expect(page.getByText('Voter records are temporarily unavailable.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'We couldn’t find this election'})).toHaveCount(0);
});

test('creating a draft closes the modal before opening its page', async ({page}) => {
  let submittedAnonymousVoting: boolean | undefined;
  await page.route('**/api/elections', (route) => route.fulfill({json: {elections: []}}));
  await page.route('**/api/admin/elections', async (route) => {
    const body = route.request().postDataJSON() as {election: typeof election};
    submittedAnonymousVoting = body.election.anonymousVoting;
    await route.fulfill({status: 201, json: {election: {...body.election, title: 'New draft'}}});
  });
  await page.route('**/api/elections/*', (route) => route.fulfill({json: {election: {...election, title: 'New draft'}}}));
  await page.route('**/api/admin/elections/*/voters', (route) => route.fulfill({json: {voters: []}}));

  await page.goto('/admin');
  await page.getByRole('button', {name: 'Create election'}).first().click();
  await page.getByPlaceholder('e.g. Youth Elections').fill('New draft');
  await expect(page.getByRole('checkbox', {name: 'Anonymous voting'})).toBeChecked();
  await page.getByRole('checkbox', {name: 'Anonymous voting'}).uncheck();
  await page.getByRole('button', {name: 'Create election draft'}).click();
  await expect(page).toHaveURL(/\/admin\/elections\/[0-9a-f-]+$/);
  await expect(page.getByRole('alertdialog', {name: 'Create an election'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'New draft'})).toBeVisible();
  expect(submittedAnonymousVoting).toBe(false);
});

test('create-election actions remain visible when the dialog content overflows', async ({page}) => {
  await page.setViewportSize({width: 700, height: 420});
  await page.route('**/api/elections', (route) => route.fulfill({json: {elections: []}}));
  await page.goto('/admin');
  await page.getByRole('button', {name: 'Create election'}).first().click();
  const dialog = page.getByRole('alertdialog', {name: 'Create an election'});
  await expect(dialog.getByRole('button', {name: 'Create election draft'})).toBeInViewport();
  const content = dialog.locator('.astryx-layout-content');
  expect(await content.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
});

test('deleting an election confirms success after navigation', async ({page}) => {
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters: []}}));
  await page.route(`**/api/admin/elections/${eventId}`, (route) => route.fulfill({json: {ok: true}}));
  await page.route('**/api/elections', (route) => route.fulfill({json: {elections: []}}));

  await page.goto(`/admin/elections/${eventId}`);
  await page.getByRole('button', {name: 'Edit event'}).click();
  await page.getByRole('menuitem', {name: 'Delete election'}).click();
  await page.getByRole('alertdialog').getByRole('button', {name: 'Delete election'}).click();
  await expect(page).toHaveURL('/admin');
  await expect(page.getByRole('region', {name: 'Notifications'}).getByText('Navigation regression was deleted.')).toBeVisible();
});

test('live results row responds when its end icon is clicked', async ({page}) => {
  await page.route('**/api/elections', (route) => route.fulfill({json: {elections: [{...election, positionCount: 0}]}}));
  await page.route(`**/api/elections/${eventId}/results`, (route) => route.fulfill({json: {election, results: []}}));

  await page.goto('/admin/results');
  await expect(page.getByRole('link', {name: election.title})).toBeVisible();
  await page.locator('.results-election-list li').first().locator('svg').last().click();
  await expect(page).toHaveURL(`/admin/results/${eventId}`);
  await expect(page.getByRole('heading', {name: election.title})).toBeVisible();
});

test('non-anonymous live results show admin-only individual vote records', async ({page}) => {
  const identifiableElection = {...election, anonymousVoting: false, status: 'Open', ballotsSubmitted: 1, eligibleVoters: 1};
  await page.route(`**/api/elections/${eventId}/results`, (route) => route.fulfill({json: {election: identifiableElection, results: []}}));
  await page.route(`**/api/admin/elections/${eventId}/individual-results`, (route) => route.fulfill({json: {records: [{
    id: 'selection-1', memberId: 'YWAP-1', voterName: 'Test Voter', submittedAt: '2026-09-17T04:00:00Z',
    position: 'President', choice: 'Candidate A',
  }]}}));

  await page.goto(`/admin/results/${eventId}`);
  await expect(page.getByRole('tab', {name: 'Summary'})).toBeVisible();
  await page.getByRole('tab', {name: 'Individual'}).click();
  await expect(page.getByRole('tabpanel', {name: 'Individual vote records'}).getByText('Test Voter')).toBeVisible();
  await expect(page.getByRole('tabpanel', {name: 'Individual vote records'}).getByText('Candidate A')).toBeVisible();
});

test('individual vote records require an admin session', async ({page}) => {
  const response = await page.request.get(`/api/admin/elections/${eventId}/individual-results`);
  expect(response.status()).toBe(401);
});
