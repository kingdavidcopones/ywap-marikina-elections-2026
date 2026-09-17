import assert from 'node:assert/strict';
import test from 'node:test';
import {NOMINATION_AGE_GROUPS, isNominationAgeGroup, positionVisibleToAgeGroup} from '../lib/nomination-data.ts';

test('nomination age groups have the requested labels and ranges', () => {
  assert.deepEqual(NOMINATION_AGE_GROUPS.map(({label, ages}) => [label, ages]), [
    ['Teens', 'Ages 13 to 17'],
    ['Young People', 'Ages 18 to 23'],
    ['Young Adults', 'Ages 24 to 39'],
  ]);
  assert.equal(isNominationAgeGroup('teens'), true);
  assert.equal(isNominationAgeGroup('Youth'), false);
});

test('unfiltered positions are visible to everyone; filtered positions need a matching group', () => {
  const position = {eligibleAgeGroups: []};
  assert.equal(positionVisibleToAgeGroup(position, 'young_people'), true);
  position.eligibleAgeGroups = ['teens', 'young_adults'];
  assert.equal(positionVisibleToAgeGroup(position, 'teens'), true);
  assert.equal(positionVisibleToAgeGroup(position, 'young_people'), false);
});
