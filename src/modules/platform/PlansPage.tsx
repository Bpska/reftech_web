/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-011 -- Plans & Subscriptions (platform owner): change the plans (prices, limits, modules, trial days) and the
// plan and status of each company: change plan, suspend with a reason, reactivate, extend the trial.
// An empty limit means "no limit". Prices are in rupees without GST.
// Backend: /api/platform/plans, /api/platform/subscriptions (SubscriptionController).
import { FormEvent, useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Badge, day, rupee, useRunner } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';
import { SubscriptionView } from './MySubscriptionPage';
import { STATUS_OPTIONS } from './CompaniesPage';

const LIMIT_FIELDS: [string, string][] = [['maxUsers', 'Logins'], ['maxTrucks', 'Trucks'], ['maxWarehouses', 'Warehouses'], ['maxPartners', 'Partners'], ['maxTripsPerMonth', 'Trips a month']];

function PlanForm({ plan, modules, onSaved, onCancel }: { plan: any; modules: Record<string, string>; onSaved: () => void; onCancel: () => void }) {
  const r = useRunner();
  const isNew = !plan.code;
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Record<string, unknown> = Object.fromEntries(['code', 'name', 'monthlyPrice', 'yearlyPrice', 'trialDays', ...LIMIT_FIELDS.map(x => x[0])].map(k => [k, f.get(k)]));
    body.modules = Object.keys(modules).filter(m => f.get('m_' + m) === 'on');
    body.active = f.get('active') === 'on';
    const x = await r.run(() => api(isNew ? '/api/platform/plans' : `/api/platform/plans/${plan.code}`, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(body) }), 'Plan saved');
    if (x) onSaved();
  }
  const v = (k: string) => plan[k] ?? '';
  return <form onSubmit={save} className="grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
    {r.err && <div role="alert" className="rounded-xl bg-red-50 p-3 text-red-800 md:col-span-4">{r.err}</div>}
    <label className={label}>Code *<input name="code" required defaultValue={v('code')} readOnly={!isNew} pattern="[A-Za-z0-9_]{2,30}" className={`${input} uppercase`} /></label>
    <label className={label}>Name *<input name="name" required defaultValue={v('name')} className={input} /></label>
    <label className={label}>Monthly price (Rs.)<input name="monthlyPrice" type="number" min={0} step="0.01" defaultValue={v('monthlyPrice')} className={input} /></label>
    <label className={label}>Yearly price (Rs.)<input name="yearlyPrice" type="number" min={0} step="0.01" defaultValue={v('yearlyPrice')} className={input} /></label>
    {LIMIT_FIELDS.map(([k, t]) => <label key={k} className={label}>{t}<input name={k} type="number" min={0} defaultValue={v(k)} placeholder="no limit" className={input} /></label>)}
    <label className={label}>Trial days<input name="trialDays" type="number" min={0} max={365} defaultValue={v('trialDays')} className={input} /></label>
    <fieldset className="md:col-span-4"><legend className={label}>Modules in the plan</legend>
      <div className="flex flex-wrap gap-3">{Object.entries(modules).map(([m, t]) => <label key={m} className="flex items-center gap-1 text-sm">
        <input type="checkbox" name={'m_' + m} defaultChecked={(plan.modules || []).includes(m)} />{t}</label>)}</div>
    </fieldset>
    <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={plan.active !== false} />Offered to new companies</label>
    <div className="flex gap-2 md:col-span-3"><button disabled={r.busy} className={btn}>Save plan</button><button type="button" onClick={onCancel} className={btnLight}>Cancel</button></div>
  </form>;
}

