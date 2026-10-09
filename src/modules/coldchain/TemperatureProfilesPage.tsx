/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-CC-003 -- Temperature Profiles: the master list (Frozen, Ice cream, Chilled dairy ...), the ranges
// agreed with each partner, which trucks and chambers can hold a profile, and the profile of each product.
//
// Backend: /api/temperature-profiles (TemperatureProfileController). Everyone internal can read;
// only a Manager or an Admin can change. Trips and loads copy the numbers of a profile when they are
// created, so changing a profile here never changes a trip that already exists.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Snowflake } from 'lucide-react';
import { api, currentUser } from '@/shared/services/api';
import { fmtTemp, fmtTempRange, toBase, toShown, unitNow } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

type Profile = {
  id: number; code: string; name: string; description?: string | null; targetC: number; minC: number; maxC: number;
  active: boolean; tripCount?: number;
  agreedWithPartner?: boolean; agreedTargetC?: number | null; agreedMinC?: number | null; agreedMaxC?: number | null; agreedNotes?: string | null;
  effectiveTargetC: number; effectiveMinC: number; effectiveMaxC: number;
};
type Partner = { id: number; name: string; partnerCode?: string };
type Unit = { id: number; vehicleNumber?: string; chamberCode?: string; name?: string; warehouseName?: string; partnerName?: string | null;
  minTemperatureC?: number | null; maxTemperatureC?: number | null; canHold: boolean; rangeKnown: boolean; message?: string | null };
type Compatibility = { vehicles: Unit[]; chambers: Unit[] };
type Product = { id: number; productCode: string; name: string; category?: string | null; temperatureProfileId?: number | null };

const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
const small = 'w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900';
const label = 'mb-1.5 block text-sm font-semibold text-slate-700';
const cell = 'px-2.5 py-3';
const n = (v?: number | null) => (v === null || v === undefined ? '' : String(Number(v)));
const range = (min?: number | null, max?: number | null) =>
  min == null && max == null ? 'not recorded' : fmtTempRange(min, max);
const errorText = (x: unknown, fallback: string) => (x instanceof Error ? x.message : fallback);

