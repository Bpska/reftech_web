/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-018 -- Energy & Carbon (/energy): energy per chamber and per pallet-day, generator run hours and diesel,
// solar units and grid bills, carbon per trip, per customer and per month, and the monthly carbon report for the
// customers who ask for it. Staff: ENERGY_VIEW to look, ENERGY_EDIT to type and to make the reports. A partner login
// sees only its own carbon and its own monthly reports. Backend: /api/energy/** (com.reftech.core.platform.energy).
import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { BarChart, StackedBar } from '@/modules/platform/charts';
import { day, post, put, qty, useRunner, Runner } from '@/modules/cnf/cnf';
import { Grid, Info } from '@/modules/cnf/CnfKit';
import { ENERGY_SCRIPT, EnergyTab, co2Text, energyTabs, flagTone, lastMonthStart, periods } from './energy';

type Ctx = { r: Runner; canEdit: boolean; partner: boolean; from: string; to: string; warehouses: any[]; n: number; reload: () => void };

export function EnergyPage() {
  const r = useRunner();
  const [status, setStatus] = useState<any>(null);
  const [tab, setTab] = useState<EnergyTab>('carbon');
  const p0 = periods()[0];
  const [from, setFrom] = useState(p0.from);
  const [to, setTo] = useState(p0.to);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [n, setN] = useState(0);
  useEffect(() => {
    api('/api/energy/status').then(s => {
      setStatus(s);
      if (s.ready !== false && !s.partner) { setTab('chambers'); api('/api/energy/warehouses').then(x => setWarehouses(x.warehouses || [])).catch(() => {}); }
    }).catch(x => r.setError((x as Error).message));
  }, []);
  if (status?.ready === false) return <NotReady script={status.script || ENERGY_SCRIPT} />;
  const partner = !!status?.partner;
  const c: Ctx = { r, canEdit: !!status?.canEdit, partner, from, to, warehouses, n, reload: () => setN(x => x + 1) };
  return <div>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Leaf className="h-7 w-7 text-emerald-700" />{partner ? 'My Carbon Report' : 'Energy & Carbon'}</h1>
    <p className="mt-1 text-sm text-slate-600">{partner ? 'The carbon of your trips and your share of the cold stores used for your goods, and your monthly reports.'
      : 'Electricity per chamber and per pallet-day, generator diesel, solar units, and the carbon of trips and warehouses per customer and month.'}</p>
    <div className="mt-4 flex flex-wrap items-end gap-2">
      {energyTabs(partner).map(([k, t]) => <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{t}</button>)}
      <span className="ml-auto flex flex-wrap items-end gap-2">
        <select className={`${input} w-auto`} aria-label="Period" onChange={e => { const p = periods().find(x => x.key === e.target.value); if (p) { setFrom(p.from); setTo(p.to); } }}>
          {periods().map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
        <input className={`${input} w-auto`} type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" />
        <input className={`${input} w-auto`} type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To" />
      </span>
    </div>
    <Banner msg={r.msg} error={r.error} />
    {tab === 'chambers' && <Chambers c={c} />}
    {tab === 'generators' && <Generators c={c} />}
    {tab === 'solar' && <SolarGrid c={c} />}
    {tab === 'carbon' && <Carbon c={c} />}
    {tab === 'reports' && <Reports c={c} />}
  </div>;
}

function useGet(path: string | null, n: number, r: Runner) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { if (path) api(path).then(setData).catch(x => r.setError((x as Error).message)); }, [path, n]);
  return data;
}

const whOpts = (rows: any[]): [number, string][] => rows.map(w => [w.id, w.name]);

