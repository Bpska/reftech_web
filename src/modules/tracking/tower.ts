/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
// REQ-TRK-001, REQ-TRK-005 -- what the GPS Connections and Control Tower screens share: the database script,
// times in India time and the colours of priorities and device states.

export const GPS_SCRIPT = 'database_v2/38_req_trk_001_005_gps_control_tower.sql';

/** Date and time in the login's date format and time zone (REQ-PLT-015), for example "06-10-2026 16:03". */
export const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};

/** Minutes as "45 min", "3 h 10 min" or "2 days 4 h". */
export const minutesText = (m?: number | null) => {
  if (m === null || m === undefined || Number.isNaN(Number(m))) return '-';
  const n = Math.max(0, Math.floor(Number(m)));
  if (n < 60) return `${n} min`;
  if (n < 24 * 60) return `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`;
  const d = Math.floor(n / 1440), h = Math.floor((n % 1440) / 60);
  return `${d} day${d === 1 ? '' : 's'}${h ? ` ${h} h` : ''}`;
};

/** Minutes from now until a time (negative when it has passed). */
export const minutesUntil = (v?: string | null) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : Math.round((t - Date.now()) / 60000);
};

export const PRIORITY: Record<string, { label: string; card: string; pill: string }> = {
  CRITICAL: { label: 'Critical', card: 'border-red-300 bg-red-50 text-red-800', pill: 'bg-red-600 text-white' },
  HIGH: { label: 'High', card: 'border-orange-300 bg-orange-50 text-orange-800', pill: 'bg-orange-500 text-white' },
  MEDIUM: { label: 'Medium', card: 'border-amber-300 bg-amber-50 text-amber-800', pill: 'bg-amber-100 text-amber-900' },
  LOW: { label: 'Low', card: 'border-slate-300 bg-slate-50 text-slate-700', pill: 'bg-slate-200 text-slate-700' },
};

export const DEVICE_STATE: Record<string, { label: string; pill: string; help: string }> = {
  ONLINE: { label: 'Online', pill: 'bg-emerald-100 text-emerald-800', help: 'Position received in the last few minutes' },
  LATE: { label: 'Late', pill: 'bg-amber-100 text-amber-800', help: 'No position for a while, but within 24 hours' },
  SILENT: { label: 'Silent', pill: 'bg-red-100 text-red-800', help: 'No position for more than 24 hours' },
  NEVER: { label: 'Never sent', pill: 'bg-slate-200 text-slate-600', help: 'No position has ever been received' },
};

export const pill = 'inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold';
