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
    expect((await (await publicRequest.get(api(`/api/nominations/${slug}/availability`))).json()).availability.status).toBe('Draft');
    const draftPage = await browser.newPage();
    try {
      await draftPage.goto(api(`/nominate/${slug}`));
      await expect(draftPage.getByRole('heading', {name: 'This nomination link is unavailable'})).toBeVisible();
      await expect(draftPage.getByRole('button', {name: 'Submit nomination'})).toHaveCount(0);
    } finally { await draftPage.close(); }

    const firstPosition = await patch({type: 'position', name: 'Chairperson', eligibleAgeGroups: ['teens'], showRoleDetails: true,
      aboutRole: 'Lead the youth council.', responsibilities: ['Plan meetings', 'Represent members']});
    expect(firstPosition.status()).toBe(200);
    const chairId = (await firstPosition.json()).nomination.positions[0].id as string;
    expect((await patch({type: 'position', name: 'chairperson', showRoleDetails: false, aboutRole: '', responsibilities: []})).status()).toBe(409);
    const secondPosition = await patch({type: 'position', name: 'Secretary', showRoleDetails: false,
      aboutRole: '', responsibilities: []});
    expect(secondPosition.status()).toBe(200);
    const secretaryId = (await secondPosition.json()).nomination.positions[1].id as string;
    expect((await secondPosition.json()).nomination.positions[1].eligibleAgeGroups).toEqual([]);

    await page.goto(api(`/admin/nominations/${id}`));
    await page.getByRole('tab', {name: 'Youth Records'}).click();
    const csvHeader = 'member_id,first_name,last_name,gender,age,birth_date,age_group\n';
    await page.getByLabel('Add Youth Records from CSV').setInputFiles({name: 'invalid-youth.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`${csvHeader}QA-${stamp}-1,Alex,Test,Other,20,2026-02-30,Youth\n`)});
    await expect(page.getByText(/Row 1: invalid birth date/)).toBeVisible();
    await page.getByLabel('Add Youth Records from CSV').setInputFiles({name: 'youth.csv', mimeType: 'text/csv',
      buffer: Buffer.from(`${csvHeader}QA-${stamp}-1,Alex,Test,Other,20,31/1/2006,Youth\n`)});
    await expect(page.getByText('Youth Records saved.').first()).toBeVisible();
    const flexibleDateRows = await request.get(api(`/api/admin/nominations/${id}/youth-records?page=1`));
    expect((await flexibleDateRows.json()).records[0].birthDate).toBe('2006-01-31');

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
    await page.goto(api(`/admin/nominations/${id}`));
    await page.getByRole('button', {name: 'Publish', exact: true}).click();
    await page.getByRole('menuitem', {name: 'Publish now'}).click();
    await expect(page.getByRole('dialog', {name: 'Publish this nomination now?'})).toBeVisible();
    await page.getByRole('button', {name: 'Cancel'}).click();
    expect((await (await request.get(api(`/api/admin/nominations/${id}`))).json()).nomination.status).toBe('Draft');
    await page.getByRole('button', {name: 'Publish', exact: true}).click();
    await page.getByRole('menuitem', {name: 'Schedule later'}).click();
    await expect(page.getByRole('dialog', {name: 'Schedule nomination'})).toBeVisible();
    await page.getByRole('button', {name: 'Cancel'}).click();
    expect((await patch({type: 'status', status: 'Scheduled', opensAt: later, closesAt: future})).status()).toBe(400);
    expect((await patch({type: 'status', status: 'Scheduled', opensAt: future, closesAt: later})).status()).toBe(200);
    const scheduledPage = await browser.newPage();
    try {
      await scheduledPage.goto(api(`/nominate/${slug}`));
      await expect(scheduledPage.getByRole('heading', {name: 'Nominations start soon'})).toBeVisible();
      await expect(scheduledPage.getByRole('region', {name: 'Time until nominations start'})).toBeVisible();
      await expect(scheduledPage.getByRole('button', {name: 'Submit nomination'})).toHaveCount(0);
    } finally { await scheduledPage.close(); }
    expect((await publicRequest.get(api(`/api/nominations/${slug}`))).status()).toBe(404);
    expect((await request.get(api(`/api/nominations/${slug}`))).status()).toBe(200); // Admin preview.
    expect((await (await request.get(api(`/api/nominations/${slug}`))).json()).preview).toBe(true);
    expect((await patch({type: 'status', status: 'Draft'})).status()).toBe(200);
    expect((await patch({type: 'status', status: 'Published'})).status()).toBe(200);
    expect((await request.delete(api(`/api/admin/nominations/${id}`))).status()).toBe(409);
    expect((await (await publicRequest.get(api(`/api/nominations/${slug}`))).json()).preview).toBe(false);

    const found = await publicRequest.get(api(`/api/nominations/${slug}/lookup?q=Alex`));
    expect(found.status()).toBe(200);
    const alex = (await found.json()).records[0];
    expect(alex.name).toBe('Alex Test');
    const submit = (choices: Record<string, unknown>, ageGroup = 'teens', email = `qa-nominator-1-${stamp}@example.com`, name = 'QA Nominator') =>
      publicRequest.post(api(`/api/nominations/${slug}/submit`), {data: {ageGroup, name, email, choices}});
    expect((await submit({[chairId]: {name: 'Alex Test'}, [secretaryId]: {name: 'Taylor Example'}}, 'invalid')).status()).toBe(400);
    expect((await submit({[chairId]: {name: 'A'}})).status()).toBe(400);
    expect((await submit({[chairId]: {name: 'Alex Test'}, [secretaryId]: {name: 'Taylor Example'}}, 'young_people')).status()).toBe(400);
    expect((await submit({[chairId]: {name: 'Alex Test', youthRecordId: crypto.randomUUID()}, [secretaryId]: {name: 'Taylor Example'}})).status()).toBe(400);
    const choices = {[chairId]: {name: 'Alex Test', youthRecordId: alex.id}, [secretaryId]: {name: 'Taylor Example'}};
    expect((await submit(choices)).status()).toBe(201);
    expect((await submit(choices)).status()).toBe(409); // A second nomination with the same email is blocked.
    expect((await submit(choices, 'teens', `qa-nominator-2-${stamp}@example.com`)).status()).toBe(201); // A different nominator may still submit.
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
    await page.getByRole('button', {name: 'Unpublish nomination'}).click();
    await expect(page.getByRole('alertdialog', {name: 'Unpublish this nomination?'})).toBeVisible();
    await page.getByRole('button', {name: 'Cancel'}).click();
    expect((await (await request.get(api(`/api/admin/nominations/${id}`))).json()).nomination.status).toBe('Published');
    await page.getByRole('button', {name: 'Edit details'}).click();
    await page.getByRole('menuitem', {name: 'Edit details'}).click();
    await page.getByRole('textbox', {name: 'Description'}).fill('Synthetic end-to-end test, edited in browser');
    await page.getByRole('button', {name: 'Save details'}).click();
    await expect(page.getByText('Nomination details saved.').first()).toBeVisible();

    const publicPage = await browser.newPage();
    try {
      await publicPage.goto(api(`/nominate/${slug}`));
      await expect(publicPage.getByRole('heading', {name: 'Submit your nomination'})).toBeVisible();
      await publicPage.getByRole('textbox', {name: 'Email'}).fill(`qa-nominator-3-${stamp}@example.com`);
      await publicPage.getByRole('button', {name: 'Continue to nominations'}).click();
      await expect(publicPage.getByText('Select your age group to continue.')).toBeVisible();
      await publicPage.getByText('Teens', {exact: true}).click();
      await publicPage.getByRole('button', {name: 'Continue to nominations'}).click();
      await publicPage.getByRole('button', {name: 'Review'}).click();
      await expect(publicPage.getByText('Choose a name from the suggestions.').first()).toBeVisible();
      await publicPage.getByRole('combobox', {name: 'Chairperson'}).fill('Alex');
      await publicPage.getByRole('option', {name: 'Alex Test'}).click();
      await publicPage.getByRole('combobox', {name: 'Secretary'}).fill('Taylor Example');
      await publicPage.getByRole('option', {name: 'Taylor Example'}).click();
      await publicPage.getByRole('button', {name: 'Review'}).click();
      await publicPage.getByRole('button', {name: 'Submit'}).click();
      await expect(publicPage.getByRole('dialog', {name: 'Submit your nominations?'})).toBeVisible();
      await publicPage.getByRole('button', {name: 'Confirm submission'}).click();
      await expect(publicPage.getByRole('heading', {name: 'Nomination submitted!'})).toBeVisible();
    } finally {await publicPage.close();}

    const youngPeoplePage = await browser.newPage();
    try {
      await youngPeoplePage.goto(api(`/nominate/${slug}`));
      await youngPeoplePage.getByRole('textbox', {name: 'Email'}).fill(`qa-nominator-4-${stamp}@example.com`);
      await youngPeoplePage.getByText('Young People', {exact: true}).click();
      await youngPeoplePage.getByRole('button', {name: 'Continue to nominations'}).click();
      await expect(youngPeoplePage.getByRole('combobox', {name: 'Secretary'})).toBeVisible();
      await expect(youngPeoplePage.getByRole('combobox', {name: 'Chairperson'})).toHaveCount(0);
    } finally {await youngPeoplePage.close();}

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
    expect((await publicRequest.post(api(`/api/nominations/${slug}/submit`), {data: {ageGroup: 'teens', choices}})).status()).toBe(404);
    await page.goto(api(`/admin/nominations/${id}`));
    await page.getByRole('button', {name: 'Edit details'}).click();
    await page.getByRole('menuitem', {name: 'Delete nomination'}).click();
    await expect(page.getByRole('alertdialog', {name: 'Delete this nomination?'})).toBeVisible();
    await page.getByRole('button', {name: 'Cancel'}).click();
    expect((await request.get(api(`/api/admin/nominations/${id}`))).status()).toBe(200);
    await page.getByRole('button', {name: 'Edit details'}).click();
    await page.getByRole('menuitem', {name: 'Delete nomination'}).click();
    const deleteResponse = page.waitForResponse((response) => response.url() === api(`/api/admin/nominations/${id}`) && response.request().method() === 'DELETE');
    await page.getByRole('button', {name: 'Delete nomination'}).click();
    expect((await deleteResponse).status()).toBe(200);
    await expect(page).toHaveURL(api('/admin/nominations'));
    expect((await request.get(api(`/api/admin/nominations/${id}`))).status()).toBe(404);
    id = '';
  } finally {
    if (id) {
      await request.patch(api(`/api/admin/nominations/${id}`), {data: {type: 'status', status: 'Archived'}});
      await request.delete(api(`/api/admin/nominations/${id}`));
    }
  }
});
