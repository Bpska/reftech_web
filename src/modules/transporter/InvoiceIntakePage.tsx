/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-015 -- transporter invoice intake. An invoice comes by email (staff upload the attachment here), by portal
// upload or as an e-invoice JSON. OCR reads the amount, tolls, detention and tax; the IRN is checked and a duplicate
// is refused. A bill within the tolerance of the contract, the trip and the proof (REQ-TAL-011) is approved
// automatically; any other waits here for review. Shortage, damage, temperature and late-delivery penalties become
// debit notes that the transporter accepts (or disputes) on the portal.
//
// Backend: InvoiceIntakeController (/api/transporters/invoices/**). Reviewing needs the permission TAL_INVOICE_REVIEW.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanText } from 'lucide-react';
import { api, apiOpen, apiUpload } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { day, role, rupees } from './transporter';
import { when } from '@/modules/allocation/allocation';
import { INVOICE_STATE, NOTE_REASON, NOTE_STATE, SCRIPT_92, SOURCE_LABEL, badge, checkCounts, noteActions, toleranceText } from './talMarket';

const B = '/api/transporters/invoices';
const post = (path: string, body?: unknown) => api(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
const VALUE_FIELDS: [string, string][] = [['freight', 'Freight'], ['toll', 'Tolls'], ['detention', 'Detention'], ['loading', 'Loading'], ['unloading', 'Unloading'], ['other', 'Other'],
  ['taxable', 'Taxable value'], ['cgst', 'CGST'], ['sgst', 'SGST'], ['igst', 'IGST'], ['total', 'Invoice total']];
const PENALTY_FIELDS: [string, string][] = [['shortageDeduction', 'Shortage'], ['damageDeduction', 'Damage'], ['latePenalty', 'Late delivery'], ['temperaturePenalty', 'Temperature']];

export function InvoiceIntakePage() {
  const me = role();
  const [tab, setTab] = useState<'invoices' | 'notes'>('invoices');
  const [status, setStatus] = useState('REVIEW');
  const [list, setList] = useState<any>(null);
  const [notes, setNotes] = useState<any>(null);
  const [d, setD] = useState<any>(null);
  const [transporters, setTransporters] = useState<any[]>([]);
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      if (tab === 'invoices') setList(await api(`${B}?status=${status}`));
      else setNotes(await api(`${B}/debit-notes?status=ALL`));
    } catch (x) { setError(errorText(x, 'Could not load')); }
  }, [tab, status]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { if (me.staff) api('/api/transporters').then(r => setTransporters(r.transporters || [])).catch(() => setTransporters([])); }, []);
  const open = (id: number) => api(`${B}/${id}`).then(setD).catch(x => setError(errorText(x, 'Could not load the invoice')));

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try {
      const r = await action(); setMsg(r?.message || done); await load();
      if (r?.intakeNo && r?.id) setD(r); else if (d) await open(d.id);
      return r ?? true;
    } catch (x) { setError(errorText(x, 'Could not save')); return null; } finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Transporter Invoices</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  const ready = tab === 'invoices' ? list?.ready : notes?.ready;
  const canReview = !!(list?.canReview || notes?.canReview || d?.canReview);

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ScanText className="h-8 w-8 text-sky-700" />Transporter Invoices</h1>
    <p className="text-slate-600">Invoices by email, portal upload or e-invoice, read by OCR and checked against the contract, the trip and the proof. <Link to="/transporters/freight" className="font-semibold text-sky-700">Freight Bills</Link></p>
    <nav className="mt-3 flex gap-2">{([['invoices', 'Invoices'], ['notes', 'Debit notes']] as const).map(([k, l]) => <button key={k} onClick={() => { setTab(k); setD(null); }}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700'}`}>{l}</button>)}</nav>
    <Banner msg={msg} error={error} />
    {(tab === 'invoices' ? list : notes) && !ready && <NotReady script={SCRIPT_92} />}
    {tab === 'invoices' && list?.ready && <>
      <Intake transporters={transporters} busy={busy} settings={list.settings} onUpload={(path, fields) => run(() => apiUpload(path, fields), 'Received.')} />
      {d && <Detail d={d} canReview={canReview} transporters={transporters} busy={busy} run={run} onClose={() => setD(null)} />}
      <Section title="Invoices" right={<select value={status} onChange={e => setStatus(e.target.value)} className={`${input} w-56`}>
        <option value="ALL">All</option>{Object.entries(INVOICE_STATE).map(([k, v]) => <option key={k} value={k}>{v}{countOf(list.counts, k)}</option>)}</select>}>
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Intake</th><th className={th}>Transporter</th><th className={th}>Invoice</th><th className={th}>Trip</th><th className={`${th} text-right`}>Total</th><th className={th}>OCR</th><th className={th}>Status</th><th className={th}>Bill</th></tr></thead>
          <tbody>{list.invoices.map((i: any) => <tr key={i.id} onClick={() => void open(i.id)} className={`cursor-pointer border-t hover:bg-sky-50 ${d?.id === i.id ? 'bg-sky-50' : ''}`}>
            <td className={td}><b>{i.intakeNo}</b><div className="text-xs text-slate-500">{SOURCE_LABEL[i.source] || i.source} · {when(i.createdAt)}</div></td><td className={td}>{i.transporterName || '-'}</td>
            <td className={td}>{i.invoiceNo || '-'}<div className="text-xs text-slate-500">{day(i.invoiceDate)}{i.irn ? ' · IRN' : ''}</div></td><td className={td}>{i.tripNumber || '-'}</td>
            <td className={`${td} text-right`}>{i.totalAmount != null ? rupees(i.totalAmount) : '-'}</td><td className={td}>{i.ocrStatus}{i.ocrConfidence != null ? ` ${Number(i.ocrConfidence)} %` : ''}</td>
            <td className={td}><span className={badge(i.status)}>{INVOICE_STATE[i.status] || i.status}</span>{i.statusReason && <div className="max-w-xs truncate text-xs text-slate-500" title={i.statusReason}>{i.statusReason}</div>}</td>
            <td className={td}>{i.billNo || '-'}{i.billStatus ? <div className="text-xs text-slate-500">{i.billStatus}</div> : null}</td></tr>)}
            {list.invoices.length === 0 && <tr><td colSpan={8} className={`${td} text-slate-500`}>No invoices.</td></tr>}</tbody></table></div>
        <p className="mt-2 text-xs text-slate-500">Approved automatically when every check passes and the bill is within {toleranceText(list.settings)}{list.settings?.autoApprove ? '' : ' (automatic approval is switched off)'}. OCR: {list.settings?.ocr}.</p>
      </Section>
    </>}
    {tab === 'notes' && notes?.ready && <Notes rows={notes.notes} staff canReview={canReview} busy={busy}
      onAction={(id, action, note) => void run(() => post(`${B}/debit-notes/${id}/${action}`, { note }), 'Saved.')} />}
  </>;
}

const countOf = (counts: any[] = [], k: string) => { const n = counts.find(c => c.status === k)?.n; return n ? ` (${n})` : ''; };

function Intake({ transporters, busy, settings, onUpload }: { transporters: any[]; busy: boolean; settings: any; onUpload: (path: string, fields: Record<string, string | Blob | null>) => Promise<any> }) {
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState<Record<string, string>>({ source: 'EMAIL' });
  const eInvoice = f.source === 'E_INVOICE';
  const send = () => file && void onUpload(eInvoice ? `${B}/e-invoice` : B, { file, ...(eInvoice ? {} : { source: f.source, emailFrom: f.emailFrom, emailSubject: f.emailSubject }), transporterId: f.transporterId, tripId: f.tripId })
    .then(r => { if (r) { setFile(null); setF({ source: f.source }); } });
  return <Section title="Take in an invoice">
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Came by</label><select value={f.source} onChange={e => setF({ ...f, source: e.target.value })} className={input}>
        <option value="EMAIL">Email (attachment)</option><option value="STAFF">Paper (scan or photo)</option><option value="E_INVOICE">E-invoice JSON</option></select></div>
      <div><label className={label}>File</label><input type="file" accept={eInvoice ? '.json,application/json' : 'application/pdf,image/*'} onChange={e => setFile(e.target.files?.[0] || null)} className={input} /></div>
      <div><label className={label}>Transporter (found from the GSTIN if empty)</label><select value={f.transporterId || ''} onChange={e => setF({ ...f, transporterId: e.target.value })} className={input}>
        <option value="">-</option>{transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      <div><label className={label}>Trip id (found from the trip number if empty)</label><input type="number" value={f.tripId || ''} onChange={e => setF({ ...f, tripId: e.target.value })} className={input} /></div>
      {f.source === 'EMAIL' && <><div><label className={label}>From (email)</label><input value={f.emailFrom || ''} onChange={e => setF({ ...f, emailFrom: e.target.value })} className={input} /></div>
        <div className="md:col-span-2"><label className={label}>Subject</label><input value={f.emailSubject || ''} onChange={e => setF({ ...f, emailSubject: e.target.value })} className={input} /></div></>}
      <div className="flex items-end"><button disabled={busy || !file} onClick={send} className={btn}>Read and check</button></div>
    </div>
    {settings?.ocr === 'NONE' && !eInvoice && <p className="mt-2 text-sm text-amber-800">OCR is not set up (app.pod.ocr.provider): the values of a PDF or photo are typed in on review.</p>}
  </Section>;
}

function Detail({ d, canReview, transporters, busy, run, onClose }: { d: any; canReview: boolean; transporters: any[]; busy: boolean; run: (a: () => Promise<any>, done: string) => Promise<any>; onClose: () => void }) {
  const editable = canReview && ['RECEIVED', 'REVIEW'].includes(d.status);
  const init = () => ({ transporterId: d.transporterId ? String(d.transporterId) : '', tripId: d.tripId ? String(d.tripId) : '', invoiceNo: d.invoiceNo || '', invoiceDate: d.invoiceDate ? String(d.invoiceDate).slice(0, 10) : '',
    irn: d.irn || '', ...Object.fromEntries([...VALUE_FIELDS, ...PENALTY_FIELDS, ['supplierGstin', '']].map(([k]) => [k, d.values?.[k] == null ? '' : String(d.values[k])])) });
  const [v, setV] = useState<Record<string, string>>(init);
  useEffect(() => setV(init()), [d]);
  const c = checkCounts(d.checks);
  const base = `${B}/${d.id}`;
  const save = () => run(() => api(base, { method: 'PUT', body: JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x === '' ? null : x]))) }), 'Saved and checked again.');
  const box = (k: string, l: string, type = 'text') => <div key={k}><label className={label}>{l}</label><input type={type} step="any" disabled={!editable} value={v[k] ?? ''} onChange={e => setV({ ...v, [k]: e.target.value })} className={input} /></div>;
  return <Section id="invoice" title={<>{d.intakeNo} <span className={badge(d.status)}>{INVOICE_STATE[d.status] || d.status}</span></>} right={<div className="flex flex-wrap gap-2">
    {d.hasFile && <button className={btnLight} onClick={() => void apiOpen(`${base}/file`)}>Open file</button>}
    {['RECEIVED', 'REVIEW'].includes(d.status) && d.hasFile && <button disabled={busy} className={btnLight} onClick={() => void run(() => post(`${base}/read`), 'Read again.')}>Read again (OCR)</button>}
    {['RECEIVED', 'REVIEW'].includes(d.status) && <button disabled={busy} className={btnLight} onClick={() => void run(() => post(`${base}/recheck`), 'Checked again.')}>Check again</button>}
    {editable && <button disabled={busy} className={btn} onClick={() => void run(() => post(`${base}/bill`), 'Bill made.')}>Make the freight bill</button>}
    {editable && <button disabled={busy} className={btnRed} onClick={() => { const r = window.prompt('Why is the invoice rejected? (the transporter sees this)'); if (r !== null) void run(() => post(`${base}/reject`, { reason: r }), 'Rejected.'); }}>Reject</button>}
    <button className={btnLight} onClick={onClose}>Close</button></div>}>
    <div className="text-sm">{SOURCE_LABEL[d.source] || d.source}{d.emailFrom ? ` from ${d.emailFrom}` : ''}{d.emailSubject ? ` · "${d.emailSubject}"` : ''} · received by {d.receivedByName} {when(d.createdAt)}
      {d.statusReason && <div className="mt-1 rounded-xl bg-amber-50 p-2 text-amber-900">{d.statusReason}</div>}
      {d.billNo && <div className="mt-1">Freight bill <Link className="font-semibold text-sky-700" to="/transporters/freight">{d.billNo}</Link> ({d.billStatus})</div>}</div>
    <h3 className="mt-3 font-bold">Checks <span className="text-sm font-normal text-slate-500">{c.PASS} passed · {c.WARN} to look at · {c.FAIL} failed</span></h3>
    <ul className="mt-1 space-y-1 text-sm">{(d.checks || []).map((x: any, i: number) => <li key={i}><span className={badge(x.result)}>{x.result}</span> <b>{x.code}</b> {x.text}</li>)}
      {(d.checks || []).length === 0 && <li className="text-slate-500">Not checked yet.</li>}</ul>
    <h3 className="mt-3 font-bold">Values {editable && <span className="text-sm font-normal text-slate-500">(correct what OCR read wrong, then Save)</span>}</h3>
    <div className="grid gap-3 md:grid-cols-4">
      <div><label className={label}>Transporter</label><select disabled={!editable} value={v.transporterId} onChange={e => setV({ ...v, transporterId: e.target.value })} className={input}><option value="">-</option>
        {transporters.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
      {box('tripId', `Trip id${d.tripNumber ? ` (${d.tripNumber})` : ''}`, 'number')}{box('invoiceNo', 'Invoice no')}{box('invoiceDate', 'Invoice date', 'date')}
      {box('supplierGstin', 'GSTIN on the invoice')}<div className="md:col-span-3">{box('irn', 'IRN (e-invoice number, 64 characters)')}</div>
      {VALUE_FIELDS.map(([k, l]) => box(k, `${l} ₹`, 'number'))}
    </div>
    <h3 className="mt-3 font-bold">Penalties <span className="text-sm font-normal text-slate-500">(suggested from the trip and proof; each becomes a debit note when the bill is made)</span></h3>
    <div className="grid gap-3 md:grid-cols-4">{PENALTY_FIELDS.map(([k, l]) => box(k, `${l} ₹`, 'number'))}</div>
    {editable && <button disabled={busy} onClick={() => void save()} className={`${btn} mt-3`}>Save and check again</button>}
    {d.ocrText && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Text read by OCR</summary><pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-2 text-xs">{d.ocrText}</pre></details>}
    {d.ocrError && <p className="mt-2 text-sm text-red-700">OCR: {d.ocrError}</p>}
    {d.debitNotes?.length > 0 && <Notes rows={d.debitNotes} staff canReview={canReview} busy={busy} onAction={(id, action, note) => void run(() => post(`${B}/debit-notes/${id}/${action}`, { note }), 'Saved.')} />}
  </Section>;
}

export function Notes({ rows, staff, canReview, busy, onAction }: { rows: any[]; staff: boolean; canReview: boolean; busy: boolean; onAction: (id: number, action: string, note: string) => void }) {
  const ACTION: Record<string, string> = { accept: 'Accept', dispute: 'Dispute', confirm: 'Confirm', withdraw: 'Withdraw' };
  return <Section title="Debit notes">
    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Note</th>{staff && <th className={th}>Transporter</th>}<th className={th}>Bill / trip</th><th className={th}>Reason</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(n => <tr key={n.id} className="border-t"><td className={td}><b>{n.noteNo}</b><div className="text-xs text-slate-500">{when(n.createdAt)}</div></td>
        {staff && <td className={td}>{n.transporterName}</td>}<td className={td}>{n.billNo}<div className="text-xs text-slate-500">{n.tripNumber || ''}</div></td>
        <td className={td}>{NOTE_REASON[n.reason] || n.reason}{n.basis && <div className="text-xs text-slate-500">{n.basis}</div>}</td><td className={`${td} text-right font-semibold`}>{rupees(n.amount)}</td>
        <td className={td}><span className={badge(n.status)}>{NOTE_STATE[n.status] || n.status}</span>{n.transporterNote && <div className="text-xs text-slate-500">Transporter: {n.transporterNote}</div>}
          {n.decisionNote && <div className="text-xs text-slate-500">RefTech: {n.decisionNote}</div>}</td>
        <td className={td}><div className="flex flex-wrap gap-1">{(staff && !canReview ? [] : noteActions(n.status, staff)).map(a => <button key={a} disabled={busy} className={a === 'dispute' || a === 'withdraw' ? btnRed : btnLight}
          onClick={() => { const note = window.prompt(a === 'dispute' ? 'Why do you dispute it?' : 'Note (optional):'); if (note !== null) onAction(n.id, a, note); }}>{ACTION[a]}</button>)}</div></td></tr>)}
        {rows.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No debit notes.</td></tr>}</tbody></table></div>
  </Section>;
}
