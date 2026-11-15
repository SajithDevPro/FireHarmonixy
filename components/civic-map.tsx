"use client";








import { useEffect, useMemo, useRef, useState } from "react";

export type MapPoint = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  tone?: string;
  kind?: "incident" | "hospital" | "route" | "property" | "pin";
  sub?: string;
};

type Props = {
  points: MapPoint[];
  center?: {lat: number;lon: number;};
  spanKm?: number;
  height?: number;
  onPick?: (lat: number, lon: number) => void;
  picked?: {lat: number;lon: number;} | null;
  caption?: string;
  radiusKm?: number;
};

const KM_PER_DEG = 111.32;
const TILE_SIZE = 256;
const EARTH_CIRCUMFERENCE_M = 40075016.68557849;
const MAX_MERCATOR_LAT = 85.0511287798066;

const worldSizeAtZoom = (zoom: number) => TILE_SIZE * 2 ** zoom;
const worldXForLon = (lon: number, zoom: number) =>
  (lon + 180) / 360 * worldSizeAtZoom(zoom);

function worldYForLat(lat: number, zoom: number) {
  const clipped = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  const sin = Math.sin(clipped * Math.PI / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSizeAtZoom(zoom);
}

function latForWorldY(y: number, zoom: number) {
  const size = worldSizeAtZoom(zoom);
  const bounded = Math.max(0, Math.min(size, y));
  return Math.atan(Math.sinh(Math.PI * (1 - 2 * bounded / size))) * 180 / Math.PI;
}

const formatLongitude = (lon: number) => `${Math.abs(lon).toFixed(3)}°${lon < 0 ? "W" : "E"}`;
const formatLatitude = (lat: number) => `${Math.abs(lat).toFixed(3)}°${lat < 0 ? "S" : "N"}`;

const SCOPE_CENTERS: Record<string, {lat: number;lon: number;}> = {
  "Colombo": { lat: 6.9271, lon: 79.8612 },
  "Gampaha": { lat: 7.0917, lon: 79.9930 },
  "Kandy": { lat: 7.2906, lon: 80.6337 },
  "Galle": { lat: 6.0535, lon: 80.2210 },
  "Anuradhapura": { lat: 8.3114, lon: 80.4037 },
  "Tamil Nadu": { lat: 13.0827, lon: 80.2707 },
  "Kerala": { lat: 9.9312, lon: 76.2673 },
  "Maharashtra": { lat: 19.0760, lon: 72.8777 },
  "Odisha": { lat: 20.2961, lon: 85.8245 },
  "Bagmati": { lat: 27.7172, lon: 85.3240 },
  "Gandaki": { lat: 28.2096, lon: 83.9856 },
  "Dhaka": { lat: 23.8103, lon: 90.4125 },
  "Khulna": { lat: 22.8456, lon: 89.5403 },
  "Sri Lanka": { lat: 7.8731, lon: 80.7718 },
  "India": { lat: 22.0, lon: 82.0 },
  "Nepal": { lat: 28.3, lon: 84.0 },
  "Bangladesh": { lat: 23.7, lon: 90.3 },
  "USA": { lat: 39.8283, lon: -98.5795 }
};

export function scopeCenterFor(country?: string | null, district?: string | null) {
  return (district && SCOPE_CENTERS[district]) || (country && SCOPE_CENTERS[country]) || undefined;
}

export default function CivicMap({
  points, center, spanKm = 60, height = 340, onPick, picked, caption, radiusKm
}: Props) {
  const W = 720;
  const H = height;
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [failedTiles, setFailedTiles] = useState<Set<string>>(new Set());
  const [zoomLevel, setZoomLevel] = useState(0);
  const [panCenter, setPanCenter] = useState<{lat: number;lon: number;} | null>(null);
  const [explored, setExplored] = useState<{lat: number;lon: number;} | null>(null);
  const [pointerCoordinate, setPointerCoordinate] = useState<{lat: number;lon: number;} | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const dragStart = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    center: {lat: number;lon: number;};
    tileZoom: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  const defaultMid = useMemo(() => {
    if (center) return center;
    if (picked) return picked;
    if (!points.length) return { lat: 6.9271, lon: 79.8612 };
    const lat = points.reduce((a, p) => a + p.lat, 0) / points.length;
    const lon = points.reduce((a, p) => a + p.lon, 0) / points.length;
    return { lat, lon };
  }, [center, picked, points]);
  const mid = panCenter || defaultMid;



  const baseFitKm = useMemo(() => {
    if (center) return spanKm;
    const all = [...points, ...(picked ? [{ lat: picked.lat, lon: picked.lon } as MapPoint] : [])];
    if (all.length < 2) return spanKm;
    const lats = all.map((p) => p.lat);
    const lons = all.map((p) => p.lon);
    const dLat = (Math.max(...lats) - Math.min(...lats)) * KM_PER_DEG;
    const dLon = (Math.max(...lons) - Math.min(...lons)) * KM_PER_DEG * Math.cos(mid.lat * Math.PI / 180);
    return Math.min(4000, Math.max(4, Math.max(dLat, dLon) * 1.3));
  }, [center, points, picked, spanKm, mid.lat]);
  const fitKm = Math.max(1, baseFitKm / 2 ** zoomLevel);

  const tileZoom = useMemo(() => {
    const cosLat = Math.max(0.01, Math.cos(mid.lat * Math.PI / 180));
    const zoom = Math.round(Math.log2(cosLat * 156543.03392804097 * W / (fitKm * 1000)));
    return Math.max(0, Math.min(19, zoom));
  }, [fitKm, mid.lat]);
  const worldSize = worldSizeAtZoom(tileZoom);
  const centerX = worldXForLon(mid.lon, tileZoom);
  const centerY = worldYForLat(mid.lat, tileZoom);
  const mapWorldWidth = fitKm * 1000 * worldSize /
    (EARTH_CIRCUMFERENCE_M * Math.max(0.01, Math.cos(mid.lat * Math.PI / 180)));
  const scale = W / mapWorldWidth;
  const x = (lon: number) => {
    const delta = ((worldXForLon(lon, tileZoom) - centerX + worldSize / 2) % worldSize + worldSize) % worldSize - worldSize / 2;
    return W / 2 + delta * scale;
  };
  const y = (lat: number) => H / 2 + (worldYForLat(lat, tileZoom) - centerY) * scale;
  const lonAt = (px: number) => {
    const lon = (centerX + (px - W / 2) / scale) / worldSize * 360 - 180;
    return ((lon + 540) % 360) - 180;
  };
  const latAt = (py: number) => latForWorldY(centerY + (py - H / 2) / scale, tileZoom);

  const tiles = useMemo(() => {
    const left = centerX - W / (2 * scale);
    const right = centerX + W / (2 * scale);
    const top = centerY - H / (2 * scale);
    const bottom = centerY + H / (2 * scale);
    const count = 2 ** tileZoom;
    const result: { key: string; x: number; y: number; left: number; top: number; }[] = [];

    for (let tileX = Math.floor(left / TILE_SIZE); tileX <= Math.floor(right / TILE_SIZE); tileX++) {
      for (let tileY = Math.max(0, Math.floor(top / TILE_SIZE)); tileY <= Math.min(count - 1, Math.floor(bottom / TILE_SIZE)); tileY++) {
        const wrappedX = ((tileX % count) + count) % count;
        const key = `${tileZoom}/${tileX}/${tileY}`;
        result.push({
          key,
          x: wrappedX,
          y: tileY,
          left: W / 2 + (tileX * TILE_SIZE - centerX) * scale,
          top: H / 2 + (tileY * TILE_SIZE - centerY) * scale
        });
      }
    }
    return result;
  }, [centerX, centerY, H, scale, tileZoom]);
  const visibleTileKey = tiles.map((tile) => tile.key).join(",");

  useEffect(() => {
    setZoomLevel(0);
    setPanCenter(null);
  }, [center?.lat, center?.lon]);

  useEffect(() => {
    setFailedTiles(new Set());
  }, [visibleTileKey]);

  const inside = (p: MapPoint) => x(p.lon) > -40 && x(p.lon) < W + 40 && y(p.lat) > -40 && y(p.lat) < H + 40;

  const coordinateAt = (clientX: number, clientY: number) => {
    if (!ref.current) return null;
    const box = ref.current.getBoundingClientRect();
    const px = (clientX - box.left) / box.width * W;
    const py = (clientY - box.top) / box.height * H;
    const lon = lonAt(px);
    const lat = latAt(py);
    return { lat: Number(lat.toFixed(5)), lon: Number(lon.toFixed(5)) };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      center: mid,
      tileZoom,
      scale,
      moved: false
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const point = coordinateAt(e.clientX, e.clientY);
    if (point) setPointerCoordinate(point);

    const drag = dragStart.current;
    if (!drag || drag.pointerId !== e.pointerId || !ref.current) return;
    const box = ref.current.getBoundingClientRect();
    const dx = (e.clientX - drag.clientX) / box.width * W;
    const dy = (e.clientY - drag.clientY) / box.height * H;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (!drag.moved) return;

    const worldSize = worldSizeAtZoom(drag.tileZoom);
    const nextWorldX = worldXForLon(drag.center.lon, drag.tileZoom) - dx / drag.scale;
    const nextWorldY = worldYForLat(drag.center.lat, drag.tileZoom) - dy / drag.scale;
    const lon = ((nextWorldX / worldSize * 360 + 360) % 360) - 180;
    setIsPanning(true);
    setPanCenter({ lat: latForWorldY(nextWorldY, drag.tileZoom), lon });
    const pointerWorldX = nextWorldX + (e.clientX - box.left) / box.width * W - W / 2;
    const pointerWorldY = nextWorldY + (e.clientY - box.top) / box.height * H - H / 2;
    setPointerCoordinate({
      lat: Number(latForWorldY(pointerWorldY, drag.tileZoom).toFixed(5)),
      lon: Number((((pointerWorldX / worldSize * 360 + 360) % 360) - 180).toFixed(5))
    });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStart.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragStart.current = null;
    setIsPanning(false);
    if (!drag.moved) {
      const point = coordinateAt(e.clientX, e.clientY);
      if (point) {
        setPointerCoordinate(point);
        if (onPick) onPick(point.lat, point.lon);
        else setExplored(point);
      }
    }
  };

  const ticks = 4;
  const scaleKm = fitKm / 4;

  return (
    <div className="civic-map">
      <div className="civic-map-canvas">
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className={"civic-map-svg" + (onPick ? " pickable" : "") + (isPanning ? " panning" : "")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragStart.current = null; setIsPanning(false); }}
        role="img"
        aria-label={caption || "Interactive map; drag to pan, point to inspect coordinates, and tap to explore"}>
        
        <rect width={W} height={H} fill="var(--surface-2)" />
        {tiles.map((tile) =>
        <image
          key={tile.key}
          href={`https://tile.openstreetmap.org/${tileZoom}/${tile.x}/${tile.y}.png`}
          x={tile.left}
          y={tile.top}
          width={TILE_SIZE * scale}
          height={TILE_SIZE * scale}
          onLoad={() => setFailedTiles((current) => {
            if (!current.has(tile.key)) return current;
            const next = new Set(current);
            next.delete(tile.key);
            return next;
          })}
          onError={() => setFailedTiles((current) => {
            if (current.has(tile.key)) return current;
            const next = new Set(current);
            next.add(tile.key);
            return next;
          })}
        />)}
        <rect width={W} height={H} fill="var(--surface-2)" fillOpacity="0.08" pointerEvents="none" />
        <defs>
          <pattern id="cm-grid" width={W / ticks} height={H / ticks} patternUnits="userSpaceOnUse">
            <path d={`M ${W / ticks} 0 L 0 0 0 ${H / ticks}`} fill="none" stroke="var(--line)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#cm-grid)" />

        {}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const lon = lonAt(i / ticks * W);
          const lat = latAt(i / ticks * H);
          return (
            <g key={i} fill="var(--muted)" fontSize="9.5" fontFamily="var(--mono)">
              <text x={i / ticks * W + 3} y={H - 5}>{formatLongitude(lon)}</text>
              <text x={4} y={i / ticks * H + 11}>{formatLatitude(lat)}</text>
            </g>);

        })}

        {}
        {radiusKm ?
        <circle
          cx={x(mid.lon)} cy={y(mid.lat)}
          r={radiusKm * W / fitKm}
          fill="var(--accent)" fillOpacity="0.05"
          stroke="var(--accent)" strokeOpacity="0.45" strokeDasharray="4 4" /> :

        null}

        {}
        <g stroke="var(--muted)" strokeOpacity="0.5" strokeDasharray="3 4">
          <line x1={x(mid.lon)} y1={0} x2={x(mid.lon)} y2={H} />
          <line x1={0} y1={y(mid.lat)} x2={W} y2={y(mid.lat)} />
        </g>

        {points.filter(inside).map((p) => {
          const cx = x(p.lon);
          const cy = y(p.lat);
          const tone = p.tone || "var(--accent)";
          const active = hover === p.id;
          return (
            <g key={p.id} onMouseEnter={() => setHover(p.id)} onMouseLeave={() => setHover(null)}>
              <circle cx={cx} cy={cy} r={active ? 15 : 11} fill={tone} fillOpacity="0.14" />
              <circle cx={cx} cy={cy} r="5" fill={tone} stroke="var(--surface)" strokeWidth="1.5" />
              {(active || p.kind === "hospital" || p.kind === "property") &&
              <text x={cx + 10} y={cy + 3.5} fontSize="10" fill="var(--ink)" fontFamily="var(--sans)">
                  {p.label.length > 26 ? p.label.slice(0, 26) + "…" : p.label}
                </text>
              }
              <title>{p.label + (p.sub ? " — " + p.sub : "") + ` (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)})`}</title>
            </g>);

        })}

        {picked || explored ?
        <g>
            <circle cx={x((picked || explored)!.lon)} cy={y((picked || explored)!.lat)} r="9" fill="none" stroke="var(--bad)" strokeWidth="2" />
            <circle cx={x((picked || explored)!.lon)} cy={y((picked || explored)!.lat)} r="3" fill="var(--bad)" />
            <text x={x((picked || explored)!.lon) + 12} y={y((picked || explored)!.lat) + 4} fontSize="10.5" fill="var(--bad)" fontFamily="var(--mono)">
              {(picked || explored)!.lat.toFixed(4)}, {(picked || explored)!.lon.toFixed(4)}
            </text>
          </g> :
        null}

        {}
        <g transform={`translate(${W - 96} ${H - 22})`}>
          <line x1="0" y1="0" x2="80" y2="0" stroke="var(--text-soft)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--text-soft)" strokeWidth="2" />
          <line x1="80" y1="-4" x2="80" y2="4" stroke="var(--text-soft)" strokeWidth="2" />
          <text x="40" y="-7" fontSize="9.5" textAnchor="middle" fill="var(--text-soft)" fontFamily="var(--mono)">
            {scaleKm.toFixed(0)} km
          </text>
        </g>
      </svg>
      <div className="civic-map-controls" role="group" aria-label="Map zoom controls">
        <button type="button" className="civic-map-control" aria-label="Zoom in" title="Zoom in"
          onClick={() => setZoomLevel((level) => Math.min(6, level + 1))} disabled={zoomLevel >= 6}>+</button>
        <button type="button" className="civic-map-control" aria-label="Zoom out" title="Zoom out"
          onClick={() => setZoomLevel((level) => Math.max(-3, level - 1))} disabled={zoomLevel <= -3}>-</button>
        <button type="button" className="civic-map-control civic-map-reset" aria-label="Reset map zoom" title="Reset zoom"
          onClick={() => setZoomLevel(0)} disabled={zoomLevel === 0}>Reset</button>
      </div>
      </div>
      <div className="civic-map-foot">
        <span>{caption || "Interactive map"}</span>
        {failedTiles.size ? <span role="status">Map tiles could not load; coordinates are still available.</span> : null}
        {onPick ? <span className="civic-map-hint">Drag to explore · click or tap to move the pin</span> : <span className="civic-map-hint">Drag to explore · click or tap to inspect a point</span>}
        {pointerCoordinate ? <span className="civic-map-coordinate" role="status" aria-live="polite">{formatLatitude(pointerCoordinate.lat)}, {formatLongitude(pointerCoordinate.lon)}</span> : null}
        {hover ? <span className="civic-map-hover">{points.find((p) => p.id === hover)?.label}</span> : null}
        <a
          className="civic-map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>
      </div>
    </div>);

}
