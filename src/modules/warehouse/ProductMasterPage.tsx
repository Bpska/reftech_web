/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-007 -- Product Master: code, pack, units (base unit and conversions such as CASE = 12 PCS),
// shelf life and the minimum life left on dispatch, batch or serial tracking, catch weight (sold by
// actual weight, with a tolerance) and the temperature profile. Staff can look; a Manager or an Admin edits.
//
// Backend: /api/warehouse/products (ProductMasterController).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section } from '@/shared/components/FormKit';
import { btnLight, btnRed, errorText, input, num, td, th, who } from './wms';
import { fmtTemp, fmtTempRange } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone

const TRACKING: [string, string][] = [['BATCH', 'Batch and expiry'], ['SERIAL', 'Serial number (one unit per pallet)'], ['NONE', 'No batch']];

/** "CASE=12; PALLET=600" <-> [{uom:'CASE', factorToBase:12}, ...] */
const uomsToText = (uoms?: any[]) => (uoms || []).map(u => `${u.uom}=${Number(u.factorToBase)}`).join('; ');
function textToUoms(text: unknown) {
  return String(text || '').split(/[;,\n]/).map(s => s.trim()).filter(Boolean).map(s => {
    const [uom, factor] = s.split('=').map(x => x.trim());
    if (!uom || !factor || !Number(factor)) throw new Error(`Write each unit as UNIT=number, for example CASE=12 ("${s}" is not)`);
    return { uom: uom.toUpperCase(), factorToBase: Number(factor) };
  });
}

