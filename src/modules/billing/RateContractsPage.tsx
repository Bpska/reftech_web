/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-001 -- partner rate contracts. Manager and Admin.
//
// A contract holds a partner's agreed rates (per km, per ton, per trip, per pallet-day) by lane, temperature and
// vehicle type, with GST %, payment terms and credit limit. When a bill of that partner is reviewed, the rate of the
// contract in force on the bill date is filled in (Billing > Review); the reviewer can still change it.
// One contract is in force per partner and date: saving an Active contract can end the earlier one.
//
// Backend: PartnerRateController (/api/billing/rate-contracts). Needs database_v2/45 on reftech_billing.
import { Fragment, useEffect, useState } from 'react';
import { FileSignature } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const BASIS: [string, string][] = [['PER_KM', 'Per km'], ['PER_TON', 'Per ton'], ['PER_TRIP', 'Per trip'], ['PALLET_DAY', 'Per pallet-day']];
const BASIS_LABEL = Object.fromEntries(BASIS);
const TEMPS = ['ANY', 'FROZEN', 'CHILLED', 'AMBIENT'];
const STATUS_STYLE: Record<string, string> = { ACTIVE: 'bg-emerald-100 text-emerald-800', DRAFT: 'bg-amber-100 text-amber-800', ENDED: 'bg-slate-200 text-slate-600' };
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const day = (v: unknown) => (v ? String(v).slice(0, 10) : '');
const rs = (v: unknown) => fmtMoney(v as any);

type Line = { service: string; basis: string; fromLocation: string; toLocation: string; temperatureClass: string; vehicleType: string; rate: string; minCharge: string; notes: string };
type Form = {
  id?: number; partnerId: string; title: string; validFrom: string; validTo: string; gstRate: string; paymentTermsDays: string; creditLimit: string;
  status: string; sourceReference: string; notes: string; endPrevious: boolean; lines: Line[];
};
const blankLine = (): Line => ({ service: 'TRANSPORT', basis: 'PER_KM', fromLocation: '', toLocation: '', temperatureClass: 'ANY', vehicleType: '', rate: '', minCharge: '', notes: '' });
const blankForm = (): Form => ({ partnerId: '', title: '', validFrom: today(), validTo: '', gstRate: '18', paymentTermsDays: '30', creditLimit: '', status: 'ACTIVE',
  sourceReference: '', notes: '', endPrevious: true, lines: [blankLine()] });
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));

