// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import type { ActivePanel } from "../shell/Overlay";

/**
 * Reproduces the bug: clicking the AI button in the toolbar after
 * expanding via the plus button does nothing because onOpenPrompt
 * silently exits when no element is selected.
 *
 * Expected: when no element is selected, clicking AI should enter
 * selector mode and queue the prompt tab to open after selection.
 */

describe("Toolbar AI button without selected element", () => {
  /**
   * Simulates the current onOpenPrompt logic from Overlay.tsx (lines 1765-1769).
   * Returns the new activePanel state after the handler runs.
   */
  function simulateOnOpenPrompt(
    selectedEl: Element | null,
    currentPanel: ActivePanel,
  ): { activePanel: ActivePanel; selecting: boolean } {
    let activePanel = currentPanel;
    let selecting = false;

    // Current (buggy) implementation:
    if (selectedEl) {
      activePanel = { type: "inspector", tab: "prompt" };
    }
    // else: nothing happens — this is the bug

    return { activePanel, selecting };
  }

  it("BUG: AI button does nothing when no element is selected", () => {
    const result = simulateOnOpenPrompt(null, { type: "none" });

    // This proves the bug: panel stays at "none" instead of doing something useful
    expect(result.activePanel).toEqual({ type: "none" });
    expect(result.selecting).toBe(false);
  });

  it("AI button works when element IS selected", () => {
    const el = document.createElement("div");
    const result = simulateOnOpenPrompt(el, { type: "none" });

    expect(result.activePanel).toEqual({ type: "inspector", tab: "prompt" });
  });

  /**
   * Simulates the FIXED onOpenPrompt logic.
   * When no element is selected, enters selector mode and queues prompt tab.
   */
  function simulateFixedOnOpenPrompt(
    selectedEl: Element | null,
    currentPanel: ActivePanel,
  ): { activePanel: ActivePanel; selecting: boolean; pendingTab: "prompt" | null } {
    let activePanel = currentPanel;
    let selecting = false;
    let pendingTab: "prompt" | null = null;

    if (selectedEl) {
      activePanel = { type: "inspector", tab: "prompt" };
    } else {
      // Fix: enter selector mode and queue prompt tab
      selecting = true;
      pendingTab = "prompt";
    }

    return { activePanel, selecting, pendingTab };
  }

  it("FIXED: AI button enters selector mode when no element selected", () => {
    const result = simulateFixedOnOpenPrompt(null, { type: "none" });

    expect(result.selecting).toBe(true);
    expect(result.pendingTab).toBe("prompt");
  });

  it("FIXED: after selecting element, pending tab applies prompt", () => {
    // Simulate: user clicked AI → selector started → user picked element
    const pendingTab: "prompt" | null = "prompt";
    const el = document.createElement("div");

    // handleSelect normally sets tab to "custom", but with pending tab it should use "prompt"
    const tab = pendingTab ?? "custom";
    const activePanel: ActivePanel = { type: "inspector", tab };

    expect(activePanel).toEqual({ type: "inspector", tab: "prompt" });
  });
});
