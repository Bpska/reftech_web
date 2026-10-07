/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-015 -- numbers, money, units and dates as the login chose. The database keeps tons, degrees Celsius,
// kilometres and rupees; only what is shown changes. The backend does the same in platform/prefs/Units.java
// (keep the two the same: format.test.ts and UnitsTest.java check the same numbers).
// formatX(value, prefs) are pure; fmtX(value) use the choices in use now.
import { currentPrefs, Prefs } from './prefs';

type Num = number | string | null | undefined;

const toNum = (v: Num): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/** Half away from zero, like Java's HALF_UP (1.005 -> 1.01, -2.5 -> -3). */
export function roundHalfUp(n: number, decimals: number) {
  const s = Math.sign(n), a = Math.abs(n);
  if (String(a).includes('e')) return s * Math.round(a * 10 ** decimals) / 10 ** decimals; // very small or very large
  return s * Number(Math.round(Number(a + 'e' + decimals)) + 'e-' + decimals);
}

function group(whole: string, international: boolean) {
  if (whole.length <= 3) return whole;
  let head = whole.slice(0, -3);
  const tail = whole.slice(-3), step = international ? 3 : 2;
  let out = '';
  while (head.length > step) { out = ',' + head.slice(-step) + out; head = head.slice(0, -step); }
  return head + out + ',' + tail;
}

/** 1234567.5 -> "12,34,567.5" (INDIAN) or "1,234,567.5" (INTERNATIONAL). trim drops zeros after the point. */
export function formatNumber(v: Num, p: Pick<Prefs, 'numberGrouping'>, decimals = 2, trim = true): string {
  const n = toNum(v);
  if (n === null) return '-';
  let s = roundHalfUp(n, decimals).toFixed(decimals);
  if (trim && s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  if (/^0(\.0*)?$/.test(s)) return s;
  const [whole, frac] = s.split('.');
  return (neg ? '-' : '') + group(whole, p.numberGrouping === 'INTERNATIONAL') + (frac !== undefined ? '.' + frac : '');
}

/** Tons as stored -> "12.5 t" or "12,500 kg". */
export function formatWeight(tons: Num, p: Pick<Prefs, 'weightUnit' | 'numberGrouping'>): string {
  const n = toNum(tons);
  if (n === null) return '-';
  return p.weightUnit === 'KG' ? `${formatNumber(n * 1000, p, 0)} kg` : `${formatNumber(n, p, 3)} t`;
}

/** Degrees Celsius as stored -> "-18.0 °C" or "-0.4 °F". */
export function formatTemp(celsius: Num, p: Pick<Prefs, 'temperatureUnit'>): string {
  const n = toNum(celsius);
  if (n === null) return '-';
  const v = p.temperatureUnit === 'F' ? n * 9 / 5 + 32 : n;
  return `${roundHalfUp(v, 1).toFixed(1)} ${p.temperatureUnit === 'F' ? '°F' : '°C'}`;
}

/** Kilometres as stored -> "1,234.6 km" or "767.1 mi". */
export function formatDistance(km: Num, p: Pick<Prefs, 'distanceUnit' | 'numberGrouping'>): string {
  const n = toNum(km);
  if (n === null) return '-';
  return p.distanceUnit === 'MI' ? `${formatNumber(n / 1.609344, p, 1)} mi` : `${formatNumber(n, p, 1)} km`;
}

/** Rupees as stored (never converted) -> "₹ 1,00,000.00" or "INR 1,00,000.00". */
export function formatMoney(rupees: Num, p: Pick<Prefs, 'currencyDisplay' | 'numberGrouping'>, decimals = 2): string {
  const n = toNum(rupees);
  if (n === null) return '-';
  return (n < 0 ? '-' : '') + (p.currencyDisplay === 'CODE' ? 'INR ' : '₹ ') + formatNumber(Math.abs(n), p, decimals, false);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function dateText(y: string, m: string, d: string, f: Prefs['dateFormat']) {
  if (f === 'YYYY-MM-DD') return `${y}-${m}-${d}`;
  if (f === 'DD MMM YYYY') return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
  return `${d}-${m}-${y}`;
}

/** The parts of a moment in a time zone. */
function zoned(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(date);
  const get = (t: string) => parts.find(x => x.type === t)?.value || '';
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute') };
}

/**
 * A date. "2026-10-07" (a day without time) is shown as it is; a moment ("2026-10-07T20:00:00Z") is first moved
 * into the chosen time zone.
 */
export function formatDate(value: string | number | Date | null | undefined, p: Pick<Prefs, 'dateFormat' | 'timeZone'>): string {
  if (value === null || value === undefined || value === '') return '-';
  const s = typeof value === 'string' ? value.trim() : '';
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (day) return dateText(day[1], day[2], day[3], p.dateFormat);
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const z = zoned(d, p.timeZone);
  return dateText(z.y, z.m, z.d, p.dateFormat);
}

/** A moment in the chosen time zone: the date in the chosen format, then HH:mm (24 hours). */
export function formatDateTime(value: string | number | Date | null | undefined, p: Pick<Prefs, 'dateFormat' | 'timeZone'>): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = value instanceof Date ? value : new Date(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) ? value.trim() + 'T00:00:00' : value);
  if (isNaN(d.getTime())) return String(value);
  const z = zoned(d, p.timeZone);
  return `${dateText(z.y, z.m, z.d, p.dateFormat)} ${z.h}:${z.mi}`;
}

