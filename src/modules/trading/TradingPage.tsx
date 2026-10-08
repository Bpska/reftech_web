/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-009 -- Trading and distribution (/trading): RefTech buys from the brand and sells to stores (super stockist).
//   Vendors & Customers  vendors with their audits, customers with credit limits, the settings (seller, series, margin)
//   Purchase Orders      order to the brand, send (the delivery is announced on Warehouse > Inbound), receive by batch
//   Trading Stock        RefTech-owned lots by batch and expiry, with their value at landed cost
//   Sales & Invoices     order from a store, credit check, GST invoice (FEFO lots, cost and margin), picking on Warehouse > Outbound
//   Collections          receipts set against the oldest invoices, outstanding with ageing
//   Margin               per product or per customer
// Staff with TRADING_VIEW look; TRADING_EDIT changes; a credit hold is released by a Manager. Backend: /api/trading/**.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, input, label } from '@/shared/components/FormKit';
import { day, inr, post, put, qty, useRunner, Runner, ask } from '@/modules/cnf/cnf';
import { Grid, Info, Pill } from '@/modules/cnf/CnfKit';
import { AGEING, Line, TRADING_SCRIPT, TRADING_TABS, TradingTab, ageingTotals, lineValue, linesToSend, marginTone, preview, tabOf } from './trading';

type Ctx = { r: Runner; canEdit: boolean; manager: boolean; look: any; settings: any; n: number; reload: () => void };

export function TradingPage() {
  const r = useRunner();
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const [status, setStatus] = useState<any>(null);
  const [look, setLook] = useState<any>({ warehouses: [], products: [], partners: [] });
  const [settings, setSettings] = useState<any>({});
  const [n, setN] = useState(0);
  const reload = () => setN(x => x + 1);
  useEffect(() => {
    api('/api/trading/status').then(s => {
      setStatus(s);
      if (s.ready === false) return;
      api('/api/trading/lookups').then(setLook).catch(() => {});
      api('/api/trading/settings').then(setSettings).catch(() => {});
    }).catch(x => r.setError((x as Error).message));
  }, [n]);
  if (status?.ready === false) return <NotReady script={status.script || TRADING_SCRIPT} />;
  const ctx: Ctx = { r, canEdit: !!status?.canEdit, manager: !!status?.manager, look, settings, n, reload };
  return <div>
    <h1 className="flex items-center gap-2 text-2xl font-bold"><ShoppingCart className="h-7 w-7 text-sky-700" />Trading & Distribution</h1>
    <p className="mt-1 text-sm text-slate-600">RefTech buys from the brand, keeps the stock in its own name and sells to stores with its own GST invoices. The goods use the same warehouse, dispatch and billing as the 3PL work.</p>
    <div className="mt-4 flex flex-wrap gap-2" role="tablist">
      {TRADING_TABS.map(([k, t]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setParams({ tab: k })}
        className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700'}`}>{t}</button>)}
    </div>
    <Banner msg={r.msg} error={r.error} />
    {tab === 'masters' && <Masters c={ctx} />}
    {tab === 'buy' && <Buy c={ctx} />}
    {tab === 'stock' && <Stock c={ctx} />}
    {tab === 'sell' && <Sell c={ctx} />}
    {tab === 'collect' && <Collect c={ctx} />}
    {tab === 'margin' && <Margin c={ctx} />}
  </div>;
}

function useList(path: string, key: string, n: number): any[] {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api(path).then(x => setRows(x[key] || [])).catch(() => setRows([])); }, [path, n]);
  return rows;
}

const opts = (rows: any[], text: (x: any) => string): [number, string][] => rows.map(x => [x.id, text(x)]);

// ------------------------------------------------------------------ vendors, audits, customers, settings

