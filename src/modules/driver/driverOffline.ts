/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-011 -- Offline capture of the loading checklist, its photos, expenses and fuel on the driver's phone.
//
// The same way as the proof of delivery (pod/podOffline.ts): each capture gets its own reference (clientRef) when
// the driver presses Save. It is sent at once; when the network is down it is kept in this browser (IndexedDB) and
// sent as soon as the network is back. Sending the same reference twice saves it once on the server, so a retry
// after a lost answer is harmless. The server answers:
//   APPLIED   saved
//   CONFLICT  the checklist was changed by the office after the phone read it: nothing saved, check and save again
//   REJECTED  a rule was not met (the message says which): fix it and save again (a new reference)
// Backend: POST /api/mobile/driver/sync, GET /api/mobile/driver/sync?refs= (DriverSyncService).
import { deviceId, isNetworkError, newRef, packFile, QueuedFile } from '@/modules/pod/podOffline';

export { packFile, newRef };

const API_URL = import.meta.env.VITE_API_URL;
const DB = 'reftech-driver', STORE = 'captures';
const ADDRESS = '/api/mobile/driver/sync';

export type DriverKind = 'CHECKLIST' | 'CHECKLIST_PHOTO' | 'EXPENSE' | 'FUEL';
export type SyncAnswer = { status?: string; message?: string; resultId?: number | null; repeated?: boolean };
export type DriverCapture = {
  clientRef: string; kind: DriverKind; tripId: number; deviceId: string; capturedAt: string; baseUpdatedAt?: string | null;
  fields: Record<string, unknown>; file?: QueuedFile | null;
  label: string;                       // shown in the waiting list, e.g. "Expense 250"
  state: 'WAITING' | 'SENT' | 'FAILED'; answer?: SyncAnswer | null; tries: number;
};
export type NewCapture = Omit<DriverCapture, 'state' | 'tries' | 'answer' | 'deviceId' | 'clientRef' | 'capturedAt'> & { clientRef?: string; capturedAt?: string };

export const KIND_LABEL: Record<DriverKind, string> = { CHECKLIST: 'Checklist', CHECKLIST_PHOTO: 'Checklist photo', EXPENSE: 'Expense', FUEL: 'Fuel' };
export const ANSWER_LABEL: Record<string, string> = { APPLIED: 'Saved', CONFLICT: 'Changed by the office meanwhile', REJECTED: 'Refused', UNKNOWN: 'Not received' };

/**
 * What to do with a capture after the server answered with this HTTP status. KEEP: try again later (no network, the
 * sign-in ended, the server failed). SENT: the server answered (APPLIED, CONFLICT or REJECTED are all answers).
 * FAILED: the server refused the request itself (a wrong field); trying again would give the same.
 */
export function afterAnswer(httpStatus: number): 'KEEP' | 'SENT' | 'FAILED' {
  if (httpStatus === 0 || httpStatus === 401 || httpStatus === 408 || httpStatus === 429 || httpStatus >= 500) return 'KEEP';
  return httpStatus >= 200 && httpStatus < 300 ? 'SENT' : 'FAILED';
}

/** The text fields of a form, without the file inputs and empty values. */
export function formFields(form: FormData, skip: string[] = []): Record<string, string> {
  const out: Record<string, string> = {};
  form.forEach((v, k) => { if (typeof v === 'string' && !skip.includes(k) && v.trim() !== '') out[k] = v.trim(); });
  return out;
}

/** The sentence for the driver about one answer. */
export function answerText(a: SyncAnswer | null | undefined, label: string) {
  if (!a) return `${label}: waiting to be sent.`;
  const s = ANSWER_LABEL[a.status || ''] || a.status || 'Answered';
  return `${label}: ${s}${a.repeated ? ' (already saved before)' : ''}${a.message && a.status !== 'APPLIED' ? `. ${a.message}` : ''}`;
}

function open(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    if (typeof indexedDB === 'undefined') { fail(new Error('This browser cannot keep anything offline')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'clientRef' }); };
    r.onsuccess = () => done(r.result);
    r.onerror = () => fail(r.error || new Error('The offline store could not be opened'));
  });
}

async function run<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((done, fail) => {
      const t = db.transaction(STORE, mode);
      const r = work(t.objectStore(STORE));
      t.oncomplete = () => done(r.result);
      t.onerror = () => fail(t.error || new Error('The offline store failed'));
    });
  } finally { db.close(); }
}

export const queuedDriver = () => run<DriverCapture[]>('readonly', s => s.getAll() as IDBRequest<DriverCapture[]>);
const put = (c: DriverCapture) => run('readwrite', s => s.put(c));
export const forgetDriver = (clientRef: string) => run('readwrite', s => s.delete(clientRef));

const listeners = new Set<() => void>();
export function onDriverQueueChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const changed = () => listeners.forEach(f => { try { f(); } catch { /* a closed screen */ } });

async function post(c: DriverCapture): Promise<{ http: number; json: any }> {
  const token = localStorage.getItem('reftech_token');
  const { label: _label, state: _state, answer: _answer, tries: _tries, ...body } = c;
  const r = await fetch(`${API_URL}${ADDRESS}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ ...body, sentAt: new Date().toISOString() }),
  });
  const text = await r.text(); let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
  return { http: r.status, json };
}

/**
 * Sends a capture now. When the network is down (or the server cannot answer) it is kept in this browser and sent
 * later: { queued: true }. Otherwise the server's answer. A request the server refuses outright throws its message.
 */
export async function sendOrKeep(n: NewCapture): Promise<{ queued: boolean; answer?: SyncAnswer }> {
  const c: DriverCapture = { ...n, clientRef: n.clientRef || newRef(), capturedAt: n.capturedAt || new Date().toISOString(), deviceId: deviceId(), state: 'WAITING', tries: 0, answer: null };
  let res: { http: number; json: any };
  try { res = await post(c); }
  catch (x) {
    if (!isNetworkError(x)) throw x;
    await put(c); changed();
    return { queued: true };
  }
  const next = afterAnswer(res.http);
  if (next === 'KEEP') { await put({ ...c, tries: 1, answer: { message: res.json.message || `Not sent yet (${res.http})` } }); changed(); return { queued: true }; }
  if (next === 'FAILED') throw new Error(res.json.message || `Refused (${res.http})`);
  return { queued: false, answer: res.json };
}

let flushing = false;
/** Sends every waiting capture; an answered one is kept with its answer until the driver removes it from the list. */
export async function flushDriver(): Promise<number> {
  if (flushing || !API_URL) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const c of await queuedDriver()) {
      if (c.state !== 'WAITING') continue;
      try {
        const res = await post(c);
        const next = afterAnswer(res.http);
        if (next === 'KEEP') { await put({ ...c, tries: c.tries + 1, answer: { message: res.json.message || `Not sent yet (${res.http})` } }); continue; }
        await put({ ...c, state: next, tries: c.tries + 1, answer: next === 'SENT' ? res.json : { status: 'REJECTED', message: res.json.message || `Refused (${res.http})` } });
        sent++;
      } catch {
        await put({ ...c, tries: c.tries + 1 });
        break;   // still offline
      }
    }
  } finally { flushing = false; changed(); }
  return sent;
}

let started = false;
/** Sends the queue when the network comes back, and every two minutes while something waits. */
export function startDriverSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flushDriver(); });
  window.setInterval(() => { if (navigator.onLine) void queuedDriver().then(q => { if (q.some(c => c.state === 'WAITING')) void flushDriver(); }).catch(() => undefined); }, 120000);
  if (navigator.onLine) void flushDriver().catch(() => undefined);
}
