/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-011 -- Cold Chain Emergencies. Staff only.
//   Incidents: a power failure at a chamber or a reefer unit failure on a trip opens an incident by itself (from the
//     chamber power alerts and the reefer fault events), or staff open one by hand. Each incident follows the plan
//     of its site as a checklist, and records the backup power, the product temperature, goods moved to another
//     chamber or truck, who was told, a quality hold, and the cause and action when it is closed. Report as PDF.
//   Plans: the steps and contacts per site and type (a Manager writes them).
//   Drills: mock drills with the response time and findings.
// Backend: /api/coldchain/emergency (EmergencyController). Needs database_v2/66_cold_chain_records.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DataTable } from '@/shared/components/DataTable';
import { INCIDENT_TYPES, NOTICE_CHANNELS, SCRIPT66, at, day, duration, fileName, notReady, nowIndia, opts, send, temp, who, words } from './records';
import { Pill, ReadingsLine, Tabs, Tiles } from './ui';
import { toBaseFields, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function EmergencyPage() {
  const me = who();
  const [tab, setTab] = useState('INCIDENTS');
  const [status, setStatus] = useState<any>(null), [look, setLook] = useState<any>(null), [trips, setTrips] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [counts, setCounts] = useState<any>({}), [opening, setOpening] = useState(false), [open, setOpen] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]), [editPlan, setEditPlan] = useState<any>(null), [drills, setDrills] = useState<any[]>([]), [addingDrill, setAddingDrill] = useState(false);

  useEffect(() => { api('/api/coldchain/records/status').then(setStatus).catch(() => setStatus({ ready: true })); }, []);
  useEffect(() => {
    if (!status?.ready) return;
    api('/api/coldchain/records/lookups').then(setLook).catch(() => setLook({}));
    api('/api/coldchain/trips?status=RUNNING').then(x => setTrips(Array.isArray(x) ? x : [])).catch(() => setTrips([]));
  }, [status]);
  useEffect(() => {
    if (!status?.ready) return;
    if (tab === 'PLANS') api('/api/coldchain/emergency/plans').then(x => setPlans(x?.plans || [])).catch(e => setErr(errorText(e, 'The plans could not be read.')));
    if (tab === 'DRILLS') api('/api/coldchain/emergency/drills').then(x => setDrills(x?.drills || [])).catch(e => setErr(errorText(e, 'The drills could not be read.')));
  }, [status, tab, reload]);

  if (notReady(status)) return <><h1 className="text-3xl font-bold">Cold Chain Emergencies</h1><NotReady script={status.script || SCRIPT66} /></>;

  async function openIncident(id: number) {
    try { setOpen(await api(`/api/coldchain/emergency/incidents/${id}`)); } catch (e) { setErr(errorText(e, 'The incident could not be read.')); }
  }
  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try {
      const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1);
      if (x?.incident) setOpen(x); else if (open?.incident?.id && tab === 'INCIDENTS') await openIncident(open.incident.id);
      return x;
    } catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const form = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); return toBaseFields(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>, { productTempC: 'temp' }); }; // REQ-PLT-015
  const i = open?.incident;
  const base = i ? `/api/coldchain/emergency/incidents/${i.id}` : '';
  const isOpen = i && i.status !== 'CLOSED';

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><Siren />Cold Chain Emergencies</h1>
        <p className="text-slate-600">Power and reefer failures handled step by step against the plan, with the goods moved, who was told, and the drills held.</p>
      </div>
      {tab === 'INCIDENTS' && <button className={btn} onClick={() => setOpening(!opening)}>{opening ? 'Cancel' : 'Open an incident'}</button>}
      {tab === 'PLANS' && me.manager && <button className={btn} onClick={() => setEditPlan({})}>Write a plan</button>}
      {tab === 'DRILLS' && <button className={btn} onClick={() => setAddingDrill(!addingDrill)}>{addingDrill ? 'Cancel' : 'Record a drill'}</button>}
    </div>
    <Banner msg={msg} error={err} />
    <Tiles items={[['Open', counts.open ?? '-', counts.open ? 'OPEN' : undefined], ['Under control', counts.controlled ?? '-', counts.controlled ? 'CONTROLLED' : undefined], ['Closed in 30 days', counts.closed30Days ?? '-'], ['Drills in 12 months', counts.drills12Months ?? '-']]} />
    <Tabs tabs={[['INCIDENTS', 'Incidents'], ['PLANS', 'Emergency plans'], ['DRILLS', 'Drills']]} value={tab} onChange={setTab} />

    {tab === 'INCIDENTS' && <>
      {opening && <Section title="Open an incident"><IncidentForm look={look} trips={trips} busy={busy} onCancel={() => setOpening(false)}
        onSubmit={b => run(() => send('/api/coldchain/emergency/incidents', b), () => setOpening(false))} /></Section>}
      <Section title="Incidents">
        <DataTable path="/api/coldchain/emergency/incidents" exportName="ColdChainIncidents" reloadKey={reload} onLoaded={x => setCounts(x?.counts || {})}
          searchPlaceholder="Search number, place, cause"
          filters={[{ name: 'status', label: 'Status', options: opts(['OPEN', 'CONTROLLED', 'CLOSED']) }, { name: 'incidentType', label: 'Type', options: opts(INCIDENT_TYPES) }, { name: 'source', label: 'Opened', options: [['AUTO', 'By the system'], ['MANUAL', 'By hand']] }, { name: 'startedAt', label: 'Started', range: 'date' }]}
          columns={[
            { key: 'incidentNo', label: 'Incident', sort: 'no', render: r => <button className="font-semibold text-sky-700 hover:underline" onClick={() => openIncident(r.id)}>{r.incidentNo}</button> },
            { key: 'status', label: 'Status', render: r => <Pill state={r.status} /> },
            { key: 'incidentType', label: 'Type', render: r => <>{words(r.incidentType)}<div className="text-xs text-slate-500">{r.source === 'AUTO' ? 'opened by the system' : 'opened by hand'}</div></> },
            { key: 'placeName', label: 'Where', render: r => <>{r.placeName || '-'}<div className="text-xs text-slate-500">{[r.warehouseName, r.vehicleNumber].filter(Boolean).join(' · ')}</div></> },
            { key: 'startedAt', label: 'Started', sort: 'started', render: r => at(r.startedAt) },
            { key: 'minutes', label: 'Length', render: r => duration(r.minutes) },
            { key: 'steps', label: 'Checklist', render: r => `${r.stepsDone ?? 0} of ${r.steps ?? 0}` },
            { key: 'description', label: 'What happened', className: 'max-w-sm' },
          ]} />
      </Section>

      {i && <Section title={<>{i.incidentNo} <span className="ml-2 align-middle"><Pill state={i.status} /></span></>} right={<div className="flex flex-wrap gap-2">
        <button className={btnLight} onClick={() => apiDownload(`${base}/report.pdf`, `${fileName(i.incidentNo)}.pdf`).catch(e => setErr(e.message))}>Report (PDF)</button>
        {i.status === 'OPEN' && <button className={btnLight} disabled={busy} onClick={() => run(() => send(`${base}/control`))}>Mark under control</button>}
        {isOpen && !i.holdPlaced && <button className={btnRed} disabled={busy} onClick={() => { const reason = window.prompt('Why are the goods put on hold?', `Emergency ${i.incidentNo}`); if (reason) void run(() => send(`${base}/hold`, { reason })); }}>Put the goods on hold</button>}
        <button className={btnLight} onClick={() => setOpen(null)}>Close</button></div>}>
        <p className="text-sm text-slate-700"><b>{words(i.incidentType)}</b> at {i.placeName}{i.tripId ? <> · <Link to={`/trips/${i.tripId}`} className="font-bold text-sky-700 hover:underline">{i.tripNumber}</Link></> : null} · started {at(i.startedAt)} · {duration(i.minutes)}{i.holdPlaced ? ' · goods on hold' : ''}</p>
        <p className="mt-1 text-sm">{i.description}</p>
        {open.plan && <p className="mt-1 text-xs text-slate-500">Plan: {open.plan.title}{open.plan.contacts ? `. Contacts: ${open.plan.contacts}` : ''}</p>}

        <h3 className="mt-4 font-bold">Checklist</h3>
        <ol className="mt-1 space-y-1 text-sm">{(open.steps || []).map((s: any) => <li key={s.stepNo} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2">
          <span className="w-6 font-bold">{s.stepNo}.</span><span className={`flex-1 ${s.done || s.notNeeded ? 'text-slate-500' : ''}`}>{s.text}</span>
          {s.done ? <Pill state="DONE" text={`Done ${at(s.doneAt)}${s.doneByName ? `, ${s.doneByName}` : ''}`} /> : s.notNeeded ? <Pill state="INACTIVE" text={`Not needed${s.note ? `: ${s.note}` : ''}`} /> : null}
          {isOpen && (s.done || s.notNeeded
            ? <button className={btnLight} disabled={busy} onClick={() => run(() => send(`${base}/step`, { stepNo: s.stepNo, state: 'OPEN' }))}>Undo</button>
            : <><button className={btnLight} disabled={busy} onClick={() => run(() => send(`${base}/step`, { stepNo: s.stepNo, state: 'DONE' }))}>Done</button>
                <button className={btnLight} disabled={busy} onClick={() => { const note = window.prompt('Why is this step not needed?'); if (note) void run(() => send(`${base}/step`, { stepNo: s.stepNo, state: 'NOT_NEEDED', note })); }}>Not needed</button></>)}
        </li>)}</ol>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="font-bold">Backup power and product temperature</h3>
            <p className="text-sm text-slate-600">Backup power at {at(i.backupPowerAt)}{i.backupPowerNote ? ` (${i.backupPowerNote})` : ''}. Product {temp(i.productTempC)}{i.productCheckedAt ? ` at ${at(i.productCheckedAt)}` : ''}.</p>
            {isOpen && <form onSubmit={e => { const b = form(e); void run(() => send(`${base}/facts`, b)); }} className="mt-2 grid gap-2 md:grid-cols-2">
              <div><span className={label}>Backup power took the load at</span><input name="backupPowerAt" className={input} placeholder="YYYY-MM-DD HH:MM" /></div>
              <div><span className={label}>Backup power note</span><input name="backupPowerNote" className={input} placeholder="DG set 125 kVA" /></div>
              <div><span className={label}>Product temperature ({unitNow('temp')})</span><input name="productTempC" type="number" step="any" className={input} /></div>
              <div><span className={label}>Checked at</span><input name="productCheckedAt" className={input} placeholder="YYYY-MM-DD HH:MM" defaultValue={nowIndia()} /></div>
              <div><button className={btnLight} disabled={busy}>Save</button></div>
            </form>}
          </div>
          <div>
            <h3 className="font-bold">Temperature around the incident</h3>
            <ReadingsLine points={(open.readings || []).map((r: any) => ({ t: r.at, c: r.temperatureC, flag: r.sensorFlag }))} />
          </div>
        </div>

        <h3 className="mt-4 font-bold">Goods moved</h3>
        {!(open.transfers || []).length ? <p className="text-sm text-slate-500">No goods moved.</p> :
          <ul className="text-sm">{open.transfers.map((x: any) => <li key={x.id}>{at(x.movedAt)}: {x.whatMoved} to {x.toName || x.toLabel || '-'}{x.pallets ? `, ${x.pallets} pallet(s)` : ''}{x.productTempC != null ? `, product ${temp(x.productTempC)}` : ''} ({x.movedByName})</li>)}</ul>}
        {isOpen && <TransferForm look={look} busy={busy} onSubmit={b => run(() => send(`${base}/transfer`, b))} />}

        <h3 className="mt-4 font-bold">Who was told</h3>
        {!(open.notices || []).length ? <p className="text-sm text-slate-500">Nobody recorded yet.</p> :
          <ul className="text-sm">{open.notices.map((n: any) => <li key={n.id}>{at(n.toldAt)}: {n.person}{n.organisation ? ` (${n.organisation})` : ''} by {words(n.channel)}{n.note ? `. ${n.note}` : ''}</li>)}</ul>}
        {isOpen && <form onSubmit={e => { const b = form(e); void run(() => send(`${base}/notice`, b), () => (e.target as HTMLFormElement).reset()); }} className="mt-2 grid gap-2 md:grid-cols-5">
          <input name="person" required placeholder="Person *" className={input} /><input name="organisation" placeholder="Organisation" className={input} />
          <select name="channel" className={input}>{NOTICE_CHANNELS.map(c => <option key={c} value={c}>{words(c)}</option>)}</select>
          <input name="toldAt" defaultValue={nowIndia()} className={input} placeholder="YYYY-MM-DD HH:MM" />
          <div className="flex gap-2"><input name="note" placeholder="Note" className={input} /><button className={btnLight} disabled={busy}>Add</button></div>
        </form>}

        {i.status === 'CLOSED'
          ? <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><b>Closed</b> {at(i.closedAt)} by {i.closedByName || '-'}. Cause: {i.cause}. Action taken: {i.actionTaken}</p>
          : <form onSubmit={e => { const b = form(e); void run(() => send(`${base}/close`, b)); }} className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
            <div><span className={label}>Cause *</span><input name="cause" required minLength={5} className={input} placeholder="Feeder tripped at the substation" /></div>
            <div><span className={label}>Action taken *</span><input name="actionTaken" required minLength={5} className={input} placeholder="Ran on DG, goods checked, relay to be tested monthly" /></div>
            <div><button className={btnRed} disabled={busy}>Close the incident</button><span className="ml-2 text-xs text-slate-500">Every checklist step must be done or marked not needed.</span></div>
          </form>}
      </Section>}
    </>}

    {tab === 'PLANS' && <>
      {editPlan && <Section title={editPlan.id ? `Edit plan: ${editPlan.title}` : 'Write a plan'}>
        <QuickForm cols={2} initial={editPlan} busy={busy} submitText="Save plan" onCancel={() => setEditPlan(null)}
          onSubmit={v => run(() => send(editPlan.id ? `/api/coldchain/emergency/plans/${editPlan.id}` : '/api/coldchain/emergency/plans', v, editPlan.id ? 'PUT' : 'POST'), () => setEditPlan(null))} fields={[
            { name: 'warehouseId', label: 'Site (blank: all sites)', type: 'select', options: (look?.warehouses || []).map((w: any) => [w.id, w.name]) },
            { name: 'incidentType', label: 'Type of emergency', type: 'select', options: opts(INCIDENT_TYPES), required: true },
            { name: 'title', label: 'Title', required: true, wide: true },
            { name: 'steps', label: 'Steps, one per line', type: 'textarea', wide: true, hint: 'Each line becomes a checklist step of a new incident.' },
            { name: 'contacts', label: 'Contacts (names and phone numbers)', type: 'textarea', wide: true },
          ]} />
      </Section>}
      <Section title="Emergency plans">
        {!plans.length ? <p className="text-slate-500">No plan written yet. Incidents use the built-in steps until a plan is written.</p> :
          <div className="space-y-3">{plans.map(p => <div key={p.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold">{p.title} <span className="font-normal text-slate-500">· {words(p.incidentType)} · {p.warehouseName}</span></div>
              {me.manager && <div className="flex gap-2"><button className={btnLight} onClick={() => setEditPlan(p)}>Edit</button><button className={btnRed} disabled={busy} onClick={() => window.confirm('Retire this plan?') && run(() => send(`/api/coldchain/emergency/plans/${p.id}/retire`))}>Retire</button></div>}</div>
            <ol className="mt-2 list-decimal pl-6 text-sm">{String(p.steps || '').split('\n').filter(Boolean).map((s: string, k: number) => <li key={k}>{s}</li>)}</ol>
            {p.contacts && <p className="mt-1 text-xs text-slate-600">Contacts: {p.contacts}</p>}
            <p className="mt-1 text-xs text-slate-400">Updated {at(p.updatedAt)} by {p.updatedByName || '-'}</p>
          </div>)}</div>}
      </Section>
    </>}

    {tab === 'DRILLS' && <>
      {addingDrill && <Section title="Record a drill">
        <QuickForm cols={3} busy={busy} submitText="Save drill" onCancel={() => setAddingDrill(false)} onSubmit={v => run(() => send('/api/coldchain/emergency/drills', v), () => setAddingDrill(false))} fields={[
          { name: 'drillDate', label: 'Date', type: 'date', required: true }, { name: 'scenario', label: 'Scenario', type: 'select', options: opts(INCIDENT_TYPES), required: true },
          { name: 'result', label: 'Result', type: 'select', options: opts(['PASS', 'FAIL']), required: true },
          { name: 'warehouseId', label: 'Site', type: 'select', options: (look?.warehouses || []).map((w: any) => [w.id, w.name]) },
          { name: 'vehicleId', label: 'or truck', type: 'select', options: (look?.vehicles || []).map((v: any) => [v.id, v.number]) },
          { name: 'responseMinutes', label: 'Response time (min)', type: 'number', step: '1' },
          { name: 'participants', label: 'Participants', required: true }, { name: 'conductedBy', label: 'Conducted by' }, { name: 'description', label: 'What was simulated' },
          { name: 'findings', label: 'Findings', type: 'textarea', wide: true, required: true }, { name: 'actions', label: 'Actions (needed when failed)', type: 'textarea', wide: true },
        ]} />
      </Section>}
      <Section title="Drills">
        {!drills.length ? <p className="text-slate-500">No drill recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Date</th><th>Scenario</th><th>Where</th><th>Response</th><th>Result</th><th>Findings / actions</th><th>Participants</th><th /></tr></thead>
          <tbody>{drills.map(d => <tr key={d.id} className="border-t align-top">
            <td className="p-2">{day(d.drillDate)}</td><td>{words(d.scenario)}</td><td>{d.warehouseName || d.vehicleNumber || '-'}</td><td>{d.responseMinutes != null ? `${d.responseMinutes} min` : '-'}</td>
            <td><Pill state={d.result} /></td><td className="max-w-sm">{d.findings}{d.actions ? <div className="text-xs text-slate-500">Action: {d.actions}</div> : null}</td>
            <td className="max-w-xs text-xs">{d.participants}{d.conductedBy ? `, by ${d.conductedBy}` : ''}</td>
            <td>{me.manager && <button className={btnRed} disabled={busy} onClick={() => window.confirm('Remove this drill record?') && run(() => send(`/api/coldchain/emergency/drills/${d.id}/remove`))}>Remove</button>}</td>
          </tr>)}</tbody></table></div>}
      </Section>
    </>}
  </>;
}

