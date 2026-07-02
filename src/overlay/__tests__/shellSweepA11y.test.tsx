// @vitest-environment happy-dom
/**
 * Shell sweep — keyboard accessibility for remaining mouse-only surfaces
 * (issue #85). Found by the onClick sweep of src/overlay/shell/:
 *
 *   - Toolbar.tsx — the FAB (Plus icon) is a motion.div with onClick only.
 *     It is THE entry point to the whole panel and was unreachable by
 *     keyboard. Fix: role="button" + tabIndex + Enter/Space + aria-label.
 *   - InspectorTabBar.tsx — the "Focus Mode" pill (exits focus mode) was a
 *     mouse-only <span onClick>. Fix: native <button>.
 *   - HintBar.tsx — the dismissible shortcut hint strip was a mouse-only
 *     motion.div. Fix: role="button" + tabIndex + Enter/Space + aria-label.
 *
 * (Header.tsx's changes badge and scope pills are excluded — owned by a
 * separate agent/task.)
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Toolbar } from "../shell/Toolbar";
import { InspectorTabBar } from "../shell/InspectorTabBar";
import { HintBar } from "../shell/HintBar";
import type { ActivePanel } from "../shell/overlayTypes";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

// ─── Toolbar FAB ──────────────────────────────────────────────────────

describe("Toolbar FAB a11y", () => {
  function renderToolbar() {
    const onToggleSelecting = vi.fn();
    render(
      <Toolbar
        selecting={false}
        hasSelectedEl={false}
        activePanel={{ type: "none" } as ActivePanel}
        changesOpen={false}
        onToggleSelecting={onToggleSelecting}
        onOpenVariables={vi.fn()}
        onOpenPrompt={vi.fn()}
        onToggleSession={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    return { onToggleSelecting };
  }

  function fab(): HTMLElement {
    return screen.getByLabelText("Inspect element");
  }

  it("FAB is focusable with role='button' and an aria-label", () => {
    renderToolbar();
    const el = fab();
    expect(el.getAttribute("role")).toBe("button");
    expect(el.tabIndex).toBe(0);
    el.focus();
    expect(document.activeElement).toBe(el);
  });

  it("Enter activates the FAB (enters select mode)", () => {
    const { onToggleSelecting } = renderToolbar();
    fireEvent.keyDown(fab(), { key: "Enter" });
    expect(onToggleSelecting).toHaveBeenCalledTimes(1);
  });

  it("Space activates the FAB", () => {
    const { onToggleSelecting } = renderToolbar();
    fireEvent.keyDown(fab(), { key: " " });
    expect(onToggleSelecting).toHaveBeenCalledTimes(1);
  });

  it("mouse click behavior is unchanged", () => {
    const { onToggleSelecting } = renderToolbar();
    fireEvent.click(fab());
    expect(onToggleSelecting).toHaveBeenCalledTimes(1);
  });
});

// ─── InspectorTabBar Focus Mode pill ─────────────────────────────────

describe("InspectorTabBar Focus Mode pill a11y", () => {
  it("is a keyboard-focusable native button that exits focus mode", () => {
    const onExitFocus = vi.fn();
    render(
      <InspectorTabBar
        activePanel={{ type: "inspector", tab: "custom" } as ActivePanel}
        onSelectTab={vi.fn()}
        focusMode={true}
        onExitFocus={onExitFocus}
      />,
    );
    const pill = screen.getByText("Focus Mode").closest("button") as HTMLElement;
    expect(pill, "'Focus Mode' pill must be a <button>").toBeTruthy();
    expect(pill.tabIndex).toBe(0);
    pill.focus();
    expect(document.activeElement).toBe(pill);
    fireEvent.click(pill);
    expect(onExitFocus).toHaveBeenCalledTimes(1);
  });
});

// ─── HintBar ──────────────────────────────────────────────────────────

describe("HintBar dismiss a11y", () => {
  it("hint strip is focusable with role='button'", () => {
    render(<HintBar show={true} onDismiss={vi.fn()} />);
    const bar = screen.getByRole("button");
    expect(bar.tabIndex).toBe(0);
    bar.focus();
    expect(document.activeElement).toBe(bar);
  });

  it("Enter and Space dismiss the hint; click is unchanged", () => {
    const onDismiss = vi.fn();
    render(<HintBar show={true} onDismiss={onDismiss} />);
    const bar = screen.getByRole("button");
    fireEvent.keyDown(bar, { key: "Enter" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(bar, { key: " " });
    expect(onDismiss).toHaveBeenCalledTimes(2);
    fireEvent.click(bar);
    expect(onDismiss).toHaveBeenCalledTimes(3);
  });
});
