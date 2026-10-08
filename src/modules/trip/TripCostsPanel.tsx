/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-007 (fuel) and REQ-TRP-006 (expenses with receipt) -- "Fuel and trip costs" panel of the trip page.
// For Employee, Manager and Admin only; a Partner login never gets this panel.
//
//   Kilometres of the trip, litres issued, kilometres per litre, fuel cost, other expenses, the trip cost.
//   Fuel fills and expenses, each with the photo of its bill when there is one, and who entered it
//   (the office, or the driver through the driver app).
//   "Add fuel" and "Add expense" for the office.
//
// Backend: /api/operations/trips/{id}/costs, /fuel, /expenses (TripCostController); /api/maintenance/fuel/{id}
// and /receipt (MaintenanceController); /api/vehicle-expenses/{id}/receipt.
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Fuel, Image as ImageIcon, Plus, Trash2 } from 'lucide-react';
import { api } from '@/shared/services/api';
import { fmtDateTime, fmtDistance, fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const API_URL = import.meta.env.VITE_API_URL;
const authHeader = (): Record<string, string> => { const t = localStorage.getItem('reftech_token'); return t ? { Authorization: `Bearer ${t}` } : {}; };

type FuelRow = { id: number; fuelFor: string; filledAt: string; litres: number; pricePerLitre?: number | null; amount: number; odometerKm?: number | null; station?: string | null; referenceNumber?: string | null; fullTank?: boolean; hasReceipt: boolean; enteredBy: string; enteredByName?: string | null };
type ExpenseRow = { id: number; expenseDate: string; expenseType: string; description?: string | null; amount: number; referenceNumber?: string | null; enteredBy: string; enteredByName?: string | null; hasReceipt: boolean };
type Costs = {
  fuelReady: boolean; expenseReady: boolean; message?: string; canAdd: boolean; canDeleteFuel?: boolean; totalCost: number;
  odometer: { startKm?: number | null; endKm?: number | null; distanceKm?: number | null; soFar: boolean };
  fuel: { truckLitres: number; truckCost: number; reeferLitres: number; reeferCost: number; totalCost: number; kmPerLitre?: number | null; costPerKm?: number | null; note?: string | null; entries: FuelRow[] };
  expenses: { total: number; entries: ExpenseRow[] };
};

export const EXPENSE_KINDS: [string, string][] = [['TOLL', 'Toll'], ['PARKING', 'Parking'], ['LOADING', 'Loading or unloading charges'], ['FOOD', 'Food'], ['REPAIR', 'Small repair'], ['TYRE', 'Tyre'], ['OTHER', 'Other']];
const kind = (c: string) => (EXPENSE_KINDS.find(k => k[0] === c) || [c, c.charAt(0) + c.slice(1).toLowerCase()])[1];
const money = (v?: number | null) => fmtMoney(v);
const km = (v?: number | null) => (v === null || v === undefined ? '-' : `${Number(v).toLocaleString('en-IN')} km`);
const when = (v?: string | null) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : fmtDateTime(d);
};
const input = 'w-full rounded-xl border border-slate-300 px-3 py-2 text-sm';
const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600';
const errorText = (x: unknown, fallback: string) => (x instanceof Error && x.message ? x.message : fallback);

/** Opens a picture that needs the sign-in token (a plain link cannot send it) in a new tab. */
export async function openPicture(path: string) {
  // The tab is opened at the click (a browser blocks a tab opened later, after the download).
  const tab = window.open('', '_blank');
  if (!tab) { window.alert('The browser blocked the new tab. Allow pop-ups for this site to see the photo.'); return; }
  try {
    const r = await fetch(`${API_URL}${path}`, { headers: authHeader() });
    if (!r.ok) throw new Error(String(r.status));
    const url = URL.createObjectURL(await r.blob());
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);   // the tab has loaded the picture by then; the memory is given back
  } catch { tab.close(); window.alert('The photo could not be loaded.'); }
}

