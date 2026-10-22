import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFilters } from '../src/validators/activity.validator.js';

test('activity date filters use the whole Philippine calendar day across UTC boundaries', () => {
  const filters = activityFilters({
    role: 'consumer',
    date: '2026-01-01',
    page: '2',
    search: ' feedback ',
  });
  assert.equal(filters.start, '2025-12-31 16:00:00');
  assert.equal(filters.end, '2026-01-01 16:00:00');
  assert.equal(filters.page, 2);
  assert.equal(filters.search, 'feedback');
  assert.equal(activityFilters({}).role, 'admin');
});

test('activity filters reject invalid roles, dates and pagination', () => {
  for (const query of [
    { role: 'all' },
    { date: '2026-02-30' },
    { date: [] },
    { page: '0' },
    { search: 'x'.repeat(101) },
  ])
    assert.throws(
      () => activityFilters(query),
      (error) => error.statusCode === 400 || error.status === 400,
    );
});
