/*
 * RefTech Technology Company
 * CONFIDENTIAL: this source code is the property of RefTech Technology Company and is confidential to the
 * company. Copying it, or sharing it with anyone outside the company without written permission, is a
 * violation of law.
 */

// REQ-TRP-002 -- The map behind the Live Tracking page. Two maps, one way to use them.
//
//   Google Maps     used when VITE_GOOGLE_MAPS_API_KEY is set in the portal's .env file
//                   (the key needs "Maps JavaScript API" enabled in the Google Cloud console).
//   OpenStreetMap   used when no key is set -- the normal case on a developer machine. It needs no
//                   key and no account. It is also used when Google refuses the key or cannot be loaded,
//                   so the page never stays empty.
//
// VITE_MAP_PROVIDER=osm forces OpenStreetMap even when a Google key is set.
// VITE_OSM_TILE_URL  replaces the address of the map pictures (default: the public OpenStreetMap server,
//                    which is meant for development and light use).
//
// The OpenStreetMap view is drawn by this file itself (OsmMap below): it places the 256 x 256 map
// pictures ("tiles") next to each other and puts the trucks on top. No map library is downloaded and no
// npm package is added.
//
// Both maps offer the same six calls (LiveMap), so the page does not care which one is on the screen.

export type MapPoint = [number, number];   // latitude, longitude
export type MapMarker = { id: number; lat: number; lng: number; colour: string; label: string; title: string; stale?: boolean; selected?: boolean };
export type MapProvider = 'GOOGLE' | 'OSM';

export interface LiveMap {
  provider: MapProvider;
  /** Replace the trucks on the map. */
  setMarkers(list: MapMarker[]): void;
  /** Draw the route so far of the selected truck; an empty list removes it. */
  setTrail(points: MapPoint[]): void;
  /** Move and zoom so that all the points are visible. */
  fit(points: MapPoint[]): void;
  /** Centre the map on one point, zooming in when the map is far out. */
  focus(lat: number, lng: number): void;
  destroy(): void;
}

export type MapHandlers = {
  /** A truck was clicked. */
  onSelect: (id: number) => void;
  /** Something the user should know, for example that the map pictures could not be loaded. Empty text clears it. */
  onNote: (text: string) => void;
  /** Google refused the key after the map was shown: the page gets the OpenStreetMap view that replaced it. */
  onReplaced: (map: LiveMap, why: string) => void;
};

const GOOGLE_KEY = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const FORCED = String(import.meta.env.VITE_MAP_PROVIDER || '').trim().toLowerCase();
const TILE_URL = String(import.meta.env.VITE_OSM_TILE_URL || '').trim() || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const INDIA: MapPoint = [22.5, 80.0];       // where the map opens before the first truck is known
// Set when Google refused the key. Google says so once per page load, so it is remembered: every later
// visit to the Live Tracking page in this browser tab goes straight to OpenStreetMap.
let googleRefused = '';
const REFUSED_TEXT = 'Google Maps refused the key. Check that "Maps JavaScript API" is enabled for it and that billing is active. OpenStreetMap is shown instead.';

/** Which map the page will try first, and why. Shown on the page. */
export function plannedProvider(): { provider: MapProvider; reason: string } {
  if (FORCED === 'osm' || FORCED === 'openstreetmap') return { provider: 'OSM', reason: 'VITE_MAP_PROVIDER is set to osm' };
  if (GOOGLE_KEY) return { provider: 'GOOGLE', reason: 'VITE_GOOGLE_MAPS_API_KEY is set' };
  return { provider: 'OSM', reason: 'no Google Maps key is set (VITE_GOOGLE_MAPS_API_KEY)' };
}

/**
 * Opens the map inside `el`. Google Maps when a key is set, OpenStreetMap otherwise or when Google cannot
 * be used. `note` says in plain words why OpenStreetMap was chosen although a key is set (empty otherwise).
 */
