/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-002 -- Companies (platform owner only): every subscribing company with plan, status, logins, trucks and
// date; onboard a new company in one form (company, plan, trial, first Admin login).
// Backend: /api/platform/tenants (TenantController), plans from /api/platform/plans.
import { FormEvent, useEffect, useState } from 'react';
import { Building2, Plus } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { Badge, day, useRunner } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, usePlatform } from './platform';

export const STATUS_OPTIONS: [string, string][] = [['TRIAL', 'Trial'], ['ACTIVE', 'Active'], ['PAST_DUE', 'Payment due'], ['SUSPENDED', 'Suspended'], ['CANCELLED', 'Cancelled']];

export function CompaniesPage() {
  const st = usePlatform();
  const [plans, setPlans] = useState<any[]>([]), [open, setOpen] = useState(false), [reload, setReload] = useState(0);
  const r = useRunner(async () => { setReload(x => x + 1); });
  useEffect(() => { if (st?.owner && st.ready) api('/api/platform/plans').then(x => setPlans(x.items || [])).catch(() => setPlans([])); }, [st?.owner, st?.ready]);
  const head = <PageTitle icon={<Building2 aria-hidden />} title="Companies">Every company that uses RefTech, and onboarding of a new one.</PageTitle>;
  if (!st) return head;
  if (!st.ready) return <>{head}<ScriptMissing /></>;
  if (!st.owner) return <>{head}<NotAllowed what="see every company (only an Admin of the company that runs RefTech may)" /></>;

  async function onboard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    if (f.get('adminPassword') !== f.get('confirm')) { r.setErr('The two passwords are not the same.'); return; }
    const body = Object.fromEntries(['code', 'name', 'gstin', 'stateName', 'contactEmail', 'contactPhone', 'planCode', 'trialDays', 'adminUsername', 'adminFullName', 'adminEmail', 'adminPassword'].map(k => [k, f.get(k)]));
    const x = await r.run(() => api('/api/platform/tenants', { method: 'POST', body: JSON.stringify(body) }));
    if (x) { form.reset(); setOpen(false); }
  }
  const toggle = (x: any) => {
    if (x.active && !window.confirm(`Switch off ${x.name}? Nobody of this company can sign in until it is switched on again.`)) return;
    void r.run(() => api(`/api/platform/tenants/${x.id}/active`, { method: 'POST', body: JSON.stringify({ active: !x.active }) }), x.active ? 'Company switched off' : 'Company switched on');
  };
  const planOptions = plans.map(p => [p.code, `${p.name} (${p.code})`] as [string, string]);

  return <>
    {head}
    <Banner msg={r.msg} />
    {r.err && <div role="alert" className="my-3 whitespace-pre-line rounded-xl bg-red-50 p-3 text-red-800">{r.err}</div>}
    <Section title="Onboard a new company" right={<button type="button" className={btn} onClick={() => setOpen(x => !x)} aria-expanded={open}><Plus aria-hidden className="mr-1 inline h-4 w-4" />{open ? 'Close' : 'New company'}</button>}>
      {open ? <form onSubmit={onboard} className="grid gap-3 md:grid-cols-3">
        <p className="font-semibold md:col-span-3">The company</p>
        <label className={label}>Company code *<input name="code" required pattern="[A-Za-z0-9_-]{2,40}" placeholder="e.g. FROSTY" className={`${input} uppercase`} /></label>
        <label className={`${label} md:col-span-2`}>Company name *<input name="name" required maxLength={160} className={input} /></label>
        <label className={label}>GSTIN<input name="gstin" maxLength={15} className={`${input} uppercase`} /></label>
        <label className={label}>State<input name="stateName" maxLength={60} className={input} /></label>
        <label className={label}>Contact email<input name="contactEmail" type="email" className={input} /></label>
        <label className={label}>Contact phone<input name="contactPhone" inputMode="tel" className={input} /></label>
        <label className={label}>Plan *<select name="planCode" required className={input} defaultValue="FREE_TRIAL">{planOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className={label}>Trial days<input name="trialDays" type="number" min={0} max={365} placeholder="the plan's own" className={input} /></label>
        <p className="mt-2 font-semibold md:col-span-3">The first Admin login</p>
        <label className={label}>Full name *<input name="adminFullName" required className={input} /></label>
        <label className={label}>Email<input name="adminEmail" type="email" className={input} /></label>
        <label className={label}>User name *<input name="adminUsername" required minLength={3} autoComplete="off" className={input} /></label>
        <label className={label}>Password *<input name="adminPassword" type="password" required autoComplete="new-password" className={input} /></label>
        <label className={label}>Password again *<input name="confirm" type="password" required autoComplete="new-password" className={input} /></label>
        <div className="flex items-end"><button disabled={r.busy} className={btn}>Create the company</button></div>
        <p className="text-xs text-slate-500 md:col-span-3">The roles of Access Control and the password rule are copied from your company. The Admin must choose a new password at the first sign-in and then sees Company Setup.</p>
      </form> : <p className="text-sm text-slate-600">Press New company to make a company, its plan and its first Admin login in one go.</p>}
    </Section>
    <Section title="All companies">
      <DataTable path="/api/platform/tenants" reloadKey={reload} exportName="companies" searchPlaceholder="Search code, name, email"
        filters={[{ name: 'plan', label: 'Plan', options: planOptions }, { name: 'status', label: 'Status', options: STATUS_OPTIONS }, { name: 'created', label: 'Created', range: 'date' }]}
        columns={[
          { key: 'code', label: 'Code', sort: 'code', className: 'font-mono' },
          { key: 'name', label: 'Company', sort: 'name', render: x => <><b>{x.name}</b>{x.owner && <span className="ml-1 text-xs text-slate-500">(runs RefTech)</span>}<div className="text-xs text-slate-500">{x.contactEmail || ''} {x.stateName || ''}</div></> },
          { key: 'planCode', label: 'Plan', sort: 'planCode', render: x => x.planCode || 'No plan' },
          { key: 'status', label: 'Status', render: x => <><Badge v={x.effectiveStatus || 'NO_PLAN'} />{x.trialEndsOn && x.status === 'TRIAL' && <div className="text-xs text-slate-500">ends {day(x.trialEndsOn)}</div>}{!x.active && <div><Badge v="SWITCHED_OFF" /></div>}</> },
          { key: 'users', label: 'Logins', sort: 'users' },
          { key: 'trucks', label: 'Trucks' },
          { key: 'createdAt', label: 'Created', sort: 'createdAt', render: x => day(x.createdAt) },
          { key: 'id', label: '', render: x => !x.owner && <button type="button" disabled={r.busy} onClick={() => toggle(x)} className={x.active ? btnRed : btnLight}>{x.active ? 'Switch off' : 'Switch on'}</button> },
        ]} />
    </Section>
  </>;
}
