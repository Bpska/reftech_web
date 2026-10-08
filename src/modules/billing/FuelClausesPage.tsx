/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-BIL-009 -- Fuel & Surcharges. Manager and Admin only.
//
// Three parts: the published diesel prices, the diesel clause of each rate contract (customer and transporter), and
// the surcharges of a contract with a calculator. When the price crosses a step the rate moves by the % of the clause;
// the old rate is kept as a revision, so "Review now" is safe to press again.
// Backend: /api/billing/fuel/... (FuelClauseController).
// Needs database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql on reftech_billing.
import { useEffect, useMemo, useState } from 'react';
import { Fuel } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, Section, btn, btnLight, btnRed, errorText, input, label, td, th } from '@/shared/components/FormKit';
import { fmtMoney } from '@/shared/i18n/format'; // REQ-PLT-015 the login's units, date format and time zone
import { movedRate, nextThresholds, percent } from './fuelClause';

const rupee = (n: unknown) => fmtMoney(Number(n || 0));
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const num = (n: unknown) => (n === null || n === undefined || n === '' ? '-' : String(Number(n)));

const SCRIPT = 'database_v2/100_req_bil_009_012_fuel_collections_agreements_dedicated.sql';

export function FuelClausesPage() {
  const [tab, setTab] = useState<'clauses' | 'prices' | 'surcharges'>('clauses');
  const [options, setOptions] = useState<any>(null);
  const [clauses, setClauses] = useState<any[]>([]);
  const [prices, setPrices] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [priceForm, setPriceForm] = useState({ region: 'ALL', priceDate: today(), price: '', notes: '' });
  const [importText, setImportText] = useState('');
  const [pick, setPick] = useState({ contractKind: 'PARTNER', contractId: '' });
  const [surcharges, setSurcharges] = useState<any[]>([]);
  const [rule, setRule] = useState<any>(null);
  const [calc, setCalc] = useState({ freight: '', weightKg: '', goodsValue: '', odaKm: '', city: '', dockets: '1' });
  const [calcOut, setCalcOut] = useState<any>(null);
  const [msg, setMsg] = useState(''), [err, setErr] = useState(''), [busy, setBusy] = useState(false);

  const ready = options ? options.ready !== false : true;

  const load = async () => {
    setErr('');
    try {
      const [o, c, p] = await Promise.all([api('/api/billing/fuel/options'), api('/api/billing/fuel/clauses'), api('/api/billing/fuel/prices')]);
      setOptions(o); setClauses(c.clauses || []); setPrices(p.prices || []);
    } catch (e) { setErr(errorText(e, 'Could not load the fuel clauses.')); }
  };
  useEffect(() => { void load(); }, []);

  const contracts = useMemo(() => (pick.contractKind === 'PARTNER' ? options?.partnerContracts : options?.transporterContracts) || [], [options, pick.contractKind]);

  const loadSurcharges = async (kind: string, id: string) => {
    if (!id) { setSurcharges([]); return; }
    try { setSurcharges(await api(`/api/billing/fuel/surcharges?contractKind=${kind}&contractId=${id}`)); }
    catch (e) { setErr(errorText(e, 'Could not load the surcharges.')); }
  };

  const save = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const body = { ...form, contractId: Number(form.contractId) };
      const r = form.id ? await api(`/api/billing/fuel/clauses/${form.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/api/billing/fuel/clauses', { method: 'POST', body: JSON.stringify(body) });
      setMsg(r.message || 'Saved.'); setForm(null); await load();
    } catch (e) { setErr(errorText(e, 'Could not save the clause.')); } finally { setBusy(false); }
  };

  const review = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/fuel/review', { method: 'POST' }); setMsg([r.message, ...(r.changes || [])].filter(Boolean).join('\n')); await load(); }
    catch (e) { setErr(errorText(e, 'Could not review the clauses.')); } finally { setBusy(false); }
  };

  const savePrice = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/fuel/prices', { method: 'POST', body: JSON.stringify(priceForm) }); setMsg(r.message || 'Price saved.'); setPriceForm({ ...priceForm, price: '', notes: '' }); await load(); }
    catch (e) { setErr(errorText(e, 'Could not save the price.')); } finally { setBusy(false); }
  };

  const importPrices = async () => {
    setBusy(true); setMsg(''); setErr('');
    try { const r = await api('/api/billing/fuel/prices/import', { method: 'POST', body: JSON.stringify({ text: importText }) }); setMsg(r.message || 'Imported.'); setImportText(''); await load(); }
    catch (e) { setErr(errorText(e, 'Could not import the prices.')); } finally { setBusy(false); }
  };

  const saveRule = async () => {
    setBusy(true); setMsg(''); setErr('');
    try {
      const body = { ...rule, contractKind: pick.contractKind, contractId: Number(pick.contractId) };
      const r = rule.id ? await api(`/api/billing/fuel/surcharges/${rule.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/api/billing/fuel/surcharges', { method: 'POST', body: JSON.stringify(body) });
      setMsg(r.message || 'Saved.'); setRule(null); await loadSurcharges(pick.contractKind, pick.contractId);
    } catch (e) { setErr(errorText(e, 'Could not save the surcharge.')); } finally { setBusy(false); }
  };

  const removeRule = async (id: number) => {
    if (!window.confirm('Remove this surcharge rule?')) return;
    setBusy(true); setErr('');
    try { await api(`/api/billing/fuel/surcharges/${id}`, { method: 'DELETE' }); setMsg('Removed.'); await loadSurcharges(pick.contractKind, pick.contractId); }
    catch (e) { setErr(errorText(e, 'Could not remove the surcharge.')); } finally { setBusy(false); }
  };

  const runCalc = async () => {
    setBusy(true); setErr(''); setCalcOut(null);
    try { setCalcOut(await api('/api/billing/fuel/calculate', { method: 'POST', body: JSON.stringify({ ...calc, contractKind: pick.contractKind, contractId: Number(pick.contractId) }) })); }
    catch (e) { setErr(errorText(e, 'Could not work out the charges.')); } finally { setBusy(false); }
  };

  const showClause = async (id: number) => {
    setErr('');
    try { setOpen(await api(`/api/billing/fuel/clauses/${id}`)); }
    catch (e) { setErr(errorText(e, 'Could not open the clause.')); }
  };

  const blank = () => setForm({ contractKind: 'PARTNER', contractId: '', region: 'ALL', basePrice: '', baseDate: today(), stepSize: '', stepPercent: '', direction: 'BOTH', capPercent: '', active: true, notes: '' });

  const tabBtn = (k: typeof tab, text: string) => (
    <button type="button" className={tab === k ? btn : btnLight} onClick={() => setTab(k)}>{text}</button>
  );

  return <div className="mx-auto max-w-7xl p-4">
    <h1 className="flex items-center gap-2 text-2xl font-bold"><Fuel className="h-6 w-6" /> Fuel & Surcharges</h1>
    <p className="mt-1 text-slate-600">
      The diesel clause of a rate contract moves the rate when the published price crosses a step. It works the same way for
      customer rates and transporter rates, and every old rate is kept. Surcharges (ODA, green tax, docket, risk cover) are rules of the same contract.
    </p>
    <Banner msg={msg} error={err} />
    {!ready && <div className="my-4 rounded-xl bg-amber-50 p-4 text-amber-900">This screen needs the database script <b>{SCRIPT}</b> on reftech_billing. Ask the administrator to run it, then reload.</div>}

    {ready && <>
      <div className="mt-4 flex flex-wrap gap-2">{tabBtn('clauses', 'Diesel clauses')}{tabBtn('prices', 'Diesel prices')}{tabBtn('surcharges', 'Surcharges & calculator')}</div>

      {tab === 'clauses' && <Section title="Diesel clauses" right={<div className="flex gap-2">
        <button type="button" className={btnLight} disabled={busy} onClick={review}>Review now</button>
        <button type="button" className={btn} onClick={blank}>Add a clause</button>
      </div>}>
        {form && <div className="mb-4 rounded-xl border border-slate-200 p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div><span className={label}>Contract type</span>
              <select className={input} value={form.contractKind} disabled={!!form.id} onChange={e => setForm({ ...form, contractKind: e.target.value, contractId: '' })}>
                <option value="PARTNER">Customer rate contract</option>
                <option value="TRANSPORTER">Transporter rate contract</option>
              </select></div>
            <div><span className={label}>Contract</span>
              <select className={input} value={form.contractId} disabled={!!form.id} onChange={e => setForm({ ...form, contractId: e.target.value })}>
                <option value="">Choose</option>
                {((form.contractKind === 'PARTNER' ? options?.partnerContracts : options?.transporterContracts) || []).map((c: any) =>
                  <option key={c.id} value={c.id}>{c.contractNo} - {c.partyName}</option>)}
              </select></div>
            <div><span className={label}>Region</span><input className={input} value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} /></div>
            <div><span className={label}>Base diesel price (Rs/litre)</span><input className={input} value={form.basePrice} onChange={e => setForm({ ...form, basePrice: e.target.value })} /></div>
            <div><span className={label}>Base date</span><input type="date" className={input} value={form.baseDate} onChange={e => setForm({ ...form, baseDate: e.target.value })} /></div>
            <div><span className={label}>Step (Rs)</span><input className={input} value={form.stepSize} onChange={e => setForm({ ...form, stepSize: e.target.value })} /></div>
            <div><span className={label}>% per step</span><input className={input} value={form.stepPercent} onChange={e => setForm({ ...form, stepPercent: e.target.value })} /></div>
            <div><span className={label}>Direction</span>
              <select className={input} value={form.direction} onChange={e => setForm({ ...form, direction: e.target.value })}>
                <option value="BOTH">Up and down</option><option value="UP_ONLY">Up only</option>
              </select></div>
            <div><span className={label}>Ceiling % (optional)</span><input className={input} value={form.capPercent || ''} onChange={e => setForm({ ...form, capPercent: e.target.value })} /></div>
            <div className="md:col-span-3"><span className={label}>Notes</span><input className={input} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          {form.basePrice && form.stepSize && form.stepPercent && prices[0] && <p className="mt-2 text-sm text-slate-600">
            At today's price of Rs {num(prices[0].price)}: {percent(Number(form.basePrice), Number(form.stepSize), Number(form.stepPercent), Number(prices[0].price), form.direction === 'UP_ONLY')} %
            {(() => { const n = nextThresholds(Number(form.basePrice), Number(form.stepSize), Number(prices[0].price)); return n ? ` (next change at Rs ${n.up} up, Rs ${n.down} down)` : ''; })()}
          </p>}
          <div className="mt-3 flex gap-2">
            <button type="button" className={btn} disabled={busy} onClick={save}>Save</button>
            <button type="button" className={btnLight} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Contract</th><th className={th}>Party</th><th className={th}>Base</th><th className={th}>Step</th>
            <th className={th}>% / step</th><th className={th}>Diesel now</th><th className={th}>Rate now</th><th className={th}>Next change</th><th className={th} />
          </tr></thead><tbody>
            {clauses.map(c => <tr key={c.id} className="border-b border-slate-100">
              <td className={td}>{c.contractNo}<div className="text-xs text-slate-500">{c.contractKind === 'PARTNER' ? 'Customer' : 'Transporter'}{c.active ? '' : ' - not in use'}</div></td>
              <td className={td}>{c.partyName || '-'}</td>
              <td className={td}>Rs {num(c.basePrice)}<div className="text-xs text-slate-500">{c.baseDate}</div></td>
              <td className={td}>Rs {num(c.stepSize)}</td>
              <td className={td}>{num(c.stepPercent)} %{c.direction === 'UP_ONLY' ? ' (up only)' : ''}</td>
              <td className={td}>{c.latestPrice ? `Rs ${num(c.latestPrice)}` : '-'}<div className="text-xs text-slate-500">{c.latestPriceDate || ''}</div></td>
              <td className={td}><b>{num(c.currentPercent || 0)} %</b><div className="text-xs text-slate-500">{c.currentFrom ? `from ${c.currentFrom}` : 'no change yet'}</div></td>
              <td className={td}>{c.nextStepUpAt ? `up at Rs ${num(c.nextStepUpAt)}` : '-'}{c.nextStepDownAt ? `, down at Rs ${num(c.nextStepDownAt)}` : ''}</td>
              <td className={td}><button type="button" className={btnLight} onClick={() => showClause(c.id)}>Revisions</button>{' '}
                <button type="button" className={btnLight} onClick={() => setForm({ ...c, baseDate: c.baseDate || today() })}>Change</button></td>
            </tr>)}
            {clauses.length === 0 && <tr><td className={td} colSpan={9}>No diesel clause yet. Add one on a rate contract.</td></tr>}
          </tbody></table>
        </div>
        {open?.clause && <div className="mt-4 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between"><h3 className="font-bold">{open.clause.contractNo} - rate changes</h3>
            <button type="button" className={btnLight} onClick={() => setOpen(null)}>Close</button></div>
          <table className="mt-2 min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>From</th><th className={th}>Diesel</th><th className={th}>%</th><th className={th}>Lines</th><th className={th}>Old rate</th><th className={th}>New rate</th>
          </tr></thead><tbody>
            {(open.revisions || []).map((r: any) => <tr key={r.id} className="border-b border-slate-100">
              <td className={td}>{r.effectiveFrom}</td><td className={td}>Rs {num(r.price)}</td><td className={td}>{num(r.percent)} %</td>
              <td className={td}>{r.lines?.length || 0}</td>
              <td className={td}>{(r.lines || []).map((l: any) => <div key={l.id}>{rupee(l.oldRate)}</div>)}</td>
              <td className={td}>{(r.lines || []).map((l: any) => <div key={l.id}>{rupee(l.newRate)}</div>)}</td>
            </tr>)}
            {(open.revisions || []).length === 0 && <tr><td className={td} colSpan={6}>The rate has not moved yet.</td></tr>}
          </tbody></table>
        </div>}
      </Section>}

      {tab === 'prices' && <Section title="Published diesel prices">
        <div className="grid gap-3 md:grid-cols-5">
          <div><span className={label}>Region</span><input className={input} value={priceForm.region} onChange={e => setPriceForm({ ...priceForm, region: e.target.value })} /></div>
          <div><span className={label}>Date</span><input type="date" className={input} value={priceForm.priceDate} onChange={e => setPriceForm({ ...priceForm, priceDate: e.target.value })} /></div>
          <div><span className={label}>Price (Rs/litre)</span><input className={input} value={priceForm.price} onChange={e => setPriceForm({ ...priceForm, price: e.target.value })} /></div>
          <div className="md:col-span-2"><span className={label}>Notes</span><input className={input} value={priceForm.notes} onChange={e => setPriceForm({ ...priceForm, notes: e.target.value })} /></div>
        </div>
        <div className="mt-3"><button type="button" className={btn} disabled={busy} onClick={savePrice}>Save the price and review the clauses</button></div>
        <div className="mt-4"><span className={label}>Or paste a price list (one line each: date,price or date,region,price)</span>
          <textarea className={`${input} h-24 font-mono text-xs`} value={importText} onChange={e => setImportText(e.target.value)} />
          <button type="button" className={`${btnLight} mt-2`} disabled={busy || !importText.trim()} onClick={importPrices}>Import</button>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
            <th className={th}>Date</th><th className={th}>Region</th><th className={th}>Price</th><th className={th}>Source</th><th className={th}>Notes</th>
          </tr></thead><tbody>
            {prices.map(p => <tr key={p.id} className="border-b border-slate-100">
              <td className={td}>{p.priceDate}</td><td className={td}>{p.region}</td><td className={td}>Rs {num(p.price)}</td>
              <td className={td}>{p.source}</td><td className={td}>{p.notes || '-'}</td>
            </tr>)}
            {prices.length === 0 && <tr><td className={td} colSpan={5}>No price yet.</td></tr>}
          </tbody></table>
        </div>
      </Section>}

      {tab === 'surcharges' && <Section title="Surcharges and the calculator">
        <div className="grid gap-3 md:grid-cols-3">
          <div><span className={label}>Contract type</span>
            <select className={input} value={pick.contractKind} onChange={e => { const k = e.target.value; setPick({ contractKind: k, contractId: '' }); setSurcharges([]); }}>
              <option value="PARTNER">Customer rate contract</option><option value="TRANSPORTER">Transporter rate contract</option>
            </select></div>
          <div className="md:col-span-2"><span className={label}>Contract</span>
            <select className={input} value={pick.contractId} onChange={e => { setPick({ ...pick, contractId: e.target.value }); void loadSurcharges(pick.contractKind, e.target.value); }}>
              <option value="">Choose</option>
              {contracts.map((c: any) => <option key={c.id} value={c.id}>{c.contractNo} - {c.partyName}</option>)}
            </select></div>
        </div>

        {pick.contractId && <>
          <div className="mt-4 flex justify-end"><button type="button" className={btn} onClick={() => setRule({ chargeCode: 'ODA', name: '', basis: 'PER_KM_BEYOND', rate: '', minAmount: '', maxAmount: '', freeKm: '', cities: '', active: true, notes: '' })}>Add a surcharge</button></div>
          {rule && <div className="mt-3 rounded-xl border border-slate-200 p-3">
            <div className="grid gap-3 md:grid-cols-4">
              <div><span className={label}>Charge</span>
                <select className={input} value={rule.chargeCode} onChange={e => setRule({ ...rule, chargeCode: e.target.value })}>
                  {(options?.surchargeCodes || []).map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><span className={label}>Name on the bill</span><input className={input} value={rule.name} onChange={e => setRule({ ...rule, name: e.target.value })} /></div>
              <div><span className={label}>Worked out as</span>
                <select className={input} value={rule.basis} onChange={e => setRule({ ...rule, basis: e.target.value })}>
                  {(options?.surchargeBases || []).map((b: string) => <option key={b} value={b}>{b}</option>)}
                </select></div>
              <div><span className={label}>Rate</span><input className={input} value={rule.rate} onChange={e => setRule({ ...rule, rate: e.target.value })} /></div>
              <div><span className={label}>Minimum (Rs)</span><input className={input} value={rule.minAmount || ''} onChange={e => setRule({ ...rule, minAmount: e.target.value })} /></div>
              <div><span className={label}>Maximum (Rs)</span><input className={input} value={rule.maxAmount || ''} onChange={e => setRule({ ...rule, maxAmount: e.target.value })} /></div>
              <div><span className={label}>Free km or kg</span><input className={input} value={rule.freeKm || ''} onChange={e => setRule({ ...rule, freeKm: e.target.value })} /></div>
              <div><span className={label}>Only these cities</span><input className={input} value={rule.cities || ''} onChange={e => setRule({ ...rule, cities: e.target.value })} placeholder="Delhi, Gurugram" /></div>
            </div>
            <div className="mt-3 flex gap-2"><button type="button" className={btn} disabled={busy} onClick={saveRule}>Save</button>
              <button type="button" className={btnLight} onClick={() => setRule(null)}>Cancel</button></div>
          </div>}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm"><thead className="bg-slate-100"><tr>
              <th className={th}>Charge</th><th className={th}>Worked out as</th><th className={th}>Rate</th><th className={th}>Min / Max</th><th className={th}>Free</th><th className={th}>Cities</th><th className={th} />
            </tr></thead><tbody>
              {surcharges.map(s => <tr key={s.id} className="border-b border-slate-100">
                <td className={td}>{s.name}<div className="text-xs text-slate-500">{s.chargeCode}{s.active ? '' : ' - not in use'}</div></td>
                <td className={td}>{s.basis}</td><td className={td}>{num(s.rate)}</td>
                <td className={td}>{num(s.minAmount)} / {num(s.maxAmount)}</td><td className={td}>{num(s.freeKm)}</td><td className={td}>{s.cities || 'everywhere'}</td>
                <td className={td}><button type="button" className={btnLight} onClick={() => setRule(s)}>Change</button>{' '}
                  <button type="button" className={btnRed} disabled={busy} onClick={() => removeRule(s.id)}>Remove</button></td>
              </tr>)}
              {surcharges.length === 0 && <tr><td className={td} colSpan={7}>No surcharge on this contract yet.</td></tr>}
            </tbody></table>
          </div>

          <h3 className="mt-6 font-bold">What a consignment comes to</h3>
          <div className="mt-2 grid gap-3 md:grid-cols-6">
            <div><span className={label}>Freight (Rs)</span><input className={input} value={calc.freight} onChange={e => setCalc({ ...calc, freight: e.target.value })} /></div>
            <div><span className={label}>Weight (kg)</span><input className={input} value={calc.weightKg} onChange={e => setCalc({ ...calc, weightKg: e.target.value })} /></div>
            <div><span className={label}>Goods value (Rs)</span><input className={input} value={calc.goodsValue} onChange={e => setCalc({ ...calc, goodsValue: e.target.value })} /></div>
            <div><span className={label}>Km beyond the area</span><input className={input} value={calc.odaKm} onChange={e => setCalc({ ...calc, odaKm: e.target.value })} /></div>
            <div><span className={label}>Delivery city</span><input className={input} value={calc.city} onChange={e => setCalc({ ...calc, city: e.target.value })} /></div>
            <div><span className={label}>Dockets</span><input className={input} value={calc.dockets} onChange={e => setCalc({ ...calc, dockets: e.target.value })} /></div>
          </div>
          <div className="mt-3"><button type="button" className={btn} disabled={busy} onClick={runCalc}>Work it out</button></div>
          {calcOut && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
            <p>Contract {calcOut.contractNo}. Freight {rupee(calcOut.baseFreight)} with the diesel clause of {num(calcOut.fuelPercent)} % = <b>{rupee(calcOut.freight)}</b>
              {calc.freight ? ` (locally ${rupee(movedRate(Number(calc.freight), Number(calcOut.fuelPercent)))})` : ''}</p>
            <table className="mt-2 min-w-full"><tbody>
              {(calcOut.charges || []).map((c: any) => <tr key={c.code} className={c.applies ? '' : 'text-slate-400'}>
                <td className={td}>{c.name}</td><td className={td}>{rupee(c.amount)}</td><td className={td}>{c.working}</td>
              </tr>)}
            </tbody></table>
            <p className="mt-2">Surcharges {rupee(calcOut.surchargeTotal)}, total before GST <b>{rupee(calcOut.total)}</b>.</p>
          </div>}
        </>}
      </Section>}
    </>}
  </div>;
}

export default FuelClausesPage;