function Chambers({ c }: { c: Ctx }) {
  const d = useGet(`/api/energy/chambers?from=${c.from}&to=${c.to}`, c.n, c.r);
  if (!d) return null;
  const ch = d.chambers || [];
  return <>
    <Section title="Totals"><Info items={[['Chamber energy', `${qty(d.totals?.kwh)} kWh`], ['Pallet-days', qty(d.totals?.palletDays)], ['kWh per pallet-day', qty(d.totals?.kwhPerPalletDay)],
      ['Generator', `${qty(d.totals?.generatorHours)} h, ${qty(d.totals?.generatorLitres)} l`], ['Solar', `${qty(d.totals?.solarKwh)} kWh`]]} />
      <p className="mt-2 text-xs text-slate-500">{d.note}</p></Section>
    {ch.length > 0 && <div className="mt-5"><BarChart title="kWh per chamber" labels={ch.map((x: any) => x.chamberCode)} series={[{ name: 'kWh', values: ch.map((x: any) => Number(x.kwh)) }]} /></div>}
    <Section title="Chambers"><Grid rows={ch} empty="No chamber." cols={[
      { key: 'chamberCode', title: 'Chamber' }, { key: 'name', title: 'Name' }, { key: 'warehouseName', title: 'Warehouse' },
      { key: 'range', title: 'Range °C', render: x => `${x.minTemperatureC ?? ''} to ${x.maxTemperatureC ?? ''}` }, { key: 'readings', title: 'Readings', right: true },
      { key: 'kwh', title: 'kWh', right: true, render: x => qty(x.kwh) }, { key: 'palletDays', title: 'Pallet-days', right: true, render: x => qty(x.palletDays) },
      { key: 'kwhPerPalletDay', title: 'kWh / pallet-day', right: true, render: x => (x.kwhPerPalletDay == null ? '-' : qty(x.kwhPerPalletDay)) },
    ]} /></Section>
    <Section title="Warehouses"><Grid rows={d.warehouses || []} empty="No warehouse." cols={[
      { key: 'name', title: 'Warehouse' }, { key: 'kwh', title: 'kWh', right: true, render: x => qty(x.kwh) }, { key: 'palletDays', title: 'Pallet-days', right: true, render: x => qty(x.palletDays) },
      { key: 'kwhPerPalletDay', title: 'kWh / pallet-day', right: true, render: x => (x.kwhPerPalletDay == null ? '-' : qty(x.kwhPerPalletDay)) },
      { key: 'generatorHours', title: 'DG hours', right: true, render: x => qty(x.generatorHours) }, { key: 'generatorLitres', title: 'DG litres', right: true, render: x => qty(x.generatorLitres) },
      { key: 'solarKwh', title: 'Solar kWh', right: true, render: x => qty(x.solarKwh) },
    ]} /></Section>
  </>;
}

