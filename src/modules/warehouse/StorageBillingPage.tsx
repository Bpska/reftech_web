/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-004 -- storage billing by pallet-days (or kg-days), handling in and out, a minimum charge and the
//   freezing / services jobs done in the period.
//   Bills: choose partner, warehouse and period, see how the bill is worked out (every pallet stay), save it as a
//   draft and send it to Billing, where it is reviewed and approved like any other bill (GST is added there).
//   Tariffs: a Manager sets the storage basis (pallet-day, kg-day or cubic metre a day) and rate (empty = the
//   PALLET_DAY rate of the partner's rate contract), the
//   handling rates, the minimum charge and the service rates of a partner, for every warehouse or one.
// A Partner login sees the storage bills sent to Billing for it.
//
// Backend: StorageBillingController (/api/warehouse/tariffs/**, /api/warehouse/storage-bills/**).
import { useCallback, useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, btnRed, day, input, num, pill, when, who } from './wms';
import { OPS_SCRIPT, Table, Tabs, monthStart, opts, post, put, today, usePartners, useRunner, useWarehouses } from './wmsOps';
import { SERVICES, UNITS } from './ServicesPage';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const rs = (v: unknown) => fmtMoney(v as any);
const BASES: [string, string][] = [['PALLET_DAY', 'Pallet-day'], ['KG_DAY', 'Kg-day'], ['CBM_DAY', 'Cubic metre a day (CBM)']];
const unitText = (u: string) => ({ PALLET_DAY: 'pallet-days', KG_DAY: 'kg-days', CBM_DAY: 'cubic-metre-days', PALLET: 'pallets', KG: 'kg', UNIT: 'units', HOUR: 'hours', JOB: 'jobs', BILL: 'bill' } as Record<string, string>)[u] || u;

export function StorageBillingPage() {
  const me = who();
  const [tab, setTab] = useState('bills');
  if (!me.staff && !me.partner) return null;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Receipt className="h-8 w-8 text-sky-700" />{me.partner ? 'My Storage Bills' : 'Storage Billing'}</h1>
    <p className="text-slate-600">{me.partner ? 'Storage, handling and service charges billed to you.' : 'Storage by pallet-days, handling in and out, minimum charge and services, sent to Billing for review.'}</p>
    {me.staff && <Tabs tabs={[['bills', 'Bills'], ['tariffs', 'Tariffs']]} value={tab} onChange={setTab} />}
    {tab === 'bills' || !me.staff ? <Bills staff={me.staff} /> : <Tariffs manager={me.manager} />}
  </>;
}

function Lines({ lines }: { lines: any[] }) {
  return <Table rows={lines} empty="No charges." cols={[
    { key: 'description', label: 'Charge' }, { key: 'quantity', label: 'Quantity', right: true, render: x => num(x.quantity, 3) },
    { key: 'unit', label: 'Unit', render: x => unitText(x.unit) }, { key: 'rate', label: 'Rate', right: true, render: x => rs(x.rate) }, { key: 'amount', label: 'Amount', right: true, render: x => rs(x.amount) },
  ]} />;
}

