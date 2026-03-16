import { describe, it, expect, beforeEach } from "vitest";
import {
  timing,
  type TimingKey,
  setReducedMotion,
  getReducedMotion,
  ms,
  easeRelease,
  cssTransition,
} from "../timing";

// Reset reduced-motion flag between tests
beforeEach(() => {
  setReducedMotion(false);
});

// ─── timing tokens ───────────────────────────────────────────────────

describe("timing tokens", () => {
  it("exports all expected keys", () => {
    const keys: TimingKey[] = [
      "instant", "micro", "fast", "normal", "expand", "layout", "slow",
      "release", "toolbar", "dismissal",
    ];
    for (const k of keys) {
      expect(timing).toHaveProperty(k);
    }
  });

  it("has numeric values for every key", () => {
    for (const v of Object.values(timing)) {
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThan(0);
    }
  });

  it("tokens are in ascending order", () => {
    const ordered: TimingKey[] = [
      "instant", "micro", "fast", "normal", "expand", "layout", "slow",
      "toolbar", "dismissal",
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(timing[ordered[i]]).toBeGreaterThanOrEqual(timing[ordered[i - 1]]);
    }
  });

  it("instant is the smallest", () => {
    expect(timing.instant).toBe(50);
  });

  it("dismissal is the largest", () => {
    expect(timing.dismissal).toBe(1700);
  });

  it("release is 120", () => {
    expect(timing.release).toBe(120);
  });
});

// ─── reducedMotion flag ──────────────────────────────────────────────

describe("reducedMotion", () => {
  it("defaults to false", () => {
    expect(getReducedMotion()).toBe(false);
  });

  it("can be set to true", () => {
    setReducedMotion(true);
    expect(getReducedMotion()).toBe(true);
  });

  it("can be toggled back to false", () => {
    setReducedMotion(true);
    setReducedMotion(false);
    expect(getReducedMotion()).toBe(false);
  });

  it("setting same value is idempotent", () => {
    setReducedMotion(true);
    setReducedMotion(true);
    expect(getReducedMotion()).toBe(true);
  });
});

// ─── ms() helper ─────────────────────────────────────────────────────

describe("ms()", () => {
  it("returns CSS duration for each token", () => {
    expect(ms("instant")).toBe("50ms");
    expect(ms("micro")).toBe("60ms");
    expect(ms("fast")).toBe("80ms");
    expect(ms("normal")).toBe("100ms");
    expect(ms("expand")).toBe("150ms");
    expect(ms("layout")).toBe("200ms");
    expect(ms("slow")).toBe("300ms");
  });

  it("returns '0ms' for all tokens when reduced motion is active", () => {
    setReducedMotion(true);
    const keys: TimingKey[] = [
      "instant", "micro", "fast", "normal", "expand", "layout", "slow",
    ];
    for (const k of keys) {
      expect(ms(k)).toBe("0ms");
    }
  });

  it("resumes normal durations after reduced motion is disabled", () => {
    setReducedMotion(true);
    expect(ms("fast")).toBe("0ms");
    setReducedMotion(false);
    expect(ms("fast")).toBe("80ms");
  });

  it("output ends with 'ms' suffix", () => {
    for (const k of Object.keys(timing) as TimingKey[]) {
      expect(ms(k)).toMatch(/^\d+ms$/);
    }
  });
});

// ─── easeRelease ─────────────────────────────────────────────────────

describe("easeRelease", () => {
  it("is a cubic-bezier string", () => {
    expect(easeRelease).toMatch(/^cubic-bezier\(.+\)$/);
  });

  it("has the correct value", () => {
    expect(easeRelease).toBe("cubic-bezier(0.34, 1.56, 0.64, 1)");
  });
});

// ─── cssTransition() ─────────────────────────────────────────────────

describe("cssTransition()", () => {
  it("builds a single-property transition string", () => {
    expect(cssTransition("transform", "release")).toBe(
      "transform 120ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    );
  });

  it("builds a multi-property transition string", () => {
    expect(cssTransition(["transform", "opacity"], "fast")).toBe(
      "transform 80ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 80ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    );
  });

  it("returns 0ms durations when reduced motion is active", () => {
    setReducedMotion(true);
    expect(cssTransition("transform", "release")).toBe(
      "transform 0ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    );
  });

  it("returns 0ms for multi-property when reduced motion is active", () => {
    setReducedMotion(true);
    expect(cssTransition(["transform", "opacity"], "fast")).toBe(
      "transform 0ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0ms cubic-bezier(0.34, 1.56, 0.64, 1)"
    );
  });

  it("works with all timing keys", () => {
    for (const k of Object.keys(timing) as TimingKey[]) {
      const result = cssTransition("opacity", k);
      expect(result).toContain(`${timing[k]}ms`);
      expect(result).toContain(easeRelease);
    }
  });
});
