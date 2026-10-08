/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-008 -- pure helpers of the Replenishment screen (tested by replenish.test.ts).

export const REPLENISH_SCRIPT = 'database_v2/104_req_cnf_008_009_prt_004_plt_018_trading_public_energy.sql';

export type ChartData = { labels: string[]; series: { name: string; values: (number | null)[] }[] };

const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

/** The weeks of history (W-12 .. W-1, oldest first) and of the forecast (W+1 ..) as two series of one chart. */
export function weeklyChart(history: unknown, forecast: unknown): ChartData {
  const h = Array.isArray(history) ? history.map(num) : [];
  const f = Array.isArray(forecast) ? forecast.map(num) : [];
  const labels = [...h.map((_, i) => `W-${h.length - i}`), ...f.map((_, i) => `W+${i + 1}`)];
  return {
    labels,
    series: [
      { name: 'Dispatched', values: [...h, ...f.map(() => null)] },
      { name: 'Forecast', values: [...h.map(() => null), ...f] },
    ],
  };
}

/** The steps of a suggestion, kept as text with one step per line (or already a list). */
export function stepsOf(steps: unknown): string[] {
  if (Array.isArray(steps)) return steps.map(String).filter(s => s.trim());
  if (typeof steps !== 'string') return [];
  return steps.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

/** What is wrong with an answer to a suggestion, or '' when it can be sent. */
export function decisionProblem(decision: 'ACCEPT' | 'REJECT', quantity: string, note: string): string {
  if (decision === 'REJECT') return note.trim().length < 3 ? 'Write why the suggestion is rejected.' : '';
  if (quantity.trim() === '') return '';
  const q = Number(quantity);
  if (isNaN(q) || q <= 0) return 'The quantity to call in must be more than 0.';
  return '';
}

/** Colour of the stock position against the band: below the minimum red, above the maximum amber, else green. */
export function bandColour(projected: unknown, min: unknown, max: unknown): string {
  const p = num(projected), lo = num(min), hi = num(max);
  if (p === null || lo === null) return 'text-slate-700';
  if (p < lo) return 'text-red-700';
  if (hi !== null && p > hi) return 'text-amber-700';
  return 'text-emerald-700';
}
