/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-003 .. 007, 009 -- what the tabs of the Dispatch Plan page of a trip share: the tab props, the
// "busy / saved / error" state of an action, the reason an approved trip asks for, and a list of problems.
//
// Backend: DispatchPlanController (/api/dispatch/trips/{id}/plan and the endpoints of each tab). A trip a Manager
// approved is frozen: only a Manager or Admin may change its plan, with a reason (PlanEdit).
import { createElement, useState } from 'react';
import { errorText } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export { role, when, iso, indiaDay, localInput, plain, APPROVAL_TEXT, APPROVAL_STYLE } from '../dispatch';

/** What every tab gets from the page: the whole plan of the trip and a way to read it again. */
export type TabProps = { tripId: number; plan: any; reload: () => Promise<void> };

/** true when the trip is approved (and so frozen: changes need a Manager and a reason). */
export const approved = (plan: any) => plan?.route?.approval === 'APPROVED';

/** true while the plan of the trip can change (planned or loading). */
export const open = (plan: any) => !!plan?.route?.canEdit;

/**
 * The reason for a change: asked only when the trip is approved. Returns null when the user cancels,
 * '' when no reason is needed.
 */
export function reasonFor(plan: any, what: string): string | null {
  if (!approved(plan)) return '';
  const r = window.prompt(`The trip is approved. Reason for ${what}:`);
  return r === null ? null : r.trim();
}

/** Asks for a reason that is always needed (cancel a slot, a note, a gate pass). null when cancelled. */
export function askFor(what: string): string | null {
  const r = window.prompt(`Reason for ${what}:`);
  return r === null ? null : r.trim();
}

/** JSON body for api(). */
export const send = (method: 'POST' | 'PUT' | 'DELETE', body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

/** busy / message / error of the actions of a tab; run() does the call, shows its message and reloads the plan. */
export function useAction(reload: () => Promise<void>) {
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(''), [err, setErr] = useState('');
  async function run(fn: () => Promise<any>, fallback = 'Not saved'): Promise<any> {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = await fn();
      setMsg(r?.message || 'Saved');
      await reload();
      return r ?? {};
    } catch (e) {
      setErr(errorText(e, fallback));
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, err, setMsg, setErr, run };
}

/** "45 min", "2 h 5 min". */
export const minutes = (m?: number | null) => {
  if (m === null || m === undefined) return '-';
  const n = Math.round(Number(m));
  return n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${n % 60} min`;
};

/** ₹ amount without decimals, or '-'. */
export const rupee = (v: unknown) => fmtMoney(v as any, 0);

/** "PICKUP" -> "Pickup", "START_LOADING" -> "Start loading". */
export const words = (v?: string | null) => (v ? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : '-');

/** A red (or amber) list of problems; nothing when empty. */
export function Problems({ items, title, tone = 'red' }: { items?: string[] | null; title?: string; tone?: 'red' | 'amber' }) {
  if (!items?.length) return null;
  const style = tone === 'red' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900';
  return createElement('div', { className: `my-3 rounded-xl p-3 text-sm ${style}` },
    title ? createElement('div', { className: 'mb-1 font-bold' }, title) : null,
    createElement('ul', { className: 'list-disc space-y-0.5 pl-5' }, items.map((p, i) => createElement('li', { key: i }, p))));
}
