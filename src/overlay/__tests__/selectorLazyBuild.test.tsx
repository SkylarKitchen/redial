// @vitest-environment happy-dom
/**
 * Selector — lazy Tab candidate list (issue #28).
 *
 * `document.querySelectorAll('*')` is expensive on large pages. The Selector
 * must NOT walk the whole document merely on activation — the candidate list is
 * built lazily on the FIRST Tab press (keyboard-only navigation), and reused
 * for subsequent Tabs (built once per activation).
 *
 * Fired-event test: render the real Selector active, spy on querySelectorAll,
 * assert no `'*'` walk on mount, then dispatch real Tab keydowns and assert the
 * walk happens exactly once.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Selector } from "../shell/Selector";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function starWalks(spy: ReturnType<typeof vi.spyOn>): number {
  return spy.mock.calls.filter((c) => c[0] === "*").length;
}

function pressTab() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
  );
}

describe("Selector lazy candidate list (#28)", () => {
  it("does not walk the whole document on activation", () => {
    const spy = vi.spyOn(document, "querySelectorAll");
    render(<Selector active={true} onSelect={() => {}} onCancel={() => {}} />);
    expect(starWalks(spy)).toBe(0);
  });

  it("builds the candidate list on the first Tab, and only once", () => {
    // Give the walk something to find so the list is non-empty.
    const a = document.createElement("button");
    a.textContent = "a";
    const b = document.createElement("button");
    b.textContent = "b";
    document.body.append(a, b);

    const spy = vi.spyOn(document, "querySelectorAll");
    render(<Selector active={true} onSelect={() => {}} onCancel={() => {}} />);
    expect(starWalks(spy)).toBe(0);

    pressTab();
    expect(starWalks(spy)).toBe(1); // built lazily on first Tab

    pressTab();
    pressTab();
    expect(starWalks(spy)).toBe(1); // reused, not rebuilt
  });
});
