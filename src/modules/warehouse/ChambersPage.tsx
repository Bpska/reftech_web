/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-002 chamber occupancy and temperature; REQ-WMS-015 chamber sensors (temperature, humidity, door, power,
// energy) with alerts.
//   Board    every chamber: pallet positions used and free, the latest readings, its state, open alerts.
//   Alerts   out of range, door open, power fail, no signal: take an alert, then resolve it with the cause and the
//            action once the chamber is back in range. Good pallets of a chamber out of range too long go ON HOLD.
//   Sensors  each sensor sends with its own key (shown once) to /api/device/chamber-readings; readings can also be
//            typed in. Chamber limits for humidity, door and silence.
//
// Backend: ChamberController (/api/warehouse/chambers/**).
import { useCallback, useEffect, useState } from 'react';
import { Thermometer } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btn, btnLight, input, label, num, pill, range, when, who } from './wms';
import { OPS_SCRIPT, StaffOnly, Table, Tabs, iso, opts, post, put, useRunner, useWarehouses } from './wmsOps';
import { fmtTemp } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { usePrefsFormat } from '@/shared/i18n/Units';

export function ChambersPage() {
  usePrefsFormat(); // REQ-PLT-015: show again at once when the login changes a unit, date format or time zone
  const me = who();
  const r = useRunner();
  const warehouses = useWarehouses();
  const [warehouseId, setWarehouseId] = useState('');
  const [tab, setTab] = useState('board');
  const [board, setBoard] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [alertStatus, setAlertStatus] = useState('OPEN');
  const [sensors, setSensors] = useState<any[]>([]);
  const [causes, setCauses] = useState<Record<string, string>>({});
  const [chamber, setChamber] = useState<any>(null);
  const [key, setKey] = useState('');

  const q = warehouseId ? `warehouseId=${warehouseId}` : '';
  const load = useCallback(async () => {
    try {
      setBoard(await api(`/api/warehouse/chambers/board?${q}`));
      const a = await api(`/api/warehouse/chambers/alerts?${q}&status=${alertStatus}`); setAlerts(a.alerts || []);
    } catch (x) { r.setError(String((x as Error).message)); }
  }, [q, alertStatus]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { if (!me.staff) return; const t = setInterval(() => void load(), 60000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (me.staff) api('/api/warehouse/chambers/causes').then(setCauses).catch(() => setCauses({})); }, []);
  useEffect(() => { if (me.staff && tab === 'sensors') api(`/api/warehouse/chambers/sensors?${q}`).then(d => setSensors(Array.isArray(d) ? d : d.sensors || [])).catch(() => setSensors([])); }, [tab, q]);

  async function openChamber(c: any) {
    const d = await r.run(() => api(`/api/warehouse/chambers/${c.id}/readings?limit=200`));
    if (d) setChamber({ ...d, boardRow: c });
  }

  if (!me.staff) return <StaffOnly title="Chambers" />;
  const chambers: any[] = board?.chambers || [];

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Thermometer className="h-8 w-8 text-sky-700" />Chambers & Sensors</h1>
    <p className="text-slate-600">Space used in each chamber, its temperature, humidity, door, power and energy, and the alerts. Refreshes every minute.</p>
    <Banner msg={r.msg} error={r.error} />
    {board?.ready === false && <NotReady script={OPS_SCRIPT} />}
    <div className="mt-3 flex flex-wrap items-end gap-3">
      <div><label className={label}>Warehouse</label><select className={input} value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">All</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
      <Tabs tabs={[['board', 'Board'], ['alerts', `Alerts${alerts.length ? ` (${alerts.length})` : ''}`], ['sensors', 'Sensors & readings']]} value={tab} onChange={setTab} />
    </div>

    {tab === 'board' && <>
      {board?.chambers && <div className="mt-3 text-sm text-slate-600">All chambers: <b>{board.used}</b> of <b>{board.positions}</b> pallet positions used.</div>}
      <div className="mt-3 grid gap-3 md:grid-cols-3">{chambers.map(c => {
        const l = c.latest || {};
        return <button key={c.id} onClick={() => openChamber(c)} className={`rounded-2xl bg-white p-4 text-left shadow-sm hover:ring-2 hover:ring-sky-300 ${c.openAlerts ? 'ring-2 ring-red-300' : ''}`}>
          <div className="flex items-center justify-between"><div className="font-bold">{c.name}</div><span className={pill(c.state)}>{String(c.state).replace(/_/g, ' ')}</span></div>
          <div className="text-xs text-slate-500">{c.warehouseName} · {range(c.minTemperatureC, c.maxTemperatureC)}</div>
          <div className="mt-2 text-3xl font-bold">{l.temperatureC != null ? fmtTemp(l.temperatureC) : '—'}</div>
          <div className="text-xs text-slate-500">{l.temperatureCAt ? `${when(l.temperatureCAt)} (${l.temperatureCAgeMinutes} min ago)` : 'no reading'} · 24h {c.min24h == null ? '-' : fmtTemp(c.min24h)} to {c.max24h == null ? '-' : fmtTemp(c.max24h)}</div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs">
            <div>Humidity<br /><b>{l.humidityPct != null ? `${num(l.humidityPct, 1)}%` : '-'}</b></div>
            <div>Door<br /><b className={l.doorOpen ? 'text-amber-700' : ''}>{l.doorOpen == null ? '-' : l.doorOpen ? 'OPEN' : 'closed'}</b></div>
            <div>Power<br /><b className={l.powerOn === false ? 'text-red-700' : ''}>{l.powerOn == null ? '-' : l.powerOn ? 'on' : 'OFF'}</b></div>
          </div>
          <div className="mt-3 h-2 rounded bg-slate-100"><div className={`h-2 rounded ${Number(c.usedPct) > 90 ? 'bg-red-500' : Number(c.usedPct) > 75 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, Number(c.usedPct || 0))}%` }} /></div>
          <div className="mt-1 text-xs">{c.used} of {c.positions} positions used · {c.free} free{c.usedPct != null ? ` · ${c.usedPct}%` : ''}{c.palletsOnHold ? ` · ${c.palletsOnHold} not good` : ''} · {num(c.storedKg, 0)} kg</div>
          <div className="mt-1 text-xs text-slate-500">{c.sensors} sensor(s){c.openAlerts ? <b className="text-red-700"> · {c.openAlerts} open alert(s)</b> : ''}</div>
        </button>;
      })}</div>
      {chamber && <ChamberDetail d={chamber} manager={me.manager} r={r} onSaved={async () => { await load(); await openChamber(chamber.boardRow); }} />}
    </>}

    {tab === 'alerts' && <Section title="Alerts" right={<select className={input} value={alertStatus} onChange={e => setAlertStatus(e.target.value)}>
      <option value="OPEN">Open</option><option value="RESOLVED">Resolved</option><option value="ALL">All</option></select>}>
      <Table rows={alerts} empty="No alerts." cols={[
        { key: 'firstAt', label: 'Since', render: x => when(x.firstAt) }, { key: 'chamberName', label: 'Chamber', render: x => `${x.chamberName} · ${x.warehouseName}` },
        { key: 'alertType', label: 'Alert', render: x => <><b>{String(x.alertType).replace(/_/g, ' ')}</b> <span className="text-xs">{x.severity}</span><div className="text-xs text-slate-600">{x.message}</div></> },
        { key: 'worstValue', label: 'Worst / last', render: x => x.worstValue != null ? `${num(x.worstValue, 1)} / ${num(x.lastValue, 1)}` : '-' },
        { key: 'backInRangeAt', label: 'Back in range', render: x => when(x.backInRangeAt) },
        { key: 'escalationLevel', label: 'Escalated', render: x => x.escalationLevel ? `level ${x.escalationLevel}` : '' },
        { key: 'palletsHeld', label: 'Pallets held', render: x => x.holdApplied ? x.palletsHeld : '' },
        { key: 'status', label: 'Status', render: x => <><span className={pill(x.status)}>{x.status}</span>{x.acknowledgedBy && <div className="text-xs">{x.acknowledgedBy}</div>}{x.cause && <div className="text-xs">{causes[x.cause] || x.cause}: {x.actionTaken}</div>}</> },
        { key: 'act', label: '', render: x => x.status === 'RESOLVED' ? null : <div className="flex gap-1">
          {x.status === 'OPEN' && <button className={btnLight} onClick={() => r.run(() => post(`/api/warehouse/chambers/alerts/${x.id}/acknowledge`), load)}>Take</button>}
          <button className={btn} onClick={() => {
            const list = Object.entries(causes).map(([k, v], i) => `${i + 1}. ${v}`).join('\n');
            const pick = window.prompt(`Cause (number):\n${list}`); if (!pick) return;
            const cause = Object.keys(causes)[Number(pick) - 1]; if (!cause) return;
            const action = window.prompt('What was done?'); if (!action) return;
            void r.run(() => post(`/api/warehouse/chambers/alerts/${x.id}/resolve`, { cause, action }), load);
          }}>Resolve</button></div> },
      ]} />
    </Section>}

    {tab === 'sensors' && <>
      <Section title="Type in a reading">
        <QuickForm cols={4} busy={r.busy} submitText="Save the reading" fields={[
          { name: 'chamberId', label: 'Chamber', type: 'select', options: opts(chambers, c => `${c.name} · ${c.warehouseName}`), required: true },
          { name: 'readAt', label: 'Read at', placeholder: 'now, or yyyy-mm-ddThh:mm' }, { name: 'temperatureC', label: 'Temperature', type: 'number', unit: 'temp' },
          { name: 'humidityPct', label: 'Humidity (%)', type: 'number' }, { name: 'doorOpen', label: 'Door', type: 'select', options: [['false', 'Closed'], ['true', 'Open']] },
          { name: 'powerOn', label: 'Power', type: 'select', options: [['true', 'On'], ['false', 'Off']] }, { name: 'energyKwh', label: 'Energy meter (kWh)', type: 'number' }]}
          onSubmit={v => r.run(() => post('/api/warehouse/chambers/readings', { ...v, readAt: iso(v.readAt), doorOpen: v.doorOpen === '' ? undefined : v.doorOpen === 'true', powerOn: v.powerOn === '' ? undefined : v.powerOn === 'true' }), load)} />
      </Section>
      <Section title="Sensors">
        {key && <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm">Device key (copy it now, it is not shown again): <code className="select-all font-mono font-bold">{key}</code>
          <div className="text-xs text-slate-600">The device sends JSON to POST /api/device/chamber-readings with the header X-Device-Key, e.g. {'{"temperatureC": -18.2, "humidityPct": 70, "doorOpen": false, "powerOn": true, "energyKwh": 1520.4}'}</div></div>}
        <Table rows={sensors} cols={[
          { key: 'sensorCode', label: 'Sensor' }, { key: 'name', label: 'Name' }, { key: 'chamberName', label: 'Chamber' }, { key: 'measures', label: 'Measures' },
          { key: 'keyHint', label: 'Key', render: x => x.keyHint ? `…${x.keyHint}` : '-' }, { key: 'lastSeenAt', label: 'Last reading', render: x => when(x.lastSeenAt) },
          { key: 'active', label: 'Active', render: x => x.active ? 'Yes' : 'No' },
          { key: 'act', label: '', render: x => me.manager && <div className="flex gap-1">
            <button className={btnLight} onClick={() => { if (window.confirm('Make a new key? The old key stops working.')) void r.run(() => post(`/api/warehouse/chambers/sensors/${x.id}/key`), (d: any) => setKey(d.deviceKey)); }}>New key</button>
            <button className={btnLight} onClick={() => r.run(() => post(`/api/warehouse/chambers/sensors/${x.id}/active`, { active: !x.active }), () => api(`/api/warehouse/chambers/sensors?${q}`).then(d => setSensors(Array.isArray(d) ? d : d.sensors || [])))}>{x.active ? 'Switch off' : 'Switch on'}</button>
          </div> },
        ]} />
        {me.manager && <div className="mt-4"><div className="mb-1 font-semibold">Add a sensor</div><QuickForm cols={4} busy={r.busy} submitText="Add" fields={[
          { name: 'chamberId', label: 'Chamber', type: 'select', options: opts(chambers, c => `${c.name} · ${c.warehouseName}`), required: true },
          { name: 'sensorCode', label: 'Sensor code', required: true }, { name: 'name', label: 'Name' },
          { name: 'measures', label: 'Measures', placeholder: 'TEMPERATURE,HUMIDITY,DOOR,POWER,ENERGY' }]}
          onSubmit={(v, f) => r.run(() => post('/api/warehouse/chambers/sensors', v), async (d: any) => { setKey(d.deviceKey); f.reset(); const d2 = await api(`/api/warehouse/chambers/sensors?${q}`); setSensors(Array.isArray(d2) ? d2 : d2.sensors || []); })} /></div>}
      </Section>
    </>}
  </>;
}

