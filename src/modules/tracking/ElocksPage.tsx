/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-010 -- Electronic Locks on truck doors and chamber doors. A lock opens only with a one-time code; a truck
// lock only at the planned stop of the code. Every open, close, tamper and code tried is listed here and on the trip
// timeline; one away from a planned stop raises a control tower alert (ELOCK_OPEN_AWAY, ELOCK_TAMPER).
// RefTech staff (TRACKING_VIEW); locks and their device keys are kept by a Manager or an Admin.
// The lock vendor's own API is not connected: the lock (or its cloud) calls /api/device/elocks/** with its key.
//
// Backend: ElockController (/api/tracking/elocks/**, /api/device/elocks/**).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LockKeyhole } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btnLight, btnRed, input } from '@/modules/warehouse/wms';
import { StaffOnly, Table, Tabs, post, useRunner, useWarehouses } from '@/modules/warehouse/wmsOps';
import { who } from '@/modules/warehouse/wms';
import { when } from './tower';
import { ELOCK_SCRIPT, batteryStyle, codeFormProblem, eventName, eventStyle, placeText, statePill } from './elocks';

const API = '/api/tracking/elocks';

export function ElocksPage() {
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const [ready, setReady] = useState<boolean | null>(null);
  const [manager, setManager] = useState(false);
  const [tab, setTab] = useState('locks');
  const [locks, setLocks] = useState<any[]>([]);
  const [lockId, setLockId] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [shown, setShown] = useState<{ title: string; text: string } | null>(null);
  const chambers = useMemo(() => warehouses.flatMap((w: any) => (w.chambers || []).map((c: any) => ({ ...c, warehouseName: w.name }))), [warehouses]);
  const lock = locks.find(l => String(l.id) === lockId);

  const load = useCallback(async () => {
    try {
      const d = await api(API); setReady(d.ready !== false);
      if (d.ready === false) return;
      setManager(!!d.manager); setLocks(d.locks || []);
      const q = lockId ? `lockId=${lockId}` : '';
      const [e, c] = await Promise.all([api(`${API}/events?${q}&limit=200`), api(`${API}/codes?${q}`)]);
      setEvents(e.events || []); setCodes(c.codes || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [lockId]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { if (lockId && lock?.lockKind === 'TRUCK_DOOR') api(`${API}/${lockId}/trips`).then(d => setTrips(d.trips || [])).catch(() => setTrips([])); else setTrips([]); }, [lockId, lock?.lockKind]);

  if (!me.staff) return <StaffOnly title="Electronic Locks" />;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><LockKeyhole className="h-8 w-8 text-sky-700" />Electronic Locks</h1>
    <p className="text-slate-600">Locks on truck and chamber doors open only with a one-time code at the planned stop. Every open, close and tamper is recorded; one away from a stop goes to the control tower.</p>
    <Banner msg={r.msg} error={r.error} />
    {shown && <div className="my-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4">
      <div className="font-semibold">{shown.title}</div><div className="mt-1 select-all font-mono text-2xl tracking-widest">{shown.text}</div>
      <div className="mt-1 text-sm text-amber-800">Shown once only. Give it now; it cannot be shown again.</div>
      <button className={`${btnLight} mt-2`} onClick={() => setShown(null)}>Done</button></div>}
    {ready === false && <NotReady script={ELOCK_SCRIPT} />}
    {ready && <>
      <div className="flex flex-wrap items-center gap-2">
        <select className={`${input} max-w-sm`} value={lockId} onChange={e => setLockId(e.target.value)}><option value="">All locks</option>
          {locks.map(l => <option key={l.id} value={l.id}>{l.lockCode} · {l.vehicleNumber || l.chamberName || ''}</option>)}</select>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[['locks', 'Locks'], ['events', 'Events'], ['codes', 'One-time codes']]} />

      {tab === 'locks' && <>
        <Section title="Locks">
          <Table rows={locks} selected={lock?.id} onRow={x => setLockId(String(x.id))} empty="No locks registered." cols={[
            { key: 'lockCode', label: 'Lock' }, { key: 'name', label: 'Name' },
            { key: 'place', label: 'On', render: x => x.lockKind === 'TRUCK_DOOR' ? `Truck ${x.vehicleNumber} ${x.doorId || ''}` : `Chamber ${x.warehouseName || ''} / ${x.chamberName}` },
            { key: 'state', label: 'State', render: x => <span className={statePill(x.state)}>{x.state}</span> },
            { key: 'batteryPct', label: 'Battery', render: x => <span className={batteryStyle(x.batteryPct)}>{x.batteryPct != null ? `${x.batteryPct}%` : '-'}</span> },
            { key: 'lastSeenAt', label: 'Last heard', render: x => when(x.lastSeenAt) }, { key: 'runningTrip', label: 'Running trip' }, { key: 'openCodes', label: 'Codes', right: true },
            { key: 'vendor', label: 'Vendor', render: x => `${x.vendor || '-'}${x.keyHint ? ` · key …${x.keyHint}` : ''}` },
            { key: 'active', label: '', render: x => manager ? <div className="flex gap-1">
              <button className={btnLight} onClick={e => { e.stopPropagation(); if (window.confirm('Make a new device key? The old key stops working.')) void r.run(() => post(`${API}/${x.id}/key`), (d: any) => { setShown({ title: `New device key of ${x.lockCode}`, text: d.deviceKey }); }); }}>New key</button>
              <button className={x.active ? btnRed : btnLight} onClick={e => { e.stopPropagation(); void r.run(() => post(`${API}/${x.id}/active`, { active: !x.active }), load); }}>{x.active ? 'Switch off' : 'Switch on'}</button></div> : (x.active ? 'On' : 'Off') },
          ]} />
        </Section>
        {manager && <Section title="Register a lock">
          <QuickForm cols={4} busy={r.busy} submitText="Register" fields={[
            { name: 'lockCode', label: 'Lock serial / code', required: true }, { name: 'name', label: 'Name' },
            { name: 'lockKind', label: 'On', type: 'select', required: true, options: [['TRUCK_DOOR', 'Truck door'], ['CHAMBER_DOOR', 'Chamber door']] },
            { name: 'vehicleNumber', label: 'Truck number (truck door)' }, { name: 'chamberId', label: 'Chamber (chamber door)', type: 'select', options: chambers.map((c: any) => [String(c.id), `${c.warehouseName} / ${c.name}`]) },
            { name: 'doorId', label: 'Door', placeholder: 'REAR, SIDE, D1' }, { name: 'vendor', label: 'Vendor' }, { name: 'vendorRef', label: 'Vendor reference' }]}
            onSubmit={(v, f) => r.run(() => post(API, v), async (d: any) => { f.reset(); if (d?.deviceKey) setShown({ title: 'Device key of the new lock (set it in the lock or the vendor cloud)', text: d.deviceKey }); await load(); })} />
        </Section>}
      </>}

      {tab === 'events' && <>
        <Section title="Events">
          <Table rows={events} empty="No events." cols={[
            { key: 'capturedAt', label: 'When', render: x => <span className={eventStyle(x)}>{when(x.capturedAt)}</span> },
            { key: 'lockCode', label: 'Lock' }, { key: 'eventType', label: 'Event', render: x => <b className={eventStyle(x)}>{eventName(x.eventType)}</b> },
            { key: 'tripNumber', label: 'Trip' }, { key: 'place', label: 'Where', render: x => placeText(x) },
            { key: 'alertId', label: 'Tower alert', render: x => x.alertId ? `#${x.alertId} ${x.alertStatus || ''}` : '' },
            { key: 'source', label: 'From', render: x => x.source === 'DEVICE' ? 'Lock' : `Typed by ${x.enteredByName || '-'}` }, { key: 'note', label: 'Note' },
          ]} />
        </Section>
        {lock && <Section title={`Record an event of ${lock.lockCode} (when the lock reported it by phone or SMS)`}>
          <QuickForm cols={4} busy={r.busy} submitText="Record" fields={[
            { name: 'eventType', label: 'Event', type: 'select', required: true, options: [['OPEN', 'Opened'], ['CLOSE', 'Closed'], ['TAMPER', 'Tamper'], ['LOW_BATTERY', 'Battery low']] },
            { name: 'capturedAt', label: 'When', placeholder: 'yyyy-mm-ddThh:mm (empty = now)' }, { name: 'latitude', label: 'Latitude', type: 'number' }, { name: 'longitude', label: 'Longitude', type: 'number' },
            { name: 'batteryPct', label: 'Battery %', type: 'number' }, { name: 'note', label: 'Note', wide: true }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/${lock.id}/events`, { ...v, capturedAt: v.capturedAt ? new Date(String(v.capturedAt)).toISOString() : undefined }), async () => { f.reset(); await load(); })} />
        </Section>}
      </>}

      {tab === 'codes' && <>
        {lock && <IssueCode lock={lock} trips={trips} r={r} onIssued={async (d: any) => { setShown({ title: `One-time code for ${lock.lockCode}`, text: d.code }); await load(); }} />}
        {!lock && <div className="mt-3 text-slate-500">Choose a lock above to give a code.</div>}
        <Section title="Codes">
          <Table rows={codes} empty="No codes." cols={[
            { key: 'lockCode', label: 'Lock' }, { key: 'tripNumber', label: 'Trip' }, { key: 'stopName', label: 'Stop', render: x => x.stopName || (x.tripId ? 'any planned stop' : '-') },
            { key: 'issuedToName', label: 'Given to', render: x => `${x.issuedToName}${x.issuedToPhone ? ' ' + x.issuedToPhone : ''}` }, { key: 'purpose', label: 'For' },
            { key: 'validTo', label: 'Valid to', render: x => when(x.validTo) }, { key: 'wrongAttempts', label: 'Wrong tries', right: true },
            { key: 'status', label: 'Status', render: x => <><span className={statePill(x.status)}>{x.status}</span>{x.usedAt ? ` ${when(x.usedAt)}` : ''}</> },
            { key: 'id', label: '', render: x => x.status === 'ISSUED' ? <button className={btnRed} onClick={() => r.run(() => post(`${API}/codes/${x.id}/cancel`), load)}>Cancel</button> : null },
          ]} />
        </Section>
        {lock && <Section title={`Check a code for ${lock.lockCode} (the receiver read it out by phone)`}>
          <QuickForm cols={4} busy={r.busy} submitText="Check and open" fields={[
            { name: 'code', label: 'Code', required: true }, { name: 'latitude', label: 'Latitude (empty = last GPS point)', type: 'number' }, { name: 'longitude', label: 'Longitude', type: 'number' }]}
            onSubmit={(v, f) => r.run(() => post(`${API}/${lock.id}/unlock`, v), async (d: any) => { f.reset(); r.setMsg(d?.allow ? `Open: ${d.reason}` : ''); if (d && !d.allow) r.setError(`Not opened: ${d.reason}`); await load(); })} />
        </Section>}
      </>}
    </>}
  </>;
}

function IssueCode({ lock, trips, r, onIssued }: any) {
  const [tripId, setTripId] = useState('');
  const [err, setErr] = useState('');
  const trip = trips.find((t: any) => String(t.id) === tripId);
  const truck = lock.lockKind === 'TRUCK_DOOR';
  return <Section title={`Give a one-time code for ${lock.lockCode}`}>
    {truck && <div className="mb-3 max-w-md"><label className="text-sm font-semibold">Trip</label>
      <select className={input} value={tripId} onChange={e => setTripId(e.target.value)}><option value="">Choose…</option>
        {trips.map((t: any) => <option key={t.id} value={t.id}>{t.tripNumber} · {t.sourceCity} → {t.destinationCity} ({t.status})</option>)}</select></div>}
    {err && <div className="mb-2 text-red-700">{err}</div>}
    <QuickForm key={tripId} cols={4} busy={r.busy} submitText="Make code" fields={[
      ...(truck ? [{ name: 'plannedStopId', label: 'At stop (empty = any planned stop)', type: 'select' as const, options: (trip?.stops || []).map((s: any) => [String(s.id), s.name] as [string, string]) }] : []),
      { name: 'issuedToName', label: 'Given to', required: true }, { name: 'issuedToPhone', label: 'Phone' },
      { name: 'purpose', label: 'For', type: 'select', options: [['DELIVERY', 'Delivery'], ['PICKUP', 'Pickup'], ['WAREHOUSE', 'Warehouse'], ['INSPECTION', 'Inspection'], ['OTHER', 'Other']] },
      { name: 'validHours', label: 'Valid for (hours)', type: 'number' }]}
      onSubmit={(v, f) => {
        const p = codeFormProblem(lock.lockKind, { ...v, tripId }, trip ? (trip.stops || []).length : undefined);
        setErr(p);
        if (p) return;
        return r.run(() => post(`${API}/codes`, { ...v, lockId: lock.id, tripId: truck ? tripId : undefined }), async (d: any) => { f.reset(); await onIssued(d); });
      }} />
  </Section>;
}
