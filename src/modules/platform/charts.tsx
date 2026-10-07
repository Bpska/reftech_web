/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-006, REQ-PLT-008, REQ-PLT-015 -- a small chart kit drawn with plain SVG (no chart library):
// LineChart, BarChart, StackedBar and Donut. Every chart has role="img" with a label that reads out the numbers,
// a hover tip on each mark, a legend when it has two or more series, and a "Show as table" switch under it.
// The colours are a fixed order picked so people with colour blindness can still tell neighbours apart;
// the legend and the table carry the names, so colour is never the only clue.
import { ReactNode, useState } from 'react';

/** Series colours in fixed order (blue, orange, aqua, yellow, magenta, green, violet, red). */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
const GRID = '#e2e8f0', AXIS = '#64748b', INK = '#334155';

export type Series = { name: string; values: (number | null | undefined)[]; color?: string };

const fmt = (v: number | null | undefined, unit = '') =>
  v === null || v === undefined || isNaN(Number(v)) ? '-' : `${Number(v).toLocaleString('en-IN', { maximumFractionDigits: 1 })}${unit}`;

/** Round numbers for the axis: 0 .. a "nice" top in 4 steps. */
function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw) || raw;
  return [0, 1, 2, 3, 4].map(i => +(i * step).toFixed(10));
}

/** Title, the chart, the legend and the "Show as table" switch with the same numbers. */
export function ChartFrame({ title, legend, columns, rows, children, note }: {
  title: string; legend?: { name: string; color: string }[]; columns: string[]; rows: (string | number)[][]; children: ReactNode; note?: ReactNode;
}) {
  const [table, setTable] = useState(false);
  return <figure className="rounded-2xl bg-white p-4 shadow-sm">
    <figcaption className="text-base font-bold text-slate-800">{title}</figcaption>
    {legend && legend.length > 1 && <ul className="mt-1 flex flex-wrap gap-3 text-xs text-slate-600" aria-label="Legend">
      {legend.map(l => <li key={l.name} className="flex items-center gap-1"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: l.color }} />{l.name}</li>)}
    </ul>}
    <div className="mt-2">{children}</div>
    {note && <div className="mt-1 text-xs text-slate-500">{note}</div>}
    <button type="button" aria-expanded={table} onClick={() => setTable(!table)} className="mt-2 text-sm font-semibold text-sky-700 underline">
      {table ? 'Hide the table' : 'Show as table'}
    </button>
    {table && <div className="mt-2 overflow-x-auto">
      <table className="min-w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <thead><tr className="bg-slate-50">{columns.map(c => <th key={c} scope="col" className="px-2 py-1 text-left font-semibold">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>}
  </figure>;
}

const W = 640, H = 240, L = 48, R = 12, T = 12, B = 34;

function Axes({ ticks, top, labels, x, unit }: { ticks: number[]; top: number; labels: string[]; x: (i: number) => number; unit: string }) {
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const every = Math.max(1, Math.ceil(labels.length / 8));
  return <g aria-hidden>
    {ticks.map(t => <g key={t}>
      <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
      <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill={AXIS}>{fmt(t)}{unit === '%' ? '%' : ''}</text>
    </g>)}
    {labels.map((l, i) => i % every === 0 && <text key={i} x={x(i)} y={H - 12} textAnchor="middle" fontSize={11} fill={AXIS}>{l}</text>)}
  </g>;
}

function describe(title: string, labels: string[], series: Series[], unit: string) {
  return `${title}. ` + series.map(s => `${s.name}: ` + labels.map((l, i) => `${l} ${fmt(s.values[i], unit)}`).join(', ')).join('. ');
}

function tableOf(labels: string[], series: Series[], unit: string) {
  return { columns: ['Period', ...series.map(s => s.name)], rows: labels.map((l, i) => [l, ...series.map(s => fmt(s.values[i], unit))]) };
}

