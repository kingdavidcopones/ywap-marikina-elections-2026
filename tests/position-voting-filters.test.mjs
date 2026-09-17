import assert from 'node:assert/strict';
import {test} from 'node:test';
import {positionMatchesVoter} from '../lib/election-data.ts';

const voter = {
  memberId: 'YWAP-1', name: 'Test Voter', ageGroup: 'Young Adults',
  attributes: {department: 'North District', chapter: 'Marikina', committee: '', age_group: 'Young Adults'},
};

const position = {
  id: '1', name: 'President', group: 'General', description: '', responsibilities: [],
  abstainEnabled: true, nominees: [],
};

test('all voters can see an unfiltered position', () => {
  assert.equal(positionMatchesVoter(position, voter), true);
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'all', filters: []}}, voter), true);
});

test('CSV column filters match without case sensitivity', () => {
  const filter = {column: 'department', condition: 'contains', value: 'north'};
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters: [filter]}}, voter), true);
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters: [{...filter, value: 'south'}]}}, voter), false);
});

test('AND and OR combine up to five filters from top to bottom', () => {
  const filters = [
    {column: 'department', condition: 'equals', value: 'South District'},
    {column: 'chapter', condition: 'equals', value: 'Marikina', join: 'or'},
    {column: 'committee', condition: 'is_empty', value: '', join: 'and'},
  ];
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters}}, voter), true);
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters: [...filters, {column: 'department', condition: 'equals', value: 'South', join: 'and'}]}}, voter), false);
});

test('legacy group scope and invalid custom rules remain restrictive', () => {
  assert.equal(positionMatchesVoter({...position, group: 'Teens'}, voter), false);
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters: []}}, voter), false);
  assert.equal(positionMatchesVoter({...position, votingRule: {type: 'custom', filters: Array(6).fill({column: 'chapter', condition: 'equals', value: 'Marikina'})}}, voter), false);
});

test('a custom filter overrides the position age-group tag', () => {
  const teensVoter = {...voter, ageGroup: 'Teens', attributes: {...voter.attributes, age_group: 'Teens'}};
  const youngPeoplePosition = {
    ...position, group: 'Young People',
    votingRule: {type: 'custom', filters: [{column: 'age_group', condition: 'equals', value: 'Teens'}]},
  };
  assert.equal(positionMatchesVoter(youngPeoplePosition, teensVoter), true);
  assert.equal(positionMatchesVoter(youngPeoplePosition, voter), false);
  assert.equal(positionMatchesVoter({...youngPeoplePosition, votingRule: {type: 'all', filters: []}}, teensVoter), false);
});

test('a Young People OR Young Adults filter hides the position from Teens', () => {
  const rule = {type: 'custom', filters: [
    {column: 'age_group', condition: 'equals', value: 'Young People'},
    {column: 'age_group', condition: 'equals', value: 'Young Adults', join: 'or'},
  ]};
  const filteredPosition = {...position, group: 'Teens', votingRule: rule};
  assert.equal(positionMatchesVoter(filteredPosition, voter), true);
  assert.equal(positionMatchesVoter(filteredPosition, {...voter, ageGroup: 'Teens', attributes: {...voter.attributes, age_group: 'Teens'}}), false);
});
