import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GeoJSONSource, LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { sampleJourney, type RouteCoordinate } from './sampleJourney';
import { sampleFleetRoutes } from './sampleFleetRoutes';

setWorkerUrl(workerUrl);

const DAY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const NIGHT_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const ANIMATION_MS = 18000;

const haversine = (a: RouteCoordinate, b: RouteCoordinate) => {
  const toRad = Math.PI / 180;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const cumulativeDistances = sampleJourney.route.reduce<number[]>((all, point, index) => {
  all.push(index === 0 ? 0 : all[index - 1] + haversine(sampleJourney.route[index - 1], point));
  return all;
}, []);

const totalDistance = cumulativeDistances[cumulativeDistances.length - 1];

const positionAt = (progress: number) => {
  const wanted = totalDistance * Math.min(1, Math.max(0, progress));
  let end = cumulativeDistances.findIndex((distance) => distance >= wanted);
  if (end <= 0) return { coordinate: sampleJourney.route[0], endIndex: 1 };
  if (end < 0) end = sampleJourney.route.length - 1;
  const start = end - 1;
  const span = cumulativeDistances[end] - cumulativeDistances[start] || 1;
  const amount = (wanted - cumulativeDistances[start]) / span;
  const a = sampleJourney.route[start];
  const b = sampleJourney.route[end];
  return {
    coordinate: [a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount] as RouteCoordinate,
    endIndex: end,
  };
};

const nearestRouteProgress = (coordinate: RouteCoordinate) => {
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  sampleJourney.route.forEach((point, index) => {
    const distance = haversine(point, coordinate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return cumulativeDistances[bestIndex] / totalDistance;
};

const stopProgress = sampleJourney.stops.map((stop) => nearestRouteProgress(stop.coordinate));

const fleetPosition = (route: RouteCoordinate[], progress: number) => {
  const exact = Math.min(route.length - 1, Math.max(0, progress * (route.length - 1)));
  const start = Math.floor(exact);
  const end = Math.min(route.length - 1, start + 1);
  const amount = exact - start;
  return [route[start][0] + (route[end][0] - route[start][0]) * amount, route[start][1] + (route[end][1] - route[start][1]) * amount] as RouteCoordinate;
};

const routeFeature = (coordinates: RouteCoordinate[]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'LineString' as const, coordinates },
});

export function LogisticsRouteMap() {
  const sectionRef = useRef<HTMLElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const truckMarkerRef = useRef<Marker | null>(null);
  const fleetMarkersRef = useRef<Marker[]>([]);
  const stopElementsRef = useRef<HTMLElement[]>([]);
  const progressRef = useRef(0);
  const playingRef = useRef(false);
  const visibleRef = useRef(false);
  const reducedRef = useRef(false);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);
  const lastUiStepRef = useRef(-1);
  const [playing, setPlaying] = useState(false);
  const [night, setNight] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedStop, setSelectedStop] = useState<number | null>(null);
  const [selectedFleet, setSelectedFleet] = useState(0);

  const bounds = useMemo(() => {
    const next = new LngLatBounds();
    sampleJourney.route.forEach((point) => next.extend(point));
    sampleFleetRoutes.forEach((fleet) => fleet.route.forEach((point) => next.extend(point)));
    return next;
  }, []);

  const selectedFleetRoute = sampleFleetRoutes[selectedFleet];
  const completedCount = stopProgress.filter((value) => progress >= value).length;
  const currentStop = sampleJourney.stops[Math.min(completedCount, sampleJourney.stops.length - 1)];
  const displayStop = selectedStop === null ? currentStop : sampleJourney.stops[selectedStop];
  const remainingMinutes = Math.max(0, Math.round((1 - progress) * sampleJourney.totalMinutes));
  const remainingTime = remainingMinutes >= 60 ? Math.ceil(remainingMinutes / 60) + ' hr' : remainingMinutes + ' min';

  const focusStop = useCallback((index: number) => {
    setSelectedStop(index);
    stopElementsRef.current.forEach((element, markerIndex) => element.classList.toggle('is-selected', markerIndex === index));
    mapRef.current?.flyTo({
      center: sampleJourney.stops[index].coordinate,
      zoom: window.innerWidth < 768 ? 6.2 : 7.2,
      duration: reducedRef.current ? 0 : 750,
    });
  }, []);

  const fitRoute = useCallback(() => {
    mapRef.current?.fitBounds(bounds, {
      padding: window.innerWidth < 768 ? 42 : 68,
      duration: reducedRef.current ? 0 : 700,
      maxZoom: 13,
    });
  }, [bounds]);

  const updateMap = useCallback((nextProgress: number) => {
    const map = mapRef.current;
    if (!map) return;
    const position = positionAt(nextProgress);
    truckMarkerRef.current?.setLngLat(position.coordinate);
    const completed = [...sampleJourney.route.slice(0, position.endIndex), position.coordinate];
    (map.getSource('completed-route') as GeoJSONSource | undefined)?.setData(routeFeature(completed));
    stopElementsRef.current.forEach((element, index) => {
      const delivered = nextProgress >= stopProgress[index];
      element.classList.toggle('is-delivered', delivered);
      element.setAttribute('aria-label', `Stop ${index + 1}: ${sampleJourney.stops[index].name}, ${delivered ? 'delivered' : 'pending'}`);
    });
  }, []);

  const stopAnimation = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    lastTimeRef.current = 0;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const tick = useCallback((time: number) => {
    if (!playingRef.current) return;
    if (document.hidden || !visibleRef.current) {
      lastTimeRef.current = 0;
      rafRef.current = 0;
      return;
    }
    if (!lastTimeRef.current) lastTimeRef.current = time;
    const next = Math.min(1, progressRef.current + (time - lastTimeRef.current) / ANIMATION_MS);
    lastTimeRef.current = time;
    progressRef.current = next;
    updateMap(next);
    const uiStep = Math.floor(next * 100);
    if (uiStep !== lastUiStepRef.current) {
      lastUiStepRef.current = uiStep;
      setProgress(next);
    }
    if (next >= 1) {
      stopAnimation();
      setProgress(1);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopAnimation, updateMap]);

  const play = useCallback(() => {
    if (reducedRef.current) return;
    if (progressRef.current >= 1) {
      progressRef.current = 0;
      setProgress(0);
      updateMap(0);
    }
    playingRef.current = true;
    setPlaying(true);
    lastTimeRef.current = 0;
    if (visibleRef.current && !document.hidden && !rafRef.current) rafRef.current = requestAnimationFrame(tick);
  }, [tick, updateMap]);

  const replay = useCallback(() => {
    stopAnimation();
    progressRef.current = 0;
    lastUiStepRef.current = -1;
    setProgress(0);
    updateMap(0);
    if (!reducedRef.current) {
      playingRef.current = true;
      setPlaying(true);
      if (visibleRef.current && !document.hidden) rafRef.current = requestAnimationFrame(tick);
    }
  }, [stopAnimation, tick, updateMap]);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reducedRef.current = media.matches;
      setReducedMotion(media.matches);
      if (media.matches) {
        stopAnimation();
        progressRef.current = 0.55;
        setProgress(0.55);
        updateMap(0.55);
      }
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [stopAnimation, updateMap]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let disposed = false;
    const map = new MapLibreMap({
      container,
      style: DAY_STYLE,
      center: [84.1, 17.9],
      zoom: 4.8,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const installRoute = () => {
      if (disposed || map.getSource('planned-route')) return;
      map.addSource('planned-route', { type: 'geojson', data: routeFeature(sampleJourney.route) });
      map.addSource('completed-route', { type: 'geojson', data: routeFeature([sampleJourney.route[0], sampleJourney.route[0]]) });
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'planned-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 10, 'line-opacity': 0, 'line-opacity-transition': { duration: 850 } },
      });
      map.addLayer({
        id: 'remaining-route',
        type: 'line',
        source: 'planned-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0f766e', 'line-width': 6, 'line-opacity': 0, 'line-opacity-transition': { duration: 950 } },
      });
      map.addLayer({
        id: 'completed-route',
        type: 'line',
        source: 'completed-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#f97316', 'line-width': 6, 'line-opacity': 0, 'line-opacity-transition': { duration: 950 } },
      });
      sampleFleetRoutes.forEach((fleet) => {
        const sourceId = 'fleet-' + fleet.id;
        map.addSource(sourceId, { type: 'geojson', data: routeFeature(fleet.route) });
        map.addLayer({
          id: sourceId + '-casing',
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.72 },
        });
        map.addLayer({
          id: sourceId + '-route',
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': fleet.colour, 'line-width': 4, 'line-opacity': 0.94 },
        });
      });      updateMap(progressRef.current);
      if (visibleRef.current) requestAnimationFrame(() => {
        ['route-casing', 'remaining-route', 'completed-route'].forEach((id) => {
          if (map.getLayer(id)) map.setPaintProperty(id, 'line-opacity', id === 'remaining-route' ? 0.92 : id === 'route-casing' ? 0.9 : 1);
        });
      });
    };

    map.on('load', () => {
      if (disposed) return;
      installRoute();
      const depotElement = document.createElement('div');
      depotElement.className = 'route-map__depot';
      depotElement.setAttribute('aria-label', sampleJourney.depot.name);
      depotElement.innerHTML = '<span>D</span>';
      new Marker({ element: depotElement }).setLngLat(sampleJourney.depot.coordinate).addTo(map);

      stopElementsRef.current = sampleJourney.stops.map((stop) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'route-map__marker';
        element.textContent = String(stop.order);
        element.setAttribute('aria-label', `Stop ${stop.order}: ${stop.name}, pending`);
        element.addEventListener('click', () => focusStop(stop.order - 1)); new Marker({ element, anchor: 'center' }).setLngLat(stop.coordinate).addTo(map);
        return element;
      });

      const truck = document.createElement('div');
      truck.className = 'route-map__truck';
      truck.setAttribute('aria-label', 'Sample refrigerated truck position');
      truck.innerHTML = '<span aria-hidden="true">&#128666;</span>';
      truckMarkerRef.current = new Marker({ element: truck, anchor: 'center' }).setLngLat(sampleJourney.route[0]).addTo(map);
      fleetMarkersRef.current = sampleFleetRoutes.map((fleet, index) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'route-map__fleet-truck' + (index === 0 ? ' is-selected' : '');
        element.style.setProperty('--fleet-colour', fleet.colour);
        element.innerHTML = '<span aria-hidden="true">&#128666;</span><b>' + (index + 1) + '</b>';
        element.setAttribute('aria-label', fleet.vehicle + ', ' + fleet.origin + ' to ' + fleet.destination + ', AI ETA ' + fleet.aiEta);
        element.addEventListener('click', () => {
          setSelectedFleet(index);
          fleetMarkersRef.current.forEach((marker, markerIndex) => marker.getElement().classList.toggle('is-selected', markerIndex === index));
          map.flyTo({ center: fleetPosition(fleet.route, fleet.progress), zoom: 7, duration: reducedRef.current ? 0 : 750 });
        });
        return new Marker({ element, anchor: 'center' }).setLngLat(fleetPosition(fleet.route, fleet.progress)).addTo(map);
      });      setMapReady(true);
      fitRoute();
      updateMap(progressRef.current);
    });
    map.on('style.load', installRoute);
    map.on('error', (event) => {
      if (!disposed && !map.loaded()) setMapError(event.error?.message || 'The map could not be loaded.');
    });

    return () => {
      disposed = true;
      stopAnimation();
      map.remove();
      mapRef.current = null;
      truckMarkerRef.current = null;
      fleetMarkersRef.current = [];
      stopElementsRef.current = [];
    };
  }, [fitRoute, focusStop, stopAnimation, updateMap]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    let revealed = false;
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting && !revealed) {
        revealed = true;
        section.classList.add('is-visible');
        const map = mapRef.current;
        ['route-casing', 'remaining-route', 'completed-route'].forEach((id) => {
          if (map?.getLayer(id)) map.setPaintProperty(id, 'line-opacity', id === 'remaining-route' ? 0.92 : id === 'route-casing' ? 0.9 : 1);
        });
      }
      if (entry.isIntersecting && playingRef.current && !document.hidden && !rafRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
      }
      if (!entry.isIntersecting && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        lastTimeRef.current = 0;
      }
    }, { threshold: 0.18 });
    observer.observe(section);

    const visibility = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        lastTimeRef.current = 0;
      } else if (!document.hidden && visibleRef.current && playingRef.current && !rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [tick]);

  const toggleTheme = () => {
    const next = !night;
    setNight(next);
    mapRef.current?.setStyle(next ? NIGHT_STYLE : DAY_STYLE);
  };

  return (
    <section ref={sectionRef} className="route-map" aria-labelledby="route-map-title">
      <div className="route-map__shell">
        <header className="route-map__heading">
          <div>
            <p className="route-map__eyebrow">AI-powered fleet intelligence</p>
            <h2 id="route-map-title">Every route. Every vehicle. One intelligent view.</h2>
          </div>
          <p>Four illustrative AI-assisted journeys across India. Routes, vehicle positions, predictions, and ETAs are sample dataÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Ânot live customer information.</p>
        </header>

        <div className="route-map__dashboard">
          <aside className="route-map__panel">
            <div className="route-map__trip-head">
              <div><span>AI fleet control</span><strong>4 active journeys</strong></div>
              <span className="route-map__live"><i /> AI simulation</span>
            </div>
            <div className="route-map__stats">
              <div><span>Vehicles</span><strong>4 active</strong></div>
              <div><span>AI monitored</span><strong>100%</strong></div>
              <div><span>Corridors</span><strong>4 states</strong></div>
            </div>
            <div className="route-map__fleet-list" aria-label="Select an AI-monitored vehicle">
              {sampleFleetRoutes.map((fleet, index) => (
                <button key={fleet.id} type="button" className={selectedFleet === index ? 'is-selected' : ''} style={{ '--fleet-colour': fleet.colour } as import('react').CSSProperties} onClick={() => {
                  setSelectedFleet(index);
                  fleetMarkersRef.current.forEach((marker, markerIndex) => marker.getElement().classList.toggle('is-selected', markerIndex === index));
                  mapRef.current?.flyTo({ center: fleetPosition(fleet.route, fleet.progress), zoom: 7, duration: reducedRef.current ? 0 : 750 });
                }}>
                  <i /><span><strong>{fleet.origin} → {fleet.destination}</strong><small>{fleet.vehicle} · {fleet.temperature}</small></span><em>{fleet.risk}</em>
                </button>
              ))}
            </div>            <div className="route-map__now">
              <span>AI-selected vehicle · {selectedFleetRoute.state}</span>
              <strong>{selectedFleetRoute.vehicle} · {selectedFleetRoute.origin} → {selectedFleetRoute.destination}</strong>
              <small>AI ETA {selectedFleetRoute.aiEta} | {selectedFleetRoute.aiInsight}</small>
            </div>

            <button className="route-map__details-toggle" type="button" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}>
              Primary journey stops <span>{detailsOpen ? '-' : '+'}</span>
            </button>
            <ol className={`route-map__stops ${detailsOpen ? 'is-open' : ''}`}>
              {sampleJourney.stops.map((stop, index) => {
                const delivered = progress >= stopProgress[index];
                const active = index === completedCount && completedCount < sampleJourney.stops.length;
                return (
                  <li key={stop.id} role="button" tabIndex={0} aria-pressed={selectedStop === index} onClick={() => focusStop(index)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') focusStop(index); }} className={`${delivered ? 'is-delivered' : active ? 'is-active' : ''} ${selectedStop === index ? 'is-selected' : ''}`}> 
                    <span className="route-map__stop-number">{delivered ? '\u2713' : stop.order}</span>
                    <div><strong>{stop.name}</strong><small>{stop.area} | {stop.window}</small></div>
                    <em>{delivered ? 'Delivered' : active ? 'Next' : 'Pending'}</em>
                  </li>
                );
              })}
            </ol>
            <div className="route-map__meta"><span>{sampleJourney.vehicle}</span><span>{sampleJourney.distance}</span></div>
          </aside>

          <div className="route-map__map-wrap">
            <div ref={mapContainerRef} className="route-map__canvas" role="application" aria-label="Interactive sample interstate delivery route map across eastern and southern India" />
            {!mapReady && !mapError && <div className="route-map__loading" role="status">Loading sample route...</div>}
            {mapError && <div className="route-map__error" role="alert"><strong>Map unavailable</strong><span>The sample journey details remain available. Please check your connection and try again.</span></div>}
            <div className="route-map__controls" aria-label="Map journey controls">
              <button type="button" onClick={playing ? stopAnimation : play} disabled={reducedMotion} aria-label={playing ? 'Pause sample journey' : 'Play sample journey'}>
                {playing ? 'Pause' : 'Play'}
              </button>
              <button type="button" onClick={replay} disabled={reducedMotion} aria-label="Replay sample journey">Replay</button>
              <button type="button" onClick={fitRoute} aria-label="Fit the full route in the map">Fit route</button>
              <button type="button" onClick={toggleTheme} aria-label={night ? 'Switch map to day mode' : 'Switch map to night mode'}>{night ? 'Day' : 'Night'}</button>
            </div>
            {reducedMotion && <p className="route-map__motion-note">Animation paused by your reduced-motion preference.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
