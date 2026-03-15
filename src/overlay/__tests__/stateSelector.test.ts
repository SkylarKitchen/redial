/**
 * stateSelector.test.ts — Verify StateSelector options, default value,
 * onChange propagation, and scrub-guard behavior.
 *
 * Uses source-reading for static structure (the component isn't easily
 * renderable without Radix + DOM) and direct unit tests for the scrub guard.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isScrubActive, setScrubActive } from "../core/scrubState";

// ── Source reading helpers ──────────────────────────────────────────

const stateSelectorSrc = readFileSync(
  join(__dirname, "../shell/StateSelector.tsx"),
  "utf-8",
);

// ── Static structure tests ─────────────────────────────────────────

describe("StateSelector — static structure", () => {
  it("default value is 'none' (first entry in STATES array)", () => {
    // STATES[0] must be { value: "none", ... }
    expect(stateSelectorSrc).toMatch(/STATES:\s*StateOption\[\]\s*=\s*\[/);
    expect(stateSelectorSrc).toMatch(
      /\{\s*value:\s*"none"\s*,\s*label:\s*"None/,
    );
    // Verify "none" comes first
    const firstValueMatch = stateSelectorSrc.match(
      /STATES[^=]*=\s*\[\s*\{\s*value:\s*"([^"]+)"/,
    );
    expect(firstValueMatch).not.toBeNull();
    expect(firstValueMatch![1]).toBe("none");
  });

  it("contains all required pseudo-class options", () => {
    const required = [
      "none",
      "hover",
      "focus",
      "active",
      "visited",
      "focus-within",
      "focus-visible",
    ];
    for (const state of required) {
      expect(
        stateSelectorSrc,
        `Missing pseudo-class option: ${state}`,
      ).toContain(`value: "${state}"`);
    }
  });

  it("passes value and onChange to Radix Select", () => {
    // <Select value={value} onValueChange={onChange}>
    expect(stateSelectorSrc).toContain("value={value}");
    expect(stateSelectorSrc).toContain("onValueChange={onChange}");
  });

  it("shows 'State' label when value is base (none)", () => {
    // {isBase ? "State" : current.label}
    expect(stateSelectorSrc).toMatch(/isBase\s*\?\s*"State"/);
  });
});

// ── Scrub guard (mirrors Overlay.tsx handleStateChange) ────────────

/**
 * Overlay.tsx wraps StateSelector's onChange with a guard:
 *
 *   const handleStateChange = useCallback((newState: string) => {
 *     if (isScrubActive()) return;
 *     setActiveState(newState);
 *   }, []);
 *
 * We test this exact logic directly.
 */
function makeGuardedHandler() {
  const spy = vi.fn<(state: string) => void>();
  const handler = (newState: string) => {
    if (isScrubActive()) return;
    spy(newState);
  };
  return { handler, spy };
}

describe("StateSelector — scrub guard", () => {
  beforeEach(() => {
    setScrubActive(false);
  });

  it("fires callback when no scrub is active", () => {
    const { handler, spy } = makeGuardedHandler();
    handler("hover");
    expect(spy).toHaveBeenCalledWith("hover");
  });

  it("fires callback with each pseudo-class value", () => {
    const { handler, spy } = makeGuardedHandler();
    const states = ["none", "hover", "focus", "active", "visited", "focus-within", "focus-visible"];
    for (const state of states) {
      handler(state);
    }
    expect(spy).toHaveBeenCalledTimes(states.length);
    for (const state of states) {
      expect(spy).toHaveBeenCalledWith(state);
    }
  });

  it("blocks callback when scrub is active", () => {
    const { handler, spy } = makeGuardedHandler();
    setScrubActive(true);
    handler("hover");
    expect(spy).not.toHaveBeenCalled();
  });

  it("resumes normal operation after scrub ends", () => {
    const { handler, spy } = makeGuardedHandler();
    setScrubActive(true);
    handler("hover");
    expect(spy).not.toHaveBeenCalled();

    setScrubActive(false);
    handler("focus");
    expect(spy).toHaveBeenCalledWith("focus");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("drops events during scrub without queuing them", () => {
    const { handler, spy } = makeGuardedHandler();
    setScrubActive(true);
    handler("hover");
    handler("active");
    handler("visited");
    setScrubActive(false);
    // None of the mid-scrub calls should have been queued
    expect(spy).not.toHaveBeenCalled();
  });
});

// ── Overlay.tsx source verification ────────────────────────────────

describe("Overlay.tsx — scrub guard wiring", () => {
  const overlaySrc = readFileSync(
    join(__dirname, "../shell/Overlay.tsx"),
    "utf-8",
  );

  it("handleStateChange checks isScrubActive() before setting state", () => {
    expect(overlaySrc).toContain("if (isScrubActive()) return");
  });

  it("passes handleStateChange to Header's onStateChange prop", () => {
    expect(overlaySrc).toContain("onStateChange={handleStateChange}");
  });
});
