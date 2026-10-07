/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-004 -- Pre-cooling and loading checklist, shown on the Trip details page.
//
// Before a trip starts, staff record the reefer set-point, the box temperature after pre-cooling, the
// product core temperature at loading, the seal number and at least one photo. "Start Trip" stays
// refused until every rule passes; the server decides (TripChecklistService), this panel only shows
// the rules and their result. After the start the values and photos stay on the trip, read-only.
//
// Backend: /api/operations/trips/{id}/checklist, /checklist/photos, /start (TripChecklistController).
// REQ-GOV-009: on the office page the panel also shows what the government check will find at Start Trip
// (/api/gov/trips/{id}/start-check): "Manager approval" and "Note" items. An approval item not approved yet for
// this trip needs a Manager's tick and a reason, sent with Start Trip (govOverride, govReason) as at Create Trip.
// The driver page does not show it; the server tells the driver to ask the Manager when an approval is needed.
// REQ-TRP-006: the driver page shows the same panel through the driver API. It passes apiBase
// (/api/mobile/driver/trips/{id}); the addresses below that are the same.
// REQ-TRP-011: on the driver page the checklist and its photos are sent with their own reference through the driver
// sync address, so a retry saves once, and they are kept on the phone while the network is down (driverOffline.ts).
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, ClipboardCheck, Play, Trash2, XCircle } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime, fmtTemp, fmtTempRange, toBaseFields, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { GovItem } from '@/modules/gov/GovTripChecksPanel';   // REQ-GOV-009
import { answerText, newRef, packFile, sendOrKeep, startDriverSync } from '@/modules/driver/driverOffline';
import { DriverOfflineQueue } from '@/modules/driver/DriverOfflineQueue';

type Values = { reeferSetpointC?: number | null; boxTempC?: number | null; productCoreTempC?: number | null; sealNumber?: string | null; remarks?: string | null; checkedBy?: string | null; updatedAt?: string | null; lockedAt?: string | null };
type Photo = { id: number; photoType: string; fileName?: string | null; sizeBytes: number; uploadedBy?: string | null; uploadedAt?: string | null };
type Check = { code: string; label: string; ok: boolean; problem?: string };
type View = {
  tripId: number; tripNumber?: string; tripStatus: string; minC?: number | null; maxC?: number | null; targetC?: number | null; profileName?: string | null;
  minPhotos: number; maxPhotos: number; startedAt?: string | null; tablesReady: boolean; message?: string;
  checklist: Values | null; photos: Photo[]; checks: Check[]; blockers: string[]; warnings: string[]; canEdit: boolean; canStart: boolean;
  tripStage?: string; odometerNeeded?: boolean;   // REQ-TRP-001
};

const API_URL = import.meta.env.VITE_API_URL;
const PHOTO_TYPES: [string, string][] = [['REEFER_DISPLAY', 'Reefer display'], ['PRODUCT', 'Product / probe'], ['SEAL', 'Seal'], ['OTHER', 'Other']];
const photoLabel = (t: string) => (PHOTO_TYPES.find(x => x[0] === t) || ['', t])[1];
const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const num = (v?: number | null) => (v === null || v === undefined ? '' : String(Number(v)));
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);
const authHeader = (): Record<string, string> => { const t = localStorage.getItem('reftech_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

/** A photo is fetched with the sign-in token (an <img> tag alone cannot send it) and shown from memory. */
function PhotoThumb({ base, photo, onRemove }: { base: string; photo: Photo; onRemove?: () => void }) {
  const [src, setSrc] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let url = '', gone = false;
    fetch(`${API_URL}${base}/checklist/photos/${photo.id}`, { headers: authHeader() })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => { if (gone) return; url = URL.createObjectURL(b); setSrc(url); })
      .catch(() => { if (!gone) setFailed(true); });
    return () => { gone = true; if (url) URL.revokeObjectURL(url); };
  }, [base, photo.id]);
  return <figure className="w-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
    {src
      ? <a href={src} target="_blank" rel="noreferrer" title="Open the photo in a new tab"><img src={src} alt={`${photoLabel(photo.photoType)} photo`} className="h-28 w-40 object-cover" /></a>
      : <div className="flex h-28 w-40 items-center justify-center text-xs text-slate-500">{failed ? 'Photo could not be loaded' : 'Loading...'}</div>}
    <figcaption className="flex items-start justify-between gap-1 px-2 py-1.5 text-xs">
      <span><b className="text-slate-800">{photoLabel(photo.photoType)}</b><br /><span className="text-slate-500">{when(photo.uploadedAt)}{photo.uploadedBy ? `, ${photo.uploadedBy}` : ''}</span></span>
      {onRemove && <button type="button" onClick={onRemove} title="Remove this photo" aria-label={`Remove ${photoLabel(photo.photoType)} photo`} className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}
    </figcaption>
  </figure>;
}

