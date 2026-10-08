/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-002 -- Rate contracts by lane: what RefTech pays a transporter. A contract has validity dates and
// price lines (From -> To, truck type and size, temperature class, per trip / ton / km, minimum charge,
// detention, loading and unloading) plus extra charges. Draft -> Send for approval -> an Admin approves.
// Two approved contracts of one transporter may not price the same lane for overlapping dates. An approved
// contract is not edited: Copy makes the next one. The rate lookup lists the cheapest in-force rates.
//
// Backend: RateContractController (/api/transporters/contracts/**, /api/transporters/rates).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { IndianRupee } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, td, th } from '@/shared/components/FormKit';
import { CHARGE_BASES, RATE_BASES, SCRIPT, STATE_LABEL, VEHICLE_TYPES, day, role, rupees, tag } from './transporter';
import { fmtDistance, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type LaneRow = Record<string, string>;
type ChargeRow = { chargeName: string; basis: string; amount: string; laneIndex: string; notes: string };
const LANE_COLS: [string, string, string?][] = [
  ['originCity', 'From'], ['destinationCity', 'To'], ['vehicleType', 'Truck', 'select'], ['capacityTons', 'Tons', 'number'], ['temperatureProfileId', 'Temperature', 'profile'],
  ['rateBasis', 'Basis', 'basis'], ['rate', 'Rate ₹', 'number'], ['minCharge', 'Minimum ₹', 'number'], ['distanceKm', 'Km', 'number'], ['transitHours', 'Transit h', 'number'],
  ['detentionFreeHours', 'Free h', 'number'], ['detentionPerDay', 'Detention ₹/day', 'number'], ['loadingCharge', 'Loading ₹', 'number'], ['unloadingCharge', 'Unloading ₹', 'number'], ['extraDropCharge', 'Extra drop ₹', 'number'],
];
const emptyLane = (): LaneRow => ({ vehicleType: 'REEFER_TRUCK', rateBasis: 'PER_TRIP' });
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function RateContractsPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('id') || 0);
  const [transporterId, setTransporterId] = useState(params.get('transporter') || '');
  const [state, setState] = useState('');
  const [list, setList] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [editing, setEditing] = useState<'new' | 'edit' | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    const q = new URLSearchParams();
    if (transporterId) q.set('transporterId', transporterId);
    if (state) q.set('state', state);
    try { setList(await api(`/api/transporters/contracts?${q}`)); } catch (x) { setError(errorText(x, 'Could not load the contracts')); }
  }, [transporterId, state]);
  const loadOne = useCallback(async () => {
    if (!id) { setC(null); return; }
    try { setC(await api(`/api/transporters/contracts/${id}`)); } catch (x) { setError(errorText(x, 'Could not load the contract')); }
  }, [id]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) { void loadOne(); setEditing(null); } }, [loadOne]);
  useEffect(() => {
    if (!me.staff) return;
    api('/api/transporters').then(r => setTransporters(r.transporters || [])).catch(() => setTransporters([]));
    api('/api/temperature-profiles').then(p => setProfiles(Array.isArray(p) ? p : [])).catch(() => setProfiles([]));
  }, []);

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await action(); setMsg(r?.message || done); await loadList();
      if (r?.id && r.contractNo) { if (r.id !== id) setParams({ id: String(r.id) }); else setC(r); }
      return r ?? true;
    } catch (x) { setError(errorText(x, 'Could not save')); return null; }
    finally { setBusy(false); }
  }
  const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  const withReason = (path: string, text: string) => { const r = window.prompt(text); if (r !== null) void run(() => post(path, { reason: r }), 'Saved.'); };

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Rate Contracts</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const base = c ? `/api/transporters/contracts/${c.id}` : '';
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><IndianRupee className="h-8 w-8 text-sky-700" />Rate Contracts</h1>
    <p className="text-slate-600">What RefTech pays each transporter, lane by lane. <Link to="/transporters" className="font-semibold text-sky-700">Transporters</Link></p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT} />}
    {list?.ready && <>
      <RateLookup profiles={profiles} />
      {editing === 'new' && <Editor title="New rate contract" transporters={transporters.filter(t => t.onboardingStatus === 'APPROVED')} profiles={profiles} busy={busy}
        initial={{ transporterId, lanes: [], charges: [] }} onCancel={() => setEditing(null)}
        onSave={body => run(() => post('/api/transporters/contracts', body), 'Contract saved as a draft.').then(r => { if (r) setEditing(null); })} />}
      {c && editing === 'edit' && <Editor title={`Edit ${c.contractNo}`} transporters={transporters} profiles={profiles} busy={busy} initial={c} onCancel={() => setEditing(null)}
        onSave={body => run(() => api(base, { method: 'PUT', body: JSON.stringify(body) }), 'Saved.').then(r => { if (r) setEditing(null); })} />}
      {c && editing !== 'edit' && <Section id="contract" title={<>{c.contractNo} <span className={tag(c.state)}>{STATE_LABEL[c.state] || c.state}</span></>} right={<div className="flex flex-wrap gap-2">
        {me.manager && ['DRAFT', 'REJECTED'].includes(c.status) && <><button onClick={() => setEditing('edit')} className={btnLight}>Edit</button>
          <button disabled={busy} onClick={() => void run(() => post(`${base}/submit`), 'Sent for approval.')} className={btn}>Send for approval</button></>}
        {me.admin && c.status === 'PENDING_APPROVAL' && <><button disabled={busy} onClick={() => void run(() => post(`${base}/approve`, {}), 'Approved.')} className={btn}>Approve</button>
          <button disabled={busy} onClick={() => withReason(`${base}/reject`, 'What must be corrected?')} className={btnRed}>Reject</button></>}
        {me.manager && <button disabled={busy} onClick={() => void run(() => post(`${base}/copy`, {}), 'Copied.')} className={btnLight}>Copy to new contract</button>}
        {me.manager && c.status !== 'CANCELLED' && (c.status !== 'APPROVED' || me.admin) && <button disabled={busy} onClick={() => withReason(`${base}/cancel`, 'Reason for cancelling:')} className={btnRed}>Cancel</button>}
        <button onClick={() => setParams({})} className={btnLight}>Close</button></div>}>
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div><b>{c.transporterName}</b> ({c.transporterCode}) <span className={tag(c.transporterStatus)}>{STATE_LABEL[c.transporterStatus] || c.transporterStatus}</span>
            <div>Valid {day(c.validFrom)} to {day(c.validTo)} · pay in {c.paymentTermsDays ?? '-'} days</div></div>
          <div>{c.fuelClause && <div>Fuel: {c.fuelClause}</div>}{c.notes && <div className="text-slate-600">{c.notes}</div>}</div>
          <div>Made by {c.createdByName}{c.submittedByName && <div>Sent by {c.submittedByName} on {day(c.submittedAt)}</div>}
            {c.decidedByName && <div>{c.status === 'REJECTED' ? 'Rejected' : c.status === 'CANCELLED' ? 'Cancelled' : 'Approved'} by {c.decidedByName} on {day(c.decidedAt)}{c.decisionNote ? `: ${c.decisionNote}` : ''}</div>}</div>
        </div>
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Lane</th><th className={th}>Truck</th><th className={th}>Temperature</th><th className={`${th} text-right`}>Rate</th>
            <th className={`${th} text-right`}>Minimum</th><th className={th}>Distance / transit</th><th className={th}>Detention</th><th className={th}>Loading / unloading / extra drop</th></tr></thead>
          <tbody>{c.lanes.map((l: any) => <tr key={l.id} className="border-t"><td className={`${td} font-semibold`}>{l.originCity} → {l.destinationCity}</td>
            <td className={td}>{l.vehicleType}{l.capacityTons ? ` · ${fmtWeight(l.capacityTons)}` : ''}</td><td className={td}>{l.temperatureProfileName || 'Any'}</td>
            <td className={`${td} text-right font-bold`}>{rupees(l.rate)} {RATE_BASES.find(b => b[0] === l.rateBasis)?.[1].toLowerCase()}</td><td className={`${td} text-right`}>{rupees(l.minCharge)}</td>
            <td className={td}>{l.distanceKm ? `${fmtDistance(l.distanceKm)}` : '-'}{l.transitHours ? ` · ${l.transitHours} h` : ''}</td>
            <td className={td}>{l.detentionPerDay ? `${rupees(l.detentionPerDay)}/day after ${l.detentionFreeHours ?? 24} h` : '-'}</td>
            <td className={td}>{[l.loadingCharge, l.unloadingCharge, l.extraDropCharge].map(rupees).join(' / ')}</td></tr>)}</tbody></table></div>
        {c.charges.length > 0 && <div className="mt-3 text-sm"><b>Extra charges</b><ul className="ml-5 list-disc">{c.charges.map((x: any) => {
          const lane = c.lanes.find((l: any) => l.id === x.laneId);
          return <li key={x.id}>{x.chargeName}: {x.basis === 'PERCENT' ? `${Number(x.amount)} %` : rupees(x.amount)} {CHARGE_BASES.find(b => b[0] === x.basis)?.[1].toLowerCase()}{lane ? ` (${lane.originCity} → ${lane.destinationCity})` : ' (all lanes)'}{x.notes ? ` · ${x.notes}` : ''}</li>;
        })}</ul></div>}
      </Section>}

      <Section title="Contracts" right={<div className="flex flex-wrap gap-2">
        <select value={transporterId} onChange={x => setTransporterId(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="">All transporters</option>
          {transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
        <select value={state} onChange={x => setState(x.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm"><option value="">All states</option>
          {['IN_FORCE', 'NOT_STARTED', 'PENDING_APPROVAL', 'DRAFT', 'REJECTED', 'EXPIRED', 'CANCELLED'].map(s => <option key={s} value={s}>{STATE_LABEL[s]}</option>)}</select>
        {me.manager && <button onClick={() => setEditing('new')} className={btn}>New contract</button>}</div>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Contract</th><th className={th}>Transporter</th><th className={th}>Valid</th><th className={th}>Lanes</th><th className={th}>State</th><th className={th}>Approved by</th></tr></thead>
          <tbody>{list.contracts.map((x: any) => <tr key={x.id} onClick={() => setParams({ id: String(x.id) })} className={`cursor-pointer border-t hover:bg-sky-50 ${x.id === id ? 'bg-sky-50' : ''}`}>
            <td className={`${td} font-mono font-bold text-sky-800`}>{x.contractNo}</td><td className={td}>{x.transporterName}</td><td className={td}>{day(x.validFrom)} to {day(x.validTo)}</td>
            <td className={td}>{x.lanes || '-'}</td><td className={td}><span className={tag(x.state)}>{STATE_LABEL[x.state] || x.state}</span></td><td className={td}>{x.decidedByName || '-'}</td></tr>)}
            {list.contracts.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No contracts.</td></tr>}</tbody></table></div>
      </Section>
    </>}
  </>;
}

function RateLookup({ profiles }: { profiles: any[] }) {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const fields: Field[] = [
    { name: 'originCity', label: 'From', required: true }, { name: 'destinationCity', label: 'To', required: true },
    { name: 'vehicleType', label: 'Truck', type: 'select', options: VEHICLE_TYPES }, { name: 'capacityTons', label: 'Truck size at least', type: 'number', unit: 'weight' },
    { name: 'temperatureProfileId', label: 'Temperature', type: 'select', options: profiles.map(p => [p.id, p.name]) },
    { name: 'loadTons', label: 'Load, for per-ton rates', type: 'number', unit: 'weight' }, { name: 'distanceKm', label: 'Distance, for per-km rates', type: 'number', unit: 'distance' },
    { name: 'date', label: 'On date', type: 'date' },
  ];
  async function look(v: Record<string, unknown>) {
    setError('');
    const q = new URLSearchParams(Object.entries(v).filter(([, x]) => x !== null && x !== '').map(([k, x]) => [k, String(x)]));
    try { setRows(await api(`/api/transporters/rates?${q}`)); } catch (x) { setError(errorText(x, 'Could not look up the rates')); setRows(null); }
  }
  return <Section title="Rate lookup">
    <QuickForm cols={4} fields={fields} submitText="Find rates" onSubmit={look} />
    <Banner error={error} />
    {rows && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th><th className={th}>Contract</th><th className={th}>Truck</th><th className={th}>Temperature</th>
        <th className={`${th} text-right`}>Rate</th><th className={`${th} text-right`}>Minimum</th><th className={`${th} text-right`}>Estimate per trip</th><th className={th}>Valid to</th></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.laneId} className={`border-t ${i === 0 ? 'bg-emerald-50' : ''}`}><td className={`${td} font-semibold`}>{r.transporterName}</td>
        <td className={td}><Link to={`/transporters/contracts?id=${r.contractId}`} className="font-mono text-sky-700">{r.contractNo}</Link></td>
        <td className={td}>{r.vehicleType}{r.capacityTons ? ` · ${fmtWeight(r.capacityTons)}` : ''}</td><td className={td}>{r.temperatureProfileName || 'Any'}</td>
        <td className={`${td} text-right`}>{rupees(r.rate)} {RATE_BASES.find(b => b[0] === r.rateBasis)?.[1].toLowerCase()}</td><td className={`${td} text-right`}>{rupees(r.minCharge)}</td>
        <td className={`${td} text-right font-bold`}>{r.estimate == null ? 'give load / km' : rupees(r.estimate)}</td><td className={td}>{day(r.validTo)}</td></tr>)}
        {rows.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No approved rate in force for this lane.</td></tr>}</tbody></table>
      <div className="mt-1 text-xs text-slate-500">The estimate includes the minimum charge, loading and unloading; detention and extra charges come on top.</div></div>}
  </Section>;
}

function Editor({ title, transporters, profiles, initial, busy, onSave, onCancel }: {
  title: string; transporters: any[]; profiles: any[]; initial: any; busy: boolean; onSave: (body: any) => void; onCancel: () => void;
}) {
  const [head, setHead] = useState<Record<string, string>>({
    transporterId: str(initial.transporterId), validFrom: str(initial.validFrom), validTo: str(initial.validTo), paymentTermsDays: str(initial.paymentTermsDays ?? 30),
    fuelClause: str(initial.fuelClause), notes: str(initial.notes),
  });
  const [lanes, setLanes] = useState<LaneRow[]>(initial.lanes?.length ? initial.lanes.map((l: any) => Object.fromEntries(LANE_COLS.map(([k]) => [k, str(l[k])]))) : [emptyLane()]);
  const [charges, setCharges] = useState<ChargeRow[]>((initial.charges || []).map((x: any) => ({
    chargeName: str(x.chargeName), basis: str(x.basis), amount: str(x.amount), notes: str(x.notes),
    laneIndex: x.laneId ? String((initial.lanes || []).findIndex((l: any) => l.id === x.laneId)) : '',
  })));
  const setLane = (i: number, k: string, v: string) => setLanes(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l));
  const setCharge = (i: number, k: keyof ChargeRow, v: string) => setCharges(cs => cs.map((x, j) => j === i ? { ...x, [k]: v } : x));
  const cellInput = 'w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm';
  function save() {
    onSave({ ...head, lanes, charges: charges.filter(x => x.chargeName.trim()).map(x => ({ ...x, laneIndex: x.laneIndex === '' ? null : Number(x.laneIndex) })) });
  }
  return <Section title={title}>
    <div className="grid gap-3 md:grid-cols-3">
      {initial.id ? <div><div className="text-sm font-semibold text-slate-700">Transporter</div><div className="py-2">{initial.transporterName}</div></div>
        : <div><label className="mb-1 block text-sm font-semibold text-slate-700">Transporter (approved) *</label>
          <select value={head.transporterId} onChange={x => setHead(h => ({ ...h, transporterId: x.target.value }))} className={input}><option value="">Choose</option>
            {transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>}
      {([['validFrom', 'Valid from', 'date'], ['validTo', 'Valid to', 'date'], ['paymentTermsDays', 'Payment terms (days)', 'number'], ['fuelClause', 'Fuel clause', 'text'], ['notes', 'Notes', 'text']] as const).map(([k, l, type]) =>
        <div key={k}><label className="mb-1 block text-sm font-semibold text-slate-700">{l}</label>
          <input type={type} value={head[k].slice(0, type === 'date' ? 10 : undefined)} onChange={x => setHead(h => ({ ...h, [k]: x.target.value }))} className={input} /></div>)}
    </div>
    <div className="mt-4 text-sm font-semibold">Price lines</div>
    <div className="mt-1 overflow-x-auto"><table className="w-full min-w-[1600px] text-sm">
      <thead><tr className="text-left text-slate-600"><th className="px-1">#</th>{LANE_COLS.map(([, l]) => <th key={l} className="px-1">{l}</th>)}<th></th></tr></thead>
      <tbody>{lanes.map((l, i) => <tr key={i}><td className="px-1">{i + 1}</td>{LANE_COLS.map(([k, , kind]) => <td key={k} className="px-1 py-0.5">
        {kind === 'select' ? <select value={l[k] || ''} onChange={x => setLane(i, k, x.target.value)} className={cellInput}>{VEHICLE_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          : kind === 'basis' ? <select value={l[k] || ''} onChange={x => setLane(i, k, x.target.value)} className={cellInput}>{RATE_BASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          : kind === 'profile' ? <select value={l[k] || ''} onChange={x => setLane(i, k, x.target.value)} className={cellInput}><option value="">Any</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          : <input type={kind === 'number' ? 'number' : 'text'} step="any" value={l[k] || ''} onChange={x => setLane(i, k, x.target.value)} className={cellInput} />}</td>)}
        <td className="px-1"><button type="button" onClick={() => setLanes(ls => ls.filter((_, j) => j !== i))} className={btnRed}>×</button></td></tr>)}</tbody></table></div>
    <button type="button" onClick={() => setLanes(ls => [...ls, emptyLane()])} className={`${btnLight} mt-1`}>Add price line</button>
    <div className="mt-4 text-sm font-semibold">Extra charges (optional)</div>
    {charges.map((x, i) => <div key={i} className="mt-1 grid gap-2 md:grid-cols-[2fr_1fr_1fr_2fr_2fr_auto]">
      <input value={x.chargeName} onChange={e => setCharge(i, 'chargeName', e.target.value)} placeholder="Charge, e.g. Toll" className={cellInput} />
      <select value={x.basis} onChange={e => setCharge(i, 'basis', e.target.value)} className={cellInput}>{CHARGE_BASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      <input type="number" step="any" value={x.amount} onChange={e => setCharge(i, 'amount', e.target.value)} placeholder="Amount" className={cellInput} />
      <select value={x.laneIndex} onChange={e => setCharge(i, 'laneIndex', e.target.value)} className={cellInput}><option value="">All lines</option>
        {lanes.map((l, j) => <option key={j} value={j}>Line {j + 1}: {l.originCity || '?'} → {l.destinationCity || '?'}</option>)}</select>
      <input value={x.notes} onChange={e => setCharge(i, 'notes', e.target.value)} placeholder="Notes" className={cellInput} />
      <button type="button" onClick={() => setCharges(cs => cs.filter((_, j) => j !== i))} className={btnRed}>×</button></div>)}
    <button type="button" onClick={() => setCharges(cs => [...cs, { chargeName: '', basis: 'PER_TRIP', amount: '', laneIndex: '', notes: '' }])} className={`${btnLight} mt-1`}>Add charge</button>
    <div className="mt-4 flex gap-2"><button disabled={busy} onClick={save} className={btn}>Save as draft</button><button onClick={onCancel} className={btnLight}>Cancel</button></div>
  </Section>;
}
