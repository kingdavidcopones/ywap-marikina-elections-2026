import {expect, test} from '@playwright/test';

test('candidate save buttons stay busy until the server confirms add and edit', async ({page}) => {
  const eventId = '11111111-1111-4111-8111-111111111111';
  const positionId = '11111111-1111-4111-8111-111111111112';
  let election = {
    id: eventId, ballotSlug: 'candidate-progress', title: 'Candidate progress', description: 'Test election',
    status: 'Draft', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 1,
    eligibleVoterIds: ['YWAP-1'], ballotsSubmitted: 0,
    positions: [{id: positionId, name: 'President', group: 'General', description: 'Leads the group.',
      responsibilities: ['Lead.'], abstainEnabled: true, votingRule: {type: 'all', filters: []},
      nominees: [] as Array<Record<string, unknown>>}],
  };
  const voters = [
    {memberId: 'YWAP-1', name: 'Vote Only', firstName: 'Vote', lastName: 'Only', ageGroup: 'Young Adults',
      eligible: true, nomineeEligible: false, attributes: {member_id: 'YWAP-1', voter: 'YES', nominee: 'NO'}},
    {memberId: 'YWAP-2', name: 'Nominee Only', firstName: 'Nominee', lastName: 'Only', ageGroup: 'Young Adults',
      eligible: false, nomineeEligible: true, attributes: {member_id: 'YWAP-2', voter: 'NO', nominee: 'YES'}},
  ];
  let releaseSave: (() => void) | undefined;
  let saveStarted: (() => void) | undefined;
  const saveStartedPromise = () => new Promise<void>((resolve) => { saveStarted = resolve; });

  await page.route('**/api/admin/session', (route) => route.fulfill({json: {authenticated: true}}));
  await page.route(`**/api/elections/${eventId}`, (route) => route.fulfill({json: {election}}));
  await page.route(`**/api/admin/elections/${eventId}/voters`, (route) => route.fulfill({json: {voters}}));
  await page.route(`**/api/admin/elections/${eventId}`, async (route) => {
    const body = route.request().postDataJSON() as {election: typeof election};
    saveStarted?.();
    await new Promise<void>((resolve) => { releaseSave = resolve; });
    election = body.election;
    await route.fulfill({json: {election}});
  });

  await page.goto(`/elections/${eventId}`);
  await page.getByRole('button', {name: 'Add candidate for President'}).click();
  await page.getByRole('combobox', {name: 'Candidate'}).click();
  await expect(page.getByRole('option', {name: /Vote Only/})).toHaveCount(0);
  await page.getByRole('option', {name: /Nominee Only/}).click();
  const addStarted = saveStartedPromise();
  const addButton = page.getByRole('button', {name: 'Save candidate'});
  await addButton.click();
  await addStarted;
  await expect(addButton).toBeDisabled();
  await expect(addButton).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('heading', {name: 'Add candidate'})).toBeVisible();
  releaseSave?.();
  await expect(page.getByRole('heading', {name: 'Add candidate'})).toHaveCount(0);
  await expect(page.getByText('Nominee Only', {exact: true}).first()).toBeVisible();

  await page.getByRole('button', {name: 'Edit Nominee Only'}).click();
  await page.getByRole('menuitem', {name: 'Edit candidate details'}).click();
  const editStarted = saveStartedPromise();
  const editButton = page.getByRole('button', {name: 'Save candidate details'});
  await editButton.click();
  await editStarted;
  await expect(editButton).toBeDisabled();
  await expect(editButton).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('dialog', {name: 'Edit candidate'})).toBeVisible();
  releaseSave?.();
  await expect(page.getByRole('dialog', {name: 'Edit candidate'})).toHaveCount(0);
});
