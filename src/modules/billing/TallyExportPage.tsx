/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-006 -- Tally export screen. Manager and Admin; the ledger names are changed by an Admin only.
//
// Pick the period and the kinds of voucher, preview them, then download the vouchers XML (the vouchers are then
// remembered as exported, so they are not sent twice by mistake) and, once, the ledgers XML. In Tally:
// Gateway > Import > Masters first, then Vouchers. "Send to Tally" posts straight to Tally's port when the server allows it.
//
// Backend: TallyController (/api/billing/tally/**).
// Needs database_v2/45_finance_billing_reftech_billing.sql on reftech_billing (lists answer {ready:false,message}).
import { useEffect, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { api, apiDownload, apiDownloadPost } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const BASE = '/api/billing/tally';
const KIND_LABEL: Record<string, string> = {
  SALES: 'Sales', RECEIPT: 'Receipts', CREDIT_NOTE: 'Credit notes', DEBIT_NOTE: 'Debit notes',
  PURCHASE: 'Supplier bills', PAYMENT: 'Supplier payments', FREIGHT_BILL: 'Transporter bills', FREIGHT_PAYMENT: 'Transporter payments',
};
const ALL_KINDS = Object.keys(KIND_LABEL);
// ledger settings in the order the server keeps them, with plain labels
const SETTINGS: [string, string][] = [
  ['companyName', 'Company name in Tally'], ['tallyUrl', 'Tally address (for Send to Tally)'],
  ['partyGroup', 'Group for customers'], ['supplierGroup', 'Group for suppliers and transporters'],
  ['salesLedger', 'Sales (transport)'], ['warehouseSalesLedger', 'Sales (warehouse)'],
  ['cgstLedger', 'Output CGST'], ['sgstLedger', 'Output SGST'], ['igstLedger', 'Output IGST'], ['roundOffLedger', 'Round off'],
  ['bankLedger', 'Bank'], ['cashLedger', 'Cash'], ['tdsReceivableLedger', 'TDS receivable'],
  ['purchaseLedger', 'Purchases / expenses'], ['hireLedger', 'Hired truck freight'],
  ['inputCgstLedger', 'Input CGST'], ['inputSgstLedger', 'Input SGST'], ['inputIgstLedger', 'Input IGST'], ['tdsPayableLedger', 'TDS payable'],
];
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = () => `${today().slice(0, 8)}01`;
const rs = (v: unknown) => fmtMoney(v as any);
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '-');
const kindsText = (k: unknown) => String(k || '').split(',').filter(Boolean).map(x => KIND_LABEL[x] || x).join(', ');

