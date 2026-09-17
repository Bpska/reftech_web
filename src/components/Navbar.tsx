import { useEffect, useState } from 'react';
import { Menu, X, Snowflake, Phone } from 'lucide-react';
import { NAV_LINKS } from '@/data';

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
            ? 'bg-frost-950/90 backdrop-blur-xl border-b border-white/10 py-3'
            : 'bg-white/60 backdrop-blur-md border-b border-frost-100 py-4'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 md:px-10">
          <a href="#home" className="group flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-frost-400/40 blur-md transition-opacity group-hover:opacity-100 opacity-50" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-frost-500 to-frost-700 shadow-lg">
                <Snowflake className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className={`font-display text-lg font-extrabold tracking-tight transition-colors ${scrolled ? 'text-white' : 'text-deep-900'}`}>
                REFTECH
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-[0.25em] transition-colors ${scrolled ? 'text-frost-300' : 'text-frost-600'}`}>
                SCS 5PL
              </span>
            </div>
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
            <a href="/login" className="rounded-full border border-frost-300 px-4 py-2.5 text-xs font-semibold text-frost-700">ERP Login</a>
            <a href="#contact" className="btn-primary !py-2.5 !px-5 text-xs">Get a Quote</a>
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
          className={`absolute right-0 top-0 flex h-full w-80 max-w-[85%] flex-col bg-frost-950 p-6 pt-24 shadow-2xl transition-transform duration-500 ${
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
          <div className="mt-auto pt-6">
            <a href="#contact" onClick={() => setOpen(false)} className="btn-primary w-full">
              Get a Quote
            </a>
            <a
              href="tel:+919876543210"
              className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-white/60"
            >
              <Phone className="h-4 w-4" />
              +91 98765 43210
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
