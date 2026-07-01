import { describe, it, expect } from "vitest";
import { wgs84ToGcj02 } from "../gcj02";

describe("wgs84ToGcj02", () => {
  it("leaves coordinates outside mainland China unchanged", () => {
    // Nairobi (well outside the China bbox) — GCJ-02 == WGS-84 here.
    const out = wgs84ToGcj02(-1.286389, 36.817223);
    expect(out.lat).toBe(-1.286389);
    expect(out.lng).toBe(36.817223);
  });

  it("applies the GCJ-02 offset inside China", () => {
    // Shanghai People's Square (WGS-84). The offset should be a few hundred
    // meters — well under 0.01°, and clearly non-zero.
    const wgs = { lat: 31.23037, lng: 121.4737 };
    const g = wgs84ToGcj02(wgs.lat, wgs.lng);

    const dLat = Math.abs(g.lat - wgs.lat);
    const dLng = Math.abs(g.lng - wgs.lng);

    expect(dLat).toBeGreaterThan(0.0005);
    expect(dLat).toBeLessThan(0.01);
    expect(dLng).toBeGreaterThan(0.0005);
    expect(dLng).toBeLessThan(0.01);
  });

  it("matches a known reference conversion within a few meters", () => {
    // Reference from the open 'eviltransform' implementation.
    // WGS-84 (31.1774276, 121.5272106) -> GCJ-02 ~ (31.17530, 121.53154)
    const g = wgs84ToGcj02(31.1774276, 121.5272106);
    expect(g.lat).toBeCloseTo(31.17530147, 3);
    expect(g.lng).toBeCloseTo(121.53154186, 3);
  });
});
