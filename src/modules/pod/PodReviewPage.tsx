/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// Proof Review: the office's list of proofs of delivery that need a person.
//   Corrections      REQ-POD-004  corrections waiting for approval (a Manager or an Admin other than the asker approves)
//   Phone proofs     REQ-TRP-011  proofs sent from a phone that wait for the office (held) or clash with a recorded proof
//   Paper notes      REQ-POD-007  paper notes not confirmed yet, and those that differ from the proof
//   Place and time   REQ-POD-002  proofs recorded away from the drop, with a typed time, or with a corrected phone clock
//   Without code     REQ-POD-005  proofs recorded without the receiver's code (with the reason), for the office to check
//   Customer rules   REQ-POD-002 / 005  customers that need the receiver's one-time code or the place, and the drop radius,
//                    and who may record without the code (a Manager, or the driver with a reason)
// Paper notes also holds WhatsApp photos not matched to a delivery yet (REQ-POD-007, script 73): attach or throw away.
// Route /pod/review?tab=corrections|sync|nocode|paper|stamps|rules.
// Backend: PodCorrectionController, PodSyncController, PodCaptureController (/api/pod/review, /api/pod/partner-rules).
// The screen says "Run script 54" until database_v2/54_proof_of_delivery_capture.sql has been applied.
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, Section, btn, btnLight, btnRed, errorText, input, td, th } from '@/shared/components/FormKit';
import { role } from '@/modules/transporter/transporter';
import { AuthPicture, ChangeList, PAPER_SOURCE, shown, when } from './podCapture';

