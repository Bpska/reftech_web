/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-012 -- transfers between warehouses and between owners. (Moves between bins and chambers are scanned on
// Receiving & Putaway.)
//   Warehouse transfer  pallets of one partner leave one warehouse (truck, seal, temperature) and are received at
//                       the other with their temperature; out of range they come in ON HOLD.
//   Owner transfer      stock changes hands between two partners in the same warehouse; a Manager other than the
//                       maker approves it.
//
// Backend: TransferController (/api/warehouse/transfers/**).
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btnLight, btnRed, input, num, pill, qty, when, who } from './wms';
import { OPS_SCRIPT, StaffOnly, Table, codes, opts, post, usePartners, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function TransfersPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [type, setType] = useState('WAREHOUSE');

  const load = useCallback(async () => {
    try { const d = await api(`/api/warehouse/transfers?status=${status}`); setReady(d.ready !== false); setList(d.transfers || []); } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/transfers/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/transfers/${sel.id}/${path}`, body), changed);

  if (!me.staff) return <StaffOnly title="Transfers" />;
  const fields: Field[] = [
    { name: 'palletCodes', label: 'Pallets (scan or type the labels)', type: 'textarea', required: true, wide: true },
    type === 'WAREHOUSE' ? { name: 'toWarehouseId', label: 'To warehouse', type: 'select', options: opts(warehouses), required: true }
      : { name: 'toPartnerId', label: 'To partner', type: 'select', options: opts(partners), required: true },
    { name: 'reason', label: 'Reason' }, { name: 'reference', label: 'Reference' },
  ];
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ArrowLeftRight className="h-8 w-8 text-sky-700" />Transfers</h1>
    <p className="text-slate-600">Move pallets to another warehouse, or hand stock over to another partner. Bin and chamber moves are on Receiving &amp; Putaway.</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    <Section title="New transfer" right={<select className={input} value={type} onChange={e => setType(e.target.value)}>
      <option value="WAREHOUSE">To another warehouse</option><option value="OWNER">To another partner (owner)</option></select>}>
      <QuickForm key={type} busy={r.busy} submitText="Make the transfer" fields={fields}
        onSubmit={(v, f) => r.run(() => post('/api/warehouse/transfers', { ...v, transferType: type, palletCodes: codes(v.palletCodes) }), async (d: any) => { f.reset(); await changed(d); })} />
    </Section>
    <Section title="Transfers" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['OPEN', 'Open'], ['DRAFT', 'Draft'], ['IN_TRANSIT', 'On the way'], ['RECEIVED', 'Received'], ['DONE', 'Done'], ['CANCELLED', 'Cancelled']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'transferNo', label: 'Transfer' }, { key: 'transferType', label: 'Type', render: x => x.transferType === 'OWNER' ? 'Owner' : 'Warehouse' },
        { key: 'from', label: 'From', render: x => `${x.fromPartnerName} · ${x.fromWarehouseName}` }, { key: 'to', label: 'To', render: x => `${x.toPartnerName} · ${x.toWarehouseName}` },
        { key: 'pallets', label: 'Pallets', right: true }, { key: 'quantity', label: 'Quantity', right: true, render: x => num(x.quantity) },
        { key: 'createdAt', label: 'Made', render: x => when(x.createdAt) }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.transferNo} <span className={pill(sel.status)}>{sel.status}</span></>} right={<div className="flex gap-2">
      {sel.status === 'DRAFT' && me.manager && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the transfer cancelled?'); if (reason) void act('cancel', { reason }); }}>Cancel</button>}
      {sel.status === 'DRAFT' && sel.transferType === 'OWNER' && me.manager && <button className={btnLight} onClick={() => act('approve')}>Approve the owner change</button>}
    </div>}>
      <div className="grid gap-1 text-sm md:grid-cols-3">
        <div>From: <b>{sel.fromPartnerName}</b> · {sel.fromWarehouseName}</div><div>To: <b>{sel.toPartnerName}</b> · {sel.toWarehouseName}</div><div>{sel.reason || ''} {sel.reference || ''}</div>
        <div>Made by {sel.createdByName} {when(sel.createdAt)}</div>
        {sel.dispatchedAt && <div>Left {when(sel.dispatchedAt)} · {sel.vehicleNumber || '-'} · seal {sel.sealNumber || '-'} · {sel.dispatchTemperatureC == null ? '-' : fmtTemp(sel.dispatchTemperatureC)}</div>}
        {sel.receivedAt && <div>Received {when(sel.receivedAt)} by {sel.receivedBy} · {sel.receiveTemperatureC == null ? '-' : fmtTemp(sel.receiveTemperatureC)}</div>}
        {sel.approvedAt && <div>Approved {when(sel.approvedAt)} by {sel.approvedBy}</div>}
        {sel.cancelledReason && <div className="text-red-700">{sel.cancelledReason}</div>}
      </div>
      <div className="mt-3"><Table rows={sel.palletList || []} cols={[
        { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product', render: x => `${x.productCode} · ${x.productName}` }, { key: 'batchNo', label: 'Batch' },
        { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) }, { key: 'fromBinCode', label: 'From bin' },
        { key: 'stockState', label: 'State', render: x => <span className={pill(x.stockState)}>{x.stockState}</span> }, { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} /></div>
      {sel.status === 'DRAFT' && sel.transferType === 'WAREHOUSE' && <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Dispatch</div>
        <QuickForm cols={4} busy={r.busy} submitText="Truck left" fields={[{ name: 'vehicleNumber', label: 'Truck number' }, { name: 'sealNumber', label: 'Seal' },
          { name: 'temperatureC', label: 'Truck temperature', type: 'number', unit: 'temp' }, { name: 'tripId', label: 'Trip id', type: 'number' }]} onSubmit={v => act('dispatch', v)} /></div>}
      {sel.status === 'IN_TRANSIT' && <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">Receive at {sel.toWarehouseName}</div>
        <QuickForm cols={4} busy={r.busy} submitText="Received" fields={[{ name: 'temperatureC', label: 'Product temperature on arrival', type: 'number', required: true, unit: 'temp' }]} onSubmit={v => act('receive', v)} />
        <p className="text-xs text-slate-500">Out of the product's range, the pallets come in ON HOLD. Then put them away on Receiving &amp; Putaway.</p></div>}
    </Section>}
  </>;
}
