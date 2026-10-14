/* RefTech Technology Company - confidential. */
import { Reveal } from '@/website/Reveal';
import { Activity, ArrowUpRight, Boxes, Link2, ShieldCheck } from 'lucide-react';

const capabilities = [
  { icon: Activity, code: '01', label: 'Live visibility', note: 'Location and shipment condition in one operational view.' },
  { icon: ShieldCheck, code: '02', label: 'Traceable records', note: 'Temperature and custody evidence designed for review.' },
  { icon: Boxes, code: '03', label: 'Connected operations', note: 'Transport, storage, dispatch and proof in one workflow.' },
  { icon: Link2, code: '04', label: 'API-ready data', note: 'Structured connections for tracking and operations.' },
];

export function Stats(){
  return <section className="capability-rail relative bg-white py-14 md:py-20"><div className="mx-auto max-w-7xl px-5 md:px-10 lg:px-16">
    <Reveal><div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><span className="heading-eyebrow">Operating layer</span><h2 className="mt-3 max-w-xl font-display text-2xl font-extrabold tracking-tight text-deep-900 md:text-3xl">Signals become operational decisions.</h2></div><p className="max-w-md text-sm leading-6 text-deep-500">A connected workflow for teams handling time- and temperature-sensitive movement.</p></div></Reveal>
    <div className="grid overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(8,49,67,.10)] sm:grid-cols-2 lg:grid-cols-4">
      {capabilities.map((item,index)=><Reveal key={item.label} delay={index*70}><article className="group relative h-full min-h-64 border-b border-slate-200 p-6 transition hover:bg-cyan-50/50 sm:border-r lg:border-b-0"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#082433] text-cyan-300"><item.icon className="h-5 w-5"/></span><span className="font-mono text-[10px] text-slate-400">NODE / {item.code}</span></div><h3 className="mt-12 font-display text-lg font-bold text-deep-900">{item.label}</h3><p className="mt-2 text-sm leading-6 text-deep-500">{item.note}</p><ArrowUpRight className="absolute bottom-5 right-5 h-4 w-4 text-slate-300 transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-cyan-600"/></article></Reveal>)}
    </div>
  </div></section>;
}