/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-004, 005, 007, 009 -- one load request for dispatch. Staff only.
//
// Goods and consignee: pallets, product kind (checked against the product rules, REQ-DSP-004), description and value
// (the e-way bill limit, REQ-DSP-009), consignee name, address and GSTIN (the consignment note), and the warehouse
// order that holds its stock (REQ-DSP-005). A load on an approved trip needs a reason for the change.
// Trucks for this load (REQ-DSP-007): the suitable free trucks, cheapest first, the part-load trips that can take it
// on the way, and the trucks that cannot, with why.
// Backend: GET/PUT /api/dispatch/loads/{id}/details, GET /api/dispatch/loads/{id}/trucks,
// GET /api/dispatch/setup/product-rules (the product kinds in use).
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarRange, Package, Truck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { plain, when } from '../dispatch';
import { SCRIPT64, inr, notReady } from './desk';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const FIELDS = ['palletCount', 'productCategory', 'goodsDescription', 'goodsValue', 'consigneeName', 'consigneeAddress', 'consigneeGstin', 'outboundOrderId'];
const CLOSED = ['DELIVERED', 'CANCELLED', 'DECLINED', 'REJECTED'];
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export function LoadDispatchPage() {
  const { id } = useParams();
  const [v, setV] = useState<any>(null), [f, setF] = useState<any>({}), [categories, setCategories] = useState<string[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [missing, setMissing] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const fill = (x: any) => { setV(x); const o: any = { reason: '' }; FIELDS.forEach(k => { o[k] = str(x[k]); }); setF(o); };
  useEffect(() => {
    setV(null); setErr('');
    api(`/api/dispatch/loads/${id}/details`).then(x => { if (notReady(x)) setMissing(true); else fill(x); })
      .catch(e => { const m = errorText(e, 'The load could not be read'); if (notReady(m)) setMissing(true); else setErr(m); });
    api('/api/dispatch/setup/product-rules').then(x => setCategories(x.categories || [])).catch(() => setCategories([]));
  }, [id]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(''); setErr('');
    const body: any = { reason: f.reason };
    FIELDS.forEach(k => { body[k] = f[k] === '' ? null : f[k]; });
    try { const r = await api(`/api/dispatch/loads/${id}/details`, { method: 'PUT', body: JSON.stringify(body) }); fill(r); setMsg(r.message || 'Saved'); setRefresh(n => n + 1); }
    catch (x) { setErr(errorText(x, 'Not saved')); }
    finally { setBusy(false); }
  }
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const head = <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 className="flex items-center gap-2 text-3xl font-bold"><Package />Load {v?.loadNumber || ''}</h1>
      {v && <p className="text-slate-600">{v.partnerName || '-'} · {v.pickupCity} to {v.deliveryCity} · {fmtWeight(v.weightTons)} · {v.status}</p>}
    </div>
    <div className="flex flex-wrap gap-2">
      {v?.tripId && <Link to={`/dispatch/trips/${v.tripId}`} className={btn}>Open its trip</Link>}
      {v && !v.tripId && <Link to={`/dispatch?load=${id}`} className={btn}><CalendarRange className="mr-1 inline h-4 w-4" />Plan on the board</Link>}
    </div>
  </div>;
  if (missing) return <>{head}<NotReady script={SCRIPT64} /></>;
  const closed = v && CLOSED.includes(String(v.status).toUpperCase());

  return <>
    {head}
    <Banner msg={msg} error={err} />
    {v && <Section title="Goods and consignee" right={closed ? <span className="text-sm text-slate-500">This load is {String(v.status).toLowerCase()} and cannot be changed</span> : undefined}>
      <datalist id="dsp-load-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <fieldset disabled={closed || busy} className="contents">
          <div><label className={label}>Pallets</label><input type="number" min={0} max={100} className={input} value={f.palletCount} onChange={set('palletCount')} /></div>
          <div><label className={label}>Product kind</label><input list="dsp-load-categories" maxLength={60} className={input} value={f.productCategory} onChange={set('productCategory')} placeholder="e.g. Frozen fish" />
            <div className="mt-0.5 text-xs text-slate-500">Checked against the product rules</div></div>
          <div><label className={label}>Goods</label><input maxLength={200} className={input} value={f.goodsDescription} onChange={set('goodsDescription')} /></div>
          <div><label className={label}>Goods value (₹)</label><input type="number" step="any" min={0} className={input} value={f.goodsValue} onChange={set('goodsValue')} />
            <div className="mt-0.5 text-xs text-slate-500">Decides if an e-way bill is needed</div></div>
          <div><label className={label}>Consignee</label><input maxLength={180} className={input} value={f.consigneeName} onChange={set('consigneeName')} /></div>
          <div><label className={label}>Consignee GSTIN</label><input maxLength={15} className={`${input} uppercase`} value={f.consigneeGstin} onChange={set('consigneeGstin')} placeholder="15 letters and digits" /></div>
          <div className="sm:col-span-2"><label className={label}>Consignee address</label><input maxLength={500} className={input} value={f.consigneeAddress} onChange={set('consigneeAddress')} /></div>
          <div className="sm:col-span-2"><label className={label}>Warehouse order (stock of this load)</label>
            <select className={input} value={f.outboundOrderId} onChange={set('outboundOrderId')}>
              <option value="">No warehouse order</option>
              {v.outboundOrderId && !(v.orderChoices || []).some((o: any) => String(o.id) === String(v.outboundOrderId)) &&
                <option value={v.outboundOrderId}>{v.outboundOrderNo || `Order ${v.outboundOrderId}`} ({v.outboundOrderStatus || '-'})</option>}
              {(v.orderChoices || []).map((o: any) => <option key={o.id} value={o.id}>{o.orderNo} · {o.warehouseName} · {o.consigneeName || '-'}{o.consigneeCity ? `, ${o.consigneeCity}` : ''} · {o.status}</option>)}
            </select></div>
          {v.tripId && <div className="sm:col-span-2"><label className={label}>Reason for the change</label><input className={input} value={f.reason} onChange={set('reason')} placeholder="needed when the trip is approved" /></div>}
          {!closed && <div className="flex items-end sm:col-span-full"><button className={btn}>Save</button></div>}
        </fieldset>
      </form>
      {(v.problems || []).length > 0 && <ul className="mt-3 list-disc rounded-xl bg-amber-50 p-3 pl-8 text-sm text-amber-900">{v.problems.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>}
    </Section>}
    {v && !v.tripId && !closed && <TrucksForLoad loadId={String(id)} refresh={refresh} />}
  </>;
}

function TrucksForLoad({ loadId, refresh }: { loadId: string; refresh: number }) {
  const [r, setR] = useState<any>(null), [err, setErr] = useState(''), [showNo, setShowNo] = useState(false);
  useEffect(() => { setR(null); setErr(''); api(`/api/dispatch/loads/${loadId}/trucks`).then(setR).catch(e => setErr(errorText(e, 'The trucks could not be worked out'))); }, [loadId, refresh]);
  const trucks: any[] = r?.trucks || [], trips: any[] = r?.addToTrips || [], no: any[] = r?.notSuitable || [];
  return <Section title={<span className="flex items-center gap-2"><Truck />Trucks for this load</span>} right={<Link to={`/dispatch?load=${loadId}`} className="text-sm font-semibold text-sky-700 hover:underline">Plan on the board</Link>}>
    <Banner error={err} />
    {!r && !err && <p className="text-sm text-slate-500">Working out...</p>}
    {r && <>
      <p className="text-sm text-slate-600">Pickup {r.pickupCity} to {r.deliveryCity}, {fmtWeight(r.weightTons)}{r.palletCount != null ? `, ${r.palletCount} pallets` : ''}, from {when(r.from)} to {when(r.to)}.</p>
      {r.message && <p className="mt-1 text-sm font-semibold">{r.message}</p>}

      <h3 className="mt-4 font-bold">Free trucks ({trucks.length}), cheapest first</h3>
      {!trucks.length ? <p className="text-sm text-slate-500">No free truck can take this load.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className={th}>#</th><th className={th}>Truck</th><th className={th}>From town</th><th className={th}>Empty km</th><th className={th}>Loaded km</th><th className={th}>Cost</th><th className={th}>Fill</th><th className={th}>Notes</th></tr></thead>
          <tbody>{trucks.map((t, i) => <tr key={t.vehicleId} className={`border-t border-slate-100 ${i === 0 ? 'bg-emerald-50' : ''}`}>
            <td className={td}>{i + 1}</td>
            <td className={`${td} font-semibold`}>{t.vehicleNumber}<div className="text-xs font-normal text-slate-500">{fmtWeight(t.capacityTons)}{t.palletPositions != null ? `, ${t.palletPositions} pallets` : ''}</div></td>
            <td className={td}>{t.fromTown || '-'}</td><td className={td}>{plain(t.emptyKm)}</td><td className={td}>{plain(t.loadedKm)}</td>
            <td className={`${td} font-semibold`}>{inr(t.cost)}</td><td className={td}>{t.fillPercent != null ? `${t.fillPercent} %` : '-'}</td>
            <td className={td}>{t.note && <div className="text-xs text-slate-500">{t.note}</div>}{(t.warnings || []).map((w: string, j: number) => <div key={j} className="text-xs text-amber-800">{w}</div>)}</td>
          </tr>)}</tbody>
        </table></div>}

      <h3 className="mt-5 font-bold">Part-load trips that can take it ({trips.length})</h3>
      {!trips.length ? <p className="text-sm text-slate-500">No planned part-load trip can take it on the way with every stop on time.</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className={th}>Trip</th><th className={th}>Truck</th><th className={th}>Start</th><th className={th}>Extra km</th><th className={th}>Extra cost</th><th className={th}></th></tr></thead>
          <tbody>{trips.map(t => <tr key={t.tripId} className="border-t border-slate-100">
            <td className={td}><Link to={`/dispatch/trips/${t.tripId}`} className="font-semibold text-sky-700 hover:underline">{t.tripNumber}</Link></td>
            <td className={td}>{t.vehicleNumber || '-'}</td><td className={td}>{when(t.plannedStart)}</td><td className={td}>{plain(t.extraKm)}</td><td className={td}>{inr(t.cost)}</td>
            <td className={td}><Link to={`/part-load/${t.tripId}`} className="font-semibold text-sky-700 hover:underline">Add in the planner</Link></td>
          </tr>)}</tbody>
        </table></div>}

      {no.length > 0 && <div className="mt-5">
        <button className="text-sm font-semibold text-slate-600 hover:underline" onClick={() => setShowNo(!showNo)}>{showNo ? 'Hide' : 'Show'} trucks that cannot take it ({no.length})</button>
        {showNo && <ul className="mt-2 space-y-1 text-sm">{no.map(t => <li key={t.vehicleId}><b>{t.vehicleNumber}</b>: <span className="text-slate-600">{(t.reasons || []).join('; ')}</span></li>)}</ul>}
      </div>}
    </>}
  </Section>;
}
