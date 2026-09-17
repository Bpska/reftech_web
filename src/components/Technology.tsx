import { Reveal } from '@/components/Reveal';
import { TECHNOLOGIES, TECH_IMAGE, PROCESS_STEPS } from '@/data';
import { Radar, Cpu, Brain } from 'lucide-react';

export function Technology() {
  return (
    <section id="technology" className="relative section-pad bg-mesh overflow-hidden">
      {/* Decorative grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-20" />

      {/* Glow orbs */}
      <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-frost-500/20 blur-[100px]" />
      <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-ice-500/15 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="heading-eyebrow justify-center text-frost-300">
            <span className="h-px w-8 bg-frost-400" />
            Technology
            <span className="h-px w-8 bg-frost-400" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white text-balance md:text-4xl lg:text-5xl">
            How We Deliver Excellence in{' '}
            <span className="gradient-text">Logistics</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/60">
            We combine IoT sensors, artificial intelligence, and real-time tracking to build a
            transparent, efficient, and reliable cold chain.
          </p>
        </Reveal>

        {/* Tech cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { ...TECHNOLOGIES[0], icon: Radar, color: 'from-frost-400 to-frost-600' },
            { ...TECHNOLOGIES[1], icon: Cpu, color: 'from-ice-400 to-ice-600' },
            { ...TECHNOLOGIES[2], icon: Brain, color: 'from-accent-400 to-accent-600' },
          ].map((tech, i) => (
            <Reveal key={tech.title} delay={i * 100}>
              <article className="group relative h-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-md transition-all duration-500 hover:border-white/20 hover:bg-white/[0.08]">
                {/* Pulse ring */}
                <div className="relative">
                  <div className="absolute inset-0 animate-pulse-ring rounded-2xl bg-frost-400/20" />
                  <div
                    className={`relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tech.color} text-white shadow-lg transition-transform duration-500 group-hover:scale-110`}
                  >
                    <tech.icon className="h-7 w-7" />
                  </div>
                </div>
                <h3 className="mt-6 font-display text-lg font-bold text-white">{tech.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/60">{tech.description}</p>

                {/* Decorative corner */}
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border border-white/5 transition-all duration-500 group-hover:scale-150" />
              </article>
            </Reveal>
          ))}
        </div>

        {/* Process timeline */}
        <Reveal delay={100}>
          <div className="mt-20 overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md">
            <div className="grid gap-0 md:grid-cols-4">
              {PROCESS_STEPS.map((step, i) => (
                <Reveal key={step.number} delay={i * 80}>
                  <div className="group relative flex h-full flex-col items-center p-8 text-center transition-colors hover:bg-white/5">
                    {/* Connector line */}
                    {i < PROCESS_STEPS.length - 1 && (
                      <div className="absolute right-0 top-1/2 hidden h-px w-8 -translate-y-1/2 translate-x-full bg-gradient-to-r from-frost-400/50 to-transparent md:block" />
                    )}
                    <div className="relative">
                      <span className="font-display text-5xl font-extrabold text-white/10 transition-colors group-hover:text-frost-400/30">
                        {step.number}
                      </span>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-frost-500 to-frost-700 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                          <step.icon className="h-6 w-6" />
                        </div>
                      </div>
                    </div>
                    <h3 className="mt-5 font-display text-sm font-bold text-white">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/50">
                      {step.description}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Tech dashboard image */}
        <Reveal delay={100}>
          <div className="mt-12 overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <img
              src={TECH_IMAGE}
              alt="Real-time analytics dashboard"
              className="h-72 w-full object-cover opacity-80 transition-opacity duration-500 hover:opacity-100"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
