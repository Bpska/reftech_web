/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-016 -- the RefTech support view. The platform owner presses "Open company" on the Support screen; the server
// gives a read-only token for that company. It is kept in sessionStorage of a NEW tab only (the owner's own tab and
// login stay as they are) and that tab shows a red banner. api.ts must send the support token when there is one
// (see INTEGRATION.md: activeToken()).
import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export const SUPPORT_TOKEN_KEY = 'reftech_support_token';
export const SUPPORT_USER_KEY = 'reftech_support_user';
const PENDING_KEY = 'reftech_support_pending';
const ASK = 'reftech-support-ask';
const ANSWER = 'reftech-support-answer';

export type SupportOpen = { token: string; grantId: number; tenantId: number; tenantName: string; endsAt: string; user: Record<string, unknown> };

/** The token to send: the support token of this tab, else the normal login. */
export function activeToken(): string | null {
  try { return sessionStorage.getItem(SUPPORT_TOKEN_KEY) || localStorage.getItem('reftech_token'); } catch { return localStorage.getItem('reftech_token'); }
}

/** The support session of this tab, or null. */
export function supportSession(): SupportOpen | null {
  try {
    const t = sessionStorage.getItem(SUPPORT_TOKEN_KEY), u = sessionStorage.getItem(SUPPORT_USER_KEY);
    if (!t || !u) return null;
    return JSON.parse(u) as SupportOpen;
  } catch { return null; }
}

/** The user object for the menus: in a support tab the support login, else the normal one. */
export function supportUser(): Record<string, unknown> | null {
  return supportSession()?.user || null;
}

function store(s: SupportOpen) {
  sessionStorage.setItem(SUPPORT_TOKEN_KEY, s.token);
  sessionStorage.setItem(SUPPORT_USER_KEY, JSON.stringify(s));
}

let lastOpened: SupportOpen | null = null;
let listening = false;

/**
 * Opens the support view in a new tab. The new tab gets the token through a copy of sessionStorage (browsers copy it
 * to a tab opened by window.open) or, when that copy is not made, by asking this tab once (postMessage, same origin).
 */
export function openSupportTab(s: SupportOpen) {
  lastOpened = s;
  if (!listening) {
    listening = true;
    window.addEventListener('message', e => {
      if (e.origin !== window.location.origin || e.data?.type !== ASK || !lastOpened || !e.source) return;
      (e.source as Window).postMessage({ type: ANSWER, data: lastOpened }, window.location.origin);
      lastOpened = null;
    });
  }
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(s));
  const w = window.open('/dashboard?support=1', '_blank');
  sessionStorage.removeItem(PENDING_KEY);
  if (!w) throw new Error('The browser blocked the new tab. Allow pop-ups for this site and press Open again.');
}

/** Run once when a tab starts: takes over a support token handed to this tab. True when the page must reload. */
export function adoptSupport(): Promise<boolean> {
  const url = new URL(window.location.href);
  if (url.searchParams.get('support') !== '1') return Promise.resolve(false);
  const clean = () => { url.searchParams.delete('support'); window.history.replaceState(null, '', url.pathname + url.search + url.hash); };
  const pending = sessionStorage.getItem(PENDING_KEY);
  if (pending) {
    try { store(JSON.parse(pending)); } catch { /* broken copy */ }
    sessionStorage.removeItem(PENDING_KEY);
    clean();
    return Promise.resolve(true);
  }
  if (sessionStorage.getItem(SUPPORT_TOKEN_KEY)) { clean(); return Promise.resolve(false); }
  if (!window.opener) { clean(); return Promise.resolve(false); }
  return new Promise(resolve => {
    const done = (ok: boolean) => { window.removeEventListener('message', onAnswer); clean(); resolve(ok); };
    const onAnswer = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== ANSWER) return;
      store(e.data.data as SupportOpen);
      done(true);
    };
    window.addEventListener('message', onAnswer);
    window.opener.postMessage({ type: ASK }, window.location.origin);
    setTimeout(() => done(false), 3000);
  });
}

/** Ends the support view of this tab and closes it (the owner's own login is not touched). */
export function endSupportView() {
  sessionStorage.removeItem(SUPPORT_TOKEN_KEY);
  sessionStorage.removeItem(SUPPORT_USER_KEY);
  window.close();
  window.location.href = '/dashboard';
}

const at = (v: string) => { const d = new Date(v); return isNaN(d.getTime()) ? v : fmtDateTime(d); };

/**
 * The red banner of a support tab: "RefTech support view of <company> - read only - ends at ...".
 * Put it at the top of AppShell; it shows nothing in a normal tab. It also takes over a token handed to a new tab.
 */
export function SupportBanner() {
  const [s, setS] = useState<SupportOpen | null>(supportSession());
  const [ended, setEnded] = useState(false);
  useEffect(() => { adoptSupport().then(reload => { if (reload) window.location.reload(); }); }, []);
  useEffect(() => {
    if (!s) return;
    const tick = () => { if (new Date(s.endsAt).getTime() < Date.now()) setEnded(true); };
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [s]);
  if (!s) return null;
  return <div role="alert" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 bg-red-700 px-4 py-2 text-sm font-semibold text-white">
    <span className="flex items-center gap-2"><ShieldAlert aria-hidden className="h-5 w-5" />
      {ended ? `The support access to ${s.tenantName} has ended. Close this tab.` : `RefTech support view of ${s.tenantName} - read only - ends at ${at(s.endsAt)}`}
    </span>
    <button type="button" onClick={() => { setS(null); endSupportView(); }} className="rounded-lg bg-white px-3 py-1 text-red-800 hover:bg-red-50">End support view</button>
  </div>;
}
