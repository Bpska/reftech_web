/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRP-011 -- the pure helpers of the offline checklist and expenses on the driver's phone.
import { describe, expect, it } from 'vitest';
import { afterAnswer, answerText, formFields } from './driverOffline';

describe('afterAnswer', () => {
  it('keeps the capture when the network or the server failed, or the sign-in ended', () => {
    expect(afterAnswer(0)).toBe('KEEP');
    expect(afterAnswer(401)).toBe('KEEP');
    expect(afterAnswer(503)).toBe('KEEP');
    expect(afterAnswer(429)).toBe('KEEP');
  });
  it('marks an answered capture as sent and a refused request as failed', () => {
    expect(afterAnswer(200)).toBe('SENT');
    expect(afterAnswer(400)).toBe('FAILED');
    expect(afterAnswer(404)).toBe('FAILED');
  });
});

describe('formFields', () => {
  it('takes the typed text fields, without files and empty values', () => {
    const f = new FormData();
    f.append('amount', ' 250 '); f.append('description', ''); f.append('expenseType', 'TOLL'); f.append('receipt', 'x');
    expect(formFields(f, ['receipt'])).toEqual({ amount: '250', expenseType: 'TOLL' });
  });
});

describe('answerText', () => {
  it('says what became of a capture', () => {
    expect(answerText({ status: 'APPLIED' }, 'Expense')).toBe('Expense: Saved');
    expect(answerText({ status: 'APPLIED', repeated: true }, 'Expense')).toBe('Expense: Saved (already saved before)');
    expect(answerText({ status: 'CONFLICT', message: 'Check it' }, 'Checklist')).toBe('Checklist: Changed by the office meanwhile. Check it');
    expect(answerText(null, 'Fuel')).toBe('Fuel: waiting to be sent.');
  });
});
