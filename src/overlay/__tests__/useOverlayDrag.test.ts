// @vitest-environment happy-dom
/**
 * Issue #106 — behavioral coverage for src/overlay/hooks/useOverlayDrag.ts.
 *
 * Covers: initial position/anchor, panel-width derivation, the drag
 * interaction (start → document mousemove → mouseup), viewport clamping,
 * edge snapping (left/right/none) with the transient `snapping` flag,
 * listener teardown after mouseup, resize re-anchoring, panel-type width
 * switching, and unmount cleanup.
 *
 * happy-dom default viewport: 1024 × 768. Inspector panel width: 300.
 * Constants from the hook: SNAP_THRESHOLD 20, SNAP_MARGIN 16,
 * PANEL_HEIGHT_ESTIMATE 500.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useOverlayDrag } from "../hooks/useOverlayDrag";
import { getVariablesPanelWidth } from "../variables/panelWidth";

function setViewport(w: number, h: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: w });
  Object.defineProperty(window, "innerHeight", { configurable: true, writable: true, value: h });
}

function startDrag(result: { current: ReturnType<typeof useOverlayDrag> }, x: number, y: number) {
  act(() => {
    result.current.handleDragStart({ clientX: x, clientY: y } as unknown as React.MouseEvent);
  });
}

function moveTo(x: number, y: number) {
  act(() => {
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: x, clientY: y }));
  });
}

function release() {
  act(() => {
    document.dispatchEvent(new MouseEvent("mouseup"));
  });
}

beforeEach(() => {
  setViewport(1024, 768);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useOverlayDrag — initial state", () => {
  it("starts snapped to the top-right corner, anchored right", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    expect(result.current.pos).toEqual({ x: 1024 - 300 - 16, y: 16 }); // 708, 16
    expect(result.current.anchor).toBe("right");
    expect(result.current.panelWidth).toBe(300);
    expect(result.current.panelDragging).toBe(false);
    expect(result.current.snapping).toBe(false);
  });

  it("derives the variables panel width from the mode count", () => {
    const { result } = renderHook(() => useOverlayDrag("variables", 2));
    // BASE 340 + 2×136 = 612 (above the 580 min, below the 819px 80vw cap)
    expect(result.current.panelWidth).toBe(612);
    expect(result.current.panelWidth).toBe(getVariablesPanelWidth(2));
  });
});

describe("useOverlayDrag — drag interaction", () => {
  it("dragStart sets panelDragging; mousemove offsets the position by the pointer delta", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));

    startDrag(result, 500, 300);
    expect(result.current.panelDragging).toBe(true);

    moveTo(450, 350); // delta (-50, +50) from origin (708, 16)
    expect(result.current.pos).toEqual({ x: 658, y: 66 });

    release();
    expect(result.current.panelDragging).toBe(false);
  });

  it("clamps the position to the viewport during the drag", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);

    moveTo(-5000, -5000);
    expect(result.current.pos).toEqual({ x: 0, y: 0 });

    moveTo(5000, 5000);
    // x max = innerWidth - PANEL_WIDTH = 724; y max = innerHeight - 100 = 668
    expect(result.current.pos).toEqual({ x: 724, y: 668 });
    release();
  });

  it("releasing mid-viewport clears the edge anchor and does not snap", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);
    moveTo(300, 400); // → pos (508, 116): far from every edge
    release();

    expect(result.current.pos).toEqual({ x: 508, y: 116 });
    expect(result.current.anchor).toBeNull();
    expect(result.current.snapping).toBe(false);
  });

  it("stops tracking mousemove after mouseup (document listeners removed)", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);
    moveTo(300, 400);
    release();

    const settled = result.current.pos;
    moveTo(100, 100); // must be ignored — the drag ended
    expect(result.current.pos).toEqual(settled);
  });
});

describe("useOverlayDrag — edge snapping on release", () => {
  it("snaps to the right edge within the threshold and re-anchors right", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);
    moveTo(510, 400); // → x 718, inside right snap zone (≥ 1024-300-20 = 704)
    release();

    expect(result.current.pos.x).toBe(1024 - 300 - 16); // 708
    expect(result.current.anchor).toBe("right");
    expect(result.current.snapping).toBe(true);

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current.snapping).toBe(false);
  });

  it("snaps to the left edge and the top margin", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);
    moveTo(-190, 290); // → x 10 (≤ 20), y 6 (≤ 20)
    release();

    expect(result.current.pos).toEqual({ x: 16, y: 16 });
    expect(result.current.anchor).toBe("left");
  });
});

describe("useOverlayDrag — viewport resize and panel-type switch", () => {
  it("re-anchors to the right edge when the window resizes", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    expect(result.current.anchor).toBe("right");

    act(() => {
      setViewport(800, 768);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.pos.x).toBe(800 - 300 - 16); // 484
  });

  it("keeps a left-anchored panel pinned left on resize", () => {
    const { result } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);
    moveTo(-200, 300);
    release();
    expect(result.current.anchor).toBe("left");

    act(() => {
      setViewport(800, 768);
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current.pos.x).toBe(16);
  });

  it("switching to the variables panel widens it and keeps the right edge pinned", () => {
    const { result, rerender } = renderHook(
      ({ type, count }: { type: string; count: number }) => useOverlayDrag(type, count),
      { initialProps: { type: "inspector", count: 0 } },
    );
    expect(result.current.pos.x).toBe(708);

    rerender({ type: "variables", count: 3 });
    // width 340 + 3×136 = 748 → right-anchored x = 1024 - 748 - 16 = 260
    expect(result.current.panelWidth).toBe(748);
    expect(result.current.pos.x).toBe(260);
  });

  it("removes the resize listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOverlayDrag("inspector", 0));
    unmount();
    expect(removeSpy.mock.calls.some(([type]) => type === "resize")).toBe(true);
    removeSpy.mockRestore();
  });
});

describe("useOverlayDrag — mid-drag unmount cleanup", () => {
  // Unmounting while a drag is in flight used to orphan the document
  // mousemove/mouseup listeners: they only self-removed on the NEXT mouseup,
  // and until then every mousemove called a setPos on an unmounted hook.
  it("removes the exact document mousemove/mouseup handlers when unmounted mid-drag", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { result, unmount } = renderHook(() => useOverlayDrag("inspector", 0));

    startDrag(result, 500, 300);
    const added = addSpy.mock.calls.filter(
      ([type]) => type === "mousemove" || type === "mouseup",
    );
    expect(added.map(([type]) => type).sort()).toEqual(["mousemove", "mouseup"]);

    unmount(); // mid-drag — no mouseup ever fired

    for (const [type, handler] of added) {
      expect(
        removeSpy.mock.calls.some(([t, h]) => t === type && h === handler),
        `${String(type)} listener not removed on unmount`,
      ).toBe(true);
    }

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("post-unmount mouse events are inert (leaked handlers would fire; cleaned ones cannot)", () => {
    const { result, unmount } = renderHook(() => useOverlayDrag("inspector", 0));
    startDrag(result, 500, 300);

    const removeSpy = vi.spyOn(document, "removeEventListener");
    unmount();
    const removedDuringUnmount = removeSpy.mock.calls.filter(
      ([type]) => type === "mousemove" || type === "mouseup",
    ).length;
    expect(removedDuringUnmount).toBeGreaterThanOrEqual(2);

    // A leaked mouseup handler would run the snap logic and re-call
    // document.removeEventListener for both listeners a second time.
    removeSpy.mockClear();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 10 }));
    document.dispatchEvent(new MouseEvent("mouseup"));
    const firedAfterUnmount = removeSpy.mock.calls.filter(
      ([type]) => type === "mousemove" || type === "mouseup",
    ).length;
    expect(firedAfterUnmount).toBe(0);

    removeSpy.mockRestore();
  });
});
