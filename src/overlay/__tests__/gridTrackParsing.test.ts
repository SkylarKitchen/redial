/**
 * gridTrackParsing.test.ts — Tests for parseGridTemplate + serializeGridTemplate
 *
 * Covers simple values, repeat(), minmax(), auto, mixed, and round-trips.
 */

import { describe, it, expect } from "vitest";
import { parseGridTemplate, serializeGridTemplate, type GridTrackDef } from "../GridSettingsPopup";

describe("parseGridTemplate", () => {
  it("parses a single fr value", () => {
    const tracks = parseGridTemplate("1fr");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe("default");
    expect(tracks[0].value).toBe(1);
    expect(tracks[0].unit).toBe("fr");
    expect(tracks[0].isAuto).toBe(false);
  });

  it("parses multiple space-separated values", () => {
    const tracks = parseGridTemplate("1fr 2fr 100px");
    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toMatchObject({ value: 1, unit: "fr" });
    expect(tracks[1]).toMatchObject({ value: 2, unit: "fr" });
    expect(tracks[2]).toMatchObject({ value: 100, unit: "px" });
  });

  it("parses repeat(N, value)", () => {
    const tracks = parseGridTemplate("repeat(3, 1fr)");
    expect(tracks).toHaveLength(3);
    tracks.forEach(t => {
      expect(t.value).toBe(1);
      expect(t.unit).toBe("fr");
    });
  });

  it("parses minmax(min, max)", () => {
    const tracks = parseGridTemplate("minmax(200px, 1fr)");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe("minmax");
    expect(tracks[0].minValue).toBe(200);
    expect(tracks[0].minUnit).toBe("px");
    expect(tracks[0].maxValue).toBe(1);
    expect(tracks[0].maxUnit).toBe("fr");
  });

  it("parses auto", () => {
    const tracks = parseGridTemplate("auto");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].isAuto).toBe(true);
  });

  it("parses mixed values", () => {
    const tracks = parseGridTemplate("200px auto 1fr");
    expect(tracks).toHaveLength(3);
    expect(tracks[0]).toMatchObject({ value: 200, unit: "px", isAuto: false });
    expect(tracks[1].isAuto).toBe(true);
    expect(tracks[2]).toMatchObject({ value: 1, unit: "fr", isAuto: false });
  });

  it("handles empty string with a default track", () => {
    const tracks = parseGridTemplate("");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].value).toBe(1);
    expect(tracks[0].unit).toBe("fr");
  });

  it("handles 'none' with a default track", () => {
    const tracks = parseGridTemplate("none");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].value).toBe(1);
    expect(tracks[0].unit).toBe("fr");
  });

  it("parses repeat with minmax", () => {
    const tracks = parseGridTemplate("repeat(2, minmax(100px, 1fr))");
    expect(tracks).toHaveLength(2);
    tracks.forEach(t => {
      expect(t.type).toBe("minmax");
      expect(t.minValue).toBe(100);
      expect(t.minUnit).toBe("px");
      expect(t.maxValue).toBe(1);
      expect(t.maxUnit).toBe("fr");
    });
  });

  it("parses percentage units", () => {
    const tracks = parseGridTemplate("50% 50%");
    expect(tracks).toHaveLength(2);
    tracks.forEach(t => {
      expect(t.value).toBe(50);
      expect(t.unit).toBe("%");
    });
  });

  it("parses minmax with auto min", () => {
    const tracks = parseGridTemplate("minmax(auto, 1fr)");
    expect(tracks).toHaveLength(1);
    expect(tracks[0].type).toBe("minmax");
    expect(tracks[0].minUnit).toBe("auto");
    expect(tracks[0].maxValue).toBe(1);
    expect(tracks[0].maxUnit).toBe("fr");
  });
});

describe("serializeGridTemplate", () => {
  it("serializes a single track", () => {
    const tracks: GridTrackDef[] = [
      { type: "default", value: 1, unit: "fr", isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" },
    ];
    expect(serializeGridTemplate(tracks)).toBe("1fr");
  });

  it("uses repeat() for identical tracks", () => {
    const t: GridTrackDef = { type: "default", value: 1, unit: "fr", isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" };
    expect(serializeGridTemplate([t, t, t])).toBe("repeat(3, 1fr)");
  });

  it("serializes mixed tracks without repeat()", () => {
    const tracks: GridTrackDef[] = [
      { type: "default", value: 200, unit: "px", isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" },
      { type: "default", value: 1, unit: "fr", isAuto: false, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" },
    ];
    expect(serializeGridTemplate(tracks)).toBe("200px 1fr");
  });

  it("serializes minmax tracks", () => {
    const tracks: GridTrackDef[] = [
      { type: "minmax", value: 0, unit: "fr", isAuto: false, minValue: 200, minUnit: "px", maxValue: 1, maxUnit: "fr" },
    ];
    expect(serializeGridTemplate(tracks)).toBe("minmax(200px, 1fr)");
  });

  it("serializes auto tracks", () => {
    const tracks: GridTrackDef[] = [
      { type: "default", value: 0, unit: "fr", isAuto: true, minValue: 0, minUnit: "px", maxValue: 1, maxUnit: "fr" },
    ];
    expect(serializeGridTemplate(tracks)).toBe("auto");
  });

  it("serializes minmax with auto min", () => {
    const tracks: GridTrackDef[] = [
      { type: "minmax", value: 0, unit: "fr", isAuto: false, minValue: 0, minUnit: "auto", maxValue: 1, maxUnit: "fr" },
    ];
    expect(serializeGridTemplate(tracks)).toBe("minmax(auto, 1fr)");
  });

  it("returns 1fr for empty array", () => {
    expect(serializeGridTemplate([])).toBe("1fr");
  });
});

describe("round-trip: parse → serialize", () => {
  const cases = [
    "1fr",
    "repeat(3, 1fr)",
    "200px 1fr",
    "minmax(200px, 1fr)",
    "auto",
    "200px auto 1fr",
    "repeat(2, minmax(100px, 1fr))",
    "50% 50%",
  ];

  cases.forEach(css => {
    it(`round-trips: "${css}"`, () => {
      const parsed = parseGridTemplate(css);
      const serialized = serializeGridTemplate(parsed);
      // Re-parse the serialized output and compare to the first parse
      const reparsed = parseGridTemplate(serialized);
      expect(reparsed).toEqual(parsed);
    });
  });
});
