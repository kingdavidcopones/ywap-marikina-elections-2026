import {expect, test} from '@playwright/test';

test('nomination API and public flow', async ({page, browser, request: publicRequest}) => {
  test.skip(process.env.NOMINATION_LIVE_TEST !== '1', 'Run explicitly against the configured Supabase project.');
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const request = page.context().request;
  const api = (path: string) => `${origin}${path}`;
  const stamp = Date.now();
  let id = '';

  expect((await request.get(api('/api/admin/nominations'))).status()).toBe(401);
  const signIn = await request.post(api('/api/admin/session'), {data: {
    username: process.env.ADMIN_USERNAME ?? 'admin', password: process.env.ADMIN_PASSWORD,
  }});
  expect(signIn.status()).toBe(200);

  try {
    expect((await request.post(api('/api/admin/nominations'), {data: {name: 'A', description: ''}})).status()).toBe(400);
    expect((await request.post(api('/api/admin/nominations'), {data: '{bad', headers: {'Content-Type': 'application/json'}})).status()).toBe(400);
    await page.goto(api('/admin/nominations'));
    await page.getByRole('button', {name: 'Create nomination'}).first().click();
    await page.getByRole('textbox', {name: 'Nomination name'}).fill('A');
    await page.getByRole('button', {name: 'Save as draft'}).click();
    await expect(page.getByText('Use 2–160 characters for the name and up to 2,000 for the description.').first()).toBeVisible();
    await page.getByRole('textbox', {name: 'Nomination name'}).fill(`QA nomination ${stamp}`);
    await page.getByRole('textbox', {name: 'Description'}).fill('Synthetic end-to-end test');
    const createdResponsePromise = page.waitForResponse((response) => response.url() === api('/api/admin/nominations') && response.request().method() === 'POST');
    await page.getByRole('button', {name: 'Save as draft'}).click();
    const createdResponse = await createdResponsePromise;
    expect(createdResponse.status()).toBe(201);
    const created = (await createdResponse.json()).nomination;
    id = created.id;
    const slug = created.slug as string;
    await expect(page).toHaveURL(api(`/admin/nominations/${id}`));
    const patch = (action: Record<string, unknown>) => request.patch(api(`/api/admin/nominations/${id}`), {data: action});
    expect(created.status).toBe('Draft');
    expect(created.positions).toEqual([]);
    expect((await patch({type: 'status', status: 'Published'})).status()).toBe(400);
    expect((await publicRequest.get(api(`/api/nominations/${slug}`))).status()).toBe(404);

    const firstPosition = await patch({type: 'position', name: 'Chairperson', showRoleDetails: true,
      aboutRole: 'Lead the youth council.', responsibilities: ['Plan meetings', 'Represent members']});
    expect(firstPosition.status()).toBe(200);
    const chairId = (await firstPosition.json()).nomination.positions[0].id as string;
    expect((await patch({type: 'position', name: 'chairperson', showRoleDetails: false, aboutRole: '', responsibilities: []})).status()).toBe(409);
    const secondPosition = await patch({type: 'position', name: 'Secretary', showRoleDetails: false,
      aboutRole: '', responsibilities: []});
    expect(secondPosition.status()).toBe(200);
    const secretaryId = (await secondPosition.json()).nomination.positions[1].id as string;

    await page.goto(api(`/admin/nominations/${id}`));
    await page.getByRole('tab', {name: 'Youth Records'}).click();
    const csvHeader = 'member_id,first_name,last_name,gender,age,birth_date,age_group\n';
    await page.locator('input[type="file"]').setInputFiles({name: 'invalid-youth.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`${csvHeader}QA-${stamp}-1,Alex,Test,Other,20,2026-02-30,Youth\n`)});
    await expect(page.getByText('Row 1: invalid birth date. Use YYYY-MM-DD.')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({name: 'youth.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`${csvHeader}QA-${stamp}-1,Alex,Test,Other,20,2006-01-01,Youth\n`)});
    await page.getByRole('button', {name: 'Add or update records'}).click();
    await expect(page.getByText('Youth Records saved.').first()).toBeVisible();

    const record = (memberId: string, firstName: string) => ({memberId, firstName, lastName: 'Test', ageGroup: 'Youth', gender: 'Other', age: 20,
      birthDate: '2006-01-01', attributes: {member_id: memberId, first_name: firstName, last_name: 'Test'}});
    const rows = [record(`QA-${stamp}-1`, 'Alex'), record(`QA-${stamp}-2`, 'Jordan')];
    expect((await patch({type: 'records', mode: 'add', records: [{...rows[0], birthDate: '2026-02-30'}]})).status()).toBe(400);
    expect((await patch({type: 'records', mode: 'add', records: [rows[0], rows[0]]})).status()).toBe(400);
    const uploaded = await patch({type: 'records', mode: 'add', records: rows});
    expect(uploaded.status()).toBe(200);
    expect((await uploaded.json()).nomination.youthRecordCount).toBe(2);
    const adminDetail = (await (await request.get(api(`/api/admin/nominations/${id}`))).json()).nomination;
    expect(adminDetail.youthRecords).toEqual([]);
    expect(adminDetail.youthRecordCount).toBe(2);
    const youthPage = await request.get(api(`/api/admin/nominations/${id}/youth-records?page=1`));
    expect(youthPage.status()).toBe(200);
    expect((await youthPage.json()).records).toHaveLength(2);
    expect((await request.get(api(`/api/admin/nominations/${id}/youth-records?page=0`))).status()).toBe(400);

    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const later = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    expect((await patch({type: 'status', status: 'Scheduled', opensAt: later, closesAt: future})).status()).toBe(400);
    expect((await patch({type: 'status', status: 'Scheduled', opensAt: future, closesAt: later})).status()).toBe(200);
    expect((await publicRequest.get(api(`/api/nominations/${slug}`))).status()).toBe(404);
    expect((await request.get(api(`/api/nominations/${slug}`))).status()).toBe(200); // Admin preview.
    expect((await (await request.get(api(`/api/nominations/${slug}`))).json()).preview).toBe(true);
    expect((await patch({type: 'status', status: 'Draft'})).status()).toBe(200);
    expect((await patch({type: 'status', status: 'Published'})).status()).toBe(200);
    expect((await (await publicRequest.get(api(`/api/nominations/${slug}`))).json()).preview).toBe(false);

    const found = await publicRequest.get(api(`/api/nominations/${slug}/lookup?q=Alex`));
    expect(found.status()).toBe(200);
    const alex = (await found.json()).records[0];
    expect(alex.name).toBe('Alex Test');
    const submit = (choices: Record<string, unknown>) => publicRequest.post(api(`/api/nominations/${slug}/submit`), {data: {choices}});
    expect((await submit({[chairId]: {name: 'A'}})).status()).toBe(400);
    expect((await submit({[chairId]: {name: 'Alex Test', youthRecordId: crypto.randomUUID()}, [secretaryId]: {name: 'Taylor Example'}})).status()).toBe(400);
    const choices = {[chairId]: {name: 'Alex Test', youthRecordId: alex.id}, [secretaryId]: {name: 'Taylor Example'}};
    expect((await submit(choices)).status()).toBe(201);
    expect((await submit(choices)).status()).toBe(201); // Repeated nominations are allowed.
    const nomineesResponse = await request.get(api(`/api/admin/nominations/${id}/nominees?page=1`));
    expect(nomineesResponse.status()).toBe(200);
    const nominees = await nomineesResponse.json();
    expect(nominees.total).toBe(4);
    expect(nominees.nominees).toHaveLength(4);
    expect(nominees.nominees.every((entry: {submittedAt: string}) => !Number.isNaN(Date.parse(entry.submittedAt)))).toBe(true);

    const collectionRequests: string[] = [];
    page.on('request', (outbound) => {if (/\/api\/admin\/nominations\/[^/]+\/(nominees|youth-records)/.test(outbound.url())) collectionRequests.push(outbound.url());});
    await page.goto(api(`/admin/nominations/${id}`));
    await expect(page.getByRole('heading', {name: `QA nomination ${stamp}`})).toBeVisible();
    expect(collectionRequests).toHaveLength(0);
    await page.getByRole('tab', {name: 'Youth Records'}).click();
    await expect(page.getByRole('region', {name: 'Youth Records table'}).getByRole('table')).toBeVisible();
    expect(collectionRequests.some((path) => path.includes('/youth-records?page=1'))).toBe(true);
    await page.getByRole('tab', {name: 'Nominees'}).click();
    await expect(page.getByRole('region', {name: 'Nominees'}).getByRole('table')).toBeVisible();
    expect(collectionRequests.some((path) => path.includes('/nominees?page=1'))).toBe(true);
    await page.getByRole('button', {name: 'Edit details'}).click();
    await page.getByRole('textbox', {name: 'Description'}).fill('Synthetic end-to-end test, edited in browser');
    await page.getByRole('button', {name: 'Save details'}).click();
    await expect(page.getByText('Nomination details saved.').first()).toBeVisible();

    const publicPage = await browser.newPage();
    try {
      await publicPage.goto(api(`/nominate/${slug}`));
      await publicPage.getByRole('button', {name: 'Submit nomination'}).click();
      await expect(publicPage.getByText('Check the nominee names below.').first()).toBeVisible();
      await publicPage.getByRole('textbox', {name: 'Nominee for Chairperson'}).fill('Alex');
      await publicPage.getByRole('button', {name: 'Choose Alex Test'}).click();
      await publicPage.getByRole('textbox', {name: 'Nominee for Secretary'}).fill('Taylor Example');
      await publicPage.getByRole('button', {name: 'Submit nomination'}).click();
      await expect(publicPage.getByRole('heading', {name: 'Nomination submitted'})).toBeVisible();
    } finally {await publicPage.close();}

    expect((await patch({type: 'delete-nominee', nomineeId: nominees.nominees[0].id})).status()).toBe(200);
    expect((await (await request.get(api(`/api/admin/nominations/${id}/nominees?page=1`))).json()).total).toBe(5);

    expect((await patch({type: 'status', status: 'Draft'})).status()).toBe(200);
    const replaced = await patch({type: 'records', mode: 'replace', records: [rows[0]]});
    expect(replaced.status()).toBe(200);
    expect((await replaced.json()).nomination.youthRecordCount).toBe(1);
    expect((await patch({type: 'status', status: 'Archived'})).status()).toBe(200);
    expect((await patch({type: 'status', status: 'Published'})).status()).toBe(409);
    expect((await patch({type: 'status', status: 'Draft'})).status()).toBe(200);
    expect((await patch({type: 'status', status: 'Published'})).status()).toBe(200);
    expect((await patch({type: 'status', status: 'Archived'})).status()).toBe(200);
    expect((await publicRequest.post(api(`/api/nominations/${slug}/submit`), {data: {choices}})).status()).toBe(404);
  } finally {
    if (id) await request.patch(api(`/api/admin/nominations/${id}`), {data: {type: 'status', status: 'Archived'}});
  }
});
