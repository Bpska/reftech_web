/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-012 -- what the Scheduled Routes screen needs besides React: the script, the week days, the colour of a
// departure by the space used, the next steps of a booking (the same moves the backend allows), reading the hubs
// and served pincodes typed in the route form, and the price shown before booking.
// Pure functions (no React) so schedule.test.ts can test them.

export const SCRIPT96 = 'database_v2/96_req_dsp_012_013_cc_015_016_routes_home_delivery_food_safety_eutectic.sql';
export const SR = '/api/dispatch/scheduled-routes';

export const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** "TUE,FRI" -> "Tue, Fri"; an empty list -> "-". */
export function daysText(days?: string | null) {
  const list = String(days || '').split(/[ ,;]+/).map(d => d.trim().toUpperCase()).filter(d => WEEK_DAYS.includes(d));
  list.sort((a, b) => WEEK_DAYS.indexOf(a) - WEEK_DAYS.indexOf(b));
  return list.length ? list.map(d => d.charAt(0) + d.slice(1).toLowerCase()).join(', ') : '-';
}

/** The state colour of a departure: FULL when no pallet or kg is left, FILLING from 80 % used, else its status. */
export function departureState(d: { status?: string; palletsLeft?: number; kgLeft?: number; percentUsed?: number }) {
  if (d.status && d.status !== 'OPEN') return d.status;
  if (Number(d.palletsLeft) <= 0 || Number(d.kgLeft) <= 0) return 'FULL';
  return Number(d.percentUsed) >= 80 ? 'FILLING' : 'OPEN';
}

/** The moves a booking may make next (as ScheduleRules.checkMove on the backend); CANCELLED is a separate button. */
export function nextMoves(status?: string | null): string[] {
  switch (String(status || '')) {
    case 'BOOKED': return ['LOADED'];
    case 'LOADED': return ['IN_TRANSIT', 'BOOKED'];
    case 'IN_TRANSIT': return ['AT_HUB', 'DELIVERED'];
    case 'AT_HUB': return ['IN_TRANSIT'];
    default: return [];
  }
}

export const canCancel = (status?: string | null) => status === 'BOOKED';

/** "Nagpur:45, Pune" -> [{hubCity:'Nagpur', maxTransferMinutes:45}, {hubCity:'Pune'}] in the order typed. */
export function parseHubs(text?: string | null) {
  return String(text || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean).map(x => {
    const [city, mins] = x.split(':').map(s => s.trim());
    const n = Number(mins);
    return mins && !Number.isNaN(n) ? { hubCity: city, maxTransferMinutes: Math.round(n) } : { hubCity: city };
  });
}

/** The hubs of a route back as the text of the form. */
export const hubsText = (hubs?: { hubCity: string; maxTransferMinutes?: number | null }[]) =>
  (hubs || []).map(h => (h.maxTransferMinutes ? `${h.hubCity}:${h.maxTransferMinutes}` : h.hubCity)).join(', ');

/** "400, 401 4110" -> ['400', '401', '4110']: whole pincodes or their first digits; anything else is dropped. */
export function parsePincodes(text?: string | null) {
  const out: string[] = [];
  for (const p of String(text || '').split(/[\s,;]+/)) if (/^[0-9]{1,6}$/.test(p) && !out.includes(p)) out.push(p);
  return out;
}

/** The route form values as the body the backend reads. */
export function routeBody(v: Record<string, unknown>) {
  const days = WEEK_DAYS.filter(d => v[`day${d}`] === true);
  const out: Record<string, unknown> = { ...v, daysOfWeek: days.join(','), hubs: parseHubs(v.hubsText as string), servedPincodes: parsePincodes(v.pincodesText as string) };
  for (const d of WEEK_DAYS) delete out[`day${d}`];
  delete out.hubsText; delete out.pincodesText;
  return out;
}

/** "Rs 6,350.00" in Indian grouping. */
export function rupees(v: unknown) {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  return Number.isNaN(n) ? '-' : `Rs ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The lines of a quote: freight, the ODA charge when the pincode is outside the served area, and the total. */
export function quoteLines(q: { freight?: number; oda?: boolean; odaCharge?: number; total?: number } | null) {
  if (!q) return [];
  const lines: [string, string][] = [['Freight', rupees(q.freight)]];
  if (q.oda) lines.push(['ODA (outside the served area)', rupees(q.odaCharge)]);
  lines.push(['Total', rupees(q.total)]);
  return lines;
}
