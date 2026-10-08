/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect, useState } from 'react';
import { Menu, X, Phone, Mail } from 'lucide-react';
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
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-frost-950/90 backdrop-blur-xl border-b border-white/10 py-1.5'
            : 'bg-white/60 backdrop-blur-md border-b border-frost-100 py-2'
        }`}
      >
        <nav className="flex w-full items-center justify-between px-5 md:px-10">
          <a href="/#home" className="group flex shrink-0 items-center gap-2.5">
            <BrandMark dark={scrolled} compact/>
          </a>

          <ul className="hidden items-center gap-8 lg:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative group ${scrolled ? 'text-white/80 hover:text-white' : 'text-deep-600 hover:text-frost-700'}`}
                >
                  {link.label}
                  <span className="absolute -bottom-1.5 left-0 h-0.5 w-0 rounded-full bg-frost-400 transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              href="tel:+919876543210"
              className={`flex items-center gap-2 text-sm font-medium transition-colors ${scrolled ? 'text-white/80 hover:text-white' : 'text-deep-600 hover:text-frost-700'}`}
            >
              <Phone className="h-4 w-4" />
              +91 98765 43210
            </a>
            {/* The office email after the phone number; on wide screens (2xl) only, so the top bar does not crowd on laptops; the mobile menu always shows it. */}
            <a
              href="mailto:admin@reftech.in"
              className={`hidden items-center gap-2 whitespace-nowrap text-sm font-medium transition-colors 2xl:flex ${scrolled ? 'text-white/80 hover:text-white' : 'text-deep-600 hover:text-frost-700'}`}
            >
              <Mail className="h-4 w-4" />
              admin@reftech.in
            </a>
            {/* One Login button: the sign-in page offers Employee, Partner and Hired Truck/Transporter Login. */}
            <a href="/login" className="rounded-full bg-deep-900 px-6 py-2.5 text-xs font-bold text-white shadow-md ring-1 ring-deep-800 transition-colors hover:bg-deep-800">Login</a>
            <a href="/#contact" className="btn-primary !py-2.5 !px-5 text-xs">Get a Quote</a>
          </div>

          <button
            onClick={() => setOpen(!open)}
            className={`flex h-10 w-10 items-center justify-center rounded-lg backdrop-blur-sm transition-colors lg:hidden ${scrolled ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-frost-100 text-deep-900 hover:bg-frost-200'}`}
            aria-label="Toggle menu"
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
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[85%] flex-col bg-frost-950 p-6 pt-28 shadow-2xl transition-transform duration-500 ${
            open ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
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
              Get a Quote
            </a>
            <a
              href="tel:+919876543210"
              className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-white/60"
            >
              <Phone className="h-4 w-4" />
              +91 98765 43210
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