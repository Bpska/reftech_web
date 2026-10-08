/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
import { fmtDateTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
// REQ-TRP-008, REQ-TRP-009, REQ-TRP-010 -- what the weather screens share: the IMD colour codes and the date format.

export type WeatherLevel = 'NONE' | 'YELLOW' | 'ORANGE' | 'RED';

export type WeatherWarning = {
  id: number; level: WeatherLevel; hazard: string; area: string; state?: string | null;
  validFrom: string; validTo: string; message?: string | null; source?: string | null; issuedAt?: string | null; where?: string | null;
};

export const LEVEL_LABEL: Record<string, string> = { RED: 'Red', ORANGE: 'Orange', YELLOW: 'Yellow', NONE: 'None' };

export const LEVEL_STYLE: Record<string, string> = {
  RED: 'bg-red-100 text-red-800',
  ORANGE: 'bg-orange-100 text-orange-800',
  YELLOW: 'bg-yellow-100 text-yellow-800',
  NONE: 'bg-emerald-100 text-emerald-800',
};

// 06 Oct 06:00
export const shortWhen = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};

export const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);
