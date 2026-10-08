/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-011 -- My Subscription (company Admin): the plan, its status, trial days left, the limits against what the
// company uses now (bars), the modules that are on or off, and the history. RefTech changes the plan.
// Backend: GET /api/platform/subscription/me (SubscriptionController); the owner sees one company with tenantId.
import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Section } from '@/shared/components/FormKit';
import { Badge, day, rupee, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing } from './platform';

const STATUS_TEXT: Record<string, string> = {
  TRIAL: 'Free trial', ACTIVE: 'Active', PAST_DUE: 'Payment due: you can see your data but not change it',
  SUSPENDED: 'Suspended: only this page and sign-in work', CANCELLED: 'Cancelled',
};

function Bar({ used, max }: { used: number | null; max: number | null }) {
  if (max === null || max === undefined) return <span className="text-sm text-slate-500">{used ?? '-'} used, no limit</span>;
  const pct = max <= 0 ? 100 : Math.min(100, Math.round(((used || 0) * 100) / max));
  const colour = pct >= 100 ? 'bg-red-600' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-600';
  return <div className="flex items-center gap-2">
    <div className="h-3 w-48 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={used || 0} aria-label={`${used ?? 0} of ${max}`}>
      <div className={`h-3 ${colour}`} style={{ width: `${pct}%` }} />
    </div>
    <span className="text-sm">{used ?? '-'} of {max}</span>
  </div>;
}

/** The subscription of one company (address /api/platform/subscription/me, or /api/platform/subscriptions/{id} for the owner). */
export function SubscriptionView({ path = '/api/platform/subscription/me', reloadKey }: { path?: string; reloadKey?: unknown }) {
  const [s, setS] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { setErr(''); api(path).then(setS).catch(e => setErr(e.message)); }, [path, reloadKey]);
  if (err) return /may|403/i.test(err) ? <NotAllowed what="see the subscription (only an Admin may)" /> : <div role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-red-800">{err}</div>;
  if (!s) return <p className="mt-4 text-slate-500">Loading...</p>;
  if (s.ready === false) return <ScriptMissing />;
  const status = s.effectiveStatus || s.status;
  return <>
    <Section title="Plan">
      {!s.hasSubscription ? <p>This company has no plan yet: nothing is limited. RefTech sets the plan.</p> : <div className="grid gap-3 md:grid-cols-3">
        <div><div className="text-sm text-slate-500">Plan</div><div className="text-2xl font-bold">{s.plan?.name || s.planCode}</div>
          {s.plan && <div className="text-sm text-slate-600">{rupee(s.plan.monthlyPrice)} a month or {rupee(s.plan.yearlyPrice)} a year (GST extra)</div>}</div>
        <div><div className="text-sm text-slate-500">Status</div><Badge v={status} /><div className="mt-1 text-sm text-slate-600">{STATUS_TEXT[status] || ''}</div>
          {s.suspendedReason && <div className="text-sm text-red-700">{s.suspendedReason}</div>}</div>
        <div>
          {s.status === 'TRIAL' && s.trialEndsOn && <><div className="text-sm text-slate-500">Trial</div><div className="text-2xl font-bold">{s.trialDaysLeft} days left</div><div className="text-sm text-slate-600">ends {day(s.trialEndsOn)}</div></>}
          {s.currentPeriodEnd && <div className="text-sm text-slate-600">Paid until {day(s.currentPeriodEnd)}</div>}
          {status === 'PAST_DUE' && <div className="text-sm text-amber-800">Suspended after {s.graceDays} days without payment.</div>}
        </div>
      </div>}
      {s.owner && <p className="mt-2 text-sm text-slate-500">This is the company that runs RefTech: it is never limited.</p>}
    </Section>
    <Section title="Limits and what you use now">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th scope="col" className="px-2.5 py-2 text-left">What</th><th scope="col" className="px-2.5 py-2 text-left">Used of the limit</th></tr></thead>
        <tbody>{(s.limits || []).map((l: any) => <tr key={l.key} className="border-t"><td className="px-2.5 py-2 capitalize">{l.label}</td><td className="px-2.5 py-2"><Bar used={l.used} max={l.max} /></td></tr>)}</tbody></table>
      <p className="mt-2 text-xs text-slate-500">Logins: active sign-ins of staff, drivers and partners. Trips: made this month. When a limit is reached, adding one more is refused; ask RefTech to change the plan.</p>
    </Section>
    <Section title="Modules">
      <ul className="grid gap-2 md:grid-cols-2">{(s.modules || []).map((m: any) => <li key={m.code} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
        <span>{m.label}</span><Badge v={m.on ? 'ON' : 'NOT_IN_PLAN'} /></li>)}</ul>
    </Section>
    {(s.events || []).length > 0 && <Section title="History">
      <table className="w-full text-sm"><thead><tr className="bg-slate-50"><th scope="col" className="px-2.5 py-2 text-left">When</th><th scope="col" className="px-2.5 py-2 text-left">What</th><th scope="col" className="px-2.5 py-2 text-left">By</th></tr></thead>
        <tbody>{s.events.map((e: any) => <tr key={e.id} className="border-t"><td className="px-2.5 py-2">{when(e.doneAt)}</td>
          <td className="px-2.5 py-2"><Badge v={e.action} /> {e.planCode} {e.fromStatus && `${e.fromStatus} -> `}{e.toStatus} {e.detail && <span className="text-slate-600">- {e.detail}</span>}</td><td className="px-2.5 py-2">{e.doneBy}</td></tr>)}</tbody></table>
    </Section>}
  </>;
}

export function MySubscriptionPage() {
  return <>
    <PageTitle icon={<CreditCard aria-hidden />} title="My Subscription">Your RefTech plan, its limits and what you use now. RefTech changes the plan for you.</PageTitle>
    <SubscriptionView />
  </>;
}