function Masters({ c }: { c: Ctx }) {
  const vendors = useList('/api/trading/vendors', 'vendors', c.n);
  const customers = useList('/api/trading/customers', 'customers', c.n);
  const [vendor, setVendor] = useState<any>(null);
  const [customer, setCustomer] = useState<any>(null);
  const [auditFor, setAuditFor] = useState<any>(null);
  const audits = useList(`/api/trading/audits${auditFor ? `?vendorId=${auditFor.id}` : ''}`, 'audits', c.n);
  const save = (path: string, id: number | undefined, b: Record<string, unknown>, done: () => void) =>
    c.r.run(() => (id ? put(`${path}/${id}`, b) : post(path, b))).then(x => { if (x) { done(); c.reload(); } });
  return <>
    <Section title="Vendors (brands)" right={c.canEdit ? <button className={btnLight} onClick={() => setVendor({})}>Add vendor</button> : null}>
      <Grid rows={vendors} empty="No vendor yet." onRow={x => setAuditFor(x)} selected={auditFor?.id} cols={[
        { key: 'code', title: 'Code' }, { key: 'name', title: 'Name' }, { key: 'gstin', title: 'GSTIN' },
        { key: 'auditStatus', title: 'Audit', render: x => <Pill s={x.auditStatus} /> }, { key: 'nextAuditDue', title: 'Next audit', render: x => day(x.nextAuditDue) },
        { key: 'e', title: '', render: x => c.canEdit ? <button className={btnLight} onClick={e => { e.stopPropagation(); setVendor(x); }}>Edit</button> : null },
      ]} />
      {vendor && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm key={vendor.id ?? 'new'} initial={vendor} busy={c.r.busy} submitText="Save vendor" onCancel={() => setVendor(null)} cols={4}
        onSubmit={v => save('/api/trading/vendors', vendor.id, v, () => setVendor(null))} fields={[
          { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'gstin', label: 'GSTIN' }, { name: 'stateCode', label: 'State code' },
          { name: 'contactName', label: 'Contact' }, { name: 'phone', label: 'Phone' }, { name: 'email', label: 'Email' }, { name: 'paymentTermsDays', label: 'Days to pay', type: 'number' },
          { name: 'partnerId', label: 'Partner in the warehouse (if any)', type: 'select', options: opts(c.look.partners, x => x.name) },
          { name: 'address', label: 'Address', wide: true },
        ]} /></div>}
    </Section>
    {auditFor && <Section title={`Audits of ${auditFor.name}`} right={c.canEdit ? <AuditButton c={c} vendor={auditFor} /> : null}>
      <Grid rows={audits} empty="No audit yet. A vendor without a passed audit cannot get a purchase order sent." cols={[
        { key: 'auditDate', title: 'Date', render: x => day(x.auditDate) }, { key: 'auditorName', title: 'Auditor' }, { key: 'scope', title: 'Scope' },
        { key: 'score', title: 'Score', right: true }, { key: 'result', title: 'Result', render: x => <Pill s={x.result} /> }, { key: 'findings', title: 'Findings' },
        { key: 'closed', title: 'Closed', render: x => x.closedAt ? `${day(x.closedAt)} ${x.closingNote ?? ''}` : (c.canEdit && x.result !== 'PASS'
          ? <button className={btnLight} onClick={() => { const note = ask('What was done about the findings?'); if (note) c.r.run(() => post(`/api/trading/audits/${x.id}/close`, { note })).then(o => o && c.reload()); }}>Close</button> : '') },
      ]} />
    </Section>}
    <Section title="Customers (stores and distributors)" right={c.canEdit ? <button className={btnLight} onClick={() => setCustomer({ kind: 'STORE' })}>Add customer</button> : null}>
      <Grid rows={customers} empty="No customer yet." cols={[
        { key: 'code', title: 'Code' }, { key: 'name', title: 'Name' }, { key: 'kind', title: 'Kind' }, { key: 'city', title: 'City' }, { key: 'gstin', title: 'GSTIN' },
        { key: 'creditLimit', title: 'Credit limit', right: true, render: x => (x.creditLimit == null ? 'No limit' : inr(x.creditLimit)) },
        { key: 'paymentTermsDays', title: 'Days to pay', right: true },
        { key: 'e', title: '', render: x => c.canEdit ? <button className={btnLight} onClick={() => setCustomer(x)}>Edit</button> : null },
      ]} />
      {customer && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm key={customer.id ?? 'new'} initial={customer} busy={c.r.busy} submitText="Save customer" onCancel={() => setCustomer(null)} cols={4}
        onSubmit={v => save('/api/trading/customers', customer.id, v, () => setCustomer(null))} fields={[
          { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true },
          { name: 'kind', label: 'Kind', type: 'select', required: true, options: [['STORE', 'Store'], ['DISTRIBUTOR', 'Distributor'], ['INSTITUTION', 'Institution'], ['OTHER', 'Other']] },
          { name: 'gstin', label: 'GSTIN' }, { name: 'stateCode', label: 'State code' }, { name: 'city', label: 'City' }, { name: 'contactName', label: 'Contact' }, { name: 'phone', label: 'Phone' },
          { name: 'email', label: 'Email' }, { name: 'creditLimit', label: 'Credit limit (empty = none)', type: 'number' }, { name: 'paymentTermsDays', label: 'Days to pay', type: 'number' },
          { name: 'allowedOverdueDays', label: 'Overdue days allowed', type: 'number' }, { name: 'address', label: 'Address', wide: true },
        ]} /></div>}
    </Section>
    <Section title="Settings">
      {c.canEdit ? <QuickForm key={JSON.stringify(c.settings)} initial={c.settings} busy={c.r.busy} submitText="Save settings" cols={4}
        onSubmit={v => c.r.run(() => put('/api/trading/settings', v)).then(x => x && c.reload())} fields={[
          { name: 'ownPartnerId', label: 'RefTech as a partner in the warehouse', type: 'select', options: opts(c.look.partners, x => x.name), hint: 'Purchase orders are announced and invoices are picked under this partner.' },
          { name: 'sellerName', label: 'Seller name' }, { name: 'sellerGstin', label: 'Seller GSTIN' }, { name: 'sellerStateCode', label: 'Seller state code' },
          { name: 'poPrefix', label: 'PO series' }, { name: 'invoicePrefix', label: 'Invoice series' }, { name: 'paymentTermsDays', label: 'Default days to pay', type: 'number' },
          { name: 'minMarginPct', label: 'Lowest margin % (warn below)', type: 'number' }, { name: 'minLifePct', label: 'Least shelf life left to sell (%)', type: 'number' },
          { name: 'sellerAddress', label: 'Seller address', wide: true },
        ]} /> : <Info items={[['Seller', c.settings.sellerName], ['GSTIN', c.settings.sellerGstin], ['Lowest margin %', c.settings.minMarginPct], ['Days to pay', c.settings.paymentTermsDays]]} />}
    </Section>
  </>;
}

