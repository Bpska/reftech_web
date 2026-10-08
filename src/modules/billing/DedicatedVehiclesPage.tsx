/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-012 -- Dedicated Vehicles. Manager and Admin only, like the Vehicle Rate Contracts of the Monthly
// Vehicle Bill, whose table (vehicle_billing_contract) this screen uses.
//
// A dedicated truck is given to one customer for a fixed monthly charge with km or days included. The month's bill is
// built from the trips of the truck and a day-by-day calendar: a day the truck was not available (breakdown,
// maintenance, no driver, off hire) is deducted; km beyond the included km are charged at the extra-km rate.
// Backend: /api/billing/dedicated/... (DedicatedVehicleController).
// Needs database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql on reftech_billing.
import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { UNAVAILABLE, working } from './dedicated';

const rupee = (n: unknown) => fmtMoney(Number(n || 0));
const num = (n: unknown) => (n === null || n === undefined || n === '' ? '-' : String(Number(n)));
const lastMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };
const SCRIPT = 'database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql';

const DAY_COLOUR: Record<string, string> = {
  ON_TRIP: 'bg-emerald-100 text-emerald-900', AVAILABLE: 'bg-slate-100 text-slate-700',
  CUSTOMER_IDLE: 'bg-sky-100 text-sky-900', BREAKDOWN: 'bg-red-100 text-red-800',
  MAINTENANCE: 'bg-orange-100 text-orange-900', NO_DRIVER: 'bg-amber-100 text-amber-900', OFF_HIRE: 'bg-purple-100 text-purple-900',
};

