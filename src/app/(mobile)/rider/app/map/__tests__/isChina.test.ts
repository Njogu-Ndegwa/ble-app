import { describe, it, expect } from "vitest";
import { isChinaFrom } from "../isChina";

describe("isChinaFrom", () => {
  it("treats mainland-China timezones as China", () => {
    expect(isChinaFrom("Asia/Shanghai", "en-US")).toBe(true);
    expect(isChinaFrom("Asia/Urumqi", "en-US")).toBe(true);
    expect(isChinaFrom("Asia/Chongqing", undefined)).toBe(true);
    expect(isChinaFrom("PRC", undefined)).toBe(true);
  });

  it("treats a zh-CN UI language as China even off a China timezone", () => {
    // Bias is deliberate: a false 'China' still yields a working OSM map,
    // whereas a false 'not China' yields a permanent blank Google map.
    expect(isChinaFrom("Asia/Tokyo", "zh-CN")).toBe(true);
    expect(isChinaFrom(undefined, "zh-cn")).toBe(true);
  });

  it("is not China for non-China timezone + non-zh-CN language", () => {
    expect(isChinaFrom("Africa/Lagos", "en-US")).toBe(false);
    expect(isChinaFrom("Europe/London", "fr-FR")).toBe(false);
    expect(isChinaFrom("America/New_York", "zh-TW")).toBe(false);
    expect(isChinaFrom("Asia/Hong_Kong", "zh-HK")).toBe(false);
  });

  it("is not China when both signals are missing", () => {
    expect(isChinaFrom(undefined, undefined)).toBe(false);
    expect(isChinaFrom(null, null)).toBe(false);
  });
});
