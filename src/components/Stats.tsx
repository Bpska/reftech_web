import { Reveal } from '@/components/Reveal';
import { STATS } from '@/data';
import { useEffect, useRef, useState } from 'react';

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1800;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(value * eased);
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      });
    }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  const isDecimal = value % 1 !== 0;

  return (
    <span ref={ref}>
      {isDecimal ? display.toFixed(1) : Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

export function Stats() {
  return (
    <section className="relative -mt-px bg-white py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-5 md:px-10 lg:px-16">
        <Reveal>
          <div className="overflow-hidden rounded-3xl bg-mesh shadow-2xl">
            <div className="grid gap-8 p-10 md:grid-cols-4 md:p-14">
              {STATS.map((stat, i) => (
                <Reveal key={stat.label} delay={i * 80}>
                  <div className="group text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-frost-300 transition-all duration-300 group-hover:scale-110 group-hover:bg-white/15">
                      <stat.icon className="h-7 w-7" />
                    </div>
                    <p className="mt-4 font-display text-4xl font-extrabold text-white md:text-5xl">
                      <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                    </p>
                    <p className="mt-2 text-sm font-medium text-white/60">{stat.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
