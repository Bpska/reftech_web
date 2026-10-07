/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Reveal } from '@/website/Reveal';
import { TESTIMONIALS } from '@/website/data';
import { Quote, Star } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

export function Testimonials() {
  const [active, setActive] = useState(0);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="section-pad bg-white">
      <div className="mx-auto max-w-5xl">
        <Reveal className="text-center">
          <span className="heading-eyebrow justify-center">
            <span className="h-px w-8 bg-frost-400" />
            Testimonials
            <span className="h-px w-8 bg-frost-400" />
          </span>
          <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl lg:text-5xl">
            Trusted by Industry{' '}
            <span className="gradient-text">Leaders</span>
          </h2>
        </Reveal>

        <Reveal delay={100}>
          <div className="mt-12 relative">
            {/* Quote icon */}
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex h-12 w-12 items-center justify-center rounded-full bg-frost-600 shadow-lg">
              <Quote className="h-6 w-6 text-white" />
            </div>

            <div className="overflow-hidden rounded-3xl border border-frost-100 bg-frost-50/50 p-8 md:p-14">
              <div className="relative min-h-[240px]">
                {TESTIMONIALS.map((testimonial, i) => (
                  <div
                    key={i}
                    className={`absolute inset-0 transition-all duration-700 ${
                      i === active
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-8 pointer-events-none'
                    }`}
                  >
                    <div className="flex justify-center gap-1 mb-6">
                      {Array.from({ length: testimonial.rating }).map((_, idx) => (
                        <Star
                          key={idx}
                          className="h-5 w-5 fill-accent-400 text-accent-400"
                        />
                      ))}
                    </div>
                    <p className="text-center text-lg font-medium leading-relaxed text-deep-700 md:text-xl">
                      "{testimonial.quote}"
                    </p>
                    <div className="mt-8 text-center">
                      <p className="font-display text-base font-bold text-deep-900">
                        {testimonial.author}
                      </p>
                      <p className="mt-1 text-sm text-frost-600">{testimonial.role}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Dots */}
              <div className="mt-8 flex justify-center gap-2">
                {TESTIMONIALS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === active
                        ? 'w-8 bg-frost-600'
                        : 'w-2 bg-frost-200 hover:bg-frost-300'
                    }`}
                    aria-label={`Go to testimonial ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
