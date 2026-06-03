// @vitest-environment happy-dom
/**
 * iconButtonActiveState.test.ts — behavioral guard that the ACTIVE button in an
 * IconButtonGroup is visibly styled.
 *
 * History: pre-migration this guarded a shadcn-specific hazard — with
 * `important: true`, ToggleGroupItem's `data-[state=on]:bg-accent` !important
 * silently overrode any inline active background, so the test REQUIRED the active
 * styling to live in Tailwind `data-[state=on]:` classes and FORBADE inline
 * `backgroundColor: isActive ? ...`. After the shadcn -> inline migration
 * (2026-06-03) that hazard no longer exists: the group is a plain div + button
 * styled with inline theme tokens. The invariant is now the opposite — the active
 * option must carry an inline primary background + primary-foreground text, and
 * there must be no Radix `data-state` machinery left. This is a real render test,
 * not a source-text check.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { IconButtonGroup } from "../controls/IconButtonGroup";
import { color } from "../theme";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const OPTIONS = [
  { value: "left", icon: createElement("span", null, "L"), label: "Left" },
  { value: "center", icon: createElement("span", null, "C"), label: "Center" },
  { value: "right", icon: createElement("span", null, "R"), label: "Right" },
];

function render(value: string) {
  act(() => {
    root.render(
      createElement(IconButtonGroup, {
        options: OPTIONS,
        value,
        onChange: () => {},
        "aria-label": "Text align",
      }),
    );
  });
}

function radios(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="radio"]'));
}

/** color.primary is "#3B82F6"; tolerate either hex or rgb serialization. */
function isPrimaryBg(el: HTMLElement): boolean {
  const bg = el.style.backgroundColor.toLowerCase().replace(/\s/g, "");
  return bg === color.primary.toLowerCase() || bg === "rgb(59,130,246)";
}

describe("IconButtonGroup active state (inline styles, post-shadcn migration)", () => {
  it("the active option carries an inline primary background", () => {
    render("center");
    const active = radios().find((b) => b.getAttribute("aria-checked") === "true");
    expect(active, "an active radio should exist").toBeTruthy();
    expect(active!.getAttribute("aria-label")).toBe("Center");
    expect(isPrimaryBg(active!)).toBe(true);
  });

  it("the active option has inline text color set; inactive options share no primary fill", () => {
    render("center");
    const all = radios();
    const active = all.find((b) => b.getAttribute("aria-checked") === "true")!;
    const inactive = all.filter((b) => b.getAttribute("aria-checked") !== "true");
    expect(active.style.color).not.toBe("");
    for (const b of inactive) {
      expect(isPrimaryBg(b), `${b.getAttribute("aria-label")} should not have the primary fill`).toBe(false);
    }
  });

  it("uses no Radix data-state machinery and exposes a radiogroup", () => {
    render("left");
    for (const b of radios()) {
      expect(b.hasAttribute("data-state"), "no leftover Radix data-state").toBe(false);
    }
    expect(container.querySelector('[role="radiogroup"]')).toBeTruthy();
  });
});