export async function openMap(el: HTMLElement, handlers: MapHandlers): Promise<{ map: LiveMap; note: string }> {
  if (plannedProvider().provider === 'GOOGLE') {
    if (googleRefused) return { map: new OsmMap(el, handlers), note: googleRefused };
    try {
      const google = await loadGoogle(GOOGLE_KEY);
      if (googleRefused) return { map: new OsmMap(el, handlers), note: googleRefused };
      const map = new GoogleMap(el, google, handlers);
      // Google reports a wrong key, a key without the Maps JavaScript API, or missing billing through this hook,
      // after the map is already on the screen. The page then switches to OpenStreetMap.
      const refused = () => {
        googleRefused = REFUSED_TEXT;
        if (map.gone) return;      // the page was left in the meantime; the next visit opens OpenStreetMap
        map.destroy();
        handlers.onReplaced(new OsmMap(el, handlers), googleRefused);
      };
      (window as any).gm_authFailure = refused;
      map.onDestroy = () => { if ((window as any).gm_authFailure === refused) (window as any).gm_authFailure = () => { googleRefused = REFUSED_TEXT; }; };
      return { map, note: '' };
    } catch (x) {
      return { map: new OsmMap(el, handlers), note: `Google Maps could not be loaded (${x instanceof Error ? x.message : 'unknown reason'}). OpenStreetMap is shown instead.` };
    }
  }
  return { map: new OsmMap(el, handlers), note: '' };
}

// =====================================================================================================
// Google Maps
// =====================================================================================================

let googleLoading: Promise<any> | null = null;

/** Adds Google's script to the page once and resolves with window.google when it is ready. */
function loadGoogle(key: string): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.Map) return Promise.resolve(w.google);
  if (googleLoading) return googleLoading;
  googleLoading = new Promise<any>((resolve, reject) => {
    const fail = (why: string) => { googleLoading = null; reject(new Error(why)); };
    const timer = window.setTimeout(() => fail('no answer from Google in 12 seconds'), 12000);
    w.__reftechGoogleMapsReady = () => { window.clearTimeout(timer); if (w.google?.maps?.Map) resolve(w.google); else fail('the script loaded without the map'); };
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&region=IN&callback=__reftechGoogleMapsReady`;
    s.async = true;
    s.onerror = () => { window.clearTimeout(timer); s.remove(); fail('the script could not be downloaded'); };
    document.head.appendChild(s);
  });
  return googleLoading;
}

/** A round truck marker as a small picture, for Google's marker. */
function dotIcon(colour: string, selected: boolean, stale: boolean) {
  const size = selected ? 38 : 30, r = size / 2 - 3;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="${colour}" fill-opacity="${stale ? 0.55 : 1}" stroke="${selected ? '#0f172a' : '#ffffff'}" stroke-width="3"${stale ? ' stroke-dasharray="4 3"' : ''}/>` +
    `<circle cx="${size / 2}" cy="${size / 2}" r="${r / 2.6}" fill="#ffffff"/></svg>`;
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size };
}

class GoogleMap implements LiveMap {
  provider: MapProvider = 'GOOGLE';
  private g: any;
  private map: any;
  private markers = new Map<number, any>();
  private trail: any = null;
  private handlers: MapHandlers;
  private holder: HTMLDivElement;      // this map's own element inside the page's box; destroy() removes it and nothing else
  gone = false;
  onDestroy: () => void = () => {};

  constructor(el: HTMLElement, google: any, handlers: MapHandlers) {
    this.g = google.maps; this.handlers = handlers;
    this.holder = document.createElement('div');
    this.holder.setAttribute('data-map', 'google');
    this.holder.style.cssText = 'position:absolute;inset:0';
    el.appendChild(this.holder);
    this.map = new this.g.Map(this.holder, { center: { lat: INDIA[0], lng: INDIA[1] }, zoom: 5, mapTypeControl: false, streetViewControl: false, fullscreenControl: true, gestureHandling: 'greedy' });
  }

  setMarkers(list: MapMarker[]) {
    const keep = new Set(list.map(m => m.id));
    this.markers.forEach((marker, id) => { if (!keep.has(id)) { marker.setMap(null); this.markers.delete(id); } });
    for (const m of list) {
      const icon = dotIcon(m.colour, !!m.selected, !!m.stale);
      const options = {
        position: { lat: m.lat, lng: m.lng }, title: m.title, zIndex: m.selected ? 1000 : 1,
        icon: { url: icon.url, scaledSize: new this.g.Size(icon.size, icon.size), anchor: new this.g.Point(icon.size / 2, icon.size / 2), labelOrigin: new this.g.Point(icon.size / 2, icon.size + 9) },
        label: { text: m.label, fontSize: '11px', fontWeight: '700', color: '#0f172a' },
      };
      let marker = this.markers.get(m.id);
      if (marker) marker.setOptions(options);
      else {
        marker = new this.g.Marker({ ...options, map: this.map });
        marker.addListener('click', () => this.handlers.onSelect(m.id));
        this.markers.set(m.id, marker);
      }
    }
  }

