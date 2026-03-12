import { describe, it, expect, beforeEach } from "vitest";
import {
  timing,
  type TimingKey,
  setReducedMotion,
  getReducedMotion,
  ms,
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
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(timing[ordered[i]]).toBeGreaterThanOrEqual(timing[ordered[i - 1]]);
    }
  });

  it("instant is the smallest", () => {
    expect(timing.instant).toBe(50);
  });

  it("slow is the largest", () => {
    expect(timing.slow).toBe(300);
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
