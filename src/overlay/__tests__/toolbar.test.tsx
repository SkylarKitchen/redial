// @vitest-environment happy-dom
/**
 * Toolbar — the expandable FAB that hosts the Select / Variables / AI / Changes
 * mode buttons (the "bottom bar" verified live in /demo).
 *
 * Verified behaviors: the four mode buttons render when expanded, each fires its
 * callback, and the active (aria-pressed) state reflects which panel/mode is open.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Toolbar } from "../shell/Toolbar";
import type { ActivePanel } from "../shell/overlayTypes";

afterEach(cleanup);

function renderToolbar(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const handlers = {
    onToggleSelecting: vi.fn(),
    onOpenVariables: vi.fn(),
    onOpenPrompt: vi.fn(),
    onToggleSession: vi.fn(),
    onClose: vi.fn(),
  };
  render(
    <Toolbar
      selecting={false}
      // hasSelectedEl forces `expanded` so the mode buttons are mounted.
      hasSelectedEl={true}
      activePanel={{ type: "none" } as ActivePanel}
      changesOpen={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe("Toolbar — mode buttons", () => {
  it("renders the four mode buttons when expanded", () => {
    renderToolbar();
    for (const name of ["Select", "Variables", "AI", "Changes"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("clicking each mode button fires its callback", () => {
    const h = renderToolbar();

    fireEvent.click(screen.getByRole("button", { name: "Variables" }));
    expect(h.onOpenVariables).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "AI" }));
    expect(h.onOpenPrompt).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Changes" }));
    expect(h.onToggleSession).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Select" }));
    expect(h.onToggleSelecting).toHaveBeenCalledTimes(1);
  });
});

describe("Toolbar — active (aria-pressed) state mirrors the open panel", () => {
  it("marks Variables active when the variables panel is open", () => {
    renderToolbar({ activePanel: { type: "variables" } });
    expect(screen.getByRole("button", { name: "Variables" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Changes" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("marks Changes active when changesOpen is true", () => {
    renderToolbar({ changesOpen: true });
    expect(screen.getByRole("button", { name: "Changes" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("marks AI active when the inspector's prompt tab is open", () => {
    renderToolbar({ activePanel: { type: "inspector", tab: "prompt" } });
    expect(screen.getByRole("button", { name: "AI" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("none are pressed in the base (none) panel state aside from Select-by-selection", () => {
    renderToolbar({ activePanel: { type: "none" } });
    expect(screen.getByRole("button", { name: "Variables" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "AI" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Changes" }).getAttribute("aria-pressed")).toBe("false");
  });
});
