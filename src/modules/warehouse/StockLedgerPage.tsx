/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-010 -- Stock Ledger per partner.
//   Balances: per partner, product and batch: physical, reserved, available, awaiting putaway, on hold,
//             damaged and in transit (dispatched on a trip that is not completed yet).
//   Pallets:  where every pallet is.
//   Movements: every receipt, putaway, move, reserve, pick, dispatch, hold and release with who and when.
// A Partner login sees only its own stock (the backend enforces it); staff choose the partner.
//
// Backend: StockLedgerController (/api/warehouse/stock, /stock/pallets, /stock/ledger).
import { useCallback, useEffect, useState } from 'react';
import { BookOpenCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section } from '@/shared/components/FormKit';
import { btnLight, day, errorText, expiryStyle, input, num, pill, qty, td, th, when, who } from './wms';

type Tab = 'balances' | 'pallets' | 'ledger';

function downloadCsv(name: string, rows: any[], cols: [string, string][]) {
  const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [cols.map(c => cell(c[1])).join(','), ...rows.map(r => cols.map(c => cell(r[c[0]])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}

export function StockLedgerPage() {
  const me = who();
  const [tab, setTab] = useState<Tab>('balances');
  const [partners, setPartners] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [f, setF] = useState({ partnerId: '', warehouseId: '', batchNo: '', palletCode: '', from: '', to: '' });
  const [balances, setBalances] = useState<any>(null);
  const [pallets, setPallets] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [error, setError] = useState('');
  const allowed = me.staff || me.partner;

  useEffect(() => {
    if (!me.staff) return;
    api('/api/operations/partners').then(p => { const list = Array.isArray(p) ? p : []; setPartners(list); if (list.length === 1) setF(x => ({ ...x, partnerId: String(list[0].id) })); }).catch(() => setPartners([]));
    api('/api/warehouse/layout').then(d => setWarehouses(d.warehouses || [])).catch(() => setWarehouses([]));
  }, []);

  const query = useCallback((extra: Record<string, string> = {}) => {
    const q = new URLSearchParams();
    if (f.partnerId) q.set('partnerId', f.partnerId);
    if (f.warehouseId) q.set('warehouseId', f.warehouseId);
    if (f.batchNo.trim()) q.set('batchNo', f.batchNo.trim());
    Object.entries(extra).forEach(([k, v]) => { if (v) q.set(k, v); });
    return q.toString();
  }, [f]);
  const load = useCallback(async () => {
    setError('');
    try {
      if (tab === 'balances') setBalances(await api(`/api/warehouse/stock?${query()}`));
      if (tab === 'pallets') setPallets(await api(`/api/warehouse/stock/pallets?${query()}`));
      if (tab === 'ledger') setLedger(await api(`/api/warehouse/stock/ledger?${query({ from: f.from, to: f.to, palletCode: f.palletCode.trim(), limit: '500' })}`));
    } catch (x) { setError(errorText(x, 'Could not load the stock')); }
  }, [tab, query, f.from, f.to, f.palletCode]);
  useEffect(() => { if (allowed) void load(); }, [load]);

  if (!allowed) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Stock Ledger</h1><p className="mt-2 text-slate-600">You do not have access to this page.</p></div>;

  const rows = balances?.batches || [];
  const total = (k: string) => rows.reduce((a: number, r: any) => a + Number(r[k] || 0), 0);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(x => ({ ...x, [k]: e.target.value }));
  const tabBtn = (t: Tab, text: string) => <button onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === t ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{text}</button>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><BookOpenCheck className="h-8 w-8 text-sky-700" />{me.partner ? 'My Stock' : 'Stock Ledger'}</h1>
    <p className="text-slate-600">Stock per partner, product and batch, and every movement behind it.</p>
    <Banner error={error} />
    {balances && balances.ready === false && <NotReady script="database_v2/30_req_wms_006_011_warehouse.sql" />}
    <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-6">
      {me.staff && <select value={f.partnerId} onChange={set('partnerId')} className={input}><option value="">All partners</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
      {me.staff && <select value={f.warehouseId} onChange={set('warehouseId')} className={input}><option value="">All warehouses</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>}
      <input value={f.batchNo} onChange={set('batchNo')} placeholder="Batch" className={input} />
      {tab === 'ledger' && <><input value={f.palletCode} onChange={set('palletCode')} placeholder="Pallet code" className={input} />
        <input type="date" value={f.from} onChange={set('from')} className={input} title="From" /><input type="date" value={f.to} onChange={set('to')} className={input} title="To" /></>}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">{tabBtn('balances', 'Balances')}{tabBtn('pallets', 'Pallets')}{tabBtn('ledger', 'Movements')}
      <button onClick={() => void load()} className={`${btnLight} ml-auto`}>Refresh</button></div>

    {tab === 'balances' && balances?.ready && <Section title={`Balances as of ${when(balances.asOf)}`} right={<button className={btnLight} onClick={() => downloadCsv('stock-balances.csv', rows,
      [['partnerName', 'Partner'], ['productCode', 'Product code'], ['productName', 'Product'], ['batchNo', 'Batch'], ['expiryDate', 'Expiry'], ['warehouseName', 'Warehouse'], ['uom', 'Unit'],
        ['physical', 'Physical'], ['reserved', 'Reserved'], ['available', 'Available'], ['awaitingPutaway', 'Awaiting putaway'], ['onHold', 'On hold'], ['damaged', 'Damaged'], ['inTransit', 'In transit'], ['physicalKg', 'Kg'], ['pallets', 'Pallets']])}>Download CSV</button>}>
      <div className="mb-3 grid gap-2 text-center sm:grid-cols-3 lg:grid-cols-6">
        {[['Physical', 'physical'], ['Available', 'available'], ['Reserved', 'reserved'], ['On hold', 'onHold'], ['Damaged', 'damaged'], ['In transit', 'inTransit']].map(([t, k]) =>
          <div key={k} className="rounded-xl bg-slate-50 p-2"><div className="text-xs text-slate-500">{t} (all units)</div><div className="text-lg font-bold">{num(total(k))}</div></div>)}
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1150px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600">{me.staff && <th className={th}>Partner</th>}<th className={th}>Product</th><th className={th}>Batch</th><th className={th}>Expiry</th><th className={th}>Warehouse</th>
          <th className={`${th} text-right`}>Physical</th><th className={`${th} text-right`}>Reserved</th><th className={`${th} text-right`}>Available</th><th className={`${th} text-right`}>Awaiting putaway</th>
          <th className={`${th} text-right`}>On hold</th><th className={`${th} text-right`}>Damaged</th><th className={`${th} text-right`}>In transit</th><th className={`${th} text-right`}>Pallets</th></tr></thead>
        <tbody>{rows.map((r: any, i: number) => <tr key={i} className="border-t">
          {me.staff && <td className={td}>{r.partnerName}</td>}
          <td className={td}>{r.productName}<div className="font-mono text-xs text-slate-500">{r.productCode}</div></td>
          <td className={`${td} font-mono`}>{r.batchNo || '-'}</td>
          <td className={`${td} ${expiryStyle(r.daysToExpiry)}`}>{day(r.expiryDate)}{r.daysToExpiry != null && <div className="text-xs">{r.daysToExpiry} days</div>}</td>
          <td className={td}>{r.warehouseName}</td>
          <td className={`${td} text-right font-semibold`}>{qty(r.physical, r.uom)}{r.physicalKg ? <div className="text-xs font-normal text-slate-500">{num(r.physicalKg)} kg</div> : null}</td>
          <td className={`${td} text-right`}>{num(r.reserved)}</td><td className={`${td} text-right font-bold text-emerald-700`}>{num(r.available)}</td>
          <td className={`${td} text-right`}>{num(r.awaitingPutaway)}</td><td className={`${td} text-right text-amber-700`}>{num(r.onHold)}</td>
          <td className={`${td} text-right text-red-700`}>{num(r.damaged)}</td><td className={`${td} text-right text-sky-700`}>{num(r.inTransit)}</td><td className={`${td} text-right`}>{r.pallets}</td>
        </tr>)}
          {rows.length === 0 && <tr><td colSpan={13} className={`${td} text-slate-500`}>No stock.</td></tr>}</tbody></table></div>
    </Section>}

    {tab === 'pallets' && <Section title={`Pallets (${pallets.length})`} right={<button className={btnLight} onClick={() => downloadCsv('pallets.csv', pallets,
      [['palletCode', 'Pallet'], ['partnerName', 'Partner'], ['productCode', 'Product code'], ['productName', 'Product'], ['batchNo', 'Batch'], ['expiryDate', 'Expiry'], ['quantity', 'Quantity'], ['uom', 'Unit'],
        ['reservedQty', 'Reserved'], ['status', 'Status'], ['stockState', 'State'], ['binCode', 'Bin'], ['warehouseName', 'Warehouse']])}>Download CSV</button>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Pallet</th>{me.staff && <th className={th}>Partner</th>}<th className={th}>Product</th><th className={th}>Batch / expiry</th>
          <th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Reserved</th><th className={th}>Status</th><th className={th}>Where</th></tr></thead>
        <tbody>{pallets.map(p => <tr key={p.id} className="border-t">
          <td className={`${td} font-mono font-bold`}>{p.palletCode}</td>{me.staff && <td className={td}>{p.partnerName}</td>}
          <td className={td}>{p.productName}</td>
          <td className={td}>{p.batchNo || '-'}<div className={expiryStyle(p.daysToExpiry)}>{day(p.expiryDate)}</div></td>
          <td className={`${td} text-right`}>{qty(p.quantity, p.uom)}</td><td className={`${td} text-right`}>{num(p.reservedQty)}</td>
          <td className={td}><span className={pill(p.status)}>{p.status}</span> <span className={pill(p.stockState)}>{p.stockState}</span></td>
          <td className={td}>{p.binCode || p.dockCode || '-'}<div className="text-xs text-slate-500">{p.chamberName || p.warehouseName}</div></td>
        </tr>)}
          {pallets.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No pallets.</td></tr>}</tbody></table></div>
    </Section>}

    {tab === 'ledger' && <Section title={`Movements (latest ${ledger.length})`} right={<button className={btnLight} onClick={() => downloadCsv('stock-movements.csv', ledger,
      [['createdAt', 'When'], ['movementType', 'Movement'], ['partnerName', 'Partner'], ['productCode', 'Product'], ['batchNo', 'Batch'], ['palletCode', 'Pallet'], ['quantity', 'Quantity change'],
        ['reservedChange', 'Reserved change'], ['fromBinCode', 'From bin'], ['binCode', 'Bin'], ['referenceNo', 'Reference'], ['note', 'Note'], ['userName', 'By']])}>Download CSV</button>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>When</th><th className={th}>Movement</th><th className={th}>Product / batch</th><th className={th}>Pallet</th>
          <th className={`${th} text-right`}>Quantity</th><th className={`${th} text-right`}>Reserved</th><th className={th}>Bin</th><th className={th}>Reference / note</th><th className={th}>By</th></tr></thead>
        <tbody>{ledger.map(l => <tr key={l.id} className="border-t">
          <td className={td}>{when(l.createdAt)}</td><td className={`${td} font-semibold`}>{l.movementType}{l.stateTo && <div className="text-xs font-normal">{l.stateFrom} → {l.stateTo}</div>}</td>
          <td className={td}>{l.productName}<div className="text-xs text-slate-500">{l.batchNo || '-'}{me.staff ? ` · ${l.partnerName}` : ''}</div></td>
          <td className={`${td} font-mono`}>{l.palletCode}</td>
          <td className={`${td} text-right ${Number(l.quantity) < 0 ? 'text-red-700' : Number(l.quantity) > 0 ? 'text-emerald-700' : ''}`}>{Number(l.quantity) > 0 ? '+' : ''}{num(l.quantity)}</td>
          <td className={`${td} text-right`}>{Number(l.reservedChange) ? num(l.reservedChange) : ''}</td>
          <td className={td}>{l.fromBinCode ? `${l.fromBinCode} → ` : ''}{l.binCode || ''}</td>
          <td className={td}>{l.referenceNo || ''}{l.note && <div className="text-xs text-slate-500">{l.note}</div>}</td><td className={td}>{l.userName}</td>
        </tr>)}
          {ledger.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No movements.</td></tr>}</tbody></table></div>
    </Section>}
  </>;
}
