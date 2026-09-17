import {expect, test} from '@playwright/test';

test('voters are told their ballot is linked to their voter record before submitting', async ({page}) => {
  const ballotSlug = 'identified-vote-regression';
  const positionId = '11111111-1111-4111-8111-111111111112';
  const nomineeId = '11111111-1111-4111-8111-111111111113';
  const election = {
    id: '11111111-1111-4111-8111-111111111111', ballotSlug,
    title: 'Identified voting regression', description: 'Test election', status: 'Open', anonymousVoting: false,
    electionDate: '', opensAt: '', closesAt: '', eligibleVoters: 1, ballotsSubmitted: 0,
    positions: [{id: positionId, name: 'President', group: 'General', description: 'Leads the team.',
      responsibilities: ['Lead.'], abstainEnabled: true, nominees: [{id: nomineeId, name: 'Test Candidate', profile: 'Candidate'}]}],
  };
  await page.addInitScript(({slug, position, nominee}) => {
    window.sessionStorage.setItem('ywap-voter-session', JSON.stringify({
      memberId: 'YWAP-1', firstName: 'Test', ageGroup: 'Young Adults', ballotSlug: slug, eligiblePositionIds: [position],
    }));
    window.sessionStorage.setItem('ywap-ballot-draft', JSON.stringify({positionIndex: 0, selections: {[position]: nominee}}));
  }, {slug: ballotSlug, position: positionId, nominee: nomineeId});
  await page.route(`**/api/elections/${ballotSlug}`, (route) => route.fulfill({json: {election}}));
  await page.route('**/api/ballots', (route) => route.fulfill({json: route.request().method() === 'POST'
    ? {submittedAt: '2026-09-17T04:00:00Z'}
    : {eligiblePositionIds: [positionId]}}));

  await page.goto('/vote/review');
  await expect(page.getByText('Your ballot is linked to your voter record.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Your choices stay private'})).toHaveCount(0);

  await page.getByRole('button', {name: 'Submit ballot'}).first().click();
  await page.getByRole('alertdialog').getByRole('button', {name: 'Submit ballot'}).click();
  await expect(page).toHaveURL('/vote/confirmation');
  await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();
  await expect(page.getByText('Your ballot has been successfully recorded.')).toBeVisible();
});
