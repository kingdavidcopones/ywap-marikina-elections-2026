import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeCsvBirthDate, normalizeGender} from '../lib/csv.ts';

test('Youth Record dates accept the common eligible voter CSV formats', () => {
  assert.equal(normalizeCsvBirthDate('2006-01-31'), '2006-01-31');
  assert.equal(normalizeCsvBirthDate('1/31/2006'), '2006-01-31');
  assert.equal(normalizeCsvBirthDate('31/1/2006'), '2006-01-31');
  assert.equal(normalizeCsvBirthDate('January 31, 2006'), '2006-01-31');
});

test('Youth Record dates reject invalid calendar dates', () => {
  assert.equal(normalizeCsvBirthDate('2026-02-30'), null);
  assert.equal(normalizeCsvBirthDate('31/2/2006'), null);
  assert.equal(normalizeCsvBirthDate(''), null);
  assert.equal(normalizeCsvBirthDate('38718'), null);
});

test('gender accepts M/F abbreviations and full words in any case', () => {
  assert.equal(normalizeGender('M'), 'Male');
  assert.equal(normalizeGender('m'), 'Male');
  assert.equal(normalizeGender('Male'), 'Male');
  assert.equal(normalizeGender('MALE'), 'Male');
  assert.equal(normalizeGender('  male  '), 'Male');
  assert.equal(normalizeGender('F'), 'Female');
  assert.equal(normalizeGender('f'), 'Female');
  assert.equal(normalizeGender('Female'), 'Female');
  assert.equal(normalizeGender('FEMALE'), 'Female');
});

test('gender passes through unrecognized values unchanged', () => {
  assert.equal(normalizeGender('Other'), 'Other');
  assert.equal(normalizeGender('Non-binary'), 'Non-binary');
  assert.equal(normalizeGender(''), '');
  assert.equal(normalizeGender('  '), '');
});