function IncidentForm({ look, trips, busy, onSubmit, onCancel }: { look: any; trips: any[]; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [place, setPlace] = useState('CHAMBER');
  const placeField = place === 'CHAMBER'
    ? { name: 'chamberId', label: 'Chamber', type: 'select' as const, required: true, options: (look?.chambers || []).map((c: any) => [c.id, `${c.name} (${c.warehouseName})`]) }
    : place === 'VEHICLE' ? { name: 'vehicleId', label: 'Truck', type: 'select' as const, required: true, options: (look?.vehicles || []).map((v: any) => [v.id, v.number]) }
      : place === 'TRIP' ? { name: 'tripId', label: 'Running trip', type: 'select' as const, required: true, options: trips.map((t: any) => [t.id, `${t.tripNumber} (${t.vehicleNumber || '-'})`]) }
        : { name: 'warehouseId', label: 'Site', type: 'select' as const, required: true, options: (look?.warehouses || []).map((w: any) => [w.id, w.name]) };
  return <>
    <div className="mb-3 max-w-xs"><span className={label}>Where</span>
      <select className={input} value={place} onChange={e => setPlace(e.target.value)}>{['CHAMBER', 'TRIP', 'VEHICLE', 'SITE'].map(p => <option key={p} value={p}>{p === 'TRIP' ? 'Trip on the road' : p === 'VEHICLE' ? 'Truck (no trip)' : p === 'SITE' ? 'Whole site' : 'Chamber'}</option>)}</select></div>
    <QuickForm key={place} cols={3} busy={busy} submitText="Open incident" onCancel={onCancel} onSubmit={v => onSubmit({ ...v, placeType: place })} fields={[
      { name: 'incidentType', label: 'Type', type: 'select', options: opts(INCIDENT_TYPES), required: true }, placeField,
      { name: 'startedAt', label: 'Started at (India time)', placeholder: 'YYYY-MM-DD HH:MM', hint: 'Blank: now.' },
      { name: 'description', label: 'What happened', type: 'textarea', wide: true },
    ]} />
  </>;
}

function TransferForm({ look, busy, onSubmit }: { look: any; busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [to, setTo] = useState('CHAMBER');
  return <form onSubmit={e => { e.preventDefault(); onSubmit({ ...toBaseFields(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, unknown>, { productTempC: 'temp' }), toType: to }); }} className="mt-2 grid gap-2 md:grid-cols-6">
    <select className={input} value={to} onChange={e => setTo(e.target.value)}><option value="CHAMBER">To a chamber</option><option value="VEHICLE">To a truck</option><option value="OTHER">Elsewhere</option></select>
    {to === 'CHAMBER' ? <select name="toChamberId" required className={input}><option value="">Chamber *</option>{(look?.chambers || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      : to === 'VEHICLE' ? <select name="toVehicleId" required className={input}><option value="">Truck *</option>{(look?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.number}</option>)}</select>
        : <input name="toLabel" required placeholder="Place *" className={input} />}
    <input name="whatMoved" required placeholder="What was moved *" className={input} />
    <input name="pallets" type="number" step="1" placeholder="Pallets" className={input} />
    <input name="productTempC" type="number" step="any" placeholder={`Product ${unitNow('temp')}`} className={input} />
    <div className="flex gap-2"><input name="movedAt" defaultValue={nowIndia()} className={input} /><button className={btnLight} disabled={busy}>Add</button></div>
  </form>;
}
