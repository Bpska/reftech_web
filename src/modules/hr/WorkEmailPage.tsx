/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-HR-006 -- work email on joining (permission HR_WORK_EMAIL). When onboarding is completed a mailbox request is
// made (first.last@domain, a number added when taken); when someone leaves, a request to close it. With the MANUAL
// provider IT makes the mailbox and presses Done; with HTTP the mail system is called and Retry repeats a failure.
// The person gets a welcome mail on the personal email and sees the work email in My HR.
// Backend: /api/hr/work-email/** (WorkEmailController).
import { FormEvent, useEffect, useState } from 'react';
import { AtSign } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, HR_SCRIPT, NoAccess, can, day, useMe, useRunner, when } from './hr';

export function WorkEmailPage() {
  const me = useMe();
  const [status, setStatus] = useState('OPEN'), [rows, setRows] = useState<any[]>([]), [settings, setSettings] = useState<any>(null), [without, setWithout] = useState<any[]>([]);
  const load = async () => { setRows(await api('/api/hr/work-email?status=' + status)); setWithout(await api('/api/hr/work-email/without')); };
  const r = useRunner(load);
  useEffect(() => { if (me && can(me, 'HR_WORK_EMAIL') && me.ready !== false) { load().catch(e => r.setErr(e.message)); api('/api/hr/work-email/settings').then(setSettings).catch(() => {}); } }, [me, status]);
  if (me && me.ready === false) return <><h1 className="text-3xl font-bold">Work Email</h1><NotReady script={HR_SCRIPT} /></>;
  if (me && !can(me, 'HR_WORK_EMAIL')) return <><h1 className="text-3xl font-bold">Work Email</h1><NoAccess what="work with work email accounts" /></>;
  async function ask(employeeId: number) {
    const s = await api('/api/hr/work-email/suggest?employeeId=' + employeeId).catch(() => ({ address: '' }));
    const address = window.prompt('Work email address', s.address || '');
    if (address === null) return;
    await r.run(() => api('/api/hr/work-email', { method: 'POST', body: JSON.stringify({ employeeId, address }) }), 'Request made');
  }
  const done = (x: any) => {
    const address = x.action === 'CREATE' ? window.prompt('The mailbox that was made', x.address) : x.address;
    if (address === null) return;
    void r.run(() => api(`/api/hr/work-email/${x.id}/done`, { method: 'POST', body: JSON.stringify({ address }) }), x.action === 'CREATE' ? 'Done. The person is told by mail and sees it in My HR.' : 'Done');
  };
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><AtSign />Work Email</h1>
    <p className="text-slate-600">Mailboxes for people who join, and closing them for people who leave.
      {settings && <> Provider <b>{settings.provider}</b>, addresses like <b>{settings.format}@{settings.domain}</b>{!settings.enabled && ' (automatic requests are switched off)'}.</>}</p>
    <Banner msg={r.msg} error={r.err} />
    <Section title="Requests" right={<select value={status} onChange={e => setStatus(e.target.value)} className={input}><option value="OPEN">Waiting</option><option value="DONE">Done</option><option value="ALL">All</option></select>}>
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th className={th}>Employee</th><th className={th}>Action</th><th className={th}>Address</th><th className={th}>Status</th><th className={th}>Asked</th><th className={th}>Done</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(x => <tr key={x.id} className="border-t">
          <td className={td}><b>{x.employeeName}</b><div className="text-xs text-slate-500">{x.employeeCode} {x.designation} {x.joiningDate && `joined ${day(x.joiningDate)}`}</div></td>
          <td className={td}>{x.action === 'CREATE' ? 'Make mailbox' : 'Close mailbox'}</td><td className={`${td} font-mono`}>{x.address}</td>
          <td className={td}><Badge v={x.status} />{x.lastError && <div className="max-w-xs text-xs text-red-700">{x.lastError}</div>}</td>
          <td className={td}>{x.requestedBy}<div className="text-xs text-slate-500">{when(x.requestedAt)}</div></td><td className={td}>{x.doneBy || '-'}<div className="text-xs text-slate-500">{when(x.doneAt)}</div></td>
          <td className={td}><div className="flex gap-1">{['REQUESTED', 'FAILED'].includes(x.status) && <>
            <button disabled={r.busy} onClick={() => done(x)} className={btnLight}>Done</button>
            {x.provider === 'HTTP' && <button disabled={r.busy} onClick={() => r.run(() => api(`/api/hr/work-email/${x.id}/retry`, { method: 'POST' }))} className={btnLight}>Retry</button>}
            <button disabled={r.busy} onClick={() => { const why = window.prompt('Why is the request cancelled?', ''); if (why !== null) void r.run(() => api(`/api/hr/work-email/${x.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: why }) })); }} className={btnRed}>Cancel</button></>}</div></td>
        </tr>)}</tbody></table>
    </Section>
    <Section title={`Active employees without a work email (${without.length})`}>
      <table className="w-full text-sm"><tbody>{without.map(x => <tr key={x.employeeId} className="border-t"><td className={td}><b>{x.employeeName}</b> {x.employeeCode}</td><td className={td}>{x.role}</td><td className={td}>{day(x.joiningDate)}</td>
        <td className={td}><button disabled={r.busy} onClick={() => ask(x.employeeId)} className={btnLight}>Ask for a mailbox</button></td></tr>)}</tbody></table>
    </Section>
  </>;
}
