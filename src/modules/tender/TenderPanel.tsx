/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-004, 005, 006 -- on an open vehicle request: send the load to transporters (one after another, or to all
// at once), ask for spot quotes or run a reverse auction, or give it by the lane's contract share rule. Shows the
// live tender with its offers, bids and award, and the past tenders of the request.
import { useCallback, useEffect, useState } from 'react';
import { errorText, input, label, td, th, btn, btnLight } from '@/shared/components/FormKit';
import { api } from '@/shared/services/api';
import { rupees } from '@/modules/transporter/transporter';
import { when, iso } from '@/modules/allocation/allocation';
import { KIND_LABEL, SCRIPT_46, TENDER_LABEL, call, pill } from './tender';
import { TenderBox } from './TenderBox';
import { ScoreBadge } from './ScoreBadge';

export function TenderPanel({ requestId, onChanged, onMsg, onError }: { requestId: number; onChanged: () => void; onMsg: (m: string) => void; onError: (m: string) => void }) {
  const [d, setD] = useState<any>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [how, setHow] = useState<'TENDER' | 'QUOTE' | 'AUCTION'>('TENDER');
  const [mode, setMode] = useState('WATERFALL'), [minutes, setMinutes] = useState(''), [amount, setAmount] = useState('');
  const [closesAt, setClosesAt] = useState(''), [ceiling, setCeiling] = useState(''), [step, setStep] = useState(''), [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setD(await api(`/api/allocation/requests/${requestId}/tender`)); }
    catch (x) { setD({ error: errorText(x, 'Could not read the tenders of this request') }); }
  }, [requestId]);
  useEffect(() => { void load(); setPicked([]); }, [load]);
  const changed = () => { void load(); onChanged(); };

  if (!d) return null;
  if (d.error) return <p className="mt-3 text-sm text-red-700">{d.error}</p>;
  if (!d.ready) return <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Tenders, quotes and auctions need the database script <b>{SCRIPT_46}</b>.</p>;

  const cands: any[] = d.candidates || [];
  const toggle = (id: number) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const needAmount = how === 'TENDER' && picked.some(id => cands.find(c => c.transporterId === id)?.contractEstimate == null);

  async function start() {
    setBusy(true); onMsg(''); onError('');
    try {
      const r = how === 'TENDER'
        ? await call('POST', `/api/allocation/requests/${requestId}/tender`, { transporterIds: picked, mode, responseMinutes: minutes ? Number(minutes) : undefined, amount: amount ? Number(amount) : undefined, notes })
        : await call('POST', `/api/allocation/requests/${requestId}/quotes`, { kind: how, transporterIds: picked, closesAt: closesAt ? iso(closesAt) : undefined, minutes: !closesAt && minutes ? Number(minutes) : undefined,
            ceilingAmount: ceiling ? Number(ceiling) : undefined, minStepAmount: step ? Number(step) : undefined, notes });
      onMsg(r.message || `${r.tender?.tenderNo || 'Tender'} started.`); setPicked([]); changed();
    } catch (x) { onError(errorText(x, 'Could not start')); }
    finally { setBusy(false); }
  }
  async function share() {
    setBusy(true); onMsg(''); onError('');
    try { const r = await call('POST', `/api/allocation/requests/${requestId}/share`); onMsg(r.message || 'Given by the share rule.'); changed(); }
    catch (x) { onError(errorText(x, 'Could not give the load by the share rule')); }
    finally { setBusy(false); }
  }

  return <div>
    {d.live && <div className="mt-2"><TenderBox d={d.live} onChanged={changed} onMsg={onMsg} onError={onError} /></div>}

    {!d.live && d.candidates && <>
      {d.share && <div className="mt-2 rounded-xl bg-violet-50 p-3 text-sm">
        <b>Share rule {d.share.rule.ruleName}</b> ({d.share.rule.periodFrom} to {d.share.rule.periodTo}): {d.share.rule.lines.map((l: any) => `${l.transporterName} ${Number(l.sharePercent)}% (${l.loadsGiven} given)`).join(', ')}
        <div className="mt-1">{d.share.next ? <>Next: <b>{d.share.next.transporterName}</b>. {d.share.next.why}</> : 'No transporter of the rule can take this load now.'}</div>
        {d.share.next && <button disabled={busy} onClick={() => void share()} className={`${btn} mt-2`}>Give by share rule</button>}
      </div>}

      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600"><th className={th}></th><th className={th}>Transporter</th><th className={th}>Score</th><th className={`${th} text-right`}>Contract freight</th><th className={th}>Lane</th><th className={th}>Trucks big enough</th><th className={th}>Portal</th></tr></thead>
        <tbody>{cands.map(c => <tr key={c.transporterId} onClick={() => toggle(c.transporterId)} className={`cursor-pointer border-t hover:bg-sky-50 ${picked.includes(c.transporterId) ? 'bg-sky-50' : ''}`}>
          <td className={td}><input type="checkbox" readOnly checked={picked.includes(c.transporterId)} />{picked.includes(c.transporterId) && <span className="ml-1 text-xs font-bold text-sky-700">{picked.indexOf(c.transporterId) + 1}</span>}</td>
          <td className={td}><b>{c.transporterName}</b></td><td className={td}><ScoreBadge score={c.score} /></td>
          <td className={`${td} text-right`}>{rupees(c.contractEstimate)}{c.contractNo && <div className="text-xs text-slate-500">{c.contractNo}</div>}</td>
          <td className={td}>{c.servesLane ? 'Serves it' : '-'}</td><td className={td}>{c.trucksBigEnough}</td><td className={td}>{c.hasPortalLogin ? 'Yes' : 'Phone'}</td>
        </tr>)}
          {cands.length === 0 && <tr><td colSpan={7} className={`${td} text-slate-500`}>No approved transporter.</td></tr>}</tbody></table></div>
      <p className="mt-1 text-xs text-slate-500">Tick transporters in the order they should get the load. For quotes or an auction, ticking none invites every transporter on the lane or with a contract rate.</p>

      <div className="mt-2 flex flex-wrap gap-2">{(['TENDER', 'QUOTE', 'AUCTION'] as const).map(k => <button key={k} onClick={() => setHow(k)}
        className={`rounded-full px-4 py-1.5 text-sm font-semibold ${how === k ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700'}`}>{KIND_LABEL[k]}</button>)}</div>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        {how === 'TENDER' ? <>
          <div><label className={label}>Send</label><select value={mode} onChange={e => setMode(e.target.value)} className={input}><option value="WATERFALL">One after another</option><option value="BROADCAST">To all at once</option></select></div>
          <div><label className={label}>Minutes to answer</label><input type="number" min="5" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder={String(d.responseMinutes)} className={input} /></div>
          <div><label className={label}>Freight offered (₹){needAmount && <span className="text-red-600"> *</span>}</label><input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Contract rate when there is one" className={input} /></div>
        </> : <>
          <div><label className={label}>Closes at</label><input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} className={input} /></div>
          {!closesAt && <div><label className={label}>or open for minutes</label><input type="number" min="5" value={minutes} onChange={e => setMinutes(e.target.value)} placeholder={String(d.auctionMinutes)} className={input} /></div>}
          <div><label className={label}>Ceiling (₹)</label><input type="number" min="1" value={ceiling} onChange={e => setCeiling(e.target.value)} className={input} /></div>
          {how === 'AUCTION' && <div><label className={label}>Each bid lower by (₹)</label><input type="number" min="1" value={step} onChange={e => setStep(e.target.value)} className={input} /></div>}
        </>}
        <div className="md:col-span-3"><label className={label}>Notes for the transporters</label><input value={notes} onChange={e => setNotes(e.target.value)} className={input} /></div>
        <div className="flex items-end"><button disabled={busy || (how === 'TENDER' && picked.length === 0) || (needAmount && !(Number(amount) > 0))} onClick={() => void start()} className={btn}>
          {how === 'TENDER' ? 'Send tender' : how === 'QUOTE' ? 'Ask for quotes' : 'Start auction'}</button></div>
      </div>
    </>}

    {d.history?.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">Tenders of this request ({d.history.length})</summary>
      <table className="mt-1 w-full text-sm"><tbody>{d.history.map((h: any) => <tr key={h.id} className="border-t">
        <td className={td}>{h.tenderNo}</td><td className={td}>{KIND_LABEL[h.kind]}</td><td className={td}><span className={pill(h.status)}>{TENDER_LABEL[h.status]}</span></td>
        <td className={td}>{h.awardedTransporterName ? `${h.awardedTransporterName} ${rupees(h.awardedAmount)}` : h.cancelReason || ''}</td><td className={td}>{when(h.createdAt)}</td></tr>)}</tbody></table>
      <button onClick={() => void load()} className={`${btnLight} mt-1`}>Refresh</button></details>}
  </div>;
}