function Bills({ staff }: { staff: boolean }) {
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState(staff ? 'DRAFT' : '');
  const [list, setList] = useState<any[]>([]);
  const [billingReady, setBillingReady] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [showStays, setShowStays] = useState(false);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(async () => {
    try {
      const d = await api(`/api/warehouse/storage-bills${status ? `?status=${status}` : ''}`);
      setReady(d.ready !== false); setList(d.bills || []); setBillingReady(d.billingReady !== false);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/storage-bills/${id}`)); if (d) { setSel(d); setPreview(null); } };
  const work = (v: Record<string, unknown>) => r.run(() => api(`/api/warehouse/storage-bills/preview?partnerId=${v.partnerId}&warehouseId=${v.warehouseId}&from=${v.from}&to=${v.to}`),
    (d: any) => { setPreview(d); setSel(null); setShowStays(false); });
  return <>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    {staff && !billingReady && <div className="mt-2 rounded-xl bg-amber-50 p-3 text-amber-800">Billing is not set up for storage bills yet: run database_v2/49_warehouse_storage_billing_reftech_billing.sql on the reftech_billing database. Drafts can still be worked out and saved.</div>}
    {staff && <Section title="Work out a bill">
      <QuickForm cols={4} busy={r.busy} submitText="Work out" initial={{ from: monthStart(), to: today() }} fields={[
        { name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true },
        { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), required: true },
        { name: 'from', label: 'From', type: 'date', required: true }, { name: 'to', label: 'To', type: 'date', required: true }]} onSubmit={v => work(v)} />
    </Section>}
    {preview && <Section title={<>{preview.partnerName} · {preview.warehouseName} · {day(preview.from)} to {day(preview.to)}</>} right={<div className="flex gap-2">
      <button className={btn} disabled={r.busy || !preview.billable} onClick={() => r.run(() => post('/api/warehouse/storage-bills', { partnerId: preview.partnerId, warehouseId: preview.warehouseId, from: preview.from, to: preview.to }),
        async (d: any) => { setPreview(null); setStatus('DRAFT'); setSel(d); await load(); })}>Save draft</button>
      <button className={btnLight} onClick={() => setPreview(null)}>Close</button></div>}>
      {(preview.problems || []).map((p: string) => <div key={p} className="mb-1 rounded-lg bg-red-50 px-3 py-2 text-red-800">{p}</div>)}
      {(preview.warnings || []).map((p: string) => <div key={p} className="mb-1 rounded-lg bg-amber-50 px-3 py-2 text-amber-800">{p}</div>)}
      <div className="grid gap-1 text-sm md:grid-cols-4">
        <div>Storage {rs(preview.storageRate)} per {unitText(preview.storageBasis)?.replace(/s$/, '')} <span className="text-slate-500">({preview.rateSource || 'no rate'})</span></div>
        <div>{num(preview.palletDays, 0)} pallet-days{preview.storageBasis === 'KG_DAY' ? ` · ${num(preview.kgDays, 2)} kg-days` : ''}{preview.storageBasis === 'CBM_DAY' ? ` · ${num(preview.cbmDays, 3)} m³-days` : ''}</div>
        <div>{preview.palletsIn} pallets in · {preview.palletsOut} out</div>
        <div>{preview.countLeavingDay ? 'The day a pallet leaves is charged' : 'The day a pallet leaves is not charged'}</div>
      </div>
      <div className="mt-3"><Lines lines={preview.lines || []} /></div>
      <div className="mt-2 text-right text-lg font-bold">Total {rs(preview.amount)} <span className="text-sm font-normal text-slate-500">before GST</span></div>
      <button className={`${btnLight} mt-2`} onClick={() => setShowStays(!showStays)}>{showStays ? 'Hide' : 'Show'} pallet stays ({(preview.stays || []).length})</button>
      {showStays && <div className="mt-2"><Table rows={preview.stays || []} cols={[
        { key: 'palletCode', label: 'Pallet' }, { key: 'productCode', label: 'Product' }, { key: 'inDay', label: 'In', render: x => day(x.inDay) },
        { key: 'outDay', label: 'Out', render: x => x.outDay ? day(x.outDay) : 'still in' }, { key: 'days', label: 'Days', right: true }, { key: 'weightKg', label: 'Kg', right: true },
        { key: 'volumeM3', label: 'm³', right: true, render: x => x.volumeM3 != null ? num(x.volumeM3, 3) : '-' },
      ]} /></div>}
    </Section>}
    <Section title="Storage bills" right={staff && <select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['DRAFT', 'Drafts'], ['BILLED', 'Sent to Billing'], ['CANCELLED', 'Cancelled'], ['', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'billNo', label: 'Bill' }, { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' },
        { key: 'period', label: 'Period', render: x => `${day(x.periodFrom)} to ${day(x.periodTo)}` }, { key: 'palletDays', label: 'Pallet-days', right: true, render: x => num(x.palletDays, 0) },
        { key: 'amount', label: 'Amount', right: true, render: x => rs(x.amount) }, { key: 'invoiceNumber', label: 'Billing ref' },
        { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.billNo} <span className={pill(sel.status)}>{sel.status}</span></>} right={staff && sel.status === 'DRAFT' && <div className="flex gap-2">
      <button className={btn} disabled={r.busy || !sel.billingReady} onClick={() => { if (window.confirm(`Send ${sel.billNo} (${rs(sel.amount)}) to Billing for review?`)) void r.run(() => post(`/api/warehouse/storage-bills/${sel.id}/send`), async () => { await open(sel.id); await load(); }); }}>Send to Billing</button>
      <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the draft cancelled?'); if (reason) void r.run(() => post(`/api/warehouse/storage-bills/${sel.id}/cancel`, { reason }), async () => { await open(sel.id); await load(); }); }}>Cancel</button>
    </div>}>
      <div className="grid gap-1 text-sm md:grid-cols-3">
        <div>{sel.partnerName} · {sel.warehouseName}</div><div>{day(sel.periodFrom)} to {day(sel.periodTo)}</div>
        <div>{num(sel.palletDays, 0)} pallet-days{sel.cbmDays != null && Number(sel.cbmDays) > 0 ? ` · ${num(sel.cbmDays, 3)} m³-days` : ''} · {sel.palletsIn} in · {sel.palletsOut} out</div>
        <div>Made {when(sel.createdAt)} {sel.createdByName || ''}</div>
        <div>{sel.billedAt ? `Sent ${when(sel.billedAt)} ${sel.billedByName || ''}` : ''}{sel.invoiceNumber ? ` as ${sel.invoiceNumber}` : ''}</div>
        <div>{sel.cancelledReason || ''}</div>
      </div>
      <div className="mt-3"><Lines lines={sel.lines || []} /></div>
      <div className="mt-2 text-right text-lg font-bold">Total {rs(sel.amount)} <span className="text-sm font-normal text-slate-500">before GST</span></div>
    </Section>}
  </>;
}

type VasLine = { service: string; unit: string; rate: string };

function Tariffs({ manager }: { manager: boolean }) {
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [partnerId, setPartnerId] = useState('');
  const [list, setList] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [vas, setVas] = useState<VasLine[]>([]);
  const [bases, setBases] = useState<string[]>(['PALLET_DAY', 'KG_DAY']);   // CBM_DAY once script 70 is run
  const load = useCallback(async () => {
    try {
      const d = await api(`/api/warehouse/tariffs${partnerId ? `?partnerId=${partnerId}` : ''}`); setReady(d.ready !== false); setList(d.tariffs || []);
      if (Array.isArray(d.storageBases)) setBases(d.storageBases);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [partnerId]);
  useEffect(() => { void load(); }, [load]);
  const start = (t: any) => { setEdit(t); setVas((t?.vas || []).map((v: any) => ({ service: v.service, unit: v.unit, rate: String(v.rate) }))); };
  const cell = 'w-full rounded-lg border border-slate-300 px-2 py-1 text-sm';
  return <>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    <Section title="Tariffs" right={<div className="flex gap-2">
      <select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Every partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      {manager && <button className={btn} onClick={() => start({})}>New tariff</button>}</div>}>
      <Table rows={list} selected={edit?.id} onRow={manager ? x => start(x) : undefined} cols={[
        { key: 'partnerName', label: 'Partner' }, { key: 'warehouseName', label: 'Warehouse' }, { key: 'valid', label: 'Valid', render: x => `${day(x.validFrom)} to ${x.validTo ? day(x.validTo) : 'open'}` },
        { key: 'storageRate', label: 'Storage', render: x => x.storageRate != null ? `${rs(x.storageRate)} / ${unitText(x.storageBasis).replace(/s$/, '')}` : 'rate contract' },
        { key: 'handling', label: 'Handling in / out', render: x => `${rs(x.handlingInRate)} / ${rs(x.handlingOutRate)} per ${unitText(x.handlingBasis).replace(/s$/, '')}` },
        { key: 'minCharge', label: 'Minimum', right: true, render: x => rs(x.minCharge) }, { key: 'vas', label: 'Services', render: x => (x.vas || []).map((v: any) => v.service).join(', ') },
        { key: 'status', label: 'Status', render: x => <span className={pill(x.status)}>{x.status}</span> },
      ]} />
      {!manager && <div className="mt-2 text-sm text-slate-500">Tariffs are set by a Manager.</div>}
    </Section>
    {edit && manager && <Section title={edit.id ? `Tariff of ${edit.partnerName}` : 'New tariff'} right={edit.id && edit.status === 'ACTIVE' && <button className={btnRed} onClick={() => {
      const on = window.prompt('Last day of this tariff (yyyy-mm-dd)', today()); if (on) void r.run(() => post(`/api/warehouse/tariffs/${edit.id}/end`, { on }), async () => { setEdit(null); await load(); });
    }}>End tariff</button>}>
      <div className="mb-3">
        <div className="mb-1 font-semibold">Service rates</div>
        <table className="w-full max-w-xl text-sm"><tbody>{vas.map((v, i) => <tr key={i}>
          <td className="p-1"><select className={cell} value={v.service} onChange={e => setVas(vas.map((x, j) => j === i ? { ...x, service: e.target.value } : x))}><option value="">Service…</option>{SERVICES.map(([s, t]) => <option key={s} value={s}>{t}</option>)}</select></td>
          <td className="p-1"><select className={cell} value={v.unit} onChange={e => setVas(vas.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))}><option value="">Usual unit</option>{UNITS.map(([u, t]) => <option key={u} value={u}>{t}</option>)}</select></td>
          <td className="p-1"><input className={cell} type="number" step="any" placeholder="Rate (Rs.)" value={v.rate} onChange={e => setVas(vas.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} /></td>
          <td className="p-1"><button type="button" className="text-red-700" onClick={() => setVas(vas.filter((_, j) => j !== i))}>✕</button></td>
        </tr>)}</tbody></table>
        <button type="button" className={`${btnLight} mt-1`} onClick={() => setVas([...vas, { service: '', unit: '', rate: '' }])}>+ Service rate</button>
      </div>
      <QuickForm key={edit.id ?? 'new'} cols={4} busy={r.busy} submitText="Save tariff" onCancel={() => setEdit(null)}
        initial={{ storageBasis: 'PALLET_DAY', handlingBasis: 'PALLET', validFrom: monthStart(), ...edit, partnerId: edit.partnerId, warehouseId: edit.warehouseId }} fields={[
          { name: 'partnerId', label: 'Partner', type: 'select', options: opts(partners), required: true },
          { name: 'warehouseId', label: 'Warehouse', type: 'select', options: opts(warehouses), hint: 'Empty: every warehouse of the partner' },
          { name: 'validFrom', label: 'Valid from', type: 'date', required: true }, { name: 'validTo', label: 'Valid to', type: 'date', hint: 'Empty: until ended' },
          { name: 'storageBasis', label: 'Storage charged per', type: 'select', options: BASES.filter(([b]) => bases.includes(b)), required: true,
            hint: bases.includes('CBM_DAY') ? 'Cubic metre a day: the volume of each pallet (measured at receipt, or quantity x volume per unit of the product)' : undefined },
          { name: 'storageRate', label: 'Storage rate (Rs.)', type: 'number', hint: 'Empty: the PALLET_DAY rate of the rate contract (kg-day and cubic-metre-day need a rate here)' },
          { name: 'handlingBasis', label: 'Handling charged per', type: 'select', options: [['PALLET', 'Pallet'], ['KG', 'Kg']], required: true },
          { name: 'minCharge', label: 'Minimum charge per bill (Rs.)', type: 'number' },
          { name: 'handlingInRate', label: 'Handling in rate (Rs.)', type: 'number' }, { name: 'handlingOutRate', label: 'Handling out rate (Rs.)', type: 'number' },
          { name: 'notes', label: 'Notes', wide: true }]}
        onSubmit={v => r.run(() => (edit.id ? put(`/api/warehouse/tariffs/${edit.id}`, { ...v, vas }) : post('/api/warehouse/tariffs', { ...v, vas })), async () => { setEdit(null); await load(); })} />
    </Section>}
  </>;
}
