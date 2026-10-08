/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-008 -- Freight per ton, full loads and part loads. Staff only.
//
// Choose the partner and the period: the closed deliveries that are not on a bill are listed with their tons and
// rate per ton (the part load's own rate, else the load's rate, else the trip's rate). Tick the rows, type a rate
// where none is known, and save: the bill goes to review with one row per load. The reviewer adds GST on Billing;
// no Rate per KM is asked. Goods on a quality hold, or rejected, cannot be billed (REQ-CC-009).
// Backend: GET /api/billing/per-ton/candidates, POST /api/billing/per-ton/bills.
// Needs database_v2/41_per_ton_billing_reftech_billing.sql on reftech_billing.
// REQ-BIL-005: the unfinished bill is kept as a draft (useBillDraft). REQ-BIL-001: with no rate on the load or trip,
// the rate per ton comes from the partner's rate contract (rateSource says where each rate came from).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { DraftNotice, useBillDraft } from './useBillDraft';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const rupee = (n: unknown) => fmtMoney(Number(n || 0));
const t3 = (n: unknown) => (n === null || n === undefined ? '-' : String(Number(n)));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const monthStart = () => `${today().slice(0, 8)}01`;

const RATE_SOURCE: Record<string, string> = { PART_LOAD: 'part load', LOAD_REQUEST: 'load', TRIP: 'trip' };

