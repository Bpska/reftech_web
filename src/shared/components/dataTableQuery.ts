/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-004 / REQ-PLT-007 -- the address parameters of a DataTable (pure, so it can be tested).
// Sent: the caller's params (empty ones left out), q, sort + dir, f.<filter>, from.<range>, to.<range>;
// page/size or format are added by the caller of buildQuery.

export type TableState = {
  params?: Record<string, string | number | undefined | null>;
  q?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  values?: Record<string, string>;
};

export function buildQuery({ params = {}, q = '', sort = '', dir = 'desc', values = {} }: TableState): URLSearchParams {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.set(k, String(v)); });
  if (q) u.set('q', q);
  if (sort) { u.set('sort', sort); u.set('dir', dir); }
  Object.entries(values).forEach(([k, v]) => { if (v) u.set(k, v); });
  return u;
}

/** The address of one page: path + query + page + size ("?" or "&" as the path needs). */
export function pageAddress(path: string, query: URLSearchParams, page: number, size: number): string {
  const u = new URLSearchParams(query);
  u.set('page', String(page));
  u.set('size', String(size));
  return `${path}${path.includes('?') ? '&' : '?'}${u}`;
}

/** The address of the export file (format csv or xlsx) of the same filtered list. */
export function exportAddress(path: string, query: URLSearchParams, format: 'csv' | 'xlsx'): string {
  const u = new URLSearchParams(query);
  u.set('format', format);
  return `${path}${path.includes('?') ? '&' : '?'}${u}`;
}
