import { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, sidebarMaxWidth, clampSidebarWidth } from './sidebarWidth';

export function SidebarResizeHandle({ width, onChange, label }: { width: number; onChange: (width: number) => void; label: string }) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging) return;
    const { cursor, userSelect } = document.body.style;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.body.style.cursor = cursor;
      document.body.style.userSelect = userSelect;
    };
  }, [dragging]);

  const finish = () => { drag.current = null; setDragging(false); };

  return <div className="relative hidden w-0 shrink-0 lg:block">
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-controls="portal-sidebar"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={sidebarMaxWidth()}
      aria-valuenow={width}
      title={`${label} · ← / → · double-click to reset`}
      className="group absolute inset-y-0 -left-1.5 z-20 w-3 touch-none cursor-col-resize outline-none hover:bg-sky-400/25 focus-visible:bg-sky-400/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400"
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width };
        setDragging(true);
      }}
      onPointerMove={event => {
        if (drag.current) onChange(clampSidebarWidth(drag.current.width + event.clientX - drag.current.x));
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      onDoubleClick={() => onChange(clampSidebarWidth(SIDEBAR_DEFAULT_WIDTH))}
      onKeyDown={event => {
        const next = event.key === 'ArrowLeft' ? width - 16 : event.key === 'ArrowRight' ? width + 16
          : event.key === 'Home' ? SIDEBAR_MIN_WIDTH : event.key === 'End' ? sidebarMaxWidth() : null;
        if (next !== null) { event.preventDefault(); onChange(clampSidebarWidth(next)); }
      }}
    >
      <span className={`absolute left-1/2 top-6 flex h-8 w-7 -translate-x-1/2 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${dragging ? 'opacity-100' : 'opacity-60'}`}>
        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  </div>;
}
