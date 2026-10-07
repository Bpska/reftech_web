/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-008 -- the RTO and toll alert board. Every finding of the government checks (challans, Parivahan,
// licences, FASTag, missing tolls, GST, FSSAI, statutory dates) lands here, and is emailed to the Employee
// (driver), the Manager and the Admin: High at once, the rest in the 08:00 summary. Open alerts not acknowledged
// are reminded. An Employee sees the alerts of their own truck and trips; a Manager and an Admin see all.
// Backend: /api/gov/alerts (GovController). Needs database_v2/43_government_data_and_alerts.sql.
import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Siren } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { LEVEL_LABEL, LEVEL_STYLE, SCRIPT, TILE_STYLE, sourceText, when, words } from './gov';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STATUS_STYLE: Record<string, string> = { OPEN: 'bg-red-100 text-red-800', ACKNOWLEDGED: 'bg-amber-100 text-amber-800', CLOSED: 'bg-slate-200 text-slate-700' };

/** Where the record behind an alert is kept. */
function recordLink(a: any): [string, string] | null {
  const k = String(a.kind || '');
  if (k === 'CHALLAN') return ['/gov/challans', 'Challans'];
  if (k.startsWith('VAHAN')) return ['/gov/vehicles', 'Truck Records'];
  if (k === 'LICENCE' || k === 'CONSENT') return ['/gov/licences', 'Driving Licences'];
  if (k.startsWith('FASTAG') || k === 'TOLL_DEBIT') return ['/gov/tolls', 'Tolls and FASTag'];
  if (k.startsWith('TOLL') && a.tripId) return [`/trips/${a.tripId}`, 'Trip tolls'];
  if (k === 'GST') return ['/gov/gst', 'GST Checks'];
  if (k === 'FSSAI') return ['/gov/fssai', 'FSSAI Licences'];
  if (k === 'CALENDAR') return ['/gov/calendar', 'Compliance Calendar'];
  if (k === 'PERMIT_STATE' && a.tripId) return [`/trips/${a.tripId}`, 'Trip'];
  return null;
}

