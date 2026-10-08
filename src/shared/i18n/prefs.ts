/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- the language, units and display choices of the login, as the screens use them.
// The server answers GET /api/platform/preferences with {ready, values, company, personal, options} (backend
// platform/prefs/Preferences.java). The last answer is kept in localStorage so the first paint already uses it.
// Pure module: no React here (see PrefsProvider.tsx), so the tests can run it.

export type Lang = 'en' | 'hi' | 'or';

export type Prefs = {
  language: Lang;
  timeZone: string;
  currency: string;
  currencyDisplay: 'SYMBOL' | 'CODE';
  weightUnit: 'TON' | 'KG';
  temperatureUnit: 'C' | 'F';
  distanceUnit: 'KM' | 'MI';
  dateFormat: 'DD-MM-YYYY' | 'YYYY-MM-DD' | 'DD MMM YYYY';
  numberGrouping: 'INDIAN' | 'INTERNATIONAL';
  textSize: '100' | '112' | '125';
  highContrast: boolean;
  reduceMotion: boolean;
};

export const DEFAULT_PREFS: Prefs = {
  language: 'en', timeZone: 'Asia/Kolkata', currency: 'INR', currencyDisplay: 'SYMBOL', weightUnit: 'TON', temperatureUnit: 'C',
  distanceUnit: 'KM', dateFormat: 'DD-MM-YYYY', numberGrouping: 'INDIAN', textSize: '100', highContrast: false, reduceMotion: false,
};

/** The values each choice may take (the server sends the same list in `options`). */
export const PREF_OPTIONS = {
  language: ['en', 'hi', 'or'],
  currency: ['INR'],
  currencyDisplay: ['SYMBOL', 'CODE'],
  weightUnit: ['TON', 'KG'],
  temperatureUnit: ['C', 'F'],
  distanceUnit: ['KM', 'MI'],
  dateFormat: ['DD-MM-YYYY', 'YYYY-MM-DD', 'DD MMM YYYY'],
  numberGrouping: ['INDIAN', 'INTERNATIONAL'],
  textSize: ['100', '112', '125'],
} as const;

/** Time zones offered when the server list is not there yet (any IANA zone works). */
export const ZONES = ['Asia/Kolkata', 'Asia/Dhaka', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Bangkok',
  'Asia/Shanghai', 'Asia/Tokyo', 'Europe/London', 'Europe/Berlin', 'Africa/Nairobi', 'America/New_York', 'America/Chicago', 'America/Los_Angeles',
  'Australia/Sydney', 'UTC'];

/** Language names in their own script (never translated, so a person can always find their language). */
export const LANGUAGE_NAMES: Record<Lang, string> = { en: 'English', hi: 'हिन्दी (Hindi)', or: 'ଓଡ଼ିଆ (Odia)' };

const pick = <T extends string>(v: unknown, allowed: readonly string[], fallback: T): T => {
  const s = v === undefined || v === null ? '' : String(v);
  const hit = allowed.find(a => a.toLowerCase() === s.toLowerCase());
  return (hit ?? fallback) as T;
};
const flag = (v: unknown, fallback: boolean) => {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  if (['true', 'yes', 'on', '1'].includes(s)) return true;
  if (['false', 'no', 'off', '0'].includes(s)) return false;
  return fallback;
};
const validZone = (z: unknown) => {
  if (typeof z !== 'string' || !z) return false;
  try { new Intl.DateTimeFormat('en-GB', { timeZone: z }); return true; } catch { return false; }
};

/** Any object (server answer, cache) made into full, valid choices: an unknown value becomes the default. */
export function normalizePrefs(raw: any, base: Prefs = DEFAULT_PREFS): Prefs {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    language: pick(r.language, PREF_OPTIONS.language, base.language),
    timeZone: validZone(r.timeZone) ? String(r.timeZone) : base.timeZone,
    currency: pick(r.currency, PREF_OPTIONS.currency, base.currency),
    currencyDisplay: pick(r.currencyDisplay, PREF_OPTIONS.currencyDisplay, base.currencyDisplay),
    weightUnit: pick(r.weightUnit, PREF_OPTIONS.weightUnit, base.weightUnit),
    temperatureUnit: pick(r.temperatureUnit, PREF_OPTIONS.temperatureUnit, base.temperatureUnit),
    distanceUnit: pick(r.distanceUnit, PREF_OPTIONS.distanceUnit, base.distanceUnit),
    dateFormat: pick(r.dateFormat, PREF_OPTIONS.dateFormat, base.dateFormat),
    numberGrouping: pick(r.numberGrouping, PREF_OPTIONS.numberGrouping, base.numberGrouping),
    textSize: pick(r.textSize, PREF_OPTIONS.textSize, base.textSize),
    highContrast: flag(r.highContrast, base.highContrast),
    reduceMotion: flag(r.reduceMotion, base.reduceMotion),
  };
}

// ------------------------------------------------------------------ the choices in use now (one per browser tab)

export const CACHE_KEY = 'reftech_prefs';
let current: Prefs = DEFAULT_PREFS;
const listeners = new Set<(p: Prefs) => void>();

export function currentPrefs(): Prefs { return current; }

/** Puts choices in use (every t() and fmt...() follows) and tells the PrefsProvider. */
export function setCurrentPrefs(p: Partial<Prefs> | Prefs, remember = true) {
  current = normalizePrefs({ ...current, ...p });
  if (remember) writeCachedPrefs(current);
  listeners.forEach(l => l(current));
  return current;
}

export function onPrefsChange(l: (p: Prefs) => void) { listeners.add(l); return () => { listeners.delete(l); }; }

export function readCachedPrefs(): Prefs | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const s = localStorage.getItem(CACHE_KEY);
    return s ? normalizePrefs(JSON.parse(s)) : null;
  } catch { return null; }
}

export function writeCachedPrefs(p: Prefs) {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CACHE_KEY, JSON.stringify(p)); } catch { /* private window: no cache */ }
}
