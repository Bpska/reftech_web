/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-002 -- money received from partners: receipts with TDS, Paid status, ageing and the partner ledger.
// Manager and Admin; the opening balance is Admin only.
//
// A receipt is spread over the partner's open bills, oldest due date first (the person can change the split); what is
// left over stays with the partner as an advance. A bill becomes Paid when what was received plus TDS covers it.
// Backend: ReceivablesController (/api/billing/receivables). Needs database_v2/45 on reftech_billing.
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { api, apiDownload, currentUser } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TABS: [string, string][] = [['receive', 'Record receipt'], ['receipts', 'Receipts'], ['ageing', 'Ageing'], ['ledger', 'Partner ledger']];
const METHODS = ['NEFT', 'RTGS', 'IMPS', 'UPI', 'CHEQUE', 'CASH', 'DD', 'CARD', 'OTHER'];
const TDS_SECTIONS = ['194C', '194J', '194I', '194H', '194Q'];
const BUCKETS: [string, string][] = [['notDue', 'Not due'], ['d1_30', '1-30 days'], ['d31_60', '31-60'], ['d61_90', '61-90'], ['d90plus', 'Over 90']];
const KIND_LABEL: Record<string, string> = { OPENING: 'Opening', BILL: 'Bill', CREDIT_NOTE: 'Credit note', DEBIT_NOTE: 'Debit note', RECEIPT: 'Receipt', TDS: 'TDS', REVERSAL: 'Reversal' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = (back = 0) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); };
const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;
const rs = (v: unknown) => fmtMoney(v as any);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '-');
const post = (path: string, body: unknown = {}) => api(path, { method: 'POST', body: JSON.stringify(body) });

