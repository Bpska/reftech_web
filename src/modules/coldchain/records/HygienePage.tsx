/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-014 -- Hygiene & Audit (FSSAI / GDP). Staff only.
//   Cleaning: schedules per chamber, area or truck with method and chemical; each cleaning logged with a photo.
//   Pest control: agency visits per site with the report; pest activity tells the managers.
//   Truck checks: the hygiene checklist of a truck before loading. With the setting REFUSE a truck without a passed
//     check in the last hours cannot load or start its trip; WARN shows a warning at trip start; OFF does nothing.
//   Complaints: customer complaints with investigation and CAPA (root cause, corrective and preventive action);
//     a Manager closes them.
//   Mock recall: trace a batch against the clock; the result against the target share and time; report as PDF.
//   Audit pack: every record above plus sensors, mapping, excursions, packaging and incidents for a period, in the
//     order of FSSAI Schedule 4 or GDP, as PDF and Excel.
//   Settings (Manager): hygiene check mode and hours, default limit of time out of cold storage, due-soon days, recall targets.
// Backend: /api/coldchain/hygiene (HygieneController), /api/coldchain/records/settings. Needs database_v2/66_cold_chain_records.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api, apiDownload, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, QuickForm, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { DataTable } from '@/shared/components/DataTable';
import { COMPLAINT_TYPES, HYGIENE_MODES, SCRIPT66, SEVERITIES, at, day, duration, fileName, notReady, nowIndia, opts, send, temp, who, words } from './records';
import { Pill, Tabs, Tiles } from './ui';
import { toBase, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const H = '/api/coldchain/hygiene';

export function HygienePage() {
  const me = who();
  const [tab, setTab] = useState('CLEANING');
  const [status, setStatus] = useState<any>(null), [look, setLook] = useState<any>(null), [trips, setTrips] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [reload, setReload] = useState(0);
  const [data, setData] = useState<any>(null), [extra, setExtra] = useState<any>(null), [form, setForm] = useState<any>(null), [open, setOpen] = useState<any>(null);
  const [complaintCounts, setComplaintCounts] = useState<any>({});
  const [pack, setPack] = useState({ standard: 'FSSAI', from: '', to: '', warehouseId: '' });

  useEffect(() => { api('/api/coldchain/records/status').then(setStatus).catch(() => setStatus({ ready: true })); }, []);
  useEffect(() => {
    if (!status?.ready) return;
    api('/api/coldchain/records/lookups').then(setLook).catch(() => setLook({}));
    api('/api/coldchain/trips?status=ALL').then(x => setTrips(Array.isArray(x) ? x.slice(0, 300) : [])).catch(() => setTrips([]));
  }, [status]);
  useEffect(() => {
    if (!status?.ready) return;
    setData(null); setExtra(null);
    const fail = (e: unknown) => setErr(errorText(e, 'The records could not be read.'));
    if (tab === 'CLEANING') { api(`${H}/cleaning`).then(setData).catch(fail); api(`${H}/cleaning/logs`).then(setExtra).catch(fail); }
    if (tab === 'PEST') api(`${H}/pest`).then(setData).catch(fail);
    if (tab === 'TRUCKS') api(`${H}/vehicle-checks`).then(setData).catch(fail);
    if (tab === 'RECALL') api(`${H}/recalls`).then(setData).catch(fail);
    if (tab === 'AUDIT') api(`${H}/audit-pack${packQuery()}`).then(setData).catch(fail);
    if (tab === 'SETTINGS') api('/api/coldchain/records/settings').then(setData).catch(fail);
  }, [status, tab, reload]);
  useEffect(() => { setForm(null); setOpen(null); }, [tab]);

  if (notReady(status)) return <><h1 className="text-3xl font-bold">Hygiene &amp; Audit</h1><NotReady script={status.script || SCRIPT66} /></>;

  function packQuery() {
    const p = new URLSearchParams({ standard: pack.standard });
    if (pack.from) p.set('from', pack.from); if (pack.to) p.set('to', pack.to); if (pack.warehouseId) p.set('warehouseId', pack.warehouseId);
    return `?${p.toString()}`;
  }
  async function run(fn: () => Promise<any>, after?: (x: any) => void) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(x?.message || 'Saved.'); after?.(x); setReload(r => r + 1); return x; }
    catch (e) { setErr(errorText(e, 'Not saved.')); return null; } finally { setBusy(false); }
  }
  const upload = (path: string, file?: File) => { if (file) void run(() => apiUpload(path, { file })); };
  const download = (path: string, name: string) => apiDownload(path, name).catch(e => setErr(errorText(e, 'The file could not be downloaded.')));
  const sites: [number, string][] = (look?.warehouses || []).map((w: any) => [w.id, w.name]);
  const vehicles: [number, string][] = (look?.vehicles || []).map((v: any) => [v.id, v.number]);
  const chambers: [number, string][] = (look?.chambers || []).map((c: any) => [c.id, `${c.name} (${c.warehouseName})`]);
  const tripOptions: [number, string][] = trips.map((t: any) => [t.id, `${t.tripNumber} (${t.vehicleNumber || '-'})`]);
  const openComplaint = (id: number) => api(`${H}/complaints/${id}`).then(setOpen).catch(e => setErr(errorText(e, 'The complaint could not be read.')));
  const openRecall = (id: number) => api(`${H}/recalls/${id}`).then(setOpen).catch(e => setErr(errorText(e, 'The mock recall could not be read.')));

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold"><ClipboardCheck />Hygiene &amp; Audit</h1>
        <p className="text-slate-600">Cleaning, pest control and truck hygiene, customer complaints with corrective action, mock recalls and the FSSAI / GDP audit pack.</p>
      </div>
    </div>
    <Banner msg={msg} error={err} />
    <Tabs value={tab} onChange={setTab} tabs={[['CLEANING', 'Cleaning'], ['PEST', 'Pest control'], ['TRUCKS', 'Truck hygiene checks'], ['COMPLAINTS', 'Complaints'], ['RECALL', 'Mock recall'], ['AUDIT', 'Audit pack'], ['SETTINGS', 'Settings']]} />

    {tab === 'CLEANING' && <>
      <div className="mt-3 flex gap-2"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Add a cleaning schedule'}</button></div>
      {form && <Section title={form.id ? `Edit ${form.areaName}` : 'Add a cleaning schedule'}><ScheduleForm initial={form} sites={sites} chambers={chambers} vehicles={vehicles} busy={busy} onCancel={() => setForm(null)}
        onSubmit={b => run(() => send(form.id ? `${H}/cleaning/${form.id}` : `${H}/cleaning`, b, form.id ? 'PUT' : 'POST'), () => setForm(null))} /></Section>}
      <Tiles items={[['Schedules', data?.schedules?.length ?? '-'], ['Overdue', (data?.schedules || []).filter((s: any) => s.state === 'OVERDUE').length, (data?.schedules || []).some((s: any) => s.state === 'OVERDUE') ? 'OVERDUE' : undefined]]} />
      <Section title="Cleaning schedules">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.schedules?.length ? <p className="text-slate-500">No cleaning schedule yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Area</th><th>Every</th><th>Method / chemical</th><th>Responsible</th><th>Last done</th><th>Next due</th><th>State</th><th>Log a cleaning</th></tr></thead>
          <tbody>{data.schedules.map((s: any) => <tr key={s.id} className={`border-t align-top ${s.active ? '' : 'text-slate-400'}`}>
            <td className="p-2 font-semibold">{s.areaName}<div className="text-xs font-normal text-slate-500">{words(s.areaType)} · {s.chamberName || s.vehicleNumber || s.warehouseName || '-'}</div>
              <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => setForm(s)}>Edit</button></td>
            <td>{s.frequencyDays} days</td><td className="max-w-xs text-xs">{s.method || '-'}{s.chemical ? <div>{s.chemical}{s.dilution ? ` ${s.dilution}` : ''}</div> : null}</td><td>{s.responsible || '-'}</td>
            <td>{at(s.lastDoneAt)}{s.lastDoneBy ? <div className="text-xs text-slate-500">{s.lastDoneBy} · {words(s.lastResult)}</div> : null}</td><td>{day(s.nextDue)}</td>
            <td><Pill state={s.state} />{s.daysLate ? <div className="text-xs text-red-700">{s.daysLate} days late</div> : null}</td>
            <td>{s.active && <LogForm busy={busy} onSubmit={b => run(() => send(`${H}/cleaning/${s.id}/log`, b))} />}</td></tr>)}</tbody></table></div>}
      </Section>
      <Section title="Cleaning log">
        {!extra?.logs?.length ? <p className="text-slate-500">No cleaning logged yet.</p> : <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Done</th><th>Area</th><th>Done by / checked by</th><th>Chemical</th><th>Result</th><th>Note</th><th>Photo</th></tr></thead>
          <tbody>{extra.logs.map((l: any) => <tr key={l.id} className="border-t align-top">
            <td className="p-2">{at(l.doneAt)}</td><td>{l.areaName}</td><td>{l.doneBy || '-'} / {l.checkedBy || '-'}</td><td>{l.chemicalUsed || '-'}</td><td><Pill state={l.result} /></td><td className="max-w-xs">{l.note || '-'}</td>
            <td>{l.photoFileId ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => download(`${H}/cleaning/logs/${l.id}/photo`, `Cleaning_${l.id}.jpg`)}>Download</button>
              : <label className="cursor-pointer text-xs font-bold text-sky-700 hover:underline">Attach<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => upload(`${H}/cleaning/logs/${l.id}/photo`, e.target.files?.[0])} /></label>}</td></tr>)}</tbody></table>}
      </Section>
    </>}

    {tab === 'PEST' && <>
      <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Record a pest control visit'}</button></div>
      {form && <Section title="Record a pest control visit"><QuickForm cols={3} busy={busy} submitText="Save visit" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${H}/pest`, v), () => setForm(null))} fields={[
        { name: 'warehouseId', label: 'Site', type: 'select', options: sites, required: true }, { name: 'visitDate', label: 'Visit date', type: 'date', required: true }, { name: 'nextDue', label: 'Next visit (blank: in 30 days)', type: 'date' },
        { name: 'agency', label: 'Agency', required: true }, { name: 'technician', label: 'Technician' }, { name: 'treatment', label: 'Treatment' }, { name: 'chemicals', label: 'Chemicals used' },
        { name: 'activityFound', label: 'Pest activity found', type: 'checkbox' }, { name: 'findings', label: 'Findings (needed when activity was found)', type: 'textarea', wide: true },
      ]} /></Section>}
      <Section title="Sites">
        {!data ? <p className="text-slate-500">Loading...</p> : <div className="flex flex-wrap gap-3">{(data.sites || []).map((s: any) => <div key={s.warehouseId} className="rounded-xl border border-slate-200 p-3 text-sm">
          <div className="font-bold">{s.warehouseName}</div><div>Last visit {day(s.lastVisit)}{s.agency ? ` by ${s.agency}` : ''}{s.activityFound ? ', activity found' : ''}</div>
          <div>Next due {day(s.nextDue)} <Pill state={s.state} /></div></div>)}</div>}
      </Section>
      <Section title="Visits">
        {!data?.visits?.length ? <p className="text-slate-500">No visit recorded yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Date</th><th>Site</th><th>Agency / technician</th><th>Treatment / chemicals</th><th>Activity</th><th>Next due</th><th>Report</th><th /></tr></thead>
          <tbody>{data.visits.map((v: any) => <tr key={v.id} className="border-t align-top">
            <td className="p-2">{day(v.visitDate)}</td><td>{v.warehouseName}</td><td>{v.agency}{v.technician ? ` / ${v.technician}` : ''}</td><td className="max-w-xs text-xs">{v.treatment || '-'}{v.chemicals ? <div>{v.chemicals}</div> : null}</td>
            <td>{v.activityFound ? <Pill state="FAIL" text="Found" /> : <Pill state="OK" text="None" />}{v.findings ? <div className="max-w-xs text-xs">{v.findings}</div> : null}</td><td>{day(v.nextDue)}</td>
            <td>{v.reportFileId ? <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => download(`${H}/pest/${v.id}/report`, `PestControl_${v.visitDate}.pdf`)}>Download</button>
              : <label className="cursor-pointer text-xs font-bold text-sky-700 hover:underline">Attach<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={e => upload(`${H}/pest/${v.id}/report`, e.target.files?.[0])} /></label>}</td>
            <td>{me.manager && <button className={btnRed} disabled={busy} onClick={() => window.confirm('Remove this visit?') && run(() => send(`${H}/pest/${v.id}/remove`))}>Remove</button>}</td></tr>)}</tbody></table></div>}
      </Section>
    </>}

    {tab === 'TRUCKS' && <>
      <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Check a truck'}</button></div>
      {form && data?.items && <Section title="Hygiene check of a truck before loading"><TruckCheckForm items={data.items} vehicles={vehicles} trips={tripOptions} busy={busy} onCancel={() => setForm(null)}
        onSubmit={b => run(() => send(`${H}/vehicle-checks`, b), () => setForm(null))} /></Section>}
      <Section title="Checks">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.checks?.length ? <p className="text-slate-500">No truck checked yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Checked</th><th>Truck</th><th>Trip</th><th>Result</th><th>Box</th><th>Items not passed</th><th>Remarks</th></tr></thead>
          <tbody>{data.checks.map((c: any) => <tr key={c.id} className="border-t align-top">
            <td className="p-2">{at(c.checkedAt)}<div className="text-xs text-slate-500">{c.checkedByName}</div></td><td className="font-semibold">{c.vehicleNumber}</td>
            <td>{c.tripId ? <Link to={`/trips/${c.tripId}`} className="text-sky-700 hover:underline">{c.tripNumber}</Link> : '-'}</td><td><Pill state={c.result} /></td><td>{temp(c.boxTempC)}</td>
            <td className="max-w-xs text-xs">{Object.entries(c.items || {}).filter(([, v]) => !v).map(([k]) => data.items?.[k] || words(k)).join('; ') || '-'}</td><td className="max-w-xs">{c.remarks || '-'}</td></tr>)}</tbody></table></div>}
        <p className="mt-2 text-xs text-slate-500">The check before loading is set on the Settings tab (now: {words(data?.mode || '')}{data?.validHours ? `, a passed check is valid for ${data.validHours} h` : ''}).</p>
      </Section>
    </>}

    {tab === 'COMPLAINTS' && <>
      <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Record a complaint'}</button></div>
      {form && <Section title="Record a complaint"><QuickForm cols={3} busy={busy} submitText="Save complaint" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${H}/complaints`, v), x => { setForm(null); if (x?.id) void openComplaint(x.id); })} fields={[
        { name: 'receivedAt', label: 'Received at', placeholder: 'YYYY-MM-DD HH:MM', hint: 'Blank: now.' }, { name: 'customerName', label: 'Customer', required: true }, { name: 'contact', label: 'Contact' },
        { name: 'partnerId', label: 'Partner', type: 'select', options: (look?.partners || []).map((p: any) => [p.id, p.name]) },
        { name: 'productId', label: 'Product', type: 'select', options: (look?.products || []).map((p: any) => [p.id, `${p.code} ${p.name}`]) }, { name: 'productText', label: 'or product as told' },
        { name: 'batchNo', label: 'Batch' }, { name: 'tripId', label: 'Trip', type: 'select', options: tripOptions }, { name: 'warehouseId', label: 'Site', type: 'select', options: sites },
        { name: 'complaintType', label: 'Type', type: 'select', options: opts(COMPLAINT_TYPES), required: true }, { name: 'severity', label: 'Severity', type: 'select', options: opts(SEVERITIES), required: true },
        { name: 'description', label: 'Complaint', type: 'textarea', wide: true, required: true },
      ]} /></Section>}
      <Tiles items={[['Open', complaintCounts.open ?? '-', complaintCounts.open ? 'OPEN' : undefined], ['Being investigated', complaintCounts.investigating ?? '-'], ['High severity open', complaintCounts.high ?? '-', complaintCounts.high ? 'HIGH' : undefined], ['Closed in 30 days', complaintCounts.closed30Days ?? '-']]} />
      <Section title="Complaints">
        <DataTable path={`${H}/complaints`} exportName="Complaints" reloadKey={reload} onLoaded={x => setComplaintCounts(x?.counts || {})} searchPlaceholder="Search number, customer, product, batch, trip"
          filters={[{ name: 'status', label: 'Status', options: opts(['OPEN', 'INVESTIGATING', 'CLOSED']) }, { name: 'complaintType', label: 'Type', options: opts(COMPLAINT_TYPES) }, { name: 'severity', label: 'Severity', options: opts(SEVERITIES) }, { name: 'receivedAt', label: 'Received', range: 'date' }]}
          columns={[
            { key: 'complaintNo', label: 'Complaint', sort: 'no', render: r => <button className="font-semibold text-sky-700 hover:underline" onClick={() => openComplaint(r.id)}>{r.complaintNo}</button> },
            { key: 'status', label: 'Status', render: r => <Pill state={r.status} /> }, { key: 'severity', label: 'Severity', render: r => <Pill state={r.severity} /> },
            { key: 'receivedAt', label: 'Received', sort: 'received', render: r => <>{at(r.receivedAt)}<div className="text-xs text-slate-500">{r.daysOpen != null && r.status !== 'CLOSED' ? `${r.daysOpen} days open` : ''}</div></> },
            { key: 'customerName', label: 'Customer', render: r => <>{r.customerName}<div className="text-xs text-slate-500">{r.partnerName || ''}</div></> },
            { key: 'productName', label: 'Product / batch', render: r => `${r.productName || '-'}${r.batchNo ? ` / ${r.batchNo}` : ''}` },
            { key: 'complaintType', label: 'Type', render: r => words(r.complaintType) }, { key: 'description', label: 'Complaint', className: 'max-w-sm' },
          ]} />
      </Section>
      {open?.complaintNo && <Section title={<>{open.complaintNo} <span className="ml-2 align-middle"><Pill state={open.status} /></span></>} right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
        <p className="text-sm">{open.customerName}{open.contact ? ` (${open.contact})` : ''} · {words(open.complaintType)} · {words(open.severity)} · received {at(open.receivedAt)}</p>
        <p className="mt-1 text-sm">{open.description}</p>
        <p className="mt-1 text-xs text-slate-500">{[open.partnerName, open.productName, open.batchNo && `batch ${open.batchNo}`, open.tripNumber && `trip ${open.tripNumber}`, open.warehouseName].filter(Boolean).join(' · ')}
          {open.batchNo && open.partnerId && open.productId ? <> · <Link to={`/cold-chain/custody`} className="font-bold text-sky-700 hover:underline">Chain of Custody</Link></> : null}</p>
        {open.status === 'CLOSED'
          ? <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2"><div><dt className="text-slate-500">Investigation</dt><dd>{open.investigation}</dd></div><div><dt className="text-slate-500">Root cause</dt><dd>{open.rootCause}</dd></div>
              <div><dt className="text-slate-500">Corrective action</dt><dd>{open.correctiveAction}</dd></div><div><dt className="text-slate-500">Preventive action</dt><dd>{open.preventiveAction}</dd></div>
              <div><dt className="text-slate-500">Reply to the customer</dt><dd>{open.customerReply || '-'}</dd></div><div><dt className="text-slate-500">Closed</dt><dd>{at(open.closedAt)} by {open.closedByName}</dd></div></dl>
          : <>
            <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget)); void run(() => send(`${H}/complaints/${open.id}/investigate`, b), x => setOpen(x)); }} className="mt-3 grid gap-2 md:grid-cols-4">
              <div className="md:col-span-3"><span className={label}>Investigation *</span><textarea name="investigation" required rows={2} defaultValue={open.investigation || ''} className={input} /></div>
              <div><span className={label}>Severity</span><select name="severity" defaultValue={open.severity} className={input}>{SEVERITIES.map(s => <option key={s} value={s}>{words(s)}</option>)}</select><button className={`${btnLight} mt-2`} disabled={busy}>Save investigation</button></div>
            </form>
            {me.manager ? <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget)); void run(() => send(`${H}/complaints/${open.id}/close`, b), x => setOpen(x)); }} className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
              <div><span className={label}>Root cause *</span><input name="rootCause" required className={input} /></div>
              <div><span className={label}>Corrective action *</span><input name="correctiveAction" required className={input} /></div>
              <div><span className={label}>Preventive action *</span><input name="preventiveAction" required className={input} /></div>
              <div><span className={label}>Reply to the customer</span><input name="customerReply" className={input} /></div>
              <div><button className={btnRed} disabled={busy}>Close with CAPA</button></div>
            </form> : <p className="mt-3 text-sm text-slate-600">A Manager or Admin closes the complaint with the root cause, corrective and preventive action.</p>}
          </>}
      </Section>}
    </>}

    {tab === 'RECALL' && <>
      <div className="mt-3"><button className={btn} onClick={() => setForm(form ? null : {})}>{form ? 'Cancel' : 'Start a mock recall'}</button></div>
      {form && <Section title="Start a mock recall"><QuickForm cols={4} busy={busy} submitText="Start the clock" onCancel={() => setForm(null)} onSubmit={v => run(() => send(`${H}/recalls`, v), x => { setForm(null); if (x?.id) void openRecall(x.id); })} fields={[
        { name: 'partnerId', label: 'Partner', type: 'select', options: (look?.partners || []).map((p: any) => [p.id, p.name]), required: true },
        { name: 'productId', label: 'Product', type: 'select', options: (look?.products || []).map((p: any) => [p.id, `${p.code} ${p.name}`]), required: true },
        { name: 'batchNo', label: 'Batch', required: true }, { name: 'reason', label: 'Reason', required: true, placeholder: 'Quarterly mock recall' },
      ]} /><p className="mt-1 text-xs text-slate-500">Target: {data?.targetPercent ?? '-'} % of the batch traced within {data?.targetMinutes ?? '-'} min. Trace the batch on Chain of Custody, then finish here.</p></Section>}
      <Section title="Mock recalls">
        {!data ? <p className="text-slate-500">Loading...</p> : !data.recalls?.length ? <p className="text-slate-500">No mock recall yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Recall</th><th>Batch</th><th>Started</th><th>Time</th><th>Traced</th><th>Result</th><th /></tr></thead>
          <tbody>{data.recalls.map((r: any) => <tr key={r.id} className="border-t align-top">
            <td className="p-2 font-semibold">{r.recallNo}<div className="text-xs font-normal text-slate-500">{r.reason}</div></td><td>{r.productCode} / {r.batchNo}<div className="text-xs text-slate-500">{r.partnerName}</div></td>
            <td>{at(r.startedAt)}</td><td>{duration(r.minutesTaken ?? r.minutesSoFar)}{r.status !== 'DONE' ? ' so far' : ''}</td><td>{r.percentTraced != null ? `${Number(r.percentTraced)} %` : '-'}</td>
            <td>{r.result ? <Pill state={r.result} /> : <Pill state="RUNNING" text="Running" />}</td>
            <td className="whitespace-nowrap"><button className={btnLight} onClick={() => openRecall(r.id)}>Open</button>
              {r.status === 'DONE' && <button className={`${btnLight} ml-1`} onClick={() => download(`${H}/recalls/${r.id}/report.pdf`, `${fileName(r.recallNo)}.pdf`)}>PDF</button>}</td></tr>)}</tbody></table></div>}
      </Section>
      {open?.recallNo && <Section title={`${open.recallNo}: ${open.productCode} batch ${open.batchNo}`} right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
        {open.status !== 'DONE' ? <form onSubmit={(e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const b = Object.fromEntries(new FormData(e.currentTarget)); void run(() => send(`${H}/recalls/${open.id}/finish`, b), x => setOpen(x)); }} className="grid gap-2 md:grid-cols-4">
            <p className="text-sm md:col-span-4">Started {at(open.startedAt)}, {duration(open.minutesSoFar)} so far. Finishing stops the clock and counts every unit of the batch from its custody record: in stock, dispatched to named consignees, disposed or moved.</p>
            <div className="md:col-span-3"><span className={label}>Findings</span><input name="findings" className={input} placeholder="Every pallet found in the chamber" /></div>
            <div className="flex items-end"><button className={btn} disabled={busy}>Finish the recall</button></div>
          </form>
          : <>
            <Tiles items={[['Received', Number(open.qtyReceived ?? 0)], ['In stock', Number(open.qtyInStock ?? 0)], ['Dispatched', Number(open.qtyDispatched ?? 0)], ['Other', Number(open.qtyOther ?? 0)],
              ['Traced', `${Number(open.percentTraced ?? 0)} %`, open.result], ['Time', duration(open.minutesTaken)]]} />
            <p className="mt-2 text-sm">Result <Pill state={open.result} /> against the target of {Number(open.targetPercent)} % within {open.targetMinutes} min. {open.findings || ''}</p>
            {open.consignees?.length > 0 && <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Order</th><th>Consignee</th><th>City</th><th>Quantity</th></tr></thead>
              <tbody>{open.consignees.map((c: any, k: number) => <tr key={k} className="border-t"><td className="p-2">{c.orderNo}</td><td>{c.consignee}</td><td>{c.city || '-'}</td><td>{Number(c.quantity)}</td></tr>)}</tbody></table>}
          </>}
      </Section>}
    </>}

    {tab === 'AUDIT' && <>
      <Section title="Audit pack">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">Standard<select className={input} value={pack.standard} onChange={e => setPack({ ...pack, standard: e.target.value })}><option value="FSSAI">FSSAI (Schedule 4)</option><option value="GDP">GDP (pharma)</option></select></label>
          <label className="text-sm font-semibold text-slate-700">From<input type="date" className={input} value={pack.from} onChange={e => setPack({ ...pack, from: e.target.value })} /></label>
          <label className="text-sm font-semibold text-slate-700">To<input type="date" className={input} value={pack.to} onChange={e => setPack({ ...pack, to: e.target.value })} /></label>
          <label className="text-sm font-semibold text-slate-700">Site<select className={input} value={pack.warehouseId} onChange={e => setPack({ ...pack, warehouseId: e.target.value })}><option value="">All sites</option>{sites.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
          <div className="flex items-end"><button className={btnLight} onClick={() => setReload(r => r + 1)}>Show</button></div>
        </div>
        <p className="mt-1 text-xs text-slate-500">Blank dates: the last 90 days.</p>
        {data?.sections && <>
          <p className="mt-3 text-sm">Period {day(data.from)} to {day(data.to)}.</p>
          <table className="mt-2 w-full text-sm"><thead><tr className="bg-slate-50 text-left"><th className="p-2">Section</th><th>What it holds</th><th>Records</th></tr></thead>
            <tbody>{data.sections.map((s: any) => <tr key={s.key} className="border-t"><td className="p-2 font-semibold">{s.title}</td><td className="text-slate-600">{s.note}</td><td>{s.rows}</td></tr>)}</tbody></table>
          <div className="mt-3 flex gap-2">
            <button className={btn} onClick={() => download(`${H}/audit-pack.pdf${packQuery()}`, `AuditPack_${pack.standard}_${data.from}_${data.to}.pdf`)}>Download PDF</button>
            <button className={btnLight} onClick={() => download(`${H}/audit-pack.xlsx${packQuery()}`, `AuditPack_${pack.standard}_${data.from}_${data.to}.xlsx`)}>Download Excel</button>
          </div>
        </>}
      </Section>
    </>}

    {tab === 'SETTINGS' && data && !data.sections && <Section title="Settings of the cold chain records">
      {me.manager ? <QuickForm cols={3} initial={data} busy={busy} submitText="Save settings" onSubmit={v => run(() => send('/api/coldchain/records/settings', v, 'PUT'), x => setData(x))} fields={[
        { name: 'hygieneCheckMode', label: 'Truck hygiene check before loading', type: 'select', options: HYGIENE_MODES, required: true },
        { name: 'hygieneCheckHours', label: 'A passed check is valid for (hours)', type: 'number', step: '1', required: true },
        { name: 'exposureDefaultMinutes', label: 'Default limit out of cold storage (min)', type: 'number', step: '1', required: true },
        { name: 'dueSoonDays', label: 'Calibration and mapping due soon (days)', type: 'number', step: '1', required: true },
        { name: 'mockRecallTargetPercent', label: 'Mock recall target (% traced)', type: 'number', step: '0.1', required: true },
        { name: 'mockRecallTargetMinutes', label: 'Mock recall target (minutes)', type: 'number', step: '1', required: true },
      ]} /> : <dl className="grid gap-2 text-sm md:grid-cols-3">
        <div><dt className="text-slate-500">Truck hygiene check</dt><dd>{words(data.hygieneCheckMode)}, valid {data.hygieneCheckHours} h</dd></div>
        <div><dt className="text-slate-500">Default limit out of cold storage</dt><dd>{data.exposureDefaultMinutes} min</dd></div>
        <div><dt className="text-slate-500">Due soon</dt><dd>{data.dueSoonDays} days</dd></div>
        <div><dt className="text-slate-500">Mock recall target</dt><dd>{data.mockRecallTargetPercent} % in {data.mockRecallTargetMinutes} min</dd></div>
        <p className="md:col-span-3 text-slate-500">A Manager or Admin changes these.</p></dl>}
      {data.defaults && <p className="mt-2 text-xs text-slate-500">Defaults from application.properties: check {words(data.defaults.hygieneCheckMode)} {data.defaults.hygieneCheckHours} h, {data.defaults.exposureDefaultMinutes} min out, due soon {data.defaults.dueSoonDays} days, recall {data.defaults.mockRecallTargetPercent} % in {data.defaults.mockRecallTargetMinutes} min.</p>}
    </Section>}
  </>;
}

