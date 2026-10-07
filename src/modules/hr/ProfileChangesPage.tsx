/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-007 -- changes of contact, bank and emergency details that people asked for in My HR (permission
// HR_EMPLOYEES). Approve changes the employee record; refuse needs a reason the person sees.
// Backend: /api/hr/profile-changes (ProfileChangeController).
import { useEffect, useState } from 'react';
import { UserCog } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btnLight, btnRed, input, td, th } from '@/shared/components/FormKit';
import { Badge, HR_SCRIPT, NoAccess, can, useMe, useRunner, when } from './hr';

export function ProfileChangesPage() {
  const me = useMe();
  const [status, setStatus] = useState('PENDING'), [rows, setRows] = useState<any[]>([]);
  const load = () => api('/api/hr/profile-changes?status=' + status).then(setRows);
  const r = useRunner(load);
  useEffect(() => { if (me && can(me, 'HR_EMPLOYEES') && me.ready !== false) load().catch(e => r.setErr(e.message)); }, [me, status]);
  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">Profile Changes</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_EMPLOYEES')) return <><h1 className="text-3xl font-bold">Profile Changes</h1><NoAccess what="decide profile changes" /></>;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><UserCog />Profile Changes</h1>
    <p className="text-slate-600">Mobile, email, address, bank and emergency contact changes asked for in My HR.</p>
    <Banner msg={r.msg} error={r.err} />
    <Section title="Requests" right={<select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="PENDING">Waiting</option><option value="ALL">All</option></select>}>
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Change</th><th className={th}>Asked</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className="border-t">
          <td className={td}><b>{x.employeeName}</b><div className="text-xs text-slate-500">{x.employeeCode}</div></td>
          <td className={td}>{(x.changes || []).map((c: any) => <div key={c.field}><span className="font-semibold">{c.label}:</span> <span className="text-slate-500 line-through">{c.from || '-'}</span> to <b>{c.to || '(empty)'}</b></div>)}</td>
          <td className={td}>{when(x.requestedAt)}</td>
          <td className={td}><Badge v={x.status} />{x.decidedBy && <div className="text-xs text-slate-500">{x.decidedBy} {x.decisionNote}</div>}</td>
          <td className={td}>{x.status === 'PENDING' && <div className="flex gap-1">
            <button disabled={r.busy} onClick={() => r.run(() => api(`/api/hr/profile-changes/${x.id}/approve`, { method: 'POST', body: '{}' }), 'Approved; the employee record is changed')} className={btnLight}>Approve</button>
            <button disabled={r.busy} onClick={() => { const n = window.prompt('Why is the change not accepted?', ''); if (n) void r.run(() => api(`/api/hr/profile-changes/${x.id}/reject`, { method: 'POST', body: JSON.stringify({ note: n }) })); }} className={btnRed}>Refuse</button></div>}</td>
        </tr>)}</tbody></table>
    </Section>
  </>;
}