export default function PaymentsPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'receive';
  const [partners, setPartners] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [notReady, setNotReady] = useState('');
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [stamp, setStamp] = useState(0);
  const u = currentUser(), admin = String(u.role || u.roleCode || '').replace('ROLE_', '').toUpperCase() === 'ADMIN';

  useEffect(() => { api('/api/admin/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([])); }, []);
  useEffect(() => {
    api('/api/billing/receivables/summary').then(r => {
      if (r.ready === false) setNotReady(r.message || 'Run database_v2/45_finance_billing_reftech_billing.sql on reftech_billing.');
      else { setNotReady(''); setSummary(r); }
    }).catch(e => setError(errorText(e, 'Could not load the summary')));
  }, [stamp]);
  const ctx = { partners, admin, stamp, done: (m: string) => { setMsg(m); setError(''); setStamp(x => x + 1); }, fail: (e: unknown, f: string) => { setError(errorText(e, f)); setMsg(''); } };

  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Wallet className="h-6 w-6 text-sky-700" />Payments &amp; Ageing</h1>
    {notReady ? <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{notReady}</div> : <>
      {summary && <div className="mt-3 grid gap-3 md:grid-cols-5">
        {[['Outstanding', rs(summary.outstanding)], ['Overdue', rs(summary.overdue)], ['Received this month', rs(summary.receivedThisMonth)], ['TDS this month', rs(summary.tdsThisMonth)], ['Bills paid', String(summary.paidBills ?? 0)]]
          .map(([k, v]) => <div key={k} className="rounded-2xl bg-white p-3 shadow-sm"><div className="text-xs font-semibold text-slate-500">{k}</div><div className={`text-lg font-bold ${k === 'Overdue' && num(summary.overdue) > 0 ? 'text-red-700' : ''}`}>{v}</div></div>)}
      </div>}
      <div className="mt-4 flex flex-wrap gap-2">{TABS.map(([k, t]) => <button key={k} onClick={() => { setParams({ tab: k }); setMsg(''); setError(''); }}
        className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}</div>
      <Banner msg={msg} error={error} />
      {tab === 'receive' && <Receive {...ctx} />}
      {tab === 'receipts' && <Receipts {...ctx} />}
      {tab === 'ageing' && <Ageing {...ctx} openLedger={(id: number) => setParams({ tab: 'ledger', partnerId: String(id) })} />}
      {tab === 'ledger' && <Ledger {...ctx} initial={params.get('partnerId') || ''} />}
    </>}
  </div>;
}

type Ctx = { partners: any[]; admin: boolean; stamp: number; done: (m: string) => void; fail: (e: unknown, f: string) => void };

function PartnerPick({ partners, value, onChange, any }: { partners: any[]; value: string; onChange: (v: string) => void; any?: boolean }) {
  return <select className={input} value={value} onChange={e => onChange(e.target.value)}>
    <option value="">{any ? 'All partners' : 'Choose partner…'}</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
  </select>;
}

function Receive({ partners, stamp, done, fail }: Ctx) {
  const [partnerId, setPartnerId] = useState('');
  const [open, setOpen] = useState<any>(null);
  const [f, setF] = useState({ receivedOn: today(), amount: '', tdsAmount: '', tdsSection: '194C', method: 'NEFT', reference: '', notes: '', allowDuplicate: false });
  const [alloc, setAlloc] = useState<Record<number, { amount: string; tds: string }>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOpen(null); setAlloc({});
    if (!partnerId) return;
    api(`/api/billing/receivables/open-bills?partnerId=${partnerId}`).then(setOpen).catch(e => fail(e, 'Could not load the open bills'));
  }, [partnerId, stamp]);

  // Oldest due first, like the server does when no split is given.
  function autoSplit(amount: string, tds: string) {
    let money = num(amount), tax = num(tds);
    const next: Record<number, { amount: string; tds: string }> = {};
    for (const b of open?.bills || []) {
      let left = num(b.outstanding);
      const t = Math.min(tax, left); tax = r2(tax - t); left = r2(left - t);
      const m = Math.min(money, left); money = r2(money - m);
      if (m > 0 || t > 0) next[b.id] = { amount: m ? String(r2(m)) : '', tds: t ? String(r2(t)) : '' };
    }
    setAlloc(next);
  }
  const set = (k: string, v: any) => setF(x => {
    const n = { ...x, [k]: v };
    if (k === 'amount' || k === 'tdsAmount') autoSplit(n.amount, n.tdsAmount);
    return n;
  });
  const allocated = useMemo(() => Object.values(alloc).reduce((s, a) => s + num(a.amount) + num(a.tds), 0), [alloc]);
  const total = num(f.amount) + num(f.tdsAmount), advance = r2(total - allocated);

  async function applyAdvance() {
    try { const r = await post(`/api/billing/receivables/advance/${partnerId}/apply`); done(r.message || 'Advance applied'); } catch (e) { fail(e, 'Could not apply the advance'); }
  }
  async function save() {
    setBusy(true);
    try {
      const allocations = Object.entries(alloc).filter(([, a]) => num(a.amount) + num(a.tds) > 0).map(([id, a]) => ({ invoiceId: Number(id), amount: num(a.amount), tdsAmount: num(a.tds) }));
      const r = await post('/api/billing/receivables/receipts', { partnerId: Number(partnerId), ...f, amount: num(f.amount), tdsAmount: num(f.tdsAmount), allocations });
      setF({ receivedOn: today(), amount: '', tdsAmount: '', tdsSection: f.tdsSection, method: f.method, reference: '', notes: '', allowDuplicate: false });
      setAlloc({});
      done(r.message || 'Receipt saved');
    } catch (e) { fail(e, 'Could not save the receipt'); } finally { setBusy(false); }
  }

  return <Section title="Record money received">
    <div className="grid gap-3 md:grid-cols-4">
      <div className="md:col-span-2"><label className={label}>Partner <span className="text-red-600">*</span></label><PartnerPick partners={partners} value={partnerId} onChange={setPartnerId} /></div>
      <div><label className={label}>Received on</label><input type="date" max={today()} className={input} value={f.receivedOn} onChange={e => set('receivedOn', e.target.value)} /></div>
      <div><label className={label}>Method</label><select className={input} value={f.method} onChange={e => set('method', e.target.value)}>{METHODS.map(m => <option key={m}>{m}</option>)}</select></div>
      <div><label className={label}>Amount received (Rs)</label><input type="number" step="any" className={input} value={f.amount} onChange={e => set('amount', e.target.value)} /></div>
      <div><label className={label}>TDS deducted (Rs)</label><input type="number" step="any" className={input} value={f.tdsAmount} onChange={e => set('tdsAmount', e.target.value)} /></div>
      <div><label className={label}>TDS section</label><select className={input} value={f.tdsSection} onChange={e => set('tdsSection', e.target.value)}>{TDS_SECTIONS.map(m => <option key={m}>{m}</option>)}</select></div>
      <div><label className={label}>UTR / cheque no.{f.method !== 'CASH' && <span className="text-red-600"> *</span>}</label><input className={input} value={f.reference} onChange={e => set('reference', e.target.value)} /></div>
      <div className="md:col-span-3"><label className={label}>Notes</label><input className={input} value={f.notes} onChange={e => set('notes', e.target.value)} /></div>
      <label className="mt-6 flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="h-4 w-4" checked={f.allowDuplicate} onChange={e => set('allowDuplicate', e.target.checked)} />It is a different payment with the same reference</label>
    </div>
    {open && <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">Open bills ({rs(open.outstanding)} outstanding)</h3>
        {num(open.advance) > 0 && <span className="flex items-center gap-2"><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-800">Advance held: {rs(open.advance)}</span>
          {(open.bills || []).length > 0 && <button className={btnLight} onClick={applyAdvance}>Apply advance to these bills</button>}</span>}</div>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-sm">
        <thead className="bg-slate-100"><tr><th className={th}>Bill</th><th className={th}>Date</th><th className={th}>Due</th><th className={th}>Total</th><th className={th}>Outstanding</th><th className={th}>Amount</th><th className={th}>TDS</th></tr></thead>
        <tbody>{(open.bills || []).map((b: any) => {
          const late = day(b.dueDate) < today();
          return <tr key={b.id} className="border-b">
            <td className={td}>{b.taxInvoiceNumber || b.invoiceNumber}</td><td className={td}>{day(b.date)}</td>
            <td className={`${td} ${late ? 'font-semibold text-red-700' : ''}`}>{day(b.dueDate)}{late && ' (overdue)'}</td>
            <td className={td}>{rs(b.totalAmount)}</td><td className={td}>{rs(b.outstanding)}</td>
            <td className={td}><input type="number" step="any" className={`${input} w-32`} value={alloc[b.id]?.amount || ''} onChange={e => setAlloc(a => ({ ...a, [b.id]: { amount: e.target.value, tds: a[b.id]?.tds || '' } }))} /></td>
            <td className={td}><input type="number" step="any" className={`${input} w-28`} value={alloc[b.id]?.tds || ''} onChange={e => setAlloc(a => ({ ...a, [b.id]: { amount: a[b.id]?.amount || '', tds: e.target.value } }))} /></td>
          </tr>;
        })}
          {(open.bills || []).length === 0 && <tr><td colSpan={7} className="p-3 text-slate-500">No open bills. The whole amount will be kept as an advance.</td></tr>}
        </tbody>
      </table></div>
      <div className="mt-2 text-sm">Received + TDS {rs(total)}, applied to bills {rs(allocated)}{advance > 0 && <>, <b>kept as advance {rs(advance)}</b></>}
        {advance < 0 && <span className="font-semibold text-red-700"> (the split is more than the money received)</span>}</div>
    </div>}
    <div className="mt-4"><button className={btn} disabled={busy || !partnerId || total <= 0 || advance < 0} onClick={save}>{busy ? 'Saving…' : 'Save receipt'}</button></div>
  </Section>;
}

function Receipts({ partners, stamp, done, fail }: Ctx) {
  const [q, setQ] = useState({ partnerId: '', from: monthStart(2), to: today() });
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    const p = new URLSearchParams(Object.entries(q).filter(([, v]) => v));
    api(`/api/billing/receivables/receipts?${p}`).then(r => setRows(r.receipts || [])).catch(e => fail(e, 'Could not load the receipts'));
  }, [q.partnerId, q.from, q.to, stamp]);
  async function reverse(r: any) {
    const reason = window.prompt(`Reason for reversing receipt ${r.receiptNumber} (e.g. cheque bounced):`);
    if (!reason?.trim()) return;
    try { const x = await post(`/api/billing/receivables/receipts/${r.id}/reverse`, { reason: reason.trim() }); done(x.message || 'Receipt reversed'); } catch (e) { fail(e, 'Could not reverse the receipt'); }
  }
  return <Section title="Receipts" right={<div className="flex flex-wrap gap-2">
    <div className="w-56"><PartnerPick partners={partners} value={q.partnerId} onChange={v => setQ(x => ({ ...x, partnerId: v }))} any /></div>
    <input type="date" className={`${input} w-40`} value={q.from} onChange={e => setQ(x => ({ ...x, from: e.target.value }))} />
    <input type="date" className={`${input} w-40`} value={q.to} onChange={e => setQ(x => ({ ...x, to: e.target.value }))} />
  </div>}>
    <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}>Receipt</th><th className={th}>Date</th><th className={th}>Partner</th><th className={th}>Amount</th><th className={th}>TDS</th><th className={th}>Method / ref</th><th className={th}>Bills</th><th className={th}></th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className={`border-b ${r.reversed ? 'text-slate-400 line-through' : ''}`}>
        <td className={td}>{r.receiptNumber || `#${r.id}`}</td><td className={td}>{day(r.receivedOn)}</td><td className={td}>{r.partnerName || `#${r.partnerId}`}</td>
        <td className={td}>{rs(r.amount)}</td><td className={td}>{num(r.tdsAmount) ? `${rs(r.tdsAmount)} ${r.tdsSection || ''}` : '-'}</td>
        <td className={td}>{r.method} {r.reference}</td>
        <td className={td}>{r.bills || <span className="text-violet-700">Advance</span>}{num(r.amount) + num(r.tdsAmount) - num(r.allocated) > 0.5 && r.bills && <div className="text-xs text-violet-700">+ advance {rs(num(r.amount) + num(r.tdsAmount) - num(r.allocated))}</div>}</td>
        <td className={td}>{r.reversed ? <span className="text-xs no-underline" title={r.reversedReason}>Reversed by {r.reversedBy}</span> : <button className={btnRed} onClick={() => reverse(r)}>Reverse</button>}</td>
      </tr>)}
        {rows.length === 0 && <tr><td colSpan={8} className="p-4 text-slate-500">No receipts in this period.</td></tr>}
      </tbody>
    </table></div>
  </Section>;
}

