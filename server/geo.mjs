const EPSILON = 1e-10;

function pointOnSegment(lon, lat, a, b) {
  const cross = (lon - a[0]) * (b[1] - a[1]) - (lat - a[1]) * (b[0] - a[0]);
  if (Math.abs(cross) > EPSILON) return false;
  return lon >= Math.min(a[0], b[0]) - EPSILON && lon <= Math.max(a[0], b[0]) + EPSILON &&
    lat >= Math.min(a[1], b[1]) - EPSILON && lat <= Math.max(a[1], b[1]) + EPSILON;
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (pointOnSegment(lon, lat, a, b)) return true;
    if ((a[1] > lat) !== (b[1] > lat) &&
      lon < (b[0] - a[0]) * (lat - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInPolygon(lon, lat, rings) {
  return !!rings.length && pointInRing(lon, lat, rings[0]) &&
    !rings.slice(1).some((ring) => pointInRing(lon, lat, ring));
}

export function pointInGeometry(lon, lat, geometry) {
  if (geometry?.type === "Polygon") return pointInPolygon(lon, lat, geometry.coordinates);
  if (geometry?.type === "MultiPolygon") return geometry.coordinates.some((polygon) => pointInPolygon(lon, lat, polygon));
  return false;
}
