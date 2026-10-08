/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-006 -- Gate desk for security, made for a phone. Staff only.
//
// Out: scan the QR code of the gate pass (or type the pass number, a slot number or a truck number). The pass, trip,
// truck and validity are shown in green (may leave) or red (may not); the guard types the truck number seen at the
// gate and presses Let out. The time in the yard and any warning come back.
// In: choose the warehouse, pick a booked slot of today and type the truck number.
// Backend: GET /api/dispatch/gate/scan?code=, POST /api/dispatch/gate/out { code, vehicleNumber },
// POST /api/dispatch/gate/in { slotId, vehicleNumber }, GET /api/dispatch/docks/warehouses, GET /api/dispatch/docks?warehouseId=&day=.
import { ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, ScanBox, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { indiaDay, when } from '../dispatch';
import { SCRIPT64, SLOT_STYLE, SLOT_TEXT, hhmm, minutes, notReady, pickWarehouse, saveWarehouse } from './desk';

export function GateDeskPage() {
  const [tab, setTab] = useState<'OUT' | 'IN'>('OUT');
  const [missing, setMissing] = useState(false);
  return <div className="mx-auto max-w-3xl">
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck />Gate</h1>
    <p className="text-slate-600">Trucks in and out at the warehouse gate.</p>
    {missing ? <NotReady script={SCRIPT64} /> : <>
      <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-slate-300">
        {([['OUT', 'Truck out', LogOut], ['IN', 'Truck in', LogIn]] as const).map(([k, t, Icon]) =>
          <button key={k} onClick={() => setTab(k)} className={`flex items-center justify-center gap-2 py-3 text-lg font-bold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}><Icon className="h-5 w-5" />{t}</button>)}
      </div>
      {tab === 'OUT' ? <GateOut onMissing={() => setMissing(true)} /> : <GateIn onMissing={() => setMissing(true)} />}
    </>}
  </div>;
}

function GateOut({ onMissing }: { onMissing: () => void }) {
  const [code, setCode] = useState(''), [res, setRes] = useState<any>(null), [truck, setTruck] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<any>(null);

  async function scan(c: string) {
    setCode(c); setRes(null); setDone(null); setMsg(''); setErr(''); setTruck(''); setBusy(true);
    try { setRes(await api(`/api/dispatch/gate/scan?code=${encodeURIComponent(c)}`)); }
    catch (e) { const m = errorText(e, 'The code could not be checked'); if (notReady(m)) onMissing(); else setErr(m); }
    finally { setBusy(false); }
  }

  async function letOut() {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/dispatch/gate/out', { method: 'POST', body: JSON.stringify({ code, vehicleNumber: truck }) }); setDone(r); setRes(null); setCode(''); setTruck(''); }
    catch (e) { setErr(errorText(e, 'The truck may not leave')); }
    finally { setBusy(false); }
  }

  async function gateIn(slot: any) {
    const v = window.prompt(`Truck number at the gate (slot ${slot.slotNo}, planned ${slot.vehicleNumber || '-'}):`, '');
    if (v === null) return;
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/dispatch/gate/in', { method: 'POST', body: JSON.stringify({ slotId: slot.id, vehicleNumber: v.trim() }) }); setMsg(r.message || 'Truck in'); setRes(r); }
    catch (e) { setErr(errorText(e, 'Not recorded')); }
    finally { setBusy(false); }
  }

  const p = res?.gatePass, ok = res?.kind === 'GATE_PASS' && res.canExit;
  return <Section title="Scan the gate pass">
    <ScanBox placeholder="Scan QR or type pass / truck number, then Enter" onScan={c => void scan(c)} autoFocus disabled={busy} />
    <Banner msg={msg} error={err} />

    {done && <div className="mt-4 rounded-2xl border-4 border-emerald-500 bg-emerald-50 p-5 text-emerald-900">
      <div className="text-2xl font-black">TRUCK OUT</div>
      <div className="mt-1 text-lg">{done.message}</div>
      {done.yardMinutes != null && <div className="mt-2 text-lg">Time in the yard: <b>{minutes(done.yardMinutes)}</b></div>}
      {done.warning && <div className="mt-3 rounded-xl bg-amber-100 p-3 font-semibold text-amber-900">{done.warning}</div>}
    </div>}

    {res && res.kind !== 'GATE_PASS' && res.problem && <div className="mt-4 rounded-2xl border-4 border-red-500 bg-red-50 p-5 text-red-900">
      <div className="text-2xl font-black">NOT FOUND</div><div className="mt-1 text-lg">{res.problem}</div>
    </div>}

    {res?.kind === 'GATE_PASS' && p && <div className={`mt-4 rounded-2xl border-4 p-5 ${ok ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-red-500 bg-red-50 text-red-950'}`}>
      <div className="text-2xl font-black">{ok ? 'MAY LEAVE' : 'STOP: MAY NOT LEAVE'}</div>
      {res.problem && <div className="mt-1 text-lg font-semibold">{res.problem}</div>}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-base">
        <dt className="text-slate-600">Gate pass</dt><dd className="font-bold">{p.passNo}</dd>
        <dt className="text-slate-600">Truck</dt><dd className="font-mono text-2xl font-black">{p.vehicleNumber || '-'}</dd>
        <dt className="text-slate-600">Trip</dt><dd><Link to={`/dispatch/trips/${p.tripId}`} className="font-semibold underline">{p.tripNumber}</Link></dd>
        <dt className="text-slate-600">Driver</dt><dd>{p.driverName || '-'}</dd>
        <dt className="text-slate-600">Seal</dt><dd>{p.sealNumber || '-'}</dd>
        <dt className="text-slate-600">Valid until</dt><dd className="font-semibold">{when(p.validUntil)}</dd>
        {res.slot && <><dt className="text-slate-600">Dock / slot</dt><dd>{res.slot.dockCode} / {res.slot.slotNo} ({SLOT_TEXT[res.slot.status] || res.slot.status})</dd>
          <dt className="text-slate-600">In the yard</dt><dd>{minutes(res.slot.yardMinutes)}</dd></>}
      </dl>
      {ok && <div className="mt-4">
        <label className={label}>Truck number at the gate</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`${input} font-mono text-xl uppercase`} value={truck} onChange={e => setTruck(e.target.value)} placeholder={p.vehicleNumber || 'Truck number'} />
          <button disabled={busy || !truck.trim()} onClick={() => void letOut()} className={`${btn} bg-emerald-700 py-3 text-lg hover:bg-emerald-800`}>Let out</button>
        </div>
      </div>}
    </div>}

    {res?.kind === 'SLOT' && <div className="mt-4 space-y-2">
      <p className="text-sm text-slate-600">No gate pass matches; these slots of today match. A truck leaves only on its gate pass.</p>
      {(res.slots || []).map((s: any) => <SlotCard key={s.id} s={s} action={s.status === 'BOOKED' ? <button disabled={busy} className={btn} onClick={() => void gateIn(s)}>Truck in</button> : null} />)}
    </div>}
  </Section>;
}

function GateIn({ onMissing }: { onMissing: () => void }) {
  const [warehouses, setWarehouses] = useState<any[]>([]), [wh, setWh] = useState(''), [data, setData] = useState<any>(null);
  const [slotId, setSlotId] = useState(''), [truck, setTruck] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/api/dispatch/docks/warehouses').then(x => { const l = Array.isArray(x) ? x : []; setWarehouses(l); setWh(pickWarehouse(l)); })
      .catch(e => { const m = errorText(e, 'The warehouses could not be read'); if (notReady(m)) onMissing(); else setErr(m); });
  }, []);
  const load = () => wh ? api(`/api/dispatch/docks?warehouseId=${wh}&day=${indiaDay()}`).then(x => { if (notReady(x)) onMissing(); else setData(x); })
    .catch(e => setErr(errorText(e, 'The slots could not be read'))) : Promise.resolve();
  useEffect(() => { setSlotId(''); void load(); }, [wh]);

  const slots: any[] = (data?.docks || []).flatMap((d: any) => d.slots || []).sort((a: any, b: any) => String(a.slotStart).localeCompare(String(b.slotStart)));
  const booked = slots.filter(s => s.status === 'BOOKED'), inYard = slots.filter(s => ['IN_YARD', 'LOADING', 'LOADED'].includes(s.status));
  const chosen = booked.find(s => String(s.id) === slotId);

  async function submit() {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/dispatch/gate/in', { method: 'POST', body: JSON.stringify({ slotId: Number(slotId), vehicleNumber: truck }) }); setMsg(r.message || 'Truck in'); setSlotId(''); setTruck(''); await load(); }
    catch (e) { setErr(errorText(e, 'Not recorded')); }
    finally { setBusy(false); }
  }

  return <Section title="Truck in" right={<button className={btnLight} onClick={() => void load()}>Refresh</button>}>
    <label className={label}>Warehouse</label>
    <select className={input} value={wh} onChange={e => { setWh(e.target.value); saveWarehouse(e.target.value); }}>
      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}{w.city ? `, ${w.city}` : ''}</option>)}
    </select>
    <Banner msg={msg} error={err} />
    <div className="mt-3 text-sm font-semibold text-slate-700">Booked slots today ({booked.length})</div>
    {!booked.length && <p className="text-sm text-slate-500">No truck is expected today.</p>}
    <div className="mt-2 space-y-2">{booked.map(s => <button key={s.id} onClick={() => { setSlotId(String(s.id)); setTruck(''); }}
      className={`block w-full rounded-xl border-2 p-3 text-left ${String(s.id) === slotId ? 'border-sky-600 bg-sky-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-lg font-black">{s.vehicleNumber || 'no truck'}</span><span className="text-sm font-semibold">{hhmm(s.slotStart)}-{hhmm(s.slotEnd)}</span></div>
      <div className="text-sm text-slate-600">Dock {s.dockCode} · {s.tripNumber} · {s.partnerName || '-'}</div>
    </button>)}</div>
    {chosen && <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <label className={label}>Truck number at the gate</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={`${input} font-mono text-xl uppercase`} value={truck} onChange={e => setTruck(e.target.value)} placeholder={chosen.vehicleNumber || 'Truck number'} autoFocus />
        <button disabled={busy || !truck.trim()} onClick={() => void submit()} className={`${btn} py-3 text-lg`}>Truck in</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">If the number is not {chosen.vehicleNumber || 'the planned truck'}, the truck is refused: call dispatch.</p>
    </div>}
    {inYard.length > 0 && <>
      <div className="mt-5 text-sm font-semibold text-slate-700">In the yard now ({inYard.length})</div>
      <div className="mt-2 space-y-2">{inYard.map(s => <SlotCard key={s.id} s={s} />)}</div>
    </>}
  </Section>;
}

function SlotCard({ s, action }: { s: any; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
    <div>
      <div className="font-mono text-lg font-black">{s.vehicleNumber || '-'}</div>
      <div className="text-sm text-slate-600">Dock {s.dockCode} · {hhmm(s.slotStart)}-{hhmm(s.slotEnd)} · <Link to={`/dispatch/trips/${s.tripId}`} className="underline">{s.tripNumber}</Link></div>
      {s.yardMinutes != null && <div className="text-sm">In the yard {minutes(s.yardMinutes)}{Number(s.lateInMinutes) > 0 ? `, came ${s.lateInMinutes} min late` : ''}</div>}
    </div>
    <div className="flex items-center gap-2"><span className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${SLOT_STYLE[s.status] || ''}`}>{SLOT_TEXT[s.status] || s.status}</span>{action}</div>
  </div>;
}