function AuditButton({ c, vendor }: { c: Ctx; vendor: any }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className={btnLight} onClick={() => setOpen(true)}>Record audit</button>;
  return <div className="w-full rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Save audit" onCancel={() => setOpen(false)} cols={4}
    onSubmit={v => c.r.run(() => post(`/api/trading/vendors/${vendor.id}/audits`, v)).then(x => { if (x) { setOpen(false); c.reload(); } })} fields={[
      { name: 'auditDate', label: 'Date', type: 'date', required: true }, { name: 'auditorName', label: 'Auditor', required: true }, { name: 'scope', label: 'Scope' },
      { name: 'score', label: 'Score (0-100)', type: 'number' },
      { name: 'result', label: 'Result', type: 'select', required: true, options: [['PASS', 'Pass'], ['CONDITIONAL', 'Conditional'], ['FAIL', 'Fail (blocks orders)']] },
      { name: 'nextAuditDue', label: 'Next audit by', type: 'date' }, { name: 'closeBy', label: 'Findings to be closed by', type: 'date' },
      { name: 'findings', label: 'Findings', type: 'textarea', wide: true }, { name: 'correctiveAction', label: 'Corrective action', type: 'textarea', wide: true },
    ]} /></div>;
}

// ------------------------------------------------------------------ order lines (purchase and sales)

function Lines({ lines, setLines, products, sale }: { lines: Line[]; setLines: (l: Line[]) => void; products: any[]; sale?: boolean }) {
  const set = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const p = preview(lines);
  return <div className="mt-2 space-y-2">
    {lines.map((l, i) => <div key={i} className="grid gap-2 md:grid-cols-6">
      <select className={`${input} md:col-span-2`} value={l.productId} onChange={e => set(i, 'productId', e.target.value)} aria-label="Product">
        <option value="">Product</option>{products.map(x => <option key={x.id} value={x.id}>{x.code} {x.name}</option>)}</select>
      <input className={input} type="number" step="any" placeholder="Quantity" value={l.quantity} onChange={e => set(i, 'quantity', e.target.value)} />
      <input className={input} type="number" step="any" placeholder={sale ? 'Price' : 'Cost'} value={l.price} onChange={e => set(i, 'price', e.target.value)} />
      {sale ? <input className={input} type="number" step="any" placeholder="Discount %" value={l.discountPct ?? ''} onChange={e => set(i, 'discountPct', e.target.value)} /> : <span className="self-center text-sm text-slate-600">{inr(lineValue(l))}</span>}
      <input className={input} type="number" step="any" placeholder="GST %" value={l.gstRate} onChange={e => set(i, 'gstRate', e.target.value)} />
    </div>)}
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <button type="button" className={btnLight} onClick={() => setLines([...lines, { productId: '', quantity: '', price: '', gstRate: lines[lines.length - 1]?.gstRate || '18' }])}>Add line</button>
      <span>Taxable {inr(p.taxable)} · GST {inr(p.gst)} · <b>Total {inr(p.total)}</b></span>
    </div>
  </div>;
}

const newLines = (): Line[] => [{ productId: '', quantity: '', price: '', gstRate: '18' }];

// ------------------------------------------------------------------ purchase orders

