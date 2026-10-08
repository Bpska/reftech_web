/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-003 -- GST documents: credit and debit notes, e-invoice (IRN), e-way bills and the GSTR-1 export.
//
// Nothing here talks to the government portals by default. E-invoice and e-way bill JSON are downloaded for the
// offline / bulk upload; the IRN or e-way bill number that comes back is typed in. With the SAMPLE provider
// (app.billing.einvoice.provider / app.billing.eway.provider) test numbers are made so the flow can be tried.
// Backend: GstController (/api/billing/gst). Needs database_v2/45 on reftech_billing.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt } from 'lucide-react';
import { api, apiDownload, apiDownloadPost } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtDateTime, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TABS: [string, string][] = [['notes', 'Credit / debit notes'], ['einvoice', 'E-invoice'], ['eway', 'E-way bills'], ['gstr1', 'GSTR-1']];
const SECTION_LABEL: Record<string, string> = { b2b: 'B2B invoices (4A)', b2cl: 'B2C large (5A)', b2cs: 'B2C small (7)', cdnr: 'Notes to registered (9B)', cdnur: 'Notes to unregistered (9B)' };
const EWAY_STYLE: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-800', DRAFT: 'bg-amber-100 text-amber-800', EXPIRING: 'bg-orange-100 text-orange-800', EXPIRED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-200 text-slate-600' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthsBack = (n: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); };
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const rs = (v: unknown) => fmtMoney(v as any);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '-');
const when = (v: unknown) => (v ? fmtDateTime(String(v)) : '-');
const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });
const ask = (q: string, d = '') => { const r = window.prompt(q, d); return r === null ? null : r.trim(); };

type Ctx = { stamp: number; done: (m: string) => void; fail: (e: unknown, f: string) => void; notReady: (m: string) => void };

export default function GstPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'notes';
  const [missing, setMissing] = useState('');
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [stamp, setStamp] = useState(0);
  const ctx: Ctx = {
    stamp,
    done: m => { setMsg(m); setError(''); setStamp(x => x + 1); },
    fail: (e, f) => { setError(errorText(e, f)); setMsg(''); },
    notReady: m => setMissing(m || 'Run database_v2/45_finance_billing_reftech_billing.sql on reftech_billing.'),
  };
  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Receipt className="h-6 w-6 text-sky-700" />GST Documents</h1>
    {missing ? <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{missing}</div> : <>
      <div className="mt-4 flex flex-wrap gap-2">{TABS.map(([k, t]) => <button key={k} onClick={() => { setParams({ tab: k }); setMsg(''); setError(''); }}
        className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}</div>
      <Banner msg={msg} error={error} />
      {tab === 'notes' && <Notes {...ctx} />}
      {tab === 'einvoice' && <EInvoice {...ctx} />}
      {tab === 'eway' && <Eway {...ctx} />}
      {tab === 'gstr1' && <Gstr1 {...ctx} />}
    </>}
  </div>;
}

// ------------------------------------------------------------------ credit and debit notes