export function DedicatedVehiclesPage() {
  const [data, setData] = useState<any>(null);
  const [contractId, setContractId] = useState<string>('');
  const [month, setMonth] = useState(lastMonth());
  const [cal, setCal] = useState<any>(null);
  const [edits, setEdits] = useState<Record<string, { status: string; reason: string }>>({});
  const [statements, setStatements] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const ready = data ? data.ready !== false : true;
  const contract = (data?.contracts || []).find((c: any) => String(c.id) === String(contractId));

  const load = async () => {
    setErr('');
    try {
      const d = await api('/api/billing/dedicated/contracts');
      setData(d);
      const first = (d.contracts || []).find((c: any) => c.dedicated) || (d.contracts || [])[0];
      if (first && !contractId) setContractId(String(first.id));
    } catch (e) { setErr(errorText(e, 'Could not load the contracts.')); }
  };
  useEffect(() => { void load(); }, []);

  const loadCalendar = async () => {
    if (!contractId) return;
    setErr(''); setEdits({});
    try {
      const [c, s] = await Promise.all([api(`/api/billing/dedicated/contracts/${contractId}/calendar?month=${month}`), api(`/api/billing/dedicated/statements?contractId=${contractId}`)]);
      setCal(c); setStatements(s.statements || []);
    } catch (e) { setErr(errorText(e, 'Could not load the month.')); }
  };
  useEffect(() => { void loadCalendar(); }, [contractId, month]);

  const saveContract = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const r = form.id ? await api(`/api/billing/dedicated/contracts/${form.id}`, { method: 'PUT', body: JSON.stringify(form) })
        : await api('/api/billing/dedicated/contracts', { method: 'POST', body: JSON.stringify(form) });
      setMsg(r.message || 'Saved.'); setForm(null); await load(); await loadCalendar();
    } catch (e) { setErr(errorText(e, 'Could not save the contract.')); } finally { setBusy(false); }
  };

  const saveDays = async () => {
    const days = Object.entries(edits).map(([day, v]) => ({ day, status: v.status, reason: v.reason }));
    if (days.length === 0) { setMsg('Nothing was changed.'); return; }
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/dedicated/contracts/${contractId}/calendar`, { method: 'PUT', body: JSON.stringify({ days }) }); setMsg(r.message || 'The calendar is saved.'); await loadCalendar(); }
    catch (e) { setErr(errorText(e, 'Could not save the calendar.')); } finally { setBusy(false); }
  };

  const build = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/dedicated/contracts/${contractId}/statements`, { method: 'POST', body: JSON.stringify({ month }) }); setOpen(r); setMsg(`The statement of ${month} is ready: ${rupee(r.totalAmount)}.`); await loadCalendar(); }
    catch (e) { setErr(errorText(e, 'Could not build the statement.')); } finally { setBusy(false); }
  };

  const bill = async (id: number) => {
    if (!window.confirm('Make the monthly bill from this statement?')) return;
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api(`/api/billing/dedicated/statements/${id}/bill`, { method: 'POST' }); setMsg(r.message || 'The bill is made.'); setOpen(null); await loadCalendar(); }
    catch (e) { setErr(errorText(e, 'Could not make the bill.')); } finally { setBusy(false); }
  };

  const drop = async (id: number) => {
    if (!window.confirm('Drop this statement? It is not billed.')) return;
    setBusy(true); setErr('');
    try { const r = await api(`/api/billing/dedicated/statements/${id}`, { method: 'DELETE' }); setMsg(r.message || 'Dropped.'); setOpen(null); await loadCalendar(); }
    catch (e) { setErr(errorText(e, 'Could not drop the statement.')); } finally { setBusy(false); }
  };

  const showStatement = async (id: number) => {
    setErr('');
    try { setOpen(await api(`/api/billing/dedicated/statements/${id}`)); }
    catch (e) { setErr(errorText(e, 'Could not open the statement.')); }
  };

  const blank = () => setForm({
    vehicleId: '', partnerId: '', effectiveFrom: `${month}-01`, effectiveTo: '', fixedMonthlyAmount: '', fixedBasisDays: 30,
    includedKmPerMonth: '', extraKmRate: '', includedDaysPerMonth: '', extraDayRate: '', deductionBasis: 'PRORATA',
    deductionPerDay: '', freeDowntimeDays: 0, gstRate: 18, notes: '',
  });

  // What the preview comes to while the staff type on the calendar (the server works out the bill itself).
  const localPreview = () => {
    if (!cal?.contract || !cal?.days) return null;
    const days = cal.days.map((d: any) => ({ status: edits[d.day]?.status && edits[d.day].status !== 'AUTO' ? edits[d.day].status : d.status }));
    const unavailable = days.filter((d: any) => UNAVAILABLE.includes(d.status)).length;
    const used = days.filter((d: any) => d.status === 'ON_TRIP').length;
    const km = (cal.trips || []).reduce((s: number, t: any) => s + Number(t.km || 0), 0);
    const monthDays = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    return working(cal.contract, cal.days.length, monthDays, unavailable, km, used);
  };
  const preview = localPreview();

  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Truck className="h-6 w-6" /> Dedicated Vehicles</h1>
    <p className="mt-1 text-slate-600">
      A truck given to one customer for a fixed monthly charge, with km or days included and a rate for anything beyond.
      The month's bill is built from the trips of the truck and the calendar below: a day the truck was not available is deducted.
    </p>
    <Banner msg={msg} error={err} />
    {!ready && <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">This screen needs the database script <b>{SCRIPT}</b> on reftech_billing. Ask the administrator to run it, then reload.</div>}

    {ready && <>
      <Section title="Contracts" right={<button type="button" className={btn} onClick={blank}>Add a contract</button>}>
        {form && <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className={label}>Truck</span>
              <select className={input} value={form.vehicleId} disabled={!!form.id} onChange={e => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">Choose</option>{(data?.vehicles || []).map((v: any) => <option key={v.id} value={v.id}>{v.vehicleNumber}</option>)}
              </select></div>
            <div><span className={label}>Customer</span>
              <select className={input} value={form.partnerId} disabled={!!form.id} onChange={e => setForm({ ...form, partnerId: e.target.value })}>
                <option value="">Choose</option>{(data?.partners || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select></div>
            <div><span className={label}>From</span><input type="date" className={input} value={form.effectiveFrom} disabled={!!form.id} onChange={e => setForm({ ...form, effectiveFrom: e.target.value })} /></div>
            <div><span className={label}>To (optional)</span><input type="date" className={input} value={form.effectiveTo || ''} onChange={e => setForm({ ...form, effectiveTo: e.target.value })} /></div>
            <div><span className={label}>Fixed monthly charge (Rs)</span><input className={input} value={form.fixedMonthlyAmount} onChange={e => setForm({ ...form, fixedMonthlyAmount: e.target.value })} /></div>
            <div><span className={label}>Over how many days</span><input className={input} value={form.fixedBasisDays} onChange={e => setForm({ ...form, fixedBasisDays: e.target.value })} /></div>
            <div><span className={label}>Km included a month</span><input className={input} value={form.includedKmPerMonth || ''} onChange={e => setForm({ ...form, includedKmPerMonth: e.target.value })} /></div>
            <div><span className={label}>Extra km rate (Rs)</span><input className={input} value={form.extraKmRate || ''} onChange={e => setForm({ ...form, extraKmRate: e.target.value })} /></div>
            <div><span className={label}>Days included a month</span><input className={input} value={form.includedDaysPerMonth || ''} onChange={e => setForm({ ...form, includedDaysPerMonth: e.target.value })} /></div>
            <div><span className={label}>Rate per extra day (Rs)</span><input className={input} value={form.extraDayRate || ''} onChange={e => setForm({ ...form, extraDayRate: e.target.value })} /></div>
            <div><span className={label}>Days not available</span>
              <select className={input} value={form.deductionBasis} onChange={e => setForm({ ...form, deductionBasis: e.target.value })}>
                <option value="PRORATA">Deduct pro-rata</option><option value="PER_DAY">Deduct a fixed amount a day</option><option value="NONE">Deduct nothing</option>
              </select></div>
            <div><span className={label}>Deduction a day (Rs)</span><input className={input} value={form.deductionPerDay || ''} disabled={form.deductionBasis !== 'PER_DAY'} onChange={e => setForm({ ...form, deductionPerDay: e.target.value })} /></div>
            <div><span className={label}>Free downtime days</span><input className={input} value={form.freeDowntimeDays} onChange={e => setForm({ ...form, freeDowntimeDays: e.target.value })} /></div>
            <div><span className={label}>GST %</span><input className={input} value={form.gstRate} onChange={e => setForm({ ...form, gstRate: e.target.value })} /></div>
            <div className="md:col-span-2"><span className={label}>Notes</span><input className={input} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={saveContract}>Save</button>
            <button type="button" className={btnLight} onClick={() => setForm(null)}>Cancel</button></div>
        </div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Truck</th><th className={th}>Customer</th><th className={th}>From</th><th className={th}>Monthly</th>
            <th className={th}>Km included</th><th className={th}>Extra km</th><th className={th}>Not available</th><th className={th}>Last billed</th><th className={th} />
          </tr></thead><tbody>
            {(data?.contracts || []).map((c: any) => <tr key={c.id} className={`border-b border-slate-100 ${String(c.id) === String(contractId) ? 'bg-sky-50' : ''}`}>
              <td className={td}>{c.vehicleNumber || c.vehicleId}{c.dedicated ? <div className="text-xs text-emerald-700">dedicated</div> : null}</td>
              <td className={td}>{c.partnerName || '-'}</td>
              <td className={td}>{c.effectiveFrom}{c.effectiveTo ? ` to ${c.effectiveTo}` : ''}</td>
              <td className={td}>{rupee(c.fixedMonthlyAmount)}<div className="text-xs text-slate-500">over {num(c.fixedBasisDays)} days</div></td>
              <td className={td}>{num(c.includedKmPerMonth)}</td><td className={td}>{rupee(c.extraKmRate)}</td>
              <td className={td}>{c.deductionBasis === 'NONE' ? 'not deducted' : c.deductionBasis === 'PER_DAY' ? `${rupee(c.deductionPerDay)} a day` : 'pro-rata'}{c.freeDowntimeDays ? ` (${c.freeDowntimeDays} free)` : ''}</td>
              <td className={td}>{c.lastBilledMonth ? String(c.lastBilledMonth).slice(0, 7) : '-'}</td>
              <td className={td}><button type="button" className={btnLight} onClick={() => setContractId(String(c.id))}>Open the month</button>{' '}
                <button type="button" className={btnLight} onClick={() => setForm({ ...c })}>Change</button></td>
            </tr>)}
            {(data?.contracts || []).length === 0 && <tr><td className={td} colSpan={9}>No vehicle contract yet.</td></tr>}
          </tbody></table>
        </div>
      </Section>

      {contractId && <Section title={`The month of ${contract?.vehicleNumber || ''}`} right={<div className="flex flex-wrap items-center gap-2">
        <input type="month" className={input} value={month} onChange={e => setMonth(e.target.value)} />
        <button type="button" className={btnLight} disabled={busy || Object.keys(edits).length === 0} onClick={saveDays}>Save the calendar</button>
        <button type="button" className={btn} disabled={busy} onClick={build}>Build the statement</button>
      </div>}>
        {cal?.contract && <>
          <p className="text-sm text-slate-600">{cal.from} to {cal.to} - {cal.days?.length} days, {cal.trips?.length || 0} trips.
            {cal.statement ? ` A statement of this month is already ${cal.statement.status} (${rupee(cal.statement.totalAmount)}${cal.statement.invoiceNumber ? `, bill ${cal.statement.invoiceNumber}` : ''}).` : ''}</p>

          <div className="mt-3 flex flex-wrap gap-1">
            {(cal.days || []).map((d: any) => {
              const status = edits[d.day]?.status && edits[d.day].status !== 'AUTO' ? edits[d.day].status : d.status;
              return <div key={d.day} className={`w-28 rounded-lg p-1 text-xs ${DAY_COLOUR[status] || ''}`}>
                <div className="font-semibold">{d.day.slice(8)} <span className="font-normal text-slate-500">{d.source === 'TYPED' ? 'typed' : d.source === 'TRIP' ? 'trip' : d.source === 'BREAKDOWN' ? 'breakdown' : ''}</span></div>
                <select className="mt-1 w-full rounded border border-slate-300 bg-white px-1 py-0.5 text-xs"
                  value={edits[d.day]?.status ?? ''}
                  onChange={e => setEdits({ ...edits, [d.day]: { status: e.target.value, reason: edits[d.day]?.reason || '' } })}>
                  <option value="">{status}</option>
                  <option value="AUTO">from the trips</option>
                  {(data?.statuses || []).map((s: string) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>;
            })}
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <h3 className="font-bold">What the month comes to</h3>
              {preview && <table className="mt-2 min-w-full"><tbody>
                <tr><td className={td}>Fixed charge</td><td className={td}>{rupee(preview.fixed)}</td></tr>
                <tr><td className={td}>Less {preview.deductedDays} days not available at {rupee(preview.perDay)}</td><td className={td}>- {rupee(preview.deduction)}</td></tr>
                <tr><td className={td}>Extra {preview.extraKm} km</td><td className={td}>{rupee(preview.extraKmAmount)}</td></tr>
                {preview.extraDays > 0 && <tr><td className={td}>Extra {preview.extraDays} days</td><td className={td}>{rupee(preview.extraDayAmount)}</td></tr>}
                <tr><td className={td}><b>Taxable</b></td><td className={td}><b>{rupee(preview.taxable)}</b></td></tr>
                <tr><td className={td}>GST {num(cal.contract.gstRate)} %</td><td className={td}>{rupee(preview.tax)}</td></tr>
                <tr><td className={td}><b>Total</b></td><td className={td}><b>{rupee(preview.total)}</b></td></tr>
              </tbody></table>}
              <p className="mt-2 text-xs text-slate-500">This is the same sum the server makes when the statement is built.</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <h3 className="font-bold">Trips in the month</h3>
              <table className="mt-2 min-w-full"><tbody>
                {(cal.trips || []).map((t: any) => <tr key={t.tripId}><td className={td}>{t.tripNumber}</td>
                  <td className={td}>{t.startDay} to {t.endDay}</td><td className={td}>{t.fromPlace} - {t.toPlace}</td>
                  <td className={td}>{num(t.km)} km<div className="text-xs text-slate-500">{t.kmSource === 'ODOMETER' ? 'odometer' : 'planned'}</div></td></tr>)}
                {(cal.trips || []).length === 0 && <tr><td className={td}>No trip in this month.</td></tr>}
              </tbody></table>
            </div>
          </div>
        </>}

        <h3 className="mt-5 font-bold">Statements</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Month</th><th className={th}>Trips</th><th className={th}>Km</th><th className={th}>Days deducted</th>
            <th className={th}>Taxable</th><th className={th}>Total</th><th className={th}>Status</th><th className={th} />
          </tr></thead><tbody>
            {statements.map(s => <tr key={s.id} className="border-b border-slate-100">
              <td className={td}>{String(s.month).slice(0, 7)}</td><td className={td}>{s.tripCount}</td><td className={td}>{num(s.totalKm)}</td>
              <td className={td}>{s.deductedDays}</td><td className={td}>{rupee(s.taxableAmount)}</td><td className={td}>{rupee(s.totalAmount)}</td>
              <td className={td}>{s.status}{s.invoiceNumber ? ` ${s.invoiceNumber}` : ''}</td>
              <td className={td}><button type="button" className={btnLight} onClick={() => showStatement(s.id)}>Open</button>{' '}
                {s.status === 'DRAFT' && <>
                  <button type="button" className={btn} disabled={busy} onClick={() => bill(s.id)}>Make the bill</button>{' '}
                  <button type="button" className={btnRed} disabled={busy} onClick={() => drop(s.id)}>Drop</button>
                </>}</td>
            </tr>)}
            {statements.length === 0 && <tr><td className={td} colSpan={8}>No statement built yet.</td></tr>}
          </tbody></table>
        </div>

        {open && <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between"><h3 className="font-bold">{String(open.month).slice(0, 7)} - {rupee(open.totalAmount)}</h3>
            <button type="button" className={btnLight} onClick={() => setOpen(null)}>Close</button></div>
          <pre className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{open.note}</pre>
        </div>}
      </Section>}
    </>}
  </div>;
}

export default DedicatedVehiclesPage;
