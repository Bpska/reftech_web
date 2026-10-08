/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Snowflake, ArrowRight } from 'lucide-react';
import { FOOTER_LINKS, SOCIAL_LINKS } from '@/website/data';

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-frost-950 text-white">
      {/* Top accent */}
      <div className="h-1 w-full bg-gradient-to-r from-frost-500 via-ice-400 to-frost-500" />

      {/* Newsletter strip */}
      <div className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 md:flex-row md:px-10 lg:px-16">
          <div>
            <h3 className="font-display text-xl font-bold text-white">
              Subscribe for Newsletter
            </h3>
            <p className="mt-1.5 text-sm text-white/50">
              Get the latest updates on cold chain logistics and industry insights.
            </p>
          </div>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex w-full max-w-md items-center gap-3"
          >
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm text-white outline-none transition-all placeholder:text-white/40 focus:border-frost-400 focus:bg-white/10"
            />
            <button className="btn-primary !py-3">
              Subscribe
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Main footer */}
      <div className="mx-auto max-w-7xl px-5 py-14 md:px-10 lg:px-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#home" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-frost-500 to-frost-700 shadow-lg">
                <Snowflake className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-display text-lg font-extrabold tracking-tight text-white">
                  REFTECH
                </span>
                <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-frost-300">
                  SCS 5PL
                </span>
              </div>
            </a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">
              REFTECH SCS 5PL PRIVATE LIMITED delivers innovative and reliable 5PL logistics
              solutions for temperature-sensitive goods with a focus on efficiency and
              sustainability.
            </p>
            <div className="mt-6 flex gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/60 transition-all duration-300 hover:border-frost-400/50 hover:bg-frost-500/20 hover:text-frost-300"
                >
                  <social.icon className="h-4.5 w-4.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="font-display text-sm font-bold uppercase tracking-wider text-white/80">
                {title}
              </h4>
              <ul className="mt-5 space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-white/50 transition-colors hover:text-frost-300"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-6 text-center md:flex-row md:px-10 lg:px-16">
          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} REFTECH SCS 5PL PRIVATE LIMITED. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-white/40 transition-colors hover:text-white/70">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-white/40 transition-colors hover:text-white/70">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
