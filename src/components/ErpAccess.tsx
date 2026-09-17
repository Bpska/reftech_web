import { Building2, Route, Warehouse, Smartphone, ArrowRight } from 'lucide-react';
import { Reveal } from './Reveal';

const capabilities = [
  { icon: Route, title: 'Transport Operations', text: 'Create FTL/part-load trips, assign reefer vehicles and drivers, monitor GPS/temperature and delivery milestones.' },
  { icon: Warehouse, title: 'Cold Warehouse', text: 'Manage client inventory, lots, pallets, chambers, inward/outward movements and storage billing.' },
  { icon: Building2, title: 'Client C&F', text: 'Support transport-only, warehouse-only, or combined contracts with tenant-safe client operations and billing.' },
  { icon: Smartphone, title: 'Mobile Workforce', text: 'Employee, driver and partner access with trip location updates, proof of delivery and operational alerts.' },
];

export function ErpAccess() {
  return <section className="section-pad bg-mesh-light">
    <div className="mx-auto max-w-7xl">
      <Reveal><div className="max-w-3xl"><span className="heading-eyebrow">RefTech ERP</span><h2 className="mt-4 font-display text-3xl font-bold text-deep-950 md:text-5xl">One platform for cold-chain C&amp;F operations</h2><p className="mt-5 text-deep-600">Designed as a multi-tenant SaaS foundation for refrigerated transport, cold storage, part-load consolidation, billing and live fleet visibility.</p></div></Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{capabilities.map((c,i)=><Reveal key={c.title} delay={i*80}><div className="h-full rounded-3xl border border-frost-100 bg-white p-6 shadow-sm"><c.icon className="h-8 w-8 text-frost-600"/><h3 className="mt-5 font-display text-lg font-bold text-deep-950">{c.title}</h3><p className="mt-3 text-sm leading-6 text-deep-600">{c.text}</p></div></Reveal>)}</div>
      <Reveal delay={180}><div className="mt-10 overflow-hidden rounded-3xl bg-frost-950 text-white md:grid md:grid-cols-2"><img src="/media/reftech_warehouse.jpeg" className="h-full min-h-72 w-full object-cover" alt="RefTech cold chain warehouse"/><div className="p-8 md:p-12"><p className="text-sm font-semibold uppercase tracking-[.2em] text-frost-300">ERP access</p><h3 className="mt-4 font-display text-3xl font-bold">Employee &amp; Partner Login</h3><p className="mt-4 text-white/70">Employees include Admin, Manager, Employee and Driver roles. Partner access is isolated to the client’s own trips, inventory, invoices and documents.</p><a href="/login" className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-frost-950">Open ERP Login <ArrowRight className="h-4 w-4"/></a></div></div></Reveal>
    </div>
  </section>
}