function Buy({ c }: { c: Ctx }) {
  const [filter, setFilter] = useState('');
  const orders = useList(`/api/trading/purchase-orders?status=${filter}`, 'orders', c.n);
  const vendors = useList('/api/trading/vendors', 'vendors', c.n);
  const [sel, setSel] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>(newLines());
  const open = (id: number) => c.r.run(() => api(`/api/trading/purchase-orders/${id}`)).then(x => x && setSel(x));
  const act = (path: string, body?: unknown) => c.r.run(() => post(path, body)).then(x => { if (x && sel) { open(sel.id); c.reload(); } });
  return <>
    <Section title="Purchase orders" right={<div className="flex gap-2">
      <select className={`${input} w-auto`} value={filter} onChange={e => setFilter(e.target.value)} aria-label="Status">
        {['', 'DRAFT', 'SENT', 'PART_RECEIVED', 'RECEIVED', 'CANCELLED'].map(s => <option key={s} value={s}>{s || 'All'}</option>)}</select>
      {c.canEdit && <button className={btnLight} onClick={() => { setForm({}); setLines(newLines()); }}>New purchase order</button>}</div>}>
      {form && <div className="mb-4 rounded-xl bg-slate-50 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className={label}>Vendor</span><select className={input} value={form.vendorId ?? ''} onChange={e => setForm({ ...form, vendorId: e.target.value })}>
            <option value="">Choose</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.auditStatus})</option>)}</select></label>
          <label className="text-sm"><span className={label}>Deliver to warehouse</span><select className={input} value={form.warehouseId ?? ''} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">Choose</option>{c.look.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="text-sm"><span className={label}>Expected on</span><input className={input} type="date" value={form.expectedDate ?? ''} onChange={e => setForm({ ...form, expectedDate: e.target.value })} /></label>
        </div>
        <Lines lines={lines} setLines={setLines} products={c.look.products} />
        <div className="mt-3 flex gap-2">
          <button className={btn} disabled={c.r.busy} onClick={() => c.r.run(() => post('/api/trading/purchase-orders', { vendorId: Number(form.vendorId) || null, warehouseId: Number(form.warehouseId) || null, expectedDate: form.expectedDate || null, lines: linesToSend(lines, 'PO') }))
            .then(x => { if (x) { setForm(null); c.reload(); open(x.id); } })}>Save as draft</button>
          <button className={btnLight} onClick={() => setForm(null)}>Cancel</button>
        </div>
      </div>}
      <Grid rows={orders} empty="No purchase order." onRow={x => open(x.id)} selected={sel?.id} cols={[
        { key: 'poNo', title: 'PO' }, { key: 'orderDate', title: 'Date', render: x => day(x.orderDate) }, { key: 'vendorName', title: 'Vendor' },
        { key: 'warehouseName', title: 'Warehouse' }, { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.poNo} <Pill s={sel.status} /></>}>
      <Info items={[['Vendor', sel.vendorName], ['Warehouse', sel.warehouseName], ['Expected', day(sel.expectedDate)], ['Value', inr(sel.totalValue)], ['Inbound notice', sel.inboundNoticeId ? `#${sel.inboundNoticeId}` : '-'], ['Sent', day(sel.sentAt)]]} />
      <Grid rows={sel.lines || []} empty="" cols={[
        { key: 'lineNo', title: '#' }, { key: 'p', title: 'Product', render: x => `${x.productCode} ${x.productName}` },
        { key: 'quantity', title: 'Ordered', right: true, render: x => qty(x.quantity) }, { key: 'receivedQty', title: 'Received', right: true, render: x => qty(x.receivedQty) },
        { key: 'unitCost', title: 'Cost', right: true, render: x => inr(x.unitCost) }, { key: 'lineValue', title: 'Value', right: true, render: x => inr(x.lineValue) },
      ]} />
      {c.canEdit && <div className="mt-3 flex flex-wrap gap-2">
        {sel.status === 'DRAFT' && <button className={btn} disabled={c.r.busy} onClick={() => act(`/api/trading/purchase-orders/${sel.id}/send`)}>Send to vendor</button>}
        {['DRAFT', 'SENT'].includes(sel.status) && <button className={btnLight} onClick={() => { const reason = ask('Why is the order cancelled?'); if (reason) act(`/api/trading/purchase-orders/${sel.id}/cancel`, { reason }); }}>Cancel order</button>}
      </div>}
      {c.canEdit && ['SENT', 'PART_RECEIVED'].includes(sel.status) && <Receive c={c} po={sel} onDone={() => { open(sel.id); c.reload(); }} />}
      {(sel.receipts || []).length > 0 && <><h3 className="mt-4 font-bold">Goods received</h3>
        <Grid rows={sel.receipts} empty="" cols={[{ key: 'grnNo', title: 'GRN' }, { key: 'receiptDate', title: 'Date', render: x => day(x.receiptDate) }, { key: 'vendorInvoiceNo', title: 'Vendor invoice' },
          { key: 'freightCost', title: 'Freight', right: true, render: x => inr(x.freightCost) }, { key: 'totalValue', title: 'Stock value', right: true, render: x => inr(x.totalValue) }]} /></>}
    </Section>}
  </>;
}

