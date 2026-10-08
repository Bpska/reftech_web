/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-012 -- transporter scorecard: placement on time, delivery on time, temperature kept, trips without a claim
// and acceptance of tenders, weighted into a score and a grade (A 90+, B 75+, C 60+, D). A transporter with fewer
// trips than app.tal.score.min-trips is NEW. The same grade shows on the vehicle request and tender screens.
//
// Backend: ScorecardController (/api/transporters/scorecard).
import { useCallback, useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { pill } from '@/modules/tender/tender';
import { FREIGHT_SCRIPT, role } from './transporter';

export function ScorecardPage() {
  const me = role();
  const [from, setFrom] = useState(''), [to, setTo] = useState('');
  const [d, setD] = useState<any>(null), [error, setError] = useState('');
  const load = useCallback(async () => {
    const p = new URLSearchParams(); if (from) p.set('from', from); if (to) p.set('to', to);
    try { setD(await api(`/api/transporters/scorecard?${p}`)); } catch (x) { setError(errorText(x, 'Could not load the scorecard')); }
  }, [from, to]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Scorecard</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  const cards: any[] = (d?.scorecards || []).filter((c: any) => c.trips > 0 || c.offersAnswered > 0);
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Award className="h-8 w-8 text-sky-700" />Transporter scorecard</h1>
    <p className="text-slate-600">From the trips given to each transporter{d?.days ? ` (last ${d.days} days unless dates are chosen)` : ''}.</p>
    <Banner error={error} />
    <div className="mt-2 flex flex-wrap gap-3"><div><label className={label}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} className={input} /></div>
      <div><label className={label}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} className={input} /></div></div>
    {d && d.ready === false && <NotReady script={FREIGHT_SCRIPT} />}
    {d?.ready && <Section title="Transporters">
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Transporter</th><th className={th}>Grade</th><th className={th}>Trips</th>
          {(cards[0]?.parts || []).map((p: any) => <th key={p.key} className={th}>{p.label}<div className="text-xs font-normal">weight {p.weight}</div></th>)}
          <th className={th}>Declined / timed out / gave back</th><th className={th}>Truck changes</th></tr></thead>
        <tbody>{cards.map(c => <tr key={c.transporterId} className="border-t">
          <td className={td}><b>{c.transporterName}</b><div className="text-xs text-slate-500">{c.summary}</div></td>
          <td className={td}><span className={pill(c.grade)}>{c.grade}{c.score != null ? ` ${Number(c.score)}` : ''}</span></td>
          <td className={td}>{c.trips}<div className="text-xs text-slate-500">{c.completed} completed</div></td>
          {c.parts.map((p: any) => <td key={p.key} className={td}>{p.percent == null ? '-' : `${Number(p.percent)}%`}<div className="text-xs text-slate-500">{p.good} of {p.of}</div></td>)}
          <td className={td}>{c.offersDeclined} / {c.offersTimedOut} / {c.loadsGivenBack}</td><td className={td}>{c.truckChanges}</td>
        </tr>)}
          {cards.length === 0 && <tr><td colSpan={10} className={`${td} text-slate-500`}>No trips with hired trucks in this period.</td></tr>}</tbody></table></div>
    </Section>}
  </>;
}
