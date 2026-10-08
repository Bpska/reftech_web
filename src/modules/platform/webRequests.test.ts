/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- the status moves of a website request.
import { describe, expect, it } from 'vitest';
import { nextStatuses } from './webRequests';

describe('website request statuses', () => {
  it('offers the moves the server allows', () => {
    expect(nextStatuses('NEW')).toEqual(['CONTACTED', 'QUOTED', 'CLOSED', 'SPAM']);
    expect(nextStatuses('CONTACTED')).toEqual(['QUOTED', 'CLOSED', 'SPAM']);
    expect(nextStatuses('CONVERTED')).toEqual([]);
    expect(nextStatuses('spam')).toEqual([]);
  });
});
