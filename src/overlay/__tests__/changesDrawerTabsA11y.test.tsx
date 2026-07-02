// @vitest-environment happy-dom
/**
 * ChangesDrawer tab strip — keyboard accessibility (issue #85).
 *
 * The Pending/History pills were mouse-only <div onClick> surfaces: not
 * focusable, no keyboard activation, no ARIA state. They must be native
 * <button>s with genuine tab-strip semantics — role="tablist" wrapper,
 * role="tab" pills, aria-selected — so they are Tab-reachable and activate
 * on Enter AND Space (native <button> platform behavior).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ChangesDrawer, type HistoryEntry } from "../shell/ChangesDrawer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
});

afterEach(() => {
  cleanup();
  styleEngine.resetAll();
  resetAllModeOverrides();
});

const baseProps = {
  open: true as const,
  onResetAll: () => {},
  entries: [] as HistoryEntry[],
  onUndoToIndex: () => {},
  onClose: () => {},
};

describe("ChangesDrawer tabs a11y", () => {
  it("renders the tab strip with role='tablist'", () => {
    render(<ChangesDrawer {...baseProps} />);
    expect(screen.getByRole("tablist")).toBeTruthy();
  });

  it("Pending and History are keyboard-focusable native buttons with role='tab'", () => {
    render(<ChangesDrawer {...baseProps} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Pending", "History"]);
    for (const tab of tabs) {
      // Native <button> ⇒ in the tab order and activates on Enter AND Space.
      expect(tab.tagName).toBe("BUTTON");
      expect(tab.tabIndex).toBe(0);
      (tab as HTMLElement).focus();
      expect(document.activeElement).toBe(tab);
    }
  });

  it("aria-selected reflects the active tab and flips on switch (controlled)", () => {
    const onTabChange = vi.fn();
    const { rerender } = render(
      <ChangesDrawer {...baseProps} tab="pending" onTabChange={onTabChange} />,
    );
    const [pending, history] = screen.getAllByRole("tab");
    expect(pending.getAttribute("aria-selected")).toBe("true");
    expect(history.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(history);
    expect(onTabChange).toHaveBeenCalledWith("history");

    rerender(<ChangesDrawer {...baseProps} tab="history" onTabChange={onTabChange} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0].getAttribute("aria-selected")).toBe("false");
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
  });

  it("activating the History tab after keyboard focus switches content (uncontrolled)", () => {
    const entries: HistoryEntry[] = [
      { timestamp: Date.now(), property: "color", from: "a", to: "b", selector: ".x" },
    ];
    render(<ChangesDrawer {...baseProps} entries={entries} />);
    const history = screen.getAllByRole("tab")[1];
    (history as HTMLElement).focus();
    expect(document.activeElement).toBe(history);
    // happy-dom doesn't synthesize click from Enter/Space on native buttons;
    // the platform guarantees that for <button>, so activate via click here.
    fireEvent.click(history);
    expect(screen.getByText("Undo to here")).toBeTruthy();
  });

  it("mouse behavior is unchanged: clicking a pill switches tabs", () => {
    const onTabChange = vi.fn();
    render(<ChangesDrawer {...baseProps} tab="pending" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("History"));
    expect(onTabChange).toHaveBeenCalledWith("history");
  });
});
