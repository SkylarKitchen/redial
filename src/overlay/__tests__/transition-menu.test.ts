// @vitest-environment happy-dom
/**
 * transition-menu.test.ts — Verify the Transitions options menu in
 * EffectsSection (anchor state, portal, and all required actions).
 *
 * CONVERTED (issue #105): was a source-level static-analysis test (regexes
 * for `transMenuAnchor`, "Remove All", `createPortal`, `data-tuner-portal`…
 * in EffectsSection.tsx). Now mounts the real EffectsSection and drives the
 * actual menu. Invariant mapping:
 *  - "has menu anchor state / onMenu wired (no TODO stub)" → clicking the
 *    Transitions header's menu button really opens the menu; clicking an
 *    item really closes it.
 *  - "uses createPortal + data-tuner-portal" → the opened menu is found via
 *    document-level [data-tuner-portal] (portaled to <body>, outside the
 *    section container) — the attribute that keeps the Overlay's capture
 *    click handler from swallowing menu clicks.
 *  - '"Copy CSS" / "Remove All" / "Disable All"–"Enable All"' → the items
 *    are asserted in the rendered menu; Disable All is exercised and the
 *    reopened menu shows Enable All (the toggle really toggles).
 */

import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createElement } from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { EffectsSection } from "../sections/EffectsSection";
import { resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture (useDragReorder needs it).
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: () => {},
    reset: () => {},
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "none" as const,
    sectionInd: () => "none" as const,
    cs,
    parentCs: null,
    getConversionCtx: (): UnitConversionContext => ({
      computedFontSize: 16,
      rootFontSize: 16,
      parentWidth: 800,
      parentHeight: 600,
      viewportWidth: 1280,
      viewportHeight: 720,
    }),
    ctxMenu: () => () => {},
    isTailwind: false,
  };
}

/** The Transitions sub-section header row and its [menu, add] buttons. */
function transitionsHeaderButtons(): { menuBtn: HTMLElement; addBtn: HTMLElement } {
  const row = screen.getByText("Transitions").closest("div") as HTMLElement;
  expect(row, "Transitions sub-section header should render").toBeTruthy();
  const buttons = Array.from(row.querySelectorAll("button")) as HTMLElement[];
  // SubSectionHeader renders the menu button first, then the add button
  expect(buttons.length, "Transitions header should have menu + add buttons").toBeGreaterThanOrEqual(2);
  return { menuBtn: buttons[0], addBtn: buttons[buttons.length - 1] };
}

/** The options-menu portal (or null). */
function menuPortal(): HTMLElement | null {
  const portals = Array.from(document.querySelectorAll("[data-tuner-portal]"));
  return (portals.find((p) => p.textContent?.includes("Copy CSS")) as HTMLElement) ?? null;
}

describe("Transition options menu", () => {
  it("menu button opens a [data-tuner-portal] portal with Copy CSS + Remove All; without transitions there is no Disable All", () => {
    render(createElement(EffectsSection, { ctx: makeCtx(), forceOpen: true }));
    expect(menuPortal()).toBeNull();

    const { menuBtn } = transitionsHeaderButtons();
    fireEvent.click(menuBtn);

    const portal = menuPortal();
    expect(portal, "menu must open in a data-tuner-portal portal").toBeTruthy();
    // Portaled OUTSIDE the section (to document.body), not inline
    expect(portal!.closest("body")).toBe(document.body);

    expect(portal!.textContent).toContain("Copy CSS");
    expect(portal!.textContent).toContain("Remove All");
    // No transitions yet — the enable/disable toggle is hidden
    expect(portal!.textContent).not.toContain("Disable All");
    expect(portal!.textContent).not.toContain("Enable All");
  });

  it("with a transition added, the menu shows Disable All; clicking it closes the menu and flips it to Enable All", () => {
    render(createElement(EffectsSection, { ctx: makeCtx(), forceOpen: true }));

    const { menuBtn, addBtn } = transitionsHeaderButtons();

    // Add a transition via the header's + button
    fireEvent.click(addBtn);

    fireEvent.click(menuBtn);
    let portal = menuPortal();
    expect(portal).toBeTruthy();
    expect(portal!.textContent).toContain("Disable All");

    // Click "Disable All" — hides every transition and closes the menu
    const disableItem = Array.from(portal!.querySelectorAll("*")).find(
      (n) => n.textContent === "Disable All",
    ) as HTMLElement;
    expect(disableItem).toBeTruthy();
    fireEvent.click(disableItem);
    expect(menuPortal(), "menu should close after choosing an action").toBeNull();

    // Reopen — the toggle now reads "Enable All"
    fireEvent.click(menuBtn);
    portal = menuPortal();
    expect(portal).toBeTruthy();
    expect(portal!.textContent).toContain("Enable All");
    expect(portal!.textContent).not.toContain("Disable All");
  });
});
