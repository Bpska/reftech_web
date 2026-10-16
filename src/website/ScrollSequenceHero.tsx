import { useEffect, useRef, useState } from 'react';

const FRAME_COUNT = 120;
const frameUrl = (index: number, mobile: boolean) => `/hero/${mobile ? 'mobile-frames' : 'frames'}/frame-${String(index + 1).padStart(4, '0')}.webp`;
type IdleWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function ScrollSequenceHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!section || !canvas || !ctx) return;

    const images: Array<HTMLImageElement | undefined> = new Array(FRAME_COUNT);
    const loaded = new Set<number>();
    const requested = new Set<number>();
    const mobile = window.matchMedia('(max-width: 767px)').matches;
    const idleWindow = window as IdleWindow;
    let target = 0;
    let drawn = -1;
    let raf = 0;
    let needsMeasure = true;
    let needsResize = true;
    let idleHandle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const nearestLoaded = (wanted: number) => {
      if (loaded.has(wanted)) return wanted;
      for (let distance = 1; distance < FRAME_COUNT; distance += 1) {
        if (wanted - distance >= 0 && loaded.has(wanted - distance)) return wanted - distance;
        if (wanted + distance < FRAME_COUNT && loaded.has(wanted + distance)) return wanted + distance;
      }
      return -1;
    };

    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawn = -1;
    };

    const draw = () => {
      raf = 0;
      const index = nearestLoaded(target);
      if (index < 0 || index === drawn) return;
      const image = images[index];
      if (!image) return;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const rawX = width / 2 - drawWidth * (mobile ? 0.58 : 0.5);
      const x = Math.min(0, Math.max(width - drawWidth, rawX));
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(image, x, (height - drawHeight) / 2, drawWidth, drawHeight);
      drawn = index;
    };


    const loadFrame = (index: number) => {
      if (disposed || index < 0 || index >= FRAME_COUNT || requested.has(index)) return;
      requested.add(index);
      const image = new Image();
      images[index] = image;
      image.decoding = 'async';
      if (index === 0) image.fetchPriority = 'high';
      image.onload = () => {
        if (!disposed) {
          loaded.add(index);
          scheduleFrame(false);
        }
      };
      image.src = frameUrl(index, mobile);
    };

    const loadNear = (index: number) => {
      loadFrame(index);
      for (let offset = 1; offset <= (mobile ? 5 : 8); offset += 1) {
        loadFrame(index - offset);
        loadFrame(index + offset);
      }
    };

    let cursor = 0;
    const loadBatch = () => {
      if (disposed) return;
      let count = 0;
      while (cursor < FRAME_COUNT && count < (mobile ? 4 : 8)) {
        if (!requested.has(cursor)) {
          loadFrame(cursor);
          count += 1;
        }
        cursor += 1;
      }
      if (cursor >= FRAME_COUNT) return;
      if (idleWindow.requestIdleCallback) idleHandle = idleWindow.requestIdleCallback(loadBatch, { timeout: 900 });
      else timer = setTimeout(loadBatch, mobile ? 220 : 120);
    };

    const updateTarget = () => {
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - innerHeight);
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      target = Math.round(progress * (FRAME_COUNT - 1));
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      loadNear(target);
    };
    const renderFrame = () => {
      raf = 0;
      if (needsResize) {
        needsResize = false;
        sizeCanvas();
      }
      if (needsMeasure) {
        needsMeasure = false;
        updateTarget();
      }
      draw();
    };
    function scheduleFrame(measure = true) {
      needsMeasure ||= measure;
      if (!raf) raf = requestAnimationFrame(renderFrame);
    }
    const refresh = () => {
      needsResize = true;
      scheduleFrame();
    };

    const onScroll = () => scheduleFrame();

    loadNear(0);
    for (let index = 0; index < FRAME_COUNT; index += 12) loadFrame(index);
    scheduleFrame();
    timer = setTimeout(loadBatch, 250);
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', refresh);
    addEventListener('orientationchange', refresh);
    addEventListener('pageshow', refresh);

    return () => {
      disposed = true;
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', refresh);
      removeEventListener('orientationchange', refresh);
      removeEventListener('pageshow', refresh);
      if (raf) cancelAnimationFrame(raf);
      if (idleHandle !== undefined && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
      if (timer) clearTimeout(timer);
      images.forEach((image) => {
        if (image) {
          image.onload = null;
          image.src = '';
        }
      });
    };
  }, [reducedMotion]);

  return (
    <section ref={sectionRef} className="scroll-sequence" aria-label="Connected logistics platform">
      <div className="scroll-sequence__sticky">
        <img className="scroll-sequence__poster" src="/hero/poster.webp" alt="" aria-hidden="true" />
        <canvas ref={canvasRef} className="scroll-sequence__canvas" aria-hidden="true" />
        <div className="scroll-sequence__shade" aria-hidden="true" />
        <div className="scroll-sequence__content">
          <div className="scroll-sequence__copy">
            <p className="scroll-sequence__eyebrow"><span /> Logistics intelligence, in motion</p>
            <h1>Every Shipment.<br /><span>Visible. Predictable.</span></h1>
            <p className="scroll-sequence__lede">IoT-powered cold-chain monitoring, fleet intelligence, and real-time alerts—built for teams that cannot afford blind spots.</p>
            <div className="scroll-sequence__actions">
              <a className="scroll-sequence__primary" href="/login">Start monitoring <span aria-hidden="true">↗</span></a>
              <a className="scroll-sequence__secondary" href="#services">Explore solutions</a>
            </div>
            <ul className="scroll-sequence__signals" aria-label="Platform capabilities">
              <li><strong>24/7</strong><span>Live telemetry</span></li>
              <li><strong>99.9%</strong><span>Platform uptime</span></li>
              <li><strong>&lt;30s</strong><span>Alert response</span></li>
            </ul>
          </div>
        </div>
        <div className="scroll-sequence__hint" aria-hidden="true"><span>Scroll to explore</span><i /></div>
        <div className="scroll-sequence__progress" aria-hidden="true"><span ref={progressRef} /></div>
      </div>
    </section>
  );
}

