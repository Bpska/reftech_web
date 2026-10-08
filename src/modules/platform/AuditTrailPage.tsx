/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-001 -- Audit Trail (Admin, or a role with AUDIT_VIEW): every change, sign-in and export of the company,
// searchable, filtered and exported to CSV/Excel (the export is written to the trail too). View shows the request body
// with passwords and other secrets hidden. The platform owner may tick "All companies".
// Backend: /api/platform/audit/** (AuditController).
import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { btnLight } from '@/shared/components/FormKit';
import { Badge, can, useMe, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { ACTIONS, AuditDetail } from './audit';

export function AuditTrailPage() {
  const st = usePlatform(), me = useMe();
  const [entities, setEntities] = useState<string[]>([]), [open, setOpen] = useState<number | null>(null), [all, setAll] = useState(false);
  const allowed = !!st && (st.admin || can(me, 'AUDIT_VIEW'));
  useEffect(() => { if (st?.ready && allowed) api('/api/platform/audit/entities').then(x => setEntities(Array.isArray(x) ? x : [])).catch(() => {}); }, [st?.ready, allowed]);
  const title = <PageTitle icon={<ScrollText aria-hidden />} title="Audit Trail">Who changed what and when: changes, sign-ins and exports. Secrets such as passwords are never kept.</PageTitle>;
  if (!st || !me) return <>{title}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (!st.ready) return <>{title}<ScriptMissing /></>;
  if (!allowed) return <>{title}<NotAllowed what="see the audit trail. An Admin can give the permission AUDIT_VIEW in Access Control" /></>;
  return <>
    {title}
    {st.owner && <label className="mt-3 inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />All companies</label>}
    {open !== null && <AuditDetail id={open} onClose={() => setOpen(null)} />}
    <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <DataTable path="/api/platform/audit" exportName="audit-trail" params={{ scope: all ? 'all' : undefined }} searchPlaceholder="Search user, address, entity or IP"
        filters={[
          { name: 'action', label: 'Action', options: ACTIONS.map(a => [a, a.replace('_', ' ')] as [string, string]) },
          { name: 'entity', label: 'Entity', options: entities.map(e => [e, e] as [string, string]) },
          { name: 'status', label: 'Answer', options: [['200', '200 OK'], ['400', '400 refused'], ['401', '401 not signed in'], ['403', '403 not allowed'], ['404', '404 not found'], ['500', '500 error']] },
          { name: 'createdAt', label: 'Date', range: 'date' },
        ]}
        columns={[
          { key: 'createdAt', label: 'When', sort: 'createdAt', render: r => when(r.createdAt) },
          ...(all ? [{ key: 'tenantId', label: 'Company' }] : []),
          { key: 'username', label: 'User', sort: 'username', render: r => <>{r.username || '-'}{r.role && <div className="text-xs text-slate-500">{r.role}{r.support ? ' - support' : ''}</div>}</> },
          { key: 'action', label: 'Action', sort: 'action', render: r => <Badge v={r.action} /> },
          { key: 'entity', label: 'Record', sort: 'entity', render: r => <>{r.entity || '-'}{r.entityId ? ` #${r.entityId}` : ''}</> },
          { key: 'path', label: 'Address', render: r => <span className="font-mono text-xs">{r.method} {r.path}</span> },
          { key: 'status', label: 'Answer', sort: 'status', render: r => <span className={Number(r.status) >= 400 ? 'font-semibold text-red-700' : ''}>{r.status}</span> },
          { key: 'durationMs', label: 'ms', sort: 'durationMs' },
          { key: 'view', label: 'Details', render: r => <button type="button" className={btnLight} onClick={() => setOpen(r.id)} aria-label={`View audit row ${r.id}`}>View</button> },
        ]} />
    </div>
  </>;
}
