/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-002 / REQ-CNF-004 -- distributors' sales orders: entered, credit-checked, held for a named approver or
// allotted from the depot's stock by the principal's rule (a warehouse outbound order is made and reserved).
// Also the principal's stock transfers to the depot (warehouse inbound notices) and the free stock by batch.
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, input, label } from '@/shared/components/FormKit';
import { ask, day, inr, post, put, qty, useRunner, when } from './cnf';
import { Grid, Info, Pill } from './CnfKit';
import type { CnfCtx } from './CnfPage';
import { pq } from './CnfPage';

type Line = { productId?: string; quantity?: string; unitPrice?: string; gstRate?: string; batchNo?: string };

export function OrdersTab({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [status, setStatus] = useState('OPEN');
  const [rows, setRows] = useState<any[]>([]);
  const [holds, setHolds] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const load = useCallback(async () => {
    const d = await api(`/api/cnf/orders?status=${status}${pq(ctx, false)}`);
    setRows(d.orders || []);
    const h = await api(`/api/cnf/orders/holds${pq(ctx)}`);
    setHolds(h.orders || []);
  }, [status, ctx.principalId]);
  useEffect(() => { load().catch(x => r.setError(String((x as Error).message))); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/cnf/orders/${id}`)); if (d) setSel(d); };
  const act = async (path: string, body?: unknown) => { const d = await r.run(() => post(path, body)); if (d) { setSel(d.id ? d : null); await load(); if (d.id) await open(d.id); } };
  const writer = !ctx.partner || ctx.canWrite;
  const askAnd = async (path: string, key: string, q: string) => { const v = ask(q); if (v !== null) await act(path, { [key]: v }); };

  return <>
    <Banner msg={r.msg} error={r.error} />
    {holds.length > 0 && <Section title={`Credit hold queue (${holds.length})`}>
      <Grid rows={holds} empty="" onRow={x => open(x.id)} cols={[
        { key: 'orderNo', title: 'Order' }, { key: 'distributorName', title: 'Distributor' }, { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) },
        { key: 'creditOutstanding', title: 'Outstanding', right: true, render: x => inr(x.creditOutstanding) }, { key: 'creditLimit', title: 'Limit', right: true, render: x => inr(x.creditLimit) || 'none' },
        { key: 'holdReason', title: 'Why held' }, { key: 'createdAt', title: 'Since', render: x => when(x.createdAt) }]} />
    </Section>}
    <Section title="Distributors' orders" right={<div className="flex gap-2">
      <select className={`${input} w-44`} value={status} onChange={e => setStatus(e.target.value)}>
        {['OPEN', 'ALL', 'DRAFT', 'CREDIT_HOLD', 'ALLOTTED', 'DISPATCHED', 'DELIVERED', 'REJECTED', 'CANCELLED'].map(s => <option key={s} value={s}>{s === 'OPEN' ? 'Open' : s === 'ALL' ? 'All' : s.replace('_', ' ')}</option>)}
      </select>
      {writer && <button className={btn} onClick={() => { setSel(null); setEditing({ lines: [{}] }); }}>New order</button>}
    </div>}>
      {editing && <OrderForm ctx={ctx} order={editing} r={r} done={async d => { setEditing(null); await load(); if (d?.id) await open(d.id); }} />}
      <Grid rows={rows} empty="No orders." onRow={x => open(x.id)} selected={sel?.id} cols={[
        { key: 'orderNo', title: 'Order' }, { key: 'orderDate', title: 'Date', render: x => day(x.orderDate) }, { key: 'distributorName', title: 'Distributor' },
        { key: 'warehouseName', title: 'Depot' }, { key: 'totalQty', title: 'Qty', right: true, render: x => qty(x.totalQty) }, { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }, { key: 'outboundOrderNo', title: 'Warehouse order' }]} />
      {sel && <div className="mt-4 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Order {sel.orderNo} <Pill s={sel.status} /></h3>
          <div className="flex flex-wrap gap-2">
            {writer && sel.status === 'DRAFT' && <button className={btnLight} onClick={() => { setEditing({ ...sel, lines: sel.lines.map((l: any) => ({ productId: String(l.productId), quantity: l.quantity, unitPrice: l.unitPrice, gstRate: l.gstRate, batchNo: l.batchNo || '' })) }); }}>Change</button>}
            {writer && sel.status === 'DRAFT' && <button className={btn} disabled={r.busy} onClick={() => act(`/api/cnf/orders/${sel.id}/confirm`)}>Confirm (credit check, allot)</button>}
            {sel.canRelease && <button className={btn} disabled={r.busy} onClick={() => askAnd(`/api/cnf/orders/${sel.id}/release`, 'note', 'Why may this order go despite the credit hold? (at least 5 characters)')}>Release credit hold</button>}
            {writer && ['DRAFT', 'CREDIT_HOLD'].includes(sel.status) && <button className={btnRed} disabled={r.busy} onClick={() => askAnd(`/api/cnf/orders/${sel.id}/reject`, 'reason', 'Reason for rejecting the order:')}>Reject</button>}
            {writer && ['DRAFT', 'CREDIT_HOLD', 'ALLOTTED'].includes(sel.status) && <button className={btnRed} disabled={r.busy} onClick={() => askAnd(`/api/cnf/orders/${sel.id}/cancel`, 'reason', 'Reason for cancelling the order:')}>Cancel</button>}
            <button className={btnLight} onClick={() => setSel(null)}>Close</button>
          </div>
        </div>
        <Info items={[['Distributor', sel.distributorName], ['Depot', sel.warehouseName], ['PO', sel.distributorPoNo], ['Delivery', `${day(sel.deliveryDate)} ${sel.deliveryAddress || ''}`],
          ['Value', `${inr(sel.totalValue)} (${inr(sel.valueWithGst)} with GST)`], ['Allotment rule', sel.allotmentRule], ['Warehouse order', sel.outboundOrderNo ? `${sel.outboundOrderNo} (${sel.outboundStatus})` : ''],
          ['Truck', sel.vehicleNumber], ['Held because', sel.holdReason], ['Released', sel.releasedBy ? `${sel.releasedBy}: ${sel.releaseNote}` : ''], ['Rejected / cancelled', sel.rejectedReason || sel.cancelledReason]]} />
        {sel.credit && <div className="mt-2 text-sm">Credit: outstanding <b>{inr(sel.credit.outstanding)}</b>, limit {inr(sel.credit.creditLimit) || 'none'}, oldest overdue {sel.credit.overdueDays || 0} days ({sel.credit.source === 'RECORDED' ? 'our figures' : 'principal\'s figures'}).
          {sel.status === 'CREDIT_HOLD' && <> Approvers: {sel.approvers?.map((a: any) => a.userName).join(', ') || 'none named (an Admin can release)'}.</>}</div>}
        {sel.allotmentNote && <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">{sel.allotmentNote}</div>}
        <div className="mt-3"><Grid rows={sel.lines || []} empty="" cols={[{ key: 'lineNo', title: '#' }, { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch asked' },
          { key: 'quantity', title: 'Qty', right: true, render: x => qty(x.quantity) }, { key: 'unitPrice', title: 'Price', right: true, render: x => inr(x.unitPrice) },
          { key: 'gstRate', title: 'GST %', right: true }, { key: 'lineValue', title: 'Value', right: true, render: x => inr(x.lineValue) }]} /></div>
        {sel.outboundLines?.length > 0 && <div className="mt-3"><div className={label}>Allotted batches (warehouse order)</div><Grid rows={sel.outboundLines} empty="" cols={[
          { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch' }, { key: 'quantity', title: 'Qty', right: true, render: x => qty(x.quantity) },
          { key: 'reservedQty', title: 'Reserved', right: true, render: x => qty(x.reservedQty) }, { key: 'pickedQty', title: 'Picked', right: true, render: x => qty(x.pickedQty) },
          { key: 'loadedQty', title: 'Loaded', right: true, render: x => qty(x.loadedQty) }]} /></div>}
      </div>}
    </Section>
    <StockAndTransfers ctx={ctx} />
  </>;
}

function OrderForm({ ctx, order, r, done }: { ctx: CnfCtx; order: any; r: ReturnType<typeof useRunner>; done: (d?: any) => void }) {
  const [distributors, setDistributors] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [head, setHead] = useState<any>({ distributorId: order.distributorId ? String(order.distributorId) : '', warehouseId: order.warehouseId ? String(order.warehouseId) : '',
    distributorPoNo: order.distributorPoNo || '', deliveryDate: order.deliveryDate || '', deliveryAddress: order.deliveryAddress || '' });
  const [lines, setLines] = useState<Line[]>(order.lines?.length ? order.lines : [{}]);
  useEffect(() => {
    api(`/api/cnf/distributors${pq(ctx)}`).then(d => setDistributors(d.distributors || [])).catch(() => {});
    api(`/api/cnf/warehouses${pq(ctx)}`).then(d => { const w = d.warehouses || []; setWarehouses(w); if (!head.warehouseId && w[0]) setHead((h: any) => ({ ...h, warehouseId: String(w[0].id) })); }).catch(() => {});
  }, []);
  useEffect(() => { api(`/api/cnf/products${pq(ctx)}${head.warehouseId ? `${ctx.principalId ? '&' : '?'}warehouseId=${head.warehouseId}` : ''}`).then(d => setProducts(d.products || [])).catch(() => {}); }, [head.warehouseId]);
  const setLine = (i: number, k: keyof Line, v: string) => setLines(ls => ls.map((l, j) => {
    if (j !== i) return l;
    const n = { ...l, [k]: v };
    if (k === 'productId') { const p = products.find(x => String(x.id) === v); if (p && !l.unitPrice && p.lastPrice) n.unitPrice = String(p.lastPrice); }
    return n;
  }));
  const value = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0), 0);
  const save = async () => {
    const body = { ...head, principalPartnerId: ctx.principalId, lines: lines.filter(l => l.productId && l.quantity) };
    const d = await r.run(() => (order.id ? put(`/api/cnf/orders/${order.id}`, body) : post('/api/cnf/orders', body)));
    if (d) done(d);
  };
  return <div className="mb-4 rounded-xl border p-3">
    <div className="grid gap-3 md:grid-cols-5">
      <div><label className={label}>Distributor *</label><select className={input} value={head.distributorId} onChange={e => setHead({ ...head, distributorId: e.target.value })}>
        <option value="">Choose…</option>{distributors.filter(d => d.active).map(d => <option key={d.id} value={d.id}>{d.code} {d.name}</option>)}</select></div>
      <div><label className={label}>Depot *</label><select className={input} value={head.warehouseId} onChange={e => setHead({ ...head, warehouseId: e.target.value })}>
        {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <div><label className={label}>Distributor's PO no.</label><input className={input} value={head.distributorPoNo} onChange={e => setHead({ ...head, distributorPoNo: e.target.value })} /></div>
      <div><label className={label}>Deliver by</label><input type="date" className={input} value={head.deliveryDate} onChange={e => setHead({ ...head, deliveryDate: e.target.value })} /></div>
      <div><label className={label}>Deliver to (empty: distributor's address)</label><input className={input} value={head.deliveryAddress} onChange={e => setHead({ ...head, deliveryAddress: e.target.value })} /></div>
    </div>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-slate-600"><tr><th>Product</th><th>Free stock</th><th>Quantity</th><th>Price ₹</th><th>GST %</th><th>Batch (only for "batch fixed")</th><th /></tr></thead>
      <tbody>{lines.map((l, i) => { const p = products.find(x => String(x.id) === l.productId); return <tr key={i}>
        <td className="pr-2"><select className={input} value={l.productId || ''} onChange={e => setLine(i, 'productId', e.target.value)}><option value="">Choose…</option>
          {products.map(x => <option key={x.id} value={x.id}>{x.productCode} {x.name}</option>)}</select></td>
        <td className="pr-2 text-slate-600">{p ? `${qty(p.freeQty)} ${p.uom || ''}` : ''}</td>
        <td className="pr-2"><input className={input} type="number" step="any" value={l.quantity || ''} onChange={e => setLine(i, 'quantity', e.target.value)} /></td>
        <td className="pr-2"><input className={input} type="number" step="any" value={l.unitPrice || ''} onChange={e => setLine(i, 'unitPrice', e.target.value)} /></td>
        <td className="pr-2"><input className={input} type="number" step="any" placeholder={String(ctx.contract?.defaultGstRate ?? '')} value={l.gstRate || ''} onChange={e => setLine(i, 'gstRate', e.target.value)} /></td>
        <td className="pr-2"><input className={input} value={l.batchNo || ''} onChange={e => setLine(i, 'batchNo', e.target.value)} /></td>
        <td><button type="button" className={btnLight} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button></td>
      </tr>; })}</tbody></table></div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button type="button" className={btnLight} onClick={() => setLines([...lines, {}])}>Add line</button>
      <span className="text-sm text-slate-600">Value before GST: <b>{inr(value)}</b></span>
      <span className="flex-1" />
      <button className={btn} disabled={r.busy} onClick={save}>{order.id ? 'Save order' : 'Save as draft'}</button>
      <button className={btnLight} onClick={() => done()}>Cancel</button>
    </div>
  </div>;
}

function StockAndTransfers({ ctx }: { ctx: CnfCtx }) {
  const r = useRunner();
  const [stock, setStock] = useState<any[]>([]);
  const [inbound, setInbound] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [head, setHead] = useState<any>({ warehouseId: '', principalRef: '', principalRefDate: '', expectedAt: '', vehicleNumber: '' });
  const [lines, setLines] = useState<any[]>([{}]);
  const load = useCallback(async () => {
    const [s, i] = await Promise.all([api(`/api/cnf/stock${pq(ctx)}`).catch(() => ({ stock: [] })), api(`/api/cnf/inbound${pq(ctx)}`)]);
    setStock(s.stock || []); setInbound(i.inbound || []);
  }, [ctx.principalId]);
  useEffect(() => {
    load().catch(x => r.setError(String((x as Error).message)));
    api(`/api/cnf/warehouses${pq(ctx)}`).then(d => { setWarehouses(d.warehouses || []); if (d.warehouses?.[0]) setHead((h: any) => ({ ...h, warehouseId: String(d.warehouses[0].id) })); }).catch(() => {});
    api(`/api/cnf/products${pq(ctx)}`).then(d => setProducts(d.products || [])).catch(() => {});
  }, [load]);
  const writer = !ctx.partner || ctx.canWrite;
  const send = async () => {
    const d = await r.run(() => post('/api/cnf/inbound', { ...head, principalPartnerId: ctx.principalId, expectedAt: head.expectedAt ? new Date(head.expectedAt).toISOString() : null, lines: lines.filter(l => l.productId && l.quantity) }));
    if (d) { setShow(false); setLines([{}]); await load(); }
  };
  const setLine = (i: number, k: string, v: string) => setLines(ls => ls.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  return <>
    <Section title="Stock transfers from the principal" right={writer && <button className={btn} onClick={() => setShow(!show)}>Announce a stock transfer</button>}>
      <Banner msg={r.msg} error={r.error} />
      {show && <div className="mb-4 rounded-xl border p-3">
        <div className="grid gap-3 md:grid-cols-5">
          <div><label className={label}>Depot</label><select className={input} value={head.warehouseId} onChange={e => setHead({ ...head, warehouseId: e.target.value })}>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
          <div><label className={label}>Principal's transfer / invoice no. *</label><input className={input} value={head.principalRef} onChange={e => setHead({ ...head, principalRef: e.target.value })} /></div>
          <div><label className={label}>Its date</label><input type="date" className={input} value={head.principalRefDate} onChange={e => setHead({ ...head, principalRefDate: e.target.value })} /></div>
          <div><label className={label}>Expected at the depot</label><input type="datetime-local" className={input} value={head.expectedAt} onChange={e => setHead({ ...head, expectedAt: e.target.value })} /></div>
          <div><label className={label}>Truck number</label><input className={input} value={head.vehicleNumber} onChange={e => setHead({ ...head, vehicleNumber: e.target.value })} /></div>
        </div>
        {lines.map((l, i) => <div key={i} className="mt-2 grid gap-2 md:grid-cols-6">
          <select className={input} value={l.productId || ''} onChange={e => setLine(i, 'productId', e.target.value)}><option value="">Product…</option>{products.map(p => <option key={p.id} value={p.id}>{p.productCode} {p.name}</option>)}</select>
          <input className={input} type="number" step="any" placeholder="Quantity" value={l.quantity || ''} onChange={e => setLine(i, 'quantity', e.target.value)} />
          <input className={input} placeholder="Batch" value={l.batchNo || ''} onChange={e => setLine(i, 'batchNo', e.target.value)} />
          <input className={input} type="date" title="Manufactured" value={l.mfgDate || ''} onChange={e => setLine(i, 'mfgDate', e.target.value)} />
          <input className={input} type="date" title="Expiry" value={l.expiryDate || ''} onChange={e => setLine(i, 'expiryDate', e.target.value)} />
          <button type="button" className={btnLight} onClick={() => setLines(lines.filter((_, j) => j !== i))}>Remove</button>
        </div>)}
        <div className="mt-2 flex gap-2"><button type="button" className={btnLight} onClick={() => setLines([...lines, {}])}>Add line</button>
          <button className={btn} disabled={r.busy} onClick={send}>Send to the depot</button></div>
      </div>}
      <Grid rows={inbound} empty="No stock transfers announced." cols={[
        { key: 'noticeNo', title: 'Notice' }, { key: 'principalRef', title: 'Principal\'s ref.' }, { key: 'warehouseName', title: 'Depot' }, { key: 'expectedAt', title: 'Expected', render: x => when(x.expectedAt) },
        { key: 'vehicleNumber', title: 'Truck' }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }]} />
    </Section>
    {stock.length > 0 && <Section title="Stock at the depot by batch">
      <Grid rows={stock} empty="" cols={[
        { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch' }, { key: 'expiryDate', title: 'Expiry', render: x => day(x.expiryDate) },
        { key: 'daysToExpiry', title: 'Days left', right: true }, { key: 'quantity', title: 'Quantity', right: true, render: x => `${qty(x.quantity)} ${x.uom || ''}` },
        { key: 'free', title: 'Free', right: true, render: x => qty(x.free) }, { key: 'onHold', title: 'On hold', right: true, render: x => qty(x.onHold) }, { key: 'warehouseName', title: 'Depot' }]} />
    </Section>}
  </>;
}
