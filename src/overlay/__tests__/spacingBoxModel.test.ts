// @vitest-environment happy-dom
/**
 * spacingBoxModel.test.ts — SpacingBoxModel interaction tests
 *
 * Verifies:
 * 1. Click on a value enters edit mode (opens popover)
 * 2. Arrow up/down increments/decrements by 1
 * 3. Shift+arrow increments by 10
 * 4. Tab moves between values in order (top → right → bottom → left)
 * 5. Padding values cannot go negative while margin values can
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { SpacingBoxModel } from "../sections/SpacingBoxModel";
import { SpacingValuePopover } from "../sections/SpacingValuePopover";

// ── Shared helpers ──────────────────────────────────────────────────

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  return { container, root };
}

function teardown(container: HTMLDivElement, root: Root) {
  act(() => { root.unmount(); });
  container.remove();
  // Clean up portals
  document.body.querySelectorAll("div").forEach((el) => {
    if (el.parentElement === document.body && el !== container) el.remove();
  });
}

const stubElement = document.createElement("div");
const stubInd = () => "none" as const;

function renderBoxModel(
  root: Root,
  onChange: ReturnType<typeof vi.fn>,
  overrides?: {
    margin?: { top: number; right: number; bottom: number; left: number };
    padding?: { top: number; right: number; bottom: number; left: number };
  },
) {
  act(() => {
    root.render(
      createElement(SpacingBoxModel, {
        margin: overrides?.margin ?? { top: 10, right: 20, bottom: 30, left: 40 },
        padding: overrides?.padding ?? { top: 5, right: 15, bottom: 25, left: 35 },
        onChange,
        marginUnit: "px",
        paddingUnit: "px",
        marginUnits: ["px", "%", "em", "rem"],
        paddingUnits: ["px", "%", "em", "rem"],
        onMarginUnitChange: vi.fn(),
        onPaddingUnitChange: vi.fn(),
        element: stubElement,
        ind: stubInd,
      }),
    );
  });
}

function findCell(container: HTMLDivElement, prop: string): HTMLElement {
  const cell = container.querySelector<HTMLElement>(`[data-spacing-prop="${prop}"]`);
  if (!cell) throw new Error(`Cell for ${prop} not found`);
  return cell;
}

function findCellByIndex(container: HTMLDivElement, index: number): HTMLElement {
  const cell = container.querySelector<HTMLElement>(`[data-spacing-index="${index}"]`);
  if (!cell) throw new Error(`Cell at index ${index} not found`);
  return cell;
}

/** Simulate a click (pointerdown + pointerup at same position, no drag) */
function click(cell: HTMLElement) {
  act(() => {
    cell.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, button: 0, clientX: 50, clientY: 50,
    }));
  });
  act(() => {
    cell.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, button: 0, clientX: 50, clientY: 50,
    }));
  });
}

/** Find the popover input in the portal */
function findPopoverInput(): HTMLInputElement | null {
  // The popover renders via portal to document.body; find the input inside it
  const inputs = document.querySelectorAll<HTMLInputElement>("input[type='range']");
  // The text input is the non-range input inside the popover
  const all = document.querySelectorAll<HTMLInputElement>("input:not([type='range'])");
  return all.length > 0 ? all[all.length - 1] : null;
}

// ═══════════════════════════════════════════════════════════════════
// 1. Click on a value enters edit mode (opens popover)
// ═══════════════════════════════════════════════════════════════════

describe("SpacingBoxModel click to edit", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  it("clicking a margin value opens the popover", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    // Before click: no popover input should exist
    expect(findPopoverInput()).toBeNull();

    // Click margin-top
    click(findCell(container, "margin-top"));

    // Popover should now be open — there should be an input
    const input = findPopoverInput();
    expect(input).not.toBeNull();
  });

  it("clicking a padding value opens the popover", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    click(findCell(container, "padding-left"));

    const input = findPopoverInput();
    expect(input).not.toBeNull();
  });

  it("popover shows the correct value for the clicked cell", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange, {
      margin: { top: 42, right: 0, bottom: 0, left: 0 },
    });

    click(findCell(container, "margin-top"));

    const input = findPopoverInput();
    expect(input).not.toBeNull();
    expect(input!.value).toBe("42");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Arrow up/down increments/decrements by 1
// ═══════════════════════════════════════════════════════════════════

describe("SpacingValuePopover arrow key stepping", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  function renderPopover(onChange: ReturnType<typeof vi.fn>, value = 10, isMargin = true) {
    const anchorRect = new DOMRect(100, 100, 50, 24);
    act(() => {
      root.render(
        createElement(SpacingValuePopover, {
          value,
          onChange,
          unit: "px",
          units: ["px", "%", "em", "rem"],
          onUnitChange: vi.fn(),
          property: isMargin ? "margin-top" : "padding-top",
          isMargin,
          anchorRect,
          onClose: vi.fn(),
        }),
      );
    });
  }

  it("ArrowUp increments value by 1", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 10);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowUp", bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(11);
  });

  it("ArrowDown decrements value by 1", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 10);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(9);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Shift+arrow increments by 10
// ═══════════════════════════════════════════════════════════════════

