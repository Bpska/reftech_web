/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Reveal } from '@/website/Reveal';
import { INDUSTRIES, INDUSTRY_IMAGE } from '@/website/data';
import { Snowflake } from 'lucide-react';

export function Industries() {
  return (
    <section id="industries" className="section-pad bg-frost-50/60">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
          {/* Left: heading + image */}
          <Reveal>
            <div className="lg:sticky lg:top-28">
              <span className="heading-eyebrow">
                <span className="h-px w-8 bg-frost-400" />
                Industries We Serve
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl lg:text-5xl">
                Keeping Your Products{' '}
                <span className="gradient-text">Safe, Fresh, and Reliable</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-deep-500">
                We serve a diverse range of industries, each with unique temperature requirements.
                Our specialized cold chain solutions ensure product integrity from origin to
                destination.
              </p>

              <div className="mt-8 overflow-hidden rounded-2xl shadow-xl">
                <img
                  loading="lazy"
                  decoding="async"
                  src={INDUSTRY_IMAGE}
                  alt="Warehouse loading dock"
                  className="h-56 w-full object-cover"
                />
              </div>

              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-frost-200 bg-white p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-frost-100">
                  <Snowflake className="h-6 w-6 text-frost-600" />
                </div>
                <div>
                  <p className="font-display text-sm font-bold text-deep-900">
                    Multi-Temperature Zones
                  </p>
                  <p className="text-xs text-deep-500">
                    From -25°C frozen to +8°C chilled, we handle it all
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right: industry cards */}
          <div className="industry-grid grid gap-5 sm:grid-cols-2">
            {INDUSTRIES.map((industry, i) => (
              <Reveal key={industry.title} delay={i * 70}>
                <article className="group relative h-full overflow-hidden rounded-2xl border border-frost-100 bg-white shadow-sm transition-all duration-500 hover:shadow-xl hover:-translate-y-1">
                  <div className="relative h-44 overflow-hidden">
                    <img
                  loading="lazy"
                  decoding="async"
                      src={industry.image}
                      alt={industry.title + ' cold-chain logistics'}
                      sizes="(max-width: 767px) 100vw, 33vw"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-frost-950/80 via-frost-950/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 rounded-full bg-frost-500/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                      {industry.temperature}
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-display text-base font-bold text-deep-900 transition-colors group-hover:text-frost-700">
                      {industry.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-deep-500">
                      {industry.description}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
