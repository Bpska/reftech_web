/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// The parts of the proof of delivery panel (TripDeliveriesPanel) that came with the capture requirements:
//   REQ-POD-002  Place and time stamp: the phone's position when the form opens; shown with the distance to the drop
//   REQ-POD-005  Receiver one-time code: send a code to the receiver's mobile, the receiver tells it, it is checked
//   REQ-POD-007  Paper proof by photo with OCR: photo of the signed paper note, values read, staff confirm and compare
//   REQ-POD-004  Correction with approval and versions: ask for a correction, see the versions
//   REQ-TRP-011  Proofs kept in this browser while the network is down, and what became of them
// Backend: PodCaptureController, PodCorrectionController, PodSyncController.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { CloudOff, FileText, History, KeyRound, MapPin } from 'lucide-react';
import { api } from '@/shared/services/api';
import { btn, btnLight, btnRed, errorText, input, label } from '@/shared/components/FormKit';
import { flush, forget, onQueueChange, queued, QueuedCapture } from './podOffline';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const API_URL = import.meta.env.VITE_API_URL;
const authHeader = (): Record<string, string> => { const t = localStorage.getItem('reftech_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };
export const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
type Msg = { ok: boolean; text: string } | null;
const Note = ({ msg }: { msg: Msg }) => msg ? <p role="status" className={`mt-2 rounded-xl p-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p> : null;

/** A picture is fetched with the sign-in token and shown from memory. */
export function AuthPicture({ path, alt, className }: { path: string; alt: string; className: string }) {
  const [src, setSrc] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = '', gone = false;
    fetch(`${API_URL}${path}`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => { if (gone) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return src ? <a href={src} target="_blank" rel="noreferrer" title="Open in a new tab"><img src={src} alt={alt} className={className} /></a>
    : <div className={`${className} flex items-center justify-center bg-slate-50 text-xs text-slate-500`}>{failed ? 'Could not be loaded' : 'Loading...'}</div>;
}

// ------------------------------------------------------------------ REQ-POD-002 place and time

export type Fix = { latitude: number; longitude: number; accuracyM: number | null; at: string };
export type GeoState = { fix: Fix | null; status: 'WAITING' | 'OK' | 'DENIED' | 'NONE' };

/** Asks the browser for the position once when the proof form opens. No position is not an error: the truck's GPS is used. */
export function usePosition(active: boolean): GeoState {
  const [state, setState] = useState<GeoState>({ fix: null, status: 'WAITING' });
  useEffect(() => {
    if (!active) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setState({ fix: null, status: 'NONE' }); return; }
    let gone = false;
    setState({ fix: null, status: 'WAITING' });
    navigator.geolocation.getCurrentPosition(
      p => { if (!gone) setState({ status: 'OK', fix: { latitude: p.coords.latitude, longitude: p.coords.longitude, accuracyM: p.coords.accuracy ? Math.round(p.coords.accuracy) : null, at: new Date(p.timestamp).toISOString() } }); },
      e => { if (!gone) setState({ fix: null, status: e.code === e.PERMISSION_DENIED ? 'DENIED' : 'NONE' }); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
    return () => { gone = true; };
  }, [active]);
  return state;
}

export function PositionLine({ geo, required }: { geo: GeoState; required?: boolean }) {
  const text = geo.status === 'OK' && geo.fix ? `Place recorded: ${geo.fix.latitude.toFixed(5)}, ${geo.fix.longitude.toFixed(5)}${geo.fix.accuracyM ? ` (within ${geo.fix.accuracyM} m)` : ''}`
    : geo.status === 'WAITING' ? 'Finding the place of the handover...'
      : geo.status === 'DENIED' ? 'The browser may not share the position. The truck\'s GPS is used instead.'
        : 'This device gives no position. The truck\'s GPS is used instead.';
  return <p data-testid="pod-place" className={`flex items-center gap-1 text-xs ${geo.status === 'OK' ? 'text-emerald-800' : required && geo.status !== 'WAITING' ? 'font-semibold text-amber-800' : 'text-slate-500'}`}>
    <MapPin className="h-3.5 w-3.5 shrink-0" />{text}{required && geo.status !== 'OK' && geo.status !== 'WAITING' ? ' This customer needs the place: allow the position, or the truck must have a GPS point.' : ''}</p>;
}

export type Stamped = {
  placeLatitude?: number | null; placeLongitude?: number | null; placeAccuracyM?: number | null; placeSource?: string | null; placeDistanceM?: number | null; placeCheck?: string | null;
  timeSource?: string | null; timeGapMinutes?: number | null; receiverVerified?: string | null; receiverVerifiedAt?: string | null; podVersion?: number | null;
  correctedAt?: string | null; correctedBy?: string | null; capturedOffline?: boolean | null; correctionPending?: boolean | null; paperCount?: number | null; signatureSha256?: string | null;
  // REQ-POD-005: recorded without the receiver's code (script 73)
  otpFallbackReason?: string | null; otpFallbackLabel?: string | null; otpFallbackNote?: string | null; otpFallbackApprovedBy?: string | null;
  otpReviewStatus?: 'OPEN' | 'CHECKED' | null; otpReviewedBy?: string | null; otpReviewedAt?: string | null; otpReviewNote?: string | null;
};
const SOURCE: Record<string, string> = { DEVICE: 'the phone', TRUCK_GPS: 'the truck GPS', NONE: 'no position' };
const TIME: Record<string, string> = { SERVER: 'server clock at saving', TYPED: 'typed by the user', DEVICE: 'phone clock', DEVICE_CORRECTED: 'phone clock, corrected' };

/** The place and time stamp of a recorded drop, the receiver check and the version. */
export function StampFacts({ d }: { d: Stamped }) {
  const dt = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
  const place = d.placeCheck == null ? null
    : d.placeSource === 'NONE' || d.placeLatitude == null ? 'No position'
      : `${Number(d.placeLatitude).toFixed(5)}, ${Number(d.placeLongitude).toFixed(5)} from ${SOURCE[d.placeSource || ''] || d.placeSource}${d.placeDistanceM != null ? `, ${Number(d.placeDistanceM).toLocaleString('en-IN')} m from the drop` : ''}`;
  return <>
    {place && <div><dt className={dt}>Place of handover</dt><dd data-testid="drop-place" className={`font-semibold ${d.placeCheck === 'AWAY' ? 'text-red-700' : 'text-slate-900'}`}>{place}{d.placeCheck === 'AWAY' ? ' (away from the drop)' : d.placeCheck === 'OK' ? ' (at the drop)' : ''}
      {d.placeLatitude != null && d.placeSource !== 'NONE' && <a className="ml-2 text-sm font-bold text-sky-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${d.placeLatitude},${d.placeLongitude}`}>Map</a>}</dd></div>}
    {d.timeSource && <div><dt className={dt}>Time from</dt><dd className={`font-semibold ${d.timeSource === 'SERVER' || d.timeSource === 'DEVICE' ? 'text-slate-900' : 'text-amber-800'}`}>{TIME[d.timeSource] || d.timeSource}{d.timeGapMinutes ? ` (${d.timeGapMinutes} min before saving)` : ''}{d.capturedOffline ? ', recorded offline' : ''}</dd></div>}
    {d.receiverVerified != null || d.timeSource ? <div><dt className={dt}>Receiver confirmed</dt><dd data-testid="drop-verified" className="font-semibold text-slate-900">{d.receiverVerified === 'FALLBACK'
      ? <>{/* REQ-POD-005 */}<span className="text-amber-800">Without the code: {d.otpFallbackLabel || d.otpFallbackReason}</span>
        {d.otpFallbackNote && <span className="block font-normal text-slate-700">{d.otpFallbackNote}</span>}
        <span className="block text-xs font-normal text-slate-500">{d.otpFallbackApprovedBy ? `Approved by ${d.otpFallbackApprovedBy}. ` : ''}{d.otpReviewStatus === 'CHECKED' ? `Checked by the office${d.otpReviewedBy ? ` (${d.otpReviewedBy}, ${when(d.otpReviewedAt)})` : ''}${d.otpReviewNote ? `: ${d.otpReviewNote}` : ''}` : 'Waiting for the office to review.'}</span></>
      : d.receiverVerified ? `Yes, by one-time code${d.receiverVerifiedAt ? ` ${when(d.receiverVerifiedAt)}` : ''}` : 'No code'}</dd></div> : null}
    {d.podVersion != null && <div><dt className={dt}>Version</dt><dd data-testid="drop-version" className="font-semibold text-slate-900">{d.podVersion}{d.correctedAt ? ` (corrected ${when(d.correctedAt)}${d.correctedBy ? ` by ${d.correctedBy}` : ''})` : ''}{d.correctionPending ? <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">Correction waiting</span> : null}</dd></div>}
  </>;
}

// ------------------------------------------------------------------ REQ-POD-005 receiver one-time code

export type OtpInfo = { sentTo?: string; status?: string; expiresAt?: string } | null;

/** Send a code to the receiver's mobile and check the code the receiver tells. onVerified gets the checked code. */
export function OtpBlock({ base, deliveryId, mobile, required, latest, onVerified }: { base: string; deliveryId: number; mobile: string; required: boolean; latest?: OtpInfo; onVerified: (code: string) => void }) {
  const [code, setCode] = useState(''), [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(latest?.status === 'SENT' ? latest.sentTo || '' : null), [ok, setOk] = useState(latest?.status === 'VERIFIED');
  async function send() {
    setBusy(true); setMsg(null);
    try {
      const r = await api(`${base}/deliveries/${deliveryId}/otp`, { method: 'POST', body: JSON.stringify({ mobile: mobile.trim() }) });
      setSent(r.sentTo || ''); setOk(false); setCode('');
      setMsg({ ok: true, text: `${r.message || 'Code sent.'}${r.testCode ? ` Test code: ${r.testCode}` : ''}` });
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The code could not be sent') }); }
    finally { setBusy(false); }
  }
  async function check(e?: FormEvent) {
    e?.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await api(`${base}/deliveries/${deliveryId}/otp/verify`, { method: 'POST', body: JSON.stringify({ code: code.trim() }) });
      setOk(Boolean(r.verified)); setMsg({ ok: Boolean(r.verified), text: r.message || (r.verified ? 'Confirmed.' : 'Wrong code.') });
      if (r.verified) onVerified(code.trim());
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The code could not be checked') }); }
    finally { setBusy(false); }
  }
  return <div data-testid="pod-otp" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="flex items-center gap-1 text-sm font-semibold text-slate-800"><KeyRound className="h-4 w-4" />Receiver one-time code{required ? ' *' : ''}</p>
    <p className="mt-0.5 text-xs text-slate-600">{required ? 'This customer needs it: a code goes to the receiver\'s mobile and the receiver tells it to you.' : 'Optional: confirms that the receiver is the person on the mobile number.'}</p>
    {ok ? <p className="mt-2 text-sm font-bold text-emerald-800">The receiver is confirmed{sent ? ` (${sent})` : ''}.</p>
      : <div className="mt-2 flex flex-wrap items-end gap-2">
        <button type="button" disabled={busy || !mobile.trim()} onClick={() => { void send(); }} className={btnLight} title={mobile.trim() ? '' : 'Enter the receiver mobile first'}>{sent !== null ? 'Send again' : 'Send code'}</button>
        {sent !== null && <>
          <input aria-label="One-time code" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6 digits" className={`${input} w-32 font-mono`} />
          <button type="button" disabled={busy || code.length !== 6} onClick={() => { void check(); }} className={btnLight}>Check code</button>
        </>}
      </div>}
    <Note msg={msg} />
  </div>;
}

// ------------------------------------------------------------------ REQ-POD-005 the code cannot be used

export type FallbackReason = { code: string; label: string };

/**
 * When the receiver's code cannot be used: a reason from the list and a note. needsManager: the customer needs the
 * code and the person recording is not a Manager, so the proof goes to the office and a Manager records it.
 */
export function OtpFallbackBlock({ reasons, required, needsManager, open, reason, note, onOpen, onReason, onNote }: {
  reasons: FallbackReason[]; required: boolean; needsManager: boolean; open: boolean; reason: string; note: string;
  onOpen: (open: boolean) => void; onReason: (v: string) => void; onNote: (v: string) => void;
}) {
  return <div data-testid="pod-otp-fallback" className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
    <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input type="checkbox" checked={open} onChange={e => onOpen(e.target.checked)} className="h-4 w-4" />The code cannot be used</label>
    {!open && <p className="mt-0.5 text-xs text-slate-600">{required ? 'Tick this when the receiver has no phone, the SMS did not come, the tries ran out or the receiver will not give it.' : 'Optional. Tick it to tell the office why the code was not used.'}</p>}
    {open && <div className="mt-2 grid gap-2 md:grid-cols-3">
      <div><label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="pod-otp-reason">Why *</label>
        <select id="pod-otp-reason" value={reason} onChange={e => onReason(e.target.value)} className={input}>
          <option value="">Choose the reason</option>
          {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select></div>
      <div className="md:col-span-2"><label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="pod-otp-note">What happened *</label>
        <input id="pod-otp-note" value={note} onChange={e => onNote(e.target.value)} maxLength={500} className={input} placeholder="For example: SMS not received after two tries; receiver showed his ID card" /></div>
      <p className="text-xs font-semibold text-amber-900 md:col-span-3">{needsManager
        ? 'This customer needs the code. Without it a Manager must approve: the proof is sent to the office and waits on Proof review until a Manager records it.'
        : 'The proof is recorded without the code and the office reviews it.'}</p>
    </div>}
  </div>;
}

// ------------------------------------------------------------------ REQ-POD-007 paper proof

type Values = { documentNumber?: string; receiverName?: string; receiverMobile?: string; quantityTons?: string; date?: string };
type Paper = {
  id: number; fileName?: string; sizeBytes?: number; ocrStatus: 'WAITING' | 'DONE' | 'FAILED' | 'MANUAL'; ocrText?: string | null; ocrConfidence?: number | null; ocrError?: string | null;
  found?: Values | null; confirmed?: Values | null; checkResult?: 'MATCH' | 'MISMATCH' | 'OPEN_DROP' | null; mismatch?: string | null; confirmedBy?: string | null; confirmedAt?: string | null;
  uploadedBy?: string | null; uploadedAt?: string | null;
  source?: 'OFFICE' | 'DRIVER' | 'TRANSPORTER' | 'WHATSAPP' | null; sharpness?: number | null; senderMobile?: string | null; messageText?: string | null; matchNote?: string | null;   // script 73
};
/** REQ-POD-007: where a paper photo came from. */
export const PAPER_SOURCE: Record<string, string> = { OFFICE: 'Office', DRIVER: 'Driver', TRANSPORTER: 'Transporter portal', WHATSAPP: 'WhatsApp' };
/** The server refuses a blurred photo with this message (PaperProofService.RETAKE). */
export const isRetake = (text: string) => text.startsWith('The photo is blurred');
const KEYS: [keyof Values, string][] = [['documentNumber', 'Document no.'], ['receiverName', 'Receiver'], ['receiverMobile', 'Mobile'], ['quantityTons', 'Quantity (T)'], ['date', 'Date']];
const CHECK: Record<string, [string, string]> = {
  MATCH: ['Same as the proof', 'bg-emerald-100 text-emerald-800'], MISMATCH: ['Differs from the proof', 'bg-red-100 text-red-800'], OPEN_DROP: ['Drop not recorded yet', 'bg-slate-100 text-slate-700'],
};

/** Photo of the signed paper delivery note. Values read by OCR are shown for staff to confirm; a difference can become a correction. */
export function PaperProofs({ base, deliveryId, staff, canAdd, delivered, onChanged }: { base: string; deliveryId: number; staff: boolean; canAdd: boolean; delivered: boolean; onChanged?: () => void }) {
  const [list, setList] = useState<Paper[] | null>(null), [ocr, setOcr] = useState(false), [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null), [values, setValues] = useState<Values>({});
  const [blurred, setBlurred] = useState<File | null>(null);   // REQ-POD-007: refused as blurred; staff may keep it anyway
  const load = useCallback(async () => {
    try { const r = await api(`${base}/deliveries/${deliveryId}/paper`); setList(r.papers || []); setOcr(Boolean(r.ocrEnabled)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the paper proofs') }); setList([]); }
  }, [base, deliveryId]);
  useEffect(() => { void load(); }, [load]);

  async function upload(f: File | undefined, keepBlurred = false) {
    if (!f) return;
    setBusy(true); setMsg(null); setBlurred(null);
    try {
      const body = new FormData(); body.append('file', f);
      if (keepBlurred) body.append('keepBlurred', 'true');
      const r = await fetch(`${API_URL}${base}/deliveries/${deliveryId}/paper`, { method: 'POST', headers: authHeader(), body });
      const text = await r.text(); let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
      if (!r.ok) throw new Error(json.message || `The photo could not be saved (${r.status})`);
      setMsg({ ok: true, text: json.ocrStatus === 'DONE' ? 'Saved and read. Check the values.' : json.ocrStatus === 'FAILED' ? 'Saved. It could not be read; type the values.' : 'Saved.' });
      await load(); onChanged?.();
    } catch (x) {
      const text = errorText(x, 'The photo could not be saved');
      // REQ-POD-007: too blurred to read -- take it again (staff may keep it when it is the only copy of the paper)
      if (isRetake(text)) { setMsg({ ok: false, text: `Take the photo again. ${text}.` }); if (staff) setBlurred(f); }
      else setMsg({ ok: false, text });
    }
    finally { setBusy(false); }
  }
  async function readAgain(p: Paper) {
    setBusy(true); setMsg(null);
    try { await api(`${base}/deliveries/${deliveryId}/paper/${p.id}/read`, { method: 'POST', body: '{}' }); await load(); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'It could not be read') }); }
    finally { setBusy(false); }
  }
  function startConfirm(p: Paper) { setEditing(p.id); setValues({ ...(p.found || {}), ...(p.confirmed || {}) }); setMsg(null); }
  async function confirm(p: Paper, askCorrection: boolean) {
    setBusy(true); setMsg(null);
    try {
      const r = await api(`${base}/deliveries/${deliveryId}/paper/${p.id}/confirm`, { method: 'POST', body: JSON.stringify({ values, askCorrection }) });
      setEditing(null);
      setMsg({ ok: r.checkResult !== 'MISMATCH' || Boolean(r.correctionId), text: r.correctionMessage || (r.checkResult === 'MATCH' ? 'The paper matches the proof.' : r.checkResult === 'MISMATCH' ? `The paper differs: ${r.mismatch}` : 'Values saved. They are compared when the drop is recorded.') });
      await load(); onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The values could not be saved') }); }
    finally { setBusy(false); }
  }

  if (list === null || (!canAdd && list.length === 0)) return null;
  return <div data-testid="pod-paper" className="mt-3 border-t border-slate-200 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h5 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><FileText className="h-3.5 w-3.5" />Paper delivery note ({list.length})</h5>
      {canAdd && <label className={`${btnLight} cursor-pointer`}>{busy ? 'Working...' : 'Add photo of the paper note'}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" disabled={busy} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void upload(f); }} /></label>}
    </div>
    {!ocr && list.length === 0 && <p className="mt-1 text-xs text-slate-500">Reading the text is switched off on this server: staff type the values from the photo.</p>}
    <Note msg={msg} />
    {blurred && <button type="button" disabled={busy} onClick={() => { void upload(blurred, true); }} className={`${btnLight} mt-2`}>Keep this blurred photo anyway</button>}
    <ul className="mt-2 space-y-2">{list.map(p => {
      const c = p.checkResult ? CHECK[p.checkResult] : null;
      return <li key={p.id} className="flex flex-wrap gap-3 rounded-xl bg-slate-50 p-2">
        <AuthPicture path={`${base}/deliveries/${deliveryId}/paper/${p.id}/image`} alt={p.fileName || 'Paper note'} className="h-24 w-32 rounded-lg border border-slate-200 object-cover" />
        <div className="min-w-[14rem] flex-1 text-sm">
          <p className="font-semibold text-slate-800">{p.fileName || 'Paper note'} · {p.ocrStatus === 'DONE' ? `read${p.ocrConfidence != null ? ` (${Math.round(Number(p.ocrConfidence))}% sure)` : ''}` : p.ocrStatus === 'FAILED' ? 'could not be read' : p.ocrStatus === 'WAITING' ? 'being read' : 'typed by hand'}
            {c && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${c[1]}`}>{c[0]}</span>}</p>
          <p className="text-xs text-slate-500">Added {when(p.uploadedAt)}{p.uploadedBy ? ` by ${p.uploadedBy}` : ''}{p.source && p.source !== 'OFFICE' ? ` (${PAPER_SOURCE[p.source] || p.source})` : ''}{p.sharpness != null ? ` · sharpness ${Math.round(Number(p.sharpness))}` : ''}{p.confirmedAt ? ` · confirmed ${when(p.confirmedAt)}${p.confirmedBy ? ` by ${p.confirmedBy}` : ''}` : ''}</p>
          {p.ocrError && <p className="text-xs text-red-700">{p.ocrError}</p>}
          {editing !== p.id && <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">{KEYS.map(([k, t]) => {
            const v = p.confirmed?.[k] ?? p.found?.[k];
            return v ? <div key={k}><dt className="inline text-slate-500">{t}: </dt><dd className="inline font-semibold text-slate-800">{v}</dd></div> : null;
          })}</dl>}
          {p.mismatch && editing !== p.id && <p className="mt-1 text-xs font-semibold text-red-700">{p.mismatch}</p>}
          {staff && editing !== p.id && <div className="mt-1 flex gap-2">
            <button type="button" disabled={busy} onClick={() => startConfirm(p)} className={btnLight}>{p.confirmedAt ? 'Check again' : 'Confirm values'}</button>
            {ocr && p.ocrStatus !== 'DONE' && <button type="button" disabled={busy} onClick={() => { void readAgain(p); }} className={btnLight}>Read again</button>}
          </div>}
          {staff && editing === p.id && <div className="mt-2 grid gap-2 md:grid-cols-5">
            {KEYS.map(([k, t]) => <div key={k}><label className={label}>{t}</label><input value={values[k] || ''} onChange={e => setValues({ ...values, [k]: e.target.value })} className={input} placeholder={k === 'date' ? '2026-10-06' : ''} /></div>)}
            <div className="flex flex-wrap gap-2 md:col-span-5">
              <button type="button" disabled={busy} onClick={() => { void confirm(p, false); }} className={btn}>Save and compare</button>
              {delivered && <button type="button" disabled={busy} onClick={() => { void confirm(p, true); }} className={btnLight}>Save, and ask for a correction if it differs</button>}
              <button type="button" disabled={busy} onClick={() => setEditing(null)} className={btnLight}>Cancel</button>
            </div>
          </div>}
          {p.ocrText && <details className="mt-1 text-xs"><summary className="cursor-pointer text-slate-500">Text read</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-white p-2">{p.ocrText}</pre></details>}
        </div>
      </li>;
    })}</ul>
  </div>;
}

// ------------------------------------------------------------------ REQ-POD-004 correction and versions

type Change = { field: string; label: string; from: unknown; to: unknown };
type Correction = { id: number; status: string; changes: Change[]; reason: string; source: string; versionFrom?: number; versionTo?: number | null; requestedBy?: string; requestedAt?: string; decidedBy?: string | null; decidedAt?: string | null; decisionNote?: string | null };
type Version = { version: number; data: Record<string, unknown>; madeBy?: string; madeAt?: string; reason?: string | null; requestedBy?: string | null };
type History = { currentVersion?: number; current: Record<string, unknown>; versions: Version[]; corrections: Correction[]; billing?: { dmrNumber?: string; onBill?: boolean; invoiceNumber?: string | null } };
const FIELDS: [string, string, string][] = [
  ['receiverName', 'Receiver name', 'text'], ['receiverMobile', 'Receiver mobile', 'text'], ['receiverDocumentNumber', 'Document / DMR no.', 'text'], ['deliveredQuantityTons', 'Delivered quantity (T)', 'number'],
  ['temperatureC', 'Temperature (°C)', 'number'], ['deliveredAt', 'Delivered at', 'datetime-local'], ['condition', 'Condition', 'select'], ['notes', 'Notes', 'text'],
];
const CONDITIONS: [string, string][] = [['OK', 'Good condition'], ['SHORTAGE', 'Shortage'], ['DAMAGE', 'Damage'], ['SHORTAGE_AND_DAMAGE', 'Shortage and damage']];
const STATUS_STYLE: Record<string, string> = { PENDING: 'bg-amber-100 text-amber-800', APPROVED: 'bg-emerald-100 text-emerald-800', REJECTED: 'bg-red-100 text-red-800', CANCELLED: 'bg-slate-100 text-slate-600' };
const local = (v: unknown) => { if (!v) return ''; const d = new Date(String(v)); if (Number.isNaN(d.getTime())) return ''; d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const shown = (v: unknown) => v === null || v === undefined || v === '' ? '-' : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? when(v) : String(v);

export function ChangeList({ changes }: { changes: Change[] }) {
  return <ul className="text-sm">{changes.map(c => <li key={c.field}><span className="text-slate-500">{c.label}:</span> <s className="text-slate-500">{shown(c.from)}</s> → <b>{shown(c.to)}</b></li>)}</ul>;
}

/** Ask for a correction of a recorded proof (a Manager approves it) and see its versions. Staff only. */
export function CorrectionBlock({ deliveryId, manager, onChanged }: { deliveryId: number; manager: boolean; onChanged?: () => void }) {
  const [open, setOpen] = useState<'ask' | 'history' | null>(null), [h, setH] = useState<History | null>(null);
  const [form, setForm] = useState<Record<string, string>>({}), [reason, setReason] = useState(''), [msg, setMsg] = useState<Msg>(null), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const r: History = await api(`/api/pod/deliveries/${deliveryId}/versions`);
      setH(r);
      const f: Record<string, string> = {};
      FIELDS.forEach(([k, , t]) => { const v = r.current?.[k]; f[k] = t === 'datetime-local' ? local(v) : v === null || v === undefined ? '' : String(v); });
      setForm(f);
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the versions') }); }
  }, [deliveryId]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (!h) return;
    const changes: Record<string, unknown> = {};
    FIELDS.forEach(([k, , t]) => {
      const was = t === 'datetime-local' ? local(h.current?.[k]) : h.current?.[k] === null || h.current?.[k] === undefined ? '' : String(h.current?.[k]);
      const now = (form[k] || '').trim();
      if (now !== was && !(t === 'number' && now !== '' && was !== '' && Number(now) === Number(was))) changes[k] = t === 'datetime-local' && now ? new Date(now).toISOString() : now;
    });
    if (Object.keys(changes).length === 0) { setMsg({ ok: false, text: 'Change at least one value.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await api(`/api/pod/deliveries/${deliveryId}/corrections`, { method: 'POST', body: JSON.stringify({ changes, reason: reason.trim() }) });
      setMsg({ ok: true, text: `${r.message}${r.billingWarning ? ` ${r.billingWarning}` : ''}` }); setReason(''); setOpen('history'); await load(); onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The correction could not be asked') }); }
    finally { setBusy(false); }
  }
  async function decide(c: Correction, action: 'approve' | 'reject' | 'cancel') {
    let note = '';
    if (action === 'reject') { const r = window.prompt('Why is the correction rejected?'); if (r === null) return; note = r.trim(); }
    if (action === 'approve' && !window.confirm('Approve this correction? The proof gets a new version; the old one is kept.')) return;
    setBusy(true); setMsg(null);
    try { const r = await api(`/api/pod/corrections/${c.id}/${action}`, { method: 'POST', body: JSON.stringify({ note }) }); setMsg({ ok: true, text: r.message || 'Done.' }); await load(); onChanged?.(); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'It could not be done') }); }
    finally { setBusy(false); }
  }
  const pending = h?.corrections.find(c => c.status === 'PENDING');
  return <div data-testid="pod-correction" className="mt-3 border-t border-slate-200 pt-3">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => { setMsg(null); setOpen(open === 'ask' ? null : 'ask'); }} className={btnLight}>Ask for a correction</button>
      <button type="button" onClick={() => { setMsg(null); setOpen(open === 'history' ? null : 'history'); }} className={`${btnLight} inline-flex items-center gap-1`}><History className="h-4 w-4" />Versions and corrections</button>
    </div>
    <Note msg={msg} />
    {open === 'ask' && h && (pending ? <p className="mt-2 text-sm font-semibold text-amber-800">A correction is already waiting for approval. Approve, reject or cancel it first.</p>
      : <form onSubmit={e => { void ask(e); }} className="mt-2 grid gap-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3 md:grid-cols-4">
        <p className="text-sm text-slate-700 md:col-span-4">Change only what is wrong. The proof stays as it is until a Manager or an Admin other than you approves; then it gets version {(h.currentVersion || 1) + 1} and version {h.currentVersion || 1} is kept.
          {h.billing?.onBill ? ` DMR ${h.billing.dmrNumber} is on bill ${h.billing.invoiceNumber}: quantity, time and document number cannot change until that bill is cancelled.` : ''}</p>
        {FIELDS.map(([k, t, type]) => <div key={k} className={k === 'notes' ? 'md:col-span-2' : ''}><label className={label}>{t}</label>
          {type === 'select' ? <select value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} className={input}>{CONDITIONS.map(([v, x]) => <option key={v} value={v}>{x}</option>)}</select>
            : <input type={type} step={type === 'number' ? 'any' : undefined} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} className={input} />}</div>)}
        <div className="md:col-span-4"><label className={label}>Why it must change *</label><input value={reason} onChange={e => setReason(e.target.value)} maxLength={500} className={input} placeholder="For example: the paper note says 9.5 T, typed 5.9 by mistake" /></div>
        <div className="flex gap-2 md:col-span-4"><button disabled={busy} className={btn}>Ask for approval</button><button type="button" onClick={() => setOpen(null)} className={btnLight}>Cancel</button></div>
      </form>)}
    {open === 'history' && h && <div className="mt-2 grid gap-3 lg:grid-cols-2">
      <div><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Corrections</h5>
        {h.corrections.length === 0 ? <p className="text-sm text-slate-500">None.</p> : <ul className="mt-1 space-y-2">{h.corrections.map(c => <li key={c.id} className="rounded-lg bg-slate-50 p-2 text-sm">
          <p><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[c.status] || ''}`}>{c.status}</span> asked {when(c.requestedAt)}{c.requestedBy ? ` by ${c.requestedBy}` : ''}{c.source !== 'OFFICE' ? ` (${c.source === 'PAPER_PROOF' ? 'from the paper note' : 'from a phone'})` : ''}</p>
          <ChangeList changes={c.changes || []} />
          <p className="text-slate-600">{c.reason}</p>
          {c.decidedAt && <p className="text-xs text-slate-500">{c.status === 'APPROVED' ? `Approved as version ${c.versionTo}` : c.status === 'REJECTED' ? 'Rejected' : 'Cancelled'} {when(c.decidedAt)}{c.decidedBy ? ` by ${c.decidedBy}` : ''}{c.decisionNote ? `: ${c.decisionNote}` : ''}</p>}
          {c.status === 'PENDING' && <div className="mt-1 flex gap-2">
            {manager && <button type="button" disabled={busy} onClick={() => { void decide(c, 'approve'); }} className={btnLight}>Approve</button>}
            {manager && <button type="button" disabled={busy} onClick={() => { void decide(c, 'reject'); }} className={btnRed}>Reject</button>}
            <button type="button" disabled={busy} onClick={() => { void decide(c, 'cancel'); }} className={btnLight}>Cancel</button>
          </div>}
        </li>)}</ul>}</div>
      <div><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Versions</h5>
        <ul className="mt-1 space-y-2">{[...h.versions].reverse().map(v => <li key={v.version} className="rounded-lg bg-slate-50 p-2 text-sm">
          <p className="font-semibold">Version {v.version}{v.version === h.currentVersion ? ' (current)' : ''} · {when(v.madeAt)}{v.madeBy ? ` by ${v.madeBy}` : ''}</p>
          <p className="text-slate-600">{FIELDS.map(([k, t]) => v.data?.[k] != null && v.data?.[k] !== '' ? `${t}: ${shown(v.data[k])}` : null).filter(Boolean).join(' · ')}</p>
          {v.reason && <p className="text-xs text-slate-500">{v.reason}</p>}
        </li>)}</ul></div>
    </div>}
  </div>;
}

// ------------------------------------------------------------------ REQ-TRP-011 proofs waiting in this browser

const ANSWER: Record<string, string> = { APPLIED: 'Recorded', HELD: 'Waiting for the office', CONFLICT: 'Clashes with a recorded proof', REJECTED: 'Refused', DISCARDED: 'Discarded' };

/** The proofs of this trip that were saved while the network was down, and what the server answered. */
export function OfflineQueue({ tripId, onSent }: { tripId: number; onSent?: () => void }) {
  const [list, setList] = useState<QueuedCapture[]>([]), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setList((await queued()).filter(c => c.tripId === tripId)); } catch { setList([]); } }, [tripId]);
  useEffect(() => { void load(); return onQueueChange(() => { void load(); onSent?.(); }); }, [load, onSent]);
  if (list.length === 0) return null;
  const waiting = list.filter(c => c.state === 'WAITING').length;
  return <div data-testid="pod-offline" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
    <p className="flex items-center gap-1 font-semibold text-amber-900"><CloudOff className="h-4 w-4" />{waiting ? `${waiting} proof${waiting > 1 ? 's' : ''} kept in this browser, sent when the network is back.` : 'Proofs sent from this browser:'}</p>
    <ul className="mt-1 space-y-1">{list.map(c => <li key={c.clientRef} className="flex flex-wrap items-center justify-between gap-2">
      <span>{c.label} · saved {when(c.capturedAt)} · {c.state === 'WAITING' ? `waiting${c.tries ? ` (tried ${c.tries} times)` : ''}` : `${ANSWER[c.answer?.status || ''] || c.answer?.status || 'answered'}${c.answer?.podNumber ? ` ${c.answer.podNumber}` : ''}${c.answer?.message ? `: ${c.answer.message}` : ''}`}</span>
      {c.state !== 'WAITING' && <button type="button" onClick={() => { void forget(c.clientRef).then(load); }} className="text-xs font-bold text-sky-700 hover:underline">Remove from list</button>}
      {c.state === 'WAITING' && <button type="button" onClick={() => { if (window.confirm('Delete this proof from the browser? It has not reached the server.')) void forget(c.clientRef).then(load); }} className="text-xs font-bold text-red-700 hover:underline">Delete</button>}
    </li>)}</ul>
    {waiting > 0 && <button type="button" disabled={busy} onClick={() => { setBusy(true); void flush().finally(() => setBusy(false)); }} className={`${btnLight} mt-2`}>{busy ? 'Sending...' : 'Send now'}</button>}
  </div>;
}
