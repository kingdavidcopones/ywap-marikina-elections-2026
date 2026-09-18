import {expect, test} from '@playwright/test';

const positions = [
  {id: 'teen-position', name: 'Teen Representative', eligibleAgeGroups: ['teens'], required: true, shortDescription: 'Speaks for teen members.'},
  {id: 'open-position', name: 'Secretary', eligibleAgeGroups: [], required: true, shortDescription: ''},
];

test('nomination wizard reviews choices, confirms submission, and keeps one card width', async ({page}) => {
  let submitted: {ageGroup: string; name: string; email: string; choices: Record<string, {name: string; youthRecordId?: string}>} | null = null;
  let submissionAttempts = 0;
  await page.route('**/api/nominations/wizard-test/availability', async (route) => {
    await route.fulfill({json: {availability: {name: 'Youth Council', status: 'Published', opensAt: '', closesAt: ''}}});
  });
  await page.route('**/api/nominations/wizard-test', async (route) => {
    await route.fulfill({json: {nomination: {id: 'wizard-test', slug: 'wizard-test', name: 'Youth Council', description: 'Choose someone to represent your group.', status: 'Published', opensAt: '', closesAt: '', positions}, preview: false}});
  });
  await page.route('**/api/nominations/wizard-test/lookup**', async (route) => {
    const query = new URL(route.request().url()).searchParams.get('q') ?? '';
    await route.fulfill({json: {records: query.toLocaleLowerCase('en').includes('alex')
      ? [{id: '00000000-0000-4000-8000-000000000001', name: 'Alex Test'}] : []}});
  });
  await page.route('**/api/nominations/wizard-test/check-email**', async (route) => {
    await route.fulfill({json: {available: true}});
  });
  await page.route('**/api/nominations/wizard-test/submit', async (route) => {
    submitted = route.request().postDataJSON();
    submissionAttempts += 1;
    if (submissionAttempts === 1) {
      await route.fulfill({status: 503, json: {message: 'We couldn’t record your nominations right now. Please contact the election committee.'}});
      return;
    }
    await route.fulfill({status: 201, json: {submittedAt: new Date().toISOString()}});
  });

  await page.goto('/nominate/wizard-test');
  await expect(page.getByRole('heading', {name: 'Submit your nomination'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Verify your details'})).toBeVisible();
  await expect(page.getByText('Choose your age group', {exact: true})).toBeVisible();
  await expect(page.getByPlaceholder('Enter your name')).toBeVisible();
  await expect(page.getByPlaceholder('example@email.com')).toBeVisible();
  await expect(page.getByText('Ages 13 to 17')).toBeVisible();
  await expect(page.getByText('Ages 18 to 23')).toBeVisible();
  await expect(page.getByText('Ages 24 to 39')).toBeVisible();
  const wizard = page.locator('.nomination-wizard-card');
  const firstWidth = (await wizard.boundingBox())?.width;
  expect(firstWidth).toBeGreaterThan(0);
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByText('Enter a valid email address.')).toBeVisible();
  await page.getByRole('textbox', {name: 'Email'}).fill('nominator@example.com');
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByText('Select your age group to continue.')).toBeVisible();

  await page.getByText('Young People', {exact: true}).click();
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByRole('combobox', {name: 'Secretary'})).toBeVisible();
  await expect(page.getByRole('combobox', {name: 'Teen Representative'})).toHaveCount(0);
  expect((await wizard.boundingBox())?.width).toBe(firstWidth);

  await page.getByRole('button', {name: 'Back'}).click();
  await page.getByText('Teens', {exact: true}).click();
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByRole('combobox', {name: 'Teen Representative'})).toBeVisible();
  await expect(page.getByText('Speaks for teen members.')).toBeVisible();
  await page.getByRole('button', {name: 'Review'}).click();
  await expect(page.getByText('Choose a name from the suggestions.').first()).toBeVisible();
  await page.getByRole('combobox', {name: 'Teen Representative'}).fill('Alex');
  await page.getByRole('option', {name: 'Alex Test'}).click();
  await page.getByRole('combobox', {name: 'Secretary'}).fill('Jordan Test');
  await page.getByRole('option', {name: 'Jordan Test'}).click();
  await page.getByRole('button', {name: 'Review'}).click();
  await expect(page.getByRole('heading', {name: 'Review your nominations'})).toBeVisible();
  expect((await wizard.boundingBox())?.width).toBe(firstWidth);
  await page.setViewportSize({width: 390, height: 844});
  const mobileWidth = (await wizard.boundingBox())?.width;
  expect(mobileWidth).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const backButton = await page.getByRole('button', {name: 'Back'}).boundingBox();
  const submitButton = await page.getByRole('button', {name: 'Submit'}).boundingBox();
  expect(backButton?.y).toBe(submitButton?.y);
  await page.getByRole('button', {name: 'Back'}).click();
  await expect(page.getByRole('heading', {name: 'Nominate'})).toBeVisible();
  expect((await wizard.boundingBox())?.width).toBe(mobileWidth);
  const nominateBackButton = await page.getByRole('button', {name: 'Back'}).boundingBox();
  const reviewButton = await page.getByRole('button', {name: 'Review'}).boundingBox();
  expect(nominateBackButton?.y).toBe(reviewButton?.y);
  await page.getByRole('button', {name: 'Review'}).click();
  expect((await wizard.boundingBox())?.width).toBe(mobileWidth);
  await page.getByRole('button', {name: 'Submit'}).click();
  await expect(page.getByRole('dialog', {name: 'Submit your nominations?'})).toBeVisible();
  await page.getByRole('button', {name: 'Cancel'}).click();
  expect(submitted).toBeNull();
  await page.getByRole('button', {name: 'Submit'}).click();
  await page.getByRole('button', {name: 'Confirm submission'}).click();
  await expect(page.getByText('We couldn’t record your nominations right now. Please contact the election committee.')).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Review your nominations'})).toBeVisible();
  await page.getByRole('button', {name: 'Submit'}).click();
  await page.getByRole('button', {name: 'Confirm submission'}).click();
  await expect(page.getByRole('heading', {name: 'Nomination submitted!'})).toBeVisible();
  await expect(page.locator('.confirmation-card')).toBeVisible();
  expect(submitted).toEqual({ageGroup: 'teens', name: '', email: 'nominator@example.com', choices: {
    'teen-position': {name: 'Alex Test', youthRecordId: '00000000-0000-4000-8000-000000000001'},
    'open-position': {name: 'Jordan Test'},
  }});
});