function ScheduleForm({ initial, sites, chambers, vehicles, busy, onSubmit, onCancel }: { initial: any; sites: [number, string][]; chambers: [number, string][]; vehicles: [number, string][]; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  const [type, setType] = useState<string>(initial.areaType || 'CHAMBER');
  const where = type === 'CHAMBER' ? { name: 'chamberId', label: 'Chamber', type: 'select' as const, options: chambers, required: true }
    : type === 'VEHICLE' ? { name: 'vehicleId', label: 'Truck', type: 'select' as const, options: vehicles, required: true }
      : { name: 'warehouseId', label: 'Site', type: 'select' as const, options: sites, required: true };
  return <>
    {!initial.id && <div className="mb-3 max-w-xs"><span className={label}>What is cleaned</span><select className={input} value={type} onChange={e => setType(e.target.value)}>
      <option value="CHAMBER">A chamber</option><option value="AREA">An area of a site (dock, corridor)</option><option value="VEHICLE">A truck</option></select></div>}
    <QuickForm key={type} cols={3} initial={{ active: true, ...initial }} busy={busy} submitText="Save schedule" onCancel={onCancel} onSubmit={v => onSubmit({ ...v, areaType: type })} fields={[
      where, { name: 'areaName', label: 'Name (blank: the chamber or truck)' }, { name: 'frequencyDays', label: 'Every (days)', type: 'number', step: '1', required: true },
      { name: 'method', label: 'Method' }, { name: 'chemical', label: 'Chemical' }, { name: 'dilution', label: 'Dilution' }, { name: 'responsible', label: 'Responsible' },
      { name: 'active', label: 'In use', type: 'checkbox' },
    ]} />
  </>;
}

function LogForm({ busy, onSubmit }: { busy: boolean; onSubmit: (b: Record<string, unknown>) => void }) {
  const [show, setShow] = useState(false);
  if (!show) return <button className={btnLight} onClick={() => setShow(true)}>Log</button>;
  return <form onSubmit={e => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.currentTarget))); setShow(false); }} className="grid min-w-[16rem] gap-1">
    <input name="doneAt" defaultValue={nowIndia()} className={input} /><input name="doneBy" placeholder="Done by" className={input} /><input name="checkedBy" placeholder="Checked by" className={input} />
    <input name="chemicalUsed" placeholder="Chemical used" className={input} />
    <select name="result" className={input}><option value="DONE">Done</option><option value="PARTIAL">Partly done</option><option value="SKIPPED">Skipped</option></select>
    <input name="note" placeholder="Note (needed when not fully done)" className={input} />
    <div className="flex gap-1"><button className={btnLight} disabled={busy}>Save</button><button type="button" className={btnLight} onClick={() => setShow(false)}>Cancel</button></div>
  </form>;
}

