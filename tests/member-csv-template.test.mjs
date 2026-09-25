import assert from 'node:assert/strict';
import test from 'node:test';
import {MEMBER_CSV_TEMPLATE} from '../lib/member-csv-template.ts';
import {isCsvEligibilityValue, isCsvEligible, normalizeCsvBirthDate, parseVoters} from '../lib/csv.ts';

test('member CSV template includes required headers and Juan Dela Cruz example', () => {
  const [record] = parseVoters(MEMBER_CSV_TEMPLATE);
  assert.equal(MEMBER_CSV_TEMPLATE.split('\r\n')[0], 'member_id,first_name,last_name,gender,age,birth_date,age_group,Voter,Nominee');
  assert.deepEqual(record, {
    member_id: 'EXAMPLE-001',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    gender: 'M',
    age: '20',
    birth_date: '2006-01-01',
    age_group: 'Young People',
    voter: 'YES',
    nominee: 'YES',
  });
  assert.equal(normalizeCsvBirthDate(record.birth_date), record.birth_date);
});

test('member CSV eligibility accepts YES, NO, and blank values', () => {
  assert.equal(isCsvEligible('YES'), true);
  assert.equal(isCsvEligible(' yes '), true);
  assert.equal(isCsvEligible('NO'), false);
  assert.equal(isCsvEligible(''), false);
  assert.equal(isCsvEligibilityValue('NO'), true);
  assert.equal(isCsvEligibilityValue(''), true);
  assert.equal(isCsvEligibilityValue('MAYBE'), false);
});
