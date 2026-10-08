/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-013 -- Packaging & Time Out of Cold Storage. Staff only.
//   Packing: the insulated box or shipper, coolant (gel packs, dry ice, PCM) and its conditioning used for a
//     shipment, and how long the packaging keeps the goods in range. A warning when the planned delivery is after
//     that time (at risk), or the delivery was late.
//   Time out of cold storage: every period the goods were outside a cold room or reefer (dock, staging, cross-dock).
//     The warehouse scans add the periods of outbound orders and receipts by themselves; staff add the others.
//     The total per shipment is checked against the limit of the product, its temperature profile, its category or
//     the default, and staff are told once when it is over.
//   Packaging types and limits: the masters (a Manager sets the limits).
// Backend: /api/coldchain/packaging (PackagingController). Needs database_v2/66_cold_chain_records.sql.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Package } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DataTable } from '@/shared/components/DataTable';
import { COOLANT_KINDS, PACK_KINDS, SCRIPT66, at, duration, notReady, nowIndia, opts, send, temp, who, words } from './records';
import { Pill, Tabs, Tiles } from './ui';

const SHIP_TYPES: [string, string][] = [['OUTBOUND_ORDER', 'Outbound order'], ['TRIP', 'Trip'], ['TRIP_LOAD', 'Load on a trip'], ['RECEIPT', 'Receipt']];

