/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-020, REQ-WMS-022, REQ-WMS-023 -- the pure helpers of the Bonded Warehouse, Plant & Equipment and Reefer Plug
// Points screens: rupees, labels and colours, the duty share of a release, the next steps of a ticket and the
// charge of a plug-in session (the same rules as BondRules, PlantRules and PlugRules of reftech_core).
// Tested by bondPlantPlug.test.ts.

export const BOND_SCRIPT = 'database_v2/88_req_wms_020_022_023_trk_010_bond_plant_plug_elock.sql';

/** 123456.5 -> "₹ 1,23,456.50"; empty -> "-". */
export const rupees = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '-';
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  const s = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${n < 0 ? '-' : ''}₹ ${s}`;
};

/** "HOME_CONSUMPTION" -> "Home consumption". */
export const words = (v?: string | null) => (!v ? '-' : v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' '));

// ------------------------------------------------------------------------------------------- REQ-WMS-020 bond

/** Expiry of the bond: text and colour. state from the backend (OK / DUE_SOON / EXPIRED), days left. */
export function bondExpiry(state?: string | null, days?: number | null): { text: string; style: string } {
  if (!state) return { text: '', style: '' };
  if (state === 'EXPIRED') return { text: `expired ${days == null ? '' : Math.abs(days) + ' day(s) ago'}`.trim(), style: 'font-bold text-red-700' };
  if (state === 'DUE_SOON') return { text: days === 0 ? 'expires today' : `expires in ${days} day(s)`, style: 'font-semibold text-amber-700' };
  return { text: days == null ? '' : `${days} day(s) left`, style: 'text-slate-600' };
}

/**
 * The duty due on releasing `qty` out of an entry: in proportion, to the rupee; the last release (all that is left)
 * takes the rest of the duty so the total is exact. Re-export pays no duty.
 */
export function dutyShare(entryQty: number, entryDuty: number, releasedQty: number, dutyDueBefore: number, qty: number, releaseType = 'HOME_CONSUMPTION') {
  if (releaseType === 'RE_EXPORT') return 0;
  if (!(entryQty > 0) || !(qty > 0)) return 0;
  const balance = entryQty - releasedQty;
  if (qty >= balance - 1e-9) return Math.max(0, Math.round((entryDuty - dutyDueBefore) * 100) / 100);
  return Math.round((entryDuty * qty) / entryQty);
}

/** What stops an ex-bond release on the screen before it is sent, or '' (the backend checks it again). */
export function releaseProblem(r: { releaseType?: string; docNo?: string; quantity?: number; balance?: number; dutyDue?: number; dutyPaid?: number; hasDocument?: boolean; challanNo?: string }, tolerance = 1) {
  if (!r.releaseType) return 'Choose home consumption or re-export';
  if (!r.docNo || !String(r.docNo).trim()) return r.releaseType === 'RE_EXPORT' ? 'Type the shipping bill number' : 'Type the ex-bond bill of entry number';
  if (!(Number(r.quantity) > 0)) return 'Type the quantity released';
  if (r.balance != null && Number(r.quantity) > r.balance + 1e-9) return `Only ${r.balance} is left in bond`;
  if (r.releaseType === 'HOME_CONSUMPTION') {
    if (!r.challanNo || !String(r.challanNo).trim()) return 'Type the duty challan number';
    if (!r.hasDocument) return 'Attach the duty paid document';
    if ((r.dutyDue || 0) - (Number(r.dutyPaid) || 0) > tolerance) return `Duty paid is less than the duty due (${rupees(r.dutyDue)})`;
  }
  return '';
}

// ------------------------------------------------------------------------------------------- REQ-WMS-022 plant

export const ASSET_TYPE_NAMES: Record<string, string> = {
  COMPRESSOR: 'Compressor', CONDENSER: 'Condenser', EVAPORATOR: 'Evaporator', GENERATOR: 'Generator', FORKLIFT: 'Forklift',
  RACK: 'Rack', DOOR: 'Door', DOCK_LEVELLER: 'Dock leveller', OTHER: 'Other',
};

/** The steps a ticket may take next (as PlantRules.MOVES), with the button text. */
const MOVES: Record<string, [string, string][]> = {
  OPEN: [['ASSIGNED', 'Assign'], ['IN_PROGRESS', 'Start work'], ['CANCELLED', 'Cancel']],
  ASSIGNED: [['IN_PROGRESS', 'Start work'], ['CANCELLED', 'Cancel']],
  IN_PROGRESS: [['WAITING_PARTS', 'Waiting for parts'], ['RESOLVED', 'Resolve']],
  WAITING_PARTS: [['IN_PROGRESS', 'Parts arrived'], ['RESOLVED', 'Resolve']],
  RESOLVED: [['CLOSED', 'Close'], ['IN_PROGRESS', 'Reopen']],
};
export const nextSteps = (status?: string | null): [string, string][] => MOVES[String(status)] || [];

export const PRIORITY_STYLE: Record<string, string> = {
  P1: 'bg-red-600 text-white', P2: 'bg-orange-100 text-orange-800', P3: 'bg-sky-100 text-sky-800', P4: 'bg-slate-100 text-slate-700',
};
export const priorityPill = (p?: string | null) => `inline-block rounded-full px-2 py-0.5 text-xs font-bold ${PRIORITY_STYLE[String(p)] || 'bg-slate-100 text-slate-700'}`;

/** OVERDUE / DUE_SOON / OK of a schedule or an asset. */
export const serviceStyle = (s?: string | null) =>
  s === 'OVERDUE' ? 'font-bold text-red-700' : s === 'DUE_SOON' ? 'font-semibold text-amber-700' : s === 'INACTIVE' ? 'text-slate-400' : 'text-emerald-700';
export const serviceText = (s?: string | null) => (s === 'OVERDUE' ? 'Overdue' : s === 'DUE_SOON' ? 'Due soon' : s === 'INACTIVE' ? 'Off' : 'OK');

/** 45 -> "45 min"; 190 -> "3 h 10 min"; 3000 -> "2 d 2 h". */
export const downtime = (m?: number | null) => {
  if (m === null || m === undefined || !Number.isFinite(Number(m))) return '-';
  const n = Math.max(0, Math.round(Number(m)));
  if (n < 60) return `${n} min`;
  if (n < 1440) return `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}`;
  return `${Math.floor(n / 1440)} d${Math.floor((n % 1440) / 60) ? ` ${Math.floor((n % 1440) / 60)} h` : ''}`;
};

/** "every 500 h or 90 days" of a schedule. */
export const everyText = (hours?: number | null, days?: number | null) =>
  [hours ? `${Number(hours)} h` : '', days ? `${days} days` : ''].filter(Boolean).join(' or ') || '-';

// ------------------------------------------------------------------------------------------- REQ-WMS-023 plug points

/** Hours billed: minutes plugged in rounded up to whole blocks of roundMinutes, at least one block (PlugRules.billedHours). */
export function billedHours(startIso: string, endIso: string, roundMinutes = 30) {
  const s = new Date(startIso).getTime(), e = new Date(endIso).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  const block = Math.max(1, roundMinutes);
  const blocks = Math.max(1, Math.ceil((e - s) / 1000 / (block * 60)));
  return Math.round(((blocks * block) / 60) * 100) / 100;
}

/** The charge of a session (PlugRules.charge): energy + time, at least the minimum charge. */
export function plugCharge(units: number, hours: number, ratePerKwh: number, ratePerHour: number, minCharge: number) {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const energy = r2((units || 0) * (ratePerKwh || 0)), time = r2((hours || 0) * (ratePerHour || 0));
  const sum = r2(energy + time), min = r2(minCharge || 0);
  return sum < min ? { energy, time, amount: min, minimumApplied: true } : { energy, time, amount: sum, minimumApplied: false };
}

/** "od 02 ab-1234" -> "OD02AB1234"; '' when it does not look like a truck number. */
export const truckNumber = (raw?: string | null) => {
  const v = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return v.length >= 6 && v.length <= 12 ? v : '';
};
