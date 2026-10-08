/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-020 -- Bonded Warehouse: a warehouse or a chamber marked as a customs bonded warehouse (licence), goods in
// bond with the bill of entry, duty and bond expiry (their pallets go ON HOLD, so they are never allotted, picked
// or dispatched for sale), ex-bond release with the duty paid document, the bond register in customs format
// (Form A order, CSV) and the EXIM documents and packing list of an export order.
// Reading: staff (WAREHOUSE_VIEW); a Partner login sees its own goods in bond. Changing: permission WAREHOUSE_BOND.
//
// Backend: BondController (/api/warehouse/bonded/**).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Landmark } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, num, pill, printHtml, when, who } from './wms';
import { Table, Tabs, codes, monthStart, opts, post, put, today, usePartners, useRunner, useWarehouses } from './wmsOps';
import { BOND_SCRIPT, bondExpiry, dutyShare, releaseProblem, rupees, words } from './bondPlantPlug';

const API = '/api/warehouse/bonded';
const LICENCE: [string, string][] = [['PRIVATE', 'Private (Section 58)'], ['PUBLIC', 'Public (Section 57)'], ['SPECIAL', 'Special (Section 58A)']];

async function fileData(f: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Could not read the file'));
    r.readAsDataURL(f);
  });
}

async function openFile(path: string, download?: string) {
  const token = localStorage.getItem('reftech_token');
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`Could not open the file (${res.status})`);
  const url = URL.createObjectURL(await res.blob());
  if (!download) { window.open(url, '_blank'); return; }
  const a = document.createElement('a'); a.href = url; a.download = download; a.click();
}