function ChamberDetail({ d, manager, r, onSaved }: any) {
  const c = d.boardRow;
  return <Section title={`${c.name} · ${c.warehouseName}`}>
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <div className="mb-1 font-semibold">Latest readings</div>
        <Table rows={(d.readings || []).slice(0, 30)} cols={[
          { key: 'readAt', label: 'Time', render: x => when(x.readAt) }, { key: 'temperatureC', label: '°C', right: true }, { key: 'humidityPct', label: '%RH', right: true },
          { key: 'doorOpen', label: 'Door', render: x => x.doorOpen == null ? '' : x.doorOpen ? 'open' : 'closed' }, { key: 'powerOn', label: 'Power', render: x => x.powerOn == null ? '' : x.powerOn ? 'on' : 'OFF' },
          { key: 'source', label: 'From', render: x => x.source === 'MANUAL' ? `typed (${x.enteredBy || ''})` : x.sensorCode || 'device' },
        ]} />
      </div>
      <div>
        <div className="mb-1 font-semibold">Energy per day</div>
        <Table rows={d.energyPerDay || []} empty="No energy meter readings." cols={[{ key: 'day', label: 'Day' }, { key: 'kwh', label: 'kWh', right: true, render: x => num(x.kwh) }]} />
        {manager && <div className="mt-4"><div className="mb-1 font-semibold">Chamber limits</div>
          <QuickForm cols={2} busy={r.busy} submitText="Save limits" initial={c} fields={[
            { name: 'humidityMinPct', label: 'Humidity from (%)', type: 'number' }, { name: 'humidityMaxPct', label: 'Humidity to (%)', type: 'number' },
            { name: 'doorAlertMinutes', label: 'Door open alert after (min)', type: 'number' }, { name: 'silentAlertMinutes', label: 'No signal alert after (min)', type: 'number' }]}
            onSubmit={v => r.run(() => put(`/api/warehouse/chambers/${c.id}/limits`, v), onSaved)} />
          <p className="text-xs text-slate-500">The temperature range is the chamber's own (Warehouse Layout).</p></div>}
      </div>
    </div>
  </Section>;
}