/** A photo taken with a phone is several megabytes. It is made smaller in the browser (longest side 1600 px, JPEG) before it is sent. */
export async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    // 'from-image': a phone stores a portrait photo turned on its side with a note how to turn it; the note is applied here
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const pen = canvas.getContext('2d');
    if (!pen) return file;
    pen.fillStyle = '#ffffff'; pen.fillRect(0, 0, canvas.width, canvas.height);   // JPEG has no transparency: white, not black
    pen.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob: Blob | null = await new Promise(done => canvas.toBlob(done, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

/** Sends a form with a file. Returns the answer; throws the message of the server when it refuses. */
export async function postForm(path: string, form: FormData) {
  const receipt = form.get('receipt');
  if (receipt instanceof File) { if (receipt.size === 0) form.delete('receipt'); else form.set('receipt', await shrinkPhoto(receipt)); }
  const r = await fetch(`${API_URL}${path}`, { method: 'POST', headers: authHeader(), body: form });
  const text = await r.text();
  let body: any = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
  // the same as api(): a session that ended (10 minutes without a request, or a sign-in elsewhere) goes back to the sign-in page
  if (r.status === 401 && localStorage.getItem('reftech_token')) {
    localStorage.removeItem('reftech_token'); localStorage.removeItem('reftech_user');
    if (window.location.pathname !== '/login') window.location.href = '/login?reason=session';
    throw new Error(body.message || 'Session expired. Please sign in again.');
  }
  if (!r.ok) throw new Error(body.message || (r.status === 413 ? 'The photo is too large. Take it at a lower resolution.' : `Request failed (${r.status})`));
  return body;
}

export function TripCostsPanel({ tripId, refreshKey }: { tripId: number; refreshKey?: number }) {
  const [costs, setCosts] = useState<Costs | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<'' | 'FUEL' | 'EXPENSE'>('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const load = useCallback(async () => {
    try { setCosts(await api(`/api/operations/trips/${tripId}/costs`)); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not load the costs of the trip') }); }
  }, [tripId]);
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function send(e: FormEvent<HTMLFormElement>, path: string, done: (r: any) => string) {
    e.preventDefault();
    if (sending.current) return;
    sending.current = true; setBusy(true); setMsg(null);
    const target = e.currentTarget;
    try {
      const r = await postForm(path, new FormData(target));
      target.reset(); setForm('');
      setMsg({ ok: true, text: done(r) });
      await load();
    } catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not be saved') }); }
    finally { sending.current = false; setBusy(false); }
  }
  async function removeFuel(f: FuelRow) {
    if (sending.current) return;
    if (!window.confirm(`Remove the fuel entry of ${Number(f.litres)} L (${money(f.amount)})? Its expense row is removed too.`)) return;
    sending.current = true; setBusy(true);
    try { await api(`/api/maintenance/fuel/${f.id}`, { method: 'DELETE' }); setMsg({ ok: true, text: 'The fuel entry is removed.' }); await load(); }
    catch (x) { setMsg({ ok: false, text: errorText(x, 'Could not be removed') }); }
    finally { sending.current = false; setBusy(false); }
  }

  if (!costs) return msg ? <div className="mt-4 rounded-xl bg-red-50 p-3 font-semibold text-red-800">{msg.text}</div> : null;
  const head = <h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Fuel className="h-5 w-5 text-sky-700" />Fuel and trip costs</h2>;
  if (!costs.fuelReady || !costs.expenseReady) return <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">{head}<p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">{costs.message}</p></section>;

  const f = costs.fuel, o = costs.odometer;
  const tile = (name: string, value: string, note?: string, id?: string) => <div className="rounded-xl bg-slate-50 p-3"><dt className={label}>{name}</dt><dd data-testid={id} className="text-xl font-black text-slate-900">{value}</dd>{note && <p className="text-xs text-slate-500">{note}</p>}</div>;
  const receiptButton = (path: string, text: string) => <button type="button" onClick={() => { void openPicture(path); }} className="inline-flex items-center gap-1 text-sm font-bold text-sky-700 hover:underline"><ImageIcon className="h-4 w-4" />{text}</button>;

  return <section data-testid="costs-panel" className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {head}
      {costs.canAdd && <div className="flex gap-2">
        <button type="button" onClick={() => { setMsg(null); setForm(form === 'FUEL' ? '' : 'FUEL'); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-sky-400"><Plus className="h-4 w-4" />Add fuel</button>
        <button type="button" onClick={() => { setMsg(null); setForm(form === 'EXPENSE' ? '' : 'EXPENSE'); }} className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:border-sky-400"><Plus className="h-4 w-4" />Add expense</button>
      </div>}
    </div>
    {msg && <div role="status" className={`mt-3 rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-800'}`}>{msg.text}</div>}

    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {tile('Distance', o.distanceKm == null ? '-' : fmtDistance(o.distanceKm), o.distanceKm == null ? undefined : o.soFar ? 'so far (last fill)' : `${km(o.startKm)} to ${km(o.endKm)}`, 'cost-distance')}
      {tile('Fuel for the engine', `${Number(f.truckLitres)} L`, money(f.truckCost), 'cost-litres')}
      {tile('Km per litre', f.kmPerLitre == null ? '-' : Number(f.kmPerLitre).toFixed(2), f.costPerKm == null ? undefined : `${money(f.costPerKm)} fuel per km`, 'cost-kmpl')}
      {tile('Fuel cost', money(f.totalCost), Number(f.reeferLitres) > 0 ? `with ${Number(f.reeferLitres)} L reefer diesel` : undefined, 'cost-fuel')}
      {tile('Other expenses', money(costs.expenses.total), `${costs.expenses.entries.length} entr${costs.expenses.entries.length === 1 ? 'y' : 'ies'}`, 'cost-other')}
      {tile('Trip cost', money(costs.totalCost), 'fuel + other expenses', 'cost-total')}
    </dl>
    {f.note && <p className="mt-2 text-sm text-slate-600">{f.note}</p>}

    {form === 'FUEL' && <form onSubmit={e => { void send(e, `/api/operations/trips/${tripId}/fuel`, r => `Fuel saved: ${Number(r.litres)} L, ${money(r.amount)}.`); }} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
      <div><label className={label} htmlFor="fuel-for">Fuel for</label><select id="fuel-for" name="fuelFor" className={input}><option value="TRUCK">Truck engine</option><option value="REEFER">Reefer unit</option></select></div>
      <div><label className={label} htmlFor="fuel-litres">Litres *</label><input id="fuel-litres" name="litres" required inputMode="decimal" placeholder="60" className={input} /></div>
      <div><label className={label} htmlFor="fuel-price">Price per litre</label><input id="fuel-price" name="pricePerLitre" inputMode="decimal" placeholder="92.50" className={input} /></div>
      <div><label className={label} htmlFor="fuel-amount">Amount of the bill</label><input id="fuel-amount" name="amount" inputMode="decimal" placeholder="worked out from the price" className={input} /></div>
      <div><label className={label} htmlFor="fuel-km">Odometer (km)</label><input id="fuel-km" name="odometerKm" inputMode="decimal" className={input} /></div>
      <div><label className={label} htmlFor="fuel-station">Fuel station</label><input id="fuel-station" name="station" maxLength={200} className={input} /></div>
      <div><label className={label} htmlFor="fuel-ref">Bill number</label><input id="fuel-ref" name="referenceNumber" maxLength={100} className={input} /></div>
      <div><label className={label} htmlFor="fuel-receipt">Photo of the bill</label><input id="fuel-receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" /></div>
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2"><input type="checkbox" name="fullTank" value="true" />Tank filled up</label>
      <div className="flex gap-2 md:col-span-4"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save fuel</button><button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button></div>
    </form>}

    {form === 'EXPENSE' && <form onSubmit={e => { void send(e, `/api/operations/trips/${tripId}/expenses`, r => `Expense saved: ${kind(r.expenseType)}, ${money(r.amount)}.`); }} className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-4">
      <div><label className={label} htmlFor="exp-kind">Kind *</label><select id="exp-kind" name="expenseType" className={input}>{EXPENSE_KINDS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select></div>
      <div><label className={label} htmlFor="exp-amount">Amount *</label><input id="exp-amount" name="amount" required inputMode="decimal" className={input} /></div>
      <div><label className={label} htmlFor="exp-date">Date</label><input id="exp-date" name="expenseDate" type="date" className={input} /></div>
      <div><label className={label} htmlFor="exp-ref">Receipt number</label><input id="exp-ref" name="referenceNumber" maxLength={120} className={input} /></div>
      <div className="md:col-span-2"><label className={label} htmlFor="exp-desc">What for</label><input id="exp-desc" name="description" maxLength={500} className={input} /></div>
      <div className="md:col-span-2"><label className={label} htmlFor="exp-receipt">Photo of the receipt</label><input id="exp-receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" /></div>
      <div className="flex gap-2 md:col-span-4"><button disabled={busy} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Save expense</button><button type="button" onClick={() => setForm('')} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">Close</button></div>
    </form>}

    <div className="mt-4 grid gap-5">
      <div className="overflow-x-auto">
        <h3 className="font-bold text-slate-900">Fuel issued ({f.entries.length})</h3>
        {f.entries.length === 0 ? <p className="mt-1 text-sm text-slate-500">No fuel is recorded for this trip.</p> : <table data-testid="fuel-table" className="mt-2 w-full min-w-[560px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">When</th><th className="p-2">For</th><th className="p-2">Litres</th><th className="p-2">Price</th><th className="p-2">Amount</th><th className="p-2">Odometer</th><th className="p-2">Entered by</th><th className="p-2"></th></tr></thead>
          <tbody>{f.entries.map(x => <tr key={x.id} className="border-t align-top">
            <td className="whitespace-nowrap p-2">{when(x.filledAt)}<div className="text-xs text-slate-500">{x.station || ''}</div></td>
            <td className="p-2">{x.fuelFor === 'REEFER' ? 'Reefer' : 'Engine'}</td><td className="p-2">{Number(x.litres)}</td><td className="p-2">{x.pricePerLitre == null ? '-' : Number(x.pricePerLitre).toFixed(2)}</td><td className="p-2 font-semibold">{money(x.amount)}</td>
            <td className="p-2 whitespace-nowrap">{km(x.odometerKm)}</td><td className="p-2">{x.enteredBy === 'DRIVER' ? 'Driver' : 'Office'}<div className="text-xs text-slate-500">{x.enteredByName || ''}</div></td>
            <td className="p-2 whitespace-nowrap">{x.hasReceipt && receiptButton(`/api/maintenance/fuel/${x.id}/receipt`, 'Bill')}{costs.canDeleteFuel && <button type="button" onClick={() => { void removeFuel(x); }} title="Remove this fuel entry" aria-label="Remove this fuel entry" className="ml-2 rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>}</td>
          </tr>)}</tbody>
        </table>}
      </div>
      <div className="overflow-x-auto">
        <h3 className="font-bold text-slate-900">Other expenses ({costs.expenses.entries.length})</h3>
        {costs.expenses.entries.length === 0 ? <p className="mt-1 text-sm text-slate-500">No other expense is recorded for this trip.</p> : <table data-testid="expense-table" className="mt-2 w-full min-w-[480px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600"><th className="p-2">Date</th><th className="p-2">Kind</th><th className="p-2">What for</th><th className="p-2">Amount</th><th className="p-2">Entered by</th><th className="p-2"></th></tr></thead>
          <tbody>{costs.expenses.entries.map(x => <tr key={x.id} className="border-t align-top">
            <td className="whitespace-nowrap p-2">{x.expenseDate}</td><td className="p-2">{kind(x.expenseType)}</td><td className="p-2">{x.description || '-'}{x.referenceNumber ? <div className="text-xs text-slate-500">{x.referenceNumber}</div> : null}</td><td className="p-2 font-semibold">{money(x.amount)}</td>
            <td className="p-2">{x.enteredBy === 'DRIVER' ? 'Driver' : 'Office'}<div className="text-xs text-slate-500">{x.enteredByName || ''}</div></td>
            <td className="p-2">{x.hasReceipt && receiptButton(`/api/vehicle-expenses/${x.id}/receipt`, 'Receipt')}</td>
          </tr>)}</tbody>
        </table>}
      </div>
    </div>
  </section>;
}