export function BondedWarehousePage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [o, setO] = useState<any>(null);
  const [tab, setTab] = useState('entries');
  const [status, setStatus] = useState('OPEN');
  const [q, setQ] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const chambers = useMemo(() => warehouses.flatMap((w: any) => (w.chambers || []).map((c: any) => ({ ...c, warehouseName: w.name }))), [warehouses]);

  const load = useCallback(async () => {
    try {
      const op = await api(`${API}/options`); setO(op);
      if (op.ready === false) return;
      const d = await api(`${API}/entries?status=${status}&q=${encodeURIComponent(q)}`); setEntries(d.entries || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status, q]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`${API}/entries/${id}`)); if (d) setSel(d); };
  const changed = async (d?: any) => { await load(); if (sel || d?.id) await open(d?.id || sel.id); };

  if (!me.staff && !me.partner) return null;
  const can = !!o?.canChange;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Landmark className="h-8 w-8 text-sky-700" />Bonded Warehouse</h1>
    <p className="text-slate-600">Goods in customs bond: bill of entry, duty and bond expiry. Bonded pallets stay on hold until released ex-bond with the duty paid document.</p>
    <Banner msg={r.msg} error={r.error} />
    {o?.ready === false && <NotReady script={BOND_SCRIPT} />}
    {o?.ready && <>
      <Tabs value={tab} onChange={setTab} tabs={[['entries', 'Goods in bond'], ['register', 'Bond register'], ...(me.staff ? [['sites', 'Bonded sites'], ['exim', 'EXIM documents']] as [string, string][] : [])]} />

      {tab === 'entries' && <>
        {can && <Section title="Put goods in bond">
          {(o.sites || []).length === 0 ? <div className="text-slate-500">Mark a warehouse or chamber as bonded first (Bonded sites).</div> :
            <QuickForm cols={4} busy={r.busy} submitText="Put in bond" fields={[
              { name: 'bondSiteId', label: 'Bonded site', type: 'select', required: true, options: (o.sites || []).map((s: any) => [String(s.id), `${s.licenceNo} · ${s.warehouseName}${s.chamberName ? ' / ' + s.chamberName : ''}`]) },
              { name: 'partnerId', label: 'Importer', type: 'select', required: true, options: opts(partners) },
              { name: 'beNo', label: 'Bill of entry no.', required: true }, { name: 'beDate', label: 'BE date', type: 'date', required: true },
              { name: 'iecCode', label: 'IEC (10 characters)' }, { name: 'customsStation', label: 'Customs station', placeholder: 'e.g. INMAA1' },
              { name: 'description', label: 'Description of goods', required: true, wide: true },
              { name: 'hsCode', label: 'HS code' }, { name: 'originCountry', label: 'Country of origin' },
              { name: 'quantity', label: 'Quantity', type: 'number', required: true }, { name: 'uom', label: 'Unit', placeholder: 'KG' },
              { name: 'packages', label: 'Packages', type: 'number' }, { name: 'assessableValue', label: 'Assessable value (₹)', type: 'number', required: true },
              { name: 'dutyAmount', label: 'Duty (₹)', type: 'number', required: true }, { name: 'bondAmount', label: 'Bond amount (₹)', type: 'number' },
              { name: 'warehousedOn', label: 'Warehoused on', type: 'date', required: true },
              { name: 'bondExpiry', label: 'Bond expiry', type: 'date', hint: `Empty: ${o.defaultMonths} months from warehousing` },
              { name: 'containerNo', label: 'Container' }, { name: 'vessel', label: 'Vessel / flight' },
              { name: 'palletCodes', label: 'Pallets carrying the goods (scan or type)', type: 'textarea', wide: true }]}
              onSubmit={(v, f) => r.run(() => post(`${API}/entries`, { ...v, palletCodes: codes(v.palletCodes) }), async (d: any) => { f.reset(); await changed(d); })} />}
        </Section>}
        <Section title="Goods in bond" right={<div className="flex gap-2">
          <input className={input} placeholder="Bill of entry, container, goods" value={q} onChange={e => setQ(e.target.value)} />
          <select className={input} value={status} onChange={e => setStatus(e.target.value)}>
            {[['OPEN', 'In bond'], ['RELEASED', 'Released'], ['CANCELLED', 'Cancelled'], ['ALL', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>}>
          <Table rows={entries} selected={sel?.id} onRow={x => open(x.id)} empty="No goods in bond." cols={[
            { key: 'entryNo', label: 'Entry' }, { key: 'beNo', label: 'Bill of entry', render: x => `${x.beNo} · ${day(x.beDate)}` },
            { key: 'partnerName', label: 'Importer' }, { key: 'description', label: 'Goods' },
            { key: 'balance', label: 'In bond', right: true, render: x => `${num(x.balance)} / ${num(x.quantity)} ${x.uom}` },
            { key: 'dutyAmount', label: 'Duty', right: true, render: x => rupees(x.dutyAmount) },
            { key: 'bondExpiry', label: 'Bond expiry', render: x => { const e = bondExpiry(x.expiryState, x.daysToExpiry); return <>{day(x.bondExpiry)} <span className={e.style}>{e.text}</span></>; } },
            { key: 'palletsInBond', label: 'Pallets', right: true },
            { key: 'status', label: 'Status', render: x => <span className={pill(x.status === 'IN_BOND' ? 'HOLD' : x.status === 'PART_RELEASED' ? 'PICKING' : x.status)}>{words(x.status)}</span> },
          ]} />
        </Section>
        {sel && <EntryDetail sel={sel} can={can} staff={me.staff} r={r} tolerance={Number(o.dutyTolerance || 1)} onChanged={changed} />}
      </>}

      {tab === 'register' && <Register warehouses={warehouses} r={r} />}
      {tab === 'sites' && me.staff && <Sites o={o} can={can} warehouses={warehouses} chambers={chambers} r={r} onChanged={load} />}
      {tab === 'exim' && me.staff && <Exim can={can} r={r} entry={sel} />}
    </>}
  </>;
}

function EntryDetail({ sel, can, staff, r, tolerance, onChanged }: any) {
  const [qty, setQty] = useState('');
  const [type, setType] = useState('HOME_CONSUMPTION');
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState('');
  const open = ['IN_BOND', 'PART_RELEASED'].includes(sel.status);
  const dueBefore = (sel.releases || []).reduce((s: number, x: any) => s + Number(x.dutyDue || 0), 0);
  const due = dutyShare(Number(sel.quantity), Number(sel.dutyAmount), Number(sel.releasedQty), dueBefore, Number(qty), type);
  const exp = bondExpiry(sel.expiryState, sel.daysToExpiry);
  return <Section title={<>{sel.entryNo} · BE {sel.beNo} <span className={pill(sel.status === 'IN_BOND' ? 'HOLD' : sel.status)}>{words(sel.status)}</span></>}
    right={can && open && Number(sel.releasedQty) === 0 && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the entry cancelled?'); if (reason) void r.run(() => post(`${API}/entries/${sel.id}/cancel`, { reason }), onChanged); }}>Cancel entry</button>}>
    <div className="grid gap-1 text-sm md:grid-cols-3">
      <div>{sel.partnerName}{sel.iecCode ? ` · IEC ${sel.iecCode}` : ''}</div>
      <div>{sel.description}{sel.hsCode ? ` · HS ${sel.hsCode}` : ''}{sel.originCountry ? ` · ${sel.originCountry}` : ''}</div>
      <div>{sel.warehouseName}{sel.chamberName ? ` / ${sel.chamberName}` : ''} · licence {sel.licenceNo}</div>
      <div>Quantity {num(sel.quantity)} {sel.uom}{sel.packages ? ` in ${sel.packages} packages` : ''} · released {num(sel.releasedQty)} · <b>in bond {num(sel.balance)}</b></div>
      <div>Value {rupees(sel.assessableValue)} · duty {rupees(sel.dutyAmount)} · paid {rupees(sel.dutyPaidTotal)}</div>
      <div>Warehoused {day(sel.warehousedOn)} · expiry <b>{day(sel.bondExpiry)}</b> <span className={exp.style}>{exp.text}</span></div>
      {(sel.containerNo || sel.vessel) && <div>Container {sel.containerNo || '-'} · {sel.vessel || ''}</div>}
      {sel.cancelledReason && <div className="text-red-700">Cancelled: {sel.cancelledReason}</div>}
    </div>
    <div className="mt-3 grid gap-4 md:grid-cols-2">
      <div><div className="font-semibold">Pallets</div>
        <Table rows={sel.pallets || []} empty="No pallets yet." cols={[
          { key: 'palletCode', label: 'Pallet' }, { key: 'batchNo', label: 'Batch' }, { key: 'quantity', label: 'Qty', right: true, render: x => num(x.quantity) },
          { key: 'stockState', label: 'State', render: x => <span className={pill(x.stockState)}>{x.stockState}</span> },
          { key: 'releasedAt', label: 'Released', render: x => x.releasedAt ? `${x.releaseNo || ''} ${when(x.releasedAt)}` : 'in bond' },
        ]} />
        {can && open && <div className="mt-2"><QuickForm cols={2} busy={r.busy} submitText="Add pallets" fields={[{ name: 'palletCodes', label: 'Pallets', type: 'textarea', wide: true }]}
          onSubmit={(v, f) => r.run(() => post(`${API}/entries/${sel.id}/pallets`, { palletCodes: codes(v.palletCodes) }), async () => { f.reset(); await onChanged(); })} /></div>}
      </div>
      <div><div className="font-semibold">Ex-bond releases</div>
        <Table rows={sel.releases || []} empty="Nothing released yet." cols={[
          { key: 'releaseNo', label: 'Release' }, { key: 'releaseType', label: 'Type', render: x => words(x.releaseType) },
          { key: 'docNo', label: 'Document', render: x => `${x.docNo} · ${day(x.docDate)}` }, { key: 'quantity', label: 'Qty', right: true, render: x => num(x.quantity) },
          { key: 'dutyPaid', label: 'Duty paid', right: true, render: x => rupees(x.dutyPaid) },
          { key: 'dutyDocName', label: 'Duty paid doc', render: x => x.dutyDocName ? <button className="text-sky-700 underline" onClick={() => openFile(`${API}/releases/${x.id}/document`).catch(e => r.setError(e.message))}>{x.dutyDocName}</button> : '-' },
        ]} />
      </div>
    </div>
    {can && open && <div className="mt-4 rounded-xl bg-slate-50 p-3">
      <div className="mb-1 font-semibold">Release ex-bond</div>
      <div className="mb-2 grid gap-3 md:grid-cols-4">
        <label className="text-sm">Release<select className={input} value={type} onChange={e => setType(e.target.value)}>
          <option value="HOME_CONSUMPTION">Home consumption (duty paid)</option><option value="RE_EXPORT">Re-export (no duty)</option></select></label>
        <label className="text-sm">Quantity ({sel.uom}, in bond {num(sel.balance)})<input className={input} type="number" step="any" value={qty} onChange={e => setQty(e.target.value)} /></label>
        <div className="text-sm">Duty due on this quantity<div className="text-lg font-bold">{rupees(due)}</div></div>
        {type === 'HOME_CONSUMPTION' && <label className="text-sm">Duty paid document (PDF or photo)<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="block w-full text-sm" onChange={e => setFile(e.target.files?.[0] || null)} /></label>}
      </div>
      {problem && <div className="mb-2 text-red-700">{problem}</div>}
      <QuickForm cols={4} busy={r.busy} submitText="Release" fields={[
        { name: 'docNo', label: type === 'RE_EXPORT' ? 'Shipping bill no.' : 'Ex-bond bill of entry no.', required: true }, { name: 'docDate', label: 'Document date', type: 'date', required: true },
        ...(type === 'HOME_CONSUMPTION' ? [{ name: 'dutyPaid', label: 'Duty paid (₹)', type: 'number' as const, required: true }, { name: 'dutyChallanNo', label: 'Challan / e-payment no.', required: true },
          { name: 'dutyPaidOn', label: 'Paid on', type: 'date' as const, required: true }] : []),
        { name: 'outOfChargeNo', label: 'Out of charge no.' }, { name: 'palletCodes', label: 'Pallets released (empty = all, when releasing everything)', type: 'textarea', wide: true }, { name: 'notes', label: 'Notes', wide: true }]}
        onSubmit={async (v, f) => {
          const p = releaseProblem({ releaseType: type, docNo: String(v.docNo || ''), quantity: Number(qty), balance: Number(sel.balance), dutyDue: due, dutyPaid: Number(v.dutyPaid || 0), challanNo: String(v.dutyChallanNo || ''), hasDocument: !!file }, tolerance);
          setProblem(p);
          if (p) return;
          const document = file ? { fileName: file.name, contentType: file.type, dataBase64: await fileData(file) } : undefined;
          await r.run(() => post(`${API}/entries/${sel.id}/release`, { ...v, releaseType: type, quantity: qty, palletCodes: codes(v.palletCodes), document }), async () => { f.reset(); setQty(''); setFile(null); await onChanged(); });
        }} />
    </div>}
    {staff && (sel.documents || []).length > 0 && <div className="mt-3"><div className="font-semibold">EXIM documents</div><Table rows={sel.documents} cols={[
      { key: 'docType', label: 'Document', render: x => words(x.docType) }, { key: 'docNo', label: 'Number' }, { key: 'docDate', label: 'Date', render: x => day(x.docDate) }, { key: 'portCode', label: 'Port' }]} /></div>}
  </Section>;
}

function Register({ warehouses, r }: any) {
  const [f, setF] = useState({ warehouseId: '', from: monthStart(), to: today() });
  const [rows, setRows] = useState<any[]>([]);
  const qs = `warehouseId=${f.warehouseId}&from=${f.from}&to=${f.to}`;
  const load = () => r.run(() => api(`${API}/register?${qs}`), (d: any) => setRows(d.rows || []));
  useEffect(() => { void load(); }, []);
  const print = () => printHtml('Bond register', `<div class="doc"><h1>Warehouse register (bonded goods)</h1><div class="muted">${f.from} to ${f.to}</div><table><tr>
    <th>Sl</th><th>BE no. / date</th><th>Importer / IEC</th><th>Goods / HS</th><th>Qty</th><th>Value</th><th>Duty</th><th>Warehoused</th><th>Expiry</th><th>Removals</th><th>Balance</th></tr>
    ${rows.map(x => `<tr><td>${x.serialNo}</td><td>${x.beNo}<br>${day(x.beDate)}</td><td>${x.importer}<br>${x.iecCode || ''}</td><td>${x.description}<br>${x.hsCode || ''}</td>
    <td>${num(x.quantity)} ${x.uom}</td><td>${rupees(x.assessableValue)}</td><td>${rupees(x.dutyAmount)}</td><td>${day(x.warehousedOn)}</td><td>${day(x.bondExpiry)}</td>
    <td>${(x.removals || []).map((m: any) => `${day(m.docDate)} ${words(m.releaseType)} ${m.docNo} ${num(m.quantity)}`).join('<br>') || '-'}</td><td>${num(x.balance)}</td></tr>`).join('')}</table></div>`);
  return <Section title="Bond register (customs format)" right={<div className="flex gap-2">
    <button className={btnLight} onClick={print}>Print</button>
    <button className={btnLight} onClick={() => openFile(`${API}/register.csv?${qs}`, 'bond-register.csv').catch(e => r.setError(e.message))}>CSV</button></div>}>
    <div className="mb-3 grid gap-2 md:grid-cols-4">
      <select className={input} value={f.warehouseId} onChange={e => setF({ ...f, warehouseId: e.target.value })}><option value="">All warehouses</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <input className={input} type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} />
      <input className={input} type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} />
      <button className={btn} onClick={load}>Show</button>
    </div>
    <Table rows={rows} empty="No bonded goods in the period." cols={[
      { key: 'serialNo', label: 'Sl' }, { key: 'beNo', label: 'Bill of entry', render: x => `${x.beNo} · ${day(x.beDate)}` }, { key: 'importer', label: 'Importer' },
      { key: 'description', label: 'Goods' }, { key: 'quantity', label: 'Qty', right: true, render: x => `${num(x.quantity)} ${x.uom}` },
      { key: 'dutyAmount', label: 'Duty', right: true, render: x => rupees(x.dutyAmount) }, { key: 'bondExpiry', label: 'Expiry', render: x => day(x.bondExpiry) },
      { key: 'removals', label: 'Removals', render: x => (x.removals || []).map((m: any) => `${day(m.docDate)} ${num(m.quantity)}`).join(', ') || '-' },
      { key: 'balance', label: 'Balance', right: true, render: x => num(x.balance) },
    ]} />
  </Section>;
}

function Sites({ o, can, warehouses, chambers, r, onChanged }: any) {
  const [list, setList] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const load = useCallback(() => api(`${API}/sites?all=true`).then(d => setList(d.sites || [])).catch(() => setList([])), []);
  useEffect(() => { void load(); }, [load, o]);
  const fields = [
    { name: 'warehouseId', label: 'Warehouse', type: 'select' as const, required: true, options: opts(warehouses) },
    { name: 'chamberId', label: 'Chamber (empty = whole warehouse)', type: 'select' as const, options: chambers.map((c: any) => [String(c.id), `${c.warehouseName} / ${c.name}`] as [string, string]) },
    { name: 'licenceNo', label: 'Licence no.', required: true }, { name: 'licenceType', label: 'Licence', type: 'select' as const, options: LICENCE, required: true },
    { name: 'customsStation', label: 'Customs station', required: true }, { name: 'customsOfficer', label: 'Bond officer' },
    { name: 'validFrom', label: 'Valid from', type: 'date' as const }, { name: 'validTo', label: 'Valid to', type: 'date' as const }, { name: 'notes', label: 'Notes', wide: true }];
  const save = (v: any, f: HTMLFormElement) => r.run(() => edit ? put(`${API}/sites/${edit.id}`, v) : post(`${API}/sites`, v), async () => { f.reset(); setEdit(null); await load(); await onChanged(); });
  return <>
    {can && <Section title={edit ? `Change ${edit.licenceNo}` : 'Mark a warehouse or chamber as bonded'}>
      <QuickForm key={edit?.id || 'new'} cols={3} busy={r.busy} submitText="Save" initial={edit || undefined} onCancel={edit ? () => setEdit(null) : undefined} fields={fields} onSubmit={save} />
    </Section>}
    <Section title="Bonded sites">
      <Table rows={list} empty="No bonded site yet." cols={[
        { key: 'licenceNo', label: 'Licence' }, { key: 'licenceType', label: 'Type', render: x => words(x.licenceType) },
        { key: 'warehouseName', label: 'Place', render: x => `${x.warehouseName}${x.chamberName ? ' / ' + x.chamberName : ' (whole warehouse)'}` },
        { key: 'customsStation', label: 'Station' }, { key: 'validTo', label: 'Valid to', render: x => day(x.validTo) }, { key: 'openEntries', label: 'Open entries', right: true },
        { key: 'active', label: '', render: x => can ? <div className="flex gap-2"><button className={btnLight} onClick={() => setEdit(x)}>Edit</button>
          <button className={btnLight} onClick={() => r.run(() => post(`${API}/sites/${x.id}/active`, { active: !x.active }), load)}>{x.active ? 'Switch off' : 'Switch on'}</button></div> : (x.active ? 'On' : 'Off') },
      ]} />
    </Section>
  </>;
}

function Exim({ can, r, entry }: any) {
  const [orderId, setOrderId] = useState('');
  const [docs, setDocs] = useState<any[]>([]);
  const [o, setO] = useState<any>(null);
  const load = async () => {
    if (!orderId) return;
    const d = await r.run(() => api(`${API}/exim?orderId=${orderId}`)); if (d) setDocs(d.documents || []);
  };
  const packing = async () => {
    const p = await r.run(() => api(`${API}/exim/orders/${orderId}/packing-list`));
    if (!p) return;
    setO(p);
    printHtml(`Packing list ${p.orderNo}`, `<div class="doc"><div class="head"><div><h1>Packing list</h1><div>Order ${p.orderNo} · ${p.partnerName}${p.partnerGstin ? ' · GSTIN ' + p.partnerGstin : ''}</div>
      <div class="muted">${p.consigneeName || ''} ${p.consigneeCity || ''}</div></div><div>${p.warehouseName}<br>Truck ${p.vehicleNumber || '-'} · seal ${p.sealNumber || '-'}</div></div>
      <div>${(p.documents || []).map((d: any) => `${words(d.docType)} ${d.docNo} (${day(d.docDate)})`).join(' · ')}</div>
      <table><tr><th>Pallet</th><th>Product</th><th>Batch</th><th>Mfg</th><th>Expiry</th><th>Qty</th><th>Kg</th></tr>
      ${(p.pallets || []).map((x: any) => `<tr><td>${x.palletCode}</td><td>${x.productCode} ${x.productName}</td><td>${x.batchNo || ''}</td><td>${day(x.mfgDate)}</td><td>${day(x.expiryDate)}</td><td>${num(x.quantity)} ${x.uom || ''}</td><td>${num(x.weightKg)}</td></tr>`).join('')}
      <tr><td colspan="6"><b>${p.palletCount} pallet(s)</b></td><td><b>${num(p.totalKg)}</b></td></tr></table>
      <div class="sign"><div>Packed by</div><div>Checked by</div><div>Customs</div></div></div>`);
  };
  return <Section title="EXIM documents of an export order">
    <div className="mb-3 flex flex-wrap gap-2">
      <input className={`${input} max-w-xs`} placeholder="Warehouse order id" value={orderId} onChange={e => setOrderId(e.target.value.replace(/\D/g, ''))} />
      <button className={btn} disabled={!orderId} onClick={load}>Show</button>
      <button className={btnLight} disabled={!orderId} onClick={packing}>Print packing list</button>
      {o && <span className="self-center text-sm text-slate-600">{o.orderNo} · {o.palletCount} pallet(s)</span>}
    </div>
    <Table rows={docs} empty="No documents for this order." cols={[
      { key: 'docType', label: 'Document', render: x => words(x.docType) }, { key: 'docNo', label: 'Number' }, { key: 'docDate', label: 'Date', render: x => day(x.docDate) },
      { key: 'portCode', label: 'Port' }, { key: 'country', label: 'Country' }, { key: 'containerNo', label: 'Container' }, { key: 'sealNo', label: 'Seal' },
      { key: 'id', label: '', render: x => can ? <button className={btnRed} onClick={() => r.run(() => api(`${API}/exim/${x.id}`, { method: 'DELETE' }), load)}>Remove</button> : null },
    ]} />
    {can && <div className="mt-3"><QuickForm cols={4} busy={r.busy} submitText="Add document" fields={[
      { name: 'docType', label: 'Document', type: 'select', required: true, options: ['SHIPPING_BILL', 'PACKING_LIST', 'COMMERCIAL_INVOICE', 'CERTIFICATE_OF_ORIGIN', 'HEALTH_CERTIFICATE', 'PHYTO_CERTIFICATE', 'BILL_OF_LADING', 'AIRWAY_BILL', 'BILL_OF_ENTRY', 'OTHER'].map(x => [x, words(x)]) },
      { name: 'docNo', label: 'Number', required: true }, { name: 'docDate', label: 'Date', type: 'date', required: true }, { name: 'portCode', label: 'Port code' },
      { name: 'country', label: 'Country' }, { name: 'containerNo', label: 'Container' }, { name: 'sealNo', label: 'Seal' }, { name: 'vessel', label: 'Vessel / flight' },
      { name: 'setTemperatureC', label: 'Set temperature (°C)', type: 'number' }, { name: 'notes', label: 'Notes', wide: true }]}
      onSubmit={(v, f) => {
        if (!orderId && !entry) { r.setError('Type the warehouse order id, or open a bond entry first'); return; }
        return r.run(() => post(`${API}/exim`, { ...v, outboundOrderId: orderId || undefined, bondEntryId: orderId ? undefined : entry?.id }), async () => { f.reset(); await load(); });
      }} />
      {!orderId && entry && <div className="mt-1 text-xs text-slate-500">No order typed: the document is kept with bond entry {entry.entryNo}.</div>}
    </div>}
  </Section>;
}
