/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PLT-016 -- System Health. A company Admin sees the overall status and its reasons. The platform owner also sees
// each database, Redis, file store, jobs, backups, memory and disk, two charts of the last 24 hours (requests and
// slowest-5% answer time, one chart each, from the 5-minute snapshots), the slowest addresses, database sizes and
// growth, alert history and the alert thresholds.
// Backend: /api/platform/health and /api/platform/monitor/** (MonitorController).
import { FormEvent, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '@/shared/services/api';
import { DataTable } from '@/shared/components/DataTable';
import { Banner, Section, btn, btnLight, input, label, td, th } from '@/shared/components/FormKit';
import { Badge, useRunner, when } from '@/modules/hr/hr';
import { NotAllowed, PageTitle, ScriptMissing, bytes, usePlatform } from './platform';
import { fmtTime } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TONE: Record<string, string> = { UP: 'border-emerald-300 bg-emerald-50 text-emerald-900', DEGRADED: 'border-amber-300 bg-amber-50 text-amber-900', DOWN: 'border-red-300 bg-red-50 text-red-900' };

function StatusIcon({ s }: { s: string }) {
  if (s === 'UP') return <CheckCircle2 aria-hidden className="h-6 w-6" />;
  if (s === 'DOWN') return <XCircle aria-hidden className="h-6 w-6" />;
  return <AlertTriangle aria-hidden className="h-6 w-6" />;
}

function Tile({ title, ok, children }: { title: string; ok?: boolean | null; children: any }) {
  const tone = ok === false ? 'border-red-300 bg-red-50' : ok === true ? 'border-emerald-200 bg-white' : 'border-slate-200 bg-white';
  return <div className={`rounded-2xl border p-3 ${tone}`}>
    <div className="flex items-center gap-1 text-sm font-semibold text-slate-600">{ok === false ? <XCircle aria-hidden className="h-4 w-4 text-red-700" /> : ok === true ? <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-700" /> : null}{title}{ok === false && <span className="sr-only"> (problem)</span>}</div>
    <div className="mt-1 text-sm">{children}</div>
  </div>;
}

/** A small line chart (one series, inline SVG) with a hover read-out and a hidden table for screen readers. */
function LineChart({ title, points, unit }: { title: string; points: { t: string; v: number }[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 160, L = 48, R = 8, T = 10, B = 24;
  if (points.length === 0) return <div><h3 className="font-semibold">{title}</h3><p className="text-sm text-slate-500">No snapshots in the last 24 hours yet (one is taken every 5 minutes).</p></div>;
  const t0 = new Date(points[0].t).getTime(), t1 = new Date(points[points.length - 1].t).getTime() || t0 + 1;
  const max = Math.max(1, ...points.map(p => p.v));
  const x = (t: string) => L + ((new Date(t).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const hp = hover === null ? null : points[hover];
  const time = (t: string) => fmtTime(t);
  function move(e: React.MouseEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * (W - L - R) + L;
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(x(p.t) - px) < Math.abs(x(points[best].t) - px)) best = i; });
    setHover(best);
  }
  return <figure className="min-w-0">
    <figcaption className="flex justify-between gap-2 font-semibold"><span>{title}</span>
      <span className="text-sm font-normal text-slate-600" aria-live="polite">{hp ? `${time(hp.t)}: ${hp.v} ${unit}` : `highest ${max} ${unit}`}</span></figcaption>
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" role="img" aria-label={`${title}, last 24 hours, highest ${max} ${unit}`}>
      {[0, 0.5, 1].map(f => <g key={f}>
        <line x1={L} x2={W - R} y1={y(max * f)} y2={y(max * f)} stroke="#e2e8f0" strokeWidth={1} />
        <text x={L - 6} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill="#64748b">{Math.round(max * f)}</text>
      </g>)}
      <text x={L} y={H - 6} fontSize={11} fill="#64748b">{time(points[0].t)}</text>
      <text x={W - R} y={H - 6} fontSize={11} fill="#64748b" textAnchor="end">{time(points[points.length - 1].t)}</text>
      <path d={d} fill="none" stroke="#0369a1" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {hp && <g>
        <line x1={x(hp.t)} x2={x(hp.t)} y1={T} y2={H - B} stroke="#94a3b8" strokeWidth={1} />
        <circle cx={x(hp.t)} cy={y(hp.v)} r={4} fill="#0369a1" stroke="#fff" strokeWidth={2} />
      </g>}
      <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" onMouseMove={move} onMouseLeave={() => setHover(null)} />
    </svg>
    <table className="sr-only"><caption>{title}</caption><thead><tr><th scope="col">Time</th><th scope="col">{unit}</th></tr></thead>
      <tbody>{points.map(p => <tr key={p.t}><td>{time(p.t)}</td><td>{p.v}</td></tr>)}</tbody></table>
  </figure>;
}

export function SystemHealthPage() {
  const st = usePlatform();
  const [h, setH] = useState<any>(null), [snaps, setSnaps] = useState<any[]>([]), [slow, setSlow] = useState<any>(null), [cap, setCap] = useState<any>(null), [cfg, setCfg] = useState<any>(null);
  const load = async () => {
    setH(await api('/api/platform/health'));
    if (st?.owner) {
      const s = await api('/api/platform/monitor/snapshots?hours=24');
      setSnaps(Array.isArray(s) ? s : []);
      setSlow(await api('/api/platform/monitor/slowest'));
      setCap(await api('/api/platform/monitor/capacity'));
      setCfg(await api('/api/platform/monitor/settings'));
    }
  };
  const r = useRunner(load);
  useEffect(() => { if (st && (st.admin || st.owner)) load().catch(e => r.setErr(e.message)); }, [st?.admin, st?.owner]);
  const title = <PageTitle icon={<Activity aria-hidden />} title="System Health">Is everything working: databases, files, background jobs, backups and speed.</PageTitle>;
  if (!st) return <>{title}<p className="mt-4 text-slate-500">Loading...</p></>;
  if (!st.admin && !st.owner) return <>{title}<NotAllowed what="see the system health (Admin only)" /></>;

  function saveCfg(e: FormEvent) { e.preventDefault(); void r.run(() => api('/api/platform/monitor/settings', { method: 'PUT', body: JSON.stringify(cfg) }), 'Monitoring settings saved'); }
  const hours = (s: number) => s < 3600 ? `${Math.round(s / 60)} minutes` : s < 172800 ? `${Math.round(s / 3600)} hours` : `${Math.round(s / 86400)} days`;

  return <>
    {title}
    {!st.ready && <ScriptMissing />}
    <Banner msg={r.msg} error={r.err} />
    <div className="mt-2"><button type="button" disabled={r.busy} className={btnLight} onClick={() => r.run(load, 'Checked again')}>Check again</button></div>
    {h && <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${TONE[h.status] || TONE.DEGRADED}`} role={h.status === 'UP' ? 'status' : 'alert'}>
      <StatusIcon s={h.status} />
      <div><div className="text-xl font-bold">{h.status === 'UP' ? 'Everything works' : h.status === 'DOWN' ? 'The system is down' : 'Working, with problems'} ({h.status})</div>
        {h.reasons?.length > 0 && <ul className="mt-1 list-disc pl-5 text-sm">{h.reasons.map((x: string) => <li key={x}>{x}</li>)}</ul>}
        <div className="mt-1 text-xs">Version {h.version}, running for {hours(h.uptimeSeconds || 0)}, checked {when(h.checkedAt)}</div></div>
    </div>}

    {h && h.owner && <>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {h.databases.map((d: any) => <Tile key={d.code} title={d.name} ok={d.ok}>{d.ok ? `answers in ${d.ms} ms` : d.error}</Tile>)}
        <Tile title="Redis (cache)" ok={h.redis.present ? h.redis.ok : null}>{!h.redis.present ? 'Not set up' : h.redis.ok ? `answers in ${h.redis.ms} ms` : h.redis.error}</Tile>
        <Tile title={`File store (${h.fileStore.provider})`} ok={h.fileStore.ok}>{h.fileStore.ok ? 'Can write and read' : h.fileStore.error}</Tile>
        <Tile title="Email" ok={h.mail.configured ? true : null}>{h.mail.configured ? 'Mail server set up' : 'No mail server (spring.mail.host)'}{!h.mail.alertEmail && <div className="text-xs text-slate-500">No alert address (app.monitoring.alert-email)</div>}</Tile>
        <Tile title="Background jobs" ok={(h.jobs.deadLast24h || 0) === 0}>{h.jobs.QUEUED ?? 0} waiting, {h.jobs.RUNNING ?? 0} running, {h.jobs.deadLast24h ?? 0} stopped in 24 h</Tile>
        <Tile title="Last good backup" ok={h.backup.worstAgeHours === null || h.backup.worstAgeHours === undefined ? false : h.backup.worstAgeHours <= 26}>{h.backup.worstAgeHours == null ? 'A database has no backup yet' : `oldest of the 4: ${h.backup.worstAgeHours} hours ago`}</Tile>
        <Tile title="Requests (15 min)" ok={null}>{h.requests.requests15m} requests, {h.requests.errorRatePercent}% errors, slowest 5% take {h.requests.p95Ms} ms</Tile>
        <Tile title="Memory" ok={h.heap.percent < 90}>{bytes(h.heap.used)} of {bytes(h.heap.max)} ({h.heap.percent}%)</Tile>
        <Tile title="Disk of the file store" ok={h.disk.freePercent == null ? null : h.disk.freePercent >= (cfg?.diskFreePercent ?? 10)}>{h.disk.error || `${bytes(h.disk.free)} free of ${bytes(h.disk.total)} (${h.disk.freePercent}%)`}</Tile>
        <Tile title="Database connections" ok={null}>{Object.entries(h.pools || {}).map(([k, v]: [string, any]) => <div key={k}>{k}: {v.active} in use of {v.max}{v.waiting ? `, ${v.waiting} waiting` : ''}</div>)}</Tile>
      </div>

      <Section title="Last 24 hours">
        <div className="grid gap-6 lg:grid-cols-2">
          <LineChart title="Requests per 5 minutes" unit="requests" points={snaps.map(s => ({ t: s.takenAt, v: Number(s.requests || 0) }))} />
          <LineChart title="Slowest 5% of answers (p95)" unit="ms" points={snaps.map(s => ({ t: s.takenAt, v: Number(s.p95Ms || 0) }))} />
        </div>
      </Section>

      {slow && <Section title="Slowest addresses (last 15 minutes, this server)">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-slate-50"><th scope="col" className={th}>Address</th><th scope="col" className={th}>Requests</th><th scope="col" className={th}>Errors</th><th scope="col" className={th}>Middle (p50)</th><th scope="col" className={th}>Slowest 5% (p95)</th><th scope="col" className={th}>Slowest</th></tr></thead>
          <tbody>{slow.items.map((g: any) => <tr key={g.group} className="border-t"><td className={`${td} font-mono text-xs`}>{g.group}</td><td className={td}>{g.requests}</td><td className={td}>{g.errors}</td>
            <td className={td}>{g.p50Ms} ms</td><td className={td}>{g.p95Ms} ms</td><td className={td}>{g.maxMs} ms</td></tr>)}
            {slow.items.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No requests yet.</td></tr>}</tbody>
        </table></div>
      </Section>}

      {cap && <Section title="Database sizes and growth" right={<button type="button" disabled={r.busy} className={btnLight} onClick={() => r.run(async () => { const x = await api('/api/platform/monitor/capacity/run', { method: 'POST' }); setCap(x); return x; })}>Measure now</button>}>
        {!cap.takenOn ? <p className="text-sm text-slate-500">Not measured yet. Sizes are taken every night at 02:40, or press Measure now.</p> : <>
          <p className="text-sm text-slate-600">Measured {String(cap.takenOn)}. All 4 databases: <b>{bytes(cap.totalBytes)}</b>, growing about <b>{bytes(cap.growthPerDay)}</b> a day.
            {cap.diskSizeGb > 0 ? cap.daysUntilFull != null ? <> At this growth the {cap.diskSizeGb} GB disk is full in <b>{cap.daysUntilFull} days</b>.</> : ' The data is not growing.' : ' Set the disk size below to see when the disk is full.'}</p>
          <div className="mt-2 grid gap-3 md:grid-cols-4">{cap.databases.map((d: any) => <Tile key={d.code} title={d.name} ok={null}>{d.bytes != null ? bytes(d.bytes) : '-'}{d.growth30Days != null && <div className="text-xs text-slate-500">{d.growth30Days >= 0 ? '+' : ''}{bytes(Math.abs(d.growth30Days))} per 30 days</div>}</Tile>)}</div>
          <div className="mt-3 overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="bg-slate-50"><th scope="col" className={th}>Database</th><th scope="col" className={th}>Table</th><th scope="col" className={th}>Rows (about)</th><th scope="col" className={th}>Size</th><th scope="col" className={th}>Growth in 30 days</th></tr></thead>
            <tbody>{cap.tables.slice(0, 30).map((t: any) => <tr key={t.database + t.table} className="border-t"><td className={td}>{t.database}</td><td className={`${td} font-mono text-xs`}>{t.table}</td>
              <td className={td}>{Number(t.rows || 0).toLocaleString('en-IN')}</td><td className={td}>{bytes(t.bytes)}</td><td className={td}>{t.growth30Days == null ? '-' : bytes(t.growth30Days)}</td></tr>)}</tbody>
          </table></div></>}
      </Section>}

      {st.ready && <Section title="Alerts">
        <DataTable path="/api/platform/monitor/alerts" pageSize={10}
          filters={[{ name: 'status', label: 'Status', options: [['OPEN', 'Open'], ['RECOVERED', 'Recovered']] }, { name: 'firstAt', label: 'Date', range: 'date' }]}
          columns={[
            { key: 'firstAt', label: 'Started', sort: 'firstAt', render: x => when(x.firstAt) },
            { key: 'problem', label: 'Problem', sort: 'problem' },
            { key: 'status', label: 'Status', render: x => <Badge v={x.status} /> },
            { key: 'message', label: 'Message', className: 'max-w-md' },
            { key: 'sentCount', label: 'Sent' },
            { key: 'recoveredAt', label: 'Recovered', render: x => when(x.recoveredAt) },
          ]} />
      </Section>}

      {cfg && st.ready && <Section title="Alert thresholds">
        <form onSubmit={saveCfg} className="grid gap-3 md:grid-cols-5">
          {([['errorRatePercent', 'Error rate above (%)'], ['p95Ms', 'Slowest 5% above (ms)'], ['diskFreePercent', 'Disk free below (%)'], ['diskSizeGb', 'Database disk size (GB)']] as [string, string][]).map(([k, t]) =>
            <div key={k}><label htmlFor={`cfg-${k}`} className={label}>{t}</label><input id={`cfg-${k}`} type="number" min={0} className={input} value={cfg[k] ?? ''} onChange={e => setCfg({ ...cfg, [k]: e.target.value })} /></div>)}
          <div className="flex items-end"><button disabled={r.busy} className={btn}>Save</button></div>
          <p className="text-sm text-slate-600 md:col-span-5">Alerts go to the Admins of RefTech (bell) and by email to {cfg.alertEmail || 'nobody yet (set app.monitoring.alert-email)'}{!cfg.mailConfigured && ' - no mail server is set up'}. One alert per problem per hour, and a message when it clears.</p>
        </form>
      </Section>}
    </>}

    {h && !h.owner && h.jobs && <Section title="Background jobs of your company">
      <p className="text-sm">{h.jobs.QUEUED ?? 0} waiting, {h.jobs.RUNNING ?? 0} running, {h.jobs.FAILED ?? 0} failed (will try again), {h.jobs.DEAD ?? 0} stopped.</p>
    </Section>}
  </>;
}
