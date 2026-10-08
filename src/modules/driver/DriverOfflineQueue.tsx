/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-011 -- the checklist, photos, expenses and fuel of this trip kept on the phone while the network was down,
// and what the server answered when they were sent (driverOffline.ts).
import { useCallback, useEffect, useState } from 'react';
import { CloudOff } from 'lucide-react';
import { answerText, DriverCapture, DriverKind, flushDriver, forgetDriver, onDriverQueueChange, queuedDriver } from './driverOffline';

const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/** kinds: which captures to show (the checklist panel shows its own, the expenses card its own). */
export function DriverOfflineQueue({ tripId, kinds, onSent }: { tripId: number; kinds: DriverKind[]; onSent?: () => void }) {
  const [list, setList] = useState<DriverCapture[]>([]), [busy, setBusy] = useState(false);
  const key = kinds.join(',');
  const load = useCallback(async () => {
    try { setList((await queuedDriver()).filter(c => c.tripId === tripId && key.split(',').includes(c.kind))); } catch { setList([]); }
  }, [tripId, key]);
  useEffect(() => { void load(); return onDriverQueueChange(() => { void load(); onSent?.(); }); }, [load, onSent]);
  if (list.length === 0) return null;
  const waiting = list.filter(c => c.state === 'WAITING').length;
  return <div data-testid="driver-offline" className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
    <p className="flex items-center gap-1 font-semibold text-amber-900"><CloudOff className="h-4 w-4" />{waiting ? `${waiting} kept on this phone, sent when the network is back.` : 'Sent from this phone:'}</p>
    <ul className="mt-1 space-y-1">{list.map(c => <li key={c.clientRef} className="flex flex-wrap items-center justify-between gap-2">
      <span className={c.answer?.status === 'CONFLICT' || c.answer?.status === 'REJECTED' || c.state === 'FAILED' ? 'font-semibold text-red-800' : ''}>
        {c.state === 'WAITING' ? `${c.label}: waiting since ${when(c.capturedAt)}${c.tries ? ` (tried ${c.tries} times)` : ''}` : answerText(c.answer, c.label)}</span>
      {c.state !== 'WAITING' && <button type="button" onClick={() => { void forgetDriver(c.clientRef).then(load); }} className="text-xs font-bold text-sky-700 hover:underline">Remove from list</button>}
      {c.state === 'WAITING' && <button type="button" onClick={() => { if (window.confirm('Delete this from the phone? It has not reached the office.')) void forgetDriver(c.clientRef).then(load); }} className="text-xs font-bold text-red-700 hover:underline">Delete</button>}
    </li>)}</ul>
    {waiting > 0 && <button type="button" disabled={busy} onClick={() => { setBusy(true); void flushDriver().finally(() => setBusy(false)); }} className="mt-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-50">{busy ? 'Sending...' : 'Send now'}</button>}
  </div>;
}