/** Lines over periods (one axis only). Gaps where a value is unknown. */
export function LineChart({ title, labels, series, unit = '', max, note }: { title: string; labels: string[]; series: Series[]; unit?: string; max?: number; note?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap(s => s.values.filter(v => v !== null && v !== undefined) as number[]);
  const ticks = niceTicks(max ?? Math.max(0, ...all));
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => labels.length <= 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (labels.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const colored = series.map((s, i) => ({ ...s, color: s.color || SERIES[i % SERIES.length] }));
  const t = tableOf(labels, series, unit);
  return <ChartFrame title={title} legend={colored.map(s => ({ name: s.name, color: s.color }))} columns={t.columns} rows={t.rows} note={note}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={describe(title, labels, series, unit)} onMouseLeave={() => setHover(null)}>
      <title>{describe(title, labels, series, unit)}</title>
      <Axes ticks={ticks} top={top} labels={labels} x={x} unit={unit} />
      {colored.map(s => {
        const segs: string[] = []; let cur = '';
        s.values.forEach((v, i) => {
          if (v === null || v === undefined) { if (cur) segs.push(cur); cur = ''; return; }
          cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        });
        if (cur) segs.push(cur);
        return <g key={s.name}>
          {segs.map((d, k) => <path key={k} d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {s.values.map((v, i) => v === null || v === undefined ? null :
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth={2} />)}
        </g>;
      })}
      {labels.map((l, i) => <rect key={i} x={x(i) - (W - L - R) / Math.max(2, labels.length) / 2} y={T} width={(W - L - R) / Math.max(2, labels.length)} height={H - T - B}
        fill="transparent" onMouseEnter={() => setHover(i)}>
        <title>{l + ': ' + colored.map(s => `${s.name} ${fmt(s.values[i], unit)}`).join(', ')}</title>
      </rect>)}
      {hover !== null && <g pointerEvents="none">
        <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke={AXIS} strokeDasharray="3 3" />
        <Tip x={x(hover)} lines={[labels[hover], ...colored.map(s => `${s.name}: ${fmt(s.values[hover], unit)}`)]} />
      </g>}
    </svg>
  </ChartFrame>;
}

function Tip({ x, lines }: { x: number; lines: string[] }) {
  const w = Math.max(...lines.map(l => l.length)) * 6.6 + 16, h = lines.length * 16 + 8;
  const left = Math.min(Math.max(L, x + 8), W - R - w);
  return <g>
    <rect x={left} y={T + 2} width={w} height={h} rx={6} fill="#0f172a" opacity={0.92} />
    {lines.map((l, i) => <text key={i} x={left + 8} y={T + 18 + i * 16} fontSize={12} fill="#fff" fontWeight={i === 0 ? 700 : 400}>{l}</text>)}
  </g>;
}

/** Bars per period; with several series the bars stand side by side (same unit only). */
export function BarChart({ title, labels, series, unit = '', note }: { title: string; labels: string[]; series: Series[]; unit?: string; note?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap(s => s.values.map(v => Number(v || 0)));
  const ticks = niceTicks(Math.max(0, ...all));
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - L - R) / Math.max(1, labels.length);
  const x = (i: number) => L + band * i + band / 2;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);
  const inner = Math.min(48, band * 0.7), bw = Math.max(2, inner / series.length - 2);
  const colored = series.map((s, i) => ({ ...s, color: s.color || SERIES[i % SERIES.length] }));
  const t = tableOf(labels, series, unit);
  return <ChartFrame title={title} legend={colored.map(s => ({ name: s.name, color: s.color }))} columns={t.columns} rows={t.rows} note={note}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={describe(title, labels, series, unit)} onMouseLeave={() => setHover(null)}>
      <title>{describe(title, labels, series, unit)}</title>
      <Axes ticks={ticks} top={top} labels={labels} x={x} unit={unit} />
      {labels.map((l, i) => <g key={i} onMouseEnter={() => setHover(i)}>
        <rect x={L + band * i} y={T} width={band} height={H - T - B} fill={hover === i ? '#f1f5f9' : 'transparent'} />
        {colored.map((s, k) => {
          const v = Number(s.values[i] || 0), bx = x(i) - inner / 2 + k * (bw + 2), by = y(v), bh = H - B - by;
          return bh <= 0 ? null : <path key={k} d={roundTop(bx, by, bw, bh)} fill={s.color}>
            <title>{`${l} - ${s.name}: ${fmt(s.values[i], unit)}`}</title></path>;
        })}
      </g>)}
      {hover !== null && <g pointerEvents="none"><Tip x={x(hover)} lines={[labels[hover], ...colored.map(s => `${s.name}: ${fmt(s.values[hover], unit)}`)]} /></g>}
    </svg>
  </ChartFrame>;
}

/** A bar with the top corners rounded (4 px), standing on the baseline. */
function roundTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Parts of a whole per period, stacked (with a 2 px gap between parts). */
export function StackedBar({ title, labels, series, unit = '', note }: { title: string; labels: string[]; series: Series[]; unit?: string; note?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = labels.map((_, i) => series.reduce((s, x) => s + Number(x.values[i] || 0), 0));
  const ticks = niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1] || 1;
  const band = (W - L - R) / Math.max(1, labels.length);
  const x = (i: number) => L + band * i + band / 2;
  const scale = (v: number) => (H - T - B) * v / top;
  const bw = Math.min(40, band * 0.6);
  const colored = series.map((s, i) => ({ ...s, color: s.color || SERIES[i % SERIES.length] }));
  const t = tableOf(labels, [...series, { name: 'Total', values: totals }], unit);
  return <ChartFrame title={title} legend={colored.map(s => ({ name: s.name, color: s.color }))} columns={t.columns} rows={t.rows} note={note}>
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={describe(title, labels, series, unit)} onMouseLeave={() => setHover(null)}>
      <title>{describe(title, labels, series, unit)}</title>
      <Axes ticks={ticks} top={top} labels={labels} x={x} unit={unit} />
      {labels.map((l, i) => {
        let base = H - B;
        return <g key={i} onMouseEnter={() => setHover(i)}>
          <rect x={L + band * i} y={T} width={band} height={H - T - B} fill={hover === i ? '#f1f5f9' : 'transparent'} />
          {colored.map((s, k) => {
            const h = scale(Number(s.values[i] || 0));
            if (h <= 0) return null;
            const y0 = base - h; base = y0;
            return <rect key={k} x={x(i) - bw / 2} y={y0 + 1} width={bw} height={Math.max(0, h - 2)} rx={2} fill={s.color}>
              <title>{`${l} - ${s.name}: ${fmt(s.values[i], unit)}`}</title></rect>;
          })}
        </g>;
      })}
      {hover !== null && <g pointerEvents="none"><Tip x={x(hover)} lines={[labels[hover], ...colored.map(s => `${s.name}: ${fmt(s.values[hover], unit)}`), `Total: ${fmt(totals[hover], unit)}`]} /></g>}
    </svg>
  </ChartFrame>;
}

/** Shares of one whole. More than 6 parts: the smallest are put together as "Other". */
export function Donut({ title, parts, unit = '', note }: { title: string; parts: { label: string; value: number }[]; unit?: string; note?: ReactNode }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...parts].filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  const shown = sorted.length > 6 ? [...sorted.slice(0, 5), { label: 'Other', value: sorted.slice(5).reduce((s, p) => s + p.value, 0) }] : sorted;
  const total = shown.reduce((s, p) => s + p.value, 0);
  const cx = 110, cy = 110, ro = 100, ri = 62;
  let a0 = -Math.PI / 2;
  const pct = (v: number) => total ? `${(100 * v / total).toFixed(1)}%` : '-';
  const label = `${title}. ` + shown.map(p => `${p.label} ${fmt(p.value, unit)} (${pct(p.value)})`).join(', ');
  return <ChartFrame title={title} legend={shown.map((p, i) => ({ name: `${p.label} (${pct(p.value)})`, color: SERIES[i] }))}
    columns={['Part', 'Value', 'Share']} rows={shown.map(p => [p.label, fmt(p.value, unit), pct(p.value)])} note={note}>
    {total <= 0 ? <p className="text-sm text-slate-500">Nothing to show for this range.</p> :
      <svg viewBox="0 0 220 220" className="mx-auto h-auto w-full max-w-[260px]" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <title>{label}</title>
        {shown.map((p, i) => {
          const a1 = a0 + 2 * Math.PI * p.value / total, big = a1 - a0 > Math.PI ? 1 : 0;
          const pt = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
          const d = shown.length === 1
            ? `M${cx - ro},${cy}A${ro},${ro} 0 1 1 ${cx + ro},${cy}A${ro},${ro} 0 1 1 ${cx - ro},${cy}M${cx - ri},${cy}A${ri},${ri} 0 1 0 ${cx + ri},${cy}A${ri},${ri} 0 1 0 ${cx - ri},${cy}Z`
            : `M${pt(ro, a0)}A${ro},${ro} 0 ${big} 1 ${pt(ro, a1)}L${pt(ri, a1)}A${ri},${ri} 0 ${big} 0 ${pt(ri, a0)}Z`;
          a0 = a1;
          return <path key={p.label} d={d} fill={SERIES[i]} stroke="#fff" strokeWidth={2} fillRule="evenodd" opacity={hover === null || hover === i ? 1 : 0.55}
            onMouseEnter={() => setHover(i)}><title>{`${p.label}: ${fmt(p.value, unit)} (${pct(p.value)})`}</title></path>;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize={14} fontWeight={700} fill={INK}>{hover === null ? fmt(total, unit) : pct(shown[hover].value)}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill={AXIS}>{hover === null ? 'total' : shown[hover].label.slice(0, 18)}</text>
      </svg>}
  </ChartFrame>;
}