function Receive({ c, po, onDone }: { c: Ctx; po: any; onDone: () => void }) {
  const open = (po.lines || []).filter((l: any) => Number(l.quantity) > Number(l.receivedQty));
  const [rows, setRows] = useState<Record<number, { quantity: string; batchNo: string; expiryDate: string }>>({});
  const [head, setHead] = useState({ receiptDate: new Date().toISOString().slice(0, 10), vendorInvoiceNo: '', freightCost: '' });
  const v = (id: number) => rows[id] || { quantity: '', batchNo: '', expiryDate: '' };
  const set = (id: number, k: string, val: string) => setRows({ ...rows, [id]: { ...v(id), [k]: val } });
  const send = () => c.r.run(() => post(`/api/trading/purchase-orders/${po.id}/receive`, {
    ...head, freightCost: head.freightCost === '' ? 0 : Number(head.freightCost),
    lines: open.filter((l: any) => Number(v(l.id).quantity) > 0).map((l: any) => ({ poLineId: l.id, quantity: Number(v(l.id).quantity), batchNo: v(l.id).batchNo, expiryDate: v(l.id).expiryDate || null })),
  })).then(x => x && onDone());
  return <div className="mt-4 rounded-xl bg-slate-50 p-3">
    <h3 className="font-bold">Receive goods</h3>
    <div className="mt-2 grid gap-2 md:grid-cols-3">
      <label className="text-sm"><span className={label}>Date</span><input className={input} type="date" value={head.receiptDate} onChange={e => setHead({ ...head, receiptDate: e.target.value })} /></label>
      <label className="text-sm"><span className={label}>Vendor invoice no.</span><input className={input} value={head.vendorInvoiceNo} onChange={e => setHead({ ...head, vendorInvoiceNo: e.target.value })} /></label>
      <label className="text-sm"><span className={label}>Freight (shared by value)</span><input className={input} type="number" step="any" value={head.freightCost} onChange={e => setHead({ ...head, freightCost: e.target.value })} /></label>
    </div>
    {open.map((l: any) => <div key={l.id} className="mt-2 grid items-center gap-2 md:grid-cols-4">
      <span className="text-sm">{l.productCode} {l.productName} <span className="text-slate-500">({qty(Number(l.quantity) - Number(l.receivedQty))} open)</span></span>
      <input className={input} type="number" step="any" placeholder="Quantity" value={v(l.id).quantity} onChange={e => set(l.id, 'quantity', e.target.value)} />
      <input className={input} placeholder="Batch" value={v(l.id).batchNo} onChange={e => set(l.id, 'batchNo', e.target.value)} />
      <input className={input} type="date" value={v(l.id).expiryDate} onChange={e => set(l.id, 'expiryDate', e.target.value)} aria-label="Expiry date" />
    </div>)}
    <button className={`${btn} mt-3`} disabled={c.r.busy} onClick={send}>Receive into stock</button>
  </div>;
}

// ------------------------------------------------------------------ stock

