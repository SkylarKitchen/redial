// @vitest-environment happy-dom
/**
 * unitSelectorPortal.test.tsx — Behavioral tests for UnitSelector portal rendering
 *
 * Migrated from source-text assertions to mounted-DOM tests per testing policy
 * issue #105.
 *
 * Verifies that UnitSelector escapes the panel's scroll overflow by:
 * 1. Portaling the dropdown listbox to document.body via createPortal
 * 2. Using position:fixed for viewport-relative positioning
 * 3. Marking the portal with data-tuner-portal for click-through handling
 *
 * The bug this guards against: UnitSelector was originally position:absolute
 * within its own subtree, so it got clipped by the panel's overflowY:auto
 * scroll container when the trigger was near the bottom of the visible area.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { UnitSelector } from "../controls/UnitSelector";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function getListbox(): HTMLElement | null {
  return document.querySelector('[role="listbox"]');
}

function getTrigger(): HTMLButtonElement | null {
  return document.querySelector('button[role="combobox"]');
}

describe("UnitSelector dropdown uses portal to escape scroll overflow", () => {
  function renderUnits(onChange = vi.fn()) {
    render(<UnitSelector value="px" onChange={onChange} />);
  }

  it("closed state: no listbox rendered", () => {
    renderUnits();
    expect(getListbox()).toBeNull();
  });

  it("open state: listbox is portaled to document.body via data-tuner-portal wrapper", () => {
    renderUnits();
    const trigger = getTrigger()!;
    fireEvent.click(trigger);
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    // The portal wrapper (parent of listbox) must be a direct child of document.body
    // and marked with data-tuner-portal for Overlay.tsx click-through handling.
    const portal = listbox!.closest("[data-tuner-portal]");
    expect(portal).not.toBeNull();
    expect(portal!.parentElement).toBe(document.body);
  });

  it("portaled dropdown uses position:fixed for viewport-relative placement", () => {
    renderUnits();
    const trigger = getTrigger()!;
    fireEvent.click(trigger);
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    // The listbox or its immediate parent should have position:fixed in inline styles
    // (not absolute, which would be clipped by overflowY:auto ancestors).
    const parent = listbox!.parentElement;
    expect(parent).not.toBeNull();
    expect(parent!.style.position).toBe("fixed");
  });

  it("portaled dropdown is not a descendant of the trigger's container", () => {
    const { container } = render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = getTrigger()!;
    fireEvent.click(trigger);
    const listbox = getListbox();
    expect(listbox).not.toBeNull();
    // If the listbox were inside container, it would be clipped by scroll overflow.
    // Verify it's NOT a descendant of the render container.
    expect(container.contains(listbox)).toBe(false);
  });
});