// REQ-TRP-001: Start Trip asks for the odometer reading at start. Saving the checklist moves a Planned trip to
// Loading on the server, so the page is told (onChanged) to read the trip status again.
export function TripChecklistPanel({ tripId, refreshKey, onStarted, onChanged, apiBase }: { tripId: number; refreshKey?: number; onStarted: (message: string) => void; onChanged?: () => void; apiBase?: string }) {
  const base = apiBase || `/api/operations/trips/${tripId}`;
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState({ reeferSetpointC: '', boxTempC: '', productCoreTempC: '', sealNumber: '', remarks: '' });
  const [dirty, setDirty] = useState(false);
  const [photoType, setPhotoType] = useState('REEFER_DISPLAY');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [odometer, setOdometer] = useState('');
  const file = useRef<HTMLInputElement>(null);
  // REQ-GOV-009: the government check at the start (office page only) and the Manager's approval of it
  const [gov, setGov] = useState<any>(null);
  const [govOverride, setGovOverride] = useState(false);
  const [govReason, setGovReason] = useState('');
  const loadGov = useCallback(() => {
    if (apiBase) return;
    api(`/api/gov/trips/${tripId}/start-check`).then(setGov).catch(() => setGov(null));   // the start itself still checks
  }, [tripId, apiBase]);
  const driver = Boolean(apiBase);
  const saveRef = useRef('');   // REQ-TRP-011: one reference per filled checklist, kept when Save is pressed again
  useEffect(() => { if (driver) startDriverSync(); }, [driver]);

  const show = useCallback((v: View, keepForm = false) => {
    setView(v);
    if (!keepForm) {
      const c = v.checklist || {};
      // REQ-PLT-015: the boxes show and take the login's temperature unit; the request carries °C
      setForm({ reeferSetpointC: toShown('temp', c.reeferSetpointC), boxTempC: toShown('temp', c.boxTempC), productCoreTempC: toShown('temp', c.productCoreTempC), sealNumber: c.sealNumber || '', remarks: c.remarks || '' });
      setDirty(false);
    }
  }, []);
  const load = useCallback(async (keepForm = false) => {
    try { show(await api(`${base}/checklist`), keepForm); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the checklist') }); }
  }, [tripId, show]);
  // A reload asked by the page (the trip moved a step, another panel saved something) must not wipe what was
  // typed here and not saved yet: for the same trip with unsaved input only the rules and photos are read again.
  const dirtyNow = useRef(false);
  dirtyNow.current = dirty;
  const shownTrip = useRef<number | null>(null);
  useEffect(() => {
    const sameTrip = shownTrip.current === tripId;
    shownTrip.current = tripId;
    if (sameTrip && dirtyNow.current) { void load(true); return; }
    setView(null); setMsg(null); void load();
  }, [load, refreshKey]);
  const viewStatus = view?.tripStatus;
  useEffect(() => {   // REQ-GOV-009: read the government check while the trip has not started
    if (viewStatus === 'PLANNED' || viewStatus === 'SCHEDULED') loadGov(); else setGov(null);
  }, [viewStatus, refreshKey, loadGov]);

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm(f => ({ ...f, [k]: e.target.value })); setDirty(true); saveRef.current = ''; };

  /** REQ-TRP-011: the driver's checklist goes through the sync address; kept on the phone when there is no network. */
  async function saveAsDriver() {
    if (!saveRef.current) saveRef.current = newRef();
    const r = await sendOrKeep({ clientRef: saveRef.current, kind: 'CHECKLIST', tripId, fields: toBaseFields({ ...form }, { reeferSetpointC: 'temp', boxTempC: 'temp', productCoreTempC: 'temp' }), baseUpdatedAt: view?.checklist?.updatedAt || null, label: 'Checklist' });
    if (r.queued) { setDirty(false); setMsg({ ok: true, text: 'No network. The checklist is kept on this phone and sent as soon as the network is back.' }); return; }
    const ok = r.answer?.status === 'APPLIED';
    if (ok) { saveRef.current = ''; await load(); onChanged?.(); } else { saveRef.current = ''; await load(true); }
    setMsg({ ok, text: ok ? 'Checklist saved.' : answerText(r.answer, 'Checklist') });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    if (driver) {
      try { await saveAsDriver(); }
      catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not save the checklist') }); }
      finally { setBusy(false); }
      return;
    }
    try { show(await api(`${base}/checklist`, { method: 'PUT', body: JSON.stringify(toBaseFields(form, { reeferSetpointC: 'temp', boxTempC: 'temp', productCoreTempC: 'temp' })) })); setMsg({ ok: true, text: 'Checklist saved.' }); onChanged?.(); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not save the checklist') }); }
    finally { setBusy(false); }
  }

  async function addPhoto(f: File | undefined) {
    if (!f) return;
    setBusy(true); setMsg(null);
    if (driver) {   // REQ-TRP-011: with its own reference; kept on the phone when there is no network
      try {
        const r = await sendOrKeep({ kind: 'CHECKLIST_PHOTO', tripId, fields: { photoType }, file: await packFile(f), label: `${photoLabel(photoType)} photo` });
        if (r.queued) setMsg({ ok: true, text: `No network. The ${photoLabel(photoType).toLowerCase()} photo is kept on this phone and sent as soon as the network is back.` });
        else { await load(true); setMsg({ ok: r.answer?.status === 'APPLIED', text: r.answer?.status === 'APPLIED' ? `${photoLabel(photoType)} photo added.` : answerText(r.answer, 'Photo') }); }
      } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not add the photo') }); }
      finally { setBusy(false); if (file.current) file.current.value = ''; }
      return;
    }
    try {
      const body = new FormData(); body.append('photo', f); body.append('photoType', photoType);
      const r = await fetch(`${API_URL}${base}/checklist/photos`, { method: 'POST', headers: authHeader(), body });
      const text = await r.text(); let json: { message?: string } = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
      if (!r.ok) throw new Error(json.message || `Photo upload failed (${r.status})`);
      await load(true);
      setMsg({ ok: true, text: `${photoLabel(photoType)} photo added.` });
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not add the photo') }); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  }

  async function removePhoto(p: Photo) {
    setBusy(true); setMsg(null);
    try { await api(`${base}/checklist/photos/${p.id}`, { method: 'DELETE' }); await load(true); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not remove the photo') }); }
    finally { setBusy(false); }
  }

  async function start() {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { startOdometerKm: odometer.trim() };
      if (govOverride) { body.govOverride = true; body.govReason = govReason.trim(); }
      const r = await api(`${base}/start`, { method: 'POST', body: JSON.stringify(body) });
      const warn = (r.warnings || []).length ? ` Note: ${(r.warnings as string[]).join(' ')}` : '';
      onStarted(`${r.tripNumber || 'Trip'} has started.${warn}`);
      await load();
    } catch (x) { await load(true); loadGov(); setMsg({ ok: false, text: errorText(x, 'The trip could not be started') }); }   // the rules are read again: one of them changed
    finally { setBusy(false); }
  }

  const card = 'mt-4 rounded-2xl bg-white p-5 shadow-sm';
  const heading = <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><ClipboardCheck className="h-5 w-5 text-sky-700" />Pre-cooling and loading checklist</h2>;
  if (!view) return <section className={card}>{heading}{msg ? <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-800">{msg.text}</p> : <p className="mt-3 text-sm text-slate-500">Loading...</p>}</section>;
  if (!view.tablesReady) return <section className={card}>{heading}<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{view.message}</p></section>;

  const c = view.checklist;
  const range = view.minC != null && view.maxC != null ? fmtTempRange(view.minC, view.maxC) : view.maxC != null ? `at most ${fmtTemp(view.maxC)}` : view.minC != null ? `at least ${fmtTemp(view.minC)}` : '';
  const planned = view.tripStatus === 'PLANNED' || view.tripStatus === 'SCHEDULED';
  const state = !planned ? (c ? ['Recorded', 'bg-sky-100 text-sky-800'] : ['Not recorded', 'bg-slate-200 text-slate-700'])
    : view.blockers.length === 0 ? ['Ready to start', 'bg-emerald-100 text-emerald-800'] : c ? ['Incomplete', 'bg-amber-100 text-amber-800'] : ['Not filled in', 'bg-amber-100 text-amber-800'];
  const fact = (name: string, value: string) => <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{name}</dt><dd className="mt-0.5 font-semibold text-slate-900">{value || '-'}</dd></div>;

  return <section id="loading-checklist" className={`${card} scroll-mt-6`}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">{heading}<span className={`rounded-full px-3 py-1 text-xs font-bold ${state[1]}`}>{state[0]}</span></div>
      <p className="text-sm text-slate-600">{range ? <>This trip needs <b className="text-slate-900">{range}</b>{view.profileName ? ` (${view.profileName})` : ''}.</> : 'This trip has no temperature range.'}</p>
    </div>
    {msg && <div role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}
    {!planned && !c && <p className="mt-3 text-sm text-slate-500">No loading checklist was recorded for this trip.</p>}
    {driver && <DriverOfflineQueue tripId={tripId} kinds={['CHECKLIST', 'CHECKLIST_PHOTO']} onSent={() => { void load(true); }} />}

    {(planned || c) && <div className="mt-4 grid gap-5 xl:grid-cols-3">
      {/* ---------------------------------------------------------------- values */}
      <div className="xl:col-span-2">
        {view.canEdit
          ? <form onSubmit={save}>
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className={label} htmlFor="cl-setpoint">Reefer set-point ({unitNow('temp')}){range ? ' *' : ''}</label><input id="cl-setpoint" type="number" step="any" value={form.reeferSetpointC} onChange={set('reeferSetpointC')} className={input} placeholder="Shown on the reefer unit" /></div>
              <div><label className={label} htmlFor="cl-box">Box temperature after pre-cooling ({unitNow('temp')}){range ? ' *' : ''}</label><input id="cl-box" type="number" step="any" value={form.boxTempC} onChange={set('boxTempC')} className={input} placeholder={range ? `Must be ${range}` : ''} /></div>
              <div><label className={label} htmlFor="cl-core">Product core temperature at loading ({unitNow('temp')}){range ? ' *' : ''}</label><input id="cl-core" type="number" step="any" value={form.productCoreTempC} onChange={set('productCoreTempC')} className={input} placeholder="Probe reading" /></div>
              <div><label className={label} htmlFor="cl-seal">Seal number *</label><input id="cl-seal" value={form.sealNumber} onChange={set('sealNumber')} maxLength={60} className={input} /></div>
              <div className="md:col-span-2"><label className={label} htmlFor="cl-remarks">Remarks</label><textarea id="cl-remarks" rows={2} value={form.remarks} onChange={set('remarks')} maxLength={500} className={input} placeholder="Needed when the product is outside the range" /></div>
            </div>
            <button disabled={busy} className="mt-3 rounded-xl bg-cyan-700 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save checklist'}</button>
            {dirty && <span className="ml-3 text-sm text-amber-700">Changes not saved yet.</span>}
          </form>
          : c && <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4">
            {fact('Reefer set-point', c.reeferSetpointC != null ? fmtTemp(c.reeferSetpointC) : '')}
            {fact('Box after pre-cooling', c.boxTempC != null ? fmtTemp(c.boxTempC) : '')}
            {fact('Product core at loading', c.productCoreTempC != null ? fmtTemp(c.productCoreTempC) : '')}
            {fact('Seal number', c.sealNumber || '')}
            <div className="col-span-2">{fact('Remarks', c.remarks || '')}</div>
            {fact('Recorded by', c.checkedBy || '')}
            {fact('Recorded at', when(c.updatedAt))}
          </dl>}

        {/* ---------------------------------------------------------------- photos */}
        <h3 className="mt-5 flex items-center gap-2 font-bold text-slate-900"><Camera className="h-4 w-4 text-sky-700" />Photos ({view.photos.length})</h3>
        {view.photos.length === 0 && <p className="mt-1 text-sm text-slate-500">{view.canEdit ? `No photo yet. At least ${view.minPhotos} is needed, for example the reefer display and the seal.` : 'No photo was recorded.'}</p>}
        <div className="mt-2 flex flex-wrap gap-3">{view.photos.map(p => <PhotoThumb key={p.id} base={base} photo={p} onRemove={view.canEdit && !busy ? () => { void removePhoto(p); } : undefined} />)}</div>
        {view.canEdit && view.photos.length < view.maxPhotos && <div className="mt-3 flex flex-wrap items-end gap-3">
          <div><label className={label} htmlFor="cl-photo-type">The photo shows</label><select id="cl-photo-type" value={photoType} onChange={e => setPhotoType(e.target.value)} className={input}>{PHOTO_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>
          <div><label className={label} htmlFor="cl-photo-file">Add a photo (JPG or PNG, up to 3 MB)</label><input id="cl-photo-file" ref={file} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { void addPhoto(e.target.files?.[0]); }} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:font-semibold file:text-slate-800" /></div>
        </div>}
      </div>

      {/* ---------------------------------------------------------------- rules and start */}
      {planned && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-bold text-slate-900">Before the trip can start</h3>
        <ul className="mt-2 space-y-1.5 text-sm">{view.checks.map(k => <li key={k.code} className="flex items-start gap-2">
          {k.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
          <span className={k.ok ? 'text-slate-700' : 'font-semibold text-red-800'}>{k.ok ? k.label : k.problem}</span>
        </li>)}</ul>
        {view.warnings.map(w => <p key={w} className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}
        {/* REQ-GOV-009: what the government check will find at the start */}
        {gov && gov.ready !== false && (gov.items || []).length > 0 && <div className={`mt-3 rounded-xl p-3 text-sm ${gov.refused ? 'bg-red-50 text-red-900' : gov.needsApproval ? 'bg-amber-50 text-amber-900' : 'bg-sky-50 text-sky-900'}`}>
          <b>Government check: {gov.refused ? 'the trip cannot start.' : gov.needsApproval ? 'a Manager\'s approval is needed to start.' : 'allowed, with notes.'}</b>
          <ul className="mt-1 space-y-1">{(gov.items as any[]).map((i, n) => <GovItem key={n} i={i} />)}</ul>
          {!gov.refused && gov.needsApproval && view.canEdit && (gov.canApprove
            ? <div className="mt-2 grid gap-2 md:grid-cols-2">
              <label className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={govOverride} onChange={e => setGovOverride(e.target.checked)} />Approve the government check</label>
              <div><label className={label} htmlFor="start-gov-reason">Reason (at least {gov.minReasonLength || 10} letters) *</label><input id="start-gov-reason" value={govReason} onChange={e => setGovReason(e.target.value)} maxLength={500} className={input} placeholder="Permit renewal applied, receipt in the cab" /></div>
            </div>
            : <p className="mt-1">Ask a Manager to approve it (Government checks below), or to start the trip.</p>)}
        </div>}
        {view.canEdit && <>
          {/* REQ-TRP-001: the odometer reading of the truck when it leaves */}
          {view.odometerNeeded && <div className="mt-4 max-w-xs">
            <label className={label} htmlFor="start-odometer">Odometer at start (km) *</label>
            <input id="start-odometer" type="number" min="0" step="0.1" inputMode="decimal" value={odometer} onChange={e => setOdometer(e.target.value)} className={input} placeholder="for example 48210" />
          </div>}
          <button type="button" onClick={() => { void start(); }} disabled={busy || dirty || !view.canStart || (Boolean(view.odometerNeeded) && !odometer.trim())}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"><Play className="h-4 w-4" />Start Trip</button>
          <p className="mt-2 text-xs text-slate-600">{dirty ? 'Save the checklist first.' : !view.canStart ? 'Start Trip is available when every line above is green.' : view.odometerNeeded && !odometer.trim() ? 'Type the odometer reading, then press Start Trip.' : 'The trip moves to In transit. The checklist cannot be changed after that.'}</p>
        </>}
      </div>}
      {!planned && view.warnings.length > 0 && <div>{view.warnings.map(w => <p key={w} className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{w}</p>)}</div>}
    </div>}
  </section>;
}