export function GovAlertsPage() {
  const [params, setParams] = useSearchParams();
  const board = (params.get('board') || 'RTO').toUpperCase();
  const [status, setStatus] = useState('OPEN'), [data, setData] = useState<any>(null), [open, setOpen] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const load = () => api(`/api/gov/alerts?board=${board}&status=${status}`).then(setData).catch(e => setErr(errorText(e, 'The alerts could not be read')));
  const openAlert = (id: number | string) => api(`/api/gov/alerts/${id}`).then(setOpen).catch(e => setErr(errorText(e, 'The alert could not be read')));
  useEffect(() => { void load(); }, [board, status]);
  useEffect(() => { const id = params.get('id'); if (id) void openAlert(id); }, []);

  async function run(fn: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done); setOpen(x); await load(); }
    catch (e) { setErr(errorText(e, 'Not saved')); } finally { setBusy(false); }
  }
  const acknowledge = () => run(() => api(`/api/gov/alerts/${open.id}/acknowledge`, { method: 'POST' }), 'Acknowledged. The reminder emails stop.');
  function close(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get('note') || '');
    void run(() => api(`/api/gov/alerts/${open.id}/close`, { method: 'POST', body: JSON.stringify({ note }) }), 'Alert closed.');
  }

  if (data && data.ready === false) return <><h1 className="text-3xl font-bold">RTO and Toll Alerts</h1><NotReady script={SCRIPT} /></>;
  const c = data?.counts || {};
  const tile = (b: string, title: string, n: any, top: string, unack: any) =>
    <button onClick={() => { setParams({ board: b }); setOpen(null); }} className={`rounded-2xl p-4 text-left shadow-sm ${TILE_STYLE[top] || TILE_STYLE.NONE} ${board === b ? 'ring-2 ring-sky-600' : ''}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="text-3xl font-bold">{Number(n || 0)}</div>
      <div className="text-xs">{Number(unack || 0)} not acknowledged{top && top !== 'NONE' ? `, highest ${LEVEL_LABEL[top]}` : ''}</div>
    </button>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Siren />RTO and Toll Alerts</h1>
    <p className="text-slate-600">What the government checks found: challans, truck papers, licences, FASTag and tolls. High alerts are emailed at once, the rest in the 08:00 summary.
      {data && !data.emailEnabled ? ' Email is not set up yet, so alerts show here only.' : ''}</p>
    <Banner msg={msg} error={err} />
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {tile('RTO', 'RTO and Challan alerts', c.rto, c.rtoHighest, c.rtoNotAcknowledged)}
      {tile('TOLL', 'Toll alerts', c.toll, c.tollHighest, c.tollNotAcknowledged)}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {[['OPEN', 'Open'], ['CLOSED', 'Closed'], ['ALL', 'All']].map(([k, t]) =>
        <button key={k} onClick={() => setStatus(k)} className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${status === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
    </div>

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-4 shadow-sm">
      {!data ? <p className="text-slate-500">Loading...</p> : !data.alerts?.length ? <p className="text-slate-500">No alert here.</p> :
        <table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2">Level</th><th>What</th><th>Truck</th><th>Driver</th><th>Trip</th><th>Found</th><th>Status</th><th>Email</th><th /></tr></thead>
          <tbody>{data.alerts.map((a: any) => <tr key={a.id} className={`border-t align-top ${open?.id === a.id ? 'bg-sky-50' : ''}`}>
            <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[a.level] || ''}`}>{LEVEL_LABEL[a.level] || a.level}</span></td>
            <td className="max-w-md"><b>{a.kindLabel}</b>{a.subject ? <span className="text-slate-600"> · {a.subject}</span> : null}<div className="text-xs text-slate-600">{a.message}</div></td>
            <td>{a.vehicleNumber || '-'}</td><td>{a.driverName || '-'}</td>
            <td>{a.tripId ? <Link to={`/trips/${a.tripId}`} className="font-bold text-sky-700 hover:underline">{a.tripNumber}</Link> : '-'}</td>
            <td className="whitespace-nowrap">{when(a.foundAt)}</td>
            <td><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[a.status] || ''}`}>{a.statusLabel}</span></td>
            <td className="whitespace-nowrap text-xs">{a.emailedAt ? `Sent ${when(a.emailedAt)}` : a.emailMode}</td>
            <td className="p-2"><button className={btnLight} onClick={() => openAlert(a.id)}>Open</button></td>
          </tr>)}</tbody>
        </table>}
    </section>

    {open && <Section title={<>{open.kindLabel} <span className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-bold ${STATUS_STYLE[open.status] || ''}`}>{open.statusLabel}</span></>}
      right={<button className={btnLight} onClick={() => setOpen(null)}>Close</button>}>
      <p className="text-sm"><span className={`mr-2 rounded-full px-2 py-0.5 text-xs font-bold ${LEVEL_STYLE[open.level] || ''}`}>{LEVEL_LABEL[open.level] || open.level}</span>{open.message}</p>
      <p className="mt-1 text-sm text-slate-600">
        {open.vehicleNumber ? `Truck ${open.vehicleNumber}. ` : ''}{open.driverName ? `Driver ${open.driverName}. ` : ''}Found {when(open.foundAt)} from {sourceText(open.source)}.
        {(() => { const l = recordLink(open); return l ? <> Open <Link to={l[0]} className="font-bold text-sky-700 hover:underline">{l[1]}</Link>.</> : null; })()}
      </p>
      {open.challan && <p className="mt-1 text-sm">Challan {open.challan.challan_no}: {open.challan.offence || '-'}, {open.challan.amount != null ? `${fmtMoney(open.challan.amount)}` : '-'}, {words(open.challan.status)}.</p>}
      {open.ackAt && <p className="mt-1 text-sm">Acknowledged by {open.ackByName} on {when(open.ackAt)}.</p>}
      {open.closedAt && <p className="mt-1 text-sm">Closed by {open.closedByName} on {when(open.closedAt)}: {open.closeNote}</p>}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        {open.canAcknowledge && <button className={btn} disabled={busy} onClick={acknowledge}>Acknowledge</button>}
      </div>
      {open.canClose && <form onSubmit={close} className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-3"><span className={label}>What was done *</span><input name="note" required minLength={5} className={input} placeholder="Challan paid online, receipt in the truck file" /></div>
        <div className="flex items-end"><button className={btnLight} disabled={busy}>Close the alert</button></div>
      </form>}

      {open.email && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
        <h3 className="font-bold">The email</h3>
        <p><b>To:</b> {open.email.to || 'Nobody yet (no email address on file)'}</p>
        <p><b>Subject:</b> {open.email.subject}</p>
        <p className="whitespace-pre-line text-slate-700">{open.email.body}</p>
        <p className="mt-1 text-xs text-slate-500">{open.emailedAt ? `Sent ${when(open.emailedAt)}` : open.emailMode}{open.emailNote ? `. ${open.emailNote}` : ''}</p>
      </div>}

      {open.events?.length > 0 && <div className="mt-4"><h3 className="font-bold">History</h3>
        <ul className="mt-1 space-y-1 text-sm">{open.events.map((e: any, i: number) => <li key={i}><span className="text-slate-500">{when(e.at)}</span> · {e.byName || '-'} · {words(e.action)}{e.note ? `: ${e.note}` : ''}</li>)}</ul></div>}
    </Section>}
  </>;
}
