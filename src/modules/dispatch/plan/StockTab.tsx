/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-005 -- the Stock tab of the Dispatch Plan: the warehouse outbound orders of the trip (linked to it, or
// named by a load on it) with their status, quantities, pallets on hold, staged / on the truck and short quantity.
// Loading starts only when every order is staged and nothing is on hold; Start Trip when everything is on the truck.
// An order of the trip's partners can be linked here, and unlinked while none of its pallets is on the truck.
// Backend: GET /api/dispatch/trips/{id}/stock, POST /api/dispatch/trips/{id}/stock/link { outboundOrderId },
// POST /api/dispatch/trips/{id}/stock/unlink { outboundOrderId }.
import { useState } from 'react';
import { Banner, Section, btn, btnRed, input, label, td, th } from '@/shared/components/FormKit';
import { api } from '@/shared/services/api';
import { Problems, TabProps, open, plain, send, useAction, when, words } from './planning';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700', RESERVED: 'bg-amber-100 text-amber-800', PICKING: 'bg-amber-100 text-amber-800', PICKED: 'bg-sky-100 text-sky-800',
  STAGED: 'bg-emerald-100 text-emerald-800', LOADED: 'bg-emerald-200 text-emerald-900', DISPATCHED: 'bg-slate-200 text-slate-700',
};

export function StockTab({ tripId, plan, reload }: TabProps) {
  const s = plan.stock || {};
  const orders: any[] = s.orders || [];
  const choices: any[] = s.orderChoices || [];
  const editable = open(plan);
  const { busy, msg, err, run } = useAction(reload);
  const [pick, setPick] = useState(''), [typed, setTyped] = useState('');

  const link = (orderId: number | string) => run(() => api(`/api/dispatch/trips/${tripId}/stock/link`, send('POST', { outboundOrderId: Number(orderId) })), 'Not linked')
    .then(ok => { if (ok) { setPick(''); setTyped(''); } });
  const unlink = (o: any) => {
    if (!window.confirm(`Unlink warehouse order ${o.orderNo} from this trip?`)) return;
    void run(() => api(`/api/dispatch/trips/${tripId}/stock/unlink`, send('POST', { outboundOrderId: o.id })), 'Not unlinked');
  };

  if (s.warehouseReady === false) return <Section title="Warehouse stock"><p className="text-sm text-slate-500">The warehouse module is not set up, so no stock is checked for this trip.</p></Section>;

  return <Section title="Warehouse stock">
    <Banner msg={msg} error={err} />
    {s.gateOn === false && <p className="mb-2 rounded-xl bg-slate-50 p-2 text-sm text-slate-600">The stock check is switched off on Dispatch setup: loading and Start Trip do not wait for the warehouse.</p>}

    <div className="overflow-x-auto">
      {!orders.length ? <p className="text-sm text-slate-500">No warehouse order is linked to this trip. A trip without one is not checked (goods collected from the partner's premises).</p>
        : <table className="w-full min-w-[980px] text-sm">
          <thead><tr className="bg-slate-50">
            <th className={th}>Order</th><th className={th}>Status</th><th className={th}>Partner / consignee</th><th className={th}>Ordered</th><th className={th}>Reserved</th>
            <th className={th}>Picked</th><th className={th}>Loaded</th><th className={th}>Short</th><th className={th}>Tasks staged</th><th className={th}>Held pallets</th><th className={th} />
          </tr></thead>
          <tbody>{orders.map(o => <tr key={o.id} className="border-t">
            <td className={td}><div className="font-semibold">{o.orderNo}</div><div className="text-xs text-slate-500">{o.warehouseName}{o.loadNumbers ? ` · load ${o.loadNumbers}` : ''}</div>
              {!o.linkedToTrip && <div className="text-xs font-semibold text-amber-700">Named by a load, not linked in the warehouse</div>}</td>
            <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[o.status] || 'bg-slate-100'}`}>{words(o.status)}</span>
              <div className="mt-1 text-xs">{o.onTruck ? 'On the truck' : o.staged ? 'Staged at the dock' : 'Not staged'}</div></td>
            <td className={td}>{o.partnerName}<div className="text-xs text-slate-500">{o.consigneeName || '-'}{o.consigneeCity ? `, ${o.consigneeCity}` : ''}{o.requiredDate ? ` · needed ${when(o.requiredDate)}` : ''}</div></td>
            <td className={td}>{plain(o.orderedQty)}</td>
            <td className={td}>{plain(o.reservedQty)}</td>
            <td className={td}>{plain(o.pickedQty)}</td>
            <td className={td}>{plain(o.loadedQty)}</td>
            <td className={`${td} ${Number(o.shortQty) > 0 ? 'font-bold text-red-700' : ''}`}>{Number(o.shortQty) > 0 ? plain(o.shortQty) : '-'}</td>
            <td className={td}>{o.stagedTasks} / {o.tasks}</td>
            <td className={`${td} ${Number(o.heldPallets) > 0 ? 'font-bold text-red-700' : ''}`}>{o.heldPallets}</td>
            <td className={td}>{editable && o.linkedToTrip && !o.onTruck && <button className={btnRed} disabled={busy} onClick={() => unlink(o)}>Unlink</button>}
              {editable && !o.linkedToTrip && <button className={btn} disabled={busy} onClick={() => void link(o.id)}>Link</button>}</td>
          </tr>)}</tbody>
        </table>}
    </div>

    <Problems items={s.loadingBlockers} title="Loading cannot start" tone="amber" />
    <Problems items={s.startBlockers} title="Start Trip waits for" />

    {editable && <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-[1fr_auto_200px_auto] md:items-end">
      <div><span className={label}>Link an order of the trip's partners</span>
        <select className={input} value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">{choices.length ? 'Choose an order' : 'No open order to link'}</option>
          {choices.map(c => <option key={c.id} value={c.id}>{c.orderNo} · {c.partnerName} · {words(c.status)}{c.consigneeCity ? ` · ${c.consigneeCity}` : ''}</option>)}
        </select></div>
      <button className={btn} disabled={busy || !pick} onClick={() => void link(pick)}>Link</button>
      <div><span className={label}>or the order id</span><input className={input} inputMode="numeric" value={typed} onChange={e => setTyped(e.target.value.replace(/\D/g, ''))} /></div>
      <button className={btn} disabled={busy || !typed} onClick={() => void link(typed)}>Link</button>
    </div>}
  </Section>;
}
