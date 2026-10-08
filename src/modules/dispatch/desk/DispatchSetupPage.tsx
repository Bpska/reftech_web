/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-003 to 009 settings, REQ-DSP-004 trucks, compartments and product rules -- Dispatch Setup. Staff see it;
// a Manager or Admin changes it.
//
// Settings: the company's own values (empty = the default of the server) for cost per km, speed, time at a stop,
// off-route distance, on-time grace, e-way bill limit, the start rules and the gate pass validity.
// Trucks: pallet positions and cost per km of each truck, and its compartments (code, pallets, tons, temperature, sensor).
// Product rules: two product kinds that never travel together, or only in different compartments.
// Backend: GET/PUT /api/dispatch/plan/settings, GET /api/dispatch/setup/vehicles, PUT /api/dispatch/setup/vehicles/{id},
// POST /api/dispatch/setup/vehicles/{id}/compartments, PUT /api/dispatch/setup/vehicles/{id}/compartments/{cid},
// GET/POST /api/dispatch/setup/product-rules, PUT /api/dispatch/setup/product-rules/{id}.
import { FormEvent, useEffect, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { plain, role } from '../dispatch';
import { SCRIPT64, notReady } from './desk';
import { fmtMoney, fmtTempRange, fmtWeight, toBaseFields, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const NUMBERS: [string, string, string, string][] = [
  ['costPerKm', 'cost_per_km', 'Cost per km (₹)', 'for a truck without its own cost'], ['averageSpeedKmph', 'average_speed_kmph', 'Average speed (km/h)', 'between two stops'],
  ['stopMinutes', 'stop_minutes', 'Time at a stop (min)', 'to load or unload'], ['offRouteKm', 'off_route_km', 'Off-route distance (km)', 'from the line of the trip'],
  ['onTimeGraceMinutes', 'on_time_grace_minutes', 'On-time grace (min)', 'after the end of the window'], ['ewayThreshold', 'eway_threshold', 'E-way bill limit (₹)', 'goods value that needs one'],
  ['gatePassValidHours', 'gate_pass_valid_hours', 'Gate pass valid (hours)', 'after it is issued'],
];
const SWITCHES: [string, string, string][] = [
  ['stockGate', 'stock_gate', 'Loading starts only when the stock is picked and staged'], ['documentsRequired', 'documents_required', 'Start Trip needs the consignment notes and e-way bills'],
  ['invoiceCopyRequired', 'invoice_copy_required', 'Start Trip needs a copy of each invoice or challan'], ['gatePassRequired', 'gate_pass_required', 'A trip with a dock slot needs its gate pass to start'],
];
const RULE_TEXT: Record<string, string> = { NEVER_TOGETHER: 'Never on the same truck', SEPARATE_COMPARTMENT: 'Only in different compartments' };
const yesNo = (v: unknown) => (v === true ? 'Yes' : v === false ? 'No' : '-');
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function DispatchSetupPage() {
  const manager = role().manager;
  const [missing, setMissing] = useState(false);
  const onMissing = (x: any) => { if (notReady(x)) { setMissing(true); return true; } return false; };
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Settings2 />Dispatch Setup</h1>
    <p className="text-slate-600">Planning settings, trucks and compartments, and product rules.{!manager && ' Only a Manager or Admin can change them.'}</p>
    {missing ? <NotReady script={SCRIPT64} /> : <>
      <SettingsSection manager={manager} onMissing={onMissing} />
      <TrucksSection manager={manager} onMissing={onMissing} />
      <RulesSection manager={manager} onMissing={onMissing} />
    </>}
  </>;
}

type Props = { manager: boolean; onMissing: (x: any) => boolean };

function useSaver(reload: (x: any) => void) {
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function save(path: string, method: string, body: any) {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(path, { method, body: JSON.stringify(body) }); reload(r); setMsg(r.message || 'Saved'); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; }
    finally { setBusy(false); }
  }
  return { msg, err, setErr, busy, save };
}

function SettingsSection({ manager, onMissing }: Props) {
  const [v, setV] = useState<any>(null), [f, setF] = useState<any>({});
  const fill = (x: any) => { setV(x); const own = x.own || {}; const o: any = {}; [...NUMBERS, ...SWITCHES].forEach(([k, col]) => { o[k] = str(own[col]); }); setF(o); };
  const s = useSaver(fill);
  useEffect(() => { api('/api/dispatch/plan/settings').then(x => { if (!onMissing(x)) fill(x); }).catch(e => s.setErr(errorText(e, 'The settings could not be read'))); }, []);
  function submit(e: FormEvent) {
    e.preventDefault();
    const body: any = {};
    NUMBERS.forEach(([k]) => { body[k] = f[k] === '' ? null : f[k]; });
    SWITCHES.forEach(([k]) => { body[k] = f[k] === '' ? null : f[k] === 'true'; });
    void s.save('/api/dispatch/plan/settings', 'PUT', body);
  }
  const cur = v?.current || {}, def = v?.defaults || {};
  return <Section title="Settings" right={<span className="text-sm text-slate-500">Empty = the default</span>}>
    <Banner msg={s.msg} error={s.err} />
    {v && <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {NUMBERS.map(([k, , t, hint]) => <div key={k}>
        <label className={label}>{t}</label>
        <input type="number" step="any" disabled={!manager} className={input} value={f[k] ?? ''} placeholder={plain(def[k])} onChange={e => setF({ ...f, [k]: e.target.value })} />
        <div className="mt-0.5 text-xs text-slate-500">{hint}. In force: <b>{plain(cur[k])}</b></div>
      </div>)}
      {SWITCHES.map(([k, , t]) => <div key={k} className="sm:col-span-2">
        <label className={label}>{t}</label>
        <select disabled={!manager} className={input} value={f[k] ?? ''} onChange={e => setF({ ...f, [k]: e.target.value })}>
          <option value="">Default ({yesNo(def[k])})</option><option value="true">Yes</option><option value="false">No</option>
        </select>
        <div className="mt-0.5 text-xs text-slate-500">In force: <b>{yesNo(cur[k])}</b></div>
      </div>)}
      {manager && <div className="sm:col-span-full"><button disabled={s.busy} className={btn}>Save settings</button>
        {v.own?.updated_by_name && <span className="ml-3 text-xs text-slate-500">Last saved by {v.own.updated_by_name}</span>}</div>}
    </form>}
  </Section>;
}

const EMPTY_COMP = { code: '', name: '', palletPositions: '', capacityTons: '', minTempC: '', maxTempC: '', sensorRef: '', sortOrder: '', active: true };

function TrucksSection({ manager, onMissing }: Props) {
  const [list, setList] = useState<any[]>([]), [q, setQ] = useState(''), [edit, setEdit] = useState<any>(null), [comp, setComp] = useState<any>(null);
  const s = useSaver(x => setList(x.vehicles || []));
  useEffect(() => { api('/api/dispatch/setup/vehicles').then(x => { if (!onMissing(x)) setList(x.vehicles || []); }).catch(e => s.setErr(errorText(e, 'The trucks could not be read'))); }, []);
  const shown = list.filter(v => !q || String(v.vehicleNumber).toLowerCase().includes(q.toLowerCase()));

  async function saveTruck(e: FormEvent) {
    e.preventDefault();
    if (await s.save(`/api/dispatch/setup/vehicles/${edit.id}`, 'PUT', { palletPositions: edit.palletPositions === '' ? null : edit.palletPositions, costPerKm: edit.costPerKm === '' ? null : edit.costPerKm })) setEdit(null);
  }
  async function saveComp(e: FormEvent) {
    e.preventDefault();
    const body: any = toBaseFields({ ...comp.f }, { capacityTons: 'weight', minTempC: 'temp', maxTempC: 'temp' }); // REQ-PLT-015: typed in the login's units
    ['palletPositions', 'capacityTons', 'minTempC', 'maxTempC', 'sortOrder'].forEach(k => { if (body[k] === '') body[k] = null; });
    const path = `/api/dispatch/setup/vehicles/${comp.vehicleId}/compartments${comp.id ? `/${comp.id}` : ''}`;
    if (await s.save(path, comp.id ? 'PUT' : 'POST', body)) setComp(null);
  }
  const cf = (k: string) => (e: { target: { value: string } }) => setComp({ ...comp, f: { ...comp.f, [k]: e.target.value } });

  return <Section title="Trucks and compartments" right={<input className={`${input} w-48`} placeholder="Find a truck" value={q} onChange={e => setQ(e.target.value)} />}>
    <Banner msg={s.msg} error={s.err} />
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
      <thead className="bg-slate-50 text-slate-600"><tr><th className={th}>Truck</th><th className={th}>Capacity</th><th className={th}>Temperature</th><th className={th}>Pallet positions</th><th className={th}>Cost per km</th><th className={th}>Compartments</th><th className={th}></th></tr></thead>
      <tbody>{shown.map(v => <tr key={v.id} className="border-t border-slate-100">
        <td className={td}><div className="font-semibold">{v.vehicleNumber}</div><div className="text-xs text-slate-500">{v.vehicleType} {v.status && v.status !== 'ACTIVE' ? `· ${v.status}` : ''}</div></td>
        <td className={td}>{fmtWeight(v.capacityTons)}{v.capacityM3 != null && `, ${plain(v.capacityM3)} m³`}</td>
        <td className={td}>{v.minTempC != null || v.maxTempC != null ? `${fmtTempRange(v.minTempC, v.maxTempC)}` : '-'}</td>
        {edit?.id === v.id ? <td className={td} colSpan={2}><form onSubmit={saveTruck} className="flex flex-wrap gap-2">
          <input type="number" min={0} max={100} className={`${input} w-24`} value={edit.palletPositions} onChange={e => setEdit({ ...edit, palletPositions: e.target.value })} placeholder="Pallets" />
          <input type="number" step="any" min={0} className={`${input} w-28`} value={edit.costPerKm} onChange={e => setEdit({ ...edit, costPerKm: e.target.value })} placeholder="₹ per km" />
          <button disabled={s.busy} className={btn}>Save</button><button type="button" className={btnLight} onClick={() => setEdit(null)}>Cancel</button>
        </form></td> : <><td className={td}>{v.palletPositions ?? '-'}</td><td className={td}>{v.costPerKm != null ? `${fmtMoney(v.costPerKm)}` : '-'}</td></>}
        <td className={td}>{(v.compartments || []).map((c: any) => <button key={c.id} disabled={!manager} onClick={() => setComp({ vehicleId: v.id, id: c.id, number: v.vehicleNumber, f: { ...EMPTY_COMP, ...Object.fromEntries(Object.keys(EMPTY_COMP).map(k => [k, k === 'active' ? c.active !== false : k === 'capacityTons' ? toShown('weight', c[k]) : k === 'minTempC' || k === 'maxTempC' ? toShown('temp', c[k]) : str(c[k])])) } })}
          title={`${c.name || ''} ${c.palletPositions ?? '-'} pallets, ${fmtWeight(c.capacityTons)}, ${fmtTempRange(c.minTempC, c.maxTempC)}${c.sensorRef ? `, sensor ${c.sensorRef}` : ''}`}
          className={`mb-1 mr-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${c.active === false ? 'border-slate-200 text-slate-400 line-through' : 'border-sky-300 bg-sky-50 text-sky-800'}`}>{c.code}</button>)}
          {!(v.compartments || []).length && <span className="text-slate-400">none</span>}</td>
        <td className={`${td} whitespace-nowrap`}>{manager && <div className="flex gap-1">
          <button className={btnLight} onClick={() => setEdit({ id: v.id, palletPositions: str(v.palletPositions), costPerKm: str(v.costPerKm) })}>Edit</button>
          <button className={btnLight} onClick={() => setComp({ vehicleId: v.id, number: v.vehicleNumber, f: { ...EMPTY_COMP, sortOrder: String((v.compartments || []).length + 1) } })}>+ Compartment</button>
        </div>}</td>
      </tr>)}</tbody>
    </table></div>
    {comp && <form onSubmit={saveComp} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-5">
      <div className="font-bold sm:col-span-full">{comp.id ? `Compartment ${comp.f.code} of ${comp.number}` : `New compartment for ${comp.number}`}</div>
      <div><label className={label}>Code *</label><input required maxLength={10} className={input} value={comp.f.code} onChange={cf('code')} placeholder="FRONT, C1" /></div>
      <div><label className={label}>Name</label><input className={input} value={comp.f.name} onChange={cf('name')} /></div>
      <div><label className={label}>Pallet positions</label><input type="number" min={0} max={100} className={input} value={comp.f.palletPositions} onChange={cf('palletPositions')} /></div>
      <div><label className={label}>Capacity ({unitNow('weight')})</label><input type="number" step="any" min={0} className={input} value={comp.f.capacityTons} onChange={cf('capacityTons')} /></div>
      <div><label className={label}>Order</label><input type="number" className={input} value={comp.f.sortOrder} onChange={cf('sortOrder')} /></div>
      <div><label className={label}>Lowest {unitNow('temp')}</label><input type="number" step="any" className={input} value={comp.f.minTempC} onChange={cf('minTempC')} /></div>
      <div><label className={label}>Highest {unitNow('temp')}</label><input type="number" step="any" className={input} value={comp.f.maxTempC} onChange={cf('maxTempC')} /></div>
      <div><label className={label}>Sensor</label><input className={input} value={comp.f.sensorRef} onChange={cf('sensorRef')} placeholder="sensor or probe id" /></div>
      {comp.id && <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4" checked={comp.f.active} onChange={e => setComp({ ...comp, f: { ...comp.f, active: e.target.checked } })} />In use</label>}
      <div className="flex items-end gap-2"><button disabled={s.busy} className={btn}>Save</button><button type="button" className={btnLight} onClick={() => setComp(null)}>Cancel</button></div>
    </form>}
  </Section>;
}

const EMPTY_RULE = { categoryA: '', categoryB: '', rule: 'NEVER_TOGETHER', note: '', active: true };

function RulesSection({ manager, onMissing }: Props) {
  const [data, setData] = useState<any>(null), [f, setF] = useState<any>(null);
  const s = useSaver(setData);
  useEffect(() => { api('/api/dispatch/setup/product-rules').then(x => { if (!onMissing(x)) setData(x); }).catch(e => s.setErr(errorText(e, 'The product rules could not be read'))); }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const { id, ...body } = f;
    if (await s.save(`/api/dispatch/setup/product-rules${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', body)) setF(null);
  }
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const rules: any[] = data?.rules || [];
  return <Section title="Product rules" right={manager && !f ? <button className={btnLight} onClick={() => setF({ ...EMPTY_RULE })}>+ Rule</button> : undefined}>
    <Banner msg={s.msg} error={s.err} />
    <datalist id="dsp-categories">{(data?.categories || []).map((c: string) => <option key={c} value={c} />)}</datalist>
    {f && <form onSubmit={submit} className="mb-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-5">
      <div><label className={label}>Product kind *</label><input required list="dsp-categories" className={input} value={f.categoryA} onChange={set('categoryA')} /></div>
      <div><label className={label}>and *</label><input required list="dsp-categories" className={input} value={f.categoryB} onChange={set('categoryB')} /></div>
      <div><label className={label}>Rule *</label><select className={input} value={f.rule} onChange={set('rule')}>{Object.entries(RULE_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></div>
      <div><label className={label}>Note</label><input className={input} value={f.note} onChange={set('note')} /></div>
      <div className="flex items-end gap-2">
        {f.id && <label className="mb-2 flex items-center gap-1 text-sm font-semibold"><input type="checkbox" checked={f.active} onChange={e => setF({ ...f, active: e.target.checked })} />In use</label>}
        <button disabled={s.busy} className={btn}>Save</button><button type="button" className={btnLight} onClick={() => setF(null)}>Cancel</button>
      </div>
    </form>}
    {!rules.length ? <p className="text-sm text-slate-500">No rule yet: any goods may travel together.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-slate-600"><tr><th className={th}>Product kinds</th><th className={th}>Rule</th><th className={th}>Note</th><th className={th}>Changed</th><th className={th}></th></tr></thead>
        <tbody>{rules.map(r => <tr key={r.id} className={`border-t border-slate-100 ${r.active === false ? 'text-slate-400' : ''}`}>
          <td className={`${td} font-semibold`}>{r.categoryA} + {r.categoryB}{r.active === false && <span className="ml-2 text-xs font-normal">(not in use)</span>}</td>
          <td className={td}><span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${r.rule === 'NEVER_TOGETHER' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{RULE_TEXT[r.rule] || r.rule}</span></td>
          <td className={td}>{r.note || '-'}</td>
          <td className={`${td} text-xs text-slate-500`}>{r.updatedBy || r.createdBy || '-'}</td>
          <td className={td}>{manager && <button className={btnLight} onClick={() => setF({ id: r.id, categoryA: r.categoryA, categoryB: r.categoryB, rule: r.rule, note: r.note || '', active: r.active !== false })}>Edit</button>}</td>
        </tr>)}</tbody>
      </table></div>}
  </Section>;
}
