// @vitest-environment happy-dom
/**
 * Regression: the selected-element outline must re-sync when an engine edit
 * reflows the element WITHOUT mutating the element's own style/class attribute.
 *
 * The MutationObserver added in useElementTracker catches edits applied via
 * `element.style.setProperty(...)`, but it cannot see edits that change the
 * element's geometry from elsewhere:
 *   - a CSS variable edited on :root (or any ancestor scope) that the element
 *     consumes in a layout property (e.g. --gap -> margin), or
 *   - a stylesheet-rule / class-scope edit (CSS modes, CSS editor tab).
 * Those land on a DIFFERENT element's style attribute (or in the CSSOM, which
 * is not a DOM mutation at all), so without an engine-level signal the outline
 * stays on the element's stale position — the residual "not updating in real
 * time" case.
 *
 * apply.ts fires notifyListeners() on every override mutation (inline, custom
 * property, class-scope, undo/redo, reset). useSelectionOutline subscribes to
 * that signal (subscribeOverrides) so the outline re-syncs regardless of where
 * the bytes landed.
 *
 * This test drives the REAL engine: it selects an element, then edits a :root
 * CSS variable (which does not touch the selected element's attributes) and
 * asserts the outline follows the element's new rect. It fails until the
 * outline subscribes to the engine's change signal.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef, useState } from "react";
import { useSelectionOutline } from "../hooks/useSelectionOutline";
import { applyCustomProperty, resetAll } from "../core/apply";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

afterEach(() => {
  resetAll();
  document.documentElement.style.removeProperty("--gap");
  vi.restoreAllMocks();
});

function stubRect(el: Element, top: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      left: 10,
      width: 100,
      height: 20,
      bottom: top + 20,
      right: 110,
      x: 10,
      y: top,
      toJSON() {},
    }) as DOMRect;
}

interface Api {
  setSelectedEl: (el: Element | null) => void;
  bumpPanelKey: () => void;
  outlineRef: React.RefObject<HTMLDivElement | null>;
}

function Harness({ apiRef }: { apiRef: { current: Api | null } }) {
  const [selectedEl, setSelectedEl] = useState<Element | null>(null);
  const [panelKey, setPanelKey] = useState(0);

  const selectedOutlineRef = useRef<HTMLDivElement | null>(null);
  const dimensionsBadgeRef = useRef<HTMLDivElement | null>(null);
  const tagLabelRef = useRef<HTMLDivElement | null>(null);
  const ancestorOutlineRef = useRef<HTMLDivElement | null>(null);

  useSelectionOutline({
    selectedEl,
    selecting: false,
    hoveredAncestor: null,
    panelKey,
    selectedOutlineRef,
    dimensionsBadgeRef,
    tagLabelRef,
    ancestorOutlineRef,
  });

  apiRef.current = {
    setSelectedEl,
    bumpPanelKey: () => setPanelKey((k) => k + 1),
    outlineRef: selectedOutlineRef,
  };

  return selectedEl ? (
    <>
      <div ref={selectedOutlineRef} style={{ display: "none" }} />
      <div ref={dimensionsBadgeRef} style={{ display: "none" }} />
      <div ref={tagLabelRef} style={{ display: "none" }} />
      <div ref={ancestorOutlineRef} style={{ display: "none" }} />
    </>
  ) : null;
}

describe("selection outline — re-syncs on engine edits that don't touch the element's attrs", () => {
  it("follows the element after a :root CSS variable edit reflows it", () => {
    // Control rAF so the rAF-coalesced re-sync is deterministic.
    const rafQueue: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const flushRaf = () => rafQueue.splice(0).forEach((cb) => cb(0));

    const elA = document.createElement("div");
    document.body.appendChild(elA);
    stubRect(elA, 10);

    const apiRef: { current: Api | null } = { current: null };
    render(<Harness apiRef={apiRef} />);
    const api = apiRef.current!;

    // Select A and let the outline start tracking (mirror the refresh test's
    // panel-mount follow-up render).
    act(() => api.setSelectedEl(elA));
    act(() => api.bumpPanelKey());
    flushRaf();
    expect(api.outlineRef.current?.style.top).toBe("10px");

    // A :root variable edit reflows A to a new position. This does NOT mutate
    // A's own style/class attribute and we do not scroll — only the engine's
    // override-change signal can catch it.
    stubRect(elA, 80);
    act(() => applyCustomProperty(document.documentElement, "--gap", "40px"));
    flushRaf();

    expect(api.outlineRef.current?.style.top).toBe("80px");
  });
});
