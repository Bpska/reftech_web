/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-004, 005, 006 -- every tender, spot quote, reverse auction and share-rule load: what each waits for,
// with the offers, bids and award of the one opened. A tender is started from its vehicle request.
//
// Backend: TenderController (/api/allocation/tenders).
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btnLight, errorText, td, th } from '@/shared/components/FormKit';
import { role, rupees } from '@/modules/transporter/transporter';
import { when } from '@/modules/allocation/allocation';
import { KIND_LABEL, SCRIPT_46, TENDER_LABEL, pill } from './tender';
import { TenderBox } from './TenderBox';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function TendersPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const id = Number(params.get('id') || 0);
  const [status, setStatus] = useState('LIVE'), [kind, setKind] = useState('');
  const [list, setList] = useState<any>(null), [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState(''), [error, setError] = useState('');

  const loadList = useCallback(async () => {
    try { setList(await api(`/api/allocation/tenders?status=${status}${kind ? `&kind=${kind}` : ''}`)); }
    catch (x) { setError(errorText(x, 'Could not load the tenders')); }
  }, [status, kind]);
  const loadOne = useCallback(async () => {
    if (!id) { setDetail(null); return; }
    try { setDetail(await api(`/api/allocation/tenders/${id}`)); } catch (x) { setError(errorText(x, 'Could not load the tender')); }
  }, [id]);
  useEffect(() => { if (me.staff) void loadList(); }, [loadList]);
  useEffect(() => { if (me.staff) void loadOne(); }, [loadOne]);

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Tenders</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Gavel className="h-8 w-8 text-sky-700" />Tenders &amp; auctions</h1>
    <p className="text-slate-600">Loads sent to transporters. Start one from a <Link to="/vehicle-requests" className="font-semibold text-sky-700 hover:underline">vehicle request</Link>; split lanes between transporters with <Link to="/tenders/share-rules" className="font-semibold text-sky-700 hover:underline">share rules</Link>.</p>
    <Banner msg={msg} error={error} />
    {list && !list.ready && <NotReady script={SCRIPT_46} />}
    {detail && <Section title="Tender" right={<button onClick={() => setParams({})} className={btnLight}>Close</button>}>
      <TenderBox d={detail} onChanged={() => { void loadOne(); void loadList(); }} onMsg={setMsg} onError={setError} /></Section>}
    {list?.ready && <Section title="Tenders" right={<div className="flex gap-2">
      <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
        <option value="LIVE">Live</option>{Object.entries(TENDER_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}<option value="ALL">All</option></select>
      <select value={kind} onChange={e => setKind(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm">
        <option value="">Every kind</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Tender</th><th className={th}>Request</th><th className={th}>Route</th><th className={th}>Pickup</th><th className={th}>Status</th><th className={th}>Waiting for</th><th className={`${th} text-right`}>Award</th></tr></thead>
        <tbody>{list.tenders.map((t: any) => <tr key={t.id} onClick={() => { setParams({ id: String(t.id) }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`cursor-pointer border-t hover:bg-sky-50 ${t.id === id ? 'bg-sky-50' : ''}`}>
          <td className={td}><b>{t.tenderNo}</b><div className="text-xs text-slate-500">{KIND_LABEL[t.kind]} · {t.offers} offers{t.bids ? `, ${t.bids} bids` : ''}</div></td>
          <td className={td}>{t.requestNo}<div className="text-xs text-slate-500">{t.partnerName}</div></td>
          <td className={td}>{t.originCity} → {t.destinationCity}<div className="text-xs text-slate-500">{fmtWeight(t.loadTons)}</div></td>
          <td className={`${td} whitespace-nowrap`}>{when(t.pickupAt)}</td>
          <td className={td}><span className={pill(t.status)}>{TENDER_LABEL[t.status] || t.status}</span></td>
          <td className={td}>{t.stage}</td>
          <td className={`${td} text-right`}>{t.awardedTransporterName ? <>{t.awardedTransporterName}<div className="font-semibold">{rupees(t.awardedAmount)}</div></> : '-'}</td>
        </tr>)}
          {list.tenders.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No tenders.</td></tr>}</tbody></table></div>
      <p className="mt-2 text-xs text-slate-500">A tender offer waits {list.responseMinutes} minutes for an answer, then goes to the next transporter. Quotes and auctions stay open {list.auctionMinutes} minutes unless a closing time is set; a bid in the last {list.extendMinutes} minutes extends the auction.</p>
    </Section>}
  </>;
}
