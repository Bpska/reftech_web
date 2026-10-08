/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-POD-006 -- Proof-to-bill check: for a period, which drops have no proof, which proofs are on no bill,
// which bill rows have no proof, and which refused drops still have a billing row.
// REQ-POD-003 -- Returns: refused or partly delivered goods that go back stay "open" until staff close them.
//
// Route /pod/check; /pod/check?tab=returns opens the Returns tab.
// Backend: PodController (/api/pod/reconciliation, /api/pod/returns, /api/pod/returns/{deliveryId}/close).
// The screen says "Run script 36" until database_v2/36_req_pod_001_003_006_proof.sql has been applied.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { day, role, tag } from '@/modules/transporter/transporter';
import { fmtMoney, fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const SCRIPT = 'database_v2/36_req_pod_001_003_006_proof.sql';
type Row = Record<string, any>;

const iso = (d: Date) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const tons = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : fmtWeight(v as any));
const money = (v: unknown) => fmtMoney(v as any);
const tripLink = (r: Row) => (r.tripId ? <Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">{r.tripNumber || `Trip ${r.tripId}`}</Link> : (r.tripNumber || '-'));

/** A small table: columns are [heading, how to show a row]. */
function Table({ rows, cols, empty }: { rows: Row[]; cols: [string, (r: Row) => ReactNode][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
    <thead className="bg-slate-50 text-slate-600"><tr>{cols.map(([h]) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={`${r.id ?? 'x'}-${r.tripId ?? ''}-${i}`} className="border-t border-slate-100">{cols.map(([h, f]) => <td key={h} className={td}>{f(r)}</td>)}</tr>)}</tbody>
  </table></div>;
}

function Card({ title, value, warn }: { title: string; value: unknown; warn?: boolean }) {
  const n = Number(value || 0);
  return <div className={`rounded-2xl p-4 shadow-sm ${warn && n > 0 ? 'bg-amber-50' : 'bg-white'}`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</div>
    <div className={`mt-1 text-2xl font-black ${warn && n > 0 ? 'text-amber-800' : 'text-slate-900'}`}>{n}</div>
  </div>;
}

export function ProofBillCheckPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'returns' ? 'returns' : 'check';

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Proof &amp; Bill Check</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const tabBtn = (t: string, text: string) => <button type="button" onClick={() => setParams(t === 'returns' ? { tab: 'returns' } : {})}
    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === t ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{text}</button>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ClipboardCheck className="h-8 w-8 text-sky-700" />Proof &amp; Bill Check</h1>
    <p className="mt-1 text-slate-600">Every delivery should have a proof, and every proof should be on a bill. Refused goods are not billed, and goods that go back are followed until they are closed.</p>
    <div className="mt-4 flex flex-wrap gap-2">{tabBtn('check', 'Proof-to-bill check')}{tabBtn('returns', 'Returns')}</div>
    {tab === 'returns' ? <ReturnsTab /> : <CheckTab />}
  </>;
}

// ------------------------------------------------------------------ REQ-POD-006 proof-to-bill check
function CheckTab() {
  const [from, setFrom] = useState(daysAgo(30)), [to, setTo] = useState(iso(new Date()));
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setError('');
    try { setData(await api(`/api/pod/reconciliation?from=${from}&to=${to}`)); }
    catch (x) { setError(errorText(x, 'Could not load the check')); }
    finally { setBusy(false); }
  }, [from, to]);
  useEffect(() => { void load(); }, []);   // first load with the default dates; later loads by the Show button

  const t: Row = data?.totals || {};
  return <>
    <Section title="Period" right={<span className="text-sm text-slate-500">By delivery date, trip completion and bill date</span>}>
      <form onSubmit={e => { e.preventDefault(); void load(); }} className="flex flex-wrap items-end gap-3">
        <div><label className={label} htmlFor="pod-from">From</label><input id="pod-from" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={input} /></div>
        <div><label className={label} htmlFor="pod-to">To</label><input id="pod-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className={input} /></div>
        <button disabled={busy} className={btn}>{busy ? 'Loading...' : 'Show'}</button>
      </form>
    </Section>
    <Banner error={error} />
    {data && data.podReady === false && <NotReady script={SCRIPT} />}
    {data && <>
      {data.billingReachable === false && <div className="my-3 rounded-xl bg-amber-50 p-3 text-amber-900">The billing database could not be read. The bill side of this check is empty until it can be reached.</div>}
      <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <Card title="Proofs recorded" value={t.recorded} />
        <Card title="On a bill" value={t.billed} />
        <Card title="Drops without proof" value={t.dropsWithoutProof} warn />
        <Card title="Proofs not billed" value={t.proofsWithoutBill} warn />
        <Card title="Bill rows without proof" value={t.billRowsWithoutProof} warn />
        <Card title="Refused but billed" value={t.refusalsWithBillingRow} warn />
        <Card title="Open returns" value={data.openReturns} warn />
      </div>

      <Section title="Drops without proof">
        <Table rows={data.dropsWithoutProof || []} empty="None. Every drop of the period has its proof."
          cols={[['Trip', tripLink], ['Customer', r => r.partnerName || '-'], ['Truck', r => r.vehicleNumber || '-'], ['Delivery party', r => r.deliveryPartyName || '-'],
            ['Trip status', r => <span className={tag(r.tripStatus)}>{r.tripStatus || '-'}</span>], ['Promised', r => day(r.promisedAt)], ['Completed', r => day(r.completedAt)], ['Problem', r => r.problem]]} />
      </Section>

      <Section title="Proofs not on a bill" right={<span className="text-sm text-slate-500">Older than {data.unbilledAfterDays ?? 3} days</span>}>
        <Table rows={data.proofsWithoutBill || []} empty="None. Every proof older than the waiting days is on a bill."
          cols={[['Trip', tripLink], ['Proof no.', r => r.podNumber || '-'], ['DMR no.', r => r.dmrNumber || '-'], ['Customer', r => r.partnerName || '-'], ['Truck', r => r.vehicleNumber || '-'],
            ['Delivered', r => day(r.deliveredAt)], ['Quantity', r => tons(r.deliveredQuantityTons)], ['Days', r => r.ageDays ?? '-'], ['Problem', r => r.problem]]} />
        {(data.proofsWithoutBill || []).length > 0 && <p className="mt-2 text-sm"><Link to="/billing#create-billing" className="font-bold text-sky-700 hover:underline">Open Create Bill</Link></p>}
      </Section>

      <Section title="Bill rows without proof">
        <Table rows={data.billRowsWithoutProof || []} empty="None. Every transport bill row matches a recorded delivery."
          cols={[['Bill', r => r.invoiceNumber || '-'], ['Status', r => <span className={tag(r.status)}>{r.status || '-'}</span>], ['Customer', r => r.partnerName || '-'], ['Service date', r => day(r.serviceDate)],
            ['DMR no.', r => r.dmrNumber || '-'], ['Trip', r => (r.tripId ? <Link to={`/trips/${r.tripId}`} className="font-semibold text-sky-700 hover:underline">Trip {r.tripId}</Link> : '-')],
            ['Quantity', r => tons(r.quantityTons)], ['Amount', r => money(r.lineTotal)], ['Problem', r => r.problem]]} />
      </Section>

      <Section title="Refused drops with a billing row">
        <Table rows={data.refusalsWithBillingRow || []} empty="None. No refused drop is billed."
          cols={[['Trip', tripLink], ['Proof no.', r => r.podNumber || '-'], ['DMR no.', r => r.dmrNumber || '-'], ['Bill', r => r.invoiceNumber || '-'], ['Customer', r => r.partnerName || '-'],
            ['Delivered', r => day(r.deliveredAt)], ['Problem', r => r.problem]]} />
      </Section>

      <Section title="Open returns" right={<Link to="/pod/check?tab=returns" className={btnLight}>Open the Returns tab</Link>}>
        <p className="text-sm text-slate-700">{Number(data.openReturns || 0) === 0 ? 'No return is open.' : `${data.openReturns} ${Number(data.openReturns) === 1 ? 'return is' : 'returns are'} open (all dates).`}</p>
      </Section>
    </>}
  </>;
}

// ------------------------------------------------------------------ REQ-POD-003 returns
function ReturnsTab() {
  const [status, setStatus] = useState<'OPEN' | 'CLOSED' | 'ALL'>('OPEN');
  const [data, setData] = useState<{ ready?: boolean; message?: string; returns: Row[] } | null>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      // The server lists OPEN or CLOSED; "All" asks for both.
      if (status === 'ALL') {
        const [o, c] = await Promise.all([api('/api/pod/returns?status=OPEN'), api('/api/pod/returns?status=CLOSED')]);
        setData({ ready: o.ready !== false && c.ready !== false, message: o.message || c.message, returns: [...(o.returns || []), ...(c.returns || [])] });
      } else {
        const r = await api(`/api/pod/returns?status=${status}`);
        setData({ ready: r.ready, message: r.message, returns: r.returns || [] });
      }
    } catch (x) { setError(errorText(x, 'Could not load the returns')); }
  }, [status]);
  useEffect(() => { void load(); }, [load]);

  async function closeReturn(r: Row) {
    const note = window.prompt(`What happened to the goods of ${r.podNumber || 'this delivery'}? (received back at the warehouse, delivered again on trip ..., written off)`);
    if (note === null) return;
    if (note.trim().length < 3) { setError('Write what happened to the goods.'); return; }
    setBusy(true); setMsg(''); setError('');
    try {
      const x = await api(`/api/pod/returns/${r.id}/close`, { method: 'POST', body: JSON.stringify({ note: note.trim() }) });
      setMsg(x?.message || 'The return is closed.');
      await load();
    } catch (x) { setError(errorText(x, 'Could not close the return')); }
    finally { setBusy(false); }
  }

  return <Section title="Returns" right={<div className="flex gap-2">
    {(['OPEN', 'CLOSED', 'ALL'] as const).map(s => <button key={s} type="button" onClick={() => setStatus(s)}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${status === s ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{s === 'OPEN' ? 'Open' : s === 'CLOSED' ? 'Closed' : 'All'}</button>)}
  </div>}>
    <Banner msg={msg} error={error} />
    {data && data.ready === false ? <NotReady script={SCRIPT} /> : data && <Table rows={data.returns} empty={status === 'OPEN' ? 'No return is open.' : 'No return to show.'}
      cols={[['Trip', tripLink], ['Proof no.', r => r.podNumber || '-'], ['Customer', r => r.partnerName || '-'], ['Delivery party', r => r.deliveryPartyName || '-'], ['Truck', r => r.vehicleNumber || '-'],
        ['Outcome', r => <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${r.outcome === 'REFUSED' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{r.outcomeLabel || r.outcome || '-'}</span>],
        ['Not accepted', r => tons(r.refusedQuantityTons)],
        ['Reason', r => <>{r.reasonLabel || r.reasonCode || '-'}{r.reasonNote && <div className="text-xs text-slate-500">{r.reasonNote}</div>}</>],
        ['Goods', r => r.goodsActionLabel || r.goodsAction || '-'],
        ['Delivered', r => <>{day(r.deliveredAt)}{r.returnStatus === 'OPEN' && r.ageDays != null && <div className="text-xs text-slate-500">{r.ageDays} days open</div>}</>],
        ['Return', r => r.returnStatus === 'OPEN'
          ? <button type="button" disabled={busy} onClick={() => { void closeReturn(r); }} className={btnLight}>Close return</button>
          : <div><span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">Closed</span>
              <div className="text-xs text-slate-600">{day(r.returnClosedAt)}{r.returnClosedBy ? ` by ${r.returnClosedBy}` : ''}</div>
              {r.returnNote && <div className="text-xs text-slate-600">{r.returnNote}</div>}</div>]]} />}
  </Section>;
}