export default function RateContractsPage() {
  const [partners, setPartners] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState({ partnerId: '', status: '' });
  const [form, setForm] = useState<Form | null>(null);
  const [open, setOpen] = useState<any>(null);
  const [notReady, setNotReady] = useState('');
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v));
      const r = await api(`/api/billing/rate-contracts?${q}`);
      if (r.ready === false) { setNotReady(r.message || 'Run database_v2/45_finance_billing_reftech_billing.sql on reftech_billing.'); setRows([]); return; }
      setNotReady(''); setRows(r.contracts || []);
    } catch (e) { setError(errorText(e, 'Could not load the rate contracts')); }
  }
  useEffect(() => { api('/api/admin/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([])); }, []);
  useEffect(() => { load(); }, [filter.partnerId, filter.status]);

  async function edit(id: number) {
    setMsg(''); setError('');
    try {
      const c = await api(`/api/billing/rate-contracts/${id}`);
      setForm({
        id: c.id, partnerId: s(c.partnerId), title: s(c.title), validFrom: day(c.validFrom), validTo: day(c.validTo), gstRate: s(c.gstRate), paymentTermsDays: s(c.paymentTermsDays),
        creditLimit: s(c.creditLimit), status: s(c.status) || 'ACTIVE', sourceReference: s(c.sourceReference), notes: s(c.notes), endPrevious: true,
        lines: (c.lines || []).map((l: any) => ({ service: s(l.service), basis: s(l.basis), fromLocation: s(l.fromLocation), toLocation: s(l.toLocation), temperatureClass: s(l.temperatureClass) || 'ANY',
          vehicleType: s(l.vehicleType), rate: s(l.rate), minCharge: s(l.minCharge), notes: s(l.notes) })),
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { setError(errorText(e, 'Could not open the contract')); }
  }
  async function view(id: number) {
    if (open?.id === id) { setOpen(null); return; }
    try { setOpen(await api(`/api/billing/rate-contracts/${id}`)); } catch (e) { setError(errorText(e, 'Could not open the contract')); }
  }
  async function save() {
    if (!form) return;
    setBusy(true); setMsg(''); setError('');
    try {
      const body = { ...form, lines: form.lines.filter(l => l.rate !== '' || l.fromLocation || l.toLocation) };
      const r = await api(form.id ? `/api/billing/rate-contracts/${form.id}` : '/api/billing/rate-contracts', { method: form.id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setMsg(r.message || 'Saved'); setForm(null); load();
    } catch (e) { setError(errorText(e, 'Could not save the contract')); } finally { setBusy(false); }
  }
  async function end(c: any) {
    const on = window.prompt(`End contract ${c.contractNo} on (yyyy-mm-dd):`, today());
    if (on === null) return;
    try { const r = await api(`/api/billing/rate-contracts/${c.id}/end`, { method: 'POST', body: JSON.stringify({ on: on.trim() }) }); setMsg(r.message || 'Ended'); load(); }
    catch (e) { setError(errorText(e, 'Could not end the contract')); }
  }

  const set = (k: keyof Form, v: any) => setForm(f => (f ? { ...f, [k]: v } : f));
  const setLine = (i: number, k: keyof Line, v: string) => setForm(f => (f ? { ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, [k]: v, ...(k === 'service' && v === 'WAREHOUSE' ? { basis: 'PALLET_DAY' } : {}) } : l)) } : f));

  return <div className="mx-auto max-w-7xl p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><FileSignature className="h-6 w-6 text-sky-700" />Partner Rate Contracts</h1>
      {!form && !notReady && <button className={btn} onClick={() => { setForm(blankForm()); setMsg(''); }}>New contract</button>}
    </div>
    <p className="mt-1 text-sm text-slate-600">The rate of the contract in force on the bill date is filled in when a bill is reviewed. The reviewer can still change it.</p>
    {notReady && <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">{notReady}</div>}
    <Banner msg={msg} error={error} />

    {form && <Section title={form.id ? 'Change contract' : 'New contract'}>
      <div className="grid gap-3 md:grid-cols-4">
        <div><label className={label}>Partner <span className="text-red-600">*</span></label>
          <select className={input} value={form.partnerId} onChange={e => set('partnerId', e.target.value)}><option value="">Choose…</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="md:col-span-2"><label className={label}>Title</label><input className={input} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. FY 26-27 frozen lanes" /></div>
        <div><label className={label}>Status</label><select className={input} value={form.status} onChange={e => set('status', e.target.value)}>{['ACTIVE', 'DRAFT', 'ENDED'].map(x => <option key={x}>{x}</option>)}</select></div>
        <div><label className={label}>Valid from <span className="text-red-600">*</span></label><input type="date" className={input} value={form.validFrom} onChange={e => set('validFrom', e.target.value)} /></div>
        <div><label className={label}>Valid to</label><input type="date" className={input} value={form.validTo} onChange={e => set('validTo', e.target.value)} /><div className="mt-0.5 text-xs text-slate-500">Empty means open-ended</div></div>
        <div><label className={label}>GST %</label><input type="number" step="any" className={input} value={form.gstRate} onChange={e => set('gstRate', e.target.value)} /></div>
        <div><label className={label}>Payment terms (days)</label><input type="number" className={input} value={form.paymentTermsDays} onChange={e => set('paymentTermsDays', e.target.value)} /></div>
        <div><label className={label}>Credit limit (Rs)</label><input type="number" step="any" className={input} value={form.creditLimit} onChange={e => set('creditLimit', e.target.value)} /></div>
        <div><label className={label}>Agreement reference</label><input className={input} value={form.sourceReference} onChange={e => set('sourceReference', e.target.value)} placeholder="PO / agreement no." /></div>
        <div className="md:col-span-2"><label className={label}>Notes</label><input className={input} value={form.notes} onChange={e => set('notes', e.target.value)} /></div>
        {form.status === 'ACTIVE' && <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-full">
          <input type="checkbox" className="h-4 w-4" checked={form.endPrevious} onChange={e => set('endPrevious', e.target.checked)} />End this partner's earlier active contract the day before this one starts</label>}
      </div>
      <h3 className="mt-5 font-bold">Rates</h3>
      <div className="mt-2 overflow-x-auto"><table className="min-w-full text-sm">
        <thead className="bg-slate-100"><tr><th className={th}>Service</th><th className={th}>Basis</th><th className={th}>From</th><th className={th}>To</th><th className={th}>Temperature</th><th className={th}>Vehicle type</th><th className={th}>Rate (Rs)</th><th className={th}>Min charge</th><th className={th}></th></tr></thead>
        <tbody>{form.lines.map((l, i) => <tr key={i} className="border-b">
          <td className={td}><select className={input} value={l.service} onChange={e => setLine(i, 'service', e.target.value)}><option value="TRANSPORT">Transport</option><option value="WAREHOUSE">Warehouse</option></select></td>
          <td className={td}><select className={input} value={l.basis} onChange={e => setLine(i, 'basis', e.target.value)}>{BASIS.filter(([b]) => (l.service === 'WAREHOUSE') === (b === 'PALLET_DAY')).map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></td>
          <td className={td}><input className={input} value={l.fromLocation} disabled={l.service === 'WAREHOUSE'} onChange={e => setLine(i, 'fromLocation', e.target.value)} placeholder="Any" /></td>
          <td className={td}><input className={input} value={l.toLocation} disabled={l.service === 'WAREHOUSE'} onChange={e => setLine(i, 'toLocation', e.target.value)} placeholder="Any" /></td>
          <td className={td}><select className={input} value={l.temperatureClass} onChange={e => setLine(i, 'temperatureClass', e.target.value)}>{TEMPS.map(x => <option key={x}>{x}</option>)}</select></td>
          <td className={td}><input className={input} value={l.vehicleType} onChange={e => setLine(i, 'vehicleType', e.target.value)} placeholder="Any" /></td>
          <td className={td}><input type="number" step="any" className={`${input} w-28`} value={l.rate} onChange={e => setLine(i, 'rate', e.target.value)} /></td>
          <td className={td}><input type="number" step="any" className={`${input} w-28`} value={l.minCharge} onChange={e => setLine(i, 'minCharge', e.target.value)} /></td>
          <td className={td}><button type="button" className={btnRed} onClick={() => set('lines', form.lines.filter((_, j) => j !== i))}>Remove</button></td>
        </tr>)}</tbody>
      </table></div>
      <div className="mt-1 text-xs text-slate-500">Empty From/To means any lane. The most specific matching row wins. Pallet-day rates are shown to the reviewer of warehouse bills.</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={btnLight} onClick={() => set('lines', [...form.lines, blankLine()])}>Add rate</button>
        <span className="flex-1" />
        <button type="button" className={btn} disabled={busy || !form.partnerId || !form.validFrom} onClick={save}>{busy ? 'Saving…' : 'Save contract'}</button>
        <button type="button" className={btnLight} onClick={() => setForm(null)}>Cancel</button>
      </div>
    </Section>}

    {!notReady && <Section title="Contracts" right={<div className="flex flex-wrap gap-2">
      <select className={`${input} w-56`} value={filter.partnerId} onChange={e => setFilter(f => ({ ...f, partnerId: e.target.value }))}><option value="">All partners</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select className={`${input} w-36`} value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}><option value="">Any status</option>{['ACTIVE', 'DRAFT', 'ENDED'].map(x => <option key={x}>{x}</option>)}</select>
    </div>}>
      <div className="overflow-x-auto"><table className="min-w-full text-sm">
        <thead className="bg-slate-100"><tr><th className={th}>Contract</th><th className={th}>Partner</th><th className={th}>Valid</th><th className={th}>Rates</th><th className={th}>GST / terms</th><th className={th}>Status</th><th className={th}></th></tr></thead>
        <tbody>{rows.map(c => <Fragment key={c.id}>
          <tr className="border-b">
            <td className={td}><button className="font-semibold text-sky-700 hover:underline" onClick={() => view(c.id)}>{c.contractNo}</button><div className="text-xs text-slate-500">{c.title}</div></td>
            <td className={td}>{c.partnerName || `#${c.partnerId}`}</td>
            <td className={td}>{day(c.validFrom)} to {day(c.validTo) || 'open'}</td>
            <td className={td}>{c.lineCount} <span className="text-xs text-slate-500">{String(c.bases || '').split(',').filter(Boolean).map(b => BASIS_LABEL[b] || b).join(', ')}</span></td>
            <td className={td}>{c.gstRate ?? '-'}% / {c.paymentTermsDays ?? '-'} days{c.creditLimit ? <div className="text-xs text-slate-500">Limit {rs(c.creditLimit)}</div> : null}</td>
            <td className={td}><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[c.status] || 'bg-slate-100'}`}>{c.status}</span>{c.inForce && <div className="text-xs font-semibold text-emerald-700">In force today</div>}</td>
            <td className={`${td} whitespace-nowrap`}><button className={btnLight} onClick={() => edit(c.id)}>Change</button> {c.status !== 'ENDED' && <button className={btnRed} onClick={() => end(c)}>End</button>}</td>
          </tr>
          {open?.id === c.id && <tr><td colSpan={7} className="bg-slate-50 p-3">
            <table className="min-w-full text-xs"><thead><tr><th className={th}>Service</th><th className={th}>Basis</th><th className={th}>Lane</th><th className={th}>Temperature</th><th className={th}>Vehicle</th><th className={th}>Rate</th><th className={th}>Min charge</th></tr></thead>
              <tbody>{(open.lines || []).map((l: any) => <tr key={l.id}><td className={td}>{l.service}</td><td className={td}>{BASIS_LABEL[l.basis] || l.basis}</td><td className={td}>{l.fromLocation || 'Any'} to {l.toLocation || 'Any'}</td>
                <td className={td}>{l.temperatureClass}</td><td className={td}>{l.vehicleType || 'Any'}</td><td className={td}>{rs(l.rate)}</td><td className={td}>{l.minCharge ? rs(l.minCharge) : '-'}</td></tr>)}</tbody></table>
            {open.sourceReference && <div className="mt-2 text-xs text-slate-600">Agreement: {open.sourceReference}</div>}
            <div className="mt-1 text-xs text-slate-500">Saved by {open.updatedBy || open.createdBy}</div>
          </td></tr>}
        </Fragment>)}
          {rows.length === 0 && <tr><td colSpan={7} className="p-4 text-slate-500">No rate contracts yet. Add one so bills of that partner are pre-filled.</td></tr>}
        </tbody>
      </table></div>
    </Section>}
  </div>;
}
