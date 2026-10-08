/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-WMS-006 -- Warehouse Layout: each warehouse with its chambers, zones, racks, bins and docks.
// Everyone on the staff can look; a Manager or an Admin adds, edits and deactivates. A place that still
// holds pallets cannot be deactivated (the backend refuses and says how many pallets are there).
// Bin labels (barcode of the bin code) print from here for sticking on the rack beams.
//
// Backend: /api/warehouse/layout, /api/warehouse/chambers/{id}/layout and the add / edit / active calls
// of WarehouseLayoutController.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Warehouse } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Field, NotReady, QuickForm, Section, askReason } from '@/shared/components/FormKit';
import { binLabelsHtml, btn, btnLight, btnRed, errorText, pill, printHtml, range, td, th, who } from './wms';

const DOCK_TYPES: [string, string][] = [['INBOUND', 'Inbound (receiving)'], ['OUTBOUND', 'Outbound (dispatch)'], ['BOTH', 'Both']];

export function WarehouseLayoutPage() {
  const me = who();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [layout, setLayout] = useState<any>(null);
  const [edit, setEdit] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const warehouseId = Number(params.get('warehouse') || 0);
  const chamberId = Number(params.get('chamber') || 0);

  const load = useCallback(async () => {
    try {
      const d = await api('/api/warehouse/layout');
      setData(d);
      if (!warehouseId && d.warehouses?.length) setParams({ warehouse: String(d.warehouses[0].id) }, { replace: true });
    } catch (x) { setError(errorText(x, 'Could not load the warehouses')); }
  }, [warehouseId, setParams]);
  const loadChamber = useCallback(async () => {
    if (!chamberId) { setLayout(null); return; }
    try { setLayout(await api(`/api/warehouse/chambers/${chamberId}/layout`)); }
    catch (x) { setError(errorText(x, 'Could not load the chamber')); }
  }, [chamberId]);
  useEffect(() => { if (me.staff) void load(); }, [load]);
  useEffect(() => { void loadChamber(); }, [loadChamber]);

  async function run(action: () => Promise<any>, done: string) {
    setBusy(true); setMsg(''); setError('');
    try { const r = await action(); setMsg(r?.message || done); setEdit(''); await load(); await loadChamber(); return true; }
    catch (x) { setError(errorText(x, 'Could not save')); return false; }
    finally { setBusy(false); }
  }
  const put = (path: string, body: unknown) => api(path, { method: 'PUT', body: JSON.stringify(body) });
  const post = (path: string, body: unknown) => api(path, { method: 'POST', body: JSON.stringify(body) });
  function setActive(kind: string, id: number, active: boolean, what: string) {
    let reason: string | null = '';
    if (!active) { reason = askReason(what); if (reason === null) return; }
    void run(() => post(`/api/warehouse/${kind}/${id}/active`, { active, reason }), active ? `${what} is active again.` : `${what} is deactivated.`);
  }
  const activeButton = (kind: string, row: any, what: string) => me.manager &&
    (row.active
      ? <button disabled={busy} onClick={() => setActive(kind, row.id, false, what)} className={btnRed}>Deactivate</button>
      : <button disabled={busy} onClick={() => setActive(kind, row.id, true, what)} className={btnLight}>Activate</button>);

  if (!me.staff) return <div className="rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">Warehouse Layout</h1><p className="mt-2 text-slate-600">This page is for RefTech staff.</p></div>;

  const wh = data?.warehouses?.find((w: any) => w.id === warehouseId);
  const siteFields: Field[] = [
    { name: 'name', label: 'Name', required: true }, { name: 'city', label: 'City' }, { name: 'state', label: 'State' },
    { name: 'address', label: 'Address', wide: true }, { name: 'capacityTons', label: 'Capacity', type: 'number', unit: 'weight' },
    { name: 'minTemperatureC', label: 'Min temperature', type: 'number', unit: 'temp' }, { name: 'maxTemperatureC', label: 'Max temperature', type: 'number', unit: 'temp' },
  ];
  const chamberFields: Field[] = [
    { name: 'chamberCode', label: 'Chamber code', required: true }, { name: 'name', label: 'Name', required: true },
    { name: 'capacityPallets', label: 'Capacity (pallet positions)', type: 'number', step: '1' }, { name: 'capacityTons', label: 'Capacity', type: 'number', unit: 'weight' },
    { name: 'minTemperatureC', label: 'Min temperature', type: 'number', unit: 'temp', hint: 'Refused when a stored product needs a temperature outside the new range' },
    { name: 'maxTemperatureC', label: 'Max temperature', type: 'number', unit: 'temp' },
  ];
  const dockFields: Field[] = [
    { name: 'dockCode', label: 'Dock code', required: true, placeholder: 'D4' }, { name: 'name', label: 'Name' },
    { name: 'dockType', label: 'Used for', type: 'select', options: DOCK_TYPES, required: true },
    // REQ-WMS-006 (script 70): what the dock holds
    ...(data?.dockCapacityReady ? [
      { name: 'capacityPallets', label: 'Capacity (pallet positions)', type: 'number', step: '1', hint: 'Pallets that can wait at the dock for loading. Empty: no limit' },
      { name: 'truckBays', label: 'Trucks at the same time', type: 'number', step: '1', placeholder: '1', hint: 'Dock slots that can share the same time' },
    ] as Field[] : []),
  ];

  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Warehouse className="h-8 w-8 text-sky-700" />Warehouse Layout</h1>
    <p className="text-slate-600">Chambers, zones, racks, bins and docks of each warehouse. Bin codes are printed on labels and scanned at putaway and picking.</p>
    <Banner msg={msg} error={error} />
    {data && !data.ready && <NotReady script="database_v2/30_req_wms_006_011_warehouse.sql" />}
    {data?.ready && data.dockCapacityReady === false && <div className="mt-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-900">Docks have no capacity yet. Run database_v2/70_dock_capacity_and_volume_billing.sql to add it.</div>}
    {data?.ready && <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {data.warehouses.map((w: any) => <button key={w.id} onClick={() => setParams({ warehouse: String(w.id) })}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold ${w.id === warehouseId ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 shadow-sm'} ${w.active ? '' : 'line-through opacity-60'}`}>
          {w.name}</button>)}
        <Link to="/admin/warehouses" className="ml-auto text-sm font-semibold text-sky-700">Add a warehouse or chamber on Manage Warehouses</Link>
      </div>

      {wh && <Section title={<>{wh.name} <span className="text-base font-normal text-slate-500">{wh.warehouseCode} · {wh.city || ''} · {wh.palletsInHouse} pallets inside</span></>}
        right={<div className="flex gap-2">{me.manager && <button onClick={() => setEdit(edit === 'site' ? '' : 'site')} className={btnLight}>Edit</button>}{activeButton('warehouses', wh, `warehouse ${wh.name}`)}</div>}>
        {!wh.active && <div className="mb-3 rounded-xl bg-slate-100 p-2 text-sm">Deactivated: {wh.deactivatedReason || '-'}</div>}
        {edit === 'site' && <div className="mb-4 rounded-xl bg-slate-50 p-3"><QuickForm fields={siteFields} initial={wh} busy={busy} submitText="Save warehouse" onCancel={() => setEdit('')}
          onSubmit={v => run(() => put(`/api/warehouse/warehouses/${wh.id}`, v), 'Warehouse saved.')} /></div>}

        <h3 className="font-bold">Chambers</h3>
        <div className="mt-2 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {wh.chambers.length === 0 && <div className="text-sm text-slate-500">No chambers yet. Add them on Manage Warehouses.</div>}
          {wh.chambers.map((c: any) => <div key={c.id} className={`rounded-xl border p-3 ${c.id === chamberId ? 'border-sky-600 ring-2 ring-sky-200' : ''} ${c.active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div><div className="font-bold">{c.name}</div><div className="text-sm text-slate-500">{c.chamberCode} · {range(c.minTemperatureC, c.maxTemperatureC)}</div></div>
              {!c.active && <span className={pill('CANCELLED')}>Deactivated</span>}
            </div>
            <div className="mt-2 text-sm">{c.binCount} bins · {c.usedPositions} of {c.binPositions} positions used{c.capacityPallets ? ` · capacity ${c.capacityPallets}` : ''}</div>
            {!c.active && c.deactivatedReason && <div className="text-xs text-slate-500">Reason: {c.deactivatedReason}</div>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setParams({ warehouse: String(wh.id), chamber: String(c.id) })} className={btnLight}>Open layout</button>
              {me.manager && <button onClick={() => setEdit(edit === `ch${c.id}` ? '' : `ch${c.id}`)} className={btnLight}>Edit</button>}
              {activeButton('chambers', c, `chamber ${c.name}`)}
            </div>
            {edit === `ch${c.id}` && <div className="mt-3 rounded-xl bg-slate-50 p-3"><QuickForm cols={2} fields={chamberFields} initial={c} busy={busy} submitText="Save chamber" onCancel={() => setEdit('')}
              onSubmit={v => run(() => put(`/api/warehouse/chambers/${c.id}`, v), 'Chamber saved.')} /></div>}
          </div>)}
        </div>

        <h3 className="mt-5 font-bold">Docks</h3>
        <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
          <thead><tr className="bg-slate-50 text-slate-600"><th className={th}>Dock</th><th className={th}>Name</th><th className={th}>Used for</th><th className={th}>Capacity</th><th className={th}>State</th><th className={th}></th></tr></thead>
          <tbody>{wh.docks.map((d: any) => <tr key={d.id} className="border-t">
            <td className={`${td} font-bold`}>{d.dockCode}</td><td className={td}>{d.name}</td>
            <td className={td}>{DOCK_TYPES.find(x => x[0] === d.dockType)?.[1] || d.dockType}</td>
            <td className={td}>{d.capacityPallets != null ? `${d.stagedPallets ?? 0} of ${d.capacityPallets} pallets` : `${d.stagedPallets ?? 0} pallets, no limit`}{d.truckBays ? ` · ${d.truckBays} truck${d.truckBays === 1 ? '' : 's'} at once` : ''}</td>
            <td className={td}>{d.active ? 'Active' : `Deactivated: ${d.deactivatedReason || '-'}`}</td>
            <td className={`${td} text-right`}><div className="flex justify-end gap-2">
              {me.manager && <button onClick={() => setEdit(edit === `dock${d.id}` ? '' : `dock${d.id}`)} className={btnLight}>Edit</button>}
              {activeButton('docks', d, `dock ${d.dockCode}`)}</div>
              {edit === `dock${d.id}` && <div className="mt-2 rounded-xl bg-slate-50 p-3 text-left"><QuickForm fields={dockFields} initial={d} busy={busy} submitText="Save dock" onCancel={() => setEdit('')}
                onSubmit={v => run(() => put(`/api/warehouse/docks/${d.id}`, v), 'Dock saved.')} /></div>}
            </td></tr>)}
            {wh.docks.length === 0 && <tr><td colSpan={6} className={`${td} text-slate-500`}>No docks yet. Receiving and dispatch need at least one inbound and one outbound dock.</td></tr>}
          </tbody></table></div>
        {me.manager && <div className="mt-3 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">Add a dock</div>
          <QuickForm fields={dockFields} busy={busy} submitText="Add dock" onSubmit={(v, f) => run(() => post(`/api/warehouse/warehouses/${wh.id}/docks`, v), 'Dock added.').then(ok => { if (ok) f.reset(); })} /></div>}
      </Section>}

      {layout && <ChamberLayout layout={layout} me={me} busy={busy} run={run} put={put} post={post} activeButton={activeButton} setActive={setActive} edit={edit} setEdit={setEdit} />}
    </>}
  </>;
}

function ChamberLayout({ layout, me, busy, run, put, post, activeButton, setActive, edit, setEdit }: {
  layout: any; me: ReturnType<typeof who>; busy: boolean; run: (a: () => Promise<any>, done: string) => Promise<boolean>;
  put: (p: string, b: unknown) => Promise<any>; post: (p: string, b: unknown) => Promise<any>;
  activeButton: (kind: string, row: any, what: string) => any; setActive: (kind: string, id: number, active: boolean, what: string) => void;
  edit: string; setEdit: (v: string) => void;
}) {
  const c = layout.chamber;
  const zoneFields: Field[] = [{ name: 'zoneCode', label: 'Zone code', required: true, placeholder: 'B' }, { name: 'name', label: 'Name' },
    { name: 'capacityPallets', label: 'Capacity (pallet positions)', type: 'number', step: '1' }];
  const rackFields: Field[] = [{ name: 'rackCode', label: 'Rack code', required: true, placeholder: 'R03' },
    { name: 'levels', label: 'Levels', type: 'number', step: '1', required: true }, { name: 'positionsPerLevel', label: 'Positions per level', type: 'number', step: '1', required: true },
    { name: 'capacityPerBin', label: 'Pallets per bin', type: 'number', step: '1', placeholder: '1' }];
  // Edit a rack: code, levels and capacity. More levels add bins like the top level; fewer levels take away the empty bins of the removed levels.
  const editRackFields: Field[] = [rackFields[0],
    { name: 'levels', label: 'Levels', type: 'number', step: '1', required: true, hint: 'More levels add bins like the top level. Fewer levels need the bins above to be empty' },
    { name: 'capacityPallets', label: 'Capacity (pallet positions)', type: 'number', step: '1', hint: 'Left empty: the saved value is kept' }];
  const binFields: Field[] = [{ name: 'binCode', label: 'Bin code', required: true, placeholder: `${c.chamberCode}-B-F03` },
    { name: 'capacityPallets', label: 'Pallet positions', type: 'number', step: '1', placeholder: '1' }, { name: 'maxWeightKg', label: 'Max weight (kg)', type: 'number' }];
  const editBinFields: Field[] = [...binFields, { name: 'levelNo', label: 'Level', type: 'number', step: '1' }, { name: 'positionNo', label: 'Position', type: 'number', step: '1' }];
  const printBins = (bins: any[], place: string) => printHtml(`Bin labels ${place}`, binLabelsHtml(bins.filter(b => b.active).map(b => ({ binCode: b.binCode, place: `${c.name} · ${place}` }))));

  const binBox = (b: any) => {
    const full = b.usedPallets >= b.capacityPallets;
    const style = !b.active ? 'bg-slate-200 text-slate-500 line-through' : full ? 'bg-sky-600 text-white' : b.usedPallets > 0 ? 'bg-sky-200 text-sky-900' : 'bg-emerald-50 text-emerald-900';
    return <div key={b.id} className={`min-w-[120px] rounded-lg border p-1.5 text-xs ${style}`} title={b.palletCodes ? `Pallets: ${b.palletCodes}` : 'Empty'}>
      <div className="font-mono font-bold">{b.binCode.replace(`${c.chamberCode}-`, '')}</div>
      <div>{b.usedPallets}/{b.capacityPallets} {b.palletCodes ? `· ${b.palletCodes}` : ''}</div>
      {me.manager && <div className="mt-1 flex gap-1">
        <button onClick={() => setEdit(edit === `bin${b.id}` ? '' : `bin${b.id}`)} className="rounded bg-white/80 px-1.5 text-slate-700">Edit</button>
        <button disabled={busy} onClick={() => setActive('bins', b.id, !b.active, `bin ${b.binCode}`)} className="rounded bg-white/80 px-1.5 text-slate-700">{b.active ? 'Off' : 'On'}</button>
      </div>}
    </div>;
  };

  return <Section id="chamber" title={<>Layout of {c.name} <span className="text-base font-normal text-slate-500">{c.chamberCode} · {range(c.minTemperatureC, c.maxTemperatureC)} · {layout.zones.reduce((a: number, z: any) => a + z.usedPositions, 0)} pallets</span></>}>
    <div className="mb-3 flex flex-wrap gap-3 text-xs">
      <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-900">Empty</span><span className="rounded bg-sky-200 px-2 py-0.5 text-sky-900">Part used</span>
      <span className="rounded bg-sky-600 px-2 py-0.5 text-white">Full</span><span className="rounded bg-slate-200 px-2 py-0.5 text-slate-500 line-through">Deactivated</span>
    </div>
    {layout.zones.length === 0 && <div className="text-sm text-slate-500">No zones yet.</div>}
    {layout.zones.map((z: any) => <div key={z.id} className={`mb-4 rounded-xl border p-3 ${z.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><b>Zone {z.zoneCode}</b> · {z.name} · {z.usedPositions} of {z.binPositions} positions used{!z.active && ` · deactivated: ${z.deactivatedReason || '-'}`}</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => printBins([...z.racks.flatMap((r: any) => r.bins), ...z.floorBins], `zone ${z.zoneCode}`)} className={btnLight}>Print bin labels</button>
          {me.manager && <>
            <button onClick={() => setEdit(edit === `zone${z.id}` ? '' : `zone${z.id}`)} className={btnLight}>Edit</button>
            <button onClick={() => setEdit(edit === `rack+${z.id}` ? '' : `rack+${z.id}`)} className={btnLight}>Add rack</button>
            <button onClick={() => setEdit(edit === `bin+${z.id}` ? '' : `bin+${z.id}`)} className={btnLight}>Add floor bin</button>
            {activeButton('zones', z, `zone ${z.zoneCode}`)}</>}
        </div>
      </div>
      {edit === `zone${z.id}` && <div className="mt-2 rounded-xl bg-slate-50 p-3"><QuickForm fields={zoneFields} initial={z} busy={busy} submitText="Save zone" onCancel={() => setEdit('')}
        onSubmit={v => run(() => put(`/api/warehouse/zones/${z.id}`, v), 'Zone saved.')} /></div>}
      {edit === `rack+${z.id}` && <div className="mt-2 rounded-xl bg-slate-50 p-3"><QuickForm cols={4} fields={rackFields} busy={busy} submitText="Add rack and its bins" onCancel={() => setEdit('')}
        onSubmit={v => run(() => post(`/api/warehouse/zones/${z.id}/racks`, v).then(r => ({ message: `Rack added with ${r.binsCreated ?? 0} bins. Print their labels from this zone.` })), 'Rack added.')} /></div>}
      {edit === `bin+${z.id}` && <div className="mt-2 rounded-xl bg-slate-50 p-3"><QuickForm fields={binFields} busy={busy} submitText="Add bin" onCancel={() => setEdit('')}
        onSubmit={v => run(() => post(`/api/warehouse/zones/${z.id}/bins`, v), 'Bin added.')} /></div>}

      {z.racks.map((r: any) => {
        const levels = Array.from(new Set<number>(r.bins.map((b: any) => b.levelNo ?? 0))).sort((a, b) => b - a);
        return <div key={r.id} className={`mt-3 rounded-lg bg-slate-50 p-2 ${r.active ? '' : 'opacity-60'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div><b>Rack {r.rackCode}</b> · {r.levels} levels · {r.bins.length} bins{r.capacityPallets != null ? ` · capacity ${r.capacityPallets}` : ''}{!r.active && ` · deactivated: ${r.deactivatedReason || '-'}`}</div>
            <div className="flex gap-2">
              <button onClick={() => printBins(r.bins, `rack ${r.rackCode}`)} className={btnLight}>Print labels</button>
              {me.manager && <button onClick={() => setEdit(edit === `rack${r.id}` ? '' : `rack${r.id}`)} className={btnLight}>Edit</button>}
              {activeButton('racks', r, `rack ${r.rackCode} (and its bins)`)}
            </div>
          </div>
          {edit === `rack${r.id}` && <div className="mt-2 rounded-xl bg-white p-3"><QuickForm cols={3} fields={editRackFields} initial={r} busy={busy} submitText="Save rack" onCancel={() => setEdit('')}
            onSubmit={v => run(() => put(`/api/warehouse/racks/${r.id}`, v), 'Rack saved.')} /></div>}
          <div className="mt-2 space-y-1">{levels.map(l => <div key={l} className="flex items-stretch gap-1 overflow-x-auto">
            <div className="w-10 shrink-0 pt-1 text-xs font-bold text-slate-500">L{l}</div>
            {r.bins.filter((b: any) => (b.levelNo ?? 0) === l).map(binBox)}
          </div>)}</div>
        </div>;
      })}
      {z.floorBins.length > 0 && <div className="mt-3"><div className="text-sm font-semibold">Floor positions</div><div className="mt-1 flex flex-wrap gap-1">{z.floorBins.map(binBox)}</div></div>}
      {[...z.racks.flatMap((r: any) => r.bins), ...z.floorBins].filter((b: any) => edit === `bin${b.id}`).map((b: any) =>
        <div key={b.id} className="mt-2 rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">Bin {b.binCode}</div>
          <QuickForm fields={editBinFields} initial={b} busy={busy} submitText="Save bin" onCancel={() => setEdit('')}
            onSubmit={v => run(() => put(`/api/warehouse/bins/${b.id}`, v), 'Bin saved.')} /></div>)}
    </div>)}
    {me.manager && <div className="rounded-xl bg-slate-50 p-3"><div className="mb-2 text-sm font-semibold">Add a zone</div>
      <QuickForm fields={zoneFields} busy={busy} submitText="Add zone" onSubmit={(v, f) => run(() => post(`/api/warehouse/chambers/${c.id}/zones`, v), 'Zone added. Add racks or floor bins to it.').then(ok => { if (ok) f.reset(); })} /></div>}
  </Section>;
}