export function PerTonBillingPage() {
  const [partners, setPartners] = useState<any[]>([]), [partnerId, setPartnerId] = useState('');
  const [from, setFrom] = useState(monthStart()), [to, setTo] = useState(today());
  const [data, setData] = useState<any>(null), [picked, setPicked] = useState<Record<string, boolean>>({}), [rates, setRates] = useState<Record<string, string>>({});
  const [billingDate, setBillingDate] = useState(today()), [description, setDescription] = useState('');
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  type Draft = { partnerId: string; from: string; to: string; picked: Record<string, boolean>; rates: Record<string, string>; billingDate: string; description: string };
  const pending = useRef<Draft | null>(null);
  const draft = useBillDraft<Draft>('per-ton-bill', { partnerId, from, to, picked, rates, billingDate, description },
    { enabled: true, isEmpty: d => !d.partnerId || (!Object.values(d.rates).some(Boolean) && !d.description), title: 'Per-ton bill' });
  function restoreDraft() {
    const d = draft.restore();
    if (!d) return;
    pending.current = d;
    setFrom(d.from); setTo(d.to); setBillingDate(d.billingDate); setDescription(d.description);
    if (d.partnerId === partnerId) find(d); else setPartnerId(d.partnerId);
  }

  useEffect(() => { api('/api/operations/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([])); }, []);
  const find = (restored?: Draft) => {
    const wanted = restored || pending.current;
    pending.current = null;
    if (!partnerId && !wanted) return;
    setErr(''); setData(null); setPicked({}); setRates({});
    api(`/api/billing/per-ton/candidates?partnerId=${wanted?.partnerId || partnerId}&from=${wanted?.from || from}&to=${wanted?.to || to}`)
      .then(d => {
        setData(d);
        const p: Record<string, boolean> = {};
        for (const r of d.rows || []) if (r.billable) p[r.dmrEntryId] = true;
        if (wanted) { setRates(wanted.rates || {}); setPicked({ ...p, ...wanted.picked }); } else setPicked(p);
      })
      .catch(e => setErr(errorText(e, 'The deliveries could not be read')));
  };
  useEffect(() => find(), [partnerId]);

  const rows: any[] = data?.rows || [];
  // a row with no rate becomes billable once a rate is typed (and it has no other problem)
  const rateOf = (r: any) => (r.needsRate ? Number(rates[r.dmrEntryId] || 0) : Number(r.ratePerTon || 0));
  const otherProblems = (r: any) => (r.problems || []).filter((p: string) => !p.startsWith('No rate per ton'));
  const can = (r: any) => !r.onBill && otherProblems(r).length === 0 && rateOf(r) > 0;
  const chosen = rows.filter(r => picked[r.dmrEntryId] && can(r));
  const total = useMemo(() => chosen.reduce((s, r) => ({ tons: s.tons + Number(r.tons || 0), amount: s.amount + Math.round(Number(r.tons || 0) * rateOf(r) * 100) / 100 }), { tons: 0, amount: 0 }), [chosen, rates]);

  async function save() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const body = { partnerId, dmrEntryIds: chosen.map(r => r.dmrEntryId), billingDate, description,
        rates: Object.fromEntries(chosen.filter(r => r.needsRate).map(r => [r.dmrEntryId, rates[r.dmrEntryId]])) };
      const r = await api('/api/billing/per-ton/bills', { method: 'POST', body: JSON.stringify(body) });
      setMsg(r.message || `Bill ${r.invoiceNumber} saved for review.`); setDescription(''); draft.clear(); find();
    } catch (e) { setErr(errorText(e, 'The bill was not saved')); } finally { setBusy(false); }
  }

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Scale />Per-ton Bill</h1>
    <p className="text-slate-600">Bill delivered goods by weight: full loads and part loads, each at its own rate per ton. The reviewer adds GST on <Link to="/billing" className="font-bold text-sky-700 hover:underline">Billing</Link>.</p>
    <Banner msg={msg} error={err} />
    <DraftNotice found={draft.found} foundAt={draft.foundAt} status={draft.status} onRestore={restoreDraft} onDiscard={draft.clear} />
    {data && data.ready === false && <div className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">{data.message}</div>}

    <Section title="Deliveries to bill">
      <div className="grid gap-3 md:grid-cols-4">
        <div><span className={label}>Partner *</span><select className={input} value={partnerId} onChange={e => setPartnerId(e.target.value)}><option value="">Choose the partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><span className={label}>Delivered from</span><input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div><span className={label}>Delivered to</span><input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="flex items-end"><button className={btnLight} disabled={!partnerId} onClick={() => find()}>Show deliveries</button></div>
      </div>
      {data?.ready && <p className="mt-2 text-xs text-slate-500">Tons used: {data.tonsBasis === 'DELIVERED' ? 'the tons delivered on the proof of delivery' : 'the planned tons'}.</p>}

      {data?.ready && (rows.length === 0 ? <p className="mt-3 text-slate-500">No delivered goods of this partner in the period are waiting for a bill.</p> :
        <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-left"><th className="p-2" /><th>Date</th><th>DMR / Proof</th><th>Trip</th><th>Load</th><th>Route</th><th className="text-right">Planned t</th><th className="text-right">Delivered t</th><th className="text-right">Rate / t</th><th className="text-right">Amount</th><th>Note</th></tr></thead>
          <tbody>{rows.map(r => { const ok = can(r); return <tr key={r.dmrEntryId} className={`border-t align-top ${ok ? '' : 'bg-slate-50 text-slate-500'}`}>
            <td className="p-2"><input type="checkbox" disabled={!ok} checked={!!picked[r.dmrEntryId] && ok} onChange={e => setPicked(x => ({ ...x, [r.dmrEntryId]: e.target.checked }))} /></td>
            <td className="whitespace-nowrap">{r.serviceDate}</td>
            <td className="font-mono text-xs">{r.dmrNumber}<div>{r.podNumber}</div></td>
            <td>{r.tripId ? <Link to={`/trips/${r.tripId}`} className="text-sky-700 hover:underline">{r.tripNumber}</Link> : r.tripNumber}<div className="text-xs">{r.vehicleNumber}</div></td>
            <td>{r.loadNumber || '-'}<div className="text-xs">{r.partLoad ? 'part load' : 'full load'}</div></td>
            <td>{r.fromLocation} → {r.toLocation}</td>
            <td className="text-right font-mono">{t3(r.plannedTons)}</td>
            <td className="text-right font-mono">{t3(r.deliveredTons)}</td>
            <td className="text-right">{r.needsRate
              ? <input type="number" min="0.01" step="0.01" placeholder="Rate" className="w-24 rounded-lg border border-amber-400 px-2 py-1 text-right" value={rates[r.dmrEntryId] || ''}
                onChange={e => { const v = e.target.value; setRates(x => ({ ...x, [r.dmrEntryId]: v })); if (Number(v) > 0) setPicked(x => ({ ...x, [r.dmrEntryId]: true })); }} />
              : <><span className="font-mono">{Number(r.ratePerTon).toLocaleString('en-IN')}</span>{r.rateSource && <div className="text-[10px] text-slate-500">{RATE_SOURCE[r.rateSource] || r.rateSource}</div>}</>}</td>
            <td className="text-right font-mono">{rateOf(r) > 0 && r.tons != null ? rupee(Number(r.tons) * rateOf(r)) : '-'}</td>
            <td className="max-w-xs text-xs">{r.onBill ? `On bill ${r.onBill}` : otherProblems(r).join('. ')}{r.qualityNote ? <div className="text-sky-800">{r.qualityNote}</div> : null}{r.rejectedInvoiceNumber ? <div>Was on rejected bill {r.rejectedInvoiceNumber}</div> : null}</td>
          </tr>; })}</tbody>
        </table></div>)}
    </Section>

    {data?.ready && rows.length > 0 && <Section title="Make the bill">
      <div className="grid gap-3 md:grid-cols-3">
        <div><span className={label}>Bill date</span><input type="date" className={input} value={billingDate} onChange={e => setBillingDate(e.target.value)} /></div>
        <div className="md:col-span-2"><span className={label}>Description (optional)</span><input className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="Freight per ton, September" /></div>
      </div>
      <p className="mt-3 font-semibold">{chosen.length} {chosen.length === 1 ? 'delivery' : 'deliveries'} · {Math.round(total.tons * 1000) / 1000} t · {rupee(total.amount)} before GST</p>
      <button className={`${btn} mt-2`} disabled={busy || chosen.length === 0} onClick={save}>Save bill for review</button>
    </Section>}
  </>;
}
