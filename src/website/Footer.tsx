/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the company.
 */
import { ArrowRight, Mail, MapPin, Snowflake } from 'lucide-react';

const groups = [
  { title:'Services', links:[['Reefer transport','/#services'],['Cold storage','/#services'],['5PL operations','/#services'],['Technology platform','/#technology']] },
  { title:'Explore', links:[['Track a consignment','/track'],['Request a pickup','/pickup'],['Get a quote','/pickup?kind=QUOTE'],['Our locations','/locations']] },
  { title:'Company', links:[['About RefTech','/#about'],['Careers','/careers'],['Contact','/#contact'],['Login','/login']] },
];
export function Footer(){return <footer className="relative overflow-hidden bg-frost-950 text-white"><div className="h-px bg-linear-to-r from-transparent via-frost-400 to-transparent"/><div className="mx-auto max-w-7xl px-5 py-16 md:px-10 lg:px-16"><div className="grid gap-12 lg:grid-cols-[1.4fr_2fr]">
  <div><a href="/#home" className="inline-flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-frost-600"><Snowflake className="h-5 w-5"/></span><span><b className="font-display text-xl tracking-wide">REFTECH</b><small className="block text-[10px] tracking-[.22em] text-frost-300">SCS 5PL</small></span></a><p className="mt-5 max-w-md text-sm leading-relaxed text-white/60">Technology-enabled cold-chain logistics connecting transport, storage, visibility and operational evidence.</p><div className="mt-6 space-y-2 text-sm text-white/70"><a href="mailto:admin@reftech.in" className="flex items-center gap-2 hover:text-white"><Mail className="h-4 w-4"/>admin@reftech.in</a><a href="/locations" className="flex items-center gap-2 hover:text-white"><MapPin className="h-4 w-4"/>View verified locations and contact details</a></div></div>
  <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">{groups.map(g=><div key={g.title}><h3 className="text-xs font-bold uppercase tracking-[.16em] text-frost-300">{g.title}</h3><ul className="mt-5 space-y-3">{g.links.map(([label,href])=><li key={label}><a href={href} className="inline-flex items-center gap-1 text-sm text-white/60 transition hover:text-white">{label}{label==='Get a quote'&&<ArrowRight className="h-3 w-3"/>}</a></li>)}</ul></div>)}</div>
</div><div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between"><p>© {new Date().getFullYear()} RefTech SCS 5PL Private Limited.</p><p>Legal identifiers and policy links will be published after company approval.</p></div></div><div aria-hidden className="pointer-events-none -mb-12 text-center font-display text-[18vw] font-extrabold leading-none text-white/[.025]">RefTech</div></footer>}
