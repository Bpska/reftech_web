/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CC-008, 010, 011, 012, 013, 014 -- small pieces the cold chain record screens share: a state pill, tabs,
// a row of count tiles and a plain SVG line of readings (no chart package), where a reading of a sensor whose
// calibration was overdue is drawn as an amber triangle.
import { ReactNode } from 'react';
import { tone, words } from './records';
import { fmtTempNumber } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

export function Pill({ state, text }: { state?: string | null; text?: ReactNode }) {
  return <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${tone(state)}`}>{text ?? words(state)}</span>;
}

export function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return <div className="mt-3 flex flex-wrap gap-2" role="tablist">
    {tabs.map(([k, t]) => <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)}
      className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${value === k ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'}`}>{t}</button>)}
  </div>;
}

export function Tiles({ items }: { items: [string, ReactNode, string?][] }) {
  return <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-6">
    {items.map(([t, v, s]) => <div key={t} className={`rounded-2xl p-3 shadow-sm ${s ? tone(s) : 'bg-white'}`}>
      <div className="text-xs font-semibold opacity-80">{t}</div><div className="text-2xl font-bold">{v}</div></div>)}
  </div>;
}

export type ReadingPoint = { t: string; c: number | string; out?: boolean; flag?: string | null };

/** A line of readings with the allowed band. Out-of-range points are red, flagged points amber triangles. */
export function ReadingsLine({ points, minC, maxC, height = 140 }: { points: ReadingPoint[]; minC?: number | string | null; maxC?: number | string | null; height?: number }) {
  const pts = points.map(p => ({ t: new Date(p.t).getTime(), c: Number(p.c), out: !!p.out, flag: p.flag })).filter(p => !Number.isNaN(p.t) && !Number.isNaN(p.c));
  if (pts.length < 2) return <p className="text-sm text-slate-500">Not enough readings for a graph.</p>;
  const lo = minC === null || minC === undefined ? null : Number(minC), hi = maxC === null || maxC === undefined ? null : Number(maxC);
  const W = 640, H = height, pad = 28;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const vals = pts.map(p => p.c).concat(lo !== null ? [lo] : [], hi !== null ? [hi] : []);
  const vMin = Math.min(...vals) - 1, vMax = Math.max(...vals) + 1;
  const x = (t: number) => pad + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad - 8);
  const y = (c: number) => 8 + (1 - (c - vMin) / Math.max(0.01, vMax - vMin)) * (H - 24);
  const flagged = pts.filter(p => p.flag);
  return <figure>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${pts.length} readings`}>
      {lo !== null && hi !== null && <rect x={pad} width={W - pad - 8} y={y(hi)} height={Math.max(1, y(lo) - y(hi))} fill="#dcfce7" />}
      <text x={2} y={y(vMax - 1) + 4} fontSize="10" fill="#64748b">{fmtTempNumber(Math.round(vMax - 1))}</text>
      <text x={2} y={y(vMin + 1) + 4} fontSize="10" fill="#64748b">{fmtTempNumber(Math.round(vMin + 1))}</text>
      <polyline fill="none" stroke="#0369a1" strokeWidth="1.5" points={pts.map(p => `${x(p.t)},${y(p.c)}`).join(' ')} />
      {pts.filter(p => p.out && !p.flag).map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.c)} r="3" fill="#dc2626" />)}
      {flagged.map((p, i) => <path key={`f${i}`} d={`M ${x(p.t)} ${y(p.c) - 5} l 4 7 h -8 z`} fill={p.out ? '#dc2626' : '#f59e0b'} />)}
    </svg>
    <figcaption className="text-xs text-slate-500">
      Green band: allowed range. {pts.some(p => p.out) ? 'Red: out of range. ' : ''}
      {flagged.length ? <span className="font-semibold text-amber-700">▲ {flagged.length} reading(s) by a sensor whose calibration was overdue.</span> : null}
    </figcaption>
  </figure>;
}
