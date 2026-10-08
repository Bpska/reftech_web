/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-008 -- Replenishment suggestions (/cnf/replenishment). Staff choose the principal, set the stock band per
// depot (and product), and work out the suggestions: the weekly dispatches of the last weeks, the forecast, the stock
// that can still be sold before its last dispatch day, the open orders and what is on the way. The principal (partner
// login) sees its own suggestions and accepts (with its own quantity) or rejects them.
// Backend: /api/cnf/replenishment/** (com.reftech.core.cnf.replenish).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { BarChart } from '@/modules/platform/charts';
import { day, post, qty, useRunner } from './cnf';
import { Grid, Info, Pill } from './CnfKit';
import { REPLENISH_SCRIPT, bandColour, decisionProblem, stepsOf, weeklyChart } from './replenish';

const STATUSES: [string, string][] = [['', 'Open and decided'], ['PROPOSED', 'Proposed'], ['ACCEPTED', 'Accepted'], ['REJECTED', 'Rejected'], ['CANCELLED', 'Cancelled'], ['EXPIRED', 'Replaced'], ['ALL', 'All']];

export function ReplenishmentPage() {
  const r = useRunner();
  const [status, setStatus] = useState<any>(null);
  const [principals, setPrincipals] = useState<any[]>([]);
  const [principalId, setPrincipalId] = useState<number | null>(() => {
    const v = Number(localStorage.getItem('reftech_cnf_principal') || 0);
    return v > 0 ? v : null;
  });
  const [filter, setFilter] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [rules, setRules] = useState<any>({ rules: [], depots: [], products: [] });
  const [sel, setSel] = useState<any>(null);
  const [n, setN] = useState(0);
  const reload = () => setN(x => x + 1);

  useEffect(() => {
    api('/api/cnf/replenishment/status').then(s => {
      setStatus(s);
      if (s.ready === false || s.partnerLogin) return;
      api('/api/cnf/principals').then(p => {
        const list = (p.principals || []).filter((x: any) => x.contractId);
        setPrincipals(list);
        setPrincipalId(cur => (cur && list.some((x: any) => x.id === cur) ? cur : list[0]?.id ?? null));
      }).catch(x => r.setError((x as Error).message));
    }).catch(x => r.setError((x as Error).message));
  }, []);

  const partner = !!status?.partnerLogin;
  const q = partner ? '' : `principalId=${principalId ?? ''}`;

  useEffect(() => {
    if (!status || status.ready === false || (!partner && !principalId)) return;
    api(`/api/cnf/replenishment/suggestions?${q}&status=${filter}`).then(x => setRows(x.suggestions || [])).catch(x => r.setError((x as Error).message));
    if (!partner) api(`/api/cnf/replenishment/rules?${q}`).then(setRules).catch(() => setRules({ rules: [], depots: [], products: [] }));
  }, [status, principalId, filter, n]);

  const open = (id: number) => r.run(() => api(`/api/cnf/replenishment/suggestions/${id}`)).then(x => x && setSel(x));

  if (status?.ready === false) return <NotReady script={status.script || REPLENISH_SCRIPT} />;

  return <div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Boxes className="h-7 w-7 text-sky-700" />Replenishment</h1>
      {!partner && <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className={label}>Principal</span>
          <select className={input} value={principalId ?? ''} onChange={e => { setPrincipalId(Number(e.target.value) || null); setSel(null); }}>
            {principals.length === 0 && <option value="">No principal with a C&F contract</option>}
            {principals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>
        <Link to="/cnf" className={btnLight}>C&F Agency</Link>
      </div>}
    </div>
    <p className="mt-1 text-sm text-slate-600">
      {partner ? 'Your C&F agent suggests how much stock to send to each depot, from your recent dispatches and open orders. Accept a suggestion (you can change the quantity) or reject it.'
        : 'Forecast of the coming weeks from the dispatches in the stock ledger and the open orders; the quantity to call in so that stock stays between the minimum and the maximum, counting only stock that can still be sold before its last dispatch day.'}
    </p>
    <Banner msg={r.msg} error={r.error} />

    {!partner && status?.canWrite && <RunBox principalId={principalId} busy={r.busy} onRun={b => r.run(() => post('/api/cnf/replenishment/run', b)).then(x => { if (x) { setFilter(''); reload(); } })} />}

    <Section title="Suggestions" right={<select className={`${input} w-auto`} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Status">
      {STATUSES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Grid rows={rows} empty={partner ? 'No suggestion for you yet.' : 'No suggestion yet. Work them out above.'} onRow={x => open(x.id)} selected={sel?.id}
        cols={[
          { key: 'suggestionNo', title: 'No.' },
          { key: 'warehouseName', title: 'Depot' },
          { key: 'product', title: 'Product', render: x => <>{x.productCode} <span className="text-slate-500">{x.productName}</span></> },
          { key: 'asOf', title: 'As of', render: x => day(x.asOf) },
          { key: 'usableQty', title: 'Usable stock', right: true, render: x => qty(x.usableQty) },
          { key: 'forecastQty', title: 'Forecast', right: true, render: x => qty(x.forecastQty) },
          { key: 'band', title: 'Min - max', right: true, render: x => `${qty(x.minQty)} - ${qty(x.maxQty)}` },
          { key: 'suggestedQty', title: 'Call in', right: true, render: x => <b>{qty(x.suggestedQty)}</b> },
          { key: 'acceptedQty', title: 'Accepted', right: true, render: x => (x.acceptedQty == null ? '' : qty(x.acceptedQty)) },
          { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
        ]} />
    </Section>

    {sel && <Detail s={sel} partner={partner} canWrite={!!status?.canWrite} busy={r.busy}
      onDecide={(b) => r.run(() => post(`/api/cnf/replenishment/suggestions/${sel.id}/decide`, b)).then(x => { if (x) { open(sel.id); reload(); } })}
      onCancel={(note) => r.run(() => post(`/api/cnf/replenishment/suggestions/${sel.id}/cancel`, { note })).then(x => { if (x) { open(sel.id); reload(); } })} />}

    {!partner && <Rules data={rules} principalId={principalId} canWrite={!!status?.canWrite} busy={r.busy}
      onSave={b => r.run(() => post('/api/cnf/replenishment/rules', { ...b, principalId })).then(x => { if (x) reload(); })} />}
  </div>;
}

function RunBox({ principalId, busy, onRun }: { principalId: number | null; busy: boolean; onRun: (b: Record<string, unknown>) => void }) {
  const [weeks, setWeeks] = useState('12');
  const [horizon, setHorizon] = useState('4');
  return <Section title="Work out suggestions">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm"><span className={label}>Weeks of history</span><input className={`${input} w-28`} type="number" min={4} max={52} value={weeks} onChange={e => setWeeks(e.target.value)} /></label>
      <label className="text-sm"><span className={label}>Weeks to forecast</span><input className={`${input} w-28`} type="number" min={1} max={12} value={horizon} onChange={e => setHorizon(e.target.value)} /></label>
      <button className={btn} disabled={busy || !principalId} onClick={() => onRun({ principalId, historyWeeks: Number(weeks), horizonWeeks: Number(horizon) })}>Work out for every depot and product</button>
    </div>
    <p className="mt-2 text-xs text-slate-500">A new suggestion replaces the older proposed one of the same depot and product. Nothing is suggested when the stock stays above the minimum.</p>
  </Section>;
}

function Detail({ s, partner, canWrite, busy, onDecide, onCancel }: {
  s: any; partner: boolean; canWrite: boolean; busy: boolean; onDecide: (b: Record<string, unknown>) => void; onCancel: (note: string) => void;
}) {
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState('');
  const chart = weeklyChart(s.weeklyHistory, s.weeklyForecast);
  const projected = Number(s.usableQty ?? 0) + Number(s.inTransitQty ?? 0) + Number(s.calledInQty ?? 0);
  const decide = (decision: 'ACCEPT' | 'REJECT') => {
    const p = decisionProblem(decision, quantity, note);
    setErr(p);
    if (!p) onDecide({ decision, quantity: quantity.trim() === '' ? undefined : Number(quantity), note });
  };
  return <Section title={<>{s.suggestionNo} <Pill s={s.status} /></>}>
    <Info items={[
      ['Product', `${s.productCode ?? ''} ${s.productName ?? ''}`], ['Depot', s.warehouseName], ['As of', day(s.asOf)], ['Lead time', `${s.leadTimeDays} days`],
      ['Average a day', qty(s.avgDaily)], ['Forecast', `${qty(s.forecastQty)} in ${s.horizonWeeks} weeks`], ['Open orders', qty(s.openOrderQty)], ['On the way', qty(s.inTransitQty)],
      ['Stock in the depot', qty(s.onHandQty)], ['Usable before expiry', qty(s.usableQty)], ['Expiring unsold', qty(s.expiringQty)], ['Called in, not received', qty(s.calledInQty)],
      ['Minimum', qty(s.minQty)], ['Maximum', qty(s.maxQty)], ['Stock position', <span className={`font-bold ${bandColour(projected, s.minQty, s.maxQty)}`}>{qty(projected)}</span>], ['Suggested call-in', <b>{qty(s.suggestedQty)}</b>],
    ]} />
    {chart.labels.length > 0 && <div className="mt-4"><BarChart title="Weekly dispatches and forecast" labels={chart.labels} series={chart.series} /></div>}
    <h3 className="mt-4 font-bold">How it was worked out</h3>
    <ol className="mt-1 list-decimal space-y-1 pl-6 text-sm text-slate-700">{stepsOf(s.steps).map((x, i) => <li key={i}>{x}</li>)}</ol>
    {s.status !== 'PROPOSED' && s.decidedAt && <p className="mt-3 text-sm text-slate-600">{s.status} by {s.decidedByName}{s.decidedByPartner ? ' (principal)' : ''} on {day(s.decidedAt)}{s.decidedNote ? `: ${s.decidedNote}` : ''}</p>}
    {s.status === 'PROPOSED' && (partner || canWrite) && <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-sm"><span className={label}>Quantity to call in (empty = {qty(s.suggestedQty)})</span><input className={input} type="number" min={0} step="any" value={quantity} onChange={e => setQuantity(e.target.value)} /></label>
        <label className="text-sm md:col-span-2"><span className={label}>Note (needed to reject)</span><input className={input} maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
      </div>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={btn} disabled={busy} onClick={() => decide('ACCEPT')}>Accept</button>
        <button className={btnLight} disabled={busy} onClick={() => decide('REJECT')}>Reject</button>
        {!partner && canWrite && <button className={btnLight} disabled={busy} onClick={() => onCancel(note)}>Cancel suggestion</button>}
      </div>
    </div>}
  </Section>;
}

function Rules({ data, principalId, canWrite, busy, onSave }: { data: any; principalId: number | null; canWrite: boolean; busy: boolean; onSave: (b: Record<string, unknown>) => void }) {
  const [edit, setEdit] = useState<any>(null);
  const depots: [number, string][] = (data.depots || []).map((d: any) => [d.id, d.name]);
  const products: [number, string][] = (data.products || []).map((p: any) => [p.id, `${p.code} ${p.name}`]);
  return <Section title="Stock bands" right={canWrite && principalId ? <button className={btnLight} onClick={() => setEdit({ minCoverDays: 7, maxCoverDays: 21, leadTimeDays: 3, orderMultiple: 1, active: true })}>Add band</button> : null}>
    <p className="mb-2 text-sm text-slate-600">A band without a product is the default of the depot. Fixed minimum and maximum quantities win over days of cover; the maximum is also capped by the shelf life.</p>
    <Grid rows={data.rules || []} empty="No band yet: the default is 7 to 21 days of cover, 3 days lead time." onRow={canWrite ? x => setEdit(x) : undefined}
      cols={[
        { key: 'warehouseName', title: 'Depot' },
        { key: 'product', title: 'Product', render: x => (x.productId ? `${x.productCode} ${x.productName}` : 'Every product (default)') },
        { key: 'qty', title: 'Min - max qty', render: x => (x.minQty == null && x.maxQty == null ? '-' : `${qty(x.minQty)} - ${qty(x.maxQty)}`) },
        { key: 'cover', title: 'Days of cover', render: x => `${x.minCoverDays} - ${x.maxCoverDays}` },
        { key: 'leadTimeDays', title: 'Lead time (days)', right: true },
        { key: 'orderMultiple', title: 'Multiple', right: true, render: x => qty(x.orderMultiple) },
        { key: 'active', title: 'Active', render: x => (x.active ? 'Yes' : 'No') },
      ]} />
    {edit && <div className="mt-3 rounded-xl bg-slate-50 p-3">
      <QuickForm key={edit.id ?? 'new'} initial={edit} busy={busy} submitText="Save band" onCancel={() => setEdit(null)} cols={4}
        onSubmit={v => { onSave({ ...v, productId: v.productId || null }); setEdit(null); }}
        fields={[
          { name: 'warehouseId', label: 'Depot', type: 'select', options: depots, required: true },
          { name: 'productId', label: 'Product (empty = every product)', type: 'select', options: products },
          { name: 'minQty', label: 'Minimum quantity', type: 'number' },
          { name: 'maxQty', label: 'Maximum quantity', type: 'number' },
          { name: 'minCoverDays', label: 'Minimum days of cover', type: 'number', required: true },
          { name: 'maxCoverDays', label: 'Maximum days of cover', type: 'number', required: true },
          { name: 'leadTimeDays', label: 'Lead time (days)', type: 'number', required: true },
          { name: 'orderMultiple', label: 'Round up to a multiple of', type: 'number', required: true },
          { name: 'active', label: 'Active', type: 'checkbox' },
          { name: 'note', label: 'Note', wide: true },
        ]} />
    </div>}
  </Section>;
}
