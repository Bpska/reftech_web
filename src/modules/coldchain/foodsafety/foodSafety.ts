/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-015 -- what the Food Safety screen needs besides React: the risk of a hazard (severity x likelihood, the same
// rule as FoodSafetyRules on the backend), whether a hazard is significant, the CCP limit as text, whether a reading
// is inside it, the default due date of a finding and the colour of the certificate states.
// Pure functions (no React) so foodSafety.test.ts can test them.

export const FS = '/api/coldchain/food-safety';

/** Severity (1-3) x likelihood (1-3); null when either is missing or out of range. */
export function risk(severity: unknown, likelihood: unknown) {
  const s = Number(severity), l = Number(likelihood);
  if (!Number.isInteger(s) || !Number.isInteger(l) || s < 1 || s > 3 || l < 1 || l > 3) return null;
  return s * l;
}

/** LOW (1-2), MEDIUM (3-4), HIGH (6-9). */
export const riskLevel = (r: number | null) => (r === null ? '-' : r >= 6 ? 'HIGH' : r >= 3 ? 'MEDIUM' : 'LOW');

/** A significant hazard needs a CCP or a control measure: risk 4 or more, or the highest severity. */
export const significant = (severity: unknown, likelihood: unknown) => {
  const r = risk(severity, likelihood);
  return r !== null && (r >= 4 || Number(severity) === 3);
};

/** "-25 to -18 °C", "-15 °C or lower", "5 °C or higher" or the written limit. */
export function limitText(h: { criticalLimit?: string | null; limitMin?: number | null; limitMax?: number | null; limitUnit?: string | null }) {
  const u = h.limitUnit ? ` ${h.limitUnit}` : '';
  const has = (v: unknown) => v !== null && v !== undefined && v !== '';
  if (has(h.limitMin) && has(h.limitMax)) return `${h.limitMin} to ${h.limitMax}${u}`;
  if (has(h.limitMax)) return `${h.limitMax}${u} or lower`;
  if (has(h.limitMin)) return `${h.limitMin}${u} or higher`;
  return h.criticalLimit || '-';
}

/** Whether a reading is inside the CCP's limits (either may be open); null when the CCP has no number limit. */
export function inside(value: unknown, min?: number | null, max?: number | null) {
  const noMin = min === null || min === undefined, noMax = max === null || max === undefined;
  if (noMin && noMax) return null;
  if (value === null || value === undefined || value === '') return null;
  const v = Number(value);
  if (Number.isNaN(v)) return null;
  return (noMin || v >= Number(min)) && (noMax || v <= Number(max));
}

/** Default days to close a finding: CRITICAL 7, MAJOR 30, MINOR 60, OBSERVATION 90 (the backend sets the same). */
export function findingDue(severity: string, from: Date = new Date()) {
  const days = severity === 'CRITICAL' ? 7 : severity === 'MAJOR' ? 30 : severity === 'MINOR' ? 60 : 90;
  const d = new Date(from.getTime() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/** MAJOR and CRITICAL findings need the evidence attached before they close. */
export const needsEvidence = (severity?: string | null) => severity === 'MAJOR' || severity === 'CRITICAL';

/** The state pill of a certification as the tone helper knows it. */
export function certTone(state?: string | null) {
  switch (String(state || '')) {
    case 'OK': return 'OK';
    case 'DUE_SOON': return 'DUE_SOON';
    case 'AUDIT_OVERDUE': case 'EXPIRED': case 'SUSPENDED': case 'WITHDRAWN': return 'OVERDUE';
    default: return 'NOT_SET';
  }
}

/** The hazard form values as the body the backend reads (checkbox isCcp, numbers as numbers). */
export function hazardBody(v: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...v };
  for (const k of ['severity', 'likelihood']) if (out[k] !== null && out[k] !== undefined && out[k] !== '') out[k] = Number(out[k]);
  if (!out.isCcp) { out.ccpCode = null; out.criticalLimit = null; out.limitMin = null; out.limitMax = null; }
  return out;
}
