import {expect, test} from '@playwright/test';

const positions = [
  {id: 'teen-position', name: 'Teen Representative', eligibleAgeGroups: ['teens'], showRoleDetails: false, aboutRole: '', responsibilities: []},
  {id: 'open-position', name: 'Secretary', eligibleAgeGroups: [], showRoleDetails: false, aboutRole: '', responsibilities: []},
];

test('nomination wizard shows only eligible positions and submits the selected age group', async ({page}) => {
  let submitted: {ageGroup: string; choices: Record<string, {name: string}>} | null = null;
  await page.route('**/api/nominations/wizard-test/availability', async (route) => {
    await route.fulfill({json: {availability: {name: 'Youth Council', status: 'Published', opensAt: '', closesAt: ''}}});
  });
  await page.route('**/api/nominations/wizard-test', async (route) => {
    await route.fulfill({json: {nomination: {id: 'wizard-test', slug: 'wizard-test', name: 'Youth Council', description: 'Choose someone to represent your group.', status: 'Published', opensAt: '', closesAt: '', positions}, preview: false}});
  });
  await page.route('**/api/nominations/wizard-test/lookup**', async (route) => {
    await route.fulfill({json: {records: []}});
  });
  await page.route('**/api/nominations/wizard-test/submit', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({status: 201, json: {submittedAt: new Date().toISOString()}});
  });

  await page.goto('/nominate/wizard-test');
  await expect(page.getByRole('heading', {name: 'Submit your nomination'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Choose your age group'})).toBeVisible();
  await expect(page.getByText('Ages 13 to 17')).toBeVisible();
  await expect(page.getByText('Ages 18 to 23')).toBeVisible();
  await expect(page.getByText('Ages 24 to 39')).toBeVisible();
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByText('Select your age group to continue.')).toBeVisible();

  await page.getByText('Young People', {exact: true}).click();
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByRole('textbox', {name: 'Secretary'})).toBeVisible();
  await expect(page.getByRole('textbox', {name: 'Teen Representative'})).toHaveCount(0);

  await page.getByRole('button', {name: 'Back to age groups'}).click();
  await page.getByText('Teens', {exact: true}).click();
  await page.getByRole('button', {name: 'Continue to nominations'}).click();
  await expect(page.getByRole('textbox', {name: 'Teen Representative'})).toBeVisible();
  await page.getByRole('textbox', {name: 'Teen Representative'}).fill('Alex Test');
  await page.getByRole('textbox', {name: 'Secretary'}).fill('Jordan Test');
  await page.getByRole('button', {name: 'Submit nomination'}).click();
  await expect(page.getByRole('heading', {name: 'Nomination submitted'})).toBeVisible();
  expect(submitted).toEqual({ageGroup: 'teens', choices: {
    'teen-position': {name: 'Alex Test'},
    'open-position': {name: 'Jordan Test'},
  }});
});