export function TemperatureProfilesPage() {
  const user = currentUser();
  const role = String(user.role || user.roleCode || '').replace('ROLE_', '').toUpperCase();
  const allowed = ['EMPLOYEE', 'MANAGER', 'ADMIN'].includes(role);
  const canEdit = role === 'MANAGER' || role === 'ADMIN';

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [partnerRows, setPartnerRows] = useState<Profile[]>([]);
  const [checkId, setCheckId] = useState('');
  const [compat, setCompat] = useState<Compatibility | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const loadProfiles = useCallback(async () => {
    try { const list = await api('/api/temperature-profiles?all=true'); setProfiles(Array.isArray(list) ? list : []); }
    catch (x) { setError(errorText(x, 'Could not load the profiles')); }
    finally { setLoaded(true); }
  }, []);
  const loadPartnerRows = useCallback(async (id: string) => {
    if (!id) { setPartnerRows([]); return; }
    try { const list = await api(`/api/temperature-profiles?partnerId=${id}`); setPartnerRows(Array.isArray(list) ? list : []); }
    catch (x) { setError(errorText(x, 'Could not load the ranges of this partner')); }
  }, []);
  const loadCompat = useCallback(async (id: string) => {
    if (!id) { setCompat(null); return; }
    try { setCompat(await api(`/api/temperature-profiles/${id}/compatibility`)); }
    catch (x) { setError(errorText(x, 'Could not load the trucks and chambers')); }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void loadProfiles();
    api('/api/operations/partners').then((p: Partner[]) => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([]));
    api('/api/temperature-profiles/products').then((p: Product[]) => setProducts(Array.isArray(p) ? p : [])).catch(() => setProducts([]));
  }, [allowed, loadProfiles]);
  useEffect(() => { void loadPartnerRows(partnerId); }, [partnerId, loadPartnerRows]);
  useEffect(() => { void loadCompat(checkId); }, [checkId, loadCompat]);

  // Runs one change, shows the result, and refreshes everything that may show the changed numbers.
  async function run(action: () => Promise<unknown>, done: string) {
    setBusy(true); setError(''); setMsg('');
    try { await action(); setMsg(done); await loadProfiles(); await loadPartnerRows(partnerId); await loadCompat(checkId); return true; }
    catch (x) { setError(errorText(x, 'Could not save')); return false; }
    finally { setBusy(false); }
  }
  // REQ-PLT-015: the boxes are in the login's unit; the server keeps °C
  const numbers = (f: FormData) => ({ targetC: toBase('temp', f.get('targetC')), minC: toBase('temp', f.get('minC')), maxC: toBase('temp', f.get('maxC')) });

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget, f = new FormData(form);
    const ok = await run(() => api('/api/temperature-profiles', { method: 'POST', body: JSON.stringify({ name: f.get('name'), description: f.get('description'), ...numbers(f) }) }),
      `Profile "${String(f.get('name'))}" added.`);
    if (ok) form.reset();
  }
  async function save(e: FormEvent<HTMLFormElement>, p: Profile) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const ok = await run(() => api(`/api/temperature-profiles/${p.id}`, { method: 'PUT', body: JSON.stringify({ name: f.get('name'), ...numbers(f) }) }),
      `Profile "${String(f.get('name'))}" saved. Trips and loads already created keep their own numbers.`);
    if (ok) setEditId(null);
  }
  const toggle = (p: Profile) => run(() => api(`/api/temperature-profiles/${p.id}/active`, { method: 'PATCH', body: JSON.stringify({ active: !p.active }) }),
    p.active ? `"${p.name}" is switched off. It is no longer offered for new trips and loads.` : `"${p.name}" is switched on again.`);
  async function saveAgreed(e: FormEvent<HTMLFormElement>, p: Profile) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await run(() => api(`/api/temperature-profiles/${p.id}/partners/${partnerId}`, { method: 'PUT', body: JSON.stringify({ ...numbers(f), notes: f.get('notes') }) }),
      `Agreed range for "${p.name}" saved. It applies to new trips and loads of this partner.`);
  }
  const backToStandard = (p: Profile) => run(() => api(`/api/temperature-profiles/${p.id}/partners/${partnerId}`, { method: 'DELETE' }),
    `"${p.name}" is back on the standard range for this partner.`);
  async function setProduct(product: Product, profileId: string) {
    const ok = await run(() => api(`/api/temperature-profiles/products/${product.id}`, { method: 'PUT', body: JSON.stringify({ profileId: profileId || null }) }),
      `Profile of "${product.name}" saved.`);
    if (ok) setProducts(await api('/api/temperature-profiles/products'));
  }

  if (!localStorage.getItem('reftech_token')) return <div className="p-10">Please sign in.</div>;
  if (!allowed) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Temperature Profiles</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const active = profiles.filter(p => p.active);
  const partnerName = partners.find(p => String(p.id) === partnerId)?.name || '';
  const chip = (u: Unit) => !u.rangeKnown ? ['Not checked', 'bg-amber-100 text-amber-800'] : u.canHold ? ['Can hold', 'bg-emerald-100 text-emerald-800'] : ['Cannot hold', 'bg-red-100 text-red-800'];

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Snowflake className="h-8 w-8 text-sky-700" />Temperature Profiles</h1>
    <p className="text-slate-600">Trips, loads and products pick one of these profiles instead of typing a target, a minimum and a maximum temperature.</p>
    {msg && <div className="my-4 rounded-xl bg-emerald-50 p-3 text-emerald-900">{msg}</div>}
    {error && <div className="my-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</div>}

    {/* ------------------------------------------------------------ 1. the master list */}
    <section id="profiles" className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Standard profiles</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600">
            <th className={cell}>Profile</th><th className={cell}>Target</th><th className={cell}>Allowed range</th><th className={cell}>Trips</th><th className={cell}>Status</th><th className={cell}></th>
          </tr></thead>
          <tbody>
            {profiles.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400">{loaded ? 'No profiles yet. Run the REQ-CC-003 database script, or add one below.' : 'Loading...'}</td></tr>}
            {profiles.map(p => editId === p.id
              ? <tr key={p.id} className="border-t border-slate-200 bg-sky-50/50"><td colSpan={6} className={cell}>
                  <form onSubmit={e => save(e, p)} className="flex flex-wrap items-end gap-3">
                    <label className="grow"><span className={label}>Name</span><input name="name" required defaultValue={p.name} className={input} /></label>
                    <label><span className={label}>Target {unitNow('temp')}</span><input name="targetC" required type="number" step="any" defaultValue={toShown('temp', p.targetC)} className={small} /></label>
                    <label><span className={label}>Minimum {unitNow('temp')}</span><input name="minC" required type="number" step="any" defaultValue={toShown('temp', p.minC)} className={small} /></label>
                    <label><span className={label}>Maximum {unitNow('temp')}</span><input name="maxC" required type="number" step="any" defaultValue={toShown('temp', p.maxC)} className={small} /></label>
                    <button disabled={busy} className="rounded-xl bg-cyan-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Save</button>
                    <button type="button" onClick={() => setEditId(null)} className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700">Cancel</button>
                  </form>
                </td></tr>
              : <tr key={p.id} className={`border-t border-slate-200 ${p.active ? '' : 'text-slate-400'}`}>
                  <td className={cell}><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.code}{p.description ? ` · ${p.description}` : ''}</div></td>
                  <td className={`${cell} whitespace-nowrap`}>{fmtTemp(p.targetC)}</td>
                  <td className={`${cell} whitespace-nowrap`}>{range(p.minC, p.maxC)}</td>
                  <td className={cell}>{p.tripCount ?? 0}</td>
                  <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{p.active ? 'In use' : 'Switched off'}</span></td>
                  <td className={`${cell} whitespace-nowrap text-right`}>{canEdit && <>
                    <button onClick={() => { setEditId(p.id); setMsg(''); setError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit</button>
                    <button onClick={() => toggle(p)} disabled={busy} className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">{p.active ? 'Switch off' : 'Switch on'}</button>
                  </>}</td>
                </tr>)}
          </tbody>
        </table>
      </div>
      {canEdit
        ? <form onSubmit={add} className="mt-4 rounded-xl border border-slate-200 p-4">
            <h3 className="font-bold">Add a profile</h3>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="grow"><span className={label}>Name *</span><input name="name" required placeholder="for example Chocolate" className={input} /></label>
              <label><span className={label}>Target {unitNow('temp')} *</span><input name="targetC" required type="number" step="any" className={small} /></label>
              <label><span className={label}>Minimum {unitNow('temp')} *</span><input name="minC" required type="number" step="any" className={small} /></label>
              <label><span className={label}>Maximum {unitNow('temp')} *</span><input name="maxC" required type="number" step="any" className={small} /></label>
              <label className="grow"><span className={label}>What it is for</span><input name="description" className={input} /></label>
              <button disabled={busy} className="rounded-xl bg-cyan-700 px-5 py-2 font-semibold text-white disabled:opacity-50">Add profile</button>
            </div>
          </form>
        : <p className="mt-3 text-sm text-slate-500">Only a Manager or an Admin can add or change profiles.</p>}
    </section>

    {/* ------------------------------------------------------------ 2. ranges agreed with a partner */}
    <section id="partner-ranges" className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Ranges agreed with a partner</h2>
      <p className="text-sm text-slate-600">When a partner has agreed a different range for a profile, record it here. New trips and loads of that partner then get the agreed range.</p>
      <label className="mt-3 block max-w-md"><span className={label}>Partner</span>
        <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={input} aria-label="Partner">
          <option value="">Select partner</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></label>
      {partnerId && <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Profile</th><th className={cell}>Standard</th><th className={cell}>For {partnerName}</th><th className={cell}>{canEdit ? 'Agreed range (target, minimum, maximum, note)' : 'Note'}</th></tr></thead>
          <tbody>{partnerRows.map(p => (
            <tr key={`${p.id}-${n(p.agreedTargetC)}-${n(p.agreedMinC)}-${n(p.agreedMaxC)}`} className="border-t border-slate-200">
              <td className={`${cell} font-semibold`}>{p.name}</td>
              <td className={`${cell} whitespace-nowrap`}>{range(p.minC, p.maxC)}<div className="text-xs text-slate-500">target {fmtTemp(p.targetC)}</div></td>
              <td className={`${cell} whitespace-nowrap`}>{range(p.effectiveMinC, p.effectiveMaxC)}<div className="text-xs text-slate-500">target {fmtTemp(p.effectiveTargetC)}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${p.agreedWithPartner ? 'bg-sky-100 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>{p.agreedWithPartner ? 'Agreed' : 'Standard'}</span></td>
              <td className={cell}>{canEdit
                ? <form onSubmit={e => saveAgreed(e, p)} className="flex flex-wrap items-center gap-2">
                    <input name="targetC" required type="number" step="any" defaultValue={toShown('temp', p.agreedTargetC ?? p.targetC)} aria-label={`Agreed target for ${p.name}`} className={small} />
                    <input name="minC" required type="number" step="any" defaultValue={toShown('temp', p.agreedMinC ?? p.minC)} aria-label={`Agreed minimum for ${p.name}`} className={small} />
                    <input name="maxC" required type="number" step="any" defaultValue={toShown('temp', p.agreedMaxC ?? p.maxC)} aria-label={`Agreed maximum for ${p.name}`} className={small} />
                    <input name="notes" defaultValue={p.agreedNotes || ''} placeholder="Contract or email" aria-label={`Note for ${p.name}`} className="min-w-40 grow rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900" />
                    <button disabled={busy} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Save</button>
                    {p.agreedWithPartner && <button type="button" onClick={() => backToStandard(p)} disabled={busy} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50">Use standard</button>}
                  </form>
                : (p.agreedNotes || '-')}</td>
            </tr>))}</tbody>
        </table>
      </div>}
    </section>

    {/* ------------------------------------------------------------ 3. trucks and chambers */}
    <section id="can-hold" className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Which trucks and chambers can hold a profile</h2>
      <p className="text-sm text-slate-600">A truck or chamber can hold a profile when the profile's target temperature lies inside its own working range. Create Trip refuses a truck that cannot.</p>
      <label className="mt-3 block max-w-md"><span className={label}>Profile</span>
        <select value={checkId} onChange={e => setCheckId(e.target.value)} className={input} aria-label="Profile to check">
          <option value="">Select profile</option>{active.map(p => <option key={p.id} value={p.id}>{p.name} (target {fmtTemp(p.targetC)})</option>)}
        </select></label>
      {compat && <div className="mt-3 grid gap-4 lg:grid-cols-2">
        {([['Trucks', compat.vehicles], ['Cold chambers', compat.chambers]] as [string, Unit[]][]).map(([title, units]) => (
          <div key={title} className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>{title} ({units.filter(u => u.canHold && u.rangeKnown).length} of {units.length} can hold it)</th><th className={cell}>Working range</th><th className={cell}></th></tr></thead>
              <tbody>
                {units.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-400">None recorded.</td></tr>}
                {units.map(u => { const [text, tone] = chip(u); return (
                  <tr key={u.id} className="border-t border-slate-200">
                    <td className={cell}><div className="font-semibold">{u.vehicleNumber || u.name}</div><div className="text-xs text-slate-500">{u.vehicleNumber ? (u.partnerName || 'not assigned') : `${u.chamberCode} · ${u.warehouseName}`}</div></td>
                    <td className={`${cell} whitespace-nowrap`}>{range(u.minTemperatureC, u.maxTemperatureC)}</td>
                    <td className={cell}><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{text}</span></td>
                  </tr>); })}
              </tbody>
            </table>
          </div>))}
      </div>}
    </section>

    {/* ------------------------------------------------------------ 4. products */}
    <section id="products" className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-xl font-bold">Profile of each product</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-slate-600"><th className={cell}>Product</th><th className={cell}>Category</th><th className={cell}>Temperature profile</th></tr></thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-400">No products yet. Products are added under Manage Partners.</td></tr>}
            {products.map(pr => (
              <tr key={pr.id} className="border-t border-slate-200">
                <td className={cell}><div className="font-semibold">{pr.name}</div><div className="text-xs text-slate-500">{pr.productCode}</div></td>
                <td className={cell}>{pr.category || '-'}</td>
                <td className={cell}>
                  <select value={pr.temperatureProfileId == null ? '' : String(pr.temperatureProfileId)} disabled={!canEdit || busy} onChange={e => setProduct(pr, e.target.value)}
                    aria-label={`Profile of ${pr.name}`} className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-900 disabled:bg-slate-50">
                    <option value="">No profile</option>
                    {profiles.filter(p => p.active || p.id === pr.temperatureProfileId).map(p => <option key={p.id} value={p.id}>{p.name} ({range(p.minC, p.maxC)})</option>)}
                  </select>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}
