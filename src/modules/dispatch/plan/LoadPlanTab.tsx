/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-004 -- the Load plan tab of the Dispatch Plan: pallets used against the truck's pallet positions, the
// compartments with their goods, temperature and fill, and every consignment on the truck (the trip's own goods and
// each load) with its product kind, pallets, tons and compartment. The rules the plan breaks are listed.
// The own goods (pallets, kind, compartment) can be changed, and a load moved to another compartment; an approved
// trip asks a Manager for a reason.
// Backend: GET /api/dispatch/trips/{id}/load-plan, PUT /api/dispatch/trips/{id}/load-plan/own
// { plannedPallets, productCategory, compartmentId, reason }, PUT /api/dispatch/trips/{id}/load-plan/loads/{tripLoadId}
// { compartmentId, reason }, GET /api/dispatch/setup/product-rules (the product kinds to choose from).
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { Problems, TabProps, approved, open, plain, reasonFor, send, useAction } from './planning';
import { CompartmentTempsPanel } from '@/modules/coldchain/records/CompartmentTempsPanel'; // REQ-CC-012
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function LoadPlanTab({ tripId, plan, reload }: TabProps) {
  const lp = plan.loadPlan || {};
  const items: any[] = lp.items || [];
  const comps: any[] = lp.compartments || [];
  const editable = open(plan);
  const { busy, msg, err, run } = useAction(reload);
  const [own, setOwn] = useState<any>(null), [kinds, setKinds] = useState<string[]>([]);

  useEffect(() => {
    if (own && !kinds.length) api('/api/dispatch/setup/product-rules').then(x => setKinds(Array.isArray(x?.categories) ? x.categories : [])).catch(() => setKinds([]));
  }, [own]);

  const o = items.find(i => i.own);
  function startOwn() {
    setOwn({ plannedPallets: o?.pallets ?? '', productCategory: o?.category || '', compartmentId: o?.compartmentId != null ? String(o.compartmentId) : '', reason: '' });
  }

  async function saveOwn(e: FormEvent) {
    e.preventDefault();
    const body: any = { plannedPallets: own.plannedPallets === '' ? null : Number(own.plannedPallets), productCategory: own.productCategory || null, reason: own.reason || null };
    if (comps.length) body.compartmentId = own.compartmentId ? Number(own.compartmentId) : null;
    if (await run(() => api(`/api/dispatch/trips/${tripId}/load-plan/own`, send('PUT', body)))) setOwn(null);
  }

  function move(item: any, value: string) {
    const reason = reasonFor(plan, `moving ${item.label}`);
    if (reason === null) return;
    void run(() => api(`/api/dispatch/trips/${tripId}/load-plan/loads/${item.tripLoadId}`, send('PUT', { compartmentId: value ? Number(value) : null, reason: reason || null })));
  }

  const set = (k: string) => (e: any) => setOwn((x: any) => ({ ...x, [k]: e.target.value }));
  const used = Number(lp.palletsUsed || 0), positions = lp.palletPositions;
  const pct = positions ? Math.min(100, Math.round((used / positions) * 100)) : 0;

  return <Section title="Load plan" right={editable && !own && <button className={btnLight} onClick={startOwn}>Change own goods</button>}>
    <Banner msg={msg} error={err} />
    <div className="rounded-xl bg-slate-50 p-3 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><span>Truck <b>{lp.vehicleNumber || '-'}</b></span>
        <span className={positions != null && used > positions ? 'font-bold text-red-700' : 'font-semibold'}>{used} pallets used of {positions ?? 'unknown'} positions</span></div>
      {positions ? <div className="mt-2 h-2 w-full rounded-full bg-slate-200"><div className={`h-2 rounded-full ${used > positions ? 'bg-red-500' : 'bg-sky-600'}`} style={{ width: `${pct}%` }} /></div>
        : <p className="mt-1 text-xs text-slate-500">The truck's pallet positions are not set (Dispatch setup).</p>}
    </div>

    {own && <form onSubmit={saveOwn} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 md:grid-cols-4">
      <div className="text-sm font-bold md:col-span-4">The trip's own goods</div>
      <div><span className={label}>Pallets</span><input className={input} type="number" min={0} max={100} value={own.plannedPallets} onChange={set('plannedPallets')} /></div>
      <div><span className={label}>Product kind</span><input className={input} list="dsp-kinds" value={own.productCategory} onChange={set('productCategory')} placeholder="Frozen meat" />
        <datalist id="dsp-kinds">{kinds.map(k => <option key={k} value={k} />)}</datalist></div>
      {comps.length > 0 && <div><span className={label}>Compartment</span><select className={input} value={own.compartmentId} onChange={set('compartmentId')}>
        <option value="">None</option>{comps.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></div>}
      <div><span className={label}>Reason{approved(plan) ? ' *' : ''}</span><input className={input} required={approved(plan)} value={own.reason} onChange={set('reason')} placeholder="Customer sent 2 more pallets" /></div>
      <div className="flex gap-2 md:col-span-4"><button className={btn} disabled={busy}>Save</button><button type="button" className={btnLight} onClick={() => setOwn(null)}>Cancel</button></div>
    </form>}

    {comps.length > 0 && <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {comps.map(c => {
        const full = (c.palletPositions != null && c.palletsUsed > c.palletPositions) || (c.capacityTons != null && Number(c.tonsUsed) > Number(c.capacityTons));
        return <div key={c.id} className={`rounded-xl border p-3 text-sm ${full ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
          <div className="font-bold">{c.title}</div>
          <div className="text-slate-600">{c.palletsUsed} / {c.palletPositions ?? '-'} pallets · {plain(c.tonsUsed)} / {fmtWeight(c.capacityTons)}</div>
          <div className="text-xs text-slate-500">Holds {c.holds || 'any temperature'}{c.setTo ? ` · set to ${c.setTo}` : ''}</div>
          <div className="mt-1">{c.loads?.length ? c.loads.join(', ') : <span className="text-slate-400">Empty</span>}</div>
        </div>;
      })}
    </div>}
    {!comps.length && <p className="mt-2 text-xs text-slate-500">This truck has no compartments: all goods share one space.</p>}

    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead><tr className="bg-slate-50"><th className={th}>Goods</th><th className={th}>Kind</th><th className={th}>Temperature</th><th className={th}>Pallets</th><th className={th}>Tons</th><th className={th}>Compartment</th><th className={th} /></tr></thead>
        <tbody>{items.map(i => <tr key={i.tripLoadId ?? 'own'} className="border-t">
          <td className={`${td} font-semibold`}>{i.label}</td>
          <td className={td}>{i.category || '-'}</td>
          <td className={td}>{i.temperature || '-'}</td>
          <td className={td}>{i.pallets ?? '-'}</td>
          <td className={td}>{plain(i.tons)}</td>
          <td className={td}>{!i.own && editable && comps.length > 0
            ? <select className={`${input} py-1`} disabled={busy} value={i.compartmentId ?? ''} onChange={e => move(i, e.target.value)}>
                <option value="">None</option>{comps.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
            : i.compartment || '-'}</td>
          <td className={td}>{i.loadRequestId && <Link to={`/dispatch/loads/${i.loadRequestId}`} className="whitespace-nowrap text-sky-700 hover:underline">Goods and consignee</Link>}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <Problems items={lp.problems} title="The load plan breaks these rules" />
    <CompartmentTempsPanel tripId={tripId} title="Live compartment temperatures" />{/* REQ-CC-012: shows nothing before script 66 or without readings of compartments */}
  </Section>;
}
