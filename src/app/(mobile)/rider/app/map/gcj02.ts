/**
 * WGS-84 → GCJ-02 coordinate conversion.
 *
 * China legally requires public maps to use the GCJ-02 ("Mars") datum, a
 * deliberate obfuscation offset applied on top of standard WGS-84 GPS
 * coordinates. Chinese navigation apps (Amap, Baidu, Tencent) expect GCJ-02;
 * passing them raw WGS-84 lands the pin roughly 300–600 m away from the real
 * location.
 *
 * Our station/GPS coordinates are WGS-84 throughout, and the in-app OSM map is
 * WGS-84 too (so it needs NO conversion). This module exists purely for the
 * ONE boundary where WGS-84 leaves our app for a Chinese map app: the Amap
 * "Navigate" deep-link (see `deepLinks.ts` → `amapUrl`).
 *
 * The algorithm is the well-known open "eviltransform" approximation. It is an
 * approximation (the exact offset table is a Chinese state secret) but is
 * accurate to a few meters — far tighter than the ~500 m error it corrects.
 *
 * Pure and side-effect free so it is trivially unit-testable.
 */

const A = 6378245.0; // Krasovsky 1940 semi-major axis (meters)
const EE = 0.00669342162296594323; // eccentricity squared

/**
 * Coordinates outside mainland China are not offset (GCJ-02 == WGS-84 there),
 * so we return them unchanged. Uses a coarse bounding box — good enough since
 * the only consumer is a China-gated deep-link.
 */
function outOfChina(lat: number, lng: number): boolean {
  if (lng < 72.004 || lng > 137.8347) return true;
  if (lat < 0.8293 || lat > 55.8271) return true;
  return false;
}

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin((y / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin((x / 3.0) * Math.PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * Math.PI) + 300.0 * Math.sin((x / 30.0) * Math.PI)) * 2.0) / 3.0;
  return ret;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Convert a WGS-84 coordinate to GCJ-02. Coordinates outside mainland China
 * are returned unchanged.
 */
export function wgs84ToGcj02(lat: number, lng: number): LatLng {
  if (outOfChina(lat, lng)) {
    return { lat, lng };
  }
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}
