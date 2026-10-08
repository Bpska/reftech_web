/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-010 -- Sensors & Calibration. Staff only.
//   Register: every temperature sensor and logger (chamber, truck, compartment, reefer, portable probe) with its
//     make, serial number, accuracy and calibration due date. Calibrations with the lab certificate (PDF or photo).
//     Due soon and overdue sensors are shown here and sent to the managers each morning.
//   Readings: a reading taken by a sensor whose calibration was overdue on that day is marked; the graphs and the
//     proof certificate show the mark (amber triangle).
//   Mapping: temperature mapping studies of every chamber and truck, with the hot and cold spots and the report.
// A Manager or Admin can fill the register from the sensor codes already in use, and mark old readings again.
// Backend: /api/coldchain/sensors (SensorRegisterController). Needs database_v2/66_cold_chain_records.sql.
import { useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';
import { api, apiDownload, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DataTable } from '@/shared/components/DataTable';
import { CAL_RESULTS, SCRIPT66, SENSOR_KINDS, SENSOR_PLACES, day, notReady, opts, send, temp, who, words } from './records';
import { Pill, Tabs, Tiles } from './ui';
import { fmtTemp, fmtTempDelta } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function SensorsPage() {
  const me = who();
  const [tab, setTab] = useState('REGISTER');
  const [status, setStatus] = useState<any>(null), [counts, setCounts] = useState<any>(null), [look, setLook] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false), [open, setOpen] = useState<any>(null), [editing, setEditing] = useState(false);
  const [board, setBoard] = useState<any>(null), [studies, setStudies] = useState<any[]>([]), [addingStudy, setAddingStudy] = useState(false);
  const [placeType, setPlaceType] = useState('CHAMBER');

  useEffect(() => { api('/api/coldchain/records/status').then(setStatus).catch(() => setStatus({ ready: true })); }, []);
  useEffect(() => { if (status?.ready) api('/api/coldchain/records/lookups').then(setLook).catch(() => setLook({})); }, [status]);
  useEffect(() => { if (status?.ready) api('/api/coldchain/sensors/counts').then(setCounts).catch(() => undefined); }, [status, reload]);
  useEffect(() => {
    if (!status?.ready || tab !== 'MAPPING') return;
    api('/api/coldchain/sensors/mapping').then(setBoard).catch(e => setErr(errorText(e, 'The mapping board could not be read.')));
    api('/api/coldchain/sensors/mapping/studies').then(x => setStudies(x?.studies || [])).catch(() => setStudies([]));
  }, [status, tab, reload]);

  if (notReady(status)) return <><h1 className="text-3xl font-bold">Sensors &amp; Calibration</h1><NotReady script={status.script || SCRIPT66} /></>;

  async function run(fn: () => Promise<any>, after?: () => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(); setReload(r => r + 1); if (open?.sensor?.id) await openSensor(open.sensor.id); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  async function openSensor(id: number) {
    try { setOpen(await api(`/api/coldchain/sensors/${id}`)); setEditing(false); } catch (e) { setErr(errorText(e, 'The sensor could not be read.')); }
  }
  const places = (type: string): [string | number, string][] => {
    if (!look) return [];
    if (type === 'CHAMBER') return (look.chambers || []).map((c: any) => [c.id, `${c.name} (${c.warehouseName})`]);
    if (type === 'VEHICLE') return (look.vehicles || []).map((v: any) => [v.id, v.number]);
    if (type === 'COMPARTMENT') return (look.compartments || []).map((c: any) => [c.id, `${c.vehicleNumber} / ${c.name}`]);
    if (type === 'REEFER') return (look.reefers || []).map((r: any) => [r.id, `${r.vehicleNumber || 'No truck'} / ${[r.make, r.model, r.serialNo].filter(Boolean).join(' ') || `reefer ${r.id}`}`]);
    return [];
  };
  const sensorFields = (type: string) => [
    { name: 'sensorCode', label: 'Sensor code (as the device sends it)', required: true, placeholder: 'TEMP-01' },
    { name: 'kind', label: 'Kind', type: 'select' as const, options: opts(SENSOR_KINDS), required: true },
    ...(type === 'PORTABLE' ? [] : [{ name: 'placeId', label: `${words(type)} *`, type: 'select' as const, options: places(type), required: true }]),
    { name: 'placeLabel', label: 'Where exactly', placeholder: 'Rear door, top' },
    { name: 'make', label: 'Make' }, { name: 'model', label: 'Model' }, { name: 'serialNo', label: 'Serial number' },
    { name: 'accuracyC', label: 'Accuracy (± °C)', type: 'number' as const, step: '0.01' },
    { name: 'rangeMinC', label: 'Measuring range from', type: 'number' as const, step: 'any', unit: 'temp' as const }, { name: 'rangeMaxC', label: 'to', type: 'number' as const, step: 'any', unit: 'temp' as const },
    { name: 'lastCalibratedOn', label: 'Last calibrated on', type: 'date' as const }, { name: 'calibrationDue', label: 'Calibration due', type: 'date' as const },
    { name: 'certificateNo', label: 'Certificate number' }, { name: 'notes', label: 'Notes', wide: true },
  ];
  async function uploadCertificate(file: File | undefined, calibrationId?: number) {
    if (!file || !open) return;
    await run(() => apiUpload(`/api/coldchain/sensors/${open.sensor.id}/certificate${calibrationId ? `?calibrationId=${calibrationId}` : ''}`, { file }));
  }
  const s = open?.sensor;
  const c = counts || {};

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Gauge />Sensors &amp; Calibration</h1>
        <p className="text-slate-600">The register of temperature sensors, their calibration certificates and the mapping studies of chambers and trucks.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tab === 'REGISTER' && <button className={btn} onClick={() => { setAdding(!adding); setOpen(null); }}>{adding ? 'Cancel' : 'Add a sensor'}</button>}
        {tab === 'MAPPING' && <button className={btn} onClick={() => setAddingStudy(!addingStudy)}>{addingStudy ? 'Cancel' : 'Record a mapping study'}</button>}
        {me.manager && tab === 'REGISTER' && <button className={btnLight} disabled={busy} onClick={() => run(() => send('/api/coldchain/sensors/import'))}>Fill from sensors in use</button>}
        {me.manager && tab === 'REGISTER' && <button className={btnLight} disabled={busy} onClick={() => run(() => send('/api/coldchain/sensors/remark', { days: 90 }))}>Mark readings of the last 90 days again</button>}
      </div>
    </div>
    <Banner msg={msg} error={err} />
    <Tiles items={[
      ['Active sensors', c.sensorsActive ?? '-'], ['Calibration overdue', c.calibrationOverdue ?? '-', c.calibrationOverdue ? 'OVERDUE' : undefined],
      [`Due within ${c.dueSoonDays ?? 30} days`, c.calibrationDueSoon ?? '-', c.calibrationDueSoon ? 'DUE_SOON' : undefined], ['No due date', c.calibrationNotSet ?? '-'],
      ['Mapping overdue', c.mappingOverdue ?? '-', c.mappingOverdue ? 'OVERDUE' : undefined], ['Marked readings (30 days)', c.flaggedReadings30Days ?? '-', c.flaggedReadings30Days ? 'CAL_OVERDUE' : undefined],
    ]} />
    <Tabs tabs={[['REGISTER', 'Sensor register'], ['MAPPING', 'Mapping studies']]} value={tab} onChange={setTab} />

    {tab === 'REGISTER' && <>
      {adding && <Section title="Add a sensor">
        <div className="mb-3 max-w-xs"><span className={label}>Where is it fitted</span>
          <select className={input} value={placeType} onChange={e => setPlaceType(e.target.value)}>{SENSOR_PLACES.map(p => <option key={p} value={p}>{words(p)}</option>)}</select></div>
        <QuickForm key={placeType} fields={sensorFields(placeType)} busy={busy} submitText="Save sensor" onCancel={() => setAdding(false)}
          onSubmit={v => run(() => send('/api/coldchain/sensors', { ...v, placeType }), () => setAdding(false))} />
      </Section>}
      <Section title="Register">
        <DataTable path="/api/coldchain/sensors" exportName="SensorRegister" reloadKey={reload} searchPlaceholder="Search code, place, make, serial"
          filters={[{ name: 'dueState', label: 'Calibration', options: opts(['OVERDUE', 'DUE_SOON', 'OK', 'NOT_SET', 'INACTIVE']) }, { name: 'placeType', label: 'Place', options: opts(SENSOR_PLACES) }, { name: 'kind', label: 'Kind', options: opts(SENSOR_KINDS) }]}
          columns={[
            { key: 'sensorCode', label: 'Code', sort: 'code', render: r => <button className="font-semibold text-sky-700 hover:underline" onClick={() => openSensor(r.id)}>{r.sensorCode}</button> },
            { key: 'placeName', label: 'Place', sort: 'place', render: r => <>{r.placeName || words(r.placeType)}<div className="text-xs text-slate-500">{words(r.placeType)}{r.placeLabel ? ` · ${r.placeLabel}` : ''}</div></> },
            { key: 'make', label: 'Make / model', render: r => [r.make, r.model].filter(Boolean).join(' ') || '-' },
            { key: 'serialNo', label: 'Serial' },
            { key: 'accuracyC', label: 'Accuracy', render: r => r.accuracyC != null ? `± ${fmtTempDelta(r.accuracyC)}` : '-' },
            { key: 'calibrationDue', label: 'Calibration due', sort: 'due', render: r => <>{day(r.calibrationDue)}{r.daysLeft != null ? <div className="text-xs text-slate-500">{r.daysLeft < 0 ? `${-r.daysLeft} days late` : `in ${r.daysLeft} days`}</div> : null}</> },
            { key: 'dueState', label: 'State', render: r => <Pill state={r.dueState} /> },
            { key: 'certificateNo', label: 'Certificate', render: r => r.certificateNo || '-' },
          ]} />
      </Section>

      {s && <Section title={<>{s.sensorCode} <span className="ml-2 align-middle"><Pill state={s.dueState} /></span></>} right={<div className="flex gap-2">
        <button className={btnLight} onClick={() => setEditing(!editing)}>{editing ? 'Cancel edit' : 'Edit'}</button>
        <button className={s.active ? btnRed : btnLight} disabled={busy} onClick={() => run(() => send(`/api/coldchain/sensors/${s.id}/active`, { active: !s.active }))}>{s.active ? 'Take out of use' : 'Put back in use'}</button>
        <button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>}>
        {editing ? <QuickForm fields={sensorFields(s.placeType)} initial={s} busy={busy} submitText="Save changes" onCancel={() => setEditing(false)}
          onSubmit={v => run(() => send(`/api/coldchain/sensors/${s.id}`, { ...v, placeType: s.placeType }, 'PUT'), () => setEditing(false))} />
          : <dl className="grid gap-2 text-sm md:grid-cols-4">
            <div><dt className="text-slate-500">Place</dt><dd>{s.placeName || '-'} ({words(s.placeType)}){s.placeLabel ? `, ${s.placeLabel}` : ''}</dd></div>
            <div><dt className="text-slate-500">Make / model / serial</dt><dd>{[s.make, s.model, s.serialNo].filter(Boolean).join(' / ') || '-'}</dd></div>
            <div><dt className="text-slate-500">Accuracy / range</dt><dd>{s.accuracyC != null ? `± ${fmtTempDelta(s.accuracyC)}` : '-'} · {temp(s.rangeMinC)} to {temp(s.rangeMaxC)}</dd></div>
            <div><dt className="text-slate-500">Last calibrated / due</dt><dd>{day(s.lastCalibratedOn)} / {day(s.calibrationDue)}</dd></div>
            <div><dt className="text-slate-500">Readings in 30 days</dt><dd>Trip {open.readings?.trip30 ?? 0} ({open.readings?.tripFlagged ?? 0} marked), chamber {open.readings?.chamber30 ?? 0} ({open.readings?.chamberFlagged ?? 0} marked)</dd></div>
            <div><dt className="text-slate-500">Added</dt><dd>{words(s.source)}{s.active ? '' : ', out of use'}</dd></div>
            <div className="md:col-span-2"><dt className="text-slate-500">Notes</dt><dd>{s.notes || '-'}</dd></div>
          </dl>}

        <h3 className="mt-4 font-bold">Record a calibration</h3>
        <QuickForm cols={4} busy={busy} submitText="Save calibration" onSubmit={(v, f) => run(() => send(`/api/coldchain/sensors/${s.id}/calibrations`, v), () => f.reset())} fields={[
          { name: 'calibratedOn', label: 'Calibrated on', type: 'date', required: true }, { name: 'dueOn', label: 'Next due (blank: one year)', type: 'date' },
          { name: 'result', label: 'Result', type: 'select', options: opts(CAL_RESULTS), required: true }, { name: 'errorC', label: 'Error found (°C)', type: 'number', step: '0.01' },
          { name: 'lab', label: 'Laboratory', required: true, placeholder: 'NABL lab name' }, { name: 'certificateNo', label: 'Certificate number' }, { name: 'notes', label: 'Notes', wide: true },
        ]} />
        <p className="mt-1 text-xs text-slate-500">A failed calibration makes the sensor overdue from that day, so its readings are marked until it is calibrated again.</p>

        <h3 className="mt-4 font-bold">Calibrations</h3>
        {!open.calibrations?.length ? <p className="text-sm text-slate-500">No calibration recorded yet.</p> :
          <table className="mt-1 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Calibrated</th><th>Due</th><th>Result</th><th>Error</th><th>Lab</th><th>Certificate</th><th>By</th></tr></thead>
            <tbody>{open.calibrations.map((k: any) => <tr key={k.id} className="border-t align-top">
              <td className="p-2">{day(k.calibratedOn)}</td><td>{day(k.dueOn)}</td><td><Pill state={k.result} /></td><td>{k.errorC != null ? fmtTempDelta(k.errorC) : '-'}</td><td>{k.lab || '-'}</td>
              <td>{k.certificateNo || '-'}{k.certificateFileId
                ? <button className="ml-2 text-xs font-bold text-sky-700 hover:underline" onClick={() => apiDownload(`/api/coldchain/sensors/${s.id}/certificate?calibrationId=${k.id}`, k.certificateFileName || `Certificate_${s.sensorCode}.pdf`).catch(e => setErr(e.message))}>Download</button>
                : <label className="ml-2 cursor-pointer text-xs font-bold text-sky-700 hover:underline">Attach PDF or photo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => uploadCertificate(e.target.files?.[0], k.id)} /></label>}</td>
              <td>{k.recordedByName || '-'}</td></tr>)}</tbody></table>}
      </Section>}
    </>}

    {tab === 'MAPPING' && <>
      {addingStudy && <Section title="Record a mapping study"><MappingForm look={look} busy={busy} onCancel={() => setAddingStudy(false)}
        onSubmit={b => run(() => send('/api/coldchain/sensors/mapping/studies', b), () => setAddingStudy(false))} /></Section>}
      <Section title="Chambers and trucks">
        {!board ? <p className="text-slate-500">Loading...</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Place</th><th>Group</th><th>Last study</th><th>Result</th><th>Next due</th><th>State</th></tr></thead>
          <tbody>{(board.places || []).map((p: any) => <tr key={`${p.placeType}${p.placeId}`} className="border-t">
            <td className="p-2 font-semibold">{p.placeName}<div className="text-xs font-normal text-slate-500">{words(p.placeType)}</div></td><td>{p.groupName || '-'}</td>
            <td>{day(p.lastStudy)}</td><td>{p.result ? <Pill state={p.result} /> : '-'}</td><td>{day(p.nextDue)}</td><td><Pill state={p.dueState} /></td></tr>)}</tbody></table></div>}
      </Section>
      <Section title="Studies">
        {!studies.length ? <p className="text-slate-500">No mapping study recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Date</th><th>Place</th><th>Condition</th><th>Points / hours</th><th>Min / max / mean</th><th>Hot spot / cold spot</th><th>Result</th><th>Next due</th><th>Report</th><th /></tr></thead>
          <tbody>{studies.map((m: any) => <tr key={m.id} className="border-t align-top">
            <td className="p-2">{day(m.studyDate)}</td><td>{m.placeName}<div className="text-xs text-slate-500">{words(m.placeType)} · by {m.doneBy || '-'}</div></td>
            <td>{words(m.condition)}{m.season ? `, ${words(m.season)}` : ''}</td><td>{m.points ?? '-'} / {m.durationHours != null ? Number(m.durationHours) : '-'}</td>
            <td className="whitespace-nowrap">{temp(m.minC)} / {temp(m.maxC)} / {temp(m.meanC)}</td><td className="max-w-xs text-xs">{m.hotSpot || '-'} / {m.coldSpot || '-'}</td>
            <td><Pill state={m.result} /></td><td>{day(m.nextDue)}</td>
            <td>{m.reportFileId
              ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => apiDownload(`/api/coldchain/sensors/mapping/studies/${m.id}/report`, m.reportFileName || `MappingStudy_${m.id}.pdf`).catch(e => setErr(e.message))}>Download</button>
              : <label className="cursor-pointer text-xs font-bold text-sky-700 hover:underline">Attach<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void run(() => apiUpload(`/api/coldchain/sensors/mapping/studies/${m.id}/report`, { file: f })); }} /></label>}</td>
            <td>{me.manager && <button className={btnRed} disabled={busy} onClick={() => window.confirm('Remove this mapping study?') && run(() => send(`/api/coldchain/sensors/mapping/studies/${m.id}/remove`))}>Remove</button>}</td>
          </tr>)}</tbody></table></div>}
      </Section>
    </>}
  </>;
}

