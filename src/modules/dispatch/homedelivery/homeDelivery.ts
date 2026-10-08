/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-DSP-013 -- what the Home Delivery screen and the customer's order tracking page need besides React: the
// actions an order offers in each status (the same moves the backend allows), the delivery slot as text, a slot at
// risk, the full tracking link and the plain words the customer reads.
// Pure functions (no React) so homeDelivery.test.ts can test them.

export const HD = '/api/dispatch/home-delivery';

export type OrderAction = 'DELIVER' | 'FAIL' | 'RETRY' | 'RETURN' | 'CANCEL' | 'RESEND';

/** The buttons of an order (as HomeDeliveryRules.checkMove on the backend). */
export function orderActions(status?: string | null): OrderAction[] {
  switch (String(status || '')) {
    case 'RECEIVED': return ['CANCEL', 'RESEND'];
    case 'PLANNED': return ['CANCEL', 'RESEND'];
    case 'OUT_FOR_DELIVERY': return ['DELIVER', 'FAIL', 'RESEND'];
    case 'FAILED': return ['RETRY', 'RETURN', 'RESEND'];
    default: return [];
  }
}

const INDIA = 'Asia/Kolkata';
const hm = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: INDIA, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
const dm = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: INDIA, day: '2-digit', month: 'short' }).format(d);

/** "09 Oct 10:00-12:00" (India time); "-" when unknown. A slot over midnight shows both days. */
export function slotText(start?: string | null, end?: string | null) {
  if (!start || !end) return '-';
  const a = new Date(start), b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '-';
  return dm(a) === dm(b) ? `${dm(a)} ${hm(a)}-${hm(b)}` : `${dm(a)} ${hm(a)} - ${dm(b)} ${hm(b)}`;
}

/** An order not yet delivered whose expected arrival (or now) is after the end of its slot. */
export function lateRisk(o: { status?: string; slotEnd?: string | null; etaAt?: string | null }, now: Date = new Date()) {
  if (!o.slotEnd || !['RECEIVED', 'PLANNED', 'OUT_FOR_DELIVERY'].includes(String(o.status))) return false;
  const end = new Date(o.slotEnd).getTime();
  const when = o.etaAt ? new Date(o.etaAt).getTime() : now.getTime();
  return when > end;
}

/** The tracking link the backend returns, made absolute with this site's address when it is a path. */
export function fullLink(url?: string | null, origin = typeof window === 'undefined' ? '' : window.location.origin) {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** What the customer sees on the tracking page for a status. */
export function customerStatus(status?: string | null) {
  switch (String(status || '')) {
    case 'RECEIVED': case 'PLANNED': return 'Being prepared';
    case 'OUT_FOR_DELIVERY': return 'On the way';
    case 'DELIVERED': return 'Delivered';
    case 'FAILED': return 'Not delivered';
    case 'RETURNED': return 'Returned';
    default: return 'Cancelled';
  }
}

/** The order form: one line per row "SKU, description, quantity, batch, expiry" (only the quantity is needed). */
export function parseLines(text?: string | null) {
  return String(text || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => {
    const [sku, description, quantity, batchNo, expiryDate] = x.split(',').map(s => s.trim());
    const line: Record<string, unknown> = { sku: sku || null, description: description || null, quantity: Number(quantity || 1) };
    if (batchNo) line.batchNo = batchNo;
    if (expiryDate) line.expiryDate = expiryDate;
    return line;
  });
}

/** The ids ticked on the order list that can go on a route (new orders only). */
export const plannable = (orders: { id: number; status?: string }[], ticked: number[]) =>
  orders.filter(o => o.status === 'RECEIVED' && ticked.includes(o.id)).map(o => o.id);
