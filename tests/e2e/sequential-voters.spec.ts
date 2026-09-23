import {expect, test} from '@playwright/test';

test('same-surname voters get separate filtered ballots and mocked submissions', async ({page}) => {
  test.setTimeout(60_000);
  const slug = 'sequential-voters-regression';
  const positions = [
    {id: 'general', name: 'President', group: 'General', description: 'Leads the team.', responsibilities: ['Lead.'],
      abstainEnabled: false, nominees: [{id: 'general-candidate', name: 'General Candidate', profile: 'Candidate'}]},
    {id: 'teens', name: 'Teens Representative', group: 'Young People', description: 'Represents teens.', responsibilities: ['Represent.'],
      abstainEnabled: false, votingRule: {type: 'custom', filters: [{column: 'age_group', condition: 'equals', value: 'Teens'}]},
      nominees: [{id: 'teens-candidate', name: 'Teens Candidate', profile: 'Candidate'}]},
    {id: 'older', name: 'Youth Delegate', group: 'Teens', description: 'Represents older youth.', responsibilities: ['Represent.'],
      abstainEnabled: false, votingRule: {type: 'custom', filters: [
        {column: 'age_group', condition: 'equals', value: 'Young People'},
        {column: 'age_group', condition: 'equals', value: 'Young Adults', join: 'or'},
      ]}, nominees: [{id: 'older-candidate', name: 'Youth Candidate', profile: 'Candidate'}]},
  ];
  const election = {
    id: '11111111-1111-4111-8111-111111111111', ballotSlug: slug, title: 'Sequential voting regression',
    description: 'Test election', status: 'Open', anonymousVoting: true, electionDate: '', opensAt: '', closesAt: '',
    eligibleVoters: 2, ballotsSubmitted: 0, positions,
  };
  const availability = {ballotSlug: slug, title: election.title, status: 'Open',
    opensAt: new Date(Date.now() - 60_000).toISOString(), closesAt: new Date(Date.now() + 60_000).toISOString()};
  const voters = {
    'YWAP-1': {memberId: 'YWAP-1', firstName: 'Elisha', ageGroup: 'Teens', ballotSlug: slug, eligiblePositionIds: ['general', 'teens']},
    'YWAP-2': {memberId: 'YWAP-2', firstName: 'Asher', ageGroup: 'Young People', ballotSlug: slug, eligiblePositionIds: ['general', 'older']},
  };
  const recorded = new Map<string, Record<string, string>>();
  let activeMemberId: keyof typeof voters | null = null;

  await page.route(`**/api/elections/${slug}/availability`, (route) => route.fulfill({json: {election: availability}}));
  await page.route(`**/api/elections/${slug}`, (route) => route.fulfill({json: {election}}));
  await page.route('**/api/verify', (route) => {
    const body = route.request().postDataJSON() as {memberId: string; lastName: string};
    const id = body.memberId.toUpperCase() as keyof typeof voters;
    if (body.lastName.toLowerCase() !== 'abad' || !voters[id]) {
      return route.fulfill({status: 401, json: {ok: false, message: 'We couldn’t find a matching voter record.'}});
    }
    if (recorded.has(id)) {
      return route.fulfill({status: 409, json: {ok: false, message: 'A ballot has already been submitted for this voter.'}});
    }
    activeMemberId = id;
    return route.fulfill({json: {ok: true, voter: voters[id]}});
  });
  await page.route('**/api/ballots', (route) => {
    if (!activeMemberId) return route.fulfill({status: 401, json: {message: 'Verify your voter record before voting.'}});
    if (route.request().method() === 'GET') {
      return route.fulfill({json: {eligiblePositionIds: voters[activeMemberId].eligiblePositionIds}});
    }
    if (recorded.has(activeMemberId)) {
      return route.fulfill({status: 409, json: {message: 'A ballot has already been submitted for this voter.'}});
    }
    const selections = (route.request().postDataJSON() as {selections: Record<string, string>}).selections;
    const expected = voters[activeMemberId].eligiblePositionIds;
    if (Object.keys(selections).length !== expected.length || expected.some((id) => !selections[id])) {
      return route.fulfill({status: 400, json: {message: 'The ballot is incomplete.'}});
    }
    recorded.set(activeMemberId, selections);
    return route.fulfill({json: {submittedAt: '2026-09-17T04:00:00Z'}});
  });

  async function verify(memberId: string) {
    await page.getByLabel('YWAP Marikina Member ID').fill(memberId);
    await page.getByLabel('Last name').fill('Abad');
    await page.getByRole('button', {name: 'Find my ballot'}).click();
  }

  async function chooseAndSubmit(secondPosition: string, secondCandidate: string) {
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

  await page.goto(`/vote/${slug}`);
  await page.getByRole('button', {name: 'Find my ballot'}).click();
  await expect(page.getByText('Enter your Member ID and last name so we can find your voter record.')).toBeVisible();
  await verify('NOT-ON-LIST');
  await expect(page.getByText('We couldn’t find a matching voter record.')).toBeVisible();

  await verify('YWAP-1');
  await expect(page.getByRole('heading', {name: 'President', exact: true}).first()).toBeVisible();
  await expect(page.getByRole('progressbar', {name: '1 of 2 ballot choices'})).toHaveAttribute('max', '2');
  await expect(page.getByRole('heading', {name: 'Youth Delegate'})).toHaveCount(0);
  await page.getByRole('button', {name: 'Next position'}).click();
  await expect(page.getByText('Choose before continuing')).toBeVisible();
  await chooseAndSubmit('Teens Representative', 'Teens Candidate');
  await expect(recorded.get('YWAP-1')).toEqual({'general': 'general-candidate', 'teens': 'teens-candidate'});

  await page.getByRole('button', {name: 'Done'}).click();
  await expect(page.getByRole('heading', {name: 'Let’s find your voter record'})).toBeVisible();
  await verify('YWAP-2');
  await expect(page.getByRole('heading', {name: 'President', exact: true}).first()).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Teens Representative'})).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('ywap-ballot-submitted'))).toBeNull();
  await chooseAndSubmit('Youth Delegate', 'Youth Candidate');
  await expect(recorded.get('YWAP-2')).toEqual({'general': 'general-candidate', 'older': 'older-candidate'});
  expect(recorded.size).toBe(2);

  await page.reload();
  await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();
  await page.getByRole('button', {name: 'Done'}).click();
  await verify('YWAP-1');
  await expect(page.getByText('A ballot has already been submitted for this voter.')).toBeVisible();
  expect(recorded.size).toBe(2);
});
