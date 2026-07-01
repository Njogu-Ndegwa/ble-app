import { describe, it, expect } from "vitest";
import { googleMapsUrl, amapUrl, bestDirectionsUrl } from "../deepLinks";

const SHANGHAI = { lat: 31.23037, lng: 121.4737 }; // inside China
const LAGOS = { lat: 6.5244, lng: 3.3792 }; // outside China

describe("googleMapsUrl", () => {
  it("builds a driving-directions URL to the destination", () => {
    const url = new URL(googleMapsUrl(LAGOS));
    expect(url.hostname).toBe("www.google.com");
    expect(url.searchParams.get("destination")).toBe("6.5244,3.3792");
    expect(url.searchParams.get("travelmode")).toBe("driving");
  });
});

describe("amapUrl", () => {
  it("targets Amap and converts the destination to GCJ-02", () => {
    const url = new URL(amapUrl(SHANGHAI, "Depot"));
    expect(url.hostname).toBe("uri.amap.com");
    expect(url.searchParams.get("coordinate")).toBe("gaode");
    expect(url.searchParams.get("callnative")).toBe("1");

    const to = url.searchParams.get("to")!; // "lng,lat,label"
    const [lngStr, latStr, label] = to.split(",");
    expect(label).toBe("Depot");
    // GCJ-02 lat/lng must differ from the raw WGS-84 input (offset applied).
    expect(Number(latStr)).not.toBe(SHANGHAI.lat);
    expect(Number(lngStr)).not.toBe(SHANGHAI.lng);
    expect(Math.abs(Number(latStr) - SHANGHAI.lat)).toBeLessThan(0.01);
  });
});

describe("bestDirectionsUrl", () => {
  it("uses Amap in China and Google Maps elsewhere", () => {
    expect(bestDirectionsUrl(SHANGHAI, { isChina: true })).toContain(
      "uri.amap.com",
    );
    expect(bestDirectionsUrl(SHANGHAI, { isChina: false })).toContain(
      "www.google.com",
    );
  });
});