function Ageing({ stamp, fail, openLedger }: Ctx & { openLedger: (id: number) => void }) {
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState<any>(null);
  const [showBills, setShowBills] = useState(false);
  useEffect(() => { api(`/api/billing/receivables/ageing?asOf=${asOf}`).then(setData).catch(e => fail(e, 'Could not load the ageing')); }, [asOf, stamp]);
  const t = data?.totals || {};
  return <Section title="Receivables ageing" right={<div className="flex items-center gap-2"><span className="text-sm text-slate-600">As of</span><input type="date" className={`${input} w-40`} value={asOf} onChange={e => setAsOf(e.target.value)} />
    <button className={btnLight} onClick={() => setShowBills(x => !x)}>{showBills ? 'By partner' : 'By bill'}</button></div>}>
    {!showBills ? <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}>Partner</th>{BUCKETS.map(([k, n]) => <th key={k} className={th}>{n}</th>)}<th className={th}>Opening</th><th className={th}>Advance</th><th className={th}>Total</th></tr></thead>
      <tbody>{(data?.partners || []).map((p: any) => <tr key={p.partnerId} className="border-b">
        <td className={td}><button className="font-semibold text-sky-700 hover:underline" onClick={() => openLedger(p.partnerId)}>{p.partnerName}</button><div className="text-xs text-slate-500">{p.bills} bills</div></td>
        {BUCKETS.map(([k]) => <td key={k} className={`${td} ${k !== 'notDue' && num(p[k]) > 0 ? 'text-red-700' : ''}`}>{num(p[k]) ? rs(p[k]) : '-'}</td>)}
        <td className={td}>{num(p.opening) ? rs(p.opening) : '-'}</td><td className={td}>{num(p.advance) ? `- ${rs(p.advance)}` : '-'}</td><td className={`${td} font-bold`}>{rs(p.total)}</td>
      </tr>)}
        {data && (data.partners || []).length === 0 && <tr><td colSpan={9} className="p-4 text-slate-500">Nothing outstanding.</td></tr>}
      </tbody>
      {data && <tfoot className="bg-slate-50 font-bold"><tr><td className={td}>Total</td>{BUCKETS.map(([k]) => <td key={k} className={td}>{rs(t[k])}</td>)}<td className={td}>{rs(t.opening)}</td><td className={td}>{rs(t.advance)}</td><td className={td}>{rs(t.total)}</td></tr></tfoot>}
    </table></div>
      : <div className="overflow-x-auto"><table className="min-w-full text-sm">
        <thead className="bg-slate-100"><tr><th className={th}>Bill</th><th className={th}>Partner</th><th className={th}>Date</th><th className={th}>Due</th><th className={th}>Days overdue</th><th className={th}>Total</th><th className={th}>Outstanding</th></tr></thead>
        <tbody>{(data?.bills || []).map((b: any) => <tr key={b.id} className="border-b">
          <td className={td}>{b.taxInvoiceNumber || b.invoiceNumber}</td><td className={td}>{b.partnerName}</td><td className={td}>{day(b.date)}</td><td className={td}>{day(b.dueDate)}</td>
          <td className={`${td} ${num(b.daysOverdue) > 0 ? 'font-semibold text-red-700' : ''}`}>{b.daysOverdue || '-'}</td><td className={td}>{rs(b.totalAmount)}</td><td className={td}>{rs(b.outstanding)}</td>
        </tr>)}</tbody>
      </table></div>}
  </Section>;
}

