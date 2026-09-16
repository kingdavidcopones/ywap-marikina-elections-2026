import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {expect, test} from '@playwright/test';
import {parseVoters} from '../../lib/csv';

test('admin creates an election, a voter casts once, and totals stay anonymous', async ({page}) => {
  test.setTimeout(120_000);
  const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const electionTitle = `E2E Election ${crypto.randomUUID().slice(0, 8)}`;
  if (!adminPassword) throw new Error('ADMIN_PASSWORD is required for the end-to-end test.');

  await page.goto('/admin');
  await page.getByLabel('Username').fill(adminUsername);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await expect(page.getByRole('heading', {name: /^\d+ elections?$/})).toBeVisible();

  await page.getByRole('button', {name: 'Create election'}).first().click();
  await page.getByPlaceholder('e.g. Youth Elections').fill(electionTitle);
  await page.getByPlaceholder('Tell voters what this election is for').fill('End-to-end verification election.');
  const fixture = path.join(process.cwd(), 'tests', 'fixtures', 'synthetic-voters.csv');
  await page.locator('input[type="file"]').setInputFiles(fixture);
  await expect(page.getByRole('heading', {name: 'Review voter list'})).toBeVisible();
  await expect(page.getByText('1 valid')).toBeVisible();
  await page.getByRole('button', {name: 'Use voter list'}).click();
  await page.getByRole('button', {name: 'Create election draft'}).click();
  await page.waitForURL(/\/admin\/elections\/[0-9a-f-]+$/);

  const eventId = page.url().split('/').at(-1)!;
  const slug = `e2e-election-${eventId.slice(0, 8)}`;
  const records = parseVoters(await readFile(fixture, 'utf8'));
  const voters = records.map((record) => ({
    memberId: record.member_id.trim(), firstName: record.first_name.trim(), lastName: record.last_name.trim(),
    name: `${record.first_name.trim()} ${record.last_name.trim()}`, gender: record.gender.trim(), age: Number(record.age),
    birthDate: new Date(record.birth_date).toISOString().slice(0, 10), ageGroup: record.age_group.trim(),
  }));
  const positionId = crypto.randomUUID();
  const nomineeId = crypto.randomUUID();
  const now = Date.now();
  const election = {
    id: eventId, ballotSlug: slug, title: electionTitle, description: 'End-to-end verification election.', status: 'Open', anonymousVoting: true,
    electionDate: new Date(now).toISOString().slice(0, 10), opensAt: new Date(now - 60_000).toISOString(), closesAt: new Date(now + 3_600_000).toISOString(),
    eligibleVoters: voters.length, eligibleVoterIds: voters.map((voter) => voter.memberId), ballotsSubmitted: 0,
    positions: [{id: positionId, name: 'President', group: 'General', description: 'Leads the organization.', responsibilities: ['Lead responsibly.'], abstainEnabled: true,
      nominees: [{id: nomineeId, name: 'Test Candidate', profile: 'YWAP member', ageGroup: 'Young Adults'}]}],
  };
  const setup = await page.request.put(`/api/admin/elections/${eventId}`, {data: {election}});
  expect(setup.ok()).toBeTruthy();
  const electionList = await page.request.get('/api/elections');
  expect(electionList.ok()).toBeTruthy();
  const listedElections = await electionList.json() as {elections: Array<{id: string; positionCount: number; positions?: unknown}>};
  const listedElection = listedElections.elections.find((item) => item.id === eventId);
  expect(listedElection?.positionCount).toBe(1);
  expect(listedElection?.positions).toBeUndefined();

  await page.goto(`/vote/${slug}`);
  await page.getByLabel('YWAP Marikina Member ID').fill('CODEX-E2E-0001');
  await page.getByLabel('Last name').fill('Tester');
  await page.getByRole('button', {name: 'Find my ballot'}).click();
  await expect(page.getByRole('heading', {name: 'President'}).first()).toBeVisible();
  await page.getByLabel('Select Test Candidate for President').check({force: true});
  await page.getByRole('button', {name: 'Review ballot'}).click();
  await expect(page.getByRole('heading', {name: 'Review your ballot'})).toBeVisible();
  await page.getByRole('button', {name: 'Submit ballot'}).click();
  await page.getByRole('button', {name: 'Submit ballot'}).last().click();
  await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();

  await page.goto(`/vote/${slug}`);
  await expect(page.getByRole('heading', {name: 'Your ballot is in'})).toBeVisible();

  await page.request.delete('/api/admin/session');
  await page.goto('/admin/results');
  await page.getByLabel('Username').fill(adminUsername);
  await page.getByLabel('Password').fill(adminPassword);
  await page.getByRole('button', {name: 'Sign in'}).click();
  await page.getByRole('link').filter({hasText: electionTitle}).click();
  await expect(page.getByText('Ballots submitted')).toBeVisible();
  const peopleVotedKpi = page.locator('article').filter({hasText: 'People voted'});
  await expect(peopleVotedKpi).toBeVisible();
  await expect(peopleVotedKpi.getByText('1 / 1', {exact: true})).toBeVisible();
  await expect(page.getByText('1', {exact: true}).first()).toBeVisible();
  await expect(page.getByText('100.0%', {exact: true})).toBeVisible();
  await expect(page.getByText('1 vote', {exact: true}).first()).toBeVisible();

  await page.goto('/admin/audit');
  await expect(page.getByText('ballot submitted').first()).toBeVisible();
  const published = {...election, status: 'Published', ballotsSubmitted: 1};
  expect((await page.request.put(`/api/admin/elections/${eventId}`, {data: {election: published}})).ok()).toBeTruthy();
  await page.goto('/results');
  await expect(page.getByRole('heading', {name: electionTitle})).toBeVisible();
  await expect(page.getByText('Elected · Test Candidate')).toBeVisible();

  expect((await page.request.put(`/api/admin/elections/${eventId}`, {data: {election: {...published, status: 'Archived'}}})).ok()).toBeTruthy();
  expect((await page.request.delete(`/api/admin/elections/${eventId}`)).ok()).toBeTruthy();
});