function Stock({ c }: { c: Ctx }) {
  const [wh, setWh] = useState('');
  const [data, setData] = useState<any>({ lots: [] });
  useEffect(() => { api(`/api/trading/stock${wh ? `?warehouseId=${wh}` : ''}`).then(setData).catch(x => c.r.setError((x as Error).message)); }, [wh, c.n]);
  return <Section title={<>Trading stock <span className="text-base font-normal text-slate-600">value {inr(data.totalValue)}</span></>} right={
    <select className={`${input} w-auto`} value={wh} onChange={e => setWh(e.target.value)} aria-label="Warehouse"><option value="">Every warehouse</option>
      {c.look.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}>
    <Grid rows={data.lots || []} empty="No trading stock." cols={[
      { key: 'p', title: 'Product', render: x => `${x.productCode} ${x.productName}` }, { key: 'warehouseName', title: 'Warehouse' }, { key: 'batchNo', title: 'Batch' },
      { key: 'expiryDate', title: 'Expiry', render: x => day(x.expiryDate) }, { key: 'daysLeft', title: 'Days left', right: true, render: x => <span className={Number(x.daysLeft) < 30 ? 'font-bold text-red-700' : ''}>{x.daysLeft ?? '-'}</span> },
      { key: 'onHand', title: 'On hand', right: true, render: x => qty(x.onHand) }, { key: 'unitCost', title: 'Landed cost', right: true, render: x => inr(x.unitCost) },
      { key: 'stockValue', title: 'Value', right: true, render: x => inr(x.stockValue) }, { key: 'state', title: 'State', render: x => <Pill s={x.state} /> },
    ]} />
  </Section>;
}

// ------------------------------------------------------------------ sales orders and invoices

function Sell({ c }: { c: Ctx }) {
  const orders = useList('/api/trading/sales-orders', 'orders', c.n);
  const invoices = useList('/api/trading/invoices', 'invoices', c.n);
  const customers = useList('/api/trading/customers', 'customers', c.n);
  const [sel, setSel] = useState<any>(null);
  const [inv, setInv] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>(newLines());
  const open = (id: number) => c.r.run(() => api(`/api/trading/sales-orders/${id}`)).then(x => x && setSel(x));
  const openInv = (id: number) => c.r.run(() => api(`/api/trading/invoices/${id}`)).then(x => x && setInv(x));
  const act = (path: string, body?: unknown) => c.r.run(() => post(path, body)).then(x => { if (x) { if (sel) open(sel.id); c.reload(); if (x.invoiceNo) openInv(x.id); } });
  return <>
    <Section title="Sales orders" right={c.canEdit ? <button className={btnLight} onClick={() => { setForm({}); setLines(newLines()); }}>New sales order</button> : null}>
      {form && <div className="mb-4 rounded-xl bg-slate-50 p-3">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm"><span className={label}>Customer</span><select className={input} value={form.customerId ?? ''} onChange={e => setForm({ ...form, customerId: e.target.value })}>
            <option value="">Choose</option>{customers.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
          <label className="text-sm"><span className={label}>From warehouse</span><select className={input} value={form.warehouseId ?? ''} onChange={e => setForm({ ...form, warehouseId: e.target.value })}>
            <option value="">Choose</option>{c.look.warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <label className="text-sm"><span className={label}>Customer PO no.</span><input className={input} value={form.customerPoNo ?? ''} onChange={e => setForm({ ...form, customerPoNo: e.target.value })} /></label>
        </div>
        <Lines lines={lines} setLines={setLines} products={c.look.products} sale />
        <div className="mt-3 flex gap-2">
          <button className={btn} disabled={c.r.busy} onClick={() => c.r.run(() => post('/api/trading/sales-orders', { customerId: Number(form.customerId) || null, warehouseId: Number(form.warehouseId) || null, customerPoNo: form.customerPoNo || null, lines: linesToSend(lines, 'SO') }))
            .then(x => { if (x) { setForm(null); c.reload(); open(x.id); } })}>Save as draft</button>
          <button className={btnLight} onClick={() => setForm(null)}>Cancel</button>
        </div>
      </div>}
      <Grid rows={orders} empty="No sales order." onRow={x => open(x.id)} selected={sel?.id} cols={[
        { key: 'soNo', title: 'Order' }, { key: 'orderDate', title: 'Date', render: x => day(x.orderDate) }, { key: 'customerName', title: 'Customer' },
        { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }, { key: 'holdReason', title: 'Hold reason' },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.soNo} <Pill s={sel.status} /></>}>
      <Info items={[['Customer', sel.customerName], ['Warehouse', sel.warehouseName], ['Value', inr(sel.totalValue)], ['Hold reason', sel.holdReason]]} />
      <Grid rows={sel.lines || []} empty="" cols={[
        { key: 'p', title: 'Product', render: x => `${x.productCode} ${x.productName}` }, { key: 'quantity', title: 'Quantity', right: true, render: x => qty(x.quantity) },
        { key: 'unitPrice', title: 'Price', right: true, render: x => inr(x.unitPrice) }, { key: 'discountPct', title: 'Disc. %', right: true }, { key: 'gstRate', title: 'GST %', right: true },
        { key: 'lineValue', title: 'Value', right: true, render: x => inr(x.lineValue) },
      ]} />
      {c.canEdit && <div className="mt-3 flex flex-wrap gap-2">
        {sel.status === 'DRAFT' && <button className={btn} disabled={c.r.busy} onClick={() => act(`/api/trading/sales-orders/${sel.id}/confirm`)}>Confirm (credit check)</button>}
        {sel.status === 'CREDIT_HOLD' && c.manager && <button className={btn} disabled={c.r.busy} onClick={() => { const note = ask('Why may this order go ahead?'); if (note) act(`/api/trading/sales-orders/${sel.id}/release`, { note }); }}>Release credit hold</button>}
        {sel.status === 'CONFIRMED' && <button className={btn} disabled={c.r.busy} onClick={() => act(`/api/trading/sales-orders/${sel.id}/invoice`, {})}>Make GST invoice</button>}
        {['DRAFT', 'CREDIT_HOLD', 'CONFIRMED'].includes(sel.status) && <button className={btnLight} onClick={() => { const reason = ask('Why is the order cancelled?'); if (reason) act(`/api/trading/sales-orders/${sel.id}/cancel`, { reason }); }}>Cancel order</button>}
      </div>}
    </Section>}
    <Section title="Invoices">
      <Grid rows={invoices} empty="No invoice yet." onRow={x => openInv(x.id)} selected={inv?.id} cols={[
        { key: 'invoiceNo', title: 'Invoice' }, { key: 'invoiceDate', title: 'Date', render: x => day(x.invoiceDate) }, { key: 'customerName', title: 'Customer' },
        { key: 'totalAmount', title: 'Total', right: true, render: x => inr(x.totalAmount) }, { key: 'openAmount', title: 'Open', right: true, render: x => inr(x.openAmount) },
        { key: 'marginPct', title: 'Margin %', right: true, render: x => <span className={marginTone(x.marginPct, c.settings.minMarginPct)}>{x.marginPct ?? '-'}</span> },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
      ]} />
    </Section>
    {inv && <InvoiceView c={c} inv={inv} onChanged={() => { openInv(inv.id); c.reload(); }} />}
  </>;
}

function InvoiceView({ c, inv, onChanged }: { c: Ctx; inv: any; onChanged: () => void }) {
  return <Section title={<>Tax invoice {inv.invoiceNo} <Pill s={inv.status} /></>} right={<div className="flex gap-2">
    <button className={btnLight} onClick={() => window.print()}>Print</button>
    {c.canEdit && inv.status !== 'CANCELLED' && Number(inv.paidAmount || 0) === 0 && <button className={btnLight} onClick={() => { const reason = ask('Why is the invoice cancelled? The stock goes back.'); if (reason) c.r.run(() => post(`/api/trading/invoices/${inv.id}/cancel`, { reason })).then(x => x && onChanged()); }}>Cancel invoice</button>}</div>}>
    <Info items={[['Seller', `${inv.sellerName ?? ''} ${inv.sellerGstin ? `(GSTIN ${inv.sellerGstin})` : ''}`], ['Buyer', `${inv.buyerName ?? ''} ${inv.buyerGstin ? `(GSTIN ${inv.buyerGstin})` : ''}`],
      ['Date', day(inv.invoiceDate)], ['Due', day(inv.dueDate)], ['Place of supply', inv.placeOfSupply], ['Order', inv.soNo],
      ['Taxable', inr(inv.taxableValue)], ['CGST', inr(inv.cgstAmount)], ['SGST', inr(inv.sgstAmount)], ['IGST', inr(inv.igstAmount)], ['Round off', inr(inv.roundOff)], ['Total', <b>{inr(inv.totalAmount)}</b>],
      ['Cost', inr(inv.costValue)], ['Margin', inr(inv.marginValue)], ['Paid', inr(inv.paidAmount)], ['In words', inv.amountInWords]]} />
    <Grid rows={inv.lines || []} empty="" cols={[
      { key: 'item', title: 'Item', render: x => `${x.productCode} ${x.productName}` }, { key: 'hsnCode', title: 'HSN' }, { key: 'batchNo', title: 'Batch' }, { key: 'expiryDate', title: 'Expiry', render: x => day(x.expiryDate) },
      { key: 'quantity', title: 'Qty', right: true, render: x => qty(x.quantity) }, { key: 'unitPrice', title: 'Rate', right: true, render: x => inr(x.unitPrice) },
      { key: 'taxableValue', title: 'Taxable', right: true, render: x => inr(x.taxableValue) }, { key: 'gstRate', title: 'GST %', right: true }, { key: 'lineTotal', title: 'Total', right: true, render: x => inr(Number(x.taxableValue || 0) + Number(x.cgstAmount || 0) + Number(x.sgstAmount || 0) + Number(x.igstAmount || 0)) },
    ]} />
  </Section>;
}

// ------------------------------------------------------------------ collections

function Collect({ c }: { c: Ctx }) {
  const receipts = useList('/api/trading/receipts', 'receipts', c.n);
  const out = useList('/api/trading/outstanding', 'customers', c.n);
  const customers = useList('/api/trading/customers', 'customers', c.n);
  const tot = ageingTotals(out);
  return <>
    <Section title="Outstanding and ageing">
      <Grid rows={out} empty="Nothing is outstanding." cols={[
        { key: 'customerName', title: 'Customer' }, { key: 'creditLimit', title: 'Limit', right: true, render: x => (x.creditLimit == null ? '-' : inr(x.creditLimit)) },
        ...AGEING.map(b => ({ key: b, title: b === 'NOT_DUE' ? 'Not due' : `${b} days`, right: true, render: (x: any) => inr(x[b]) })),
        { key: 'total', title: 'Total', right: true, render: x => <b>{inr(x.total)}</b> },
      ]} />
      {out.length > 1 && <p className="mt-2 text-sm">All customers: <b>{inr(tot.total)}</b>, of which overdue more than 30 days {inr(tot['31-60'] + tot['61-90'] + tot['90+'])}.</p>}
    </Section>
    <Section title="Receipts">
      {c.canEdit && <div className="mb-3 rounded-xl bg-slate-50 p-3"><QuickForm busy={c.r.busy} submitText="Record receipt" cols={4}
        onSubmit={(v, f) => c.r.run(() => post('/api/trading/receipts', v)).then(x => { if (x) { f.reset(); c.reload(); } })} fields={[
          { name: 'customerId', label: 'Customer', type: 'select', required: true, options: opts(customers, x => x.name) }, { name: 'amount', label: 'Amount', type: 'number', required: true },
          { name: 'receiptDate', label: 'Date', type: 'date', required: true }, { name: 'mode', label: 'Mode', type: 'select', required: true, options: [['NEFT', 'NEFT / RTGS'], ['UPI', 'UPI'], ['CHEQUE', 'Cheque'], ['CASH', 'Cash']] },
          { name: 'reference', label: 'UTR / cheque no.' },
        ]} /><p className="mt-1 text-xs text-slate-500">The money is set against the customer's oldest open invoices first.</p></div>}
      <Grid rows={receipts} empty="No receipt yet." cols={[
        { key: 'receiptNo', title: 'Receipt' }, { key: 'receiptDate', title: 'Date', render: x => day(x.receiptDate) }, { key: 'customerName', title: 'Customer' },
        { key: 'mode', title: 'Mode' }, { key: 'reference', title: 'Reference' }, { key: 'amount', title: 'Amount', right: true, render: x => inr(x.amount) },
        { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
        { key: 'a', title: '', render: x => c.canEdit && x.status !== 'REVERSED' ? <button className={btnLight} onClick={() => { const reason = ask('Why is the receipt reversed (bounced cheque ...)?'); if (reason) c.r.run(() => post(`/api/trading/receipts/${x.id}/reverse`, { reason })).then(o => o && c.reload()); }}>Reverse</button> : null },
      ]} />
    </Section>
  </>;
}

// ------------------------------------------------------------------ margin

function Margin({ c }: { c: Ctx }) {
  const today = new Date().toISOString().slice(0, 10);
  const [by, setBy] = useState<'product' | 'customer'>('product');
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [data, setData] = useState<any>({ rows: [] });
  useEffect(() => { api(`/api/trading/margin?by=${by}&from=${from}&to=${to}`).then(setData).catch(x => c.r.setError((x as Error).message)); }, [by, from, to, c.n]);
  return <Section title="Margin" right={<div className="flex flex-wrap gap-2">
    <select className={`${input} w-auto`} value={by} onChange={e => setBy(e.target.value as 'product' | 'customer')} aria-label="By"><option value="product">By product</option><option value="customer">By customer</option></select>
    <input className={`${input} w-auto`} type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From" />
    <input className={`${input} w-auto`} type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To" /></div>}>
    <Grid rows={data.rows || []} empty="No sale in the period." cols={[
      { key: 'label', title: by === 'product' ? 'Product' : 'Customer' }, ...(by === 'product' ? [{ key: 'quantity', title: 'Quantity', right: true, render: (x: any) => qty(x.quantity) }] : []),
      { key: 'sales', title: 'Sales (taxable)', right: true, render: x => inr(x.sales) }, { key: 'cost', title: 'Cost', right: true, render: x => inr(x.cost) },
      { key: 'margin', title: 'Margin', right: true, render: x => inr(x.margin) },
      { key: 'marginPct', title: 'Margin %', right: true, render: x => <span className={marginTone(x.marginPct, c.settings.minMarginPct)}>{x.marginPct ?? '-'}</span> },
    ]} />
    {(data.rows || []).length > 0 && <p className="mt-2 text-sm">Total sales {inr(data.sales)}, cost {inr(data.cost)}, margin <b>{inr(data.margin)}</b> ({data.marginPct ?? '-'} %).</p>}
  </Section>;
}