function Generators({ c }: { c: Ctx }) {
  const gens = useGet('/api/energy/generators', c.n, c.r);
  const logs = useGet(`/api/energy/generator-logs?from=${c.from}&to=${c.to}`, c.n, c.r);
  const [edit, setEdit] = useState<any>(null);
  const save = (v: Record<string, unknown>) => c.r.run(() => (edit?.id ? put(`/api/energy/generators/${edit.id}`, v) : post('/api/energy/generators', v))).then(x => { if (x) { setEdit(null); c.reload(); } });
  const list = gens?.generators || [];
  return <>
    <Section title="Generator sets" right={c.canEdit ? <button className={btnLight} onClick={() => setEdit({ active: true })}>Add generator</button> : null}>
      <Grid rows={list} empty="No generator yet." onRow={c.canEdit ? x => setEdit(x) : undefined} cols={[
        { key: 'code', title: 'Code' }, { key: 'name', title: 'Name' }, { key: 'warehouseName', title: 'Warehouse' }, { key: 'capacityKva', title: 'kVA', right: true },
        { key: 'ratedLitresPerHour', title: 'Rated l/h', right: true }, { key: 'active', title: 'Active', render: x => (x.active ? 'Yes' : 'No') },
      ]} />
      {edit && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm key={edit.id ?? 'new'} initial={edit} busy={c.r.busy} submitText="Save generator" onCancel={() => setEdit(null)} cols={4} onSubmit={save} fields={[
        { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: whOpts(c.warehouses) }, { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true },
        { name: 'capacityKva', label: 'Capacity (kVA)', type: 'number' }, { name: 'ratedLitresPerHour', label: 'Rated diesel (litres per hour)', type: 'number' }, { name: 'active', label: 'Active', type: 'checkbox' },
      ]} /></div>}
    </Section>
    <Section title="Run log">
      {c.canEdit && list.length > 0 && <div className="mb-3 rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Add run" cols={4}
        onSubmit={(v, f) => c.r.run(() => post('/api/energy/generator-logs', v)).then(x => { if (x) { f.reset(); c.reload(); } })} fields={[
          { name: 'generatorId', label: 'Generator', type: 'select', required: true, options: list.map((g: any) => [g.id, `${g.code} ${g.name}`]) },
          { name: 'runDate', label: 'Date', type: 'date', required: true },
          { name: 'reason', label: 'Reason', type: 'select', required: true, options: [['POWER_CUT', 'Power cut'], ['TEST_RUN', 'Test run'], ['MAINTENANCE', 'Maintenance'], ['PEAK_LOAD', 'Peak load'], ['OTHER', 'Other']] },
          { name: 'hourMeterStart', label: 'Hour meter at start', type: 'number' }, { name: 'hourMeterEnd', label: 'Hour meter at end', type: 'number' },
          { name: 'runHours', label: 'or run hours', type: 'number' }, { name: 'dieselLitres', label: 'Diesel (litres)', type: 'number', required: true },
          { name: 'kwhGenerated', label: 'Units made (kWh, if metered)', type: 'number' }, { name: 'note', label: 'Note', wide: true },
        ]} /></div>}
      <Grid rows={logs?.logs || []} empty="No run in the period." cols={[
        { key: 'runDate', title: 'Date', render: x => day(x.runDate) }, { key: 'generatorCode', title: 'Generator' }, { key: 'warehouseName', title: 'Warehouse' }, { key: 'reason', title: 'Reason' },
        { key: 'runHours', title: 'Hours', right: true, render: x => qty(x.runHours) }, { key: 'dieselLitres', title: 'Litres', right: true, render: x => qty(x.dieselLitres) },
        { key: 'lph', title: 'l / h', right: true, render: x => (Number(x.runHours) > 0 ? qty((Number(x.dieselLitres) / Number(x.runHours)).toFixed(2)) : '-') },
        { key: 'dieselFlag', title: 'Diesel use', render: x => x.dieselFlag ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${flagTone(x.dieselFlag)}`}>{x.dieselFlag}</span> : '-' },
        { key: 'enteredByName', title: 'By' },
        { key: 'd', title: '', render: x => c.canEdit ? <button className={btnLight} onClick={() => { if (window.confirm('Delete this run?')) c.r.run(() => api(`/api/energy/generator-logs/${x.id}`, { method: 'DELETE' })).then(o => o && c.reload()); }}>Delete</button> : null },
      ]} />
      <p className="mt-2 text-xs text-slate-500">HIGH or LOW: the litres per hour are more than 25 % above or below the rated use. Check for leaks, theft or a wrong entry.</p>
    </Section>
  </>;
}

function SolarGrid({ c }: { c: Ctx }) {
  const solar = useGet(`/api/energy/solar?from=${c.from}&to=${c.to}`, c.n, c.r);
  const bills = useGet('/api/energy/grid-bills', c.n, c.r);
  const s = solar?.logs || [];
  const total = s.reduce((a: number, x: any) => a + Number(x.kwhProduced || 0), 0);
  return <>
    <Section title={<>Solar units <span className="text-base font-normal text-slate-600">{qty(total.toFixed(2))} kWh in the period</span></>}>
      {c.canEdit && <div className="mb-3 rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Save day" cols={4}
        onSubmit={(v, f) => c.r.run(() => post('/api/energy/solar', v)).then(x => { if (x) { f.reset(); c.reload(); } })} fields={[
          { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: whOpts(c.warehouses) }, { name: 'logDate', label: 'Date', type: 'date', required: true },
          { name: 'kwhProduced', label: 'Units produced (kWh)', type: 'number', required: true }, { name: 'note', label: 'Note' },
        ]} /><p className="mt-1 text-xs text-slate-500">One figure per warehouse and day; typing the same day again replaces it.</p></div>}
      <Grid rows={s} empty="No solar figure in the period." cols={[
        { key: 'logDate', title: 'Date', render: x => day(x.logDate) }, { key: 'warehouseName', title: 'Warehouse' }, { key: 'kwhProduced', title: 'kWh', right: true, render: x => qty(x.kwhProduced) },
        { key: 'note', title: 'Note' }, { key: 'enteredByName', title: 'By' },
      ]} />
    </Section>
    <Section title="Electricity bills (grid)">
      {c.canEdit && <div className="mb-3 rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Save bill" cols={4}
        onSubmit={(v, f) => c.r.run(() => post('/api/energy/grid-bills', v)).then(x => { if (x) { f.reset(); c.reload(); } })} fields={[
          { name: 'warehouseId', label: 'Warehouse', type: 'select', required: true, options: whOpts(c.warehouses) }, { name: 'billMonth', label: 'Month (any day of it)', type: 'date', required: true },
          { name: 'kwh', label: 'Units billed (kWh)', type: 'number', required: true }, { name: 'amount', label: 'Amount (Rs)', type: 'number' }, { name: 'billNo', label: 'Bill no.' }, { name: 'note', label: 'Note' },
        ]} /><p className="mt-1 text-xs text-slate-500">Without a bill, the grid units are the chamber energy less solar and generator units.</p></div>}
      <Grid rows={bills?.bills || []} empty="No bill yet." cols={[
        { key: 'billMonth', title: 'Month', render: x => String(x.billMonth || '').slice(0, 7) }, { key: 'warehouseName', title: 'Warehouse' }, { key: 'kwh', title: 'kWh', right: true, render: x => qty(x.kwh) },
        { key: 'amount', title: 'Amount', right: true, render: x => (x.amount == null ? '' : qty(x.amount)) }, { key: 'billNo', title: 'Bill no.' },
      ]} />
    </Section>
  </>;
}

function Carbon({ c }: { c: Ctx }) {
  const d = useGet(`/api/energy/carbon?from=${c.from}&to=${c.to}`, c.n, c.r);
  if (!d) return null;
  const t = d.totals || {};
  const m = d.byMonth || [];
  return <>
    <Section title={<>Carbon {co2Text(t.kgCo2)}</>}>
      <Info items={[['Trips', `${t.trips ?? 0} trips, ${qty(t.km)} km`], ['Trip diesel', `${qty(t.tripLitres)} l (${t.estimatedTrips ?? 0} estimated)`], ['Trips CO2', co2Text(t.tripsKgCo2)],
        ['Warehouses CO2', co2Text(t.warehouseKgCo2)], ['Pallet-days', qty(t.palletDays)], ...(c.partner ? [] : [['Grid', `${qty(t.gridKwh)} kWh`], ['Generator diesel', `${qty(t.generatorLitres)} l`], ['Solar', `${qty(t.solarKwh)} kWh`]] as [string, string][]),
        ['Factors', `diesel ${d.factors?.dieselKgCo2PerLitre} kg/l, grid ${d.factors?.gridKgCo2PerKwh} kg/kWh`]]} />
      <details className="mt-3"><summary className="cursor-pointer text-sm font-semibold text-sky-800">How it is worked out</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm text-slate-700">{(d.steps || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol></details>
    </Section>
    {m.length > 0 && <div className="mt-5"><StackedBar title="kg CO2 per month" labels={m.map((x: any) => x.month)} unit=" kg"
      series={[{ name: 'Trips', values: m.map((x: any) => Number(x.tripsKgCo2)) }, { name: 'Warehouses', values: m.map((x: any) => Number(x.warehouseKgCo2)) }]} /></div>}
    {!c.partner && <Section title="Per customer"><Grid rows={d.byCustomer || []} empty="No customer in the period." cols={[
      { key: 'partnerName', title: 'Customer' }, { key: 'trips', title: 'Trips', right: true }, { key: 'tripsKgCo2', title: 'Trips kg', right: true, render: x => qty(x.tripsKgCo2) },
      { key: 'warehouseKgCo2', title: 'Warehouse kg', right: true, render: x => qty(x.warehouseKgCo2) }, { key: 'kgCo2', title: 'Total kg', right: true, render: x => <b>{qty(x.kgCo2)}</b> },
    ]} /></Section>}
    <Section title="Per trip"><Grid rows={d.byTrip || []} empty="No trip in the period." cols={[
      { key: 'tripNumber', title: 'Trip' }, { key: 'day', title: 'Date', render: x => day(x.day) }, ...(c.partner ? [] : [{ key: 'partnerName', title: 'Customer' }]),
      { key: 'lane', title: 'From - to', render: x => `${x.from ?? ''} - ${x.to ?? ''}` }, { key: 'km', title: 'km', right: true, render: x => qty(x.km) },
      { key: 'litres', title: 'Diesel l', right: true, render: x => <>{qty(x.litres)}{x.estimated ? <span className="text-xs text-amber-700"> est.</span> : null}</> },
      { key: 'kgCo2', title: 'kg CO2', right: true, render: x => qty(x.kgCo2) },
    ]} /></Section>
    <Section title="Per warehouse"><Grid rows={d.byWarehouse || []} empty="No warehouse energy in the period." cols={[
      { key: 'warehouseName', title: 'Warehouse' }, { key: 'palletDays', title: 'Pallet-days', right: true, render: x => qty(x.palletDays) },
      ...(c.partner ? [] : [{ key: 'chamberKwh', title: 'Chamber kWh', right: true, render: (x: any) => qty(x.chamberKwh) }, { key: 'gridKwh', title: 'Grid kWh', right: true, render: (x: any) => qty(x.gridKwh) },
        { key: 'solarKwh', title: 'Solar kWh', right: true, render: (x: any) => qty(x.solarKwh) }, { key: 'generatorLitres', title: 'DG litres', right: true, render: (x: any) => qty(x.generatorLitres) }]),
      { key: 'kgCo2', title: 'kg CO2', right: true, render: x => qty(x.kgCo2) },
    ]} /></Section>
  </>;
}

function Reports({ c }: { c: Ctx }) {
  const list = useGet('/api/energy/reports', c.n, c.r);
  const who = useGet(c.partner ? null : '/api/energy/report-partners', c.n, c.r);
  const [partners, setPartners] = useState<any[]>([]);
  const [month, setMonth] = useState(lastMonthStart());
  const [view, setView] = useState<any>(null);
  useEffect(() => { if (!c.partner && c.canEdit) api('/api/web-requests/partners').catch(() => null).then(x => setPartners(x?.partners || [])); }, []);
  return <>
    {!c.partner && <Section title="Customers who get a monthly report">
      {c.canEdit && <div className="mb-3 rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Add to the list" cols={3}
        onSubmit={(v, f) => c.r.run(() => post('/api/energy/report-partners', { ...v, active: true })).then(x => { if (x) { f.reset(); c.reload(); } })} fields={[
          partners.length ? { name: 'partnerId', label: 'Customer', type: 'select', required: true, options: partners.map((p: any) => [p.id, p.name]) } : { name: 'partnerId', label: 'Customer (partner id)', type: 'number', required: true },
          { name: 'email', label: 'Email for the report' },
        ]} /></div>}
      <Grid rows={who?.partners || []} empty="Nobody on the list yet." cols={[
        { key: 'partnerName', title: 'Customer' }, { key: 'email', title: 'Email' }, { key: 'active', title: 'Active', render: x => (x.active ? 'Yes' : 'No') },
        { key: 'a', title: '', render: x => c.canEdit ? <button className={btnLight} onClick={() => c.r.run(() => post('/api/energy/report-partners', { partnerId: x.partnerId, email: x.email, active: !x.active })).then(o => o && c.reload())}>{x.active ? 'Stop' : 'Start'}</button> : null },
      ]} />
      {c.canEdit && <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-sm"><span className={label}>Month</span><input className={input} type="month" value={month.slice(0, 7)} onChange={e => setMonth(`${e.target.value}-01`)} /></label>
        <button className={btn} disabled={c.r.busy} onClick={() => c.r.run(() => post('/api/energy/reports/generate', { month })).then(x => { if (x) { c.r.setMsg(`Made ${x.reports?.length ?? 0} report(s) for ${String(x.month).slice(0, 7)}.`); c.reload(); } })}>Make the reports of the month</button>
      </div>}
    </Section>}
    <Section title={c.partner ? 'My monthly reports' : 'Reports made'}>
      <Grid rows={list?.reports || []} empty="No report yet." onRow={x => c.r.run(() => api(`/api/energy/reports/${x.id}`)).then(v => v && setView(v))} selected={view?.id} cols={[
        { key: 'reportMonth', title: 'Month', render: x => String(x.reportMonth || '').slice(0, 7) }, ...(c.partner ? [] : [{ key: 'partnerName', title: 'Customer' }]),
        { key: 'totalKgCo2', title: 'CO2', right: true, render: x => co2Text(x.totalKgCo2) }, { key: 'generatedAt', title: 'Made', render: x => day(x.generatedAt) },
      ]} />
    </Section>
    {view && <Section title={`Carbon report ${String(view.reportMonth).slice(0, 7)} - ${view.partnerName ?? ''}`} right={<button className={btnLight} onClick={() => window.print()}>Print</button>}>
      <Info items={[['Total', co2Text(view.figures?.totals?.kgCo2)], ['Trips', `${view.figures?.totals?.trips ?? 0} (${co2Text(view.figures?.totals?.tripsKgCo2)})`],
        ['Warehouses', co2Text(view.figures?.totals?.warehouseKgCo2)], ['Pallet-days', qty(view.figures?.totals?.palletDays)], ['Made by', view.generatedByName], ['Made on', day(view.generatedAt)]]} />
      <ol className="mt-3 list-decimal space-y-1 pl-6 text-sm text-slate-700">{(view.figures?.steps || []).map((s: string, i: number) => <li key={i}>{s}</li>)}</ol>
      <div className="mt-3"><Grid rows={view.figures?.byTrip || []} empty="No trip that month." cols={[
        { key: 'tripNumber', title: 'Trip' }, { key: 'day', title: 'Date', render: x => day(x.day) }, { key: 'lane', title: 'From - to', render: x => `${x.from ?? ''} - ${x.to ?? ''}` },
        { key: 'km', title: 'km', right: true, render: x => qty(x.km) }, { key: 'kgCo2', title: 'kg CO2', right: true, render: x => qty(x.kgCo2) },
      ]} /></div>
    </Section>}
  </>;
}
