/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Reveal } from '@/website/Reveal';
import { CORE_VALUES, ABOUT_IMAGE, DIFFERENTIATORS } from '@/website/data';

export function About() {
  return (
    <section id="about" className="section-pad bg-white">
      <div className="mx-auto max-w-7xl">
        {/* About intro */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative">
              <div className="overflow-hidden rounded-3xl shadow-2xl">
                <img
                  src={ABOUT_IMAGE}
                  alt="Cold storage facility"
                  className="h-[420px] w-full object-cover transition-transform duration-700 hover:scale-105"
                />
              </div>
              {/* Floating badge */}
              <div className="absolute -bottom-6 -right-6 hidden rounded-2xl bg-frost-950 px-7 py-5 text-white shadow-xl md:block">
                <p className="font-display text-3xl font-bold gradient-text">5PL</p>
                <p className="text-xs uppercase tracking-wider text-white/60">Logistics Model</p>
              </div>
              {/* Decorative ring */}
              <div className="absolute -left-4 -top-4 h-24 w-24 rounded-full border-2 border-dashed border-frost-200 animate-spin-slow" />
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div>
              <span className="heading-eyebrow">
                <span className="h-px w-8 bg-frost-400" />
                About Us
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl lg:text-5xl">
                Revolutionizing Cold Chain{' '}
                <span className="gradient-text">5PL Logistics</span>
              </h2>
              <p className="mt-6 text-base leading-relaxed text-deep-600">
                At REFTECH SCS 5PL PRIVATE LIMITED, we revolutionize cold chain logistics with
                innovative, technology-driven solutions. Founded by two visionary female
                directors, we focus on empowering women and enhancing efficiency through an
                asset-light transportation model.
              </p>
              <p className="mt-4 text-base leading-relaxed text-deep-600">
                Specializing in temperature-sensitive supply chains, we combine advanced
                technology and expert planning to deliver cost-effective, reliable, and
                sustainable logistics. Committed to exceptional customer satisfaction, we aim to
                transform the cold chain industry and support business growth with innovative,
                technology-enabled efficient solutions.
              </p>

              {/* Core values grid */}
              <div className="mt-8 grid grid-cols-2 gap-4">
                {CORE_VALUES.map((value, i) => (
                  <Reveal key={value.title} delay={i * 80}>
                    <div className="group rounded-2xl border border-frost-100 bg-frost-50/50 p-5 transition-all duration-300 hover:border-frost-300 hover:bg-frost-50 hover:shadow-lg">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-frost-500 to-frost-700 text-white shadow-md transition-transform duration-300 group-hover:scale-110">
                        <value.icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-3.5 font-display text-base font-bold text-deep-900">
                        {value.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-deep-500">
                        {value.description}
                      </p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Differentiators strip */}
        <Reveal delay={100}>
          <div className="mt-20 grid gap-5 rounded-3xl bg-mesh-light p-8 md:grid-cols-2 lg:grid-cols-4 lg:p-12">
            {DIFFERENTIATORS.map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <div className="group flex flex-col items-start">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-md transition-all duration-300 group-hover:shadow-xl group-hover:-translate-y-1">
                    <item.icon className="h-6 w-6 text-frost-600" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-deep-900">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-deep-500">
                    {item.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
