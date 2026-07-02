// @vitest-environment happy-dom
/**
 * Reset-dot / reset-popover trigger family — keyboard accessibility (issue #85).
 *
 * A shared pattern across the panel: small indicator dots / property labels
 * that open a ResetPopover on click (Alt+click resets directly). All of them
 * were mouse-only <span onClick> surfaces. The fix is centralized in
 * useResetPopover (controls/helpers.tsx), which now returns `triggerProps`:
 * role="button" + tabIndex + Enter/Space keydown + aria-haspopup +
 * aria-label ("Reset <property>") — only while the trigger is interactive
 * (indicator === "modified" with an onReset).
 *
 * Sites covered here:
 *   - RowLabel (layoutPrimitives.tsx)
 *   - CompactLabel (LayoutSection.tsx, via flex-child controls)
 *   - SizeInputCell.tsx modified dot
 *   - PositionSelector.tsx "Position" label
 *   - BordersSection.tsx "Radius" and "Style" labels
 *   - EffectsSection.tsx "Outline" label
 *   - CornerRadiusEditor.tsx corner icon (direct reset — no popover exists there)
 *   - ShadowEditor.tsx click-to-edit value spans (edit-in-place, same sweep)
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RowLabel } from "../sections/layoutPrimitives";
import { LayoutSection } from "../sections/LayoutSection";
import { SizeInputCell } from "../sections/SizeInputCell";
import { PositionSelector } from "../sections/PositionSelector";
import { BordersSection } from "../sections/BordersSection";
import { EffectsSection } from "../sections/EffectsSection";
import { CornerRadiusEditor } from "../sections/CornerRadiusEditor";
import { ShadowEditor, makeShadow } from "../sections/ShadowEditor";
import { applyInlineStyle, resetAll } from "../core/apply";
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

/** Minimal SectionCtx wired to the real apply engine, with every property "modified". */
function makeModifiedCtx(display = "block"): SectionCtx {
  const element = document.createElement("div");
  element.style.display = display;
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: (prop: string, value: string) => applyInlineStyle(element, prop, value),
    reset: vi.fn(),
    resetRead: () => 0,
    resetReadStr: () => "",
    ind: () => "modified" as const,
    sectionInd: () => "modified" as const,
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

/** The ResetPopover portal (or null). */
function popoverPortal(): HTMLElement | null {
  const portals = Array.from(document.querySelectorAll("[data-tuner-portal]"));
  return (portals.find((p) => p.textContent?.includes("Reset")) as HTMLElement) ?? null;
}

/** Assert the shared trigger contract on an element. */
function expectResetTrigger(el: HTMLElement, labelPattern: RegExp) {
  expect(el.getAttribute("role")).toBe("button");
  expect(el.tabIndex).toBe(0);
  expect(el.getAttribute("aria-haspopup")).toBeTruthy();
  expect(el.getAttribute("aria-label")).toMatch(labelPattern);
  el.focus();
  expect(document.activeElement).toBe(el);
}

// ─── RowLabel (layoutPrimitives) — the canonical shared-site test ─────

describe("RowLabel reset trigger a11y (shared useResetPopover fix)", () => {
  it("modified label is a focusable reset trigger with ARIA attrs", () => {
    render(<RowLabel label="Direction" indicator="modified" onReset={() => {}} />);
    const trigger = screen.getByText("Direction").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*direction/i);
  });

  it("Enter opens the reset popover (same as click)", () => {
    render(<RowLabel label="Direction" indicator="modified" onReset={() => {}} />);
    const trigger = screen.getByText("Direction").closest('[role="button"]') as HTMLElement;
    expect(popoverPortal()).toBeNull();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });

  it("Space opens the reset popover identically", () => {
    render(<RowLabel label="Direction" indicator="modified" onReset={() => {}} />);
    const trigger = screen.getByText("Direction").closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(trigger, { key: " " });
    expect(popoverPortal()).toBeTruthy();
  });

  it("keyboard-opened popover focuses the Reset row; Enter there fires onReset", () => {
    const onReset = vi.fn();
    render(<RowLabel label="Direction" indicator="modified" onReset={onReset} />);
    const trigger = screen.getByText("Direction").closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(trigger, { key: "Enter" });
    const portal = popoverPortal() as HTMLElement;
    const row = portal.querySelector('[role="button"]') as HTMLElement;
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(popoverPortal()).toBeNull();
  });

  it("mouse click still opens the popover (unchanged)", () => {
    render(<RowLabel label="Direction" indicator="modified" onReset={() => {}} />);
    const trigger = screen.getByText("Direction").closest("span") as HTMLElement;
    fireEvent.click(trigger.closest('[role="button"]') ?? trigger);
    expect(popoverPortal()).toBeTruthy();
  });

  it("Alt+click still resets directly without opening the popover (unchanged)", () => {
    const onReset = vi.fn();
    render(<RowLabel label="Direction" indicator="modified" onReset={onReset} />);
    const trigger = screen.getByText("Direction").closest('[role="button"]') as HTMLElement;
    fireEvent.click(trigger, { altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(popoverPortal()).toBeNull();
  });

  it("unmodified label is NOT focusable and has no button role", () => {
    render(<RowLabel label="Direction" indicator="none" onReset={() => {}} />);
    const span = screen.getByText("Direction").closest("span")!.parentElement as HTMLElement;
    expect(span.getAttribute("role")).toBeNull();
    expect(span.tabIndex).not.toBe(0);
  });
});

// ─── Shared controls that consume useResetPopover ─────────────────────
// SelectRow/ColorRow spread the full triggerProps; SliderRow/NumberRow/
// ScrubLabel keep mouse handling on LabelScrub and take the keyboard-only
// variant. One representative of each wiring style is locked in here.

describe("SelectRow label reset trigger a11y (full triggerProps)", () => {
  it("modified label opens the popover with Enter", async () => {
    const { SelectRow } = await import("../controls/SelectRow");
    render(
      <SelectRow
        label="Overflow"
        value="visible"
        options={[{ value: "visible", label: "visible" }, { value: "hidden", label: "hidden" }]}
        onChange={() => {}}
        indicator="modified"
        onReset={() => {}}
      />,
    );
    const trigger = screen.getByText("Overflow").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*overflow/i);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });
});

describe("SliderRow label reset trigger a11y (keyboard-only variant)", () => {
  it("modified label opens the popover with Enter (mouse stays on LabelScrub)", async () => {
    const { SliderRow } = await import("../controls/SliderRow");
    render(
      <SliderRow
        label="Opacity"
        value={50}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={() => {}}
        indicator="modified"
        onReset={() => {}}
      />,
    );
    const trigger = screen.getByText("Opacity").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*opacity/i);
    fireEvent.keyDown(trigger, { key: " " });
    expect(popoverPortal()).toBeTruthy();
  });
});

