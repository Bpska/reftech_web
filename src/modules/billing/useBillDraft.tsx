/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-005 -- bill drafts saved as you type.
//
// The form's state is written to this browser at once (so a closed tab, a lost network or the 10-minute session
// timeout loses nothing) and to the server a few seconds after the last change (so the person can carry on from
// another computer; the save also keeps the session alive while they type). When the form is opened again and a
// draft is found, a notice offers Restore or Discard. The draft is removed when the bill is submitted.
// Backend: /api/billing/drafts (BillDraftController); without script 45 only the browser copy is kept.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, currentUser } from '@/shared/services/api';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Saved<T> = { value: T; savedAt: string; title?: string };
const SERVER_DELAY_MS = 4000;

function localKey(key: string) { return `reftech_draft_${currentUser()?.id ?? currentUser()?.userId ?? 'me'}_${key}`; }
function readLocal<T>(key: string): Saved<T> | null {
  try { const x = localStorage.getItem(localKey(key)); return x ? JSON.parse(x) : null; } catch { return null; }
}
const timeOf = (iso?: string) => { const d = iso ? new Date(iso.replace(' ', 'T')) : null; return d && !isNaN(d.getTime()) ? fmtDateTime(d) : ''; };

/**
 * key: one per form ("create-bill", "per-ton-bill"). value: what to keep. enabled: false while the form is closed.
 * isEmpty: an untouched form is not saved (and does not overwrite a draft).
 */
export function useBillDraft<T>(key: string, value: T, { enabled, isEmpty, title }: { enabled: boolean; isEmpty: (v: T) => boolean; title?: string }) {
  const [found, setFound] = useState<Saved<T> | null>(null);
  const [status, setStatus] = useState('');
  const decided = useRef(false), serverOk = useRef(true), timer = useRef<number | undefined>(undefined);

  // Look for a draft once the form opens: the newer of the browser copy and the server copy.
  useEffect(() => {
    if (!enabled || decided.current) return;
    let gone = false;
    const local = readLocal<T>(key);
    api(`/api/billing/drafts/${key}`).then((r: any) => {
      if (gone) return;
      if (r?.ready === false) serverOk.current = false;
      let best = local;
      const d = r?.draft;
      if (d?.payload) {
        try {
          const server: Saved<T> = { value: JSON.parse(d.payload), savedAt: String(d.savedAt), title: d.title };
          if (!best || new Date(server.savedAt.replace(' ', 'T')).getTime() > new Date(best.savedAt).getTime()) best = server;
        } catch { /* a broken server copy is ignored */ }
      }
      setFound(best && !isEmpty(best.value) ? best : null);
      if (!best || isEmpty(best.value)) decided.current = true;
    }).catch(() => { if (!gone) { setFound(local && !isEmpty(local.value) ? local : null); if (!local) decided.current = true; } });
    return () => { gone = true; };
  }, [enabled, key]);

  // Save as the person types (not before they chose Restore or Discard for an old draft).
  const text = JSON.stringify(value);
  useEffect(() => {
    if (!enabled || !decided.current || isEmpty(value)) return;
    const savedAt = new Date().toISOString();
    try { localStorage.setItem(localKey(key), JSON.stringify({ value, savedAt, title })); } catch { /* storage full: the server copy still works */ }
    setStatus(`Draft kept in this browser ${timeOf(savedAt)}`);
    window.clearTimeout(timer.current);
    if (!serverOk.current) return;
    timer.current = window.setTimeout(() => {
      api(`/api/billing/drafts/${key}`, { method: 'PUT', body: JSON.stringify({ title, payload: text }) })
        .then((r: any) => { if (r?.ready === false) serverOk.current = false; else setStatus(`Draft saved ${timeOf(r?.savedAt) || timeOf(new Date().toISOString())}`); })
        .catch((e: any) => setStatus(`Draft kept in this browser only (${e?.message || 'server not reached'})`));
    }, SERVER_DELAY_MS);
    return () => window.clearTimeout(timer.current);
  }, [enabled, text]);

  /** Forget the draft (after submit, or Discard). */
  const clear = useCallback(() => {
    window.clearTimeout(timer.current);
    try { localStorage.removeItem(localKey(key)); } catch { /* nothing */ }
    if (serverOk.current) api(`/api/billing/drafts/${key}`, { method: 'DELETE' }).catch(() => undefined);
    setFound(null); setStatus(''); decided.current = true;
  }, [key]);

  /** Take the found draft; the caller puts it into the form. */
  const restore = useCallback(() => { const v = found?.value ?? null; setFound(null); decided.current = true; return v; }, [found]);

  return { found, foundAt: found ? timeOf(found.savedAt) : '', status, restore, clear };
}

/** The "a draft was found" notice and the small "saved" line. */
export function DraftNotice({ found, foundAt, status, onRestore, onDiscard }: { found: unknown; foundAt: string; status: string; onRestore: () => void; onDiscard: () => void }) {
  if (found) return <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
    <span className="flex-1">You have an unfinished bill{foundAt ? ` from ${foundAt}` : ''}. Carry on with it?</span>
    <button type="button" onClick={onRestore} className="rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-800">Restore draft</button>
    <button type="button" onClick={onDiscard} className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">Discard</button>
  </div>;
  return status ? <div className="mb-2 text-right text-xs text-slate-500">{status}</div> : null;
}