  setTrail(points: MapPoint[]) {
    if (this.trail) { this.trail.setMap(null); this.trail = null; }
    if (points.length < 2) return;
    this.trail = new this.g.Polyline({ path: points.map(p => ({ lat: p[0], lng: p[1] })), map: this.map, strokeColor: '#0369a1', strokeOpacity: 0.9, strokeWeight: 4 });
  }

  fit(points: MapPoint[]) {
    if (points.length === 0) return;
    if (points.length === 1) { this.map.setCenter({ lat: points[0][0], lng: points[0][1] }); this.map.setZoom(11); return; }
    const bounds = new this.g.LatLngBounds();
    points.forEach(p => bounds.extend({ lat: p[0], lng: p[1] }));
    this.map.fitBounds(bounds, 60);
  }

  focus(lat: number, lng: number) {
    this.map.panTo({ lat, lng });
    if ((this.map.getZoom?.() ?? 0) < 9) this.map.setZoom(10);
  }

  destroy() {
    if (this.gone) return;
    this.gone = true;
    this.markers.forEach(m => m.setMap(null));
    this.markers.clear();
    if (this.trail) this.trail.setMap(null);
    this.holder.remove();
    this.onDestroy();
  }
}

// =====================================================================================================
// OpenStreetMap, drawn here
// =====================================================================================================

const TILE = 256, MIN_ZOOM = 3, MAX_ZOOM = 18;
/** A place on the earth as a pixel of the flat world map at a zoom level (the usual "Web Mercator" picture). */
function project(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom, clamped = Math.max(-85.05, Math.min(85.05, lat)), rad = (clamped * Math.PI) / 180;
  return { x: ((lng + 180) / 360) * size, y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size };
}
/** The reverse of project(). */
function unproject(x: number, y: number, zoom: number): MapPoint {
  const size = TILE * 2 ** zoom, n = Math.PI - (2 * Math.PI * y) / size;
  return [(180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))), (x / size) * 360 - 180];
}

class OsmMap implements LiveMap {
  provider: MapProvider = 'OSM';
  private root: HTMLDivElement;        // this map's own element inside the page's box; destroy() removes it and nothing else
  private tiles: HTMLDivElement;
  private line: SVGSVGElement;
  private pins: HTMLDivElement;
  private centre: MapPoint = INDIA;
  private zoom = 5;
  private markers: MapMarker[] = [];
  private trail: MapPoint[] = [];
  private shown = new Map<string, HTMLImageElement>();
  private handlers: MapHandlers;
  private drag: { x: number; y: number; moved: boolean } | null = null;
  private loaded = 0;
  private failed = 0;
  private observer: ResizeObserver | null = null;
  private wheelAt = 0;

