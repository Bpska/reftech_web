/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-004 -- Trip and vehicle profitability. Manager and Admin.
//
// Income of a trip = the approved bill amount before GST for that trip (notes and monthly vehicle bills shared over
// the trips). Cost = expenses entered against the trip plus the hired truck's freight. A vehicle adds its expenses
// not tied to a trip. Trips count by completion date (planned start while not completed); cancelled trips are left out.
//
// Backend: ProfitabilityController (/api/billing/profitability/**). Tab in ?tab=.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, errorText, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const BASE = '/api/billing/profitability';
const TABS: [string, string][] = [['trips', 'Trips'], ['vehicles', 'Vehicles']];
const sel = 'rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm';
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = () => `${today().slice(0, 8)}01`;
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const rs = (v: unknown) => fmtMoney(v as any);
const pct = (v: unknown) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })} %`);
const km = (v: unknown) => (v === null || v === undefined || num(v) === 0 ? '-' : Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 }));
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '-');
/** HIRED_FREIGHT -> Hired Freight */
const title = (s: string) => s.toLowerCase().split('_').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
const red = (v: unknown) => (num(v) < 0 ? 'text-red-700' : '');

export default function ProfitabilityPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'trips';
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [vehicleId, setVehicleId] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [vehicles, setVehicles] = useState<any[] | null>(null);   // null = the list could not be read: the filter is hidden
  const [partners, setPartners] = useState<any[] | null>(null);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/admin/vehicles').then(r => setVehicles(Array.isArray(r) ? r : null)).catch(() => setVehicles(null));
    api('/api/admin/partners').then(r => setPartners(Array.isArray(r) ? r : null)).catch(() => setPartners(null));
  }, []);

  // trips take the vehicle and partner filters; vehicles only the period
  const query = () => {
    const q = new URLSearchParams(); if (from) q.set('from', from); if (to) q.set('to', to);
    if (tab === 'trips') { if (vehicleId) q.set('vehicleId', vehicleId); if (partnerId) q.set('partnerId', partnerId); }
    return q;
  };
  useEffect(() => {
    let live = true;
    setBusy(true); setError(''); setData(null);
    api(`${BASE}/${tab}?${query()}`).then(r => { if (live) setData(r); }).catch(x => { if (live) setError(errorText(x, 'Could not load the profitability')); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [tab, from, to, vehicleId, partnerId]);

  async function download() {
    setError('');
    try { await apiDownload(`${BASE}/export.xlsx?${query()}`, `Profitability_${from}_to_${to}.xlsx`); }
    catch (x) { setError(errorText(x, 'Could not download the Excel file')); }
  }

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><TrendingUp className="h-8 w-8 text-sky-700" />Profitability</h1>
    <p className="text-slate-600">Income, costs and profit of each trip and each vehicle in a period.</p>
    <div className="mt-3 flex flex-wrap gap-2">{TABS.map(([k, l]) => <button key={k} onClick={() => setParams({ tab: k })} className={k === tab ? btn : btnLight}>{l}</button>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      From <input type="date" value={from} onChange={x => setFrom(x.target.value)} className={sel} /> to <input type="date" value={to} onChange={x => setTo(x.target.value)} className={sel} />
      {tab === 'trips' && vehicles && <select value={vehicleId} onChange={x => setVehicleId(x.target.value)} className={sel}><option value="">All vehicles</option>
        {vehicles.map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}</select>}
      {tab === 'trips' && partners && <select value={partnerId} onChange={x => setPartnerId(x.target.value)} className={sel}><option value="">All partners</option>
        {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      <button onClick={() => void download()} className={btnLight}>Download Excel</button>
      {busy && <span className="text-slate-500">Loading ...</span>}
    </div>
    <Banner error={error} />
    {data && tab === 'trips' && <Trips data={data} />}
    {data && tab === 'vehicles' && <Vehicles data={data} />}
  </>;
}

function Card({ l, v, cls }: { l: string; v: string; cls?: string }) {
  return <div className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs text-slate-500">{l}</div><div className={`text-lg font-bold ${cls || ''}`}>{v}</div></div>;
}

const Note = () => <p className="mt-2 text-xs text-slate-500">Income = approved bill amount before GST (credit / debit notes and monthly vehicle bills shared over the trips); costs = expenses entered against the trip plus hired truck freight (the transporter's bill, else the agreed freight).</p>;

function Trips({ data }: { data: any }) {
  const t = data.totals || {}, rows: any[] = data.trips || [], types: string[] = data.costTypes || [];
  return <>
    <div className="mt-3 grid gap-2 sm:grid-cols-4 lg:grid-cols-7">
      <Card l="Income" v={rs(t.income)} /><Card l="Cost" v={rs(t.cost)} /><Card l="Profit" v={rs(t.profit)} cls={red(t.profit)} /><Card l="Margin" v={pct(t.marginPct)} cls={red(t.marginPct)} />
      <Card l="Trips" v={String(num(t.trips))} /><Card l="Not billed yet" v={String(num(t.unbilledTrips))} cls={num(t.unbilledTrips) ? 'text-amber-700' : ''} />
      <Card l="Trips at a loss" v={String(num(t.lossTrips))} cls={num(t.lossTrips) ? 'text-red-700' : ''} />
    </div>
    <Section title={`Trips ${day(data.from)} to ${day(data.to)}`}>
      {data.truncated && <div className="mb-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">Only the first {rows.length} trips are shown. Pick a shorter period.</div>}
      {data.expensesByTrip === false && <div className="mb-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">Expenses are not yet linked to trips on this server, so trip costs show hired freight only.</div>}
      <div className="max-h-[40rem] overflow-auto"><table className="w-full min-w-[1200px] text-sm">
        <thead className="sticky top-0"><tr className="bg-slate-50 text-slate-600"><th className={th}>Trip</th><th className={th}>Date</th><th className={th}>Vehicle</th><th className={th}>Partner</th><th className={th}>Route</th>
          <th className={`${th} text-right`}>Km</th><th className={`${th} text-right`}>Income</th>{types.map(c => <th key={c} className={`${th} text-right`}>{title(c)}</th>)}
          <th className={`${th} text-right`}>Total cost</th><th className={`${th} text-right`}>Profit</th><th className={`${th} text-right`}>Margin</th><th className={th}>Billed</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.tripId} className="border-t">
          <td className={`${td} font-mono font-semibold`}>{r.tripNumber}</td><td className={td}>{day(r.date)}</td><td className={td}>{r.vehicleNumber || '-'}</td><td className={td}>{r.partnerName || '-'}</td>
          <td className={td}>{r.from || '-'} → {r.to || '-'}</td><td className={`${td} text-right`}>{km(r.km)}</td><td className={`${td} text-right`}>{num(r.income) ? rs(r.income) : '-'}</td>
          {types.map(c => <td key={c} className={`${td} text-right`}>{num(r.costs?.[c]) ? rs(r.costs[c]) : '-'}</td>)}
          <td className={`${td} text-right`}>{rs(r.totalCost)}</td><td className={`${td} text-right font-bold ${red(r.profit)}`}>{rs(r.profit)}</td>
          <td className={`${td} text-right ${red(r.marginPct)}`}>{pct(r.marginPct)}</td>
          <td className={td}>{r.billed ? 'Yes' : <span className="font-semibold text-amber-700">No</span>}</td></tr>)}
          {rows.length > 0 && <tr className="border-t-2 bg-slate-50 font-bold"><td className={td} colSpan={5}>Total</td><td className={`${td} text-right`}>{km(t.km)}</td>
            <td className={`${td} text-right`}>{rs(t.income)}</td>{types.map(c => <td key={c} className={`${td} text-right`}>{rs(rows.reduce((s, r) => s + num(r.costs?.[c]), 0))}</td>)}
            <td className={`${td} text-right`}>{rs(t.cost)}</td><td className={`${td} text-right ${red(t.profit)}`}>{rs(t.profit)}</td><td className={`${td} text-right`}>{pct(t.marginPct)}</td><td className={td}></td></tr>}
          {rows.length === 0 && <tr><td colSpan={11 + types.length} className={`${td} text-slate-500`}>No trips in this period.</td></tr>}</tbody></table></div>
      <Note />
    </Section>
  </>;
}

function Vehicles({ data }: { data: any }) {
  const t = data.totals || {}, rows: any[] = data.vehicles || [];
  const margin = num(t.income) ? (num(t.profit) * 100) / num(t.income) : null;
  return <>
    <div className="mt-3 grid gap-2 sm:grid-cols-5">
      <Card l="Income" v={rs(t.income)} /><Card l="Cost" v={rs(t.cost)} /><Card l="Profit" v={rs(t.profit)} cls={red(t.profit)} /><Card l="Margin" v={pct(margin)} cls={red(margin)} />
      <Card l="Vehicles" v={String(num(t.vehicles))} />
    </div>
    <Section title={`Vehicles ${day(data.from)} to ${day(data.to)}`}>
      <p className="mb-2 text-sm text-slate-600">Worst profit first. A vehicle also carries its expenses not tied to a trip (insurance, EMI, repairs) and monthly bills with no trip in their period.</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Vehicle</th><th className={`${th} text-right`}>Trips</th><th className={`${th} text-right`}>Km</th>
          <th className={`${th} text-right`}>Income</th><th className={`${th} text-right`}>Cost</th><th className={`${th} text-right`}>Profit</th><th className={`${th} text-right`}>Margin</th>
          <th className={`${th} text-right`}>Income / km</th><th className={`${th} text-right`}>Cost / km</th></tr></thead>
        <tbody>{rows.map(r => <tr key={r.vehicleId} className="border-t">
          <td className={`${td} font-semibold`}>{r.vehicleNumber || `#${r.vehicleId}`}{r.hired && <span className="ml-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-800">Hired</span>}
            {(num(r.otherCost) > 0 || num(r.otherIncome) > 0) && <div className="text-xs font-normal text-slate-500">{num(r.otherIncome) > 0 ? `monthly bill ${rs(r.otherIncome)} ` : ''}{num(r.otherCost) > 0 ? `other costs ${rs(r.otherCost)}` : ''}</div>}</td>
          <td className={`${td} text-right`}>{r.trips}</td><td className={`${td} text-right`}>{km(r.km)}</td><td className={`${td} text-right`}>{rs(r.income)}</td><td className={`${td} text-right`}>{rs(r.cost)}</td>
          <td className={`${td} text-right font-bold ${red(r.profit)}`}>{rs(r.profit)}</td><td className={`${td} text-right ${red(r.marginPct)}`}>{pct(r.marginPct)}</td>
          <td className={`${td} text-right`}>{rs(r.incomePerKm)}</td><td className={`${td} text-right`}>{rs(r.costPerKm)}</td></tr>)}
          {rows.length > 0 && <tr className="border-t-2 bg-slate-50 font-bold"><td className={td}>Total</td><td className={`${td} text-right`}>{rows.reduce((s, r) => s + num(r.trips), 0)}</td>
            <td className={`${td} text-right`}>{km(rows.reduce((s, r) => s + num(r.km), 0))}</td><td className={`${td} text-right`}>{rs(t.income)}</td><td className={`${td} text-right`}>{rs(t.cost)}</td>
            <td className={`${td} text-right ${red(t.profit)}`}>{rs(t.profit)}</td><td className={`${td} text-right`}>{pct(margin)}</td><td className={td}></td><td className={td}></td></tr>}
          {rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No vehicles with trips or costs in this period.</td></tr>}</tbody></table></div>
      <Note />
    </Section>
  </>;
}