export function ProductMasterPage() {
  const me = who();
  const [data, setData] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [partnerId, setPartnerId] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<number | 'new' | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api(`/api/warehouse/products?includeInactive=${showInactive}${partnerId ? `&partnerId=${partnerId}` : ''}`)); }
    catch (x) { setError(errorText(x, 'Could not load the products')); }
  }, [showInactive, partnerId]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => {
    if (!me.staff) return;
    api('/api/temperature-profiles').then(p => setProfiles(Array.isArray(p) ? p : [])).catch(() => setProfiles([]));
    api('/api/operations/partners').then(p => setPartners(Array.isArray(p) ? p : [])).catch(() => setPartners([]));
  }, []);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.products || []).filter((p: any) => !q || `${p.productCode} ${p.name} ${p.category || ''} ${p.barcode || ''}`.toLowerCase().includes(q));
  }, [data, search]);

  async function save(values: Record<string, unknown>, id?: number) {
    setBusy(true); setMsg(''); setError('');
    try {
      const body = { ...values, uoms: textToUoms(values.uoms) };
      await api(id ? `/api/warehouse/products/${id}` : '/api/warehouse/products', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setMsg(id ? 'Product saved.' : `Product ${String(values.productCode).toUpperCase()} added.`); setEdit(null); await load();
    } catch (x) { setError(errorText(x, 'Could not save the product')); }
    finally { setBusy(false); }
  }
  async function setActive(p: any) {
    setBusy(true); setMsg(''); setError('');
    try { await api(`/api/warehouse/products/${p.id}/active`, { method: 'POST', body: JSON.stringify({ active: !p.active }) }); setMsg(p.active ? `${p.name} is deactivated.` : `${p.name} is active again.`); await load(); }
    catch (x) { setError(errorText(x, 'Could not change the product')); }
    finally { setBusy(false); }
  }

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Product Master</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const fields: Field[] = [
    { name: 'productCode', label: 'Product code', required: true }, { name: 'name', label: 'Name', required: true },
    { name: 'ownerPartnerId', label: 'Owner partner', type: 'select', options: partners.map(p => [p.id, p.name]) },
    { name: 'category', label: 'Category' }, { name: 'packSize', label: 'Pack', placeholder: '1 L tub' },
    { name: 'baseUom', label: 'Base unit', required: true, placeholder: 'PCS', hint: 'Stock is counted in this unit. It cannot change while stock exists' },
    { name: 'uoms', label: 'Other units', placeholder: 'CASE=12; PALLET=600', hint: 'How many base units each unit holds' },
    { name: 'unitWeightKg', label: 'Weight of one base unit (kg)', type: 'number' }, { name: 'barcode', label: 'Barcode (EAN)' },
    { name: 'unitVolumeM3', label: 'Volume of one base unit (m³)', type: 'number', hint: 'For storage charged per cubic metre a day. Example: a 30 x 20 x 15 cm case is 0.009' },
    { name: 'shelfLifeDays', label: 'Shelf life (days)', type: 'number', step: '1' },
    { name: 'minDispatchLifeDays', label: 'Min life left on dispatch (days)', type: 'number', step: '1', hint: 'Batches with less life are never reserved' },
    { name: 'trackingRule', label: 'Tracking', type: 'select', options: TRACKING, required: true },
    { name: 'temperatureProfileId', label: 'Temperature profile', type: 'select', options: profiles.map(p => [p.id, `${p.name} (${fmtTempRange(p.minC, p.maxC)})`]) },
    { name: 'defaultTemperatureC', label: 'Target temperature (without a profile)', type: 'number', unit: 'temp' }, { name: 'hsnCode', label: 'HSN code' },
    { name: 'catchWeight', label: 'Sold by actual weight (catch weight)', type: 'checkbox' },
    { name: 'catchWeightTolerancePct', label: 'Weight tolerance (%)', type: 'number', hint: 'Received weight may differ from quantity x unit weight by this much' },
  ];
  const initial = (p?: any) => p ? { ...p, uoms: uomsToText(p.uoms) } : { baseUom: 'PCS', trackingRule: 'BATCH', ownerPartnerId: partnerId };

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Package className="h-8 w-8 text-sky-700" />Product Master</h1>
    <p className="text-slate-600">What each partner stores with RefTech: units, shelf life, tracking, catch weight and temperature.</p>
    <Banner msg={msg} error={error} />
    {data && !data.ready && <NotReady script="database_v2/30_req_wms_006_011_warehouse.sql" />}
    {data?.ready && <Section title="Products" right={me.manager && <button onClick={() => setEdit(edit === 'new' ? null : 'new')} className={btnLight}>Add product</button>}>
      {edit === 'new' && <div className="mb-4 rounded-xl bg-slate-50 p-3"><QuickForm fields={fields} initial={initial()} busy={busy} submitText="Add product" onCancel={() => setEdit(null)} onSubmit={v => save(v)} /></div>}
      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search code, name, barcode" className={input} />
        <select value={partnerId} onChange={e => setPartnerId(e.target.value)} className={input}><option value="">All partners</option>{partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Show deactivated</label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm">
        <thead><tr className="bg-slate-50 text-slate-600">
          <th className={th}>Code</th><th className={th}>Name / pack</th><th className={th}>Partner</th><th className={th}>Units</th><th className={th}>Shelf life</th>
          <th className={th}>Tracking</th><th className={th}>Catch weight</th><th className={th}>Temperature</th><th className={th}></th>
        </tr></thead>
        <tbody>{rows.map((p: any) => <tr key={p.id} className={`border-t ${p.active ? '' : 'opacity-60'}`}>
          <td className={`${td} font-mono font-bold`}>{p.productCode}{p.barcode && <div className="font-normal text-slate-500">{p.barcode}</div>}</td>
          <td className={td}>{p.name}<div className="text-slate-500">{p.packSize || ''}{p.category ? ` · ${p.category}` : ''}</div></td>
          <td className={td}>{p.ownerPartnerName || p.partnerNames || '-'}</td>
          <td className={td}><b>{p.baseUom}</b>{p.unitWeightKg ? ` (${num(p.unitWeightKg)} kg)` : ''}{p.uoms?.length > 0 && <div className="text-slate-500">{uomsToText(p.uoms).replace(/=/g, ' = ')}</div>}</td>
          <td className={td}>{p.shelfLifeDays ? `${p.shelfLifeDays} d` : '-'}{p.minDispatchLifeDays ? <div className="text-slate-500">min {p.minDispatchLifeDays} d on dispatch</div> : null}</td>
          <td className={td}>{p.trackingRule}</td>
          <td className={td}>{p.catchWeight ? `Yes, ±${num(p.catchWeightTolerancePct ?? 0)} %` : 'No'}</td>
          <td className={td}>{p.temperatureProfileName ? `${p.temperatureProfileName} (${fmtTempRange(p.profileMinC, p.profileMaxC)})` : p.defaultTemperatureC != null ? fmtTemp(p.defaultTemperatureC) : '-'}</td>
          <td className={`${td} text-right`}>{me.manager && <div className="flex justify-end gap-2">
            <button onClick={() => setEdit(edit === p.id ? null : p.id)} className={btnLight}>Edit</button>
            <button disabled={busy} onClick={() => setActive(p)} className={p.active ? btnRed : btnLight}>{p.active ? 'Deactivate' : 'Activate'}</button></div>}</td>
        </tr>).flatMap((row: any, i: number) => edit === rows[i].id ? [row, <tr key={`e${rows[i].id}`}><td colSpan={9} className="bg-slate-50 p-3">
          <QuickForm fields={fields} initial={initial(rows[i])} busy={busy} submitText="Save product" onCancel={() => setEdit(null)} onSubmit={v => save(v, rows[i].id)} /></td></tr>] : [row])}
          {rows.length === 0 && <tr><td colSpan={9} className={`${td} text-slate-500`}>No products.</td></tr>}
        </tbody></table></div>
    </Section>}
  </>;
}
