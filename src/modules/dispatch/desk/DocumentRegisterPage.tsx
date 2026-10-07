/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-009 -- Dispatch document register. Staff only.
//
// The trips of a period (planned start) with how many consignment notes and papers they have and what is still
// missing before Start Trip. "Only missing" keeps the trips with something missing. Open a trip to see its
// consignment notes and e-way bills; a note opens as PDF.
// Backend: GET /api/dispatch/documents/register?from=&to=&missing=true|false,
// GET /api/dispatch/trips/{id}/documents (the notes of one trip), GET /api/dispatch/consignment-notes/{id}/pdf.
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { api, apiOpen } from '@/shared/services/api';
import { Banner, NotReady, btnLight, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { indiaDay, plain, when } from '../dispatch';
import { SCRIPT64, addDays, notReady } from './desk';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const STAGE_STYLE: Record<string, string> = { PLANNED: 'bg-sky-100 text-sky-800', LOADING: 'bg-violet-100 text-violet-800', IN_TRANSIT: 'bg-emerald-100 text-emerald-800' };

export function DocumentRegisterPage() {
  const today = indiaDay();
  const [from, setFrom] = useState(addDays(today, -3)), [to, setTo] = useState(addDays(today, 14)), [missing, setMissing] = useState(true);
  const [data, setData] = useState<any>(null), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [open, setOpen] = useState<number | null>(null);

  const load = () => {
    setBusy(true); setErr('');
    return api(`/api/dispatch/documents/register?from=${from}&to=${to}&missing=${missing}`).then(setData)
      .catch(e => setErr(errorText(e, 'The register could not be read'))).finally(() => setBusy(false));
  };
  useEffect(() => { void load(); }, [from, to, missing]);

  const head = <div>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FileText />Document Register</h1>
    <p className="text-slate-600">Consignment notes, e-way bills and invoice copies of the trips of a period.</p>
  </div>;
  if (notReady(data) || notReady(err)) return <>{head}<NotReady script={SCRIPT64} /></>;
  const trips: any[] = data?.trips || [];

  return <>
    {head}
    <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
      <div><label className={label}>Trips starting from</label><input type="date" className={input} value={from} onChange={e => e.target.value && setFrom(e.target.value)} /></div>
      <div><label className={label}>to</label><input type="date" className={input} value={to} onChange={e => e.target.value && setTo(e.target.value)} /></div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="h-4 w-4" checked={missing} onChange={e => setMissing(e.target.checked)} />Only trips with something missing</label>
      <button className={`${btnLight} mb-1`} onClick={() => void load()} disabled={busy}><RefreshCw className="mr-1 inline h-4 w-4" />Refresh</button>
    </div>
    <Banner error={err} />
    {data && data.documentsRequired === false && <div className="my-3 rounded-xl bg-sky-50 p-3 text-sm text-sky-900">Start Trip does not need the documents in this company (Dispatch Setup). Missing papers are listed as a reminder only.</div>}

    {data && <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      {!trips.length ? <p className="text-sm text-slate-500">{missing ? 'Every trip of the period has its papers.' : 'No trip in this period.'}</p> :
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr><th className={th}></th><th className={th}>Trip</th><th className={th}>Start</th><th className={th}>Truck</th><th className={th}>Partner</th><th className={th}>Route</th><th className={th}>Stage</th><th className={th}>Notes</th><th className={th}>Files</th><th className={th}>Missing</th></tr></thead>
          <tbody>{trips.map(t => <Fragment key={t.id}>
            <tr className="border-t border-slate-100">
              <td className={td}><button className="text-slate-500" onClick={() => setOpen(open === t.id ? null : t.id)} title="Notes and e-way bills">{open === t.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
              <td className={td}><Link to={`/dispatch/trips/${t.id}`} className="font-semibold text-sky-700 hover:underline">{t.tripNumber}</Link></td>
              <td className={`${td} whitespace-nowrap`}>{when(t.plannedStartAt)}</td>
              <td className={td}>{t.vehicleNumber || '-'}</td>
              <td className={td}>{t.partnerName || '-'}</td>
              <td className={td}>{t.sourceCity} - {t.destinationCity}</td>
              <td className={td}><span className={`rounded-lg px-2 py-0.5 text-xs font-semibold ${STAGE_STYLE[t.stage] || 'bg-slate-100 text-slate-700'}`}>{t.stageLabel || t.stage}</span></td>
              <td className={td}>{t.notes}</td>
              <td className={td}>{t.documents}</td>
              <td className={td}>{t.complete ? <span className="font-semibold text-emerald-700">Complete</span> :
                <ul className="list-disc pl-4 text-red-800">{(t.missing || []).map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>}</td>
            </tr>
            {open === t.id && <tr><td colSpan={10} className="bg-slate-50 p-3"><TripNotes tripId={t.id} /></td></tr>}
          </Fragment>)}</tbody>
        </table></div>}
      {trips.length >= 300 && <p className="mt-2 text-xs text-slate-500">The first 300 trips are shown. Choose a shorter period.</p>}
    </div>}
  </>;
}

/** The consignment notes and e-way bills of one trip. */
function TripNotes({ tripId }: { tripId: number }) {
  const [v, setV] = useState<any>(null), [err, setErr] = useState('');
  useEffect(() => { api(`/api/dispatch/trips/${tripId}/documents`).then(setV).catch(e => setErr(errorText(e, 'The documents could not be read'))); }, [tripId]);
  const pdf = (id: number) => apiOpen(`/api/dispatch/consignment-notes/${id}/pdf`).catch(e => setErr(errorText(e, 'The PDF could not be opened')));
  if (err) return <Banner error={err} />;
  if (!v) return <p className="text-sm text-slate-500">Reading...</p>;
  const rows: any[] = v.consignments || [], bills: any[] = v.ewayBills || [];
  return <div className="space-y-3">
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead className="text-slate-600"><tr><th className={th}>Consignment</th><th className={th}>Note</th><th className={th}>Consignee</th><th className={th}>E-way bill</th><th className={th}>Papers</th><th className={th}>Problems</th></tr></thead>
      <tbody>{rows.map((c, i) => <tr key={i} className="border-t border-slate-200">
        <td className={td}><div className="font-semibold">{c.label}</div><div className="text-xs text-slate-500">{c.from} - {c.to}, {fmtWeight(c.tons)}</div></td>
        <td className={td}>{c.note ? <button className="font-semibold text-sky-700 hover:underline" onClick={() => void pdf(c.note.id)}>{c.note.cnNo} (PDF)</button> : <span className="text-red-700">none</span>}</td>
        <td className={td}>{c.note?.consigneeName || '-'}</td>
        <td className={td}>{c.note?.ewayBillNo || '-'}{c.eway && <div className="text-xs text-slate-500">{c.eway.status}{c.eway.validUntil ? `, valid to ${when(c.eway.validUntil)}` : ''}</div>}</td>
        <td className={td}>{(c.documents || []).map((d: any) => <div key={d.id} className="text-xs">{d.docType} {d.docNo || ''}</div>)}{!(c.documents || []).length && '-'}</td>
        <td className={td}>{(c.problems || []).length ? <ul className="list-disc pl-4 text-xs text-red-800">{c.problems.map((p: string, j: number) => <li key={j}>{p}</li>)}</ul> : <span className="text-emerald-700">-</span>}</td>
      </tr>)}</tbody>
    </table></div>
    {bills.length > 0 && <div className="text-xs text-slate-600">E-way bills of the trip: {bills.map(b => `${b.ewayBillNo} (${b.status}${b.validUntil ? `, to ${when(b.validUntil)}` : ''})`).join('; ')}</div>}
    <Link to={`/dispatch/trips/${tripId}`} className="text-sm font-semibold text-sky-700 hover:underline">Issue or change the documents on the trip page</Link>
  </div>;
}
