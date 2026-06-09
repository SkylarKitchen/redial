// @vitest-environment happy-dom
/**
 * BreakpointSelector — header control for choosing the target breakpoint (#35).
 *
 * Mirrors StateSelector: a compact combobox trigger + a portal dropdown
 * (data-tuner-portal, zIndex.max) listing the breakpoint set. Selecting an
 * option fires onChange; the trigger reflects the active breakpoint and goes
 * accent-colored when it is non-base (the "which breakpoint am I editing"
 * indicator the issue asks for). Inline-styled — no shadcn/Radix.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BreakpointSelector } from "../shell/BreakpointSelector";
import { BREAKPOINTS } from "../breakpoints";

afterEach(() => cleanup());

function open() {
  fireEvent.click(screen.getByRole("combobox"));
}

describe("BreakpointSelector (#35)", () => {
  it("renders every breakpoint option inside a [data-tuner-portal] portal", () => {
    render(<BreakpointSelector value="base" onChange={() => {}} />);
    open();
    const portal = document.querySelector("[data-tuner-portal]");
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
    const options = portal!.querySelectorAll('[role="option"]');
    expect(options.length).toBe(BREAKPOINTS.length);
  });

  it("does not render a Radix popper wrapper (inline control, no shadcn)", () => {
    render(<BreakpointSelector value="base" onChange={() => {}} />);
    open();
    expect(document.querySelector("[data-radix-popper-content-wrapper]")).toBeNull();
  });

  it("fires onChange with the chosen breakpoint id", () => {
    let chosen: string | null = null;
    render(<BreakpointSelector value="base" onChange={(v) => (chosen = v)} />);
    open();
    fireEvent.click(screen.getByText("≥ 768"));
    expect(chosen).toBe("768");
  });

  it("shows the active breakpoint label on the trigger when non-base", () => {
    render(<BreakpointSelector value="1024" onChange={() => {}} />);
    expect(screen.getByRole("combobox").textContent).toContain("≥ 1024");
  });
});
