/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect, useState } from 'react';
import { Menu, X, Mail } from 'lucide-react';
import { NAV_LINKS } from '@/website/data';
import { BrandMark } from '@/shared/components/BrandMark';

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header
        className={`fixed left-1/2 top-2 z-50 w-[calc(100%-18px)] max-w-[1480px] -translate-x-1/2 rounded-2xl border py-1.5 transition-all duration-500 backdrop-blur-2xl ${scrolled ? 'border-white/15 bg-[#041917]/55 shadow-[0_18px_55px_rgba(0,0,0,.24)]' : 'border-white/10 bg-[#041917]/28 shadow-[0_10px_35px_rgba(0,0,0,.12)]'}`}
      >
        <nav className="flex w-full items-center justify-between px-2.5 md:px-4">
          <a href="/#home" className="group flex shrink-0 items-center gap-2 transition-transform hover:scale-[1.02]">
            <BrandMark compact />
          </a>

          <ul className="hidden items-center gap-3 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="relative rounded-full border border-transparent px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-all group hover:border-white/10 hover:bg-white/8 hover:text-cyan-200"
                >
                  {link.label}
                  <span className="absolute -bottom-1.5 left-0 h-0.5 w-0 rounded-full bg-frost-400 transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            {/* The office email after the phone number; from 1400px wide, so the top bar does not crowd on laptops; the mobile menu always shows it. */}
            <a
              href="mailto:admin@reftech.in"
              className="hidden items-center gap-2 whitespace-nowrap text-sm font-medium text-white/80 transition-colors hover:text-white min-[1400px]:flex"
            >
              <Mail className="h-4 w-4" />
              admin@reftech.in
            </a>
            {/* One Login button: the sign-in page offers Employee, Partner and Hired Truck/Transporter Login. */}
            <a href="/login" className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10">Login</a>
            <a href="/#contact" className="btn-primary min-h-9 py-2! px-4! text-xs">Get a quote</a>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-lg backdrop-blur-xl transition-colors hover:bg-white/20 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </nav>
      </header>

      {/* Mobile menu */}
      <div
        className={`fixed inset-0 z-40 lg:hidden transition-all duration-500 ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div
          className="absolute inset-0 bg-frost-950/95 backdrop-blur-xl"
          onClick={() => setOpen(false)}
        />
        <div
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[85%] flex-col bg-frost-950 p-6 pt-20 shadow-2xl transition-transform duration-500 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="mb-6 flex items-center justify-start">
            <BrandMark compact className="!max-w-[200px]" />
          </div>
          <ul className="flex flex-col gap-2">
            {NAV_LINKS.map((link, i) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-4 py-3.5 text-base font-medium text-white/80 transition-all hover:bg-white/10 hover:text-white"
                  style={{ transitionDelay: `${i * 40}ms` }}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-auto space-y-3 pt-6">
            <a href="/login" onClick={() => setOpen(false)} className="block rounded-xl bg-deep-800 px-3 py-3 text-center text-sm font-bold text-white shadow-md hover:bg-deep-700">Login</a>
            <a href="/#contact" onClick={() => setOpen(false)} className="btn-primary w-full">
              Get a quote
            </a>
            <a
              href="mailto:admin@reftech.in"
              className="flex items-center justify-center gap-2 text-sm font-medium text-white/60"
            >
              <Mail className="h-4 w-4" />
              admin@reftech.in
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
