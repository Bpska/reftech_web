/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-010 -- the due dates, ageing and promise checks of the Collections screen.
import { describe, expect, it } from 'vitest';
import { ageing, bucket, daysToDue, promiseLate, stages, unplaced } from './collections';

const TODAY = '2026-10-08';

describe('due dates', () => {
  it('counts the days to the due date', () => {
    expect(daysToDue('2026-10-11', TODAY)).toBe(3);
    expect(daysToDue('2026-10-08', TODAY)).toBe(0);
    expect(daysToDue('2026-09-30', TODAY)).toBe(-8);
    expect(daysToDue(null, TODAY)).toBeNull();
    expect(daysToDue('not a date', TODAY)).toBeNull();
  });
  it('puts a bill in a bucket', () => {
    expect(bucket(3, 7)).toBe('due-soon');
    expect(bucket(9, 7)).toBe('due-later');
    expect(bucket(0, 7)).toBe('due-today');
    expect(bucket(-8, 7)).toBe('overdue');
    expect(bucket(null, 7)).toBe('no-due-date');
  });
});

describe('reminder stages', () => {
  it('reads them from the settings, in order', () => {
    expect(stages({ daysBefore: 3, onDue: true, overdueDays: '1,7,15,30', channels: 'EMAIL' })).toEqual([3, 0, -1, -7, -15, -30]);
    expect(stages({ daysBefore: 0, onDue: false, overdueDays: '7, 7, x', channels: '' })).toEqual([-7]);
  });
});

describe('ageing', () => {
  it('splits the open bills by how long they are overdue', () => {
    const rows = ageing([
      { id: 1, dueDate: '2026-10-11', outstanding: 11800 },
      { id: 2, dueDate: '2026-10-08', outstanding: 23600 },
      { id: 3, dueDate: '2026-09-30', outstanding: 5900 },
      { id: 4, dueDate: '2026-07-01', outstanding: 1000 },
    ], TODAY);
    expect(rows[0]).toEqual({ label: 'Not due', count: 2, amount: 35400 });
    expect(rows[1]).toEqual({ label: '1-30 days', count: 1, amount: 5900 });
    expect(rows[4]).toEqual({ label: 'Over 90 days', count: 1, amount: 1000 });
  });
});

describe('promises and bank credits', () => {
  it('marks a promise that has passed', () => {
    expect(promiseLate('2026-10-06', 'OPEN', TODAY)).toBe(true);
    expect(promiseLate('2026-10-06', 'OPEN', TODAY, 3)).toBe(false);
    expect(promiseLate('2026-10-10', 'OPEN', TODAY)).toBe(false);
    expect(promiseLate('2026-10-01', 'KEPT', TODAY)).toBe(false);
  });
  it('says how much of a credit is still to place', () => {
    expect(unplaced(11800, 0, 0)).toBe(11800);
    expect(unplaced(11800, 236, 11564)).toBe(0);
    expect(unplaced(23600, 0, 11800)).toBe(11800);
  });
});
