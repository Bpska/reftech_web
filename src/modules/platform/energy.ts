/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-018 -- pure helpers of the Energy & Carbon screen (tested by energy.test.ts).

export const ENERGY_SCRIPT = 'database_v2/104_req_cnf_008_009_prt_004_plt_018_trading_public_energy.sql';

export type EnergyTab = 'chambers' | 'generators' | 'solar' | 'carbon' | 'reports';

/** The tabs a login sees: a partner only its carbon and its monthly reports. */
export function energyTabs(partner: boolean): [EnergyTab, string][] {
  const all: [EnergyTab, string][] = [['chambers', 'Energy per chamber'], ['generators', 'Generators'], ['solar', 'Solar & grid'], ['carbon', 'Carbon'], ['reports', 'Monthly reports']];
  return partner ? all.filter(([k]) => k === 'carbon' || k === 'reports') : all;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Quick periods: this month, last month, last 3 months, this financial year (April to March). */
export function periods(today = new Date()): { key: string; label: string; from: string; to: string }[] {
  const y = today.getFullYear(), m = today.getMonth();
  const lastStart = new Date(y, m - 1, 1), lastEnd = new Date(y, m, 0);
  const fyStart = new Date(m >= 3 ? y : y - 1, 3, 1);
  return [
    { key: 'this', label: 'This month', from: iso(new Date(y, m, 1)), to: iso(today) },
    { key: 'last', label: 'Last month', from: iso(lastStart), to: iso(lastEnd) },
    { key: 'three', label: 'Last 3 months', from: iso(new Date(y, m - 2, 1)), to: iso(today) },
    { key: 'fy', label: 'This financial year', from: iso(fyStart), to: iso(today) },
  ];
}

/** The first day of last month, the month a monthly report is usually made for. */
export function lastMonthStart(today = new Date()): string {
  return iso(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

/** Colour of the diesel flag of a generator run. */
export function flagTone(flag: unknown): string {
  return flag === 'HIGH' ? 'bg-red-100 text-red-800' : flag === 'LOW' ? 'bg-amber-100 text-amber-800' : flag === 'OK' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600';
}

/** kg CO2 as text: tonnes above 1,000 kg. */
export function co2Text(kg: unknown): string {
  const n = Number(kg);
  if (kg === null || kg === undefined || isNaN(n)) return '-';
  return n >= 1000 ? `${(n / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} t CO2` : `${n.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg CO2`;
}
