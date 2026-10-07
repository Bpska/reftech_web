/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-003 .. 007, 009 -- the Dispatch Plan of one trip. Staff only.
//
// One page per trip: the header (trip, stage, approval, truck, route) with what Start Trip still needs, and the
// tabs Route (REQ-DSP-003), Load plan (004), Stock (005), Dock & Gate (006), Documents (009) and Suggestions (007).
// The page reads everything at once; after a change the whole plan is read again, so the Start Trip list stays true.
// Backend: GET /api/dispatch/trips/{id}/plan -> { ready, route, loadPlan, stock, dock, documents, loadingBlockers,
// startRules, canManage }, or { ready: false, message } until database_v2/64_dispatch_planning.sql is run.
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, ClipboardList, RefreshCw, XCircle } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, btnLight, errorText } from '@/shared/components/FormKit';
import { APPROVAL_STYLE, APPROVAL_TEXT, Problems, when } from './planning';
import { RouteTab } from './RouteTab';
import { LoadPlanTab } from './LoadPlanTab';
import { StockTab } from './StockTab';
import { DockGateTab } from './DockGateTab';
import { DocumentsTab } from './DocumentsTab';
import { SuggestionsTab } from './SuggestionsTab';

const TABS = [
  ['route', 'Route'], ['load', 'Load plan'], ['stock', 'Stock'], ['dock', 'Dock & Gate'], ['documents', 'Documents'], ['suggestions', 'Suggestions'],
] as const;
type Tab = typeof TABS[number][0];

const STAGE_STYLE: Record<string, string> = {
  PLANNED: 'bg-sky-100 text-sky-800', LOADING: 'bg-violet-100 text-violet-800', IN_TRANSIT: 'bg-emerald-100 text-emerald-800',
  AT_DELIVERY: 'bg-emerald-100 text-emerald-800', COMPLETED: 'bg-slate-200 text-slate-700', CANCELLED: 'bg-slate-200 text-slate-500',
};

export function DispatchPlanPage() {
  const { id } = useParams();
  const tripId = Number(id);
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find(t => t[0] === params.get('tab'))?.[0] || 'route') as Tab;
  const [plan, setPlan] = useState<any>(null), [err, setErr] = useState(''), [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPlan(await api(`/api/dispatch/trips/${tripId}/plan`)); setErr(''); }
    catch (e) { setErr(errorText(e, 'The plan of the trip could not be read')); }
    finally { setLoading(false); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load]);

  const choose = (t: Tab) => { params.set('tab', t); setParams(params, { replace: true }); };

  if (!Number.isFinite(tripId) || tripId <= 0) return <div className="p-4"><Banner error="This is not a trip number" /></div>;
  if (!plan) return <div className="p-4">{err ? <Banner error={err} /> : <p className="text-slate-500">Reading the plan…</p>}</div>;
  if (!plan.ready) return <div className="p-4">
    <h1 className="text-2xl font-black text-slate-900">Dispatch plan</h1>
    {plan.script ? <NotReady script={plan.script} /> : <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{plan.message || 'The dispatch planning tables are not set up yet.'}</div>}
  </div>;

  const r = plan.route || {};
  const stops: any[] = r.stops || [];
  const from = stops[0]?.place, to = stops.length > 1 ? stops[stops.length - 1]?.place : null;
  const rules: any[] = plan.startRules || [];
  const props = { tripId, plan, reload: load };

  return <div className="mx-auto max-w-7xl p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="text-sm text-slate-500"><Link to="/dispatch" className="hover:underline">Planning board</Link> / Dispatch plan</div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black text-slate-900">
          <ClipboardList className="h-6 w-6 text-sky-700" />Trip {r.tripNumber || tripId}
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${STAGE_STYLE[r.stage] || 'bg-slate-100 text-slate-700'}`}>{r.stageLabel || r.stage || '-'}</span>
          {r.approval && <span className={`rounded-full px-3 py-1 text-xs font-bold ${APPROVAL_STYLE[r.approval] || 'bg-slate-100 text-slate-700'}`}>{APPROVAL_TEXT[r.approval] || r.approval}</span>}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Truck <b>{r.vehicleNumber || 'not given'}</b>{from ? <> · {from}{to ? ` to ${to}` : ''}</> : null} · start {when(r.plannedStartAt)} · arrival {when(r.expectedArrivalAt)}
        </p>
        {r.approval === 'APPROVED' && r.canEdit && <p className="mt-1 text-xs text-amber-800">The trip is approved and frozen: only a Manager or Admin can change its plan, with a reason.</p>}
        {!r.canEdit && <p className="mt-1 text-xs text-slate-500">The trip has started; its plan is kept as it was.</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to={`/trips/${tripId}`} className={btnLight}>Trip details</Link>
        <button className={btnLight} disabled={loading} onClick={() => void load()}><RefreshCw className={`mr-1 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
      </div>
    </div>
    <Banner error={err} />

    <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Start Trip readiness</h2>
      {!rules.length ? <p className="mt-1 text-sm text-slate-500">No dispatch rules are checked for this trip.</p>
        : <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {rules.map(x => <li key={x.code} className={`flex gap-2 rounded-xl p-2 text-sm ${x.ok ? 'bg-emerald-50' : 'bg-red-50'}`}>
            {x.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
            <div><div className={`font-semibold ${x.ok ? 'text-emerald-900' : 'text-red-900'}`}>{x.label}</div>{x.problem && <div className="text-red-800">{x.problem}</div>}</div>
          </li>)}
        </ul>}
      <Problems items={plan.loadingBlockers} title="Loading cannot start yet" tone="amber" />
    </section>

    <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map(([k, t]) => <button key={k} onClick={() => choose(k)}
        className={`whitespace-nowrap rounded-t-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'border border-b-white border-slate-200 bg-white text-sky-800' : 'text-slate-600 hover:text-slate-900'}`}>{t}</button>)}
    </div>

    {tab === 'route' && <RouteTab {...props} />}
    {tab === 'load' && <LoadPlanTab {...props} />}
    {tab === 'stock' && <StockTab {...props} />}
    {tab === 'dock' && <DockGateTab {...props} />}
    {tab === 'documents' && <DocumentsTab {...props} />}
    {tab === 'suggestions' && <SuggestionsTab {...props} />}
  </div>;
}