function Notes({ stamp, done, fail, notReady }: Ctx) {
  const [range, setRange] = useState({ from: monthsBack(2), to: today() });
  const [data, setData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/api/billing/gst/notes?${new URLSearchParams(range)}`).then(r => (r.ready === false ? notReady(r.message) : setData(r))).catch(e => fail(e, 'Could not load the notes'));
  }, [range.from, range.to, stamp]);
  function open() {
    setForm({ noteType: 'CREDIT', invoiceId: '', noteDate: today(), reasonCode: 'RATE_REVISION', reason: '', taxableAmount: '', gstRate: '' });
    api(`/api/billing/gst/einvoice?from=${monthsBack(12)}&to=${today()}`).then(r => setInvoices((r.documents || []).filter((d: any) => d.kind === 'INVOICE'))).catch(() => setInvoices([]));
  }
  async function save() {
    setBusy(true);
    try {
      const r = await post('/api/billing/gst/notes', { ...form, invoiceId: Number(form.invoiceId), taxableAmount: num(form.taxableAmount), gstRate: form.gstRate === '' ? null : num(form.gstRate) });
      setForm(null); done(`${form.noteType === 'CREDIT' ? 'Credit' : 'Debit'} note ${r.noteNumber} raised for ${rs(r.totalAmount)} (${r.gstType}).`);
    } catch (e) { fail(e, 'Could not raise the note'); } finally { setBusy(false); }
  }
  async function cancel(n: any) {
    const reason = ask(`Reason for cancelling ${n.noteNumber}:`);
    if (!reason) return;
    try { const r = await post(`/api/billing/gst/notes/${n.id}/cancel`, { reason }); done(r.warning ? `Note cancelled. ${r.warning}` : 'Note cancelled'); } catch (e) { fail(e, 'Could not cancel the note'); }
  }
  const reasons: Record<string, string> = data?.reasons || {};
  return <Section title="Credit and debit notes" right={<div className="flex flex-wrap gap-2">
    <input type="date" className={`${input} w-40`} value={range.from} onChange={e => setRange(x => ({ ...x, from: e.target.value }))} />
    <input type="date" className={`${input} w-40`} value={range.to} onChange={e => setRange(x => ({ ...x, to: e.target.value }))} />
    {!form && <button className={btn} onClick={open}>New note</button>}
  </div>}>
    {form && <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
      <div><label className={label}>Type</label><select className={input} value={form.noteType} onChange={e => setForm({ ...form, noteType: e.target.value })}><option value="CREDIT">Credit note (reduces the bill)</option><option value="DEBIT">Debit note (adds to the bill)</option></select></div>
      <div className="md:col-span-2"><label className={label}>Against tax invoice <span className="text-red-600">*</span></label>
        <select className={input} value={form.invoiceId} onChange={e => setForm({ ...form, invoiceId: e.target.value })}><option value="">Choose…</option>
          {invoices.map(i => <option key={i.id} value={i.id}>{i.number} · {i.partnerName} · {day(i.date)} · {rs(i.totalAmount)}</option>)}</select></div>
      <div><label className={label}>Note date</label><input type="date" className={input} value={form.noteDate} onChange={e => setForm({ ...form, noteDate: e.target.value })} /></div>
      <div><label className={label}>Reason</label><select className={input} value={form.reasonCode} onChange={e => setForm({ ...form, reasonCode: e.target.value })}>{Object.entries(reasons).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div className="md:col-span-3"><label className={label}>Details{form.reasonCode === 'OTHER' && <span className="text-red-600"> *</span>}</label><input className={input} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
      <div><label className={label}>Taxable amount (Rs) <span className="text-red-600">*</span></label><input type="number" step="any" className={input} value={form.taxableAmount} onChange={e => setForm({ ...form, taxableAmount: e.target.value })} /></div>
      <div><label className={label}>GST %</label><input type="number" step="any" className={input} placeholder="As on the invoice" value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} /></div>
      <div className="flex items-end gap-2 md:col-span-2"><button className={btn} disabled={busy || !form.invoiceId || num(form.taxableAmount) <= 0} onClick={save}>{busy ? 'Saving…' : 'Raise note'}</button><button className={btnLight} onClick={() => setForm(null)}>Cancel</button></div>
      <div className="text-xs text-slate-500 md:col-span-full">CGST+SGST or IGST is taken from the invoice. Credit notes cannot exceed the invoice's taxable value. The partner's outstanding changes at once.</div>
    </div>}
    <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}>Note</th><th className={th}>Date</th><th className={th}>Invoice</th><th className={th}>Reason</th><th className={th}>Taxable</th><th className={th}>GST</th><th className={th}>Total</th><th className={th}>IRN</th><th className={th}></th></tr></thead>
      <tbody>{(data?.notes || []).map((n: any) => <tr key={n.id} className={`border-b ${n.status === 'CANCELLED' ? 'text-slate-400' : ''}`}>
        <td className={td}><b>{n.noteNumber}</b><div className="text-xs">{n.noteType === 'CREDIT' ? 'Credit' : 'Debit'}{n.status === 'CANCELLED' && ' · cancelled'}</div></td>
        <td className={td}>{day(n.noteDate)}</td><td className={td}>{n.invoiceNumber}</td><td className={td}>{reasons[n.reasonCode] || n.reasonCode}{n.reason && <div className="text-xs text-slate-500">{n.reason}</div>}</td>
        <td className={td}>{rs(n.taxableAmount)}</td><td className={td}>{rs(num(n.cgstAmount) + num(n.sgstAmount) + num(n.igstAmount))}</td><td className={td}>{rs(n.totalAmount)}</td>
        <td className={td}>{n.irn ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800" title={n.irn}>IRN</span> : '-'}</td>
        <td className={`${td} whitespace-nowrap`}><button className={btnLight} onClick={() => apiDownload(`/api/billing/gst/notes/${n.id}/pdf`, `${String(n.noteNumber).replace(/[^A-Za-z0-9-]/g, '_')}.pdf`).catch(e => fail(e, 'Could not download'))}>PDF</button>
          {' '}{n.status !== 'CANCELLED' && <button className={btnRed} onClick={() => cancel(n)}>Cancel</button>}</td>
      </tr>)}
        {data && (data.notes || []).length === 0 && <tr><td colSpan={9} className="p-4 text-slate-500">No notes in this period.</td></tr>}
      </tbody>
    </table></div>
  </Section>;
}

// ------------------------------------------------------------------ e-invoice

function EInvoice({ stamp, done, fail, notReady }: Ctx) {
  const [q, setQ] = useState({ from: monthsBack(1), to: today(), state: 'PENDING' });
  const [data, setData] = useState<any>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [irnFor, setIrnFor] = useState<any>(null);
  useEffect(() => {
    api(`/api/billing/gst/einvoice?${new URLSearchParams(q)}`).then(r => (r.ready === false ? notReady(r.message) : setData(r))).catch(e => fail(e, 'Could not load the documents'));
  }, [q.from, q.to, q.state, stamp]);
  const docs: any[] = data?.documents || [];
  const key = (d: any) => `${d.kind}:${d.id}`;
  const picked = docs.filter(d => pick[key(d)]);
  async function json() {
    try { await apiDownloadPost('/api/billing/gst/einvoice/json', { documents: picked.map(d => ({ kind: d.kind, id: d.id })) }, `EInvoice_${today()}.json`); }
    catch (e) { fail(e, 'Could not make the JSON'); }
  }
  async function sample(d: any) {
    try { await post(`/api/billing/gst/einvoice/${d.kind}/${d.id}/sample`); done(`Sample IRN made for ${d.number}. It is for testing only.`); } catch (e) { fail(e, 'Could not make a sample IRN'); }
  }
  async function saveIrn() {
    try { await api(`/api/billing/gst/einvoice/${irnFor.kind}/${irnFor.id}`, { method: 'PUT', body: JSON.stringify(irnFor.f) }); setIrnFor(null); done('IRN recorded. It now prints on the tax invoice with its QR code.'); }
    catch (e) { fail(e, 'Could not record the IRN'); }
  }
  async function cancel(d: any) {
    const reason = ask(`Reason for cancelling the IRN of ${d.number} (duplicate, data entry mistake, order cancelled, other):`);
    if (!reason) return;
    try { const r = await post(`/api/billing/gst/einvoice/${d.kind}/${d.id}/cancel`, { reason }); done(r.warning ? `IRN cancelled. ${r.warning}` : 'IRN cancelled'); } catch (e) { fail(e, 'Could not cancel the IRN'); }
  }
  return <Section title="E-invoice (IRN)" right={<div className="flex flex-wrap gap-2">
    <select className={`${input} w-40`} value={q.state} onChange={e => setQ(x => ({ ...x, state: e.target.value }))}><option value="PENDING">Without IRN</option><option value="DONE">With IRN</option><option value="">All</option></select>
    <input type="date" className={`${input} w-40`} value={q.from} onChange={e => setQ(x => ({ ...x, from: e.target.value }))} />
    <input type="date" className={`${input} w-40`} value={q.to} onChange={e => setQ(x => ({ ...x, to: e.target.value }))} />
    <button className={btn} disabled={picked.length === 0} onClick={json}>Download JSON ({picked.length})</button>
  </div>}>
    {data && <div className="mb-3 text-sm text-slate-600">Provider <b>{data.provider}</b>. Upload the JSON on the IRP (einvoice1.gst.gov.in, bulk upload), then type the IRN it returns against each document.
      {data.sellerProblem && <div className="mt-1 font-semibold text-red-700">{data.sellerProblem}</div>}</div>}
    {irnFor && <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
      <div className="md:col-span-full font-semibold">IRN for {irnFor.number}</div>
      <div className="md:col-span-2"><label className={label}>IRN (64 characters) <span className="text-red-600">*</span></label><input className={`${input} font-mono text-xs`} value={irnFor.f.irn} onChange={e => setIrnFor({ ...irnFor, f: { ...irnFor.f, irn: e.target.value.trim() } })} /></div>
      <div><label className={label}>Ack no.</label><input className={input} value={irnFor.f.ackNo} onChange={e => setIrnFor({ ...irnFor, f: { ...irnFor.f, ackNo: e.target.value } })} /></div>
      <div><label className={label}>Ack date</label><input type="datetime-local" className={input} value={irnFor.f.ackDate} onChange={e => setIrnFor({ ...irnFor, f: { ...irnFor.f, ackDate: e.target.value } })} /></div>
      <div className="md:col-span-full"><label className={label}>Signed QR code text</label><textarea rows={2} className={`${input} font-mono text-xs`} value={irnFor.f.signedQr} onChange={e => setIrnFor({ ...irnFor, f: { ...irnFor.f, signedQr: e.target.value } })} /></div>
      <div className="flex gap-2"><button className={btn} disabled={irnFor.f.irn.length !== 64} onClick={saveIrn}>Save IRN</button><button className={btnLight} onClick={() => setIrnFor(null)}>Cancel</button></div>
    </div>}
    <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}><input type="checkbox" aria-label="All" checked={docs.length > 0 && picked.length === docs.filter(d => !d.irn).length} onChange={e => setPick(Object.fromEntries(docs.filter(d => !d.irn).map(d => [key(d), e.target.checked])))} /></th>
        <th className={th}>Document</th><th className={th}>Date</th><th className={th}>Partner</th><th className={th}>Total</th><th className={th}>IRN</th><th className={th}></th></tr></thead>
      <tbody>{docs.map(d => <tr key={key(d)} className="border-b">
        <td className={td}>{!d.irn && <input type="checkbox" checked={!!pick[key(d)]} onChange={e => setPick(p => ({ ...p, [key(d)]: e.target.checked }))} />}</td>
        <td className={td}><b>{d.number}</b><div className="text-xs text-slate-500">{d.docType}</div></td><td className={td}>{day(d.date)}</td>
        <td className={td}>{d.partnerName}<div className="text-xs text-slate-500">{d.buyerGstin || 'No GSTIN'}</div>{(d.problems || []).map((p: string) => <div key={p} className="text-xs font-semibold text-red-700">{p}</div>)}</td>
        <td className={td}>{rs(d.totalAmount)}</td>
        <td className={td}>{d.irnStatus === 'ACTIVE' ? <><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">{d.irnSource === 'SAMPLE' ? 'Sample IRN' : 'IRN'}</span><div className="font-mono text-[10px] text-slate-500" title={d.irn}>{String(d.irn).slice(0, 16)}…</div><div className="text-xs">Ack {d.irnAckNo || '-'}</div></>
          : d.irnStatus === 'CANCELLED' ? <span className="text-xs text-slate-500">Cancelled</span> : <span className="text-xs text-amber-700">Not generated</span>}</td>
        <td className={`${td} whitespace-nowrap`}>{d.irnStatus === 'ACTIVE'
          ? <button className={btnRed} onClick={() => cancel(d)}>Cancel IRN</button>
          : <><button className={btnLight} onClick={() => setIrnFor({ ...d, f: { irn: '', ackNo: '', ackDate: '', signedQr: '' } })}>Enter IRN</button>
            {data?.provider === 'SAMPLE' && <> <button className={btnLight} onClick={() => sample(d)}>Sample IRN</button></>}</>}</td>
      </tr>)}
        {data && docs.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">Nothing here for this period.</td></tr>}
      </tbody>
    </table></div>
  </Section>;
}

// ------------------------------------------------------------------ e-way bills

const blankEway = () => ({ tripId: '', tripNumber: '', partnerId: '', invoiceId: '', documentType: 'INV', documentNo: '', documentDate: today(), supplierGstin: '', recipientGstin: '',
  fromPlace: '', fromPincode: '', fromStateCode: '', toPlace: '', toPincode: '', toStateCode: '', goodsDescription: '', hsnCode: '', goodsValue: '', vehicleNumber: '', distanceKm: '',
  ewayBillNo: '', ewayDate: '', note: '' });

function Eway({ stamp, done, fail, notReady }: Ctx) {
  const [q, setQ] = useState({ status: '', from: monthsBack(1), to: today() });
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [existing, setExisting] = useState<any[]>([]);
  const [pick, setPick] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api(`/api/billing/gst/eway-bills?${new URLSearchParams(Object.entries(q).filter(([, v]) => v))}`).then(r => (r.ready === false ? notReady(r.message) : setData(r))).catch(e => fail(e, 'Could not load the e-way bills'));
  }, [q.status, q.from, q.to, stamp]);
  async function prefill() {
    if (!form.tripId) return;
    try {
      const p = await api(`/api/billing/gst/eway-bills/prefill?tripId=${form.tripId}`);
      setExisting(p.existing || []);
      const f = { ...form };
      for (const k of Object.keys(blankEway())) if (p[k] !== undefined && p[k] !== null && (f as any)[k] === '') (f as any)[k] = String(p[k]);
      if (p.invoiceNumber && !f.documentNo) f.documentNo = String(p.invoiceNumber).slice(0, 16);
      setForm(f);
    } catch (e) { fail(e, 'Could not fill from the trip'); }
  }
  async function save() {
    setBusy(true);
    try {
      const body = { ...form, tripId: form.tripId || null, partnerId: form.partnerId || null, invoiceId: form.invoiceId || null, goodsValue: num(form.goodsValue), distanceKm: form.distanceKm ? Number(form.distanceKm) : null, ewayDate: form.ewayDate || null };
      const r = form.id ? await api(`/api/billing/gst/eway-bills/${form.id}`, { method: 'PUT', body: JSON.stringify(body) }) : await post('/api/billing/gst/eway-bills', body);
      setForm(null); setExisting([]);
      done(r.status === 'ACTIVE' ? `E-way bill saved, valid until ${when(r.validUntil)}.` : 'Saved as a draft. Download the JSON, upload it on the e-way bill portal, then enter the number it gives.');
    } catch (e) { fail(e, 'Could not save the e-way bill'); } finally { setBusy(false); }
  }
  function edit(b: any) {
    const f: any = blankEway();
    for (const k of Object.keys(f)) if (b[k] !== null && b[k] !== undefined) f[k] = k === 'documentDate' ? day(b[k]) : k === 'ewayDate' ? String(b[k]).slice(0, 16) : String(b[k]);
    setForm({ ...f, id: b.id }); setExisting([]); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function act(b: any, what: 'sample' | 'extend' | 'vehicle' | 'cancel') {
    try {
      if (what === 'sample') { await post(`/api/billing/gst/eway-bills/${b.id}/sample`); done('Sample e-way bill number made (testing only).'); return; }
      if (what === 'extend') {
        const km = ask('Distance still to go (km):'); if (!km) return;
        const reason = ask('Why is it extended? (breakdown, transshipment, accident, law and order, other)'); if (!reason) return;
        const r = await post(`/api/billing/gst/eway-bills/${b.id}/extend`, { remainingKm: Number(km), reason });
        done(`Extended. Valid until ${when(r.validUntil)}. Record the same extension on the portal.`); return;
      }
      if (what === 'vehicle') {
        const v = ask('New vehicle number:', b.vehicleNumber || ''); if (!v) return;
        const reason = ask('Reason (breakdown, transshipment, other):') ?? '';
        await post(`/api/billing/gst/eway-bills/${b.id}/vehicle`, { vehicleNumber: v, reason }); done('Vehicle changed. Update Part-B on the portal too.'); return;
      }
      const reason = ask(`Reason for cancelling e-way bill ${b.ewayBillNo || '#' + b.id}:`); if (!reason) return;
      const r = await post(`/api/billing/gst/eway-bills/${b.id}/cancel`, { reason }); done(r.warning ? `Cancelled. ${r.warning}` : 'E-way bill cancelled');
    } catch (e) { fail(e, 'Could not update the e-way bill'); }
  }
  const rows: any[] = data?.ewayBills || [];
  const picked = rows.filter(r => pick[r.id]).map(r => r.id);
  const F = (k: string, l: string, extra: Record<string, any> = {}) => <div className={extra.wide ? 'md:col-span-2' : ''}><label className={label}>{l}</label>
    <input className={input} value={form[k]} type={extra.type || 'text'} onChange={e => setForm({ ...form, [k]: e.target.value })} placeholder={extra.placeholder} /></div>;
  return <Section title="E-way bills" right={<div className="flex flex-wrap gap-2">
    <select className={`${input} w-36`} value={q.status} onChange={e => setQ(x => ({ ...x, status: e.target.value }))}><option value="">Any status</option>{['DRAFT', 'ACTIVE', 'EXPIRING', 'EXPIRED', 'CANCELLED'].map(s => <option key={s}>{s}</option>)}</select>
    <input type="date" className={`${input} w-40`} value={q.from} onChange={e => setQ(x => ({ ...x, from: e.target.value }))} />
    <input type="date" className={`${input} w-40`} value={q.to} onChange={e => setQ(x => ({ ...x, to: e.target.value }))} />
    <button className={btnLight} disabled={picked.length === 0} onClick={() => apiDownloadPost('/api/billing/gst/eway-bills/json', { ids: picked }, `EwayBills_${today()}.json`).catch(e => fail(e, 'Could not make the JSON'))}>Download JSON ({picked.length})</button>
    {!form && <button className={btn} onClick={() => { setForm(blankEway()); setExisting([]); }}>New e-way bill</button>}
  </div>}>
    {num(data?.expiringCount) > 0 && <div className="mb-3 rounded-xl bg-orange-50 p-3 text-orange-900">{data.expiringCount} e-way bill(s) expire within 12 hours. Extend them from 8 hours before expiry.</div>}
    {form && <div className="mb-4 rounded-xl border border-slate-200 p-3">
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Trip id</label><div className="flex gap-2"><input className={input} value={form.tripId} onChange={e => setForm({ ...form, tripId: e.target.value })} /><button type="button" className={btnLight} onClick={prefill}>Fill</button></div></div>
        <div><label className={label}>Document</label><select className={input} value={form.documentType} onChange={e => setForm({ ...form, documentType: e.target.value })}><option value="INV">Tax invoice</option><option value="CHL">Delivery challan</option><option value="BIL">Bill of supply</option></select></div>
        {F('documentNo', 'Document no. (max 16)')}{F('documentDate', 'Document date', { type: 'date' })}
        {F('supplierGstin', 'Consignor GSTIN')}{F('recipientGstin', 'Consignee GSTIN', { placeholder: 'URP if unregistered' })}{F('goodsDescription', 'Goods', { wide: true })}
        {F('fromPlace', 'From place')}{F('fromPincode', 'From PIN')}{F('fromStateCode', 'From state code', { placeholder: 'e.g. 27' })}{F('hsnCode', 'HSN')}
        {F('toPlace', 'To place')}{F('toPincode', 'To PIN')}{F('toStateCode', 'To state code')}{F('goodsValue', 'Goods value (Rs)', { type: 'number' })}
        {F('vehicleNumber', 'Vehicle number')}{F('distanceKm', 'Distance (km)', { type: 'number' })}{F('ewayBillNo', 'E-way bill no. (from the portal)')}{F('ewayDate', 'Generated at', { type: 'datetime-local' })}
        <div className="md:col-span-full">{F('note', 'Note')}</div>
      </div>
      {existing.length > 0 && <div className="mt-2 text-sm text-amber-800">This trip already has: {existing.map(x => `${x.ewayBillNo || 'draft'} (${x.status})`).join(', ')}</div>}
      <div className="mt-2 text-xs text-slate-500">Without the e-way bill number it is saved as a draft. Validity is 1 day per 200 km (from the generation time, ending at midnight).</div>
      <div className="mt-3 flex gap-2"><button className={btn} disabled={busy} onClick={save}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Save'}</button><button className={btnLight} onClick={() => setForm(null)}>Cancel</button></div>
    </div>}
    <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}></th><th className={th}>E-way bill</th><th className={th}>Trip</th><th className={th}>Route</th><th className={th}>Vehicle</th><th className={th}>Value</th><th className={th}>Valid until</th><th className={th}>Status</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(b => <tr key={b.id} className="border-b">
        <td className={td}><input type="checkbox" checked={!!pick[b.id]} onChange={e => setPick(p => ({ ...p, [b.id]: e.target.checked }))} /></td>
        <td className={td}><b>{b.ewayBillNo || 'Draft'}</b><div className="text-xs text-slate-500">{b.documentType} {b.documentNo}</div></td>
        <td className={td}>{b.tripNumber || '-'}<div className="text-xs text-slate-500">{b.partnerName}</div></td>
        <td className={td}>{b.fromPlace} to {b.toPlace}<div className="text-xs text-slate-500">{b.distanceKm ? `${b.distanceKm} km` : ''}</div></td>
        <td className={td}>{b.vehicleNumber}</td><td className={td}>{rs(b.goodsValue)}</td>
        <td className={td}>{when(b.validUntil)}{b.hoursLeft !== undefined && b.status !== 'CANCELLED' && <div className={`text-xs ${b.expired ? 'text-red-700' : num(b.hoursLeft) < 12 ? 'text-orange-700' : 'text-slate-500'}`}>{b.expired ? 'Expired' : `${b.hoursLeft} h left`}</div>}</td>
        <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${EWAY_STYLE[b.status] || 'bg-slate-100'}`}>{b.status}</span>{num(b.extensionCount) > 0 && <div className="text-xs text-slate-500">Extended {b.extensionCount}x</div>}</td>
        <td className={`${td} whitespace-nowrap`}>
          {b.status === 'DRAFT' && <><button className={btnLight} onClick={() => edit(b)}>Change</button>{data?.provider === 'SAMPLE' && <> <button className={btnLight} onClick={() => act(b, 'sample')}>Sample no.</button></>}</>}
          {['ACTIVE', 'EXPIRING', 'EXPIRED'].includes(b.status) && <>{b.canExtend && <button className={btnLight} onClick={() => act(b, 'extend')}>Extend</button>} <button className={btnLight} onClick={() => act(b, 'vehicle')}>Vehicle</button></>}
          {b.status !== 'CANCELLED' && <> <button className={btnRed} onClick={() => act(b, 'cancel')}>Cancel</button></>}
        </td>
      </tr>)}
        {data && rows.length === 0 && <tr><td colSpan={9} className="p-4 text-slate-500">No e-way bills in this period.</td></tr>}
      </tbody>
    </table></div>
  </Section>;
}

