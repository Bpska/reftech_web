/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-009, 003, 005, 007, 015 -- Government checks of a trip, on the Trip details page (staff only).
//
//   Before the start  what Start Trip will find now: papers and permits for the states of the route, blacklist,
//                     licence, FASTag (read again at Start Trip when FASTag is connected), old challans, no-entry
//                     hours. "Manager approval" items need a Manager's approval with a reason: at Start Trip, or
//                     here before it (so the driver can start from the app). An item a Manager already approved
//                     for this trip, in the same words, is not asked again.
//   Saved checks      every check kept with the trip: at Create Trip and at Start Trip, the result, who, the reason.
//
// Backend: /api/gov/trips/{id}/start-check, /start-approval, /checks (GovController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, btn, errorText, input, label } from '@/shared/components/FormKit';
import { sourceText, when } from './gov';

type Item = { level: string; code: string; text: string; source?: string | null; approved?: boolean };
type Saved = { id: number; stage: string; states?: string | null; result: string; items: Item[]; overrideReason?: string | null; checkedByName?: string | null; checkedAt: string };

export const GOV_LEVEL: Record<string, [string, string]> = {
  REFUSE: ['Not allowed', 'bg-red-200 text-red-900'], APPROVAL: ['Manager approval', 'bg-amber-200 text-amber-900'], WARN: ['Note', 'bg-sky-200 text-sky-900'],
};
const RESULT: Record<string, [string, string]> = {
  CLEAR: ['Nothing found', 'bg-emerald-100 text-emerald-800'], WARN: ['Allowed, with notes', 'bg-sky-100 text-sky-800'],
  APPROVED: ['Approved by a Manager', 'bg-amber-100 text-amber-900'], REFUSED: ['Refused', 'bg-red-100 text-red-800'],
};
const STAGE: Record<string, string> = { CREATE: 'Create Trip', START: 'Start Trip' };

/** One government item with its level. */
export function GovItem({ i }: { i: Item }) {
  const l = GOV_LEVEL[i.level] || [i.level, 'bg-slate-200 text-slate-800'];
  return <li><span className={`mr-1 rounded-full px-1.5 py-0.5 text-xs font-bold ${l[1]}`}>{l[0]}</span>{i.text}
    {i.approved ? <span className="ml-1 text-xs font-semibold text-emerald-700">(approved for this trip)</span> : null}
    {i.source ? <span className="text-xs text-slate-500"> ({sourceText(i.source)})</span> : null}</li>;
}

export function GovTripChecksPanel({ tripId, planned, refreshKey }: { tripId: number; planned: boolean; refreshKey?: number }) {
  const [now, setNow] = useState<any>(null), [saved, setSaved] = useState<Saved[] | null>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const load = () => {
    setErr('');
    api(`/api/gov/trips/${tripId}/checks`).then(setSaved).catch(e => setErr(errorText(e, 'The government checks could not be read')));
    if (planned) api(`/api/gov/trips/${tripId}/start-check`).then(setNow).catch(e => setErr(errorText(e, 'The government check could not be read')));
    else setNow(null);
  };
  useEffect(() => { load(); }, [tripId, planned, refreshKey]);

  async function approve(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const reason = String(new FormData(e.currentTarget).get('reason') || '');
    setBusy(true); setMsg(''); setErr('');
    try {
      const x = await api(`/api/gov/trips/${tripId}/start-approval`, { method: 'POST', body: JSON.stringify({ reason }) });
      setNow(x); setMsg('Approved. The trip can now be started, also from the driver app.');
      api(`/api/gov/trips/${tripId}/checks`).then(setSaved).catch(() => undefined);
    } catch (x) { setErr(errorText(x, 'Not approved')); } finally { setBusy(false); }
  }

  if (now?.ready === false) return null;   // script 43 not run: the government screens say so
  const items: Item[] = now?.items || [];
  return <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
    <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><ShieldCheck className="h-5 w-5 text-sky-700" />Government checks</h2>
    <Banner msg={msg} error={err} />

    {planned && now && <div className={`mt-3 rounded-xl p-3 text-sm ${now.refused ? 'bg-red-50 text-red-900' : now.needsApproval ? 'bg-amber-50 text-amber-900' : items.length ? 'bg-sky-50 text-sky-900' : 'bg-emerald-50 text-emerald-900'}`}>
      <b>If the trip starts now: {now.refused ? 'Start Trip will be refused.' : now.needsApproval ? 'a Manager\'s approval is needed.' : items.length ? 'allowed, with notes.' : 'nothing found.'}</b>
      {(now.states || []).length > 0 && <span> States on the route: {now.states.join(', ')}.</span>}
      {now.tagReadAgain && <span> The FASTag is read again when the trip starts.</span>}
      {items.length > 0 && <ul className="mt-2 space-y-1">{items.map((i, n) => <GovItem key={n} i={i} />)}</ul>}
      {!now.refused && now.needsApproval && (now.canApprove
        ? <form onSubmit={approve} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[18rem] grow"><label className={label} htmlFor="gov-start-reason">Reason for the approval (at least {now.minReasonLength || 10} letters) *</label>
            <input id="gov-start-reason" name="reason" required minLength={now.minReasonLength || 10} maxLength={500} className={input} placeholder="Permit renewal applied, receipt in the cab" /></div>
          <button className={btn} disabled={busy}>Approve for Start Trip</button>
        </form>
        : <p className="mt-2">Ask a Manager to approve it here, or to start the trip.</p>)}
    </div>}

    <h3 className="mt-4 font-bold text-slate-900">Saved checks</h3>
    {!saved ? <p className="mt-1 text-sm text-slate-500">Loading...</p> : saved.length === 0 ? <p className="mt-1 text-sm text-slate-500">No government check is saved with this trip yet.</p> :
      <ul className="mt-2 space-y-3">{saved.map(c => {
        const r = RESULT[c.result] || [c.result, 'bg-slate-100 text-slate-700'];
        return <li key={c.id} className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2"><b>{STAGE[c.stage] || c.stage}</b><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r[1]}`}>{r[0]}</span>
            <span className="text-slate-500">{when(c.checkedAt)}{c.checkedByName ? `, ${c.checkedByName}` : ''}</span></div>
          {c.states && <p className="mt-1 text-slate-600">States on the route: {c.states}</p>}
          {c.overrideReason && <p className="mt-1 text-amber-900">Reason: {c.overrideReason}</p>}
          {c.items?.length ? <ul className="mt-1 space-y-1">{c.items.map((i, n) => <GovItem key={n} i={i} />)}</ul> : <p className="mt-1 text-slate-500">Nothing found.</p>}
        </li>;
      })}</ul>}
  </section>;
}