/** A temperature range in °C as stored -> "2.0 to 8.0 °C", "up to 8.0 °C", "-18.0 °C or above", or "-". */
export function formatTempRange(minC: Num, maxC: Num, p: Pick<Prefs, 'temperatureUnit'>): string {
  const lo = toNum(minC), hi = toNum(maxC);
  const unit = tempUnitLabel(p);
  const one = (c: number) => roundHalfUp(tempToUnit(c, p), 1).toFixed(1);
  if (lo !== null && hi !== null) return `${one(lo)} to ${one(hi)} ${unit}`;
  if (hi !== null) return `up to ${one(hi)} ${unit}`;
  if (lo !== null) return `${one(lo)} ${unit} or above`;
  return '-';
}

/** The time of a moment in the chosen time zone: "14:30". */
export function formatTime(value: string | number | Date | null | undefined, p: Pick<Prefs, 'timeZone'>): string {
  if (value === null || value === undefined || value === '') return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const z = zoned(d, p.timeZone);
  return `${z.h}:${z.mi}`;
}

// ------------------------------------------------------------------ unit conversion (screens and input boxes)
// The database keeps °C, tons and km. A box where the person types a temperature or a weight shows the person's
// unit and must turn the typed number back into °C / tons before it is sent (tempFromUnit, weightFromUnit).

export const tempUnitLabel = (p: Pick<Prefs, 'temperatureUnit'>) => (p.temperatureUnit === 'F' ? '°F' : '°C');
export const weightUnitLabel = (p: Pick<Prefs, 'weightUnit'>) => (p.weightUnit === 'KG' ? 'kg' : 'tons');
export const distanceUnitLabel = (p: Pick<Prefs, 'distanceUnit'>) => (p.distanceUnit === 'MI' ? 'miles' : 'km');

/** °C -> the person's unit (no rounding). */
export const tempToUnit = (c: number, p: Pick<Prefs, 'temperatureUnit'>) => (p.temperatureUnit === 'F' ? c * 9 / 5 + 32 : c);
/** The person's unit -> °C (no rounding). */
export const tempFromUnit = (x: number, p: Pick<Prefs, 'temperatureUnit'>) => (p.temperatureUnit === 'F' ? (x - 32) * 5 / 9 : x);
export const weightToUnit = (tons: number, p: Pick<Prefs, 'weightUnit'>) => (p.weightUnit === 'KG' ? tons * 1000 : tons);
export const weightFromUnit = (x: number, p: Pick<Prefs, 'weightUnit'>) => (p.weightUnit === 'KG' ? x / 1000 : x);
export const distanceToUnit = (km: number, p: Pick<Prefs, 'distanceUnit'>) => (p.distanceUnit === 'MI' ? km / 1.609344 : km);
export const distanceFromUnit = (x: number, p: Pick<Prefs, 'distanceUnit'>) => (p.distanceUnit === 'MI' ? x * 1.609344 : x);

export type UnitKind = 'temp' | 'weight' | 'distance';

/**
 * A stored value (°C / tons / km) as the text an input box shows in the person's unit: "" stays "", a value that is
 * not a number is returned as it is. Rounded to 2 places for °F, 3 for tons, 0 for kg, 1 for miles.
 */
export function toInputValue(kind: UnitKind, stored: Num, p: Prefs): string {
  if (stored === null || stored === undefined || stored === '') return '';
  const n = toNum(stored);
  if (n === null) return String(stored);
  if (kind === 'temp') return String(p.temperatureUnit === 'F' ? roundHalfUp(tempToUnit(n, p), 2) : n);
  if (kind === 'weight') return String(p.weightUnit === 'KG' ? roundHalfUp(n * 1000, 3) : n);
  return String(p.distanceUnit === 'MI' ? roundHalfUp(distanceToUnit(n, p), 3) : n);
}

/**
 * What the person typed in their unit -> the stored unit as text for the request ("" or not a number stays as it is,
 * so the server gives its usual message). °C keeps 2 places, tons 3, km 3: the database scales.
 */
