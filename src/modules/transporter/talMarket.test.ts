/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-013, 014, 015 -- the pure helpers of the lane tender, free truck and invoice screens.
import { describe, expect, it } from 'vitest';
import { checkCounts, localInput, needsReason, noteActions, quickReply, rankLabel, sharesFrom, splitProblem, toleranceText } from './talMarket';

describe('lane tender award split', () => {
  const ranking = [{ transporterId: 1, rank: 1 }, { transporterId: 2, rank: 2 }, { transporterId: 3, rank: 3 }, { transporterId: 4, rank: 4 }];
  it('reads the shares typed in and leaves out empty ones', () => {
    expect(sharesFrom({ 1: '70', 2: '30', 3: '', 4: '0' })).toEqual([{ transporterId: 1, sharePercent: 70 }, { transporterId: 2, sharePercent: 30 }]);
    expect(sharesFrom({ 1: '33,5' })).toEqual([{ transporterId: 1, sharePercent: 33.5 }]);
  });
  it('accepts a 70/30 split of bidders and refuses wrong splits', () => {
    const bidders = [1, 2, 3, 4];
    expect(splitProblem([{ transporterId: 1, sharePercent: 70 }, { transporterId: 2, sharePercent: 30 }], bidders)).toBeNull();
    expect(splitProblem([{ transporterId: 1, sharePercent: 70 }, { transporterId: 2, sharePercent: 20 }], bidders)).toContain('90 %');
    expect(splitProblem([], bidders)).toContain('at least one');
    expect(splitProblem([1, 2, 3, 4].map(id => ({ transporterId: id, sharePercent: 25 })), bidders)).toContain('at most 3');
    expect(splitProblem([{ transporterId: 9, sharePercent: 100 }], bidders)).toContain('without a bid');
    expect(splitProblem([{ transporterId: 1, sharePercent: 50 }, { transporterId: 1, sharePercent: 50 }], bidders)).toContain('twice');
    expect(splitProblem([{ transporterId: 1, sharePercent: 33.333 }, { transporterId: 2, sharePercent: 66.667 }], bidders)).toContain('2 decimals');
    expect(splitProblem([{ transporterId: 1, sharePercent: 33.33 }, { transporterId: 2, sharePercent: 33.33 }, { transporterId: 3, sharePercent: 33.34 }], bidders)).toBeNull();
  });
  it('asks for a reason when a cheaper bidder is passed over or a dearer one gets more', () => {
    expect(needsReason([{ transporterId: 1, sharePercent: 70 }, { transporterId: 2, sharePercent: 30 }], ranking)).toBe(false);
    expect(needsReason([{ transporterId: 2, sharePercent: 30 }, { transporterId: 1, sharePercent: 70 }], ranking)).toBe(false);
    expect(needsReason([{ transporterId: 2, sharePercent: 100 }], ranking)).toBe(true);
    expect(needsReason([{ transporterId: 1, sharePercent: 60 }, { transporterId: 3, sharePercent: 40 }], ranking)).toBe(true);
    expect(needsReason([{ transporterId: 1, sharePercent: 30 }, { transporterId: 2, sharePercent: 70 }], ranking)).toBe(true);
  });
  it('shows the rank as L1, L2 ...', () => {
    expect(rankLabel(1)).toBe('L1');
    expect(rankLabel(null)).toBe('-');
  });
});

describe('invoice intake', () => {
  it('counts the checks', () => {
    expect(checkCounts([{ result: 'PASS' }, { result: 'WARN' }, { result: 'PASS' }, { result: 'FAIL' }, {}])).toEqual({ PASS: 2, WARN: 1, FAIL: 1 });
    expect(checkCounts()).toEqual({ PASS: 0, WARN: 0, FAIL: 0 });
  });
  it('says the tolerance in words', () => {
    expect(toleranceText({ tolerancePercent: 2, toleranceAmount: 500 })).toBe('2 % of the expected amount, at most ₹500');
    expect(toleranceText({ tolerancePercent: '2', toleranceAmount: null })).toBe('2 % of the expected amount');
    expect(toleranceText({ tolerancePercent: 0, toleranceAmount: 0 })).toContain('exactly');
    expect(toleranceText(null)).toBe('');
  });
  it('offers only the debit note moves the backend allows', () => {
    expect(noteActions('RAISED', false)).toEqual(['accept', 'dispute']);
    expect(noteActions('DISPUTED', false)).toEqual([]);
    expect(noteActions('DISPUTED', true)).toEqual(['confirm', 'withdraw']);
    expect(noteActions('RAISED', true)).toEqual(['withdraw']);
    expect(noteActions('ACCEPTED', true)).toEqual([]);
  });
});

describe('free trucks', () => {
  it('gives the India time for a datetime input and the quick reply text', () => {
    expect(localInput(new Date('2026-10-07T04:30:00Z'))).toBe('2026-10-07T10:00');
    expect(quickReply(12)).toBe('YES 12 · NO 12 · QUOTE 12 <amount>');
  });
});
