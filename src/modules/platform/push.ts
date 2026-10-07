/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-003 -- browser push for the notification centre: registers the service worker (/sw.js), asks the
// browser for permission, subscribes with the server's VAPID public key and tells the server
// (/api/platform/notifications/push/*). Pure helpers so the settings screen stays small.
import { api } from '@/shared/services/api';

export type PushState = { ready: boolean; publicKey?: string; devices?: number; thisBrowser?: boolean; message?: string };

/** Why push cannot work in this browser, or null when it can. */
export function pushProblem(w: any = typeof window === 'undefined' ? undefined : window): string | null {
  if (!w) return 'Push needs a browser.';
  if (!w.isSecureContext) return 'Push works only on a secure (https) address of the portal.';
  if (!('serviceWorker' in w.navigator) || !('PushManager' in w) || !('Notification' in w))
    return 'This browser cannot receive push messages. On an iPhone, add the portal to the home screen first (iOS 16.4 or newer).';
  if (w.Notification.permission === 'denied') return 'Notifications are blocked for this site. Allow them in the browser settings, then try again.';
  return null;
}

/** The VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function keyBytes(base64url: string): Uint8Array {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4);
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return navigator.serviceWorker.ready;
}

/** The subscription of this browser, or null. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushProblem()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

/** What the server knows about push for this login and this browser. */
export async function pushState(): Promise<PushState> {
  const sub = await currentSubscription().catch(() => null);
  return api(`/api/platform/notifications/push${sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : ''}`);
}

/** Switches push on for this browser. */
export async function enablePush(): Promise<PushState> {
  const problem = pushProblem();
  if (problem) throw new Error(problem);
  const state: PushState = await api('/api/platform/notifications/push');
  if (!state.ready || !state.publicKey) throw new Error(state.message || 'Push is not set up on the server.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('The browser did not allow notifications. Allow them for this site and try again.');
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  // a subscription made with another server key is replaced
  if (sub && sub.options?.applicationServerKey) {
    const had = new Uint8Array(sub.options.applicationServerKey as ArrayBuffer), want = keyBytes(state.publicKey);
    if (had.length !== want.length || had.some((b, i) => b !== want[i])) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(state.publicKey) });
  return api('/api/platform/notifications/push/subscribe', { method: 'POST', body: JSON.stringify(sub.toJSON()) });
}

/** Switches push off for this browser (the server stops sending; the browser forgets the subscription). */
export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription();
  if (!sub) return api('/api/platform/notifications/push');
  const out = await api('/api/platform/notifications/push/unsubscribe', { method: 'POST', body: JSON.stringify({ endpoint: sub.endpoint }) });
  await sub.unsubscribe().catch(() => false);
  return out;
}

export function testPush(): Promise<PushState> {
  return api('/api/platform/notifications/push/test', { method: 'POST' });
}
