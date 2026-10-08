/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-PRT-002 -- the dashboard of a partner's (customer's) login: its running trips with the temperature now, recent
// deliveries with the proof of delivery, its service figures and bills due, a "Book a load" button, and, when it is a
// C&F principal, its invoices, distributor outstanding, orders, stock by batch, stock statements, settlements and
// service levels (each only when its contract shows it). One API: GET /api/partner-account/dashboard. A block that
// cannot be read is listed in the notes; the rest still shows.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, FileText, PackagePlus, Thermometer, Truck } from 'lucide-react';
import { api, apiOpen } from '@/shared/services/api';
import { Banner, Section, btn } from '@/shared/components/FormKit';
import { day, inr, qty, when } from '@/modules/cnf/cnf';
import { Grid, Pill } from '@/modules/cnf/CnfKit';
import { fmtMoney, fmtTemp, fmtTempRange } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TEMP_TEXT: Record<string, string> = {
  IN_RANGE: 'In range', OUT_OF_RANGE: 'Out of range', ALERT: 'Alert open', STALE: 'No reading for 30 min', NO_DATA: 'No reading yet',
};

function Tile({ title, value, sub }: { title: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return <div className="rounded-2xl bg-white p-4 shadow-sm">
    <div className="text-xs font-semibold uppercase text-slate-500">{title}</div>
    <div className="mt-1 text-2xl font-black text-slate-900">{value ?? '-'}</div>
    {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
  </div>;
}

const pct = (v: unknown) => (v === null || v === undefined ? '-' : `${qty(v)}%`);

export function PartnerDashboardPage() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/api/partner-account/dashboard').then(setD).catch(x => setError(String((x as Error).message))); }, []);
  if (!d) return <Banner error={error} />;
  const k = d.kpi || {};
  const c = d.cnf;
  const sl = c?.serviceLevels;
  return <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">Welcome, {d.partner?.name}</h1>
        <p className="text-slate-600">Your trips, deliveries and bills with RefTech{c ? ', and your C&F depot' : ''}.</p>
      </div>
      <Link to={d.bookLoadLink || '/loads#create-load'} className={`${btn} flex items-center gap-2`}><PackagePlus className="h-5 w-5" />Book a load</Link>
    </div>
    <Banner error={error} />
    {(d.notes || []).length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Some parts could not be shown just now: {d.notes.join('; ')}.</div>}

    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Tile title="Trips (90 days)" value={k.trips} sub={`${k.running ?? 0} running, ${k.completed ?? 0} completed`} />
      <Tile title="On time" value={pct(k.onTimePct)} sub={`of ${k.onTimeMeasured ?? 0} trips measured`} />
      <Tile title="Temperature excursions" value={pct(k.excursionPct)} sub={`${k.excursionTrips ?? 0} trips, ${k.excursionMinutes ?? 0} minutes`} />
      <Tile title="To pay" value={inr(k.outstanding) || fmtMoney(0)} sub={Number(k.overdue) > 0 ? <span className="font-bold text-red-700">{inr(k.overdue)} overdue</span> : 'Nothing overdue'} />
    </div>

    <Section title={<span className="flex items-center gap-2"><Truck className="h-5 w-5 text-sky-700" />Running trips ({(d.runningTrips || []).length})</span>}>
      <Grid rows={d.runningTrips || []} empty="No trip of yours is running now." cols={[
        { key: 'tripNumber', title: 'Trip', render: x => <Link to={`/trips/${x.id}`} className="font-semibold text-sky-700">{x.tripNumber}</Link> },
        { key: 'vehicle', title: 'Truck' }, { key: 'route', title: 'Route', render: x => `${x.from || '-'} → ${x.to || '-'}` },
        { key: 'startedAt', title: 'Started', render: x => when(x.startedAt) },
        { key: 'etaAt', title: 'Arrival', render: x => (x.etaAt ? <>{when(x.etaAt)}{Number(x.delayMinutes) > 0 && <span className="ml-1 text-xs font-bold text-red-700">late {x.delayMinutes} min</span>}</> : '-') },
        { key: 'temp', title: 'Temperature', render: x => <span className="flex items-center gap-1"><Thermometer className="h-4 w-4 text-slate-500" />
          {x.temperatureC != null ? fmtTemp(x.temperatureC) : '-'}
          <span className="text-xs text-slate-500">{x.minC != null || x.maxC != null ? `(${fmtTempRange(x.minC, x.maxC)})` : ''}</span></span> },
        { key: 'temperatureState', title: 'State', render: x => <span title={x.readAt ? `Read ${when(x.readAt)}` : ''}><Pill s={x.temperatureState} /> <span className="text-xs text-slate-500">{TEMP_TEXT[x.temperatureState] || ''}</span></span> }]} />
    </Section>

    <Section title="Deliveries in the last 30 days">
      <Grid rows={d.deliveries || []} empty="No deliveries in the last 30 days." cols={[
        { key: 'deliveredAt', title: 'Delivered', render: x => when(x.deliveredAt) }, { key: 'tripNumber', title: 'Trip' }, { key: 'deliveredTo', title: 'To' },
        { key: 'receiverName', title: 'Received by' }, { key: 'podNumber', title: 'POD' },
        { key: 'temperatureC', title: 'Temp.', render: x => (x.temperatureC != null ? `${fmtTemp(x.temperatureC)}${String(x.temperatureInRange) === 'false' ? ' (out of range)' : ''}` : '-') },
        { key: 'condition', title: 'Condition' },
        { key: 'proof', title: '', render: x => <button className="text-sm font-semibold text-sky-700 underline" onClick={() => apiOpen(x.proofLink).catch(e => setError(String((e as Error).message)))}>Proof of delivery</button> }]} />
    </Section>

    <Section title="Bills due to RefTech">
      <Grid rows={d.billsDue || []} empty="No bill is due." cols={[
        { key: 'invoiceNumber', title: 'Bill' }, { key: 'invoiceDate', title: 'Date', render: x => day(x.invoiceDate) },
        { key: 'dueDate', title: 'Due', render: x => <span className={x.overdue ? 'font-bold text-red-700' : ''}>{day(x.dueDate)}{x.overdue ? ' (overdue)' : ''}</span> },
        { key: 'totalAmount', title: 'Amount', right: true, render: x => inr(x.totalAmount) }, { key: 'outstanding', title: 'To pay', right: true, render: x => inr(x.outstanding) }]} />
    </Section>

    {c && <>
      <h2 className="mt-6 flex items-center gap-2 text-2xl font-bold"><Boxes className="h-6 w-6 text-sky-700" />C&amp;F depot <span className="text-base font-normal text-slate-600">contract {c.contractNo}</span> <Pill s={c.status} />
        <Link to="/cnf" className="ml-auto text-sm font-bold text-sky-700">Open My C&amp;F Agent →</Link></h2>
      {sl && <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile title="On-time deliveries (30 days)" value={pct(sl.onTimePct)} sub={`of ${sl.onTimeMeasured ?? 0} orders measured`} />
        <Tile title="Fill rate" value={pct(sl.fillRatePct)} sub="Quantity sent against quantity ordered" />
        <Tile title="Order to dispatch" value={sl.avgDispatchHours != null ? `${qty(sl.avgDispatchHours)} h` : '-'} sub="Average hours" />
        <Tile title="Orders dispatched" value={sl.ordersDispatched ?? 0} sub={`last ${sl.periodDays} days`} />
      </div>}
      {c.invoices && <Section title={<span className="flex items-center gap-2"><FileText className="h-5 w-5 text-sky-700" />Invoices to your distributors</span>}
        right={<span className="text-sm text-slate-600">This month: {c.invoices.thisMonth?.count ?? 0} for {inr(c.invoices.thisMonth?.total)}</span>}>
        <Grid rows={c.invoices.recent || []} empty="No invoices yet." cols={[
          { key: 'invoiceNo', title: 'Invoice' }, { key: 'invoiceDate', title: 'Date', render: x => day(x.invoiceDate) }, { key: 'distributorName', title: 'Distributor' },
          { key: 'total', title: 'Total', right: true, render: x => inr(x.total) }, { key: 'dueDate', title: 'Due', render: x => day(x.dueDate) },
          { key: 'ewayBillNo', title: 'E-way bill' }, { key: 'hasIrn', title: 'IRN', render: x => (x.hasIrn ? 'Yes' : 'No') }]} />
      </Section>}
      {c.outstanding && <Section title="What your distributors owe">
        <Grid rows={c.outstanding} empty="No distributors yet." cols={[
          { key: 'code', title: 'Code' }, { key: 'name', title: 'Distributor' }, { key: 'creditLimit', title: 'Credit limit', right: true, render: x => inr(x.creditLimit) || 'No limit' },
          { key: 'outstanding', title: 'Owes', right: true, render: x => inr(x.outstanding) },
          { key: 'overdueDays', title: 'Oldest overdue', right: true, render: x => (Number(x.overdueDays) > 0 ? <span className="font-bold text-red-700">{x.overdueDays} days</span> : '-') }]} />
      </Section>}
      {c.orders && <Section title="Orders" right={<span className="flex flex-wrap gap-2 text-sm">{Object.entries(c.orders.counts || {}).map(([s, n]) => <span key={s}><Pill s={s} /> {String(n)}</span>)}</span>}>
        <Grid rows={c.orders.recent || []} empty="No orders yet." cols={[
          { key: 'orderNo', title: 'Order' }, { key: 'orderDate', title: 'Date', render: x => day(x.orderDate) }, { key: 'distributorName', title: 'Distributor' },
          { key: 'totalValue', title: 'Value', right: true, render: x => inr(x.totalValue) }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
          { key: 'holdReason', title: 'Held because' }]} />
      </Section>}
      {c.stock && <Section title="Your stock at the depot, by batch">
        <Grid rows={c.stock} empty="No stock at the depot." cols={[
          { key: 'productCode', title: 'Code' }, { key: 'productName', title: 'Product' }, { key: 'batchNo', title: 'Batch' },
          { key: 'expiryDate', title: 'Expiry', render: x => <span className={Number(x.daysToExpiry) <= 7 ? 'font-bold text-red-700' : ''}>{day(x.expiryDate)}{x.daysToExpiry != null ? ` (${x.daysToExpiry} days)` : ''}</span> },
          { key: 'warehouseName', title: 'Depot' }, { key: 'quantity', title: 'Quantity', right: true, render: x => `${qty(x.quantity)} ${x.uom || ''}` },
          { key: 'free', title: 'Free', right: true, render: x => qty(x.free) }, { key: 'onHold', title: 'On hold', right: true, render: x => qty(x.onHold) }]} />
      </Section>}
      {c.statements && <Section title="Daily stock statements">
        <Grid rows={c.statements} empty="No statements yet." cols={[
          { key: 'day', title: 'Day', render: x => day(x.day) }, { key: 'warehouseName', title: 'Depot' }, { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> },
          { key: 'openDifferences', title: 'Open differences', right: true }]} />
      </Section>}
      {c.settlements && <Section title="Monthly settlements">
        <Grid rows={c.settlements} empty="No settlement has been sent to you yet." cols={[
          { key: 'settlementNo', title: 'Settlement' }, { key: 'periodMonth', title: 'Month', render: x => String(x.periodMonth || '').slice(0, 7) },
          { key: 'dueToCnf', title: 'Due to C&F', right: true, render: x => inr(x.dueToCnf) }, { key: 'netToPrincipal', title: 'Net to you', right: true, render: x => inr(x.netToPrincipal) },
          { key: 'status', title: 'Status', render: x => <Pill s={x.status} /> }]} />
      </Section>}
    </>}
  </>;
}