const SCRIPT = 'database_v2/54_proof_of_delivery_capture.sql';
type Row = Record<string, any>;
const TABS: [string, string, string][] = [['corrections', 'Corrections', 'corrections'], ['sync', 'Phone proofs', 'sync'], ['nocode', 'Without code', 'nocode'], ['paper', 'Paper notes', 'paper'], ['stamps', 'Place and time', 'stamps'], ['rules', 'Customer rules', '']];
const tripLink = (r: Row) => (r.tripId ? <Link to={`/trips/${r.tripId}#trip-deliveries`} className="font-semibold text-sky-700 hover:underline">{r.tripNumber || `Trip ${r.tripId}`}</Link> : (r.tripNumber || '-'));
const pill = (text: string, style: string) => <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${style}`}>{text}</span>;
const SYNC: Record<string, [string, string]> = {
  HELD: ['Waiting for the office', 'bg-amber-100 text-amber-800'], CONFLICT: ['Clashes', 'bg-red-100 text-red-800'], APPLIED: ['Recorded', 'bg-emerald-100 text-emerald-800'],
  REJECTED: ['Refused', 'bg-red-100 text-red-800'], DISCARDED: ['Discarded', 'bg-slate-100 text-slate-600'],
};
const FIELD: Record<string, string> = {
  receiverName: 'Receiver', receiverMobile: 'Mobile', receiverDocumentNumber: 'Document no.', deliveredQuantityTons: 'Quantity (T)', temperatureC: 'Temperature (°C)',
  odometerKm: 'Odometer', outcome: 'Outcome', reasonCode: 'Reason', notes: 'Notes', shortage: 'Shortage', damaged: 'Damage',
  otpFallbackReason: 'No code because', otpFallbackNote: 'What happened',   // REQ-POD-005
};
const FALLBACK_RULE: [string, string][] = [['', 'Default'], ['MANAGER', 'A Manager approves'], ['REASON', 'Driver gives the reason']];

function Table({ rows, cols, empty }: { rows: Row[]; cols: [string, (r: Row) => ReactNode][]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
    <thead className="bg-slate-50 text-slate-600"><tr>{cols.map(([h]) => <th key={h} className={th}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={`${r.id ?? r.deliveryId ?? 'x'}-${i}`} className="border-t border-slate-100">{cols.map(([h, f]) => <td key={h} className={td}>{f(r)}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function PodReviewPage() {
  const me = role();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some(t => t[0] === params.get('tab')) ? String(params.get('tab')) : 'corrections';
  const [review, setReview] = useState<Row | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [rules, setRules] = useState<Row | null>(null);
  const [status, setStatus] = useState('');
  const [msg, setMsg] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await api('/api/pod/review?days=30');
      setReview(r);
      if (!r.ready) return;
      if (tab === 'corrections') setRows(await api(`/api/pod/corrections${status ? `?status=${status}` : '?status=PENDING'}`));
      else if (tab === 'sync') setRows(await api(`/api/pod/sync?status=${status || 'HELD,CONFLICT'}`));
      else if (tab === 'rules') setRules(await api('/api/pod/partner-rules'));
    } catch (x) { setError(errorText(x, 'Could not load the proof review')); }
  }, [tab, status]);
  useEffect(() => { void load(); }, [load]);

  async function act(path: string, body: unknown, done: string, method = 'POST') {
    setBusy(true); setMsg(''); setError('');
    try { const r = await api(path, { method, body: JSON.stringify(body ?? {}) }); setMsg(r?.message || done); await load(); }
    catch (x) { setError(errorText(x, 'It could not be done')); }
    finally { setBusy(false); }
  }
  const ask = (q: string, min = 5) => { const r = window.prompt(q); if (r === null) return null; if (r.trim().length < min) { setError(`Write at least ${min} letters.`); return null; } return r.trim(); };

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Proof Review</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;
  const counts = review?.counts || {};
  const tabBtn = ([t, text, key]: [string, string, string]) => <button key={t} type="button" onClick={() => { setStatus(''); setMsg(''); setParams({ tab: t }); }}
    className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === t ? 'bg-sky-700 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{text}{key && Number(counts[key] || 0) > 0 ? ` (${counts[key]})` : ''}</button>;
  const filter = (options: [string, string][]) => <select value={status} onChange={e => setStatus(e.target.value)} className={`${input} w-auto`}>{options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>;

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><ShieldCheck className="h-8 w-8 text-sky-700" />Proof Review</h1>
    <p className="mt-1 text-slate-600">Proofs of delivery that need a person: corrections to approve, proofs from phones, paper notes to confirm, and proofs taken away from the drop.</p>
    {review && !review.ready ? <NotReady script={SCRIPT} /> : <>
      <div className="mt-4 flex flex-wrap gap-2">{TABS.map(tabBtn)}</div>
      <Banner msg={msg} error={error} />

      {tab === 'corrections' && <Section title="Corrections" right={filter([['', 'Waiting for approval'], ['APPROVED', 'Approved'], ['REJECTED', 'Rejected'], ['CANCELLED', 'Cancelled']])}>
        <p className="mb-2 text-sm text-slate-600">A Manager or an Admin approves; not the person who asked. Approval makes a new version of the proof and keeps the old one; the DMR row follows when it is not on a bill yet.</p>
        <Table rows={rows} empty="No correction here." cols={[
          ['Trip', tripLink], ['Proof', r => <>{r.podNumber}<span className="block text-xs text-slate-500">{r.partyName}{r.partnerName ? ` · ${r.partnerName}` : ''}</span></>],
          ['Changes', r => <ChangeList changes={r.changes || []} />],
          ['Why', r => <>{r.reason}<span className="block text-xs text-slate-500">{r.source === 'PAPER_PROOF' ? 'From the paper note' : r.source === 'SYNC_CONFLICT' ? 'From a phone proof' : 'Office'} · {r.requestedBy} · {when(r.requestedAt)}</span></>],
          ['', r => r.status === 'PENDING' ? <div className="flex flex-wrap gap-1">
            {me.manager && <button disabled={busy} className={btnLight} onClick={() => { if (window.confirm('Approve this correction? The proof gets a new version.')) void act(`/api/pod/corrections/${r.id}/approve`, {}, 'Approved.'); }}>Approve</button>}
            {me.manager && <button disabled={busy} className={btnRed} onClick={() => { const note = ask('Why is it rejected?'); if (note) void act(`/api/pod/corrections/${r.id}/reject`, { note }, 'Rejected.'); }}>Reject</button>}
            <button disabled={busy} className={btnLight} onClick={() => { if (window.confirm('Cancel this correction request?')) void act(`/api/pod/corrections/${r.id}/cancel`, {}, 'Cancelled.'); }}>Cancel</button>
          </div> : <span className="text-xs text-slate-600">{r.status === 'APPROVED' ? `Version ${r.versionTo}` : r.status} {r.decidedBy ? `by ${r.decidedBy}` : ''} {when(r.decidedAt)}{r.decisionNote ? `: ${r.decisionNote}` : ''}</span>],
        ]} />
      </Section>}

      {tab === 'sync' && <Section title="Proofs sent from phones" right={filter([['', 'Waiting or clashing'], ['APPLIED', 'Recorded'], ['REJECTED', 'Refused'], ['DISCARDED', 'Discarded'], ['HELD,CONFLICT,APPLIED,REJECTED,DISCARDED', 'All']])}>
        <p className="mb-2 text-sm text-slate-600">A proof saved on a phone without network is sent later. It waits here when the trip was completed or not started meanwhile, or the customer needs a one-time code. It clashes when the drop already has a proof: discard it, or turn the differences into a correction.</p>
        <Table rows={rows} empty="Nothing waits." cols={[
          ['Trip', tripLink], ['Drop', r => <>{r.partyName || `Drop ${r.deliveryId}`}{r.dropPodNumber && <span className="block text-xs text-slate-500">Recorded: {r.dropPodNumber}</span>}</>],
          ['State', r => <>{pill(...(SYNC[r.status] || [r.status, 'bg-slate-100 text-slate-700']))}<span className="mt-1 block text-xs text-slate-600">{r.message}</span></>],
          ['From the phone', r => <><span className="text-xs">{Object.entries(r.fields || {}).filter(([k, v]) => FIELD[k] && v !== '' && v != null && v !== 'false').map(([k, v]) => `${FIELD[k]}: ${shown(v)}`).join(' · ')}</span>
            {(r.files || []).length > 0 && <div className="mt-1 flex flex-wrap gap-1">{r.files.map((f: Row) => <AuthPicture key={f.id} path={`/api/pod/sync/${r.id}/files/${f.id}`} alt={f.kind} className="h-12 w-16 rounded border border-slate-200 object-cover" />)}</div>}</>],
          ['Handover', r => <>{when(r.capturedAt)}<span className="block text-xs text-slate-500">received {when(r.receivedAt)}{r.clockGapSeconds && Math.abs(r.clockGapSeconds) > 120 ? `, phone clock off by ${Math.round(r.clockGapSeconds / 60)} min` : ''} · {r.submittedBy}</span></>],
          ['', r => r.status === 'HELD' || r.status === 'CONFLICT' ? <div className="flex flex-wrap gap-1">
            {r.status === 'HELD' && <button disabled={busy} className={btn} onClick={() => { if (window.confirm('Record this proof of delivery as the phone sent it?')) void act(`/api/pod/sync/${r.id}/apply`, {}, 'Recorded.'); }}>Record</button>}
            {r.status === 'CONFLICT' && <button disabled={busy} className={btnLight} onClick={() => void act(`/api/pod/sync/${r.id}/correction`, {}, 'Correction asked.')}>Make a correction</button>}
            <button disabled={busy} className={btnRed} onClick={() => { const note = ask('Why is it discarded?'); if (note) void act(`/api/pod/sync/${r.id}/discard`, { note }, 'Discarded.'); }}>Discard</button>
          </div> : <span className="text-xs text-slate-600">{r.decidedBy ? `${r.decidedBy} · ${when(r.decidedAt)}` : r.podNumber || ''}</span>],
        ]} />
      </Section>}

      {tab === 'nocode' && <Section title="Proofs recorded without the receiver's code">
        {!review?.fallbackReady ? <p className="text-sm text-amber-800">Recording without the code needs database_v2/73_pod_fallback_paper_intake_offline_sync.sql. Run it on reftech_operational.</p> : <>
          <p className="mb-2 text-sm text-slate-600">When the one-time code could not be used, the proof was recorded with a reason and a note. Call the receiver or check the paper note, then mark it as checked.</p>
          <Table rows={review?.noCode || []} empty="Nothing waits." cols={[
            ['Trip', tripLink], ['Proof', r => <>{r.podNumber}<span className="block text-xs text-slate-500">{r.partyName}{r.partnerName ? ` · ${r.partnerName}` : ''}</span></>],
            ['Receiver', r => <>{r.receiverName}<span className="block text-xs text-slate-500">{r.receiverMobile || 'no mobile'}</span></>],
            ['Why no code', r => <><b>{r.reasonLabel || r.reason}</b><span className="block text-xs text-slate-600">{r.note}</span>{r.approvedBy && <span className="block text-xs text-slate-500">Approved by {r.approvedBy}</span>}</>],
            ['Recorded', r => <>{when(r.deliveredAt)}<span className="block text-xs text-slate-500">{r.recordedBy}{r.capturedOffline ? ' · offline' : ''}</span></>],
            ['', r => r.reviewStatus === 'OPEN' ? <button disabled={busy} className={btnLight} onClick={() => { const note = window.prompt('What did you check? (optional)'); if (note !== null) void act(`/api/pod/deliveries/${r.deliveryId}/otp-review`, { note: note.trim() }, 'Marked as checked.'); }}>Mark as checked</button>
              : <span className="text-xs text-slate-600">Checked by {r.reviewedBy} {when(r.reviewedAt)}{r.reviewNote ? `: ${r.reviewNote}` : ''}</span>],
          ]} />
        </>}
      </Section>}

      {tab === 'paper' && <Section title="Paper notes to check">
        <p className="mb-2 text-sm text-slate-600">Photos of signed paper notes not confirmed yet, and those whose values differ from the proof. Open the trip to confirm the values or ask for a correction. A photo sent by WhatsApp without a POD or trip number that matches waits here until you attach it to its delivery.</p>
        <Table rows={review?.paper || []} empty="Nothing to check." cols={[
          ['Photo', r => <AuthPicture path={`/api/pod/paper/${r.id}/image`} alt="Paper note" className="h-14 w-20 rounded border border-slate-200 object-cover" />],
          ['Trip', r => r.deliveryId ? <>{tripLink(r)}{r.dropSequence ? <span className="block text-xs text-slate-500">Delivery {r.dropSequence}</span> : null}</> : <span className="font-semibold text-amber-800">Not matched</span>],
          ['Proof', r => r.deliveryId ? <>{r.podNumber || 'Not recorded yet'}<span className="block text-xs text-slate-500">{r.partyName}</span></>
            : <>{r.matchNote}{r.messageText && <span className="block text-xs text-slate-500">Message: {r.messageText}</span>}
              <div className="mt-1 flex flex-wrap gap-1">
                <button disabled={busy} className={btnLight} onClick={() => { const ref = window.prompt('POD number or trip number of this paper note'); if (!ref || !ref.trim()) return; const seq = /^\s*POD/i.test(ref) ? '' : window.prompt('Delivery number on the trip (leave empty when the trip has one delivery)') || ''; void act(`/api/pod/paper/${r.id}/attach`, { reference: ref.trim(), dropSequence: seq.trim() || null }, 'Attached.'); }}>Attach</button>
                <button disabled={busy} className={btnRed} onClick={() => { if (window.confirm('Throw this photo away? It is not a paper note of a delivery.')) void act(`/api/pod/paper/${r.id}/discard`, {}, 'Thrown away.'); }}>Throw away</button>
              </div></>],
          ['Read', r => r.ocrStatus === 'DONE' ? 'Read' : r.ocrStatus === 'FAILED' ? 'Could not be read' : r.ocrStatus === 'WAITING' ? 'Being read' : 'Typed by hand'],
          ['Check', r => r.checkResult === 'MISMATCH' ? <span className="font-semibold text-red-700">{r.mismatch}</span> : r.checkResult === 'OPEN_DROP' ? 'Drop not recorded yet' : 'Not confirmed yet'],
          ['Added', r => <>{when(r.uploadedAt)}<span className="block text-xs text-slate-500">{r.uploadedBy}{r.source ? ` · ${PAPER_SOURCE[r.source] || r.source}` : ''}{r.sharpness != null ? ` · sharpness ${Math.round(Number(r.sharpness))}` : ''}</span></>],
        ]} />
      </Section>}

      {tab === 'stamps' && <Section title="Place and time (last 30 days)">
        <p className="mb-2 text-sm text-slate-600">Proofs recorded away from the drop, with a time typed by the user, or from a phone whose clock was wrong. Check them with the driver or the customer.</p>
        <Table rows={review?.stamps || []} empty="Every proof was taken at its drop with the clock time." cols={[
          ['Trip', tripLink], ['Proof', r => <>{r.podNumber}<span className="block text-xs text-slate-500">{r.partyName}{r.partnerName ? ` · ${r.partnerName}` : ''}</span></>],
          ['Place', r => r.placeCheck === 'AWAY' ? <span className="font-semibold text-red-700">{Number(r.placeDistanceM).toLocaleString('en-IN')} m from the drop ({r.placeSource === 'TRUCK_GPS' ? 'truck GPS' : 'phone'})</span> : r.placeCheck === 'OK' ? 'At the drop' : 'Not known'],
          ['Time', r => r.timeSource === 'TYPED' ? <span className="font-semibold text-amber-800">Typed: {when(r.deliveredAt)}, saved {r.timeGapMinutes} min later</span> : r.timeSource === 'DEVICE_CORRECTED' ? <span className="font-semibold text-amber-800">Phone clock corrected: {when(r.deliveredAt)}</span> : when(r.deliveredAt)],
          ['Recorded', r => <>{when(r.savedAt)}<span className="block text-xs text-slate-500">{r.recordedBy}{r.capturedOffline ? ' · offline' : ''}{r.receiverVerified ? ' · code checked' : ''}</span></>],
        ]} />
      </Section>}

      {tab === 'rules' && rules && <Section title="Customer rules">
        <p className="mb-2 text-sm text-slate-600">
          One-time code by SMS: {rules.otpEnabled ? <b>on ({rules.otpProvider})</b> : <b>off on this server</b>}. Reading paper notes: {rules.ocrEnabled ? <b>on</b> : <b>off</b>}.
          {' '}{rules.fallbackReady
            ? <>When the code cannot be used, the proof is recorded with a reason and a note and the office reviews it. For a customer that needs the code, "Without the code" says who may do that: a Manager (the default{rules.fallbackDefault === 'REASON' ? ' on this server is the driver with a reason' : ''}), or the driver with the reason.</>
            : 'A customer that needs the code cannot get a proof without it, except from the office.'}
          {' '}The radius is how far from the drop a proof still counts as at the drop.{!me.manager ? ' Only a Manager or an Admin changes the rules.' : ''}</p>
        <Table rows={rules.partners || []} empty="No customer." cols={[
          ['Customer', r => r.name],
          ['Needs one-time code', r => <input type="checkbox" disabled={!me.manager || busy} checked={Boolean(r.requireOtp)} onChange={e => void act(`/api/pod/partner-rules/${r.id}`, { ...r, requireOtp: e.target.checked }, 'Saved.', 'PUT')} className="h-4 w-4" />],
          ...(rules.fallbackReady ? [['Without the code', (r: Row) => <select disabled={!me.manager || busy || !r.requireOtp} value={r.otpFallback || ''} className={`${input} w-auto`}
            title={r.requireOtp ? '' : 'Only for a customer that needs the code'} onChange={e => void act(`/api/pod/partner-rules/${r.id}`, { ...r, otpFallback: e.target.value || null }, 'Saved.', 'PUT')}>
            {FALLBACK_RULE.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>] as [string, (r: Row) => ReactNode]] : []),
          ['Needs the place', r => <input type="checkbox" disabled={!me.manager || busy} checked={Boolean(r.requirePlace)} onChange={e => void act(`/api/pod/partner-rules/${r.id}`, { ...r, requirePlace: e.target.checked }, 'Saved.', 'PUT')} className="h-4 w-4" />],
          ['Radius (m)', r => <input type="number" min="50" max="5000" step="50" disabled={!me.manager || busy} defaultValue={r.placeRadiusM ?? ''} placeholder="Default" className={`${input} w-28`}
            onBlur={e => { const v = e.target.value.trim(); if (v !== String(r.placeRadiusM ?? '')) void act(`/api/pod/partner-rules/${r.id}`, { ...r, placeRadiusM: v || null }, 'Saved.', 'PUT'); }} />],
          ['Changed', r => r.updatedAt ? <span className="text-xs">{when(r.updatedAt)} · {r.updatedBy}</span> : '-'],
        ]} />
      </Section>}
    </>}
  </>;
}
