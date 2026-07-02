// @vitest-environment happy-dom
/**
 * breakpointViewportMismatch.test.tsx — audit gap #12 (two trust bugs):
 *
 *  1. NO MISMATCH SIGNAL: the breakpoint preview is genuinely media-gated
 *     (breakpointPreview.ts), but the selector never checks matchMedia — with
 *     a 1000px viewport and "≥ 1280" active, every slider drag changes
 *     nothing on the page and nothing says why. The fix renders a compact
 *     warning line ([data-breakpoint-mismatch]) next to the selector whenever
 *     the active breakpoint's media query does NOT match the viewport, and
 *     keeps it live across window resizes.
 *
 *  2. STALE BREAKPOINT SURVIVES CLOSE: handleClose (useElementSelection)
 *     resets scope/class/state but not the active breakpoint — reopening the
 *     panel later silently keys new edits to the stale breakpoint. The fix
 *     resets it to base whenever the selection clears.
 *
 * RED pre-fix: (1) BreakpointSelector renders no warning element at all;
 * (2) after close → reopen, the header selector still shows "≥ 1280".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { BreakpointSelector } from "../shell/BreakpointSelector";
import { Overlay } from "../shell/Overlay";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

// Heavy panel children not under test — keep the mounted tree light and
// deterministic (overlaySaveShortcut.test.tsx pattern).
vi.mock("../shell/WebflowPanel", () => ({ WebflowPanel: () => null }));
vi.mock("../shell/PromptPanel", () => ({ PromptPanel: () => null }));
vi.mock("../variables/GlobalVariablesPanel", () => ({ GlobalVariablesPanel: () => null }));
vi.mock("../navigator/NavigatorPanel", () => ({ NavigatorPanel: () => null }));

function setViewportWidth(w: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
}

/** matchMedia stub that really evaluates `(min-width: Npx)` against the
 *  CURRENT window.innerWidth at call time (happy-dom's own implementation is
 *  not viewport-driven enough to rely on here). */
function stubMatchMedia() {
  vi.stubGlobal("matchMedia", (query: string): MediaQueryList => {
    const m = /\(min-width:\s*([\d.]+)px\)/.exec(query);
    return {
      matches: m ? window.innerWidth >= parseFloat(m[1]) : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  });
}

function mismatchWarning(): Element | null {
  return document.querySelector("[data-breakpoint-mismatch]");
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  try { localStorage.clear(); } catch { /* ignore */ }
  setViewportWidth(1024);
  stubMatchMedia();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

// ─── Bug 1: viewport-mismatch warning on the selector ────────────────────────

describe("breakpoint viewport-mismatch warning (audit #12, bug 1)", () => {
  it("warns when the active min-width breakpoint exceeds the viewport", () => {
    setViewportWidth(1000);
    render(<BreakpointSelector value="1280" onChange={() => {}} />);
    const warning = mismatchWarning();
    expect(warning).not.toBeNull();
    // The message must explain BOTH sides: current viewport + required width.
    expect(warning!.textContent).toMatch(/1000px/);
    expect(warning!.textContent).toMatch(/1280px/);
  });

  it("renders no warning when the viewport satisfies the breakpoint", () => {
    setViewportWidth(1500);
    render(<BreakpointSelector value="1280" onChange={() => {}} />);
    expect(mismatchWarning()).toBeNull();
  });

  it("never warns on the base breakpoint, even at a tiny viewport", () => {
    setViewportWidth(320);
    render(<BreakpointSelector value="base" onChange={() => {}} />);
    expect(mismatchWarning()).toBeNull();
  });

  it("updates live when the window resizes across the boundary", async () => {
    setViewportWidth(1000);
    render(<BreakpointSelector value="1280" onChange={() => {}} />);
    expect(mismatchWarning()).not.toBeNull();

    setViewportWidth(1400);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(mismatchWarning()).toBeNull();

    setViewportWidth(900);
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(mismatchWarning()).not.toBeNull();
  });
});

// ─── Bug 2: active breakpoint resets when the panel closes ────────────────────

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

function makeEl(): HTMLElement {
  const el = document.createElement("div");
  el.id = "bp-close-target";
  document.body.appendChild(el);
  return el;
}

async function selectEl(el: HTMLElement) {
  await act(async () => {
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    await flushMicrotasks();
  });
}

describe("active breakpoint resets on panel close (audit #12, bug 2)", () => {
  it("close (Escape) → reopen: the active breakpoint is back to Base", async () => {
    const el = makeEl();
    render(<Overlay />);
    await selectEl(el);

    // Activate ≥ 1280 via the real header selector.
    fireEvent.click(screen.getByTitle("Target breakpoint"));
    fireEvent.click(screen.getByText("≥ 1280"));
    expect(screen.getByTitle("Target breakpoint").textContent).toContain("≥ 1280");

    // Close the panel — no unsaved changes, so Escape closes immediately.
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
      await flushMicrotasks();
    });
    await waitFor(() => expect(screen.queryByTitle("Target breakpoint")).toBeNull());

    // Reopen on the same element — a stale "≥ 1280" here is exactly the
    // audited bug: new edits would silently target the old breakpoint.
    await selectEl(el);
    await waitFor(() =>
      expect(screen.getByTitle("Target breakpoint").textContent).toContain("Base"),
    );
  });
});
