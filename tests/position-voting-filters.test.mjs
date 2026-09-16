import assert from 'node:assert/strict';
import {test} from 'node:test';
import {positionMatchesVoter} from '../lib/election-data.ts';

const voter = {
  memberId: 'YWAP-1', name: 'Test Voter', ageGroup: 'Young Adults',
  attributes: {department: 'North District', chapter: 'Marikina', committee: ''},
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
