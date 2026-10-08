/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-016 -- Support Access.
//   Company Admin: let RefTech support look at the company for 1 to 72 hours (read only), see every request it made,
//   withdraw the access at any time.
//   Platform owner: the active grants of every company; "Open company" opens a new tab with a read-only view of that
//   company and a red banner. Every request of the support view is logged.
// Backend: /api/platform/support/** (SupportAccessController).
import { FormEvent, useEffect, useState } from 'react';
import { ExternalLink, LifeBuoy } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Badge, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { openSupportTab } from './support';

function GrantTable({ rows, owner, busy, onRevoke, onLog, onOpen }: {
  rows: any[]; owner?: boolean; busy: boolean; onRevoke: (g: any) => void; onLog: (g: any) => void; onOpen?: (g: any) => void;
}) {
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <thead><tr className="bg-slate-50">{[owner ? 'Company' : 'Granted by', 'Reason', 'From', 'Until', 'Status', 'Requests', ''].map(h => <th key={h} scope="col" className="px-2.5 py-2 text-left">{h}</th>)}</tr></thead>
    <tbody>{rows.map(g => <tr key={g.id} className="border-t">
      <td className="px-2.5 py-2">{owner ? <><b>{g.tenantName}</b><div className="text-xs text-slate-500">by {g.grantedBy}</div></> : g.grantedBy}</td>
      <td className="px-2.5 py-2">{g.reason}</td><td className="px-2.5 py-2">{when(g.startsAt)}</td><td className="px-2.5 py-2">{when(g.endsAt)}</td>
      <td className="px-2.5 py-2"><Badge v={g.status} />{g.revokedBy && <div className="text-xs text-slate-500">by {g.revokedBy}</div>}</td>
      <td className="px-2.5 py-2">{g.requests}</td>
      <td className="px-2.5 py-2"><div className="flex flex-wrap gap-1">
        {onOpen && g.status === 'ACTIVE' && <button type="button" disabled={busy} className={btn} onClick={() => onOpen(g)}><ExternalLink aria-hidden className="mr-1 inline h-4 w-4" />Open company</button>}
        <button type="button" className={btnLight} onClick={() => onLog(g)}>Log</button>
        {g.status === 'ACTIVE' && <button type="button" disabled={busy} className={btnRed} onClick={() => onRevoke(g)}>Withdraw</button>}
      </div></td>
    </tr>)}
      {rows.length === 0 && <tr><td colSpan={7} className="px-2.5 py-2 text-slate-500">None</td></tr>}</tbody>
  </table></div>;
}

export function SupportAccessPage() {
  const st = usePlatform();
  const [mine, setMine] = useState<any[]>([]), [all, setAll] = useState<any[]>([]), [onlyActive, setOnlyActive] = useState(true), [log, setLog] = useState<{ g: any; rows: any[] } | null>(null);
  const load = async () => {
    if (!st?.owner) setMine((await api('/api/platform/support/grants')).items || []);
    if (st?.owner) setAll((await api(`/api/platform/support/all?active=${onlyActive}`)).items || []);
  };
  const r = useRunner(load);
  useEffect(() => { if (st?.ready && st.admin && !st.supportSession) load().catch(e => r.setErr(e.message)); }, [st?.ready, st?.admin, st?.owner, onlyActive]);
  const head = <PageTitle icon={<LifeBuoy aria-hidden />} title="Support Access">Let RefTech support look at your company for a few hours to help you. Support can only look, never change.</PageTitle>;
  if (!st) return head;
  if (!st.ready) return <>{head}<ScriptMissing /></>;
  if (!st.admin || st.supportSession) return <>{head}<NotAllowed what="manage support access (only an Admin may)" /></>;

  async function grant(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const x = await r.run(() => api('/api/platform/support/grants', { method: 'POST', body: JSON.stringify({ reason: f.get('reason'), hours: f.get('hours') }) }),
      'Support access granted. RefTech is told.');
    if (x) form.reset();
  }
  const revoke = (g: any) => {
    if (!window.confirm('Withdraw this support access now? An open support view stops within 15 seconds.')) return;
    void r.run(() => api(`/api/platform/support/grants/${g.id}/revoke`, { method: 'POST' }), 'Withdrawn');
  };
  const showLog = async (g: any) => { try { setLog({ g, rows: await api(`/api/platform/support/grants/${g.id}/log`) }); } catch (e: any) { r.setErr(e.message); } };
  const open = async (g: any) => {
    await r.run(async () => {
      const s = await api(`/api/platform/support/grants/${g.id}/open`, { method: 'POST' });
      openSupportTab(s);
      return { message: `The support view of ${g.tenantName} is open in a new tab.` };
    });
  };

  return <>
    {head}
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    {!st.owner && <>
      <Section title="Grant support access">
        <form onSubmit={grant} className="grid gap-3 md:grid-cols-4">
          <label className={`${label} md:col-span-2`}>What should support look at? *<input name="reason" required minLength={5} maxLength={500} placeholder="e.g. Trip TRIP-2026-000123 shows the wrong temperature" className={input} /></label>
          <label className={label}>For how many hours (1 to 72)<input name="hours" type="number" min={1} max={72} defaultValue={4} required className={input} /></label>
          <div className="flex items-end"><button disabled={r.busy} className={btn}>Grant access</button></div>
          <p className="text-xs text-slate-500 md:col-span-4">Support sees your data as an Admin but cannot change anything. Every page it opens is in the log below. You can withdraw the access at any time.</p>
        </form>
      </Section>
      <Section title="Support access of your company"><GrantTable rows={mine} busy={r.busy} onRevoke={revoke} onLog={showLog} /></Section>
    </>}
    {st.owner && <Section title="Support access granted by the companies" right={<label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={onlyActive} onChange={e => setOnlyActive(e.target.checked)} />Active only</label>}>
      <GrantTable rows={all} owner busy={r.busy} onRevoke={revoke} onLog={showLog} onOpen={open} />
    </Section>}
    {log && <Section title={`Log of the support access #${log.g.id}${log.g.tenantName ? ' - ' + log.g.tenantName : ''}`} right={<button type="button" className={btnLight} onClick={() => setLog(null)}>Close</button>}>
      <table className="w-full text-sm"><thead><tr className="bg-slate-50">{['When', 'Who', 'Request'].map(h => <th key={h} scope="col" className="px-2.5 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody>{log.rows.map(x => <tr key={x.id} className="border-t"><td className="px-2.5 py-2">{when(x.at)}</td><td className="px-2.5 py-2">{x.username}</td>
          <td className="px-2.5 py-2 font-mono text-xs">{x.method} {x.path}</td></tr>)}
          {log.rows.length === 0 && <tr><td colSpan={3} className="px-2.5 py-2 text-slate-500">No requests</td></tr>}</tbody></table>
    </Section>}
  </>;
}
