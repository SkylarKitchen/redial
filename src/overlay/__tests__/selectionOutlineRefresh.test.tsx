// @vitest-environment happy-dom
/**
 * Regression test: the selected-element outline must REFRESH when the user
 * switches elements via the selector, without first deselecting/reselecting.
 *
 * Reported bug: "the blue border doesn't refresh until I deselect and
 * reselect." Switching from element A to element B leaves the outline stuck
 * (hidden / on A's old rect) until an unrelated re-render happens to occur.
 *
 * Root cause: useSelectionOutline gates useElementTracker's `enabled` arg on
 * `!!selectedOutlineRef.current` — a REF read at render time. The tracker
 * effect only re-runs on `[element, enabled]` changes, and ref attachment
 * never triggers a re-render. On a switch, the selector toggles `selecting`
 * true (the outline <div> unmounts, ref -> null) then `handleSelect` batches
 * `selecting=false` + `selectedEl=B` into one render where the ref is still
 * null. `enabled` computes false, the effect bails, and nothing schedules a
 * follow-up render to re-evaluate it. The outline never tracks B.
 *
 * This harness mirrors Overlay.tsx's conditional render of the outline <div>
 * (`{selectedEl && !selecting && <div ref={selectedOutlineRef} .../>}`) and
 * drives the exact transition that fails in the real app.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { render, act } from "@testing-library/react";
import { useRef, useState } from "react";
import { useSelectionOutline } from "../hooks/useSelectionOutline";

// happy-dom may not ship ResizeObserver; the tracker constructs one.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

/** Give an element a deterministic, distinct bounding rect. */
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
  setSelecting: (v: boolean) => void;
  bumpPanelKey: () => void;
  outlineRef: React.RefObject<HTMLDivElement | null>;
}

function Harness({ apiRef }: { apiRef: { current: Api | null } }) {
  const [selectedEl, setSelectedEl] = useState<Element | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [panelKey, setPanelKey] = useState(0);

  const selectedOutlineRef = useRef<HTMLDivElement | null>(null);
  const dimensionsBadgeRef = useRef<HTMLDivElement | null>(null);
  const tagLabelRef = useRef<HTMLDivElement | null>(null);
  const ancestorOutlineRef = useRef<HTMLDivElement | null>(null);

  useSelectionOutline({
    selectedEl,
    selecting,
    hoveredAncestor: null,
    panelKey,
    selectedOutlineRef,
    dimensionsBadgeRef,
    tagLabelRef,
    ancestorOutlineRef,
  });

  apiRef.current = {
    setSelectedEl,
    setSelecting,
    bumpPanelKey: () => setPanelKey((k) => k + 1),
    outlineRef: selectedOutlineRef,
  };

  // Mirror Overlay.tsx:820 — outline <div> only exists while a non-selecting
  // element is selected, so it unmounts (ref -> null) whenever selecting=true.
  return selectedEl && !selecting ? (
    <>
      <div ref={selectedOutlineRef} style={{ display: "none" }} />
      <div ref={dimensionsBadgeRef} style={{ display: "none" }} />
      <div ref={tagLabelRef} style={{ display: "none" }} />
      <div ref={ancestorOutlineRef} style={{ display: "none" }} />
    </>
  ) : null;
}

describe("selection outline refresh on element switch", () => {
  it("tracks the new element when switching via the selector", () => {
    const elA = document.createElement("div");
    const elB = document.createElement("p");
    document.body.append(elA, elB);
    stubRect(elA, 10);
    stubRect(elB, 200);

    const apiRef: { current: Api | null } = { current: null };
    render(<Harness apiRef={apiRef} />);
    const api = apiRef.current!;

    // 1. Select A. (Extra render mimics the panel-mount follow-up that lets
    //    first-selection work in the real app, so A's outline starts tracking.)
    act(() => api.setSelectedEl(elA));
    act(() => api.bumpPanelKey());
    expect(api.outlineRef.current?.style.top).toBe("10px");

    // 2. Switch to B via the selector: selecting=true unmounts the outline...
    act(() => api.setSelecting(true));
    // ...then handleSelect batches selecting=false + selectedEl=B in one render.
    act(() => {
      api.setSelecting(false);
      api.setSelectedEl(elB);
    });

    // 3. The outline must now follow B — no deselect/reselect required.
    expect(api.outlineRef.current?.style.display).toBe("block");
    expect(api.outlineRef.current?.style.top).toBe("200px");
  });
});