function Ledger({ partners, admin, stamp, done, fail, initial }: Ctx & { initial: string }) {
  const [q, setQ] = useState({ partnerId: initial, from: monthStart(2), to: today() });
  const [data, setData] = useState<any>(null);
  const [opening, setOpening] = useState<{ asOf: string; amount: string; note: string } | null>(null);
  useEffect(() => {
    setData(null);
    if (!q.partnerId) return;
    api(`/api/billing/receivables/ledger?${new URLSearchParams(q)}`).then(setData).catch(e => fail(e, 'Could not load the ledger'));
  }, [q.partnerId, q.from, q.to, stamp]);
  async function saveOpening() {
    if (!opening) return;
    try { await api(`/api/billing/receivables/opening/${q.partnerId}`, { method: 'PUT', body: JSON.stringify({ ...opening, amount: num(opening.amount) }) }); setOpening(null); done('Opening balance saved'); }
    catch (e) { fail(e, 'Could not save the opening balance'); }
  }
  return <Section title="Partner ledger" right={<div className="flex flex-wrap gap-2">
    <div className="w-56"><PartnerPick partners={partners} value={q.partnerId} onChange={v => setQ(x => ({ ...x, partnerId: v }))} /></div>
    <input type="date" className={`${input} w-40`} value={q.from} onChange={e => setQ(x => ({ ...x, from: e.target.value }))} />
    <input type="date" className={`${input} w-40`} value={q.to} onChange={e => setQ(x => ({ ...x, to: e.target.value }))} />
    {q.partnerId && <button className={btnLight} onClick={() => apiDownload(`/api/billing/receivables/ledger.xlsx?${new URLSearchParams(q)}`, `Partner_Ledger_${q.partnerId}.xlsx`).catch(e => fail(e, 'Could not download'))}>Excel</button>}
    {q.partnerId && admin && <button className={btnLight} onClick={() => setOpening({ asOf: monthStart(0), amount: '', note: '' })}>Opening balance</button>}
  </div>}>
    {opening && <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-4">
      <div><label className={label}>As of</label><input type="date" className={input} value={opening.asOf} onChange={e => setOpening({ ...opening, asOf: e.target.value })} /></div>
      <div><label className={label}>Amount (Rs, minus if we owe them)</label><input type="number" step="any" className={input} value={opening.amount} onChange={e => setOpening({ ...opening, amount: e.target.value })} /></div>
      <div><label className={label}>Note</label><input className={input} value={opening.note} onChange={e => setOpening({ ...opening, note: e.target.value })} /></div>
      <div className="flex items-end gap-2"><button className={btn} onClick={saveOpening}>Save</button><button className={btnLight} onClick={() => setOpening(null)}>Cancel</button></div>
    </div>}
    {!q.partnerId ? <div className="text-slate-500">Choose a partner.</div> : data && <div className="overflow-x-auto"><table className="min-w-full text-sm">
      <thead className="bg-slate-100"><tr><th className={th}>Date</th><th className={th}>Type</th><th className={th}>Reference</th><th className={th}>Particulars</th><th className={th}>Debit</th><th className={th}>Credit</th><th className={th}>Balance</th></tr></thead>
      <tbody>
        <tr className="border-b bg-slate-50"><td className={td}>{data.from}</td><td className={td} colSpan={5}>Opening balance</td><td className={`${td} font-semibold`}>{rs(data.opening)}</td></tr>
        {(data.lines || []).map((l: any, i: number) => <tr key={i} className="border-b">
          <td className={td}>{day(l.date)}</td><td className={td}>{KIND_LABEL[l.kind] || l.kind}</td><td className={td}>{l.reference}</td><td className={td}>{l.particulars}</td>
          <td className={td}>{num(l.debit) ? rs(l.debit) : ''}</td><td className={td}>{num(l.credit) ? rs(l.credit) : ''}</td><td className={td}>{rs(l.balance)}</td>
        </tr>)}
      </tbody>
      <tfoot className="bg-slate-50 font-bold"><tr><td className={td} colSpan={4}>Closing balance {num(data.closing) < 0 ? '(advance with us)' : ''}</td><td className={td}>{rs(data.debit)}</td><td className={td}>{rs(data.credit)}</td><td className={td}>{rs(data.closing)}</td></tr></tfoot>
    </table></div>}
  </Section>;
}
