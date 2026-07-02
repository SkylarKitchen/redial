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

// StateSelector is now a thin declaration; implementation details live in
// PortalListboxSelect (extracted by code-review step 8 refactor).
const stateSelectorSrc = readFileSync(
  join(__dirname, "../shell/StateSelector.tsx"),
  "utf-8",
);
const portalListboxSrc = readFileSync(
  join(__dirname, "../controls/PortalListboxSelect.tsx"),
  "utf-8",
);

// ── Static structure tests ─────────────────────────────────────────

describe("StateSelector — static structure", () => {
  it("default value is 'none' (first entry in STATE_OPTIONS array)", () => {
    // STATE_OPTIONS[0] must be { id: "none", ... }
    expect(stateSelectorSrc).toMatch(/STATE_OPTIONS\s*=\s*\[/);
    expect(stateSelectorSrc).toMatch(
      /\{\s*id:\s*"none"\s*,\s*label:\s*"None/,
    );
    // Verify "none" comes first
    const firstValueMatch = stateSelectorSrc.match(
      /STATE_OPTIONS[^=]*=\s*\[\s*\{\s*id:\s*"([^"]+)"/,
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
      "focus-within",
      "focus-visible",
    ];
    for (const state of required) {
      expect(
        stateSelectorSrc,
        `Missing pseudo-class option: ${state}`,
      ).toContain(`id: "${state}"`);
    }
  });

  it("does NOT offer :visited (browser privacy restrictions make it unpreviewable)", () => {
    // Browsers deliberately break :visited introspection to stop history
    // sniffing: getComputedStyle reports unvisited values for visited-only
    // styles and the state cannot be force-rendered, so previewing/forcing
    // it in the panel is impossible. Offering it was a dead option.
    expect(stateSelectorSrc).not.toContain('id: "visited"');
  });

  it("does not contain first-child / last-child structural selectors", () => {
    // Webflow does not treat these as states — they were removed from STATE_OPTIONS.
    expect(stateSelectorSrc).not.toContain("first-child");
    expect(stateSelectorSrc).not.toContain("last-child");
  });

  it("wires value/onChange through the portal-dropdown pattern (no shadcn Select)", () => {
    // Reimplemented on PortalListboxSelect (uses usePortalDropdown internally).
    expect(stateSelectorSrc).not.toContain("@/components/ui/select");
    expect(portalListboxSrc).toContain("usePortalDropdown");
    // value drives the active option; onChange fires on select.
    expect(stateSelectorSrc).toContain("onChange={onChange}");
  });

  it("portal carries data-tuner-portal and max z-index", () => {
    expect(portalListboxSrc).toContain("data-tuner-portal");
    expect(portalListboxSrc).toContain("zIndex: zIndex.max");
  });

  it("shows 'State' label when value is base (none)", () => {
    // baseTriggerLabel="State" passed to PortalListboxSelect
    expect(stateSelectorSrc).toContain('baseTriggerLabel="State"');
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
    // The selectable states — no "visited": unpreviewable (browser privacy).
    const states = ["none", "hover", "focus", "active", "focus-within", "focus-visible"];
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
    handler("focus-visible");
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