// ─── LayoutSection CompactLabel (flex child controls) ─────────────────

describe("LayoutSection CompactLabel reset trigger a11y", () => {
  it("modified flex-child labels (Grow) are keyboard reset triggers", () => {
    render(
      <LayoutSection
        ctx={makeModifiedCtx("block")}
        display="block"
        onDisplayChange={vi.fn()}
        columnGap={0}
        columnGapUnit="px"
        onColumnGapChange={vi.fn()}
        onColumnGapUnitChange={vi.fn()}
        isFlex={false}
        isGrid={false}
        parentIsFlex={true}
        parentIsGrid={false}
        forceOpen
      />,
    );
    const trigger = screen.getByText("Grow").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*grow/i);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });
});

// ─── SizeInputCell modified dot ────────────────────────────────────────

describe("SizeInputCell modified-dot reset trigger a11y", () => {
  function renderCell(onReset = vi.fn()) {
    const utils = render(
      <SizeInputCell
        label="Width"
        value={100}
        unit="px"
        units={["px", "%"]}
        onValueChange={vi.fn()}
        onUnitChange={vi.fn()}
        isModified={true}
        onReset={onReset}
      />,
    );
    const dot = utils.container.querySelector('[role="button"][aria-haspopup]') as HTMLElement;
    return { ...utils, dot, onReset };
  }

  it("dot is focusable with button role and Reset aria-label", () => {
    const { dot } = renderCell();
    expect(dot).toBeTruthy();
    expectResetTrigger(dot, /^Reset .*width/i);
  });

  it("Enter and Space open the reset popover like click", () => {
    const { dot } = renderCell();
    fireEvent.keyDown(dot, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });

  it("Alt+click on the dot still resets directly (unchanged)", () => {
    const { dot, onReset } = renderCell();
    fireEvent.click(dot, { altKey: true });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("no dot / no trigger when unmodified", () => {
    const { container } = render(
      <SizeInputCell
        label="Width"
        value={100}
        unit="px"
        units={["px", "%"]}
        onValueChange={vi.fn()}
        onUnitChange={vi.fn()}
        isModified={false}
        onReset={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="button"][aria-haspopup]')).toBeNull();
  });
});

// ─── PositionSelector label ────────────────────────────────────────────

describe("PositionSelector label reset trigger a11y", () => {
  it("modified Position label is a keyboard reset trigger", () => {
    render(
      <PositionSelector value="relative" onChange={vi.fn()} indicator="modified" onReset={vi.fn()} />,
    );
    const trigger = screen.getByText("Position").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*position/i);
    fireEvent.keyDown(trigger, { key: " " });
    expect(popoverPortal()).toBeTruthy();
  });
});

// ─── BordersSection Radius + Style labels ─────────────────────────────

describe("BordersSection label reset triggers a11y", () => {
  function renderBorders() {
    return render(<BordersSection ctx={makeModifiedCtx()} forceOpen />);
  }

  it("Radius label is a keyboard reset trigger; Enter opens the popover", () => {
    renderBorders();
    const trigger = screen.getByText("Radius").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*radius/i);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });

  it("Style label is a keyboard reset trigger", () => {
    renderBorders();
    const trigger = screen.getByText("Style").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*style/i);
    fireEvent.keyDown(trigger, { key: " " });
    expect(popoverPortal()).toBeTruthy();
  });
});

// ─── EffectsSection Outline label ──────────────────────────────────────

describe("EffectsSection Outline label reset trigger a11y", () => {
  it("Outline label is a keyboard reset trigger; Enter opens the popover", () => {
    render(<EffectsSection ctx={makeModifiedCtx()} forceOpen />);
    const trigger = screen.getByText("Outline").closest('[role="button"]') as HTMLElement;
    expect(trigger).toBeTruthy();
    expectResetTrigger(trigger, /^Reset .*outline/i);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(popoverPortal()).toBeTruthy();
  });
});

// ─── CornerRadiusEditor corner icons (direct reset — no popover) ──────

describe("CornerRadiusEditor corner-icon reset a11y", () => {
  function renderEditor(onCornerReset = vi.fn()) {
    const utils = render(
      <CornerRadiusEditor
        topLeft={8}
        topRight={0}
        bottomRight={0}
        bottomLeft={0}
        onChange={vi.fn()}
        unit="px"
        units={["px", "%"]}
        onUnitChange={vi.fn()}
        indicators={{ "border-top-left-radius": "modified" }}
        onCornerReset={onCornerReset}
      />,
    );
    const icon = utils.container.querySelector('[aria-label="Reset top-left radius"]') as HTMLElement;
    return { ...utils, icon, onCornerReset };
  }

  it("modified corner icon is a focusable button with Reset aria-label", () => {
    const { icon } = renderEditor();
    expect(icon).toBeTruthy();
    expect(icon.getAttribute("role")).toBe("button");
    expect(icon.tabIndex).toBe(0);
    icon.focus();
    expect(document.activeElement).toBe(icon);
  });

  it("Enter and Space fire the corner reset", () => {
    const { icon, onCornerReset } = renderEditor();
    fireEvent.keyDown(icon, { key: "Enter" });
    expect(onCornerReset).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(icon, { key: " " });
    expect(onCornerReset).toHaveBeenCalledTimes(2);
  });

  it("plain click still does nothing; Alt+click still resets (mouse unchanged)", () => {
    const { icon, onCornerReset } = renderEditor();
    fireEvent.click(icon);
    expect(onCornerReset).not.toHaveBeenCalled();
    fireEvent.click(icon, { altKey: true });
    expect(onCornerReset).toHaveBeenCalledTimes(1);
  });

  it("unmodified corner icons are not focusable", () => {
    const { container } = renderEditor();
    // Only the top-left corner is modified — the other three icons stay inert.
    const focusableIcons = container.querySelectorAll('[aria-label^="Reset"]');
    expect(focusableIcons.length).toBe(1);
  });
});

// ─── ShadowEditor click-to-edit value spans ───────────────────────────

describe("ShadowEditor value spans a11y (edit-in-place)", () => {
  function renderShadows() {
    return render(<ShadowEditor shadows={[makeShadow()]} onChange={vi.fn()} />);
  }

  it("value span is focusable and labelled", () => {
    const { container } = renderShadows();
    const span = container.querySelector('[aria-label="Edit X"]') as HTMLElement;
    expect(span).toBeTruthy();
    expect(span.tabIndex).toBe(0);
    span.focus();
    expect(document.activeElement).toBe(span);
  });

  it("Enter starts editing (input appears), Space too", () => {
    const { container } = renderShadows();
    const span = container.querySelector('[aria-label="Edit Y"]') as HTMLElement;
    fireEvent.keyDown(span, { key: "Enter" });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("2"); // default shadow y
  });

  it("mouse click still starts editing (unchanged)", () => {
    const { container } = renderShadows();
    const span = container.querySelector('[aria-label="Edit Blur"]') as HTMLElement;
    fireEvent.click(span);
    expect(container.querySelector("input")).toBeTruthy();
  });
});
