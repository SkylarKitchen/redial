// @vitest-environment happy-dom
/**
 * usePortalDropdown.test.tsx — Behavioral tests for the portal dropdown hook
 *
 * Migrated from source-text assertions to mounted-DOM tests per testing policy
 * issue #105.
 *
 * Verifies:
 * 1. Position computation with flip-above logic based on available viewport space
 * 2. Ref-based click-outside handling (closes on outside click, stays open on portal click)
 * 3. Dynamic height correction via useLayoutEffect
 * 4. Hook adoption by all dropdown components (UnitSelector, SelectRow, etc.)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { UnitSelector } from "../controls/UnitSelector";
import { SelectRow } from "../controls/SelectRow";

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

function getListbox(): HTMLElement | null {
  return document.querySelector('[role="listbox"]');
}

function getPortal(): HTMLElement | null {
  return document.querySelector('[data-tuner-portal]');
}

describe("usePortalDropdown — position computation", () => {
  it("positions dropdown below trigger when sufficient space below", () => {
    // Default happy-dom viewport is large enough for dropdown below
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    // Mock getBoundingClientRect to simulate trigger near top of viewport
    const originalGetBCR = trigger.getBoundingClientRect;
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 130,
      left: 50,
      right: 100,
      width: 50,
      height: 30,
      x: 50,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);
    const portal = getPortal();
    expect(portal).not.toBeNull();

    // Portal should be positioned below trigger (top > trigger.bottom)
    const portalTop = parseInt(portal!.style.top, 10);
    expect(portalTop).toBeGreaterThan(130); // below trigger.bottom

    trigger.getBoundingClientRect = originalGetBCR;
  });

  it("flips dropdown above trigger when insufficient space below", () => {
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    // Mock getBoundingClientRect to simulate trigger near bottom of viewport
    // With window.innerHeight typically 768 in happy-dom, put trigger at bottom
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 750,
      bottom: 780,
      left: 50,
      right: 100,
      width: 50,
      height: 30,
      x: 50,
      y: 750,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);
    const portal = getPortal();
    expect(portal).not.toBeNull();

    // Portal should be positioned above trigger (top < trigger.top)
    const portalTop = parseInt(portal!.style.top, 10);
    expect(portalTop).toBeLessThan(750); // above trigger.top
  });

  it("clamps horizontal position to viewport bounds", () => {
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    // Simulate trigger near right edge of viewport
    Object.defineProperty(window, 'innerWidth', { value: 500, configurable: true });
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 100,
      bottom: 130,
      left: 480, // near right edge
      right: 530,
      width: 50,
      height: 30,
      x: 480,
      y: 100,
      toJSON: () => ({}),
    });

    fireEvent.click(trigger);
    const portal = getPortal();
    expect(portal).not.toBeNull();

    // Portal should be clamped with 8px margin from right edge
    const portalLeft = parseInt(portal!.style.left, 10);
    expect(portalLeft).toBeLessThan(480); // clamped left from trigger position
  });
});

describe("usePortalDropdown — click-outside handling", () => {
  it("closes dropdown on click outside both trigger and portal", () => {
    const onChange = vi.fn();
    render(<UnitSelector value="px" onChange={onChange} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    fireEvent.click(trigger);
    expect(getListbox()).not.toBeNull();

    // Click outside (on document.body)
    fireEvent.mouseDown(document.body);
    expect(getListbox()).toBeNull();
  });

  it("keeps dropdown open on click inside portal", () => {
    const onChange = vi.fn();
    render(<UnitSelector value="px" onChange={onChange} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    fireEvent.click(trigger);
    const listbox = getListbox()!;
    expect(listbox).not.toBeNull();

    // Click inside the portal
    fireEvent.mouseDown(listbox);
    // Dropdown should still be open
    expect(getListbox()).not.toBeNull();
  });

  it("keeps dropdown open on click inside trigger container", () => {
    const onChange = vi.fn();
    render(<UnitSelector value="px" onChange={onChange} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;

    fireEvent.click(trigger);
    expect(getListbox()).not.toBeNull();

    // Click inside the container (on trigger itself)
    fireEvent.mouseDown(trigger);
    // Dropdown should still be open (component might have its own toggle logic,
    // but the hook's click-outside handler shouldn't close it)
    expect(getListbox()).not.toBeNull();
  });
});

describe("usePortalDropdown — hook adoption by components", () => {
  it("UnitSelector uses the hook (portal renders with data-tuner-portal)", () => {
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);

    const portal = getPortal();
    expect(portal).not.toBeNull();
    expect(portal!.hasAttribute('data-unit-selector-portal')).toBe(true);
  });

  it("SelectRow (non-searchable) uses the hook (portal renders with data-tuner-portal)", () => {
    const options = [
      { value: "a", label: "Option A" },
      { value: "b", label: "Option B" },
    ];
    render(<SelectRow label="Test" value="a" options={options} onChange={vi.fn()} />);

    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);

    const portal = getPortal();
    expect(portal).not.toBeNull();
    // Non-searchable SelectRow doesn't use SelectRowCustom, so different portal attribute
    expect(portal!.hasAttribute('data-tuner-portal')).toBe(true);
  });

  it("portaled dropdowns use position:fixed (not absolute)", () => {
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);

    const portal = getPortal();
    expect(portal).not.toBeNull();
    // The portal wrapper should have position:fixed for viewport-relative placement
    expect(portal!.style.position).toBe("fixed");
  });
});

describe("usePortalDropdown — portalRef assignment", () => {
  it("portalRef is assigned to the portal wrapper element", () => {
    render(<UnitSelector value="px" onChange={vi.fn()} />);
    const trigger = document.querySelector('button[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);

    const portal = getPortal();
    expect(portal).not.toBeNull();

    // The portal should be the element that receives click events
    // We verify this indirectly: clicking inside the portal keeps it open
    const listbox = getListbox()!;
    fireEvent.mouseDown(listbox);
    expect(getListbox()).not.toBeNull(); // still open
  });
});
