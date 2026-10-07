/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-011 -- Offline capture and safe sync.
//
// When the network is down while a proof of delivery is saved, the proof is kept in this browser (IndexedDB)
// and sent as soon as the network is back. The later mobile app uses the same server address and the same rules:
//   - each capture has its own reference (clientRef); sending it twice records it once
//   - each picture carries its SHA-256, so the server refuses a picture that arrived damaged
//   - capturedAt is the moment of the handover; sentAt lets the server correct a phone clock that is wrong
// Backend: POST /api/operations/pod-sync (staff) or /api/mobile/driver/pod-sync (driver), PodSyncService.

const API_URL = import.meta.env.VITE_API_URL;
const DB = 'reftech-pod', STORE = 'captures';
const DEVICE_KEY = 'reftech_device_id';

export type QueuedFile = { fileName: string; contentType: string; base64: string; sha256: string };
export type QueuedCapture = {
  clientRef: string; deviceId: string; tripId: number; deliveryId: number; capturedAt: string;
  fields: Record<string, unknown>; place?: { latitude: number; longitude: number; accuracyM?: number | null } | null;
  signature?: QueuedFile | null; photos: QueuedFile[];
  driver: boolean;                    // true: sent through the driver address
  label: string;                      // shown in the waiting list, e.g. "Trip TRP-1 delivery 2"
  state: 'WAITING' | 'SENT' | 'FAILED'; answer?: { status?: string; message?: string; podNumber?: string } | null; tries: number;
};

export function newRef() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) { id = `web-${newRef()}`; localStorage.setItem(DEVICE_KEY, id); }
    return id;
  } catch { return 'web'; }
}

function open(): Promise<IDBDatabase> {
  return new Promise((done, fail) => {
    if (typeof indexedDB === 'undefined') { fail(new Error('This browser cannot keep a proof offline')); return; }
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

export const queued = () => run<QueuedCapture[]>('readonly', s => s.getAll() as IDBRequest<QueuedCapture[]>);
const put = (c: QueuedCapture) => run('readwrite', s => s.put(c));
export const forget = (clientRef: string) => run('readwrite', s => s.delete(clientRef));

async function sha256(bytes: ArrayBuffer) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function packFile(f: File | Blob, name?: string): Promise<QueuedFile> {
  const bytes = await f.arrayBuffer();
  let bin = '';
  const view = new Uint8Array(bytes);
  for (let i = 0; i < view.length; i += 0x8000) bin += String.fromCharCode(...view.subarray(i, i + 0x8000));
  return { fileName: name || (f instanceof File ? f.name : 'picture.png'), contentType: f.type || 'image/jpeg', base64: btoa(bin), sha256: await sha256(bytes) };
}

/** True when the failure means "no network" (fetch threw), not "the server said no". */
export const isNetworkError = (x: unknown) => x instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);

export async function keep(c: Omit<QueuedCapture, 'state' | 'tries' | 'answer'>) {
  await put({ ...c, state: 'WAITING', tries: 0, answer: null });
}

const listeners = new Set<() => void>();
export function onQueueChange(f: () => void) { listeners.add(f); return () => { listeners.delete(f); }; }
const changed = () => listeners.forEach(f => { try { f(); } catch { /* a closed screen */ } });

let flushing = false;
/**
 * Sends every waiting capture. A capture the server answered (APPLIED, HELD, CONFLICT, REJECTED, or the same
 * reference again) is marked SENT with the answer; a network failure leaves it WAITING for the next try.
 */
export async function flush(): Promise<number> {
  if (flushing || !API_URL) return 0;
  flushing = true;
  let sent = 0;
  try {
    const token = localStorage.getItem('reftech_token');
    for (const c of await queued()) {
      if (c.state === 'SENT') continue;
      const { driver, label: _label, state: _state, answer: _answer, tries: _tries, ...body } = c;
      try {
        const r = await fetch(`${API_URL}${driver ? '/api/mobile/driver/pod-sync' : '/api/operations/pod-sync'}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ ...body, sentAt: new Date().toISOString() }),
        });
        const text = await r.text(); let json: any = {}; try { json = text ? JSON.parse(text) : {}; } catch { json = { message: text }; }
        if (r.status === 401 || r.status >= 500) { await put({ ...c, tries: c.tries + 1, answer: { message: json.message || `Not sent yet (${r.status})` } }); continue; }
        await put({ ...c, state: r.ok ? 'SENT' : 'FAILED', tries: c.tries + 1, answer: r.ok ? json : { status: 'REJECTED', message: json.message || `Refused (${r.status})` } });
        sent++;
      } catch {
        await put({ ...c, tries: c.tries + 1 });
        break;   // still offline: try again when the browser says the network is back
      }
    }
  } finally { flushing = false; changed(); }
  return sent;
}

let started = false;
/** Sends the queue when the network comes back, and every two minutes while something waits. */
export function startSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('online', () => { void flush(); });
  window.setInterval(() => { if (navigator.onLine) void queued().then(q => { if (q.some(c => c.state === 'WAITING')) void flush(); }).catch(() => undefined); }, 120000);
  if (navigator.onLine) void flush().catch(() => undefined);
}
