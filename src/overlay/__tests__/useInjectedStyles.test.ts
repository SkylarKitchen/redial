// @vitest-environment happy-dom
/**
 * Issue #106 — behavioral coverage for src/overlay/hooks/useInjectedStyles.ts.
 *
 * The hook injects two managedSheet (ADR-0009) sheets on mount — the Next.js
 * dev-overlay z-index tamer and the focus-ring/pulse styles — and disposes
 * both on unmount. Assertions go through `_readManagedSheetCss` (the
 * source-text reader) plus `document.adoptedStyleSheets` registration, since
 * happy-dom supports constructable stylesheets.
 */
import { describe, it, expect, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useInjectedStyles } from "../hooks/useInjectedStyles";
import { _readManagedSheetCss } from "../core/managedSheet";
import { color } from "../theme";

const Z_KEY = "next-overlay-z-index";
const FOCUS_KEY = "focus-rings-and-pulse";

let active: { unmount: () => void } | null = null;

function mount() {
  active = renderHook(() => useInjectedStyles());
  return active;
}

afterEach(() => {
  active?.unmount();
  active = null;
});

describe("useInjectedStyles", () => {
  it("injects the Next.js dev-overlay z-index sheet on mount", () => {
    mount();
    const css = _readManagedSheetCss(Z_KEY);
    expect(css).not.toBeNull();
    expect(css).toContain("nextjs-portal");
    expect(css).toContain("z-index: 2147483640 !important");
  });

  it("injects focus-ring and outline-pulse styles scoped to the tuner root", () => {
    mount();
    const css = _readManagedSheetCss(FOCUS_KEY);
    expect(css).not.toBeNull();
    expect(css).toContain(".__tuner-root *:focus-visible");
    expect(css).toContain("@keyframes tuner-outline-pulse");
    expect(css).toContain(".__tuner-drag-handle");
    // The ring color must come from the theme, not a hardcoded value.
    expect(css).toContain(color.ring);
  });

  it("registers both sheets on document.adoptedStyleSheets", () => {
    const before = document.adoptedStyleSheets.length;
    mount();
    expect(document.adoptedStyleSheets.length).toBe(before + 2);
  });

  it("removes both sheets on unmount", () => {
    const before = document.adoptedStyleSheets.length;
    const { unmount } = mount();
    unmount();
    active = null;

    expect(_readManagedSheetCss(Z_KEY)).toBeNull();
    expect(_readManagedSheetCss(FOCUS_KEY)).toBeNull();
    expect(document.adoptedStyleSheets.length).toBe(before);
  });

  it("re-injects cleanly on a remount after unmount", () => {
    const first = mount();
    first.unmount();
    active = null;
    expect(_readManagedSheetCss(Z_KEY)).toBeNull();

    mount();
    expect(_readManagedSheetCss(Z_KEY)).toContain("nextjs-portal");
    expect(_readManagedSheetCss(FOCUS_KEY)).toContain(".__tuner-root");
  });

  it("does not duplicate sheets when the hook re-renders", () => {
    const before = document.adoptedStyleSheets.length;
    const { rerender, unmount } = renderHook(() => useInjectedStyles());
    active = { unmount };
    rerender();
    rerender();
    expect(document.adoptedStyleSheets.length).toBe(before + 2);
  });
});
