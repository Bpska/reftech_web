/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-003 -- A box the receiver signs in, with a finger, a pen or the mouse.
//
// The signature is drawn on a <canvas>. When the receiver lifts the finger, the picture is handed to the
// parent as a PNG file (white background, dark ink), ready to be sent with the proof of delivery.
// "Clear" empties the box and tells the parent that there is no signature (null).
import { PointerEvent, useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

const WIDTH = 560, HEIGHT = 180;   // size of the drawing in its own pixels; on the screen it follows the column width

export function SignaturePad({ onChange, disabled }: { onChange: (file: File | null) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [signed, setSigned] = useState(false);

  function blank() {
    const c = canvas.current, g = c?.getContext('2d');
    if (!c || !g) return;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#0f172a'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
  }
  useEffect(() => { blank(); }, []);

  /** Where the pointer is, in the canvas's own pixels (the canvas is scaled to the column width). */
  function point(e: PointerEvent<HTMLCanvasElement>) {
    const c = canvas.current!, r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }

  function down(e: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    canvas.current?.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const p = point(e);
    last.current = p;
    const g = canvas.current?.getContext('2d');
    if (g) { g.beginPath(); g.arc(p.x, p.y, 1.2, 0, Math.PI * 2); g.fillStyle = '#0f172a'; g.fill(); }   // a tap leaves a dot
  }

  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || disabled) return;
    e.preventDefault();
    const g = canvas.current?.getContext('2d'), from = last.current, to = point(e);
    if (!g || !from) return;
    g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(to.x, to.y); g.stroke();
    last.current = to;
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    setSigned(true);
    canvas.current?.toBlob(b => { if (b) onChange(new File([b], 'signature.png', { type: 'image/png' })); }, 'image/png');
  }

  function clear() {
    blank(); setSigned(false); onChange(null);
  }

  return <div>
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} data-testid="signature-pad" role="img" aria-label="Signature box. Sign here with a finger, a pen or the mouse."
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} onPointerCancel={up}
      className={`block w-full max-w-[560px] touch-none rounded-xl border-2 border-dashed bg-white ${signed ? 'border-emerald-400' : 'border-slate-300'} ${disabled ? 'opacity-60' : 'cursor-crosshair'}`} />
    <div className="mt-1 flex items-center justify-between gap-3 text-xs text-slate-600" style={{ maxWidth: WIDTH }}>
      <span>{signed ? 'Signature recorded.' : 'The receiver signs here with a finger, a pen or the mouse.'}</span>
      {signed && <button type="button" onClick={clear} disabled={disabled} className="inline-flex items-center gap-1 font-bold text-sky-700 hover:underline"><Eraser className="h-3.5 w-3.5" />Clear</button>}
    </div>
  </div>;
}