function MappingForm({ look, busy, onSubmit, onCancel }: { look: any; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [placeType, setPlaceType] = useState('CHAMBER');
  const places: [string | number, string][] = placeType === 'CHAMBER'
    ? (look?.chambers || []).map((c: any) => [c.id, `${c.name} (${c.warehouseName})`]) : (look?.vehicles || []).map((v: any) => [v.id, v.number]);
  return <>
    <div className="mb-3 max-w-xs"><span className={label}>Chamber or truck</span>
      <select className={input} value={placeType} onChange={e => setPlaceType(e.target.value)}><option value="CHAMBER">Chamber</option><option value="VEHICLE">Truck</option></select></div>
    <QuickForm key={placeType} cols={4} busy={busy} submitText="Save study" onCancel={onCancel} onSubmit={v => onSubmit({ ...v, placeType })} fields={[
      { name: 'placeId', label: placeType === 'CHAMBER' ? 'Chamber' : 'Truck', type: 'select', options: places, required: true },
      { name: 'studyDate', label: 'Study date', type: 'date', required: true }, { name: 'nextDue', label: 'Next due (blank: one year)', type: 'date' },
      { name: 'result', label: 'Result', type: 'select', options: opts(['PASS', 'FAIL']), required: true },
      { name: 'condition', label: 'Condition', type: 'select', options: opts(['EMPTY', 'LOADED']) }, { name: 'season', label: 'Season', type: 'select', options: opts(['SUMMER', 'MONSOON', 'WINTER']) },
      { name: 'points', label: 'Logger points', type: 'number', step: '1' }, { name: 'durationHours', label: 'Duration (hours)', type: 'number', step: '0.5' },
      { name: 'minC', label: 'Lowest', type: 'number', step: 'any', unit: 'temp' }, { name: 'maxC', label: 'Highest', type: 'number', step: 'any', unit: 'temp' }, { name: 'meanC', label: 'Mean', type: 'number', step: 'any', unit: 'temp' },
      { name: 'doneBy', label: 'Done by (agency)' }, { name: 'hotSpot', label: 'Hot spot' }, { name: 'coldSpot', label: 'Cold spot' }, { name: 'notes', label: 'Notes', wide: true },
    ]} />
  </>;
}
