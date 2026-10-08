/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-CNF-001 .. 007 -- C&F (carrying and forwarding) agency: one page with a tab per area.
//   Contracts & distributors  REQ-CNF-001, 004   Orders (credit hold queue)  REQ-CNF-002, 004
//   Stock statement           REQ-CNF-003        Returns & claims            REQ-CNF-007
//   Invoices & challans       REQ-CNF-006        Settlement                  REQ-CNF-005
// Staff choose the principal at the top. A principal's login (partner) sees only its own data, and only the tabs its
// contract shows on the portal. Until script 68 is run the page says so (NotReady).
// Backend: /api/cnf/** (com.reftech.core.cnf).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { api } from '@/shared/services/api';
import { Banner, NotReady, input, label } from '@/shared/components/FormKit';
import { CNF_SCRIPT, TabKey, tabsFor, useRunner } from './cnf';
import { Pill } from './CnfKit';
import { ContractsTab } from './ContractsTab';
import { OrdersTab } from './OrdersTab';
import { StockTab } from './StockTab';
import { ReturnsTab } from './ReturnsTab';
import { DocumentsTab } from './DocumentsTab';
import { SettlementTab } from './SettlementTab';

export type CnfCtx = {
  partner: boolean; canWrite: boolean; manager: boolean; admin: boolean; userId?: number;
  principalId: number | null; contract: any | null; reload: () => void;
};

export function CnfPage() {
  const r = useRunner();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<any>(null);
  const [principals, setPrincipals] = useState<any[]>([]);
  const [principalId, setPrincipalId] = useState<number | null>(() => {
    const v = Number(params.get('principal') || localStorage.getItem('reftech_cnf_principal') || 0);
    return v > 0 ? v : null;
  });
  const [contract, setContract] = useState<any>(null);
  const [n, setN] = useState(0);

  useEffect(() => {
    api('/api/cnf/status').then(s => {
      setStatus(s);
      if (s.ready === false) return;
      if (s.partnerLogin) { setPrincipalId(null); setContract(s.contract || null); return; }
      api('/api/cnf/principals').then(p => {
        const list = p.principals || [];
        setPrincipals(list);
        setPrincipalId(cur => cur && list.some((x: any) => x.id === cur) ? cur : (list.find((x: any) => x.contractId)?.id ?? list[0]?.id ?? null));
      }).catch(x => r.setError(String((x as Error).message)));
    }).catch(x => r.setError(String((x as Error).message)));
  }, [n]);

  useEffect(() => {
    if (!status || status.ready === false || status.partnerLogin || !principalId) return;
    localStorage.setItem('reftech_cnf_principal', String(principalId));
    const p = principals.find(x => x.id === principalId);
    if (p?.contractId) api(`/api/cnf/contracts/${p.contractId}`).then(setContract).catch(() => setContract(null));
    else setContract(null);
  }, [principalId, principals, status]);

  const partner = !!status?.partnerLogin;
  const tabs = useMemo(() => tabsFor(partner, contract), [partner, contract]);
  const asked = (params.get('tab') || 'contracts') as TabKey;
  const tab: TabKey = tabs.some(([k]) => k === asked) ? asked : 'contracts';
  const setTab = (k: TabKey) => { const p = new URLSearchParams(params); p.set('tab', k); setParams(p, { replace: true }); };

  if (!status) return <Banner error={r.error} />;
  if (status.ready === false) return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Building2 className="h-8 w-8 text-sky-700" />C&amp;F Agency</h1>
    <NotReady script={status.script || CNF_SCRIPT} />
  </>;

  const ctx: CnfCtx = {
    partner, canWrite: !!status.canWrite, manager: !!status.manager, admin: !!status.admin, userId: status.userId,
    principalId: partner ? null : principalId, contract, reload: () => setN(x => x + 1),
  };
  return <>
    <h1 className="flex items-center gap-2 text-3xl font-bold"><Building2 className="h-8 w-8 text-sky-700" />{partner ? 'My C&F Agent' : 'C&F Agency'}</h1>
    <p className="text-slate-600">{partner
      ? 'Your stock at the RefTech depot, your distributors\' orders, invoices, returns and the monthly settlement.'
      : 'Carrying and forwarding for principals: contracts, distributors\' orders with credit control, the daily stock statement, invoices in the principal\'s name, returns and the monthly settlement.'}</p>
    <div className="mt-3 flex flex-wrap items-end gap-3">
      {!partner && <div className="w-80 max-w-full"><label className={label}>Principal</label>
        <select className={input} value={principalId ?? ''} onChange={e => setPrincipalId(e.target.value ? Number(e.target.value) : null)}>
          {principals.map(p => <option key={p.id} value={p.id}>{p.name}{p.contractNo ? ` (${p.contractNo})` : ''}</option>)}
        </select></div>}
      {contract && <div className="text-sm">Contract <b>{contract.contractNo}</b> <Pill s={contract.status} /></div>}
      {partner && !status.canWrite && <div className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-700">Your login can only look (PARTNER_VIEWER).</div>}
    </div>
    <Banner msg={r.msg} error={r.error} />
    <div className="mt-4 flex flex-wrap gap-1 border-b">
      {tabs.map(([k, t]) => <button key={k} type="button" onClick={() => setTab(k)}
        className={`rounded-t-xl px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{t}</button>)}
    </div>
    {!partner && !principalId
      ? <div className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-700">No partner yet. Add one on Masters &gt; Partners, assign it to a warehouse, then make its C&amp;F contract here.</div>
      : <div key={`${tab}-${principalId ?? 'me'}`}>
        {tab === 'contracts' && <ContractsTab ctx={ctx} />}
        {tab === 'orders' && <OrdersTab ctx={ctx} />}
        {tab === 'stock' && <StockTab ctx={ctx} />}
        {tab === 'returns' && <ReturnsTab ctx={ctx} />}
        {tab === 'documents' && <DocumentsTab ctx={ctx} />}
        {tab === 'settlement' && <SettlementTab ctx={ctx} />}
      </div>}
  </>;
}

/** "?principalId=5" for staff, "" for a partner login (the server takes its own). */
export function pq(ctx: CnfCtx, first = true): string {
  return ctx.principalId ? `${first ? '?' : '&'}principalId=${ctx.principalId}` : '';
}