export function PlansPage() {
  const st = usePlatform();
  const [plans, setPlans] = useState<any[]>([]), [modules, setModules] = useState<Record<string, string>>({}), [subs, setSubs] = useState<any[]>([]);
  const [editPlan, setEditPlan] = useState<any>(null), [company, setCompany] = useState<any>(null), [grace, setGrace] = useState(7), [tick, setTick] = useState(0);
  const load = async () => {
    const p = await api('/api/platform/plans?all=true'); setPlans(p.items || []); setModules(p.modules || {});
    const s = await api('/api/platform/subscriptions'); setSubs(s.items || []); setGrace(s.graceDays ?? 7); setTick(x => x + 1);
  };
  const r = useRunner(load);
  useEffect(() => { if (st?.owner && st.ready) load().catch(e => r.setErr(e.message)); }, [st?.owner, st?.ready]);
  const head = <PageTitle icon={<Layers aria-hidden />} title="Plans & Subscriptions">The plans RefTech sells and the plan of each company. Change the prices and limits here.</PageTitle>;
  if (!st) return head;
  if (!st.ready) return <>{head}<ScriptMissing /></>;
  if (!st.owner) return <>{head}<NotAllowed what="change plans (only an Admin of the company that runs RefTech may)" /></>;

  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(['planCode', 'status', 'currentPeriodEnd', 'trialEndsOn', 'note'].map(k => [k, f.get(k)]));
    if ((body.status === 'SUSPENDED' || body.status === 'CANCELLED') && !String(body.note || '').trim()) { r.setErr('Write the reason in the note.'); return; }
    await r.run(() => api(`/api/platform/subscriptions/${company.tenantId}/change`, { method: 'POST', body: JSON.stringify(body) }), 'Saved. The company sees it within 30 seconds.');
  }
  const suspend = (x: any) => {
    const reason = window.prompt(`Why is ${x.tenantName} suspended? The company's Admins see this reason.`, '');
    if (reason === null) return;
    void r.run(() => api(`/api/platform/subscriptions/${x.tenantId}/suspend`, { method: 'POST', body: JSON.stringify({ reason }) }), 'Suspended');
  };
  const reactivate = (x: any) => {
    const paidUntil = window.prompt(`Reactivate ${x.tenantName}. Paid until (YYYY-MM-DD, empty = no end date):`, '');
    if (paidUntil === null) return;
    void r.run(() => api(`/api/platform/subscriptions/${x.tenantId}/reactivate`, { method: 'POST', body: JSON.stringify({ paidUntil }) }), 'Reactivated');
  };
  const extend = (x: any) => {
    const days = window.prompt(`Extend the trial of ${x.tenantName} by how many days (1 to 90)?`, '7');
    if (days === null) return;
    void r.run(() => api(`/api/platform/subscriptions/${x.tenantId}/extend-trial`, { method: 'POST', body: JSON.stringify({ days }) }), 'Trial extended');
  };

  return <>
    {head}
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    <Section title="Plans" right={<button type="button" className={btn} onClick={() => setEditPlan({ modules: ['TRIPS', 'TRACKING'], active: true })}>New plan</button>}>
      {editPlan && <PlanForm key={editPlan.code || 'new'} plan={editPlan} modules={modules} onCancel={() => setEditPlan(null)} onSaved={() => { setEditPlan(null); void load(); }} />}
      <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50">{['Plan', 'Price', 'Logins', 'Trucks', 'Warehouses', 'Partners', 'Trips / month', 'Modules', 'Trial', 'Companies', ''].map(h => <th key={h} scope="col" className="px-2.5 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody>{plans.map(p => <tr key={p.code} className={`border-t ${p.active ? '' : 'opacity-60'}`}>
          <td className="px-2.5 py-2"><b>{p.name}</b><div className="font-mono text-xs text-slate-500">{p.code}{!p.active && ' (not offered)'}</div></td>
          <td className="px-2.5 py-2">{rupee(p.monthlyPrice)} / month<div className="text-xs text-slate-500">{rupee(p.yearlyPrice)} / year</div></td>
          {LIMIT_FIELDS.map(([k]) => <td key={k} className="px-2.5 py-2">{p[k] ?? 'no limit'}</td>)}
          <td className="px-2.5 py-2 text-xs">{(p.modules || []).map((m: string) => modules[m] || m).join(', ')}</td>
          <td className="px-2.5 py-2">{p.trialDays} days</td><td className="px-2.5 py-2">{p.companies}</td>
          <td className="px-2.5 py-2"><button type="button" className={btnLight} onClick={() => setEditPlan(p)} aria-label={`Change plan ${p.name}`}>Change</button></td>
        </tr>)}</tbody></table></div>
    </Section>
    <Section title="Companies and their plan" right={<button type="button" disabled={r.busy} className={btnLight}
      onClick={() => r.run(() => api('/api/platform/subscriptions/run-daily', { method: 'POST' }))}>Run the daily check now</button>}>
      <p className="mb-2 text-sm text-slate-600">After a trial or a paid period ends the company is PAST DUE (reads only) for {grace} days, then SUSPENDED. The check runs every night at 02:10.</p>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="bg-slate-50">{['Company', 'Plan', 'Status', 'Trial ends', 'Paid until', 'Changed', ''].map(h => <th key={h} scope="col" className="px-2.5 py-2 text-left">{h}</th>)}</tr></thead>
        <tbody>{subs.map(x => <tr key={x.tenantId} className="border-t">
          <td className="px-2.5 py-2"><b>{x.tenantName}</b> <span className="font-mono text-xs text-slate-500">{x.tenantCode}</span>{x.owner && <div className="text-xs text-slate-500">runs RefTech: never limited</div>}</td>
          <td className="px-2.5 py-2">{x.planCode || 'No plan'}</td>
          <td className="px-2.5 py-2"><Badge v={x.effectiveStatus || 'NO_PLAN'} />{x.suspendedReason && <div className="text-xs text-red-700">{x.suspendedReason}</div>}</td>
          <td className="px-2.5 py-2">{day(x.trialEndsOn)}</td><td className="px-2.5 py-2">{day(x.currentPeriodEnd)}</td>
          <td className="px-2.5 py-2 text-xs">{x.changedBy}<div>{day(x.changedAt)}</div></td>
          <td className="px-2.5 py-2"><div className="flex flex-wrap gap-1">
            <button type="button" className={btnLight} onClick={() => setCompany(x)}>Change</button>
            {!x.owner && x.status && <>
              {x.effectiveStatus === 'SUSPENDED' || x.effectiveStatus === 'CANCELLED'
                ? <button type="button" disabled={r.busy} className={btnLight} onClick={() => reactivate(x)}>Reactivate</button>
                : <button type="button" disabled={r.busy} className={btnRed} onClick={() => suspend(x)}>Suspend</button>}
              <button type="button" disabled={r.busy} className={btnLight} onClick={() => extend(x)}>Extend trial</button>
            </>}
          </div></td>
        </tr>)}</tbody></table></div>
    </Section>
    {company && <Section title={`Change the plan of ${company.tenantName}`} right={<button type="button" className={btnLight} onClick={() => setCompany(null)}>Close</button>}>
      <form key={company.tenantId + '-' + tick} onSubmit={change} className="grid gap-3 md:grid-cols-3">
        <label className={label}>Plan<select name="planCode" defaultValue={company.planCode || ''} required className={input}>
          <option value="">Choose</option>{plans.map(p => <option key={p.code} value={p.code}>{p.name} ({p.code})</option>)}</select></label>
        <label className={label}>Status<select name="status" defaultValue={company.status || 'ACTIVE'} disabled={company.owner} className={input}>{STATUS_OPTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className={label}>Paid until<input name="currentPeriodEnd" type="date" defaultValue={(company.currentPeriodEnd || '').slice(0, 10)} className={input} /></label>
        <label className={label}>Trial ends on<input name="trialEndsOn" type="date" defaultValue={(company.trialEndsOn || '').slice(0, 10)} className={input} /></label>
        <label className={`${label} md:col-span-2`}>Note (the reason when suspended)<input name="note" maxLength={300} className={input} /></label>
        <div className="md:col-span-3"><button disabled={r.busy} className={btn}>Save</button></div>
      </form>
      <SubscriptionView path={`/api/platform/subscriptions/${company.tenantId}`} reloadKey={tick} />
    </Section>}
  </>;
}
