/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-004 -- the public website pages (track by LR, pickup / quote request, locator) talk to /api/public/site
// (no login, no token sent). The checks here are the same as the server's, so the visitor sees them before sending;
// the server checks again (tested by publicsite.test.ts).

export type Kind = 'PICKUP' | 'QUOTE' | 'CONTACT';

export type Location = {
  id: number; code: string; kind: string; name: string; address?: string; city?: string; state?: string; pincode?: string;
  latitude?: number | null; longitude?: number | null; phone?: string; email?: string; services?: string; openingHours?: string;
  temperatureZones?: string; distanceKm?: number | null;
};

export type Tracked = {
  lrNumber: string; from?: string; to?: string; bookedAt?: string; stage: string; stageText: string; packages?: number | null; pallets?: number | null;
  temperature?: string | null; expectedBy?: string | null; deliveredAt?: string | null; steps: { label: string; at?: string | null; done: boolean }[]; helpPhone?: string;
};

export const TEMPERATURES: [string, string][] = [
  ['FROZEN', 'Frozen (-25 to -15 °C)'], ['CHILLED', 'Chilled (2 to 8 °C)'], ['COOL', 'Cool (8 to 15 °C)'], ['AMBIENT', 'Ambient (15 to 25 °C)'], ['PHARMA', 'Pharma (2 to 8 °C, validated)'],
];
export const FREQUENCIES: [string, string][] = [['ONCE', 'Once'], ['DAILY', 'Daily'], ['WEEKLY', 'Weekly'], ['MONTHLY', 'Monthly']];

const PHONE = /^\+?[0-9][0-9 -]{8,16}[0-9]$/;
const PIN = /^[1-9]\d{5}$/;
const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const LR = /^[A-Z0-9][A-Z0-9/_-]{2,29}$/;

/** The LR number as the server looks it up (upper case, no spaces), or null when it cannot be one. */
export function normaliseLr(typed: string): string | null {
  const s = (typed || '').trim().toUpperCase().replace(/\s+/g, '');
  return LR.test(s) ? s : null;
}

export type RequestForm = Record<string, string | boolean | undefined>;

const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === '';

/** What is missing or wrong in a request, in the words the server uses; [] = it can be sent. */
export function problems(f: RequestForm, today: string): string[] {
  const p: string[] = [];
  const kind = String(f.kind || '').toUpperCase();
  if (!['PICKUP', 'QUOTE', 'CONTACT'].includes(kind)) return ['Choose pickup, quote or message.'];
  if (blank(f.fullName)) p.push('Please give your name.');
  if (blank(f.phone) || !PHONE.test(String(f.phone).trim())) p.push('Please give a mobile number we can call (10 digits).');
  if (!blank(f.email) && !EMAIL.test(String(f.email).trim())) p.push('The email address does not look right.');
  if (!blank(f.pickupPincode) && !PIN.test(String(f.pickupPincode).trim())) p.push('The pickup PIN code must be 6 digits.');
  if (!blank(f.deliveryPincode) && !PIN.test(String(f.deliveryPincode).trim())) p.push('The delivery PIN code must be 6 digits.');
  const tons = blank(f.weightTons) ? null : Number(f.weightTons);
  if (tons !== null && (isNaN(tons) || tons <= 0 || tons > 60)) p.push('The weight must be more than 0 and at most 60 tons.');
  const pallets = blank(f.pallets) ? null : Number(f.pallets);
  if (pallets !== null && (isNaN(pallets) || pallets < 0 || pallets > 100)) p.push('Pallets must be 0 to 100.');
  if (!f.consent) p.push('Please agree that we may contact you about this request.');
  if (kind === 'PICKUP') {
    if (blank(f.pickupCity)) p.push('Where should we pick up the goods (city)?');
    if (blank(f.deliveryCity)) p.push('Where should the goods go (city)?');
    if (blank(f.goods)) p.push('What are the goods?');
    if (blank(f.temperatureClass)) p.push('Choose the temperature of the goods.');
    if (tons === null && !pallets) p.push('Give the weight or the number of pallets.');
    const d = String(f.pickupDate || '');
    if (!d) p.push('When should we pick up?');
    else if (d < today) p.push('The pickup date is in the past.');
    else if (d > addDays(today, 90)) p.push('We take pickup requests up to 90 days ahead.');
  } else if (kind === 'QUOTE') {
    if (blank(f.pickupCity) || blank(f.deliveryCity)) p.push('Give the cities from and to, so we can price the lane.');
    if (blank(f.temperatureClass)) p.push('Choose the temperature of the goods.');
  } else if (blank(f.message)) p.push('Please write your message.');
  return p;
}

export function addDays(isoDay: string, days: number): string {
  const d = new Date(isoDay + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The request body: numbers as numbers, empty fields left out. */
export function body(f: RequestForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === '') continue;
    out[k] = (k === 'weightTons' || k === 'pallets') ? Number(v) : v;
  }
  return out;
}

/** "3 km away", "120 km away"; '' when unknown. */
export function distanceText(km: number | null | undefined): string {
  if (km === null || km === undefined || isNaN(Number(km))) return '';
  const n = Number(km);
  return n < 10 ? `${n.toFixed(1)} km away` : `${Math.round(n)} km away`;
}

/** The index of the stage on the progress bar (BOOKED 0 .. DELIVERED 4), -1 when cancelled. */
export function stageIndex(stage: string): number {
  return ['BOOKED', 'LOADING', 'IN_TRANSIT', 'REACHED', 'DELIVERED'].indexOf(String(stage || '').toUpperCase());
}

// ------------------------------------------------------------------ calls

function base() {
  const url = import.meta.env.VITE_API_URL;
  if (!url) throw new Error('VITE_API_URL is not configured');
  return url;
}

async function read(response: Response) {
  const text = await response.text();
  let b: unknown = {};
  try { b = text ? JSON.parse(text) : {}; } catch { b = { message: text }; }
  if (!response.ok) throw new Error((b as { message?: string })?.message || `Request failed (${response.status})`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the caller says what it expects
  return b as any;
}

export async function track(lr: string): Promise<Tracked> {
  return read(await fetch(`${base()}/api/public/site/track?lr=${encodeURIComponent(lr)}`));
}

export async function locations(q: string, lat?: number, lng?: number): Promise<{ locations: Location[]; helpPhone?: string }> {
  const p = new URLSearchParams();
  if (q.trim()) p.set('q', q.trim());
  if (lat !== undefined && lng !== undefined) { p.set('lat', String(lat)); p.set('lng', String(lng)); }
  return read(await fetch(`${base()}/api/public/site/locations?${p.toString()}`));
}

export async function formInfo(kind: Kind): Promise<{ formToken: string; temperatureClasses: string[]; helpPhone?: string; available?: boolean }> {
  return read(await fetch(`${base()}/api/public/site/form?kind=${kind}`));
}

export async function send(b: Record<string, unknown>): Promise<{ reference: string; message: string }> {
  return read(await fetch(`${base()}/api/public/site/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }));
}
