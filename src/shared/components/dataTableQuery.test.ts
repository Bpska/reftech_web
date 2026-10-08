/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-007 / REQ-PLT-004 -- the address parameters DataTable sends to a PagedQuery list.
import { describe, expect, it } from 'vitest';
import { buildQuery, exportAddress, pageAddress } from './dataTableQuery';

describe('buildQuery', () => {
  it('leaves out empty values', () => {
    expect(buildQuery({ params: { status: 'OPEN', a: '', b: null, c: undefined, n: 0 } }).toString()).toBe('status=OPEN&n=0');
    expect(buildQuery({}).toString()).toBe('');
  });
  it('search, sort and filters', () => {
    const q = buildQuery({ params: { tenant: 1 }, q: 'cold room', sort: 'name', dir: 'asc', values: { 'f.status': 'OPEN', 'from.created': '2026-01-01', 'to.created': '' } });
    expect(q.toString()).toBe('tenant=1&q=cold+room&sort=name&dir=asc&f.status=OPEN&from.created=2026-01-01');
  });
  it('no sort means no dir', () => {
    expect(buildQuery({ dir: 'asc' }).has('dir')).toBe(false);
  });
  it('special characters are encoded', () => {
    expect(buildQuery({ q: 'a&b=c' }).toString()).toBe('q=a%26b%3Dc');
  });
});

describe('addresses', () => {
  const q = buildQuery({ q: 'x' });
  it('page and size', () => {
    expect(pageAddress('/api/platform/jobs', q, 2, 50)).toBe('/api/platform/jobs?q=x&page=2&size=50');
    expect(pageAddress('/api/x?kind=A', q, 1, 25)).toBe('/api/x?kind=A&q=x&page=1&size=25');
  });
  it('export keeps the filters and adds the format', () => {
    expect(exportAddress('/api/x', q, 'xlsx')).toBe('/api/x?q=x&format=xlsx');
  });
});
