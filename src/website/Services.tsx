/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Reveal } from '@/website/Reveal';
import { SERVICES } from '@/website/data';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export function Services() {
  return (
    <section id="services" className="section-pad bg-white">
      <div className="mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="heading-eyebrow justify-center">
            <span className="h-px w-8 bg-frost-400" />
            Our Services
            <span className="h-px w-8 bg-frost-400" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl lg:text-5xl">
            Delivering Excellence in{' '}
            <span className="gradient-text">Temperature-Controlled Logistics</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-deep-500">
            From real-time tracking to end-to-end supply chain management, we provide
            comprehensive solutions designed for the unique demands of cold chain logistics.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {SERVICES.map((service, i) => (
            <Reveal key={service.title} delay={i * 100}>
              <article className="group relative h-full overflow-hidden rounded-3xl border border-frost-100 bg-white p-8 shadow-sm transition-all duration-500 hover:border-frost-300 hover:shadow-2xl hover:shadow-frost-900/10">
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-frost-50/0 to-frost-50/0 opacity-0 transition-opacity duration-500 group-hover:from-frost-50/50 group-hover:to-white group-hover:opacity-100" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-frost-500 to-frost-700 text-white shadow-lg shadow-frost-600/25 transition-all duration-500 group-hover:scale-110 group-hover:shadow-xl">
                      <service.icon className="h-7 w-7" />
                    </div>
                    <span className="font-display text-5xl font-extrabold text-frost-50 transition-colors duration-500 group-hover:text-frost-100">
                      0{i + 1}
                    </span>
                  </div>

                  <h3 className="mt-6 font-display text-xl font-bold text-deep-900">
                    {service.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-deep-500">
                    {service.description}
                  </p>

                  <ul className="mt-6 space-y-2.5">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3 text-sm text-deep-700">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-frost-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#contact"
                    className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-frost-600 transition-colors hover:text-frost-800"
                  >
                    Learn more
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 h-1 w-0 rounded-full bg-gradient-to-r from-frost-400 to-frost-600 transition-all duration-500 group-hover:w-full" />
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