export default function TallyExportPage() {
  const [settings, setSettings] = useState<any>(null);
  const [missing, setMissing] = useState('');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [kinds, setKinds] = useState<string[]>(ALL_KINDS);
  const [includeExported, setIncludeExported] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadHistory = () => api(`${BASE}/history`).then(r => { if (r?.ready === false) setMissing(r.message); else setHistory(r.exports || []); }).catch(x => setError(errorText(x, 'Could not load the export history')));
  useEffect(() => {
    api(`${BASE}/settings`).then(r => {
      if (r?.ready === false) { setMissing(r.message || 'The finance tables are not ready.'); return; }
      setSettings(r);
      if (Array.isArray(r.kinds) && r.kinds.length) setKinds(r.kinds);
    }).catch(x => setError(errorText(x, 'Could not load the Tally settings')));
    void loadHistory();
  }, []);

  const allKinds: string[] = settings?.kinds || ALL_KINDS;
  const filters = () => ({ from, to, kinds: kinds.join(',') });
  // the server treats an empty kind list as "all kinds", so nothing ticked is stopped here
  const ready = !!from && !!to && kinds.length > 0;
  function changed() { setPreview(null); }

  async function step(action: () => Promise<any>, done: (r: any) => string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); setMsg(done(r)); return r ?? true; }
    catch (x) { setError(errorText(x, 'Something went wrong')); return null; }
    finally { setBusy(false); }
  }
  const showPreview = () => step(async () => {
    const q = new URLSearchParams({ ...filters(), includeExported: String(includeExported) });
    const r = await api(`${BASE}/preview?${q}`);
    if (r?.ready === false) { setMissing(r.message); return r; }
    setPreview(r); return r;
  }, r => r?.ready === false ? '' : `${(r.vouchers || []).length} voucher(s) found.`);
  const downloadVouchers = () => step(async () => {
    const name = await apiDownloadPost(`${BASE}/export`, { from, to, kinds, includeExported }, `Tally_Vouchers_${from}_to_${to}.xml`);
    await loadHistory(); setPreview(null); return name;
  }, name => `Saved ${name}. These vouchers are now marked exported. In Tally: Gateway > Import > Vouchers.`);
  const downloadLedgers = () => step(() => apiDownload(`${BASE}/masters.xml?${new URLSearchParams(filters())}`, 'Tally_Ledgers.xml'),
    () => 'Saved Tally_Ledgers.xml. In Tally: Gateway > Import > Masters, before the vouchers.');
  const push = () => {
    if (!window.confirm('Send the vouchers not exported before straight to Tally? They will be marked exported.')) return;
    void step(async () => { const r = await api(`${BASE}/push`, { method: 'POST', body: JSON.stringify({ from, to, kinds }) }); await loadHistory(); setPreview(null); return r; },
      r => `Sent ${r.count} voucher(s) to Tally. Tally says: ${r.result}`);
  };
  const again = (h: any) => step(() => apiDownload(`${BASE}/history/${h.id}/file`, h.fileName || `Tally_Export_${h.id}.xml`), () => `Saved ${h.fileName || 'the file'} again.`);

  const rows: any[] = preview?.vouchers || [];
  const fresh = rows.filter(v => !v.exported).length;
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><FileSpreadsheet className="h-8 w-8 text-sky-700" />Tally Export</h1>
    <p className="text-slate-600">Sales, receipts, notes, supplier and transporter bills and payments as Tally vouchers (TallyPrime / Tally.ERP 9 XML).
      In Tally, import <b>Gateway &gt; Import &gt; Masters</b> first (the ledgers file), then <b>Vouchers</b>.</p>
    <Banner msg={msg} error={error} />
    {missing ? <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{missing}</div> : <>
      <Section title="What to export">
        <div className="grid gap-3 md:grid-cols-4">
          <div><label className={label}>From *</label><input type="date" value={from} onChange={x => { setFrom(x.target.value); changed(); }} className={input} /></div>
          <div><label className={label}>To *</label><input type="date" value={to} onChange={x => { setTo(x.target.value); changed(); }} className={input} /></div>
          <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            <input type="checkbox" checked={includeExported} onChange={x => { setIncludeExported(x.target.checked); changed(); }} className="h-4 w-4" />Include vouchers already exported</label>
        </div>
        <div className="mt-3"><span className={label}>Vouchers</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{allKinds.map(k => <label key={k} className="flex items-center gap-1.5">
            <input type="checkbox" checked={kinds.includes(k)} className="h-4 w-4"
              onChange={x => { setKinds(ks => x.target.checked ? allKinds.filter(a => a === k || ks.includes(a)) : ks.filter(a => a !== k)); changed(); }} />{KIND_LABEL[k] || k}</label>)}
            <button type="button" onClick={() => { setKinds(kinds.length === allKinds.length ? [] : allKinds); changed(); }} className="text-xs font-semibold text-sky-700">
              {kinds.length === allKinds.length ? 'Untick all' : 'Tick all'}</button></div>
          {kinds.length === 0 && <div className="mt-1 text-xs text-red-700">Tick at least one kind.</div>}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy || !ready} onClick={() => void showPreview()} className={btn}>Preview</button>
          <button disabled={busy || !ready} onClick={() => void downloadVouchers()} className={btnLight}>Download vouchers XML</button>
          <button disabled={busy || !ready} onClick={() => void downloadLedgers()} className={btnLight}>Download ledgers XML</button>
          {(preview?.pushEnabled ?? settings?.pushEnabled) && <button disabled={busy || !ready} onClick={push} className={btnLight}>Send to Tally</button>}
        </div>
        <p className="mt-2 text-xs text-slate-500">Downloading the vouchers marks them exported{includeExported ? '' : '; the next download leaves them out unless "include already exported" is ticked'}. The ledgers file can be downloaded any time.</p>
      </Section>

      {preview && <Section title="Preview">
        <div className="flex flex-wrap gap-2 text-sm">{allKinds.filter(k => kinds.includes(k)).map(k => <span key={k} className="rounded-xl border bg-slate-50 px-3 py-1.5">
          {KIND_LABEL[k] || k} <b>{preview.counts?.[k] || 0}</b></span>)}</div>
        {(preview.problems || []).length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-semibold">Check before importing:</div>
          <ul className="ml-5 list-disc">{preview.problems.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul></div>}
        <p className="mt-3 text-sm text-slate-600">{rows.length} voucher(s){includeExported ? `, ${rows.length - fresh} already exported (grey)` : ''}.</p>
        <div className="mt-1 max-h-[32rem] overflow-auto"><table className="w-full min-w-[800px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Date</th><th className={th}>Kind</th><th className={th}>Tally type</th><th className={th}>Number</th><th className={th}>Party</th>
            <th className={`${th} text-right`}>Amount</th><th className={th}></th></tr></thead>
          <tbody>{rows.map(v => <tr key={`${v.kind}:${v.id}`} className={`border-t ${v.exported ? 'text-slate-400' : ''}`}>
            <td className={td}>{day(v.date)}</td><td className={td}>{KIND_LABEL[v.kind] || v.kind}</td><td className={td}>{v.type}</td><td className={`${td} font-mono`}>{v.number}</td>
            <td className={td}>{v.party || <span className="text-red-700">no party</span>}</td><td className={`${td} text-right`}>{rs(v.amount)}</td>
            <td className={`${td} text-xs`}>{v.exported ? 'exported before' : ''}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No vouchers in this period{includeExported ? '' : ' that were not exported before'}.</td></tr>}</tbody></table></div>
      </Section>}

      <Section title="Exports so far">
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>When</th><th className={th}>Period</th><th className={th}>Kinds</th><th className={`${th} text-right`}>Vouchers</th>
            <th className={th}>By</th><th className={th}>Sent to Tally</th><th className={th}></th></tr></thead>
          <tbody>{history.map(h => <tr key={h.id} className="border-t">
            <td className={td}>{String(h.exportedAt || '').slice(0, 16).replace('T', ' ')}</td><td className={td}>{day(h.from)} to {day(h.to)}</td>
            <td className={`${td} max-w-xs`}>{kindsText(h.kinds)}</td><td className={`${td} text-right`}>{h.count}</td><td className={td}>{h.exportedBy}</td>
            <td className={td}>{h.sentToTally ? 'Yes' : 'No'}{h.tallyResult && <div className="text-xs text-slate-500">{h.tallyResult}</div>}</td>
            <td className={td}><button disabled={busy} onClick={() => void again(h)} className={btnLight}>Download again</button></td></tr>)}
            {history.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>Nothing exported yet.</td></tr>}</tbody></table></div>
        <p className="mt-2 text-xs text-slate-500">"Download again" builds the same vouchers as they are now.</p>
      </Section>

      {settings && <LedgerSettings settings={settings} onSaved={s => setSettings(s)} />}
    </>}
  </>;
}

