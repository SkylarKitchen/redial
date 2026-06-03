/**
 * scrubState.subscribeScrubState — turns the polled scrub/hover flags into an
 * event source.
 *
 * The spacing overlays (SpacingGuidesOverlay, SpacingPreviewOverlay) used a
 * perpetual rAF loop partly to notice when getScrubGroup()/getHoverGroup()
 * changed — neither fires a DOM event. Once those overlays move to the
 * event-driven element tracker, they need an explicit signal when the scrub or
 * hover group changes, or they go stale on hover. subscribeScrubState provides
 * it: every setter notifies subscribers and returns an unsubscribe.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import {
  subscribeScrubState,
  setScrubGroup,
  setHoverGroup,
  setScrubActive,
} from "../core/scrubState";

afterEach(() => {
  setScrubGroup(null);
  setHoverGroup(null);
  setScrubActive(false);
  vi.restoreAllMocks();
});

describe("subscribeScrubState", () => {
  it("notifies subscribers when the scrub group changes", () => {
    const cb = vi.fn();
    subscribeScrubState(cb);
    setScrubGroup("margin");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers when the hover group changes", () => {
    const cb = vi.fn();
    subscribeScrubState(cb);
    setHoverGroup("padding");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("notifies subscribers when the scrub-active flag changes", () => {
    const cb = vi.fn();
    subscribeScrubState(cb);
    setScrubActive(true);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("returns an unsubscribe that stops further notifications", () => {
    const cb = vi.fn();
    const unsubscribe = subscribeScrubState(cb);
    unsubscribe();
    setScrubGroup("padding");
    expect(cb).not.toHaveBeenCalled();
  });

  it("supports multiple independent subscribers", () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribeScrubState(a);
    subscribeScrubState(b);
    setHoverGroup("margin");
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
