/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */
// REQ-TRK-004, REQ-TRK-006 -- a map with one route and markers, used by Route Playback and the customer's tracking
// page. Google Maps or OpenStreetMap as on Live Tracking (shared/services/liveMap).
import { useEffect, useRef, useState } from 'react';
import { LiveMap, MapMarker, MapPoint, openMap } from '@/shared/services/liveMap';

export function RouteMap({ route, markers, fitKey, className, onSelect }: {
  route: MapPoint[]; markers: MapMarker[]; fitKey?: string | number; className?: string; onSelect?: (id: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null), map = useRef<LiveMap | null>(null);
  const [ready, setReady] = useState(0), [note, setNote] = useState('');
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    if (!box.current) return;
    let gone = false;
    openMap(box.current, {
      onSelect: (id: number) => select.current?.(id),
      onNote: (text: string) => setNote(text),
      onReplaced: (next: LiveMap, why: string) => { map.current = next; setNote(why); setReady(n => n + 1); },
    }).then(r => {
      if (gone) { r.map.destroy(); return; }
      map.current = r.map; setNote(r.note); setReady(n => n + 1);
    });
    return () => { gone = true; map.current?.destroy(); map.current = null; };
  }, []);

  useEffect(() => { map.current?.setTrail(route); }, [route, ready]);
  useEffect(() => { map.current?.setMarkers(markers); }, [markers, ready]);
  useEffect(() => {
    const pts = route.length > 0 ? route : markers.map(m => [m.lat, m.lng] as MapPoint);
    if (pts.length > 0) map.current?.fit(pts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, ready]);

  return <div>
    <div ref={box} className={className || 'h-[55vh] min-h-[360px] w-full rounded-2xl bg-slate-100'} />
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
  </div>;
}