/** Ledger names used in the vouchers. Everyone sees them; only an Admin can save (the server says so otherwise). */
function LedgerSettings({ settings, onSaved }: { settings: any; onSaved: (s: any) => void }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(SETTINGS.map(([k]) => [k, settings[k] == null ? '' : String(settings[k])])));
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMsg(''); setError('');
    try { const r = await api(`${BASE}/settings`, { method: 'PUT', body: JSON.stringify(v) }); onSaved(r); setMsg('Ledger names saved.'); }
    catch (x) { setError(errorText(x, 'Could not save the ledger names')); }
    finally { setBusy(false); }
  }
  return <Section title="Tally ledgers" right={<button onClick={() => setOpen(o => !o)} className={btnLight}>{open ? 'Hide' : 'Show'}</button>}>
    <p className="text-sm text-slate-600">The ledger names must be exactly as in your Tally company. Admin only can change them.</p>
    {open && <>
      <div className="mt-3 grid gap-3 md:grid-cols-3">{SETTINGS.map(([k, l]) => <div key={k}><label className={label}>{l}</label>
        <input value={v[k] ?? ''} onChange={x => setV(o => ({ ...o, [k]: x.target.value }))} placeholder={k === 'tallyUrl' ? 'http://192.168.1.20:9000' : ''} className={input} /></div>)}</div>
      <Banner msg={msg} error={error} />
      <button disabled={busy} onClick={() => void save()} className={`${btn} mt-3`}>Save ledgers</button>
      {!settings.pushEnabled && <p className="mt-2 text-xs text-slate-500">Sending straight to Tally is off on this server; the Tally address is used only when it is switched on.</p>}
    </>}
  </Section>;
}
