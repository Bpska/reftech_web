/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { Reveal } from '@/website/Reveal';
import { VISION_IMAGE, MISSION_IMAGE } from '@/website/data';
import { Eye, Target } from 'lucide-react';

export function VisionMission() {
  return (
    <section className="section-pad bg-frost-50/60">
      <div className="mx-auto max-w-7xl space-y-20">
        {/* Vision */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div className="relative overflow-hidden rounded-3xl shadow-2xl group">
              <img
                src={VISION_IMAGE}
                alt="Trucks on highway at sunset"
                className="h-[400px] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-frost-950/60 to-transparent" />
              <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 backdrop-blur-sm shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-frost-600">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <span className="font-display text-sm font-bold text-deep-900">Our Vision</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div>
              <span className="heading-eyebrow">
                <span className="h-px w-8 bg-frost-400" />
                Our Vision
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl">
                Driving Innovation in{' '}
                <span className="gradient-text">Cold Chain Logistics</span>
              </h2>
              <p className="mt-6 text-base leading-relaxed text-deep-600">
                At REFTECH SCS 5PL PRIVATE LIMITED, our vision is to transform the cold chain
                logistics industry through innovation, reliability, and sustainability. We aim to
                set new standards in 5PL solutions by leveraging advanced technologies and
                delivering exceptional value to our customers.
              </p>
              <p className="mt-4 text-base leading-relaxed text-deep-600">
                By creating efficient and future-ready supply chains, we aspire to lead the way in
                temperature-sensitive logistics worldwide.
              </p>
            </div>
          </Reveal>
        </div>

        {/* Mission - reversed */}
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="lg:order-2">
            <div className="relative overflow-hidden rounded-3xl shadow-2xl group">
              <img
                src={MISSION_IMAGE}
                alt="Warehouse logistics operations"
                className="h-[400px] w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-frost-950/60 to-transparent" />
              <div className="absolute bottom-6 left-6 flex items-center gap-3 rounded-xl bg-white/95 px-4 py-3 backdrop-blur-sm shadow-lg">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <span className="font-display text-sm font-bold text-deep-900">Our Mission</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={100} className="lg:order-1">
            <div>
              <span className="heading-eyebrow">
                <span className="h-px w-8 bg-accent-400" />
                Our Mission
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-deep-900 text-balance md:text-4xl">
                Committed to Excellence in{' '}
                <span className="gradient-text-warm">Reefer Logistics</span>
              </h2>
              <p className="mt-6 text-base leading-relaxed text-deep-600">
                At REFTECH SCS 5PL PRIVATE LIMITED, our mission is to provide innovative,
                efficient, and reliable 5PL logistics solutions for temperature-sensitive goods.
                We are dedicated to delivering exceptional service by leveraging advanced
                technology, optimizing supply chain processes, and ensuring the highest standards
                of quality and sustainability.
              </p>
              <p className="mt-4 text-base leading-relaxed text-deep-600">
                Our goal is to empower businesses with seamless logistics that drive growth and
                success.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
