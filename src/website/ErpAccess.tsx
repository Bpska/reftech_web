/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Building2, Route, Warehouse, Smartphone } from 'lucide-react';
import { Reveal } from '@/website/Reveal';

const capabilities = [
  { icon: Route, title: 'Transport Operations', text: 'Create FTL/part-load trips, assign reefer vehicles and drivers, monitor GPS/temperature and delivery milestones.' },
  { icon: Warehouse, title: 'Cold Warehouse', text: 'Manage client inventory, lots, pallets, chambers, inward/outward movements and storage billing.' },
  { icon: Building2, title: 'Client C&F', text: 'Support transport-only, warehouse-only, or combined contracts with tenant-safe client operations and billing.' },
  { icon: Smartphone, title: 'Mobile Workforce', text: 'Employee, driver and partner access with trip location updates, proof of delivery and operational alerts.' },
];

export function ErpAccess() {
  return <section className="section-pad bg-mesh-light">
    <div className="mx-auto max-w-7xl">
      <Reveal><div className="max-w-3xl"><span className="heading-eyebrow">RefTech</span><h2 className="mt-4 font-display text-3xl font-bold text-deep-950 md:text-5xl">One platform for cold-chain C&amp;F operations</h2><p className="mt-5 text-deep-600">Designed as a multi-tenant SaaS foundation for refrigerated transport, cold storage, part-load consolidation, billing and live fleet visibility.</p></div></Reveal>
      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{capabilities.map((c,i)=><Reveal key={c.title} delay={i*80}><div className="h-full rounded-3xl border border-frost-100 bg-white p-6 shadow-sm"><c.icon className="h-8 w-8 text-frost-600"/><h3 className="mt-5 font-display text-lg font-bold text-deep-950">{c.title}</h3><p className="mt-3 text-sm leading-6 text-deep-600">{c.text}</p></div></Reveal>)}</div>
      {/* 7 Oct 2026: the "ERP access" login card was removed from the landing page; the Login button in the header is the way in. */}
    </div>
  </section>
}