  constructor(el: HTMLElement, handlers: MapHandlers) {
    this.handlers = handlers;
    const root = document.createElement('div');
    root.setAttribute('data-map', 'osm');
    root.style.cssText = 'position:absolute;inset:0;overflow:hidden;background:#e2e8f0;touch-action:none;cursor:grab;user-select:none';
    this.tiles = document.createElement('div'); this.tiles.style.cssText = 'position:absolute;inset:0';
    this.line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.line.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none');
    this.pins = document.createElement('div'); this.pins.style.cssText = 'position:absolute;inset:0;pointer-events:none';

    // zoom buttons
    const zoomBox = document.createElement('div');
    zoomBox.style.cssText = 'position:absolute;left:12px;top:12px;display:flex;flex-direction:column;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(15,23,42,.35)';
    for (const [text, step, name] of [['+', 1, 'Zoom in'], ['−', -1, 'Zoom out']] as [string, number, string][]) {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = text; b.title = name; b.setAttribute('aria-label', name);
      b.style.cssText = 'width:34px;height:34px;background:#fff;border:0;border-bottom:1px solid #e2e8f0;font:700 20px/1 system-ui;color:#0f172a;cursor:pointer';
      b.addEventListener('click', e => { e.stopPropagation(); this.zoomBy(step); });
      b.addEventListener('dblclick', e => e.stopPropagation());      // two quick clicks are two steps, not three
      b.addEventListener('pointerdown', e => e.stopPropagation());
      zoomBox.appendChild(b);
    }
    // the credit OpenStreetMap asks for
    const credit = document.createElement('div');
    credit.style.cssText = 'position:absolute;right:0;bottom:0;background:rgba(255,255,255,.85);padding:2px 6px;font:11px system-ui;color:#334155';
    credit.innerHTML = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style="color:#0369a1">OpenStreetMap</a> contributors';
    credit.addEventListener('pointerdown', e => e.stopPropagation());

    root.append(this.tiles, this.line, this.pins, zoomBox, credit);
    el.appendChild(root);
    this.root = root;

    root.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; root.setPointerCapture?.(e.pointerId); root.style.cursor = 'grabbing'; });
    root.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (!this.drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      this.drag = { x: e.clientX, y: e.clientY, moved: true };
      const c = project(this.centre[0], this.centre[1], this.zoom);
      this.centre = unproject(c.x - dx, c.y - dy, this.zoom);
      this.draw();
    });
    const end = () => { this.drag = null; root.style.cursor = 'grab'; };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('wheel', e => {
      e.preventDefault();
      const now = Date.now();
      if (now - this.wheelAt < 120) return;   // one step per notch, not ten
      this.wheelAt = now;
      const r = root.getBoundingClientRect();
      this.zoomBy(e.deltaY < 0 ? 1 : -1, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
    root.addEventListener('dblclick', e => { const r = root.getBoundingClientRect(); this.zoomBy(1, e.clientX - r.left, e.clientY - r.top); });

    if (typeof ResizeObserver !== 'undefined') { this.observer = new ResizeObserver(() => this.draw()); this.observer.observe(root); }
    this.draw();
  }

  private size() { return { w: this.root.clientWidth || 800, h: this.root.clientHeight || 500 }; }

  /** Zoom one step, keeping the point under the mouse (or the centre) where it is. */
  private zoomBy(step: number, atX?: number, atY?: number) {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom + step));
    if (next === this.zoom) return;
    const { w, h } = this.size(), px = atX ?? w / 2, py = atY ?? h / 2;
    const c = project(this.centre[0], this.centre[1], this.zoom);
    const under = unproject(c.x - w / 2 + px, c.y - h / 2 + py, this.zoom);   // the place under the mouse
    const u = project(under[0], under[1], next);
    this.zoom = next;
    this.centre = unproject(u.x - px + w / 2, u.y - py + h / 2, next);
    this.draw();
  }

  private draw() {
    const { w, h } = this.size(), z = this.zoom, count = 2 ** z;
    const c = project(this.centre[0], this.centre[1], z);
    const left = c.x - w / 2, top = c.y - h / 2;

    // ---- map pictures
    const wanted = new Set<string>();
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h) / TILE); ty++) {
        if (ty < 0 || ty >= count) continue;
        const key = `${z}/${tx}/${ty}`;
        wanted.add(key);
        let img = this.shown.get(key);
        if (!img) {
          img = document.createElement('img');
          img.alt = ''; img.draggable = false; img.width = TILE; img.height = TILE;
          img.style.cssText = 'position:absolute;width:256px;height:256px;max-width:none';
          img.onload = () => { this.loaded++; if (this.failed > 0) this.handlers.onNote(''); };
          img.onerror = () => {
            img!.style.visibility = 'hidden'; this.failed++;
            if (this.loaded === 0 && this.failed === 3) this.handlers.onNote('The map background could not be loaded (no internet connection, or the map server is blocked). The trucks are still shown at their positions.');
          };
          const wrapped = ((tx % count) + count) % count;
          img.src = TILE_URL.replace('{z}', String(z)).replace('{x}', String(wrapped)).replace('{y}', String(ty));
          this.tiles.appendChild(img);
          this.shown.set(key, img);
        }
        img.style.left = `${Math.round(tx * TILE - left)}px`;
        img.style.top = `${Math.round(ty * TILE - top)}px`;
      }
    }
    this.shown.forEach((img, key) => { if (!wanted.has(key)) { img.onload = null; img.onerror = null; img.remove(); this.shown.delete(key); } });

    // ---- route so far
    while (this.line.firstChild) this.line.removeChild(this.line.firstChild);
    if (this.trail.length > 1) {
      const points = this.trail.map(p => { const q = project(p[0], p[1], z); return `${(q.x - left).toFixed(1)},${(q.y - top).toFixed(1)}`; }).join(' ');
      for (const [colour, width] of [['#ffffff', 7], ['#0369a1', 4]] as [string, number][]) {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        l.setAttribute('points', points); l.setAttribute('fill', 'none'); l.setAttribute('stroke', colour); l.setAttribute('stroke-width', String(width));
        l.setAttribute('stroke-linecap', 'round'); l.setAttribute('stroke-linejoin', 'round'); l.setAttribute('data-trail', colour === '#ffffff' ? 'edge' : 'line');
        this.line.appendChild(l);
      }
      const s = project(this.trail[0][0], this.trail[0][1], z);
      const start = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      start.setAttribute('cx', String(s.x - left)); start.setAttribute('cy', String(s.y - top)); start.setAttribute('r', '5');
      start.setAttribute('fill', '#ffffff'); start.setAttribute('stroke', '#0369a1'); start.setAttribute('stroke-width', '3');
      this.line.appendChild(start);
    }

    // ---- trucks
    this.pins.innerHTML = '';
    const ordered = [...this.markers].sort((a, b) => Number(!!a.selected) - Number(!!b.selected));   // the selected truck on top
    for (const m of ordered) {
      const p = project(m.lat, m.lng, z), x = p.x - left, y = p.y - top;
      if (x < -40 || y < -40 || x > w + 40 || y > h + 40) continue;
      const size = m.selected ? 34 : 26;
      const pin = document.createElement('button');
      pin.type = 'button'; pin.title = m.title; pin.setAttribute('aria-label', m.title);
      pin.setAttribute('data-truck', String(m.id)); pin.setAttribute('data-colour', m.colour);
      pin.style.cssText = `position:absolute;left:${x}px;top:${y}px;pointer-events:auto;background:none;border:0;padding:0;cursor:pointer;display:flex;flex-direction:column;align-items:center`;
      const dot = document.createElement('span');
      dot.style.cssText = `display:block;width:${size}px;height:${size}px;border-radius:50%;background:${m.colour};opacity:${m.stale ? 0.6 : 1};` +
        `border:3px ${m.stale ? 'dashed' : 'solid'} ${m.selected ? '#0f172a' : '#ffffff'};box-shadow:0 1px 5px rgba(15,23,42,.55);box-sizing:border-box`;
      const text = document.createElement('span');
      text.textContent = m.label;
      text.style.cssText = `margin-top:2px;padding:0 5px;border-radius:6px;background:${m.selected ? '#0f172a' : 'rgba(255,255,255,.92)'};color:${m.selected ? '#fff' : '#0f172a'};font:700 11px/16px system-ui;white-space:nowrap;box-shadow:0 1px 2px rgba(15,23,42,.3)`;
      // the dot sits exactly on the position; the name hangs below it
      pin.style.transform = `translate(-50%, -${size / 2}px)`;
      pin.append(dot, text);
      pin.addEventListener('pointerdown', e => e.stopPropagation());
      pin.addEventListener('click', e => { e.stopPropagation(); this.handlers.onSelect(m.id); });
      this.pins.appendChild(pin);
    }
  }

  setMarkers(list: MapMarker[]) { this.markers = list; this.draw(); }
  setTrail(points: MapPoint[]) { this.trail = points; this.draw(); }

  fit(points: MapPoint[]) {
    if (points.length === 0) return;
    const lats = points.map(p => p[0]), lngs = points.map(p => p[1]);
    const north = Math.max(...lats), south = Math.min(...lats), east = Math.max(...lngs), west = Math.min(...lngs);
    const { w, h } = this.size(), pad = 70;
    let zoom = points.length === 1 ? 11 : MAX_ZOOM;
    if (points.length > 1) {
      for (; zoom > MIN_ZOOM; zoom--) {
        const a = project(north, west, zoom), b = project(south, east, zoom);
        if (b.x - a.x <= w - 2 * pad && b.y - a.y <= h - 2 * pad) break;
      }
      zoom = Math.min(zoom, 14);
    }
    const a = project(north, west, zoom), b = project(south, east, zoom);
    this.zoom = zoom;
    this.centre = unproject((a.x + b.x) / 2, (a.y + b.y) / 2, zoom);
    this.draw();
  }

  focus(lat: number, lng: number) {
    this.centre = [lat, lng];
    if (this.zoom < 9) this.zoom = 10;
    this.draw();
  }

  destroy() {
    this.observer?.disconnect();
    this.shown.forEach(img => { img.onload = null; img.onerror = null; });
    this.shown.clear();
    this.root.remove();
  }
}
