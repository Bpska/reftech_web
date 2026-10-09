/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-003 -- Electronic proof of delivery, on the Trip details page.
//
// A trip has one or more drops. A drop is a planned stop of kind Delivery (REQ-CC-005); a trip without
// such a stop has one drop, its destination. For each drop the page records the proof of delivery:
// receiver name, signature or photo, delivered quantity, temperature at handover, and notes when
// something was short or damaged.
//
// The rules live on the server (TripDeliveryService.close); this panel shows the same rules before the
// button is pressed, so the user is not surprised:
//   - a delivery is recorded only while the trip is At delivery
//   - receiver name and temperature at handover are needed (the rule of the requirement)
//   - delivered quantity, and a signature or a photo
//   - notes when something was short, damaged, or the temperature was outside the range
//
// A closed delivery gets a proof number (POD-2026-000001) and a DMR row in billing, which Create Bill
// picks up without retyping.
//
// Backend: /api/operations/trips/{id}/deliveries (TripDeliveryController).
// REQ-TRP-004: a drop of a load the part-load planner attached shows the load number.
// REQ-TRP-006: the driver page shows the same panel through the driver API (apiBase = /api/mobile/driver/trips/{id}).
// REQ-POD-003: a drop can be Delivered, Partly delivered or Refused. A refusal or a partial delivery needs a reason
// from the list and what happens to the goods that were not accepted; goods that go back stay a "return" until closed.
// REQ-POD-001: a recorded drop has a proof PDF for the customer: download, email, or a share link for WhatsApp.
// REQ-POD-002: the place (phone position, else the truck GPS) and the source of the time are recorded with the proof.
// REQ-POD-004: a recorded proof is changed only by a correction a Manager approves; each approval is a new version.
// REQ-POD-005: the receiver can be confirmed by a one-time code sent to the receiver's mobile (needed for some customers).
//   When the code cannot be used: a reason from the list and a note (script 73). For a customer that needs the code and
//   a fallback rule MANAGER, a driver's or Employee's proof goes to the office (the sync queue) for a Manager to record.
// REQ-POD-007: a photo of the signed paper note; the values read from it are confirmed and compared with the proof.
// REQ-TRP-011: when the network is down, the proof is kept in the browser and sent later (podOffline.ts).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, Copy, FileDown, Mail, PackageCheck, Pencil, Share2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, apiDownload } from '@/shared/services/api';
import { role } from '@/modules/transporter/transporter';   // REQ-POD-001: staff may email and share; a Partner only downloads
import { SignaturePad } from '@/shared/components/SignaturePad';
import { CorrectionBlock, FallbackReason, OfflineQueue, OtpBlock, OtpFallbackBlock, OtpInfo, PaperProofs, PositionLine, StampFacts, Stamped, usePosition } from '@/modules/pod/podCapture';
import { deviceId, flush, isNetworkError, keep, newRef, packFile, startSync } from '@/modules/pod/podOffline';
import { fmtDateTime, fmtDistance, fmtTemp, fmtTempRange, fmtWeight, toBase, toBaseFields, toBaseNumber, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Photo = { id: number; fileName?: string | null; sizeBytes?: number | null };
type Billing = { state: 'WAITING' | 'ON_BILL' | 'NOT_CREATED' | 'NOT_READY'; dmrNumber?: string | null; invoiceNumber?: string | null };
type Delivery = Stamped & {
  otp?: OtpInfo;   // REQ-POD-005: the latest code of an open drop
  id: number; sequence: number; fromStop: boolean; loadNumber?: string | null; deliveryPartyName?: string | null; deliveryAddress?: string | null; plannedQuantityTons?: number | null;
  status: 'OPEN' | 'DELIVERED'; podNumber?: string | null; receiverName?: string | null; receiverMobile?: string | null; receiverDocumentNumber?: string | null;
  deliveredQuantityTons?: number | null; temperatureC?: number | null; temperatureInRange?: boolean | null; condition?: string | null; notes?: string | null;
  odometerKm?: number | null; distanceKm?: number | null; deliveredAt?: string | null; closedBy?: string | null; hasSignature?: boolean; photos: Photo[]; billing?: Billing;
  // REQ-POD-003: outcome, reason and what happens to the goods (null before script 36)
  outcome?: Outcome | null; outcomeLabel?: string | null; refusedQuantityTons?: number | null; reasonCode?: string | null; reasonLabel?: string | null; reasonNote?: string | null;
  goodsAction?: string | null; goodsActionLabel?: string | null; returnStatus?: 'OPEN' | 'CLOSED' | null; returnNote?: string | null; returnClosedAt?: string | null; returnClosedBy?: string | null;
};
// REQ-POD-003
type Outcome = 'DELIVERED' | 'PARTLY_DELIVERED' | 'REFUSED';
type Reason = { code: string; label: string; appliesTo: string; needsNote: boolean };
type View = {
  tripId: number; tripNumber?: string; tripStage: string; minC?: number | null; maxC?: number | null; requireProof: boolean; maxPhotos: number;
  tablesReady: boolean; message?: string; deliveries: Delivery[]; total: number; delivered: number; canRecord: boolean; canEdit: boolean; recordNote?: string | null;
  podReady?: boolean; refusalReasons?: Reason[]; partialReasons?: Reason[];   // REQ-POD-003
  captureReady?: boolean; otpEnabled?: boolean; otpRequired?: boolean; placeRequired?: boolean;   // REQ-POD-002, 005 (script 54)
  otpFallbackReady?: boolean; otpFallbackPolicy?: 'MANAGER' | 'REASON'; otpFallbackReasons?: FallbackReason[];   // REQ-POD-005 (script 73)
};

const API_URL = import.meta.env.VITE_API_URL;
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const n = (v?: number | null) => (v === null || v === undefined ? '' : String(Number(v)));
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);
const authHeader = (): Record<string, string> => { const t = localStorage.getItem('reftech_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
// One request to the server carries about 6 MB (spring.servlet.multipart.max-request-size in application.properties).
const REQUEST_LIMIT = 5.5 * 1024 * 1024, PHOTO_LIMIT = 3 * 1024 * 1024, LONGEST_SIDE = 1600;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * A phone photo is several megabytes. Before it is sent it is made smaller in the browser: longest side
 * 1600 pixels, saved as JPG. That is plenty to read a signed delivery note. When the browser cannot do it,
 * the original file is used.
 */
async function smaller(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024 || typeof createImageBitmap !== 'function') return file;
  try {
    const picture = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, LONGEST_SIDE / Math.max(picture.width, picture.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(picture.width * scale)); canvas.height = Math.max(1, Math.round(picture.height * scale));
    const g = canvas.getContext('2d');
    if (!g) return file;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(picture, 0, 0, canvas.width, canvas.height);
    picture.close?.();
    const blob = await new Promise<Blob | null>(done => canvas.toBlob(done, 'image/jpeg', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.(jpe?g|png|webp)$/i, '')}.jpg`, { type: 'image/jpeg' });
  } catch { return file; }
}

// REQ-POD-003: what happens to the goods that were not accepted.
const GOODS_ACTIONS: [string, string][] = [
  ['RETURN_ON_TRUCK', 'Goes back on the truck'], ['RETURN_TO_WAREHOUSE', 'Return to the warehouse'], ['REDELIVER', 'Deliver again'],
  ['DESTROYED_AT_SITE', 'Destroyed at the customer'], ['LEFT_WITH_CUSTOMER', 'Left with the customer, not accepted'],
];
const OUTCOMES: [Outcome, string][] = [['DELIVERED', 'Delivered'], ['PARTLY_DELIVERED', 'Partly delivered'], ['REFUSED', 'Refused']];
const OUTCOME_STYLE: Record<string, string> = { DELIVERED: 'bg-emerald-100 text-emerald-800', PARTLY_DELIVERED: 'bg-amber-100 text-amber-800', REFUSED: 'bg-red-100 text-red-800' };
/** 0 tons is a refusal, less than planned is a partial delivery (the rule of TripDeliveryService.close). */
const outcomeOf = (q: number | null, planned: number | null): Outcome => (q === 0 ? 'REFUSED' : q !== null && planned !== null && q < planned ? 'PARTLY_DELIVERED' : 'DELIVERED');

const CONDITION: Record<string, { text: string; style: string }> = {
  OK: { text: 'Received in good condition', style: 'bg-emerald-100 text-emerald-800' },
  SHORTAGE: { text: 'Shortage', style: 'bg-amber-100 text-amber-800' },
  DAMAGE: { text: 'Damage', style: 'bg-red-100 text-red-800' },
  SHORTAGE_AND_DAMAGE: { text: 'Shortage and damage', style: 'bg-red-100 text-red-800' },
};

/** A picture is fetched with the sign-in token (an <img> tag alone cannot send it) and shown from memory. */
function Picture({ path, alt, className }: { path: string; alt: string; className: string }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = '', gone = false;
    fetch(`${API_URL}${path}`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => { if (gone) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [path]);
  return src
    ? <a href={src} target="_blank" rel="noreferrer" title="Open in a new tab"><img src={src} alt={alt} className={className} /></a>
    : <div className={`${className} flex items-center justify-center bg-slate-50 text-xs text-slate-500`}>{failed ? 'Could not be loaded' : 'Loading...'}</div>;
}

// ------------------------------------------------------------------ REQ-POD-001 the proof PDF for the customer
type ShareLink = { id: number; expiresAt?: string | null; revokedAt?: string | null; openedCount?: number | null; lastOpenedAt?: string | null; createdByName?: string | null; createdAt?: string | null; active?: boolean };
type LogRow = { channel: string; sentTo?: string | null; byName?: string | null; at?: string | null };
type Sharing = { emailEnabled?: boolean; partnerEmail?: string | null; links: ShareLink[]; log: LogRow[] };
const CHANNEL: Record<string, string> = { DOWNLOAD: 'Downloaded', EMAIL: 'Emailed', WHATSAPP: 'Share link made' };
const small = 'inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';

/** Proof PDF (everyone who sees the drop), and for staff: Email, Share link and the sharing log. */
function ProofActions({ d, staff }: { d: Delivery; staff: boolean }) {
  const [open, setOpen] = useState<'email' | 'share' | null>(null);
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [to, setTo] = useState(''), [note, setNote] = useState('');
  const [days, setDays] = useState('7'), [mobile, setMobile] = useState(d.receiverMobile || '');
  const [made, setMade] = useState<{ url: string; whatsappUrl: string; message?: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSharing = useCallback(async () => {
    try {
      const s: Sharing = await api(`/api/pod/deliveries/${d.id}/sharing`);
      setSharing({ ...s, links: s.links || [], log: s.log || [] });
      if (s.partnerEmail) setTo(current => current || String(s.partnerEmail));
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the sharing log') }); }
  }, [d.id]);
  useEffect(() => { if (open) void loadSharing(); }, [open, loadSharing]);

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(null);
    try { const r = await action(); setMsg({ ok: true, text: r?.message || done }); if (staff && open) await loadSharing(); return r; }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not do it') }); return null; }
    finally { setBusy(false); }
  }
  const pdf = () => run(async () => { await apiDownload(`/api/pod/deliveries/${d.id}/proof.pdf`, `${String(d.podNumber || `POD-${d.id}`).replace(/[^A-Za-z0-9-]/g, '_')}.pdf`); }, 'The proof PDF is downloaded.');
  const email = (e: FormEvent) => { e.preventDefault(); void run(() => api(`/api/pod/deliveries/${d.id}/email`, { method: 'POST', body: JSON.stringify({ to: to.trim(), note: note.trim() }) }), 'The proof is emailed.'); };
  async function share(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => api(`/api/pod/deliveries/${d.id}/share`, { method: 'POST', body: JSON.stringify({ days: days.trim(), mobile: mobile.trim(), origin: window.location.origin }) }), 'Link made.');
    if (r?.url) setMade({ url: r.url, whatsappUrl: r.whatsappUrl, message: r.message });
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMsg({ ok: true, text: 'The link is copied.' }); }
    catch { window.prompt('Copy the link:', text); }
  }
  const stop = (id: number) => { if (window.confirm('Stop this link? It will no longer open the PDF.')) void run(() => api(`/api/pod/share-links/${id}/revoke`, { method: 'POST', body: '{}' }), 'The link is stopped.'); };

  return <div className="mt-3 border-t border-slate-200 pt-3" data-testid="proof-actions">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" disabled={busy} onClick={() => { void pdf(); }} className={small}><FileDown className="h-4 w-4" />Proof PDF</button>
      {staff && <>
        <button type="button" disabled={busy} onClick={() => { setMsg(null); setOpen(open === 'email' ? null : 'email'); }} className={small}><Mail className="h-4 w-4" />Email</button>
        <button type="button" disabled={busy} onClick={() => { setMsg(null); setMade(null); setOpen(open === 'share' ? null : 'share'); }} className={small}><Share2 className="h-4 w-4" />Share</button>
      </>}
    </div>
    {msg && <p role="status" className={`mt-2 rounded-xl p-2 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}

    {staff && open === 'email' && <form onSubmit={email} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 lg:grid-cols-3">
      <div><label className={label} htmlFor={`pod-to-${d.id}`}>Send to</label><input id={`pod-to-${d.id}`} value={to} onChange={e => setTo(e.target.value)} className={input} placeholder="Email address; empty = the customer's email" />
        <p className="mt-1 text-xs text-slate-500">Separate more addresses with a comma.</p></div>
      <div className="lg:col-span-2"><label className={label} htmlFor={`pod-note-${d.id}`}>Note in the email</label><input id={`pod-note-${d.id}`} value={note} onChange={e => setNote(e.target.value)} maxLength={500} className={input} /></div>
      {sharing && sharing.emailEnabled === false && <p className="text-sm font-semibold text-amber-800 lg:col-span-3">Email is switched off on this server. Download the PDF, or share the link.</p>}
      <div className="lg:col-span-3"><button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? 'Sending...' : 'Send email'}</button></div>
    </form>}

    {staff && open === 'share' && <form onSubmit={e => { void share(e); }} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 lg:grid-cols-3">
      <div><label className={label} htmlFor={`pod-days-${d.id}`}>Link works for (days)</label><input id={`pod-days-${d.id}`} type="number" min="1" max="90" value={days} onChange={e => setDays(e.target.value)} className={input} /></div>
      <div><label className={label} htmlFor={`pod-wa-${d.id}`}>WhatsApp mobile</label><input id={`pod-wa-${d.id}`} value={mobile} onChange={e => setMobile(e.target.value)} inputMode="tel" maxLength={20} className={input} placeholder="Empty: choose the contact in WhatsApp" /></div>
      <div className="flex items-end"><button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Make link</button></div>
      {made && <div className="lg:col-span-3">
        <p className="text-sm text-slate-700">{made.message}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input readOnly value={made.url} onFocus={e => e.currentTarget.select()} className={`${input} max-w-xl font-mono text-xs`} />
          <button type="button" onClick={() => { void copy(made.url); }} className={small}><Copy className="h-4 w-4" />Copy</button>
          {made.whatsappUrl && <a href={made.whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800">Open WhatsApp</a>}
        </div>
      </div>}
    </form>}

    {staff && open && sharing && <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <div><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Share links</h5>
        {sharing.links.length === 0 ? <p className="text-sm text-slate-500">No link made yet.</p>
          : <ul className="mt-1 space-y-1 text-sm">{sharing.links.map(l => <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1">
            <span>Made {when(l.createdAt)}{l.createdByName ? ` by ${l.createdByName}` : ''} · {l.active ? `works till ${when(l.expiresAt)}` : l.revokedAt ? `stopped ${when(l.revokedAt)}` : 'expired'} · opened {Number(l.openedCount || 0)} times{l.lastOpenedAt ? `, last ${when(l.lastOpenedAt)}` : ''}</span>
            {l.active && <button type="button" disabled={busy} onClick={() => stop(l.id)} className="inline-flex items-center gap-1 text-sm font-bold text-red-700 hover:underline"><XCircle className="h-3.5 w-3.5" />Stop</button>}
          </li>)}</ul>}</div>
      <div><h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Document log</h5>
        {sharing.log.length === 0 ? <p className="text-sm text-slate-500">Not downloaded or sent yet.</p>
          : <ul className="mt-1 space-y-1 text-sm">{sharing.log.map((g, i) => <li key={i} className="rounded-lg bg-slate-50 px-2 py-1">{when(g.at)} · {CHANNEL[g.channel] || g.channel}{g.sentTo ? ` to ${g.sentTo}` : ''}{g.byName ? ` by ${g.byName}` : ''}</li>)}</ul>}</div>
    </div>}
  </div>;
}

export function TripDeliveriesPanel({ tripId, refreshKey, onChanged, apiBase }: { tripId: number; refreshKey?: number; onChanged?: () => void; apiBase?: string }) {
  const base = apiBase || `/api/operations/trips/${tripId}`;
  const [view, setView] = useState<View | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);      // the drop whose proof is being recorded
  const [editId, setEditId] = useState<number | null>(null);      // the drop whose party / planned quantity is being changed
  // the proof form
  const [receiver, setReceiver] = useState(''), [mobile, setMobile] = useState(''), [doc, setDoc] = useState('');
  const [quantity, setQuantity] = useState(''), [temperature, setTemperature] = useState(''), [odometer, setOdometer] = useState(''), [at, setAt] = useState('');
  const [shortage, setShortage] = useState(false), [damaged, setDamaged] = useState(false), [notes, setNotes] = useState('');
  const [signature, setSignature] = useState<File | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  // REQ-POD-003: outcome, reason and what happens to the goods that were not accepted
  const [outcome, setOutcome] = useState<Outcome>('DELIVERED'), [reasonCode, setReasonCode] = useState(''), [reasonNote, setReasonNote] = useState('');
  const [goodsAction, setGoodsAction] = useState(''), [refusedQty, setRefusedQty] = useState('');
  const staff = role().staff && !apiBase;   // REQ-POD-001: email and share are for staff on the trip page
  const file = useRef<HTMLInputElement>(null);
  // The time the form opened with. When the user leaves it as it is, no time is sent and the server takes the exact moment.
  const atShown = useRef('');
  const sending = useRef(false);      // a second click while the first request is on its way does nothing
  // REQ-POD-002 / 005 / TRP-011: the position, the checked one-time code and the reference of this capture
  const geo = usePosition(openId !== null);
  const [otpCode, setOtpCode] = useState('');
  // REQ-POD-005: the code cannot be used -- why, and what happened
  const [noCode, setNoCode] = useState(false), [noCodeReason, setNoCodeReason] = useState(''), [noCodeNote, setNoCodeNote] = useState('');
  const clientRef = useRef('');
  const manager = role().manager;
  useEffect(() => { startSync(); }, []);

  const load = useCallback(async () => {
    try { setView(await api(`${base}/deliveries`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the deliveries') }); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { setOpenId(null); setEditId(null); setMsg(null); }, [tripId]);

  function record(d: Delivery) {
    setMsg(null); setEditId(null);
    setReceiver(''); setMobile(''); setDoc(''); setQuantity(toShown('weight', d.plannedQuantityTons)); setTemperature(''); setOdometer(''); atShown.current = localNow(); setAt(atShown.current);
    setShortage(false); setDamaged(false); setNotes(''); setSignature(null); setPhotos([]);
    setOutcome('DELIVERED'); setReasonCode(''); setReasonNote(''); setGoodsAction(''); setRefusedQty('');   // REQ-POD-003
    setOtpCode(''); setNoCode(false); setNoCodeReason(''); setNoCodeNote(''); clientRef.current = newRef();   // REQ-POD-005, REQ-TRP-011: one reference per capture, kept when Save is pressed again
    setOpenId(d.id);
  }

  async function close(e: FormEvent<HTMLFormElement>, d: Delivery) {
    e.preventDefault();
    if (sending.current) return;
    const total = (signature?.size || 0) + photos.reduce((sum, p) => sum + p.size, 0);
    const tooBig = photos.find(p => p.size > PHOTO_LIMIT);
    if (tooBig) { setMsg({ ok: false, text: `The photo ${tooBig.name} is ${mb(tooBig.size)}. A photo can be at most 3 MB. Remove it and take it at a lower resolution.` }); return; }
    if (total > REQUEST_LIMIT) { setMsg({ ok: false, text: `The photos are ${mb(total)} together. One proof of delivery can carry ${mb(REQUEST_LIMIT)}. Remove a photo.` }); return; }
    if (noCode && !otpCode && view?.otpFallbackReady && (!noCodeReason || noCodeNote.trim().length < 5)) { setMsg({ ok: false, text: 'The code cannot be used: choose why, and write what happened (at least 5 letters).' }); return; }
    sending.current = true;
    setBusy(true); setMsg(null);
    try {
      const body = new FormData();
      body.append('receiverName', receiver.trim());
      body.append('receiverMobile', mobile.trim());
      body.append('receiverDocumentNumber', doc.trim());
      // REQ-PLT-015: typed in the login's units, sent in tons and °C
      body.append('deliveredQuantityTons', toBase('weight', quantity));
      body.append('temperatureC', toBase('temp', temperature));
      body.append('odometerKm', odometer.trim());
      if (at && at !== atShown.current) body.append('deliveredAt', new Date(at).toISOString());
      body.append('shortage', String(shortage));
      body.append('damaged', String(damaged));
      body.append('notes', notes.trim());
      // REQ-POD-003: only when script 36 is in; the server checks the same rules and says what is missing.
      if (view?.podReady) {
        body.append('outcome', outcome);
        if (outcome !== 'DELIVERED') {
          body.append('reasonCode', reasonCode);
          body.append('reasonNote', reasonNote.trim());
          body.append('goodsAction', goodsAction);
          if (outcome === 'PARTLY_DELIVERED' && refusedQty.trim()) body.append('refusedQuantityTons', toBase('weight', refusedQty));
        }
      }
      if (signature) body.append('signature', signature);
      photos.forEach(p => body.append('photos', p));
      // REQ-POD-002 / 005 / TRP-011 (script 54): place, the checked code, and the reference that makes a second sending harmless
      if (view?.captureReady) {
        body.append('clientRef', clientRef.current);
        if (geo.fix) { body.append('placeLatitude', String(geo.fix.latitude)); body.append('placeLongitude', String(geo.fix.longitude)); if (geo.fix.accuracyM != null) body.append('placeAccuracyM', String(geo.fix.accuracyM)); }
        if (otpCode) body.append('otpCode', otpCode);
        // REQ-POD-005: recorded without the code, with the reason (also carried by the offline copy)
        else if (noCode && view.otpFallbackReady) { body.append('otpFallbackReason', noCodeReason); body.append('otpFallbackNote', noCodeNote.trim()); }
      }
      // A customer that needs the code, without it, and the person is not a Manager: a Manager records it from Proof review.
      if (view?.captureReady && needsApproval()) { await keepOffline(d, body, true); return; }
      let r: Response;
      try { r = await fetch(`${API_URL}${base}/deliveries/${d.id}/close`, { method: 'POST', headers: authHeader(), body }); }
      catch (x) {
        if (!view?.captureReady || !isNetworkError(x)) throw x;
        await keepOffline(d, body);   // REQ-TRP-011: no network, so the proof is kept in the browser
        return;
      }
      const text = await r.text(); let json: { message?: string; podNumber?: string; warnings?: string[]; repeated?: boolean } = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
      if (!r.ok) throw new Error(json.message || `The delivery could not be saved (${r.status})`);
      setOpenId(null);
      await load();
      setMsg({ ok: true, text: `Delivery ${d.sequence} is ${json.repeated ? 'already ' : ''}recorded: ${json.podNumber}.${(json.warnings || []).length ? ` Note: ${(json.warnings || []).join(' ')}` : ''}${apiBase ? '' : ' Its DMR row is ready for Create Bill.'}` });
      onChanged?.();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The delivery could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }

  /** REQ-POD-005: the code cannot be used and this customer needs a Manager for that. */
  function needsApproval() {
    return Boolean(view?.otpFallbackReady && view.otpRequired && view.otpFallbackPolicy === 'MANAGER' && !otpCode && noCode && !(staff && manager));
  }

  /**
   * REQ-TRP-011: the proof as the sync address takes it, kept in IndexedDB until the network is back.
   * forApproval (REQ-POD-005): sent at once to wait for a Manager on Proof review (kept here too while offline).
   */
  async function keepOffline(d: Delivery, body: FormData, forApproval = false) {
    const fields: Record<string, unknown> = {};
    body.forEach((v, k) => { if (typeof v === 'string' && !['clientRef', 'deliveredAt', 'placeLatitude', 'placeLongitude', 'placeAccuracyM'].includes(k)) fields[k] = v; });
    await keep({
      clientRef: clientRef.current, deviceId: deviceId(), tripId, deliveryId: d.id,
      capturedAt: at && at !== atShown.current ? new Date(at).toISOString() : new Date().toISOString(),
      fields, place: geo.fix ? { latitude: geo.fix.latitude, longitude: geo.fix.longitude, accuracyM: geo.fix.accuracyM } : null,
      signature: signature ? await packFile(signature, 'signature.png') : null, photos: await Promise.all(photos.map(p => packFile(p))),
      driver: Boolean(apiBase), label: `${view?.tripNumber ? `Trip ${view.tripNumber} ` : ''}delivery ${d.sequence}`,
    });
    setOpenId(null);
    setMsg({ ok: true, text: forApproval
      ? `The proof of delivery ${d.sequence} is sent to the office without the receiver's code. A Manager checks it and records it; its state shows below.`
      : `No network. The proof of delivery ${d.sequence} is kept in this browser and is sent as soon as the network is back. Do not clear the browser data until then.` });
    void flush().catch(() => undefined);
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>, d: Delivery) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const body = toBaseFields(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, any>, { plannedQuantityTons: 'weight' });
      setView(await api(`${base}/deliveries/${d.id}`, { method: 'PUT', body: JSON.stringify(body) }));
      setEditId(null);
      setMsg({ ok: true, text: `Delivery ${d.sequence} is updated.` });
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'The delivery could not be changed') }); }
    finally { setBusy(false); }
  }

  async function pickPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const max = view?.maxPhotos || 3;
    const chosen = Array.from(list);
    if (file.current) file.current.value = '';
    if (photos.length + chosen.length > max) setMsg({ ok: false, text: `A delivery holds at most ${max} photos.` });
    const ready = await Promise.all(chosen.slice(0, Math.max(0, max - photos.length)).map(smaller));
    setPhotos(current => [...current, ...ready].slice(0, max));
  }

  const card = 'mt-4 rounded-2xl bg-white p-5 shadow-sm';
  const heading = <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><PackageCheck className="h-5 w-5 text-sky-700" />Deliveries and proof of delivery</h2>;
  if (!view) return <section className={card}>{heading}{msg ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{msg.text}</p> : <p className="mt-3 text-sm text-slate-500">Loading...</p>}</section>;

  const ranged = view.minC != null || view.maxC != null;
  const range = ranged ? fmtTempRange(view.minC, view.maxC) : '';
  const t = temperature.trim() === '' ? null : toBaseNumber('temp', temperature) ?? NaN; // °C, as the range
  const tempOut = t !== null && !Number.isNaN(t) && ((view.maxC != null && t > Number(view.maxC)) || (view.minC != null && t < Number(view.minC)));

  return <section className={card} id="trip-deliveries">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {heading}
      {view.tablesReady && <span data-testid="delivery-count" className={`rounded-full px-3 py-1 text-xs font-bold ${view.total > 0 && view.delivered === view.total ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{view.delivered} of {view.total} delivered</span>}
    </div>
    {!view.tablesReady && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{view.message}</p>}
    {msg && <p role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</p>}
    {view.tablesReady && view.recordNote && view.delivered < view.total && <p className="mt-3 text-sm text-slate-600">{view.recordNote}</p>}
    {view.captureReady && <OfflineQueue tripId={tripId} onSent={load} />}

    <div className="mt-3 space-y-3">
      {view.deliveries.map(d => {
        const done = d.status === 'DELIVERED';
        const cond = CONDITION[d.condition || 'OK'] || CONDITION.OK;
        // REQ-PLT-015: the drop form works in the login's weight unit (tons or kg); the request is sent in tons
        const plannedQty = d.plannedQuantityTons != null ? Number(toShown('weight', d.plannedQuantityTons)) : null;
        const wu = unitNow('weight');
        const q = quantity.trim() === '' ? null : Number(quantity);
        const short = openId === d.id && (shortage || (q !== null && plannedQty !== null && q < plannedQty));
        // REQ-POD-003: with a reason from the list, Notes are not needed (the server rule).
        const pod = Boolean(view.podReady) && openId === d.id;
        const reasons = (outcome === 'REFUSED' ? view.refusalReasons : view.partialReasons) || [];
        const reason = reasons.find(r => r.code === reasonCode);
        const askRefusedQty = pod && outcome === 'PARTLY_DELIVERED' && !(q !== null && plannedQty !== null && q < plannedQty);
        const withReason = pod && outcome !== 'DELIVERED' && Boolean(reasonCode);
        const needNotes = openId === d.id && !withReason && (short || damaged || tempOut);
        return <article key={d.id} data-delivery={d.sequence} data-status={d.status} className={`rounded-xl border p-4 ${done ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900">Delivery {d.sequence}: {d.deliveryPartyName || 'Receiver not named'}{d.loadNumber && <span data-testid="drop-load" className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">Part load {d.loadNumber}</span>}</h3>
              <p className="text-sm text-slate-600">{[d.deliveryAddress, plannedQty !== null ? `planned ${fmtWeight(d.plannedQuantityTons)}` : ''].filter(Boolean).join(' · ') || 'No address recorded'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {done
                ? <><span data-testid="drop-outcome" className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${OUTCOME_STYLE[d.outcome || 'DELIVERED'] || OUTCOME_STYLE.DELIVERED}`}><CheckCircle2 className="h-3.5 w-3.5" />{d.outcomeLabel || 'Delivered'}</span>{/* REQ-POD-003 */}<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700" data-testid="pod-number">{d.podNumber}</span></>
                : <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">Waiting</span>}
              {!done && view.canEdit && openId !== d.id && editId !== d.id && <button type="button" onClick={() => { setMsg(null); setOpenId(null); setEditId(d.id); }} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><Pencil className="h-3.5 w-3.5" />Change</button>}
              {!done && view.canRecord && openId !== d.id && <button type="button" onClick={() => record(d)} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white hover:bg-sky-800"><ClipboardCheck className="h-4 w-4" />Record proof of delivery</button>}
            </div>
          </div>

          {/* ------------------------------------------------ a recorded delivery */}
          {done && <div className="mt-3 grid gap-4 lg:grid-cols-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm lg:col-span-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Received by</dt><dd className="font-semibold text-slate-900">{d.receiverName}{d.receiverMobile ? `, ${d.receiverMobile}` : ''}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivered at</dt><dd className="font-semibold text-slate-900">{when(d.deliveredAt)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity</dt><dd className="font-semibold text-slate-900">{fmtWeight(d.deliveredQuantityTons)}{plannedQty !== null ? ` of ${fmtWeight(d.plannedQuantityTons)} planned` : ''}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Temperature at handover</dt><dd className={`font-semibold ${d.temperatureInRange === false ? 'text-red-700' : 'text-slate-900'}`}>{d.temperatureC != null ? fmtTemp(d.temperatureC) : '-'}{d.temperatureInRange === false ? ' (outside the range)' : d.temperatureInRange ? ' (in range)' : ''}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Condition</dt><dd><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${cond.style}`}>{cond.text}</span></dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Receiver's document / DMR no.</dt><dd className="font-semibold text-slate-900">{d.receiverDocumentNumber || '-'}</dd></div>
              {d.odometerKm != null && <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Odometer</dt><dd className="font-semibold text-slate-900">{Number(d.odometerKm).toLocaleString('en-IN')} km{d.distanceKm != null ? ` (${fmtDistance(d.distanceKm)} run)` : ''}</dd></div>}
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recorded by</dt><dd className="font-semibold text-slate-900">{d.closedBy || '-'}</dd></div>
              {view.captureReady && <StampFacts d={d} />}{/* REQ-POD-002, 004, 005 */}
              {/* REQ-POD-003: why it was refused or partly delivered, and what happens to the goods */}
              {d.outcome && d.outcome !== 'DELIVERED' && <>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Not accepted</dt><dd className="font-semibold text-slate-900">{d.refusedQuantityTons != null ? fmtWeight(d.refusedQuantityTons) : '-'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reason</dt><dd className="font-semibold text-slate-900" data-testid="drop-reason">{d.reasonLabel || d.reasonCode || '-'}{d.reasonNote && <span className="block font-normal text-slate-700">{d.reasonNote}</span>}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Goods not accepted</dt><dd className="font-semibold text-slate-900">{d.goodsActionLabel || d.goodsAction || '-'}</dd></div>
                <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Return</dt><dd className="text-slate-900" data-testid="drop-return">
                  {d.returnStatus === 'OPEN' ? <><span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">Return open</span>{staff && <Link to="/pod/check?tab=returns" className="ml-2 text-sm font-bold text-sky-700 hover:underline">Returns</Link>}</>
                    : d.returnStatus === 'CLOSED' ? <><span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">Closed</span> <span className="text-sm">{when(d.returnClosedAt)}{d.returnClosedBy ? ` by ${d.returnClosedBy}` : ''}</span>{d.returnNote && <span className="block text-sm text-slate-700">{d.returnNote}</span>}</>
                      : 'No return'}</dd></div>
              </>}
              {d.notes && <div className="col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</dt><dd className="text-slate-900">{d.notes}</dd></div>}
              {d.billing && <div className="col-span-2" data-testid="delivery-billing"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Billing</dt><dd className="text-slate-900">
                {d.billing.state === 'ON_BILL' ? <>DMR {d.billing.dmrNumber} is on bill <b>{d.billing.invoiceNumber}</b>.</>
                  : d.billing.state === 'WAITING' ? <>DMR {d.billing.dmrNumber} is waiting for a bill. <Link to="/billing#create-billing" className="font-bold text-sky-700 hover:underline">Open Create Bill</Link></>
                    : d.outcome === 'REFUSED' ? 'Refused: this drop is not billed.'   /* REQ-POD-003: no DMR row for a refusal */
                    : d.billing.state === 'NOT_READY' ? 'The DMR table is not in the billing database yet (script 23).'
                      : 'The DMR row is being created. Refresh in a moment.'}</dd></div>}
            </dl>
            <div className="flex flex-wrap items-start gap-3">
              {d.hasSignature && <figure><Picture path={`${base}/deliveries/${d.id}/signature`} alt={`Signature of ${d.receiverName}`} className="h-24 w-56 rounded-xl border border-slate-200 bg-white object-contain" /><figcaption className="mt-1 text-xs text-slate-500">Signature of the receiver</figcaption></figure>}
              {d.photos.map(p => <figure key={p.id}><Picture path={`${base}/deliveries/${d.id}/photos/${p.id}`} alt={p.fileName || 'Delivery photo'} className="h-24 w-32 rounded-xl border border-slate-200 object-cover" /><figcaption className="mt-1 max-w-32 truncate text-xs text-slate-500">{p.fileName || 'Photo'}</figcaption></figure>)}
              {!d.hasSignature && d.photos.length === 0 && <p className="text-sm text-slate-500">No signature or photo was stored.</p>}
            </div>
          </div>}
          {/* REQ-POD-001: the proof PDF for the customer; email and share for staff */}
          {done && <ProofActions d={d} staff={staff && Boolean(view.podReady)} />}
          {/* REQ-POD-004: correction with approval; REQ-POD-007: photo of the paper note */}
          {done && staff && view.captureReady && <CorrectionBlock deliveryId={d.id} manager={manager} onChanged={() => { void load(); }} />}
          {view.captureReady && (done || openId === d.id) && <PaperProofs base={base} deliveryId={d.id} staff={staff} canAdd={staff || Boolean(apiBase)} delivered={done} onChanged={() => { void load(); }} />}

          {/* ------------------------------------------------ change the party or the planned quantity of an open drop */}
          {editId === d.id && <form onSubmit={e => { void saveEdit(e, d); }} className="mt-3 grid gap-3 rounded-xl border border-sky-200 bg-sky-50/40 p-3 lg:grid-cols-4">
            <div><label className={label} htmlFor={`party-${d.id}`}>Delivery party *</label><input id={`party-${d.id}`} name="deliveryPartyName" required maxLength={180} defaultValue={d.deliveryPartyName || ''} className={input} /></div>
            <div className="lg:col-span-2"><label className={label} htmlFor={`address-${d.id}`}>Address</label><input id={`address-${d.id}`} name="deliveryAddress" maxLength={500} defaultValue={d.deliveryAddress || ''} className={input} /></div>
            <div><label className={label} htmlFor={`planned-${d.id}`}>Planned quantity ({unitNow('weight')})</label><input id={`planned-${d.id}`} name="plannedQuantityTons" type="number" min="0" step="any" defaultValue={toShown('weight', d.plannedQuantityTons)} className={input} /></div>
            <div className="flex gap-3 lg:col-span-4"><button disabled={busy} className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Save</button><button type="button" onClick={() => setEditId(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button></div>
          </form>}

          {/* ------------------------------------------------ record the proof of delivery */}
          {openId === d.id && <form onSubmit={e => { void close(e, d); }} className="mt-3 rounded-xl border-2 border-sky-300 p-4" noValidate>
            <h4 className="font-bold text-slate-900">Proof of delivery for delivery {d.sequence}</h4>
            <p className="mt-1 text-sm text-slate-600">Fields with * are needed. Once saved, the proof is changed only by a correction that a Manager approves; every version is kept.</p>
            {view.captureReady && <div className="mt-2"><PositionLine geo={geo} required={view.placeRequired} /></div>}
            <div className="mt-3 grid gap-4 lg:grid-cols-3">
              <div><label className={label} htmlFor="pod-receiver">Receiver name *</label><input id="pod-receiver" value={receiver} onChange={e => setReceiver(e.target.value)} maxLength={160} className={input} placeholder="Person who received the goods" /></div>
              <div><label className={label} htmlFor="pod-mobile">Receiver mobile</label><input id="pod-mobile" value={mobile} onChange={e => setMobile(e.target.value)} inputMode="tel" maxLength={20} className={input} /></div>
              <div><label className={label} htmlFor="pod-document">Receiver's document / DMR no.</label><input id="pod-document" value={doc} onChange={e => setDoc(e.target.value)} maxLength={80} className={input} placeholder="Goods receipt or DMR number, if any" />
                <p className="mt-1 text-xs text-slate-500">Used as the DMR number on the bill. Empty: the proof number is used.</p></div>
              <div><label className={label} htmlFor="pod-quantity">Delivered quantity ({wu}) *</label><input id="pod-quantity" type="number" min="0" step="any" inputMode="decimal" value={quantity} onChange={e => { setQuantity(e.target.value); const v = e.target.value.trim() === '' ? null : Number(e.target.value); setOutcome(outcomeOf(v, plannedQty)); }} className={input} />
                {plannedQty !== null && <p className={`mt-1 text-xs ${short ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>Planned {plannedQty} {wu}.{q !== null && q < plannedQty ? ` Short by ${Number((plannedQty - q).toFixed(3))} ${wu}.` : ''}</p>}</div>
              <div><label className={label} htmlFor="pod-temperature">Temperature at handover ({unitNow('temp')}){ranged ? ' *' : ''}</label><input id="pod-temperature" type="number" step="any" inputMode="decimal" value={temperature} onChange={e => setTemperature(e.target.value)} className={`${input} ${tempOut ? 'border-red-400' : ''}`} />
                {ranged && <p className={`mt-1 text-xs ${tempOut ? 'font-semibold text-red-700' : 'text-slate-500'}`}>Allowed {range}.{tempOut ? ' This reading is outside the range.' : ''}</p>}</div>
              <div><label className={label} htmlFor="pod-odometer">Odometer (km)</label><input id="pod-odometer" type="number" min="0" step="0.1" inputMode="decimal" value={odometer} onChange={e => setOdometer(e.target.value)} className={input} />
                <p className="mt-1 text-xs text-slate-500">Gives the kilometres of this delivery on the bill.</p></div>
              <div><label className={label} htmlFor="pod-at">Delivered at</label><input id="pod-at" type="datetime-local" value={at} max={localNow()} onChange={e => setAt(e.target.value)} className={input} /></div>
              <div className="flex flex-col justify-center gap-2 lg:col-span-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input id="pod-shortage" type="checkbox" checked={shortage} onChange={e => setShortage(e.target.checked)} className="h-4 w-4" />Shortage: less was delivered than sent</label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-800"><input id="pod-damaged" type="checkbox" checked={damaged} onChange={e => setDamaged(e.target.checked)} className="h-4 w-4" />Damage: some goods were damaged or rejected</label>
              </div>
              {/* REQ-POD-003: outcome, reason, and what happens to the goods that were not accepted */}
              {pod && <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:col-span-3 lg:grid-cols-3" data-testid="pod-outcome">
                <div><label className={label} htmlFor="pod-outcome">Outcome *</label>
                  <select id="pod-outcome" value={outcome} className={input} onChange={e => {
                    const o = e.target.value as Outcome;
                    setOutcome(o); setReasonCode('');
                    if (o === 'REFUSED') setQuantity('0');
                    else if (o === 'DELIVERED' && plannedQty !== null && (q === null || q < plannedQty)) setQuantity(String(plannedQty));
                    else if (o === 'PARTLY_DELIVERED' && q === 0) setQuantity('');
                  }}>{OUTCOMES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                  <p className="mt-1 text-xs text-slate-500">0 delivered is Refused. Less than planned is Partly delivered.</p></div>
                {outcome !== 'DELIVERED' && <>
                  <div><label className={label} htmlFor="pod-reason">Reason *</label>
                    <select id="pod-reason" value={reasonCode} onChange={e => setReasonCode(e.target.value)} className={input}>
                      <option value="">Choose the reason</option>
                      {reasons.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
                    </select></div>
                  <div><label className={label} htmlFor="pod-goods">What happens to the goods not accepted *</label>
                    <select id="pod-goods" value={goodsAction} onChange={e => setGoodsAction(e.target.value)} className={input}>
                      <option value="">Choose</option>
                      {GOODS_ACTIONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                    </select>
                    {goodsAction && goodsAction !== 'DESTROYED_AT_SITE' && goodsAction !== 'LEFT_WITH_CUSTOMER' && <p className="mt-1 text-xs text-slate-500">This opens a return. Close it on Proof &amp; Bill Check when the goods are back or delivered again.</p>}</div>
                  {askRefusedQty && <div><label className={label} htmlFor="pod-refused">Quantity not accepted ({wu}) *</label>
                    <input id="pod-refused" type="number" min="0" step="any" inputMode="decimal" value={refusedQty} onChange={e => setRefusedQty(e.target.value)} className={input} />
                    <p className="mt-1 text-xs text-slate-500">The delivered quantity is the full planned quantity, so enter what was not accepted.</p></div>}
                  {!askRefusedQty && plannedQty !== null && q !== null && q < plannedQty && <p className="self-center text-sm text-slate-700">Not accepted: <b>{Number((plannedQty - q).toFixed(3))} {wu}</b></p>}
                  <div className="lg:col-span-3"><label className={label} htmlFor="pod-reason-note">What happened{reason?.needsNote ? ' *' : ''}</label>
                    <input id="pod-reason-note" value={reasonNote} onChange={e => setReasonNote(e.target.value)} maxLength={500} className={input}
                      placeholder={reason?.needsNote ? 'Needed for this reason: write what happened' : 'Optional: what the receiver said'} /></div>
                </>}
              </div>}
              <div className="lg:col-span-3"><label className={label} htmlFor="pod-notes">Notes{needNotes ? ' *' : ''}</label><textarea id="pod-notes" rows={2} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} className={input}
                placeholder={needNotes ? 'What was short or damaged, or what the receiver said about the temperature' : 'Anything the receiver wrote on the delivery note'} />
                {needNotes && <p className="mt-1 flex items-start gap-1 text-xs font-semibold text-amber-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Notes are needed because {short ? 'the quantity is short' : damaged ? 'goods were damaged' : 'the temperature is outside the range'}.</p>}</div>
              {view.captureReady && view.otpEnabled && <div className="lg:col-span-3"><OtpBlock key={d.id} base={base} deliveryId={d.id} mobile={mobile} required={Boolean(view.otpRequired)} latest={d.otp} onVerified={setOtpCode} /></div>}
              {/* REQ-POD-005: the code cannot be used (no SMS service on the server counts too) */}
              {view.captureReady && view.otpFallbackReady && (view.otpRequired || view.otpEnabled) && !otpCode && <div className="lg:col-span-3"><OtpFallbackBlock
                reasons={view.otpFallbackReasons || []} required={Boolean(view.otpRequired)} needsManager={Boolean(view.otpRequired && view.otpFallbackPolicy === 'MANAGER' && !(staff && manager))}
                open={noCode} reason={noCodeReason} note={noCodeNote} onOpen={setNoCode} onReason={setNoCodeReason} onNote={setNoCodeNote} /></div>}
              <div className="lg:col-span-2"><span className={label}>Signature of the receiver{view.requireProof ? ' * (or a photo)' : ''}</span><SignaturePad onChange={setSignature} disabled={busy} /></div>
              <div><label className={label} htmlFor="pod-photos">Photos{view.requireProof ? ' (or a signature)' : ''}</label>
                <input id="pod-photos" ref={file} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => { void pickPhotos(e.target.files); }} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" />
                <p className="mt-1 text-xs text-slate-500">Signed delivery note, unloaded goods. JPG, PNG or WebP, at most {view.maxPhotos}. Large photos are made smaller before they are sent.</p>
                {photos.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-slate-700">{photos.map((p, i) => <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-2"><span className="truncate">{p.name} ({mb(p.size)})</span><button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="font-bold text-red-700 hover:underline">Remove</button></li>)}</ul>}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button disabled={busy} className="rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{busy ? 'Saving...' : needsApproval() ? 'Send to the office for approval' : 'Save proof of delivery'}</button>
              <button type="button" disabled={busy} onClick={() => setOpenId(null)} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700">Not now</button>
            </div>
          </form>}
        </article>;
      })}
      {view.tablesReady && view.deliveries.length === 0 && <p className="text-sm text-slate-500">This trip has no delivery.</p>}
    </div>
  </section>;
}
