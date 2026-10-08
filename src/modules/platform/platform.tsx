/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-001, REQ-PLT-001 .. 016 -- what the platform screens share: the status of the scripts and of the login,
// the "run script 60" notice and the page heading.
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/shared/services/api';

export const PLATFORM_SCRIPT = 'database_v2/60_platform.sql (on reftech_hr)';
export const AI_SCRIPT = 'database_v2/61_prediction_layer_reftech_ai.sql (on reftech_ai)';

export type PlatformStatus = { ready: boolean; aiReady: boolean; admin: boolean; owner: boolean; supportSession: boolean; partner: boolean; tenantId?: number };

let cached: PlatformStatus | null = null;

/** The status from /api/platform/status, kept for the page (null while loading). */
export function usePlatform() {
  const [s, setS] = useState<PlatformStatus | null>(cached);
  useEffect(() => {
    if (cached?.ready) return;
    api('/api/platform/status').then((x: PlatformStatus) => { cached = x; setS(x); })
      .catch(() => setS({ ready: false, aiReady: false, admin: false, owner: false, supportSession: false, partner: false }));
  }, []);
  return s;
}
export function forgetPlatform() { cached = null; }

/** Shown while a platform script has not been run yet. */
export function ScriptMissing({ script = PLATFORM_SCRIPT }: { script?: string }) {
  return <div role="status" className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">
    This screen needs the database script <b>{script}</b>. Ask the administrator to run it, then reload.
  </div>;
}

export function PageTitle({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold">{icon}{title}</h1>
    {children && <p className="mt-1 text-slate-600">{children}</p>}
  </>;
}

/** Shown when the login may not open this screen. */
export function NotAllowed({ what }: { what: string }) {
  return <div role="alert" className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">Your login may not {what}.</div>;
}

export const bytes = (n: any) => {
  const v = Number(n || 0);
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
  if (v < 1024 * 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)} MB`;
  return `${(v / 1024 / 1024 / 1024).toFixed(2)} GB`;
};
