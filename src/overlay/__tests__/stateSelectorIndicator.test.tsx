// @vitest-environment happy-dom
/**
 * StateSelector — the active-state indicator on the trigger.
 *
 * Verified live: the trigger reads "State" in the base (none) state and switches
 * to the active pseudo-class label (e.g. "Hover") in the accent color when a
 * non-base state is selected. (Options/selection/dismissal are already covered
 * by stateSelectorPortalClick.test.tsx; this covers the trigger label + color.)
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { StateSelector } from "../shell/StateSelector";

afterEach(cleanup);

describe("StateSelector — trigger indicator", () => {
  it("reads 'State' in the base (none) state", () => {
    render(<StateSelector value="none" onChange={() => {}} />);
    expect(screen.getByRole("combobox").textContent).toContain("State");
  });

  it("shows the active state's label when a non-base state is selected", () => {
    render(<StateSelector value="hover" onChange={() => {}} />);
    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Hover");
    expect(trigger.textContent).not.toContain("State");
  });

  it("uses a different (accent) trigger color only when a non-base state is active", () => {
    const { unmount } = render(<StateSelector value="none" onChange={() => {}} />);
    const baseColor = (screen.getByRole("combobox") as HTMLElement).style.color;
    unmount();

    render(<StateSelector value="hover" onChange={() => {}} />);
    const activeColor = (screen.getByRole("combobox") as HTMLElement).style.color;

    expect(baseColor.length).toBeGreaterThan(0);
    expect(activeColor).not.toBe(baseColor);
  });
});