export function fromInputValue(kind: UnitKind, typed: unknown, p: Prefs): string {
  if (typed === null || typed === undefined) return '';
  const s = String(typed).trim();
  if (s === '') return '';
  const n = toNum(s);
  if (n === null) return s;
  if (kind === 'temp') return String(p.temperatureUnit === 'F' ? roundHalfUp(tempFromUnit(n, p), 2) : n);
  if (kind === 'weight') return String(p.weightUnit === 'KG' ? roundHalfUp(n / 1000, 3) : n);
  return String(p.distanceUnit === 'MI' ? roundHalfUp(distanceFromUnit(n, p), 3) : n);
}

/** The label of an input box with the unit: "Planned load" -> "Planned load (kg)". */
export function unitLabel(kind: UnitKind, p: Prefs) {
  return kind === 'temp' ? tempUnitLabel(p) : kind === 'weight' ? weightUnitLabel(p) : distanceUnitLabel(p);
}

// ------------------------------------------------------------------ with the choices in use now

export const fmtNumber = (n: Num, decimals = 2) => formatNumber(n, currentPrefs(), decimals);
export const fmtWeight = (tons: Num) => formatWeight(tons, currentPrefs());
export const fmtTemp = (celsius: Num) => formatTemp(celsius, currentPrefs());
export const fmtDistance = (km: Num) => formatDistance(km, currentPrefs());
/** Rupees as stored; decimals 0 for whole rupees (planning boards). */
export const fmtMoney = (rupees: Num, decimals = 2) => formatMoney(rupees, currentPrefs(), decimals);
export const fmtDate = (value: string | number | Date | null | undefined) => formatDate(value, currentPrefs());
export const fmtDateTime = (value: string | number | Date | null | undefined) => formatDateTime(value, currentPrefs());
export const fmtTempRange = (minC: Num, maxC: Num) => formatTempRange(minC, maxC, currentPrefs());
export const fmtTime = (value: string | number | Date | null | undefined) => formatTime(value, currentPrefs());
/** The person's unit label now: "°C", "°F", "tons", "kg", "km", "miles". */
export const unitNow = (kind: UnitKind) => unitLabel(kind, currentPrefs());
/** Typed in the person's unit -> stored unit (°C / tons / km) as text for the request. */
export const toBase = (kind: UnitKind, typed: unknown) => fromInputValue(kind, typed, currentPrefs());
/** Stored unit -> the text an input box shows in the person's unit. */
export const toShown = (kind: UnitKind, stored: Num) => toInputValue(kind, stored, currentPrefs());
/** Typed in the person's unit -> stored number, or null when empty / not a number. */
export const toBaseNumber = (kind: UnitKind, typed: unknown): number | null => {
  const s = toBase(kind, typed);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
/**
 * The named fields of a request body, typed in the person's units, turned into the stored units (°C / tons / km).
 * Other fields are kept as they are. Use on Object.fromEntries(new FormData(form)) before it is sent:
 *   toBaseFields(body, { minTemperatureC: 'temp', capacityTons: 'weight' })
 */
export function toBaseFields<T extends Record<string, any>>(body: T, kinds: Partial<Record<keyof T & string, UnitKind>>): T {
  const out: Record<string, any> = { ...body };
  for (const [k, kind] of Object.entries(kinds)) {
    if (!kind || !(k in out)) continue;
    const v = out[k];
    if (typeof v === 'number') { const n = toBaseNumber(kind as UnitKind, v); out[k] = n === null ? v : n; }
    else if (typeof v === 'string') out[k] = toBase(kind as UnitKind, v);
  }
  return out as T;
}
/** °C as stored -> the number alone in the person's unit, 1 place at most ("-0.4"), for graph axes. */
export const fmtTempNumber = (celsius: Num) => { const n = toNum(celsius); return n === null ? '-' : String(roundHalfUp(tempToUnit(n, currentPrefs()), 1)); };
/** °C -> a number in the person's unit now (for graphs that draw in the person's unit). */
export const tempNow = (celsius: number) => tempToUnit(celsius, currentPrefs());
/** A temperature DIFFERENCE in °C (sensor accuracy, tolerance) -> "± 0.5 °C" style text without the ±: "0.9 °F". */
export function formatTempDelta(celsius: Num, p: Pick<Prefs, 'temperatureUnit'>): string {
  const n = toNum(celsius);
  if (n === null) return '-';
  return `${roundHalfUp(p.temperatureUnit === 'F' ? n * 9 / 5 : n, 2)} ${tempUnitLabel(p)}`;
}
export const fmtTempDelta = (celsius: Num) => formatTempDelta(celsius, currentPrefs());
/** The usual field names of the forms that carry a weight or a temperature (for toBaseFields). */
export const COMMON_UNIT_FIELDS: Record<string, UnitKind> = {
  capacityTons: 'weight', loadTons: 'weight', weightTons: 'weight', plannedLoadTons: 'weight',
  minTemperatureC: 'temp', maxTemperatureC: 'temp', temperatureC: 'temp', requiredTemperatureC: 'temp',
};
