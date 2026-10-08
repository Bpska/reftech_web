/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-005 -- Delayed Trips. For Employee, Manager and Admin; opened by the Dashboard tile "Delay Alerts".
//
// One row for every open delay alert: the trip, the promised time, the arrival time calculated last, how late
// the truck is, the driver and his number. "Acknowledge" records that the delay is known (who was informed);
// the alert stays open until the truck arrives or the promised time is changed on the trip page.
//
// Backend: GET /api/operations/delays?all=true, POST /api/operations/delays/{id}/acknowledge (EtaController).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock3, RefreshCw } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { delayText } from '@/modules/trip/TripEtaPanel';
import { fmtDateTime, fmtDistance } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Row = {
  id: number; status: string; message?: string; delayMinutes?: number | null; raisedAt?: string; note?: string | null; resolvedAt?: string | null; closedBecause?: string | null;
  tripId: number; tripNumber: string; partnerName?: string; vehicleNumber?: string; driverName?: string | null; driverMobile?: string | null;
  sourceCity?: string; destinationCity?: string; promisedAt?: string | null; etaAt?: string | null; distanceKm?: number | null; source?: string | null;
};
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const BADGE: Record<string, string> = { OPEN: 'bg-red-100 text-red-800', ACKNOWLEDGED: 'bg-amber-100 text-amber-900', RESOLVED: 'bg-slate-100 text-slate-700' };
const LABEL: Record<string, string> = { OPEN: 'Open', ACKNOWLEDGED: 'Acknowledged', RESOLVED: 'Closed' };

export function DelaysPage() {
  const user = currentUser();
  const staff = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase()) && String(user.loginType || user.userType || '').toUpperCase() !== 'PARTNER';
  const [rows, setRows] = useState<Row[] | null>(null);
  const [all, setAll] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [ackId, setAckId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);   // a second click before the screen is drawn again is not sent twice

  const load = useCallback(async () => {
    try { setRows(await api(`/api/operations/delays${all ? '?all=true' : ''}`)); }
    catch (x: any) { setRows([]); setMsg({ ok: false, text: x?.message || 'Could not load the delayed trips' }); }
  }, [all]);
  useEffect(() => { if (staff) void load(); }, [staff, load]);

  async function acknowledge(e: FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    const note = String(new FormData(e.currentTarget).get('note') || '').trim();
    try {
      await api(`/api/operations/delays/${id}/acknowledge`, { method: 'POST', body: JSON.stringify({ note }) });
      setAckId(null); setMsg({ ok: true, text: 'The delay is acknowledged.' });
      await load();
    } catch (x: any) { setMsg({ ok: false, text: x?.message || 'Could not be saved' }); }
    finally { sending.current = false; setBusy(false); }
  }

  if (!staff) return <div className="p-10">This page is for RefTech staff.</div>;
  const open = (rows || []).filter(r => r.status !== 'RESOLVED').length;

  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="flex items-center gap-2 text-3xl font-bold text-slate-900"><Clock3 className="h-8 w-8 text-rose-700" />Delayed Trips{rows && <span data-testid="delay-count" className="rounded-full bg-rose-100 px-3 py-1 text-base font-bold text-rose-800">{open}</span>}</h1>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} />Also show the alerts closed in the last 30 days</label>
        <button type="button" onClick={() => { void load(); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-sky-400"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>
    </div>
    <p className="mt-1 text-slate-600">Trips whose truck will arrive after the promised time by more than the margin. The arrival time is calculated again every few minutes from the latest position of the truck.</p>
    {msg && <div role="status" className={`mt-4 rounded-xl p-3 font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    <section className="mt-4 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm">
      <table data-testid="delays" className="w-full min-w-[1150px] text-sm">
        <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Trip</th><th className="p-2">Partner</th><th className="p-2">Truck and driver</th><th className="p-2">Route</th><th className="p-2">Promised</th><th className="p-2">Expected now</th><th className="p-2">Late by</th><th className="p-2">To go</th><th className="p-2">Alert</th><th className="p-2"></th></tr></thead>
        <tbody>{rows === null ? <tr><td colSpan={10} className="p-6 text-center text-slate-400">Loading...</td></tr>
          : rows.length === 0 ? <tr><td colSpan={10} className="p-6 text-center text-slate-400">No trip is delayed.</td></tr>
            : rows.map(r => <tr key={r.id} data-trip={r.tripNumber} className="border-t align-top">
              <td className="p-2 font-semibold">{r.tripNumber}</td><td className="p-2">{r.partnerName || '-'}</td>
              <td className="p-2">{r.vehicleNumber || '-'}<div className="text-xs text-slate-500">{r.driverName || 'No driver'}{r.driverMobile ? `, ${r.driverMobile}` : ''}</div></td>
              <td className="p-2">{r.sourceCity || '-'} → {r.destinationCity || '-'}</td>
              <td className="p-2 whitespace-nowrap">{when(r.promisedAt)}</td>
              <td className="p-2 whitespace-nowrap font-semibold">{r.etaAt ? when(r.etaAt) : <span className="text-slate-500">no position</span>}</td>
              <td className={`p-2 whitespace-nowrap font-bold ${r.status === 'RESOLVED' ? 'text-slate-600' : 'text-red-700'}`}>{delayText(r.delayMinutes == null ? null : Math.round(Number(r.delayMinutes)))}</td>
              <td className="p-2 whitespace-nowrap">{r.distanceKm == null ? '-' : `${fmtDistance(r.distanceKm)}`}</td>
              <td className="p-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[r.status] || ''}`}>{LABEL[r.status] || r.status}</span>
                <div className="mt-1 text-xs text-slate-500">raised {when(r.raisedAt)}</div>
                {r.note && <div className="mt-1 text-xs text-slate-700">{r.note}</div>}
                {r.status === 'RESOLVED' && r.closedBecause && <div className="mt-1 text-xs text-slate-700">{r.closedBecause}</div>}
                {ackId === r.id && <form onSubmit={e => { void acknowledge(e, r.id); }} className="mt-2 flex gap-2">
                  <input name="note" required minLength={5} maxLength={500} aria-label={`Note for the delay of ${r.tripNumber}`} placeholder="Who was informed, why it is late" className="w-64 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                  <button disabled={busy} className="rounded-lg bg-slate-900 px-3 py-1 text-xs font-bold text-white disabled:opacity-50">Save</button>
                </form>}</td>
              <td className="p-2 whitespace-nowrap">
                <Link to={`/trips/${r.tripId}`} className="rounded-lg border border-sky-500 px-3 py-1.5 text-xs font-bold text-sky-700">View</Link>
                {r.status === 'OPEN' && ackId !== r.id && <button type="button" onClick={() => { setMsg(null); setAckId(r.id); }} className="ml-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800">Acknowledge</button>}
              </td>
            </tr>)}</tbody>
      </table>
    </section>
  </>;
}
