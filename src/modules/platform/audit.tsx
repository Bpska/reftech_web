/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-001 -- pieces of the audit trail other screens can use:
//   <RecordHistory entity="operations/trips" id={123} />   who changed this record and when (Admin or AUDIT_VIEW)
//   <AuditDetail id={5} onClose={...} />                   one audit row with its masked request body
// Backend: /api/platform/audit/** (AuditController).
import { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';
import { api } from '@/shared/services/api';
import { btnLight, td, th } from '@/shared/components/FormKit';
import { Badge, when } from '@/modules/hr/hr';

export const ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'ACTION', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'EXPORT', 'DOWNLOAD'];

/** The request body as saved (secrets already shown as ***), made readable. */
export function prettyBody(text: any) {
  if (!text) return '-';
  try { return JSON.stringify(JSON.parse(String(text)), null, 2); } catch { return String(text); }
}

/** One audit row in a box: who, what, when and the masked body. */
export function AuditDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const [row, setRow] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { setRow(null); api(`/api/platform/audit/${id}`).then(setRow).catch(e => setErr(e.message)); }, [id]);
  return <section aria-label="Audit row details" className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">Audit row #{id}</h2>
      <button type="button" onClick={onClose} className={btnLight} aria-label="Close the details"><X aria-hidden className="h-4 w-4" /></button>
    </div>
    {err && <div role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>}
    {row && <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm md:grid-cols-4">
      <dt className="font-semibold">When</dt><dd>{when(row.createdAt)}</dd>
      <dt className="font-semibold">User</dt><dd>{row.username || '-'} {row.role && <span className="text-slate-500">({row.role})</span>}{row.support && <> <Badge v="SUPPORT" /></>}</dd>
      <dt className="font-semibold">Action</dt><dd><Badge v={row.action} /> {row.method} <span className="font-mono">{row.path}</span></dd>
      <dt className="font-semibold">Record</dt><dd>{row.entity || '-'} {row.entityId ? `#${row.entityId}` : ''}</dd>
      <dt className="font-semibold">Answer</dt><dd>{row.status} in {row.durationMs} ms</dd>
      <dt className="font-semibold">IP</dt><dd>{row.ip || '-'}</dd>
      <dt className="font-semibold">Browser</dt><dd className="md:col-span-3 break-all text-xs">{row.userAgent || '-'}</dd>
    </dl>}
    {row && <>
      <h3 className="mt-3 font-semibold">What was sent (passwords and other secrets are hidden)</h3>
      <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-white p-3 text-xs">{prettyBody(row.requestSummary)}</pre>
    </>}
  </section>;
}

/** History of one record from the audit trail. Shows nothing when the login may not see the audit trail. */
export function RecordHistory({ entity, id, title = 'History' }: { entity: string; id: number | string; title?: string }) {
  const [rows, setRows] = useState<any[] | null>(null), [hidden, setHidden] = useState(false), [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    setRows(null);
    api(`/api/platform/audit/record?entity=${encodeURIComponent(entity)}&id=${encodeURIComponent(String(id))}`)
      .then(x => { if (x?.ready === false) setHidden(true); else setRows(x?.items || []); })
      .catch(() => setHidden(true));
  }, [entity, id]);
  if (hidden) return null;
  return <section className="mt-4" aria-label={title}>
    <h3 className="flex items-center gap-1 font-semibold"><History aria-hidden className="h-4 w-4" />{title}</h3>
    {rows === null ? <p className="text-sm text-slate-500">Loading...</p> : rows.length === 0 ? <p className="text-sm text-slate-500">No changes recorded yet.</p> :
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50"><th scope="col" className={th}>When</th><th scope="col" className={th}>Who</th><th scope="col" className={th}>Action</th><th scope="col" className={th}>Address</th><th scope="col" className={th}>Status</th><th scope="col" className={th}><span className="sr-only">Details</span></th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.id} className="border-t">
          <td className={td}>{when(r.createdAt)}</td><td className={td}>{r.username || '-'}</td><td className={td}><Badge v={r.action} /></td>
          <td className={`${td} font-mono text-xs`}>{r.method} {r.path}</td><td className={td}>{r.status}</td>
          <td className={td}><button type="button" className={btnLight} onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>{open === r.id ? 'Hide' : 'Body'}</button></td>
        </tr>)}</tbody>
      </table></div>}
    {open !== null && rows && <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 text-xs">{prettyBody(rows.find(r => r.id === open)?.requestSummary)}</pre>}
  </section>;
}
