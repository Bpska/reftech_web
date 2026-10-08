/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-014 -- blast freezing, tempering and value-added services (relabel, repack, date code, weigh, other).
//   Plan a job for pallets of one partner (the target core temperature for freezing and tempering), start it,
//   record core / air / surface temperatures while it runs, end it with the end temperature and the weights.
//   A freeze or tempering that missed its target puts the pallets ON HOLD. What is billed (pallets, kg, units,
//   hours or one job) goes to the storage bill at the tariff's service rate.
// A Partner login sees its own jobs.
//
// Backend: VasController (/api/warehouse/vas/**).
import { useCallback, useEffect, useState } from 'react';
import { Snowflake } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnRed, input, num, pill, qty, when, who } from './wms';
import { OPS_SCRIPT, Photos, Table, codes, iso, opts, post, usePartners, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp, toBase, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SERVICES: [string, string][] = [['BLAST_FREEZE', 'Blast freezing'], ['TEMPER', 'Tempering'], ['RELABEL', 'Relabelling'], ['REPACK', 'Repacking'],
  ['DATE_CODE', 'Date coding'], ['WEIGH', 'Weighing'], ['OTHER', 'Other']];
export const UNITS: [string, string][] = [['PALLET', 'Per pallet'], ['KG', 'Per kg'], ['UNIT', 'Per unit'], ['HOUR', 'Per hour'], ['JOB', 'Per job']];
const serviceName = (s: string) => SERVICES.find(([v]) => v === s)?.[1] || s;

export function ServicesPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const partners = usePartners();
  const [ready, setReady] = useState<boolean | null>(null);
  const [status, setStatus] = useState('OPEN');
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const load = useCallback(async () => {
    try { const d = await api(`/api/warehouse/vas?status=${status}`); setReady(d.ready !== false); setList(d.jobs || []); } catch (x) { r.setError(String((x as Error).message)); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);
  const open = async (id: number) => { const d = await r.run(() => api(`/api/warehouse/vas/${id}`)); if (d) setSel(d); };
  const changed = async (d: any) => { setSel(d); await load(); };
  const act = (path: string, body?: any) => r.run(() => post(`/api/warehouse/vas/${sel.id}/${path}`, body), changed);
  if (!me.staff && !me.partner) return null;
  const thermal = sel && ['BLAST_FREEZE', 'TEMPER'].includes(sel.service);
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Snowflake className="h-8 w-8 text-sky-700" />Freezing & Services</h1>
    <p className="text-slate-600">Blast freezing, tempering, relabelling, repacking, date coding and weighing, with the temperature record and what is billed.</p>
    <Banner msg={r.msg} error={r.error} />
    {ready === false && <NotReady script={OPS_SCRIPT} />}
    {me.staff && <Section title="Plan a job">
      <QuickForm cols={4} busy={r.busy} submitText="Plan" fields={[
        { name: 'service', label: 'Service', type: 'select', options: SERVICES, required: true },
        { name: 'palletCodes', label: 'Pallets (scan or type the labels)', type: 'textarea', wide: true },
        { name: 'targetTemperatureC', label: 'Target core temperature (freeze / temper)', type: 'number', unit: 'temp' },
        { name: 'billingUnit', label: 'Billed', type: 'select', options: UNITS, hint: 'Empty: kg for freeze and temper, units for labels and packing, pallets for weighing' },
        { name: 'plannedAt', label: 'Planned for', placeholder: 'yyyy-mm-ddThh:mm' },
        { name: 'partnerId', label: 'Partner (when no pallets)', type: 'select', options: opts(partners) }, { name: 'warehouseId', label: 'Warehouse (when no pallets)', type: 'select', options: opts(warehouses) },
        { name: 'description', label: 'Description', wide: true }]}
        onSubmit={(v, f) => r.run(() => post('/api/warehouse/vas', { ...v, plannedAt: iso(v.plannedAt), palletCodes: codes(v.palletCodes) }), async (d: any) => { f.reset(); await changed(d); })} />
    </Section>}
    <Section title="Jobs" right={<select className={input} value={status} onChange={e => setStatus(e.target.value)}>
      {[['OPEN', 'Planned and running'], ['DONE', 'Done'], ['CANCELLED', 'Cancelled'], ['', 'All']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>}>
      <Table rows={list} selected={sel?.id} onRow={x => open(x.id)} cols={[
        { key: 'jobNo', label: 'Job' }, { key: 'service', label: 'Service', render: x => serviceName(x.service) }, { key: 'partnerName', label: 'Partner' },
        { key: 'pallets', label: 'Pallets', right: true }, { key: 'target', label: 'Target / last °C', render: x => x.targetTemperatureC != null ? `${x.targetTemperatureC} / ${x.lastTemperatureC ?? '-'}` : '' },
        { key: 'hoursRun', label: 'Hours', right: true, render: x => x.startedAt ? num(x.hoursRun, 2) : '' },
        { key: 'billedQty', label: 'To bill', right: true, render: x => x.billedQty != null ? `${num(x.billedQty)} ${String(x.billingUnit).toLowerCase()}` : '' },
        { key: 'status', label: 'Status', render: x => <><span className={pill(x.status)}>{x.status}</span>{x.targetReached === false && <b className="ml-1 text-red-700">target missed</b>}</> },
      ]} />
    </Section>
    {sel && <Section title={<>{sel.jobNo} · {serviceName(sel.service)} <span className={pill(sel.status)}>{sel.status}</span></>} right={me.staff && <div className="flex gap-2">
      {sel.status === 'PLANNED' && <button className={btn} onClick={() => { const t = thermal ? window.prompt(`Core temperature at the start (${unitNow('temp')}, optional)`) : ''; if (t === null) return; void act('start', { temperatureC: toBase('temp', t) || undefined }); }}>Start</button>}
      {['PLANNED', 'RUNNING'].includes(sel.status) && <button className={btnRed} onClick={() => { const reason = window.prompt('Why is the job cancelled?'); if (reason) void act('cancel', { reason }); }}>Cancel</button>}
    </div>}>
      <div className="grid gap-1 text-sm md:grid-cols-3">
        <div>{sel.partnerName} · {sel.warehouseName}{sel.chamberName ? ` · ${sel.chamberName}` : ''}</div>
        <div>{sel.targetTemperatureC != null ? `Target ${fmtTemp(sel.targetTemperatureC)}` : ''} {sel.endTemperatureC != null ? `· ended at ${fmtTemp(sel.endTemperatureC)}` : ''} {sel.targetReached != null ? (sel.targetReached ? '· reached' : '· NOT reached') : ''}</div>
        <div>Billed {String(sel.billingUnit).toLowerCase()}{sel.billedQty != null ? `: ${num(sel.billedQty)}` : ''}</div>
        <div>Started {when(sel.startedAt)} {sel.startedBy || ''}</div><div>Ended {when(sel.endedAt)} {sel.endedBy || ''}</div><div>{sel.resultNote || sel.cancelledReason || sel.description || ''}</div>
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div><div className="font-semibold">Pallets</div><Table rows={sel.palletList || []} cols={[
          { key: 'palletCode', label: 'Pallet' }, { key: 'productName', label: 'Product' }, { key: 'quantity', label: 'Quantity', right: true, render: x => qty(x.quantity, x.uom) },
          { key: 'weightBeforeKg', label: 'Kg before', right: true }, { key: 'weightAfterKg', label: 'Kg after', right: true }, { key: 'stockState', label: 'State', render: x => <span className={pill(x.stockState)}>{x.stockState}</span> },
        ]} /></div>
        <div><div className="font-semibold">Temperature record</div><Table rows={sel.readings || []} empty="No readings." cols={[
          { key: 'readAt', label: 'Time', render: x => when(x.readAt) }, { key: 'temperatureC', label: '°C', right: true }, { key: 'probe', label: 'Probe' }, { key: 'note', label: 'Note' }, { key: 'readBy', label: 'By' },
        ]} />
          {me.staff && sel.status === 'RUNNING' && <div className="mt-2"><QuickForm cols={3} busy={r.busy} submitText="Add reading" fields={[
            { name: 'temperatureC', label: 'Temperature', type: 'number', required: true, unit: 'temp' }, { name: 'probe', label: 'Probe', type: 'select', options: [['CORE', 'Core'], ['AIR', 'Air'], ['SURFACE', 'Surface']], required: true },
            { name: 'note', label: 'Note' }]} onSubmit={(v, f) => r.run(() => post(`/api/warehouse/vas/${sel.id}/readings`, v), async (d: any) => { f.reset(); await changed(d); })} /></div>}
        </div>
      </div>
      {me.staff && sel.status === 'RUNNING' && <EndJob sel={sel} thermal={thermal} r={r} onEnd={(body: any) => act('end', body)} />}
      {me.staff && <div className="mt-3 flex items-center gap-2 text-sm">Photos: <Photos photos={sel.photos} entityType="VAS_JOB" entityId={sel.id} onAdded={() => open(sel.id)} /></div>}
    </Section>}
  </>;
}

function EndJob({ sel, thermal, r, onEnd }: any) {
  const [weights, setWeights] = useState<Record<string, string>>({});
  return <div className="mt-4 rounded-xl bg-slate-50 p-3"><div className="mb-1 font-semibold">End the job</div>
    {(sel.palletList || []).length > 0 && <div className="mb-2 flex flex-wrap gap-2 text-sm">{sel.palletList.map((p: any) => <label key={p.palletCode} className="flex items-center gap-1">{p.palletCode} kg
      <input type="number" step="any" className="w-24 rounded-lg border px-1 py-0.5" value={weights[p.palletCode] ?? ''} onChange={e => setWeights({ ...weights, [p.palletCode]: e.target.value })} /></label>)}</div>}
    <QuickForm cols={3} busy={r.busy} submitText="End" fields={[
      ...(thermal ? [{ name: 'endTemperatureC', label: 'Core temperature at the end', type: 'number' as const, required: true, unit: 'temp' as const }] : []),
      { name: 'billedQty', label: `To bill (${String(sel.billingUnit).toLowerCase()}; empty = worked out)`, type: 'number' }, { name: 'resultNote', label: 'Result / what happened', wide: true }]}
      onSubmit={v => onEnd({ ...v, weights: Object.entries(weights).filter(([, kg]) => kg).map(([palletCode, weightKg]) => ({ palletCode, weightKg })) })} />
  </div>;
}
