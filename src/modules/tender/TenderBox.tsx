/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TAL-004, 005, 006 -- one tender as RefTech staff see it: the offers in line, the answers, every quote or bid
// with the ranking, the award, the truck and driver the transporter gave (with their VAHAN / Sarathi state) and
// the next step: answer for a transporter who phoned, enter a quote, award, make the trip, cancel.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/shared/services/api';
import { btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { role, rupees } from '@/modules/transporter/transporter';
import { when } from '@/modules/allocation/allocation';
import { KIND_LABEL, OFFER_LABEL, TENDER_LABEL, call, pill } from './tender';
import { ScoreBadge } from './ScoreBadge';
import { fmtWeight } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function TenderBox({ d, onChanged, onMsg, onError }: { d: any; onChanged: () => void; onMsg: (m: string) => void; onError: (m: string) => void }) {
  const me = role();
  const t = d.tender;
  const [busy, setBusy] = useState(false);
  const [quoteFor, setQuoteFor] = useState(''), [quoteAmt, setQuoteAmt] = useState('');
  const [awardTo, setAwardTo] = useState(''), [awardNote, setAwardNote] = useState('');
  const auction = t.kind === 'QUOTE' || t.kind === 'AUCTION';
  const open = t.status === 'OPEN';
  const closed = t.closesAt && new Date(t.closesAt).getTime() < Date.now();
  const award = d.award;

  async function run(what: string, f: () => Promise<any>, ok: (r: any) => string) {
    setBusy(true); onError(''); onMsg('');
    try { const r = await f(); onMsg(ok(r)); onChanged(); }
    catch (x) { onError(errorText(x, `Could not ${what}`)); }
    finally { setBusy(false); }
  }
  const answer = (o: any, accept: boolean) => {
    const note = window.prompt(accept ? `Note for ${o.transporterName}'s acceptance (who said yes on the phone):` : `Why did ${o.transporterName} decline?`);
    if (note === null) return;
    void run('record the answer', () => call('POST', `/api/allocation/tenders/offers/${o.id}/${accept ? 'accept' : 'decline'}`, accept ? { note } : { reason: note }),
      () => `${o.transporterName} ${accept ? 'accepted' : 'declined'}.`);
  };
  const cancel = () => {
    const reason = window.prompt(`Why is ${t.tenderNo} cancelled?`);
    if (reason === null) return;
    void run('cancel', () => call('POST', `/api/allocation/tenders/${t.id}/cancel`, { reason }), () => `${t.tenderNo} cancelled.`);
  };

  return <div className="rounded-xl border border-slate-200 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><b>{t.tenderNo}</b> <span className="text-sm text-slate-600">{KIND_LABEL[t.kind] || t.kind}{t.kind === 'TENDER' ? `, ${t.mode === 'BROADCAST' ? 'all at once' : 'one after another'}` : ''}</span>{' '}
        <span className={pill(t.status)}>{TENDER_LABEL[t.status] || t.status}</span>
        <div className="text-sm text-slate-600">{t.stage}{t.requestNo ? <> · <Link to={`/vehicle-requests?id=${t.vehicleRequestId}`} className="font-semibold text-sky-700 hover:underline">{t.requestNo}</Link> {t.originCity} → {t.destinationCity}, {fmtWeight(t.loadTons)}, pickup {when(t.pickupAt)}</> : null}</div>
        {auction && <div className="text-xs text-slate-500">Closes {when(t.closesAt)}{t.ceilingAmount ? ` · ceiling ${rupees(t.ceilingAmount)}` : ''}{t.minStepAmount ? ` · each bid ${rupees(t.minStepAmount)} lower` : ''}{t.extendMinutes ? ` · +${t.extendMinutes} min on a late bid` : ''}</div>}
        {t.cancelReason && <div className="text-xs text-slate-500">{t.cancelReason}</div>}
      </div>
      {me.manager && (open || (t.status === 'AWARDED' && !t.closedAt)) && <button disabled={busy} onClick={cancel} className={btnRed}>Cancel {t.status === 'AWARDED' ? 'award' : 'tender'}</button>}
    </div>

    <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
      <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>#</th><th className={th}>Transporter</th><th className={th}>Score</th><th className={`${th} text-right`}>Amount</th><th className={th}>Status</th><th className={th}>Answer</th><th className={th}></th></tr></thead>
      <tbody>{d.offers.map((o: any) => <tr key={o.id} className="border-t">
        <td className={td}>{o.seq}</td>
        <td className={td}><b>{o.transporterName}</b>{o.contractNo && <div className="text-xs text-slate-500">{o.contractNo}</div>}</td>
        <td className={td}><ScoreBadge score={o.score} /></td>
        <td className={`${td} text-right`}>{rupees(o.amount)}{o.rateSource && <div className="text-xs text-slate-500">{o.rateSource === 'CONTRACT' ? 'contract' : o.rateSource === 'BID' ? 'bid' : 'typed'}</div>}</td>
        <td className={td}><span className={pill(o.status)}>{OFFER_LABEL[o.status] || o.status}</span>{o.status === 'SENT' && o.expiresAt && <div className="text-xs text-slate-500">till {when(o.expiresAt)}</div>}</td>
        <td className={`${td} text-xs`}>{o.respondedAt ? <>{when(o.respondedAt)} {o.via ? `(${o.via.toLowerCase()})` : ''}<div>{o.responseNote}</div></> : '-'}</td>
        <td className={`${td} whitespace-nowrap text-right`}>{o.status === 'SENT' && <>
          <button disabled={busy} onClick={() => answer(o, true)} className={btnLight}>Accepted</button>{' '}
          <button disabled={busy} onClick={() => answer(o, false)} className={btnLight}>Declined</button></>}</td>
      </tr>)}</tbody></table></div>

    {auction && <div className="mt-3">
      <h4 className="font-bold">Ranking <span className="text-sm font-normal text-slate-500">({d.bids.length} {t.kind === 'AUCTION' ? 'bids' : 'quotes'})</span></h4>
      <table className="mt-1 w-full text-sm"><thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Rank</th><th className={th}>Transporter</th><th className={`${th} text-right`}>Latest price</th><th className={th}>When</th></tr></thead>
        <tbody>{d.ranking.map((r: any) => <tr key={r.transporterId} className="border-t"><td className={td}>{r.rank}</td><td className={td}>{r.transporterName}</td>
          <td className={`${td} text-right font-semibold`}>{rupees(r.amount)}</td><td className={td}>{when(r.placedAt)}</td></tr>)}
          {d.ranking.length === 0 && <tr><td colSpan={4} className={`${td} text-slate-500`}>No price yet.</td></tr>}</tbody></table>
      {open && <div className="mt-2 grid gap-2 md:grid-cols-4">
        <div><label className={label}>Quote given on the phone</label><select value={quoteFor} onChange={e => setQuoteFor(e.target.value)} className={input}><option value="">Transporter</option>
          {d.offers.filter((o: any) => o.status === 'INVITED').map((o: any) => <option key={o.transporterId} value={o.transporterId}>{o.transporterName}</option>)}</select></div>
        <div><label className={label}>Amount (₹)</label><input type="number" min="1" value={quoteAmt} onChange={e => setQuoteAmt(e.target.value)} className={input} /></div>
        <div className="flex items-end"><button disabled={busy || !quoteFor || !(Number(quoteAmt) > 0)} className={btnLight}
          onClick={() => void run('enter the quote', () => call('POST', `/api/allocation/tenders/${t.id}/bids`, { transporterId: Number(quoteFor), amount: Number(quoteAmt), note: 'Entered by RefTech' }), () => 'Quote entered.')}>Enter quote</button></div>
      </div>}
      {open && me.manager && d.ranking.length > 0 && (t.kind === 'QUOTE' || closed) && <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 md:grid-cols-4">
        <div><label className={label}>Award to</label><select value={awardTo} onChange={e => setAwardTo(e.target.value)} className={input}><option value="">Lowest: {d.ranking[0].transporterName}</option>
          {d.ranking.slice(1).map((r: any) => <option key={r.transporterId} value={r.transporterId}>{r.transporterName} ({rupees(r.amount)})</option>)}</select></div>
        {awardTo && <div className="md:col-span-2"><label className={label}>Why not the lowest <span className="text-red-600">*</span></label><input value={awardNote} onChange={e => setAwardNote(e.target.value)} className={input} placeholder="Better score on this lane, reefer trucks nearer the pickup" /></div>}
        <div className="flex items-end"><button disabled={busy || (!!awardTo && awardNote.trim().length < 10)} className={btn}
          onClick={() => void run('award', () => call('POST', `/api/allocation/tenders/${t.id}/award`, { transporterId: Number(awardTo || d.ranking[0].transporterId), note: awardNote }), () => 'Awarded. The transporter now gives the truck and driver.')}>Award</button></div>
      </div>}
      {open && t.kind === 'AUCTION' && !closed && <p className="mt-2 text-xs text-slate-500">The auction is awarded after it closes.</p>}
    </div>}

    {award && <Award t={t} a={award} busy={busy} run={run} />}
  </div>;
}

function Award({ t, a, busy, run }: { t: any; a: any; busy: boolean; run: (w: string, f: () => Promise<any>, ok: (r: any) => string) => Promise<void> }) {
  const [fleet, setFleet] = useState<any>(null), [vehicleId, setVehicleId] = useState(''), [driverId, setDriverId] = useState('');
  const [ack, setAck] = useState(false), [reason, setReason] = useState('');
  useEffect(() => { if (!t.closedAt && !t.tripId) api(`/api/transporters/verification/${a.transporterId}`).then(setFleet).catch(() => setFleet(null)); }, [a.transporterId, t.closedAt, t.tripId]);
  const problems: string[] = a.verificationProblems || [];
  return <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm">
    <div><b>Awarded to {a.transporterName}</b> at <b>{rupees(a.amount)}</b> by {t.awardedByName} on {when(t.awardedAt)}{t.awardNote ? ` (${t.awardNote})` : ''}</div>
    {a.vehicleId
      ? <div className="mt-1">Truck <b>{a.vehicleNumber}</b>, driver <b>{a.driverName || '-'}</b>{a.driverMobile ? ` (${a.driverMobile})` : ''}, given {when(a.truckGivenAt)} by {a.truckGivenByName}</div>
      : <div className="mt-1 text-amber-800">Waiting for the transporter to name the truck and driver (on the portal, or enter them here).</div>}
    {problems.length > 0 && <div className="mt-1 text-red-700">Not verified: {problems.join('; ')}</div>}
    {(a.verificationWarnings || []).length > 0 && <div className="mt-1 text-amber-700">{a.verificationWarnings.join('; ')}</div>}
    {t.tripId && <div className="mt-1"><Link to={`/trips/${t.tripId}`} className="font-semibold text-sky-700 hover:underline">Trip {t.tripNumber} →</Link></div>}
    {!t.closedAt && !t.tripId && <>
      {fleet?.trucks && <div className="mt-2 grid gap-2 md:grid-cols-4">
        <select value={vehicleId} onChange={e => setVehicleId(e.target.value)} className={input}><option value="">{a.vehicleId ? 'Change truck' : 'Truck'}</option>
          {fleet.trucks.map((v: any) => <option key={v.id} value={v.id}>{v.vehicleNumber} ({v.verification?.result})</option>)}</select>
        <select value={driverId} onChange={e => setDriverId(e.target.value)} className={input}><option value="">Driver</option>
          {fleet.drivers.filter((x: any) => x.active).map((x: any) => <option key={x.id} value={x.id}>{x.name} ({x.verification?.result})</option>)}</select>
        <button disabled={busy || !vehicleId || !driverId} className={btnLight}
          onClick={() => void run('give the truck', () => call('POST', `/api/allocation/tenders/offers/${a.id}/truck`, { vehicleId: Number(vehicleId), transporterDriverId: Number(driverId) }), () => 'Truck and driver recorded.')}>Give truck for the transporter</button>
      </div>}
      {a.canMakeTrip && <div className="mt-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} />Weather warnings seen (only when Make trip asks for it)</label>
        {ack && <input value={reason} onChange={e => setReason(e.target.value)} className={`${input} mt-1`} placeholder="Why the trip must run" />}
        <button disabled={busy || problems.length > 0} className={`${btn} mt-2`}
          onClick={() => void run('make the trip', () => call('POST', `/api/allocation/requests/${t.vehicleRequestId}/make-trip`, ack ? { weatherAcknowledged: true, weatherReason: reason } : {}), r => r.message || `Trip ${r.tripNumber} made.`)}>Make trip</button>
      </div>}
      <button disabled={busy} className={`${btnLight} mt-2`} onClick={() => {
        const reason = window.prompt(`${a.transporterName} gives the load back. Reason:`);
        if (reason !== null) void run('record the give-back', () => call('POST', `/api/allocation/tenders/offers/${a.id}/give-back`, { reason }), () => 'Load given back. The next transporter in line gets it.');
      }}>Transporter gave it back</button>
    </>}
  </div>;
}
