/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-009 -- the Documents tab of the Dispatch Plan: one card per consignment (the trip's own goods and each
// load) with its consignment note (issue, change, cancel with a reason, PDF in three copies), the e-way bill and
// what is wrong with it, and the scanned papers (invoice, challan, e-way bill copy). Start Trip checks them.
// Backend: GET /api/dispatch/trips/{id}/documents, POST /api/dispatch/trips/{id}/consignment-notes,
// PUT /api/dispatch/consignment-notes/{cnId}, POST /api/dispatch/consignment-notes/{cnId}/cancel { reason },
// GET /api/dispatch/consignment-notes/{cnId}/pdf, POST /api/dispatch/trips/{id}/documents/upload (multipart file,
// docType, docNo, docDate, consignmentNoteId), GET /api/dispatch/documents/{docId}/file, DELETE /api/dispatch/documents/{docId}.
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Upload } from 'lucide-react';
import { api, apiDownload, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { Problems, TabProps, askFor, plain, rupee, send, useAction, when, words } from './planning';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const FIELDS: [string, string, string?][] = [
  ['consigneeName', 'Consignee *'], ['consigneeGstin', 'Consignee GSTIN'], ['consigneeAddress', 'Consignee address'],
  ['fromPlace', 'From'], ['toPlace', 'To'], ['goodsDescription', 'Goods *'],
  ['packages', 'Packages', 'number'], ['pallets', 'Pallets', 'number'], ['weightTons', 'Weight (t)', 'number'],
  ['goodsValue', 'Goods value (₹)', 'number'], ['invoiceNumbers', 'Invoice numbers'], ['ewayBillNo', 'E-way bill no. (12 digits)'],
];
const DOC_TYPES: [string, string][] = [['INVOICE', 'Invoice'], ['CHALLAN', 'Challan'], ['EWAY_BILL', 'E-way bill'], ['OTHER', 'Other']];

export function DocumentsTab({ tripId, plan, reload }: TabProps) {
  const v = plan.documents || {};
  const editable = !!v.canEdit;
  const act = useAction(reload);
  const { busy, msg, err, setErr, run } = act;
  const [form, setForm] = useState<any>(null);   // { key, cnId?, tripLoadId, values }

  function startNote(c: any, note?: any) {
    const src = note || c.prefill || {};
    const values: any = { freightTerms: src.freightTerms || 'TBB', remarks: src.remarks || '' };
    for (const [k] of FIELDS) values[k] = src[k] ?? '';
    setForm({ key: c.tripLoadId ?? 'own', cnId: note?.id, tripLoadId: c.tripLoadId, values });
  }

  async function saveNote(e: FormEvent) {
    e.preventDefault();
    const body: any = {};
    for (const [k, val] of Object.entries(form.values)) body[k] = val === '' ? null : val;
    const call = form.cnId ? () => api(`/api/dispatch/consignment-notes/${form.cnId}`, send('PUT', body))
      : () => api(`/api/dispatch/trips/${tripId}/consignment-notes`, send('POST', { ...body, tripLoadId: form.tripLoadId ?? null }));
    if (await run(call, 'The note was not saved')) setForm(null);
  }

  function cancelNote(n: any) {
    const reason = askFor(`cancelling note ${n.cnNo}`);
    if (reason !== null) void run(() => api(`/api/dispatch/consignment-notes/${n.id}/cancel`, send('POST', { reason })));
  }
  function removeDoc(d: any) {
    if (window.confirm(`Remove ${d.fileName}?`)) void run(() => api(`/api/dispatch/documents/${d.id}`, send('DELETE')));
  }
  const open = (path: string) => apiOpen(path).catch(e => setErr(errorText(e, 'The PDF could not be opened')));
  const download = (d: any) => apiDownload(`/api/dispatch/documents/${d.id}/file`, d.fileName || 'document').catch(e => setErr(errorText(e, 'The file could not be read')));
  const set = (k: string) => (e: any) => setForm((x: any) => ({ ...x, values: { ...x.values, [k]: e.target.value } }));

  const docList = (docs: any[]) => !docs?.length ? <p className="text-xs text-slate-500">No papers added.</p>
    : <ul className="space-y-1 text-sm">{docs.map(d => <li key={d.id} className="flex flex-wrap items-center gap-2">
      <span className="rounded bg-slate-100 px-1.5 text-xs font-bold">{words(d.docType)}</span>
      <button className="text-sky-700 hover:underline" onClick={() => void download(d)}>{d.fileName}</button>
      <span className="text-xs text-slate-500">{d.docNo || ''}{d.docDate ? ` · ${when(d.docDate)}` : ''} · {d.uploadedBy || '-'}</span>
      {editable && <button className="text-xs text-red-700 hover:underline" disabled={busy} onClick={() => removeDoc(d)}>Remove</button>}
    </li>)}</ul>;

  return <Section title="Dispatch documents">
    <Banner msg={msg} error={err} />
    <p className="text-xs text-slate-500">
      {v.rules?.documentsRequired ? 'Start Trip needs a consignment note for every consignment' : 'Documents are not checked at Start Trip'}
      {v.rules?.invoiceCopyRequired ? ', with a copy of its invoice or challan' : ''}. E-way bill needed from {rupee(v.rules?.ewayThreshold)} of goods.
      {v.billingReady === false && ' Billing is not set up, so e-way bills are not checked.'}{v.filesReady === false && ' The file store is not set up, so papers cannot be added.'}
    </p>
    <Problems items={v.startBlockers} title="Start Trip waits for" />

    <div className="mt-3 grid gap-4 lg:grid-cols-2">
      {(v.consignments || []).map((c: any) => {
        const n = c.note, key = c.tripLoadId ?? 'own';
        return <div key={key} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><div className="font-bold">{c.label}</div>
              <div className="text-xs text-slate-500">{c.partnerName || '-'} · {c.from || '-'} to {c.to || '-'} · {fmtWeight(c.tons)}{c.pallets != null ? ` · ${c.pallets} pallets` : ''}
                {c.loadRequestId && <> · <Link className="text-sky-700 hover:underline" to={`/dispatch/loads/${c.loadRequestId}`}>Goods and consignee</Link></>}</div></div>
            {!n && editable && form?.key !== key && <button className={btn} onClick={() => startNote(c)}>Issue note</button>}
          </div>

          {n && <div className="mt-2 rounded-lg bg-slate-50 p-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2"><b>{n.cnNo}</b>
              <div className="flex flex-wrap gap-1">
                <button className={btnLight} onClick={() => void open(`/api/dispatch/consignment-notes/${n.id}/pdf`)}><FileText className="mr-1 inline h-4 w-4" />PDF</button>
                {editable && form?.key !== key && <button className={btnLight} onClick={() => startNote(c, n)}>Change</button>}
                {editable && <button className={btnRed} disabled={busy} onClick={() => cancelNote(n)}>Cancel</button>}
              </div></div>
            <div>To {n.consigneeName}{n.consigneeGstin ? ` (${n.consigneeGstin})` : ''} · {n.goodsDescription}</div>
            <div className="text-xs text-slate-600">{n.packages ?? '-'} packages · {n.pallets ?? '-'} pallets · {fmtWeight(n.weightTons)} · value {rupee(n.goodsValue)} · {n.freightTerms}
              {n.invoiceNumbers ? ` · invoice ${n.invoiceNumbers}` : ''} · issued {when(n.issuedAt)} by {n.issuedBy || '-'}</div>
            <div className="mt-1 text-xs">E-way bill: {n.ewayBillNo
              ? <>{n.ewayBillNo}{c.eway ? ` · ${words(c.eway.status)}, valid until ${when(c.eway.validUntil)}, truck ${c.eway.vehicleNumber || '-'}` : ' · not in Billing'}</>
              : 'none'}</div>
          </div>}

          {form?.key === key && <form onSubmit={saveNote} className="mt-2 grid gap-2 rounded-lg border border-sky-200 bg-sky-50 p-2 sm:grid-cols-2">
            {FIELDS.map(([k, l, type]) => <div key={k}><span className={label}>{l}</span>
              <input className={input} type={type || 'text'} step={type ? 'any' : undefined} required={l.endsWith('*')} value={form.values[k]} onChange={set(k)}
                list={k === 'ewayBillNo' ? 'dsp-eway' : undefined} /></div>)}
            <div><span className={label}>Freight</span><select className={input} value={form.values.freightTerms} onChange={set('freightTerms')}>
              <option value="TBB">To be billed</option><option value="PAID">Paid</option><option value="TO_PAY">To pay</option></select></div>
            <div><span className={label}>Remarks</span><input className={input} value={form.values.remarks} onChange={set('remarks')} /></div>
            <div className="flex gap-2 sm:col-span-2"><button className={btn} disabled={busy}>{form.cnId ? 'Save note' : 'Issue note'}</button>
              <button type="button" className={btnLight} onClick={() => setForm(null)}>Cancel</button></div>
          </form>}

          {n && <div className="mt-2"><div className="text-xs font-bold text-slate-600">Papers</div>{docList(c.documents)}
            {editable && v.filesReady !== false && <UploadBox tripId={tripId} noteId={n.id} act={act} />}</div>}
          {c.history?.length > 0 && <p className="mt-1 text-xs text-slate-400">Cancelled: {c.history.map((h: any) => `${h.cnNo}${h.cancelReason ? ` (${h.cancelReason})` : ''}`).join(', ')}</p>}
          <Problems items={c.problems} />
        </div>;
      })}
    </div>
    {!v.consignments?.length && <p className="text-sm text-slate-500">The trip carries no goods yet.</p>}

    <div className="mt-4"><div className="text-sm font-bold">Papers of the whole trip</div>{docList(v.otherDocuments)}
      {editable && v.filesReady !== false && <UploadBox tripId={tripId} act={act} />}</div>
    <datalist id="dsp-eway">{(v.ewayBills || []).map((e: any) => <option key={e.id} value={e.ewayBillNo}>{words(e.status)} · {e.vehicleNumber || ''}</option>)}</datalist>
  </Section>;
}

function UploadBox({ tripId, noteId, act }: { tripId: number; noteId?: number; act: ReturnType<typeof useAction> }) {
  const [file, setFile] = useState<File | null>(null), [docType, setDocType] = useState('INVOICE'), [docNo, setDocNo] = useState(''), [docDate, setDocDate] = useState('');
  const [key, setKey] = useState(0);
  async function upload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const ok = await act.run(() => apiUpload(`/api/dispatch/trips/${tripId}/documents/upload`,
      { file, docType, docNo, docDate, consignmentNoteId: noteId == null ? null : String(noteId) }), 'Not uploaded');
    if (ok) { setFile(null); setDocNo(''); setDocDate(''); setKey(k => k + 1); }
  }
  return <form onSubmit={upload} className="mt-2 flex flex-wrap items-end gap-2 text-sm">
    <input key={key} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="max-w-[220px] text-xs" onChange={e => setFile(e.target.files?.[0] || null)} />
    <select className={`${input} w-auto py-1`} value={docType} onChange={e => setDocType(e.target.value)}>{DOC_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
    <input className={`${input} w-28 py-1`} placeholder="Number" value={docNo} onChange={e => setDocNo(e.target.value)} />
    <input className={`${input} w-36 py-1`} type="date" value={docDate} onChange={e => setDocDate(e.target.value)} />
    <button className={btnLight} disabled={act.busy || !file}><Upload className="mr-1 inline h-4 w-4" />Add</button>
  </form>;
}