// ------------------------------------------------------------------ GSTR-1

function Gstr1({ fail, notReady }: Ctx) {
  const [month, setMonth] = useState(monthsBack(1).slice(0, 7));
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    api(`/api/billing/gst/gstr1?month=${month}`).then(r => (r.ready === false ? notReady(r.message) : setData(r))).catch(e => fail(e, 'Could not load GSTR-1'));
  }, [month]);
  return <Section title="GSTR-1" right={<div className="flex gap-2">
    <input type="month" className={`${input} w-44`} value={month} onChange={e => setMonth(e.target.value)} />
    <button className={btn} onClick={() => apiDownload(`/api/billing/gst/gstr1.xlsx?month=${month}`, `GSTR1_${month}.xlsx`).catch(e => fail(e, 'Could not download'))}>Download Excel</button>
  </div>}>
    <p className="mb-3 text-sm text-slate-600">The Excel follows the GST offline tool's sheets (b2b, b2cl, b2cs, cdnr, cdnur, hsn, docs). Import it into the offline tool, check, and upload. Reverse charge is not handled.</p>
    {data && <>
      <table className="min-w-full text-sm">
        <thead className="bg-slate-100"><tr><th className={th}>Section</th><th className={th}>Documents</th><th className={th}>Taxable</th><th className={th}>Tax</th><th className={th}>Value</th></tr></thead>
        <tbody>{(data.sections || []).map((s: any) => <tr key={s.section} className="border-b"><td className={td}>{SECTION_LABEL[s.section] || s.section}</td><td className={td}>{s.count}</td><td className={td}>{rs(s.taxable)}</td><td className={td}>{rs(s.tax)}</td><td className={td}>{rs(s.value)}</td></tr>)}
          {(data.sections || []).length === 0 && <tr><td colSpan={5} className="p-4 text-slate-500">No tax invoices or notes in {month}.</td></tr>}</tbody>
      </table>
      {(data.problems || []).length > 0 && <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800"><b>Fix before filing:</b>
        <ul className="ml-5 mt-1 list-disc">{data.problems.map((p: any, i: number) => <li key={i}>{p.number}: {p.problem}</li>)}</ul></div>}
    </>}
  </Section>;
}