function TruckCheckForm({ items, vehicles, trips, busy, onSubmit, onCancel }: { items: Record<string, string>; vehicles: [number, string][]; trips: [number, string][]; busy: boolean; onSubmit: (b: Record<string, unknown>) => void; onCancel: () => void }) {
  return <form onSubmit={e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ticked: Record<string, boolean> = {};
    for (const k of Object.keys(items)) ticked[k] = f.get(`item.${k}`) === 'on';
    onSubmit({ vehicleId: f.get('vehicleId'), tripId: f.get('tripId'), checkedAt: f.get('checkedAt'), boxTempC: toBase('temp', f.get('boxTempC')), remarks: f.get('remarks'), items: ticked });
  }} className="grid gap-3 md:grid-cols-4">
    <div><span className={label}>Truck *</span><select name="vehicleId" required className={input}><option value="">Choose</option>{vehicles.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
    <div><span className={label}>Trip</span><select name="tripId" className={input}><option value="">-</option>{trips.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
    <div><span className={label}>Checked at</span><input name="checkedAt" defaultValue={nowIndia()} className={input} /></div>
    <div><span className={label}>Box temperature ({unitNow('temp')})</span><input name="boxTempC" type="number" step="any" className={input} /></div>
    <fieldset className="grid gap-1 md:col-span-4 md:grid-cols-2"><legend className={label}>Tick every item that is fine</legend>
      {Object.entries(items).map(([k, t]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" name={`item.${k}`} className="h-4 w-4" />{t}</label>)}</fieldset>
    <div className="md:col-span-3"><span className={label}>Remarks (needed when an item is not fine)</span><input name="remarks" className={input} /></div>
    <div className="flex items-end gap-2"><button className={btn} disabled={busy}>Save check</button><button type="button" className={btnLight} onClick={onCancel}>Cancel</button></div>
  </form>;
}