describe("SpacingValuePopover shift+arrow stepping", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  function renderPopover(onChange: ReturnType<typeof vi.fn>, value = 20, isMargin = true) {
    const anchorRect = new DOMRect(100, 100, 50, 24);
    act(() => {
      root.render(
        createElement(SpacingValuePopover, {
          value,
          onChange,
          unit: "px",
          units: ["px", "%", "em", "rem"],
          onUnitChange: vi.fn(),
          property: isMargin ? "margin-top" : "padding-top",
          isMargin,
          anchorRect,
          onClose: vi.fn(),
        }),
      );
    });
  }

  it("Shift+ArrowUp increments value by 10", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 20);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowUp", shiftKey: true, bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(30);
  });

  it("Shift+ArrowDown decrements value by 10", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 20);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", shiftKey: true, bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(10);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Tab moves between values in order (top → right → bottom → left)
// ═══════════════════════════════════════════════════════════════════

describe("SpacingBoxModel tab navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  // Tab index map from SpacingBoxModel:
  //   0=margin-top, 1=margin-right, 2=margin-bottom, 3=margin-left
  //   4=padding-top, 5=padding-right, 6=padding-bottom, 7=padding-left

  it("Tab from margin-top focuses margin-right", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const cell = findCellByIndex(container, 0); // margin-top
    cell.focus();

    act(() => {
      cell.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab", bubbles: true,
      }));
    });

    // Next should be index 1 (margin-right)
    const nextCell = findCellByIndex(container, 1);
    expect(document.activeElement).toBe(nextCell);
  });

  it("Tab from margin-right focuses margin-bottom", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const cell = findCellByIndex(container, 1);
    cell.focus();

    act(() => {
      cell.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab", bubbles: true,
      }));
    });

    const nextCell = findCellByIndex(container, 2);
    expect(document.activeElement).toBe(nextCell);
  });

  it("Tab from margin-left focuses padding-top", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const cell = findCellByIndex(container, 3); // margin-left
    cell.focus();

    act(() => {
      cell.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab", bubbles: true,
      }));
    });

    const nextCell = findCellByIndex(container, 4); // padding-top
    expect(document.activeElement).toBe(nextCell);
  });

  it("Tab from padding-left wraps around to margin-top", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const cell = findCellByIndex(container, 7); // padding-left (last)
    cell.focus();

    act(() => {
      cell.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab", bubbles: true,
      }));
    });

    const nextCell = findCellByIndex(container, 0); // margin-top (first)
    expect(document.activeElement).toBe(nextCell);
  });

  it("Shift+Tab from margin-top wraps to padding-left", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const cell = findCellByIndex(container, 0); // margin-top
    cell.focus();

    act(() => {
      cell.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Tab", shiftKey: true, bubbles: true,
      }));
    });

    const nextCell = findCellByIndex(container, 7); // padding-left
    expect(document.activeElement).toBe(nextCell);
  });

  it("full forward cycle: mT → mR → mB → mL → pT → pR → pB → pL → mT", () => {
    const onChange = vi.fn();
    renderBoxModel(root, onChange);

    const expectedOrder = [0, 1, 2, 3, 4, 5, 6, 7, 0];

    findCellByIndex(container, 0).focus();

    for (let i = 0; i < expectedOrder.length - 1; i++) {
      const current = findCellByIndex(container, expectedOrder[i]);
      act(() => {
        current.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Tab", bubbles: true,
        }));
      });
      const next = findCellByIndex(container, expectedOrder[i + 1]);
      expect(document.activeElement).toBe(next);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Padding cannot go negative, margin can
// ═══════════════════════════════════════════════════════════════════

describe("SpacingValuePopover negative value clamping", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { ({ container, root } = setup()); });
  afterEach(() => { teardown(container, root); });

  function renderPopover(onChange: ReturnType<typeof vi.fn>, value: number, isMargin: boolean) {
    const anchorRect = new DOMRect(100, 100, 50, 24);
    act(() => {
      root.render(
        createElement(SpacingValuePopover, {
          value,
          onChange,
          unit: "px",
          units: ["px", "%", "em", "rem"],
          onUnitChange: vi.fn(),
          property: isMargin ? "margin-top" : "padding-top",
          isMargin,
          anchorRect,
          onClose: vi.fn(),
        }),
      );
    });
  }

  it("margin ArrowDown from 0 allows negative value (-1)", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 0, true);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(-1);
  });

  it("margin Shift+ArrowDown from 5 allows negative value (-5)", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 5, true);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", shiftKey: true, bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(-5);
  });

  it("padding ArrowDown from 0 clamps to 0 (cannot go negative)", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 0, false);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("padding Shift+ArrowDown from 5 clamps to 0 (not -5)", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 5, false);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", shiftKey: true, bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("padding ArrowDown from 3 decrements normally to 2", () => {
    const onChange = vi.fn();
    renderPopover(onChange, 3, false);

    const input = findPopoverInput();
    expect(input).not.toBeNull();

    act(() => {
      input!.dispatchEvent(new KeyboardEvent("keydown", {
        key: "ArrowDown", bubbles: true,
      }));
    });

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("padding slider min is 0 while margin slider min is -200", () => {
    // Verify via the rendered range input attributes
    const onChange = vi.fn();

    // Render padding popover
    renderPopover(onChange, 10, false);
    const paddingSlider = document.querySelector<HTMLInputElement>("input[type='range']");
    expect(paddingSlider).not.toBeNull();
    expect(paddingSlider!.min).toBe("0");

    // Clean and render margin popover
    act(() => { root.unmount(); });
    teardown(container, root);
    ({ container, root } = setup());

    renderPopover(onChange, 10, true);
    const marginSlider = document.querySelector<HTMLInputElement>("input[type='range']");
    expect(marginSlider).not.toBeNull();
    expect(marginSlider!.min).toBe("-200");
  });
});