export function PackagingPage() {
  const me = who();
  const [tab, setTab] = useState('PACKING');
  const [status, setStatus] = useState<any>(null), [look, setLook] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [types, setTypes] = useState<any[]>([]), [limits, setLimits] = useState<any>(null), [exposure, setExposure] = useState<any>(null);
  const [days, setDays] = useState(30), [overOnly, setOverOnly] = useState(false);
  const [shipQ, setShipQ] = useState(''), [ships, setShips] = useState<any[]>([]);
  const [packing, setPacking] = useState(false), [addingEvent, setAddingEvent] = useState(false), [editType, setEditType] = useState<any>(null), [addingLimit, setAddingLimit] = useState(false);

  useEffect(() => { api('/api/coldchain/records/status').then(setStatus).catch(() => setStatus({ ready: true })); }, []);
  useEffect(() => { if (status?.ready) api('/api/coldchain/records/lookups').then(setLook).catch(() => setLook({})); }, [status]);
  useEffect(() => { if (status?.ready) api('/api/coldchain/packaging/types').then(x => setTypes(x?.types || [])).catch(() => setTypes([])); }, [status, reload]);
  useEffect(() => {
    if (!status?.ready) return;
    if (tab === 'LIMITS') api('/api/coldchain/packaging/limits').then(setLimits).catch(e => setErr(errorText(e, 'The limits could not be read.')));
    if (tab === 'EXPOSURE') api(`/api/coldchain/packaging/exposure?days=${days}${overOnly ? '&over=true' : ''}`).then(setExposure).catch(e => setErr(errorText(e, 'The time out of cold storage could not be read.')));
  }, [status, tab, reload, days, overOnly]);
  useEffect(() => {
    if (!status?.ready || (!packing && !addingEvent)) return;
    const t = setTimeout(() => api(`/api/coldchain/packaging/shipments?q=${encodeURIComponent(shipQ)}`).then(x => setShips(x?.shipments || [])).catch(() => setShips([])), 300);
    return () => clearTimeout(t);
  }, [status, packing, addingEvent, shipQ]);

  if (notReady(status)) return <><h1 className="text-3xl font-bold">Packaging &amp; Time Out of Cold Storage</h1><NotReady script={status.script || SCRIPT66} /></>;

  async function run(fn: () => Promise<any>, after?: () => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(); setReload(r => r + 1); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const shipField = { name: 'ship', label: 'Shipment', type: 'select' as const, required: true, options: ships.map((s: any) => [`${s.type}:${s.id}`, s.label] as [string, string]) };
  const split = (v: Record<string, unknown>) => { const [shipmentType, shipmentId] = String(v.ship || ':').split(':'); const { ship: _ship, ...rest } = v; void _ship; return { ...rest, shipmentType, shipmentId }; };
  const boxes = types.filter(t => t.active && !COOLANT_KINDS.includes(t.kind)), coolants = types.filter(t => t.active && COOLANT_KINDS.includes(t.kind));
  const shipFinder = <div className="mb-3 max-w-md"><span className={label}>Find the shipment (order, trip or receipt number)</span><input className={input} value={shipQ} onChange={e => setShipQ(e.target.value)} placeholder="TEST-OB-0001" /></div>;

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Package />Packaging &amp; Time Out of Cold Storage</h1>
        <p className="text-slate-600">The packaging and coolant of each shipment and how long it keeps the goods in range, and the time goods spent outside cold storage.</p>
      </div>
      <div className="flex gap-2">
        {tab === 'PACKING' && <button className={btn} onClick={() => setPacking(!packing)}>{packing ? 'Cancel' : 'Record packing'}</button>}
        {tab === 'EXPOSURE' && <button className={btn} onClick={() => setAddingEvent(!addingEvent)}>{addingEvent ? 'Cancel' : 'Record time out'}</button>}
        {tab === 'TYPES' && <button className={btn} onClick={() => setEditType({})}>Add a packaging type</button>}
        {tab === 'LIMITS' && me.manager && <button className={btn} onClick={() => setAddingLimit(!addingLimit)}>{addingLimit ? 'Cancel' : 'Set a limit'}</button>}
      </div>
    </div>
    <Banner msg={msg} error={err} />
    <Tabs tabs={[['PACKING', 'Packing records'], ['EXPOSURE', 'Time out of cold storage'], ['TYPES', 'Packaging types'], ['LIMITS', 'Limits']]} value={tab} onChange={setTab} />

    {tab === 'PACKING' && <>
      {packing && <Section title="Record packing">
        {shipFinder}
        <QuickForm cols={3} busy={busy} submitText="Save packing" onCancel={() => setPacking(false)} onSubmit={v => run(() => send('/api/coldchain/packaging/packings', split(v)), () => setPacking(false))} fields={[
          shipField,
          { name: 'packagingTypeId', label: 'Packaging', type: 'select', required: true, options: boxes.map(t => [t.id, `${t.name}${t.qualifiedHours ? ` (${Number(t.qualifiedHours)} h)` : ''}`]) },
          { name: 'units', label: 'Units', type: 'number', step: '1', required: true },
          { name: 'coolantTypeId', label: 'Coolant', type: 'select', options: coolants.map(t => [t.id, t.name]) }, { name: 'coolantUnits', label: 'Coolant units', type: 'number', step: '1' },
          { name: 'coolantConditionedAt', label: 'Coolant conditioned at', placeholder: 'YYYY-MM-DD HH:MM' },
          { name: 'packedAt', label: 'Packed at', placeholder: 'YYYY-MM-DD HH:MM', hint: 'Blank: now.' }, { name: 'note', label: 'Note', wide: true },
        ]} />
      </Section>}
      <Section title="Packing records">
        <DataTable path="/api/coldchain/packaging/packings" exportName="PackingRecords" reloadKey={reload} searchPlaceholder="Search packaging, packed by, note"
          filters={[{ name: 'shipmentType', label: 'Shipment', options: SHIP_TYPES }, { name: 'packedAt', label: 'Packed', range: 'date' }]}
          columns={[
            { key: 'shipmentLabel', label: 'Shipment', render: r => <>{r.tripId ? <Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">{r.shipmentLabel}</Link> : r.shipmentLabel}</> },
            { key: 'packagingName', label: 'Packaging', render: r => <>{r.units} × {r.packagingName}{r.coolantName ? <div className="text-xs text-slate-500">{r.coolantUnits ?? ''} × {r.coolantName}{r.coolantConditionedAt ? `, conditioned ${at(r.coolantConditionedAt)}` : ''}</div> : null}</> },
            { key: 'packedAt', label: 'Packed', sort: 'packed', render: r => <>{at(r.packedAt)}<div className="text-xs text-slate-500">{r.packedByName}</div></> },
            { key: 'qualifiedUntil', label: 'Keeps range until', sort: 'until', render: r => r.qualifiedUntil ? at(r.qualifiedUntil) : '-' },
            { key: 'plannedDelivery', label: 'Delivery', render: r => r.actualDelivery ? `${at(r.actualDelivery)} (done)` : r.plannedDelivery ? `${at(r.plannedDelivery)} (planned)` : '-' },
            { key: 'state', label: 'State', render: r => <><Pill state={r.state} />{r.warning ? <div className="mt-1 max-w-xs text-xs text-amber-800">{r.warning}</div> : null}</> },
            { key: 'id', label: '', render: r => <button className={btnRed} disabled={busy} onClick={() => window.confirm('Remove this packing record?') && run(() => send(`/api/coldchain/packaging/packings/${r.id}/remove`))}>Remove</button> },
          ]} />
      </Section>
    </>}

    {tab === 'EXPOSURE' && <>
      {addingEvent && <Section title="Record time out of cold storage">
        {shipFinder}
        <QuickForm cols={3} busy={busy} submitText="Save" onCancel={() => setAddingEvent(false)} onSubmit={v => run(() => send('/api/coldchain/packaging/exposure', split(v)), () => setAddingEvent(false))} fields={[
          shipField, { name: 'place', label: 'Where', required: true, placeholder: 'Dock 2' }, { name: 'reason', label: 'Why', required: true, placeholder: 'Truck late at the dock' },
          { name: 'startedAt', label: 'Out from', required: true, placeholder: 'YYYY-MM-DD HH:MM' }, { name: 'endedAt', label: 'Back at (blank: still out)', placeholder: 'YYYY-MM-DD HH:MM' },
        ]} />
      </Section>}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-slate-700">Period<select className={input} value={days} onChange={e => setDays(Number(e.target.value))}>{[7, 30, 90, 365].map(d => <option key={d} value={d}>Last {d} days</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={overOnly} onChange={e => setOverOnly(e.target.checked)} />Over the limit only</label>
      </div>
      <Tiles items={[['Shipments', exposure?.shipments?.length ?? '-'], ['Over the limit', exposure?.over ?? '-', exposure?.over ? 'OVER' : undefined], ['Default limit', exposure ? `${exposure.defaultMinutes} min` : '-']]} />
      <Section title="Shipments with time out of cold storage">
        {!exposure ? <p className="text-slate-500">Loading...</p> : !exposure.shipments?.length ? <p className="text-slate-500">No time out of cold storage in this period.</p> :
          <div className="space-y-3">{exposure.shipments.map((s: any) => <div key={`${s.shipmentType}${s.shipmentId}`} className={`rounded-xl border p-3 ${s.over ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold">{s.shipmentLabel}{s.tripId ? <Link to={`/trips/${s.tripId}`} className="ml-2 text-xs font-bold text-sky-700 hover:underline">trip</Link> : null}</div>
              <div className="flex items-center gap-2 text-sm"><b>{duration(s.totalMinutes)}</b> of {duration(s.limitMinutes)} allowed <span className="text-xs text-slate-500">({words(s.limitFrom)})</span>
                {s.over ? <Pill state="OVER" text="Over the limit" /> : <Pill state="OK" text="Within" />}{s.open ? <Pill state="OPEN" text="Still out" /> : null}</div>
            </div>
            <table className="mt-2 w-full text-sm"><tbody>{(s.events || []).map((e: any) => <tr key={e.id} className="border-t">
              <td className="py-1 pr-2 whitespace-nowrap">{at(e.startedAt)} → {e.endedAt ? at(e.endedAt) : 'still out'}</td><td className="pr-2">{duration(e.minutes)}</td>
              <td className="pr-2">{e.place || '-'}</td><td className="pr-2">{e.reason || '-'}</td><td className="pr-2 text-xs text-slate-500">{e.source === 'AUTO' ? 'from the warehouse scans' : e.recordedByName}</td>
              <td className="whitespace-nowrap py-1">{!e.endedAt && <button className={btnLight} disabled={busy} onClick={() => run(() => send(`/api/coldchain/packaging/exposure/${e.id}/end`, { endedAt: nowIndia() }))}>Back in cold storage now</button>}
                {e.source !== 'AUTO' && <button className={`${btnRed} ml-1`} disabled={busy} onClick={() => window.confirm('Remove this period?') && run(() => send(`/api/coldchain/packaging/exposure/${e.id}/remove`))}>Remove</button>}</td>
            </tr>)}</tbody></table>
          </div>)}</div>}
      </Section>
    </>}

    {tab === 'TYPES' && <>
      {editType && <Section title={editType.id ? `Edit ${editType.code}` : 'Add a packaging type'}>
        <QuickForm cols={3} initial={editType} busy={busy} submitText="Save" onCancel={() => setEditType(null)}
          onSubmit={v => run(() => send(editType.id ? `/api/coldchain/packaging/types/${editType.id}` : '/api/coldchain/packaging/types', v, editType.id ? 'PUT' : 'POST'), () => setEditType(null))} fields={[
            { name: 'code', label: 'Code', required: true }, { name: 'name', label: 'Name', required: true }, { name: 'kind', label: 'Kind', type: 'select', options: opts(PACK_KINDS), required: true },
            { name: 'qualifiedHours', label: 'Keeps the range for (hours)', type: 'number', step: '0.5', hint: 'From the qualification report of the box or shipper.' },
            { name: 'rangeMinC', label: 'Range from', type: 'number', step: 'any', unit: 'temp' }, { name: 'rangeMaxC', label: 'to', type: 'number', step: 'any', unit: 'temp' },
            { name: 'ambientProfile', label: 'Ambient profile tested', placeholder: 'Ambient 25-35 °C' }, { name: 'conditioning', label: 'Conditioning of the coolant', placeholder: 'Gel packs at -20 °C for 24 h' },
            { name: 'active', label: 'In use', type: 'checkbox' }, { name: 'notes', label: 'Notes', wide: true },
          ]} />
      </Section>}
      <Section title="Packaging types">
        {!types.length ? <p className="text-slate-500">No packaging type yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Code</th><th>Name</th><th>Kind</th><th>Keeps range</th><th>Range</th><th>Conditioning</th><th>Used</th><th /></tr></thead>
          <tbody>{types.map(t => <tr key={t.id} className={`border-t align-top ${t.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{t.code}</td><td>{t.name}</td><td>{words(t.kind)}</td><td>{t.qualifiedHours != null ? `${Number(t.qualifiedHours)} h` : '-'}</td>
            <td>{t.rangeMinC != null || t.rangeMaxC != null ? `${temp(t.rangeMinC)} to ${temp(t.rangeMaxC)}` : '-'}</td><td className="max-w-xs text-xs">{t.conditioning || t.ambientProfile || '-'}</td><td>{t.used ?? 0}</td>
            <td><button className={btnLight} onClick={() => setEditType(t)}>Edit</button></td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'LIMITS' && <>
      {addingLimit && <Section title="Set a limit of time out of cold storage">
        <QuickForm cols={3} busy={busy} submitText="Save limit" onCancel={() => setAddingLimit(false)} onSubmit={v => run(() => send('/api/coldchain/packaging/limits', v), () => setAddingLimit(false))} fields={[
          { name: 'productId', label: 'Product', type: 'select', options: (look?.products || []).map((p: any) => [p.id, `${p.code} ${p.name}`]) },
          { name: 'temperatureProfileId', label: 'or temperature profile', type: 'select', options: (look?.profiles || []).map((p: any) => [p.id, p.name]) },
          { name: 'productCategory', label: 'or product category', placeholder: 'Frozen' },
          { name: 'maxMinutes', label: 'Most minutes out', type: 'number', step: '1', required: true }, { name: 'note', label: 'Note', wide: true },
        ]} />
        <p className="mt-1 text-xs text-slate-500">Fill one of product, profile or category. A product limit wins over its profile, which wins over its category; the default applies otherwise.</p>
      </Section>}
      <Section title="Limits">
        <p className="text-sm text-slate-600">Default for every product without a limit: <b>{limits?.defaultMinutes ?? '-'} min</b> (set on Hygiene &amp; Audit &gt; Settings).</p>
        {!limits?.limits?.length ? <p className="mt-2 text-slate-500">No limit set; the default applies.</p> : <table className="mt-2 w-full text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Applies to</th><th>Level</th><th>Most minutes out</th><th>Note</th><th>Updated</th><th /></tr></thead>
          <tbody>{limits.limits.map((l: any) => <tr key={l.id} className="border-t">
            <td className="p-2 font-semibold">{l.productName || l.profileName || l.productCategory}</td><td>{words(l.level)}</td><td>{l.maxMinutes} min</td><td>{l.note || '-'}</td><td className="text-xs">{at(l.updatedAt)} {l.updatedByName}</td>
            <td>{me.manager && <button className={btnRed} disabled={busy} onClick={() => window.confirm('Retire this limit?') && run(() => send(`/api/coldchain/packaging/limits/${l.id}/retire`))}>Retire</button>}</td></tr>)}</tbody></table>}
      </Section>
    </>}
  </>;
}
