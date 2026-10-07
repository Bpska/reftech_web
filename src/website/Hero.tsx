/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

import { useEffect, useState } from 'react';
import { ArrowRight, Play, ThermometerSun, Truck, ShieldCheck } from 'lucide-react';
import { HERO_IMAGE, HERO_IMAGE_2 } from '@/website/data';

const VIDEO_URL = '/media/reftech_video.mp4';
const SLIDE_MS = 7000;

export function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % 3);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section id="home" className="relative min-h-screen overflow-hidden bg-white">
      {/* Media carousel: video -> truck photo -> warehouse photo, one at a time */}
      <div className="absolute inset-0 bg-frost-950">
        <video
          autoPlay
          muted
          loop
          playsInline
          poster={HERO_IMAGE}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${activeSlide === 0 ? 'opacity-100' : 'opacity-0'}`}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        <img
          src={HERO_IMAGE}
          alt="RefTech refrigerated truck on the highway"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${activeSlide === 1 ? 'opacity-100' : 'opacity-0'}`}
        />
        <img
          src={HERO_IMAGE_2}
          alt="RefTech cold-chain warehouse and refrigerated fleet"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${activeSlide === 2 ? 'opacity-100' : 'opacity-0'}`}
        />

        <div className="absolute inset-0 bg-gradient-to-r from-frost-950/90 via-frost-950/45 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-frost-950/70 via-transparent to-frost-950/20" />
      </div>

      {/* Floating decorative elements */}
      <div className="absolute left-6 top-1/4 z-10 hidden lg:block">
        <div className="animate-float rounded-2xl border border-white/20 bg-frost-950/45 p-5 shadow-lg backdrop-blur-md" style={{ animationDelay: '0s' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-frost-500/15">
              <ThermometerSun className="h-5 w-5 text-frost-600" />
            </div>
            <div>
              <p className="text-xs text-deep-400">Temperature</p>
              <p className="text-sm font-semibold text-deep-900">-18°C to +8°C</p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute right-6 top-[12%] z-10 hidden lg:block">
        <div className="animate-float rounded-2xl border border-white/20 bg-frost-950/45 p-5 shadow-lg backdrop-blur-md" style={{ animationDelay: '1.5s' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/15">
              <Truck className="h-5 w-5 text-accent-600" />
            </div>
            <div>
              <p className="text-xs text-deep-400">Fleet Status</p>
              <p className="text-sm font-semibold text-deep-900">Reefer Fleet</p>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-36 left-12 z-10 hidden xl:block">
        <div className="animate-float rounded-2xl border border-white/20 bg-frost-950/45 p-5 shadow-lg backdrop-blur-md" style={{ animationDelay: '0.8s' }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/15">
              <ShieldCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-deep-400">On-Time Rate</p>
              <p className="text-sm font-semibold text-deep-900">99.8%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-20 mx-auto flex min-h-screen max-w-7xl flex-col justify-center px-5 pt-28 md:px-10">
        <div className="max-w-2xl">
          <div className="animate-fade-up flex items-center gap-3 rounded-full border border-white/20 bg-frost-950/45 px-4 py-2 shadow-sm backdrop-blur-sm w-fit">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-frost-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-frost-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-frost-200">
              C&F · Cold Chain · 5PL Cold Chain Logistics
            </span>
          </div>

          <h1
            className="mt-7 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white text-balance animate-fade-up sm:text-5xl md:text-6xl lg:text-7xl"
            style={{ animationDelay: '0.1s' }}
          >
            Revolutionizing{' '}
            <span className="bg-gradient-to-r from-frost-500 to-frost-700 bg-clip-text text-transparent">
              Cold Chain
            </span>{' '}
            Logistics with 5PL Solutions
          </h1>

          <p
            className="mt-6 max-w-xl text-base leading-relaxed text-white/85 animate-fade-up md:text-lg"
            style={{ animationDelay: '0.2s' }}
          >
            We bring cutting-edge technology to the forefront of refrigerated supply chain
            management. Our 5PL solutions ensure safe and efficient delivery of
            temperature-sensitive goods.
          </p>

          <div
            className="mt-9 flex flex-col gap-4 sm:flex-row animate-fade-up"
            style={{ animationDelay: '0.3s' }}
          >
            <a href="#services" className="btn-primary group">
              Explore Services
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-frost-300 bg-white/80 px-7 py-3.5 text-sm font-semibold text-frost-700 backdrop-blur-sm transition-all duration-300 hover:border-frost-500 hover:bg-white hover:-translate-y-0.5"
            >
              <Play className="h-4 w-4 fill-frost-600 text-frost-600" />
              Our Story
            </a>
          </div>

          {/* Trust indicators */}
          <div
            className="mt-14 grid max-w-lg grid-cols-3 gap-6 animate-fade-up"
            style={{ animationDelay: '0.4s' }}
          >
            {[
              { value: '99.8%', label: 'On-Time Delivery' },
              { value: '500+', label: 'Shipments / Month' },
              { value: '24/7', label: 'Live Monitoring' },
            ].map((stat) => (
              <div key={stat.label} className="border-l-2 border-frost-400 pl-4">
                <p className="font-display text-2xl font-bold text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs text-white/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Media indicators — Video, Truck, Warehouse */}
      <div className="absolute bottom-28 left-1/2 z-30 flex -translate-x-1/2 gap-2" aria-label="Hero media slides">
        {['Video', 'Truck', 'Warehouse'].map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => setActiveSlide(index)}
            aria-label={`Show ${label}`}
            className={`h-2.5 rounded-full border border-white/70 transition-all duration-300 ${activeSlide === index ? 'w-9 bg-white' : 'w-2.5 bg-white/35 hover:bg-white/70'}`}
          />
        ))}
      </div>

      {/* Bottom wave */}
      <div className="absolute bottom-0 left-0 right-0 z-20">
        <svg viewBox="0 0 1440 120" fill="none" className="w-full">
          <path d="M0 120V60C240 100 480 120 720 90C960 60 1200 40 1440 60V120H0Z" fill="white" />
        </svg>
      </div>
    </section>
  );
}
