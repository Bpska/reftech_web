/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-GOV-012 -- DigiLocker documents of a driver (driving licence) or a truck (registration certificate).
// Connected: "Ask on DigiLocker" gives a link the driver or owner opens to sign in and share the document; it comes
// back by itself. Not connected: staff upload the PDF the driver downloaded from DigiLocker. A received driving
// licence also records the consent and a licence check.
// Backend: /api/gov/digilocker (GovRecordsController).
import { FormEvent, useEffect, useState } from 'react';
import { api, apiDownload } from '@/shared/services/api';
import { Banner, btn, btnLight, errorText, input, label } from '@/shared/components/FormKit';
import { day, pill, upload, when, words } from './gov';

export function DigiLockerBox({ subjectType, subjectId, onChanged }: { subjectType: 'DRIVER' | 'VEHICLE'; subjectId: number; onChanged?: () => void }) {
  const [d, setD] = useState<any>(null), [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false);
  const load = () => api(`/api/gov/digilocker?subjectType=${subjectType}&subjectId=${subjectId}`).then(setD).catch(e => setErr(errorText(e, 'The documents could not be read')));
  useEffect(() => { void load(); }, [subjectType, subjectId]);

  async function run(fn: () => Promise<any>, done: (x: any) => string) {
    setBusy(true); setMsg(''); setErr('');
    try { const x = await fn(); setMsg(done(x)); await load(); onChanged?.(); return true; }
    catch (e) { setErr(errorText(e, 'Not saved')); return false; } finally { setBusy(false); }
  }
  const ask = () => run(() => api('/api/gov/digilocker', { method: 'POST', body: JSON.stringify({ subjectType, subjectId }) }),
    x => x.status === 'RECEIVED' ? 'Document received' : x.consentUrl ? 'Send this link to the ' + (subjectType === 'DRIVER' ? 'driver' : 'owner') + ': ' + x.consentUrl : 'Asked');
  async function sendFile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    f.set('subjectType', subjectType); f.set('subjectId', String(subjectId));
    const ok = await run(() => upload('/api/gov/digilocker/upload', f), () => 'Document uploaded');
    if (ok) setUploading(false);
  }

  if (d && d.ready === false) return null;
  const what = subjectType === 'DRIVER' ? 'driving licence' : 'registration certificate';
  return <div className="mt-4 rounded-xl border border-slate-200 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-bold">DigiLocker {what}</h3>
      <div className="flex gap-2">
        {d && d.provider !== 'MANUAL' && <button className={btnLight} disabled={busy} onClick={ask}>Ask on DigiLocker</button>}
        <button className={btnLight} onClick={() => setUploading(!uploading)}>Upload the PDF</button>
      </div>
    </div>
    <Banner msg={msg} error={err} />
    {uploading && <form onSubmit={sendFile} className="mt-2 grid gap-3 md:grid-cols-4">
      <div><span className={label}>File (PDF, JPEG, PNG) *</span><input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png" className={input} /></div>
      <div><span className={label}>Document number *</span><input name="docNumber" required className={input} /></div>
      <div><span className={label}>Valid up to</span><input name="validUpto" type="date" className={input} /></div>
      <div className="flex items-end"><button className={btn} disabled={busy}>Upload</button></div>
    </form>}
    {!d ? <p className="text-sm text-slate-500">Loading...</p> : !d.requests?.length ? <p className="mt-1 text-sm text-slate-500">No DigiLocker document yet.</p> :
      <ul className="mt-2 space-y-1 text-sm">{d.requests.map((r: any) => <li key={r.id} className="flex flex-wrap items-center gap-2">
        <span className={pill(r.status)}>{words(r.status)}</span>
        <span>{r.docNumber || words(r.docType)}{r.holderName ? `, ${r.holderName}` : ''}{r.validUpto ? `, valid up to ${day(r.validUpto)}` : ''}</span>
        <span className="text-xs text-slate-500">{r.receivedAt ? `received ${when(r.receivedAt)}` : `asked ${when(r.requestedAt)} by ${r.requestedByName || '-'}`}{r.error ? `: ${r.error}` : ''}</span>
        {r.status === 'WAITING' && r.consentUrl && <a href={r.consentUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-sky-700 hover:underline">Link for the {subjectType === 'DRIVER' ? 'driver' : 'owner'}</a>}
        {r.status === 'WAITING' && <button className="text-xs font-bold text-red-700 hover:underline" onClick={() => run(() => api(`/api/gov/digilocker/${r.id}/cancel`, { method: 'POST' }), () => 'Request cancelled')}>Cancel</button>}
        {r.hasFile && <button className="text-xs font-bold text-sky-700 hover:underline" onClick={() => apiDownload(`/api/gov/digilocker/${r.id}/file`, r.fileName || 'document').catch(e => setErr(errorText(e, 'Not downloaded')))}>Open file</button>}
      </li>)}</ul>}
  </div>;
}
