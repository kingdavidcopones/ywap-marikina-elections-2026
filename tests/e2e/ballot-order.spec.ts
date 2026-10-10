import {expect, test} from '@playwright/test';
import type {ElectionEvent} from '../../lib/election-data';

test('every voter sees candidates in the saved position order', async ({browser, baseURL}) => {
  const slug = 'order-regression';
  const positionId = 'position-1';
  const election: ElectionEvent = {
    id: '11111111-1111-4111-8111-111111111111', ballotSlug: slug,
    title: 'Candidate order regression', description: 'Synthetic ballot', status: 'Open',
    anonymousVoting: true, electionDate: '', opensAt: new Date(Date.now() - 60_000).toISOString(),
    closesAt: '', eligibleVoters: 2, ballotsSubmitted: 0,
    positions: [{id: positionId, name: 'President', group: 'General', description: 'Leads the team.',
      responsibilities: ['Lead.'], abstainEnabled: false,
      nominees: ['A', 'B', 'C'].map((letter) => ({id: `candidate-${letter}`, name: `Candidate ${letter}`, profile: ''}))}],
  };

  for (const memberId of ['SYNTHETIC-A', 'SYNTHETIC-B']) {
    const context = await browser.newContext({baseURL});
    try {
      await context.addInitScript(({memberId, slug, positionId}) => {
        window.sessionStorage.setItem('ywap-voter-session', JSON.stringify({
          memberId, firstName: 'Test', ageGroup: 'Teens', ballotSlug: slug, eligiblePositionIds: [positionId],
        }));
      }, {memberId, slug, positionId});
      await context.route(`**/api/elections/${slug}/availability`, (route) => route.fulfill({json: {election}}));
      await context.route(`**/api/elections/${slug}`, (route) => route.fulfill({json: {election}}));
      await context.route('**/api/ballots', (route) => route.request().method() === 'GET'
        ? route.fulfill({json: {eligiblePositionIds: [positionId]}}) : route.abort());

      const page = await context.newPage();
      await page.goto(`/vote/${slug}`);
      await expect.poll(() => page.locator('.nominee-card:not(.abstain-card) .nominee-copy').allTextContents())
        .toEqual(['Candidate A', 'Candidate B', 'Candidate C']);
    } finally {
      await context.close();
    }
  }
});
