// @vitest-environment happy-dom
/**
 * Picker rows / option lists — keyboard accessibility (issue #85 follow-up).
 *
 * Remaining mouse-only option surfaces:
 *   - BackgroundLayerList.tsx add-menu options (color/gradient/image divs)
 *     and the expanded color layer's edit-color chip
 *   - FilterSliders.tsx CategorizedDropdown type-picker options
 *   - CustomPropertiesSection.tsx autocomplete suggestion rows — the input
 *     drives them, so they get the combobox/listbox/aria-activedescendant
 *     pattern (reference: shell/CommandPalette.tsx)
 *   - SpacingValuePopover.tsx preset cells (already native buttons — locked
 *     in with aria-pressed + aria-label here)
 *   - PositionOffsetDiagram.tsx AutoLabel spans + click-to-edit values
 */
import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { BackgroundLayerList, type BackgroundLayer } from "../sections/BackgroundLayerList";
import { FilterEditor, createDefaultItem } from "../sections/FilterSliders";
import { CustomPropertiesSection } from "../sections/CustomPropertiesSection";
import { SpacingValuePopover } from "../sections/SpacingValuePopover";
import { PositionOffsetDiagram } from "../sections/PositionOffsetDiagram";
import { applyInlineStyle, resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

beforeAll(() => {
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

// ─── BackgroundLayerList ───────────────────────────────────────────────

const COLOR_LAYER: BackgroundLayer = {
  id: "bg_a11y_1",
  type: "color",
  color: "#ff0000",
  opacity: 1,
  blendMode: "normal",
  visible: true,
};

describe("BackgroundLayerList add-menu options a11y", () => {
  it("menu options are native focusable buttons", () => {
    render(<BackgroundLayerList layers={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("+ Add background"));
    for (const label of ["color", "gradient", "image"]) {
      const opt = screen.getByText(label) as HTMLElement;
      const btn = opt.closest("button");
      expect(btn, `"${label}" option must be a <button> — mouse-only surface`).toBeTruthy();
      expect((btn as HTMLButtonElement).tabIndex).toBe(0);
    }
  });

  it("clicking an option still adds a layer (mouse unchanged)", () => {
    const onChange = vi.fn();
    render(<BackgroundLayerList layers={[]} onChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add background"));
    fireEvent.click(screen.getByText("color"));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "color" })]);
  });
});

describe("BackgroundLayerList edit-color chip a11y", () => {
  function renderExpanded(onEditColor = vi.fn()) {
    const utils = render(
      <BackgroundLayerList layers={[COLOR_LAYER]} onChange={vi.fn()} onEditColor={onEditColor} />,
    );
    const row = utils.container.querySelector('[role="button"][aria-expanded]') as HTMLElement;
    fireEvent.click(row); // expand the layer
    return { ...utils, onEditColor };
  }

  it("chip is a native focusable button with an accessible label", () => {
    renderExpanded();
    const chip = screen.getByLabelText(/edit color/i) as HTMLElement;
    expect(chip.tagName).toBe("BUTTON");
    chip.focus();
    expect(document.activeElement).toBe(chip);
  });

  it("clicking the chip still opens the color editor (mouse unchanged)", () => {
    const { onEditColor } = renderExpanded();
    fireEvent.click(screen.getByLabelText(/edit color/i));
    expect(onEditColor).toHaveBeenCalledWith(COLOR_LAYER.id);
  });
});

// ─── FilterSliders type picker ─────────────────────────────────────────

describe("FilterSliders type-picker options a11y", () => {
  function openPicker(items = [] as ReturnType<typeof createDefaultItem>[], onChange = vi.fn()) {
    const utils = render(<FilterEditor items={items} onChange={onChange} type="filter" />);
    fireEvent.click(screen.getByText("+ Add filter"));
    return { ...utils, onChange };
  }

  it("type options are native focusable buttons", () => {
    openPicker();
    const blur = screen.getByText("Blur").closest("button") as HTMLButtonElement;
    expect(blur, "type option must be a <button> — mouse-only surface").toBeTruthy();
    expect(blur.tabIndex).toBe(0);
    blur.focus();
    expect(document.activeElement).toBe(blur);
  });

  it("options expose active state via aria-pressed", () => {
    const active = createDefaultItem("blur");
    openPicker([active]);
    // The active item's summary row also says "Blur" — scope to picker options.
    const options = Array.from(document.querySelectorAll("button[aria-pressed]"));
    const blur = options.find((o) => o.textContent?.includes("Blur")) as HTMLButtonElement;
    const sepia = options.find((o) => o.textContent?.includes("Sepia")) as HTMLButtonElement;
    expect(blur.getAttribute("aria-pressed")).toBe("true");
    expect(sepia.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking an option still adds the filter (mouse unchanged)", () => {
    const { onChange } = openPicker();
    fireEvent.click(screen.getByText("Blur").closest("button") as HTMLElement);
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ type: "blur" })]);
  });
});

// ─── CustomPropertiesSection autocomplete ──────────────────────────────

function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const cs = getComputedStyle(element);
  return {
    element,
    apply: (prop: string, value: string) => applyInlineStyle(element, prop, value),
    reset: vi.fn(),
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

describe("CustomPropertiesSection autocomplete a11y (combobox pattern)", () => {
  function openAutocomplete(query = "colo") {
    const utils = render(<CustomPropertiesSection ctx={makeCtx()} forceOpen />);
    fireEvent.click(screen.getByText("Add"));
    const input = utils.container.querySelector('input[placeholder="property"]') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: query } });
    return { ...utils, input };
  }

  it("suggestion list is a listbox of options", () => {
    openAutocomplete();
    const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
    expect(listbox, "suggestion dropdown must have role='listbox'").toBeTruthy();
    const options = listbox.querySelectorAll('[role="option"]');
    expect(options.length).toBeGreaterThan(0);
    expect(options[0].id).toBeTruthy();
  });

  it("input is a combobox whose aria-activedescendant tracks arrow keys", () => {
    const { input } = openAutocomplete();
    expect(input.getAttribute("role")).toBe("combobox");
    expect(input.getAttribute("aria-autocomplete")).toBe("list");
    expect(input.getAttribute("aria-expanded")).toBe("true");
    const listbox = document.querySelector('[role="listbox"]') as HTMLElement;
    expect(input.getAttribute("aria-controls")).toBe(listbox.id);
    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    expect(input.getAttribute("aria-activedescendant")).toBe(options[0].id);
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const optionsAfter = Array.from(document.querySelectorAll('[role="option"]'));
    expect(input.getAttribute("aria-activedescendant")).toBe(optionsAfter[1].id);
    expect(optionsAfter[1].getAttribute("aria-selected")).toBe("true");
    expect(optionsAfter[0].getAttribute("aria-selected")).toBe("false");
  });

  it("Enter selects the active option (existing behavior, still works)", () => {
    const { input } = openAutocomplete("color");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input.value).toBe("color");
  });

  it("mouse click on an option still selects it (unchanged)", () => {
    const { input } = openAutocomplete("column-ga");
    const option = Array.from(document.querySelectorAll('[role="option"]')).find(
      (o) => o.textContent === "column-gap",
    ) as HTMLElement;
    expect(option).toBeTruthy();
    fireEvent.click(option);
    expect(input.value).toBe("column-gap");
  });
});

// ─── SpacingValuePopover preset cells ──────────────────────────────────

describe("SpacingValuePopover preset cells a11y", () => {
  function renderPopover(onChange = vi.fn(), value = 16) {
    const anchorRect = {
      top: 100, right: 120, bottom: 120, left: 100, width: 20, height: 20, x: 100, y: 100,
      toJSON: () => ({}),
    } as DOMRect;
    const utils = render(
      <SpacingValuePopover
        value={value}
        onChange={onChange}
        unit="px"
        units={["px", "rem"]}
        onUnitChange={vi.fn()}
        property="margin-top"
        isMargin={true}
        anchorRect={anchorRect}
        onClose={vi.fn()}
      />,
    );
    return { ...utils, onChange };
  }

  it("preset cells are native focusable buttons with property-derived labels", () => {
    renderPopover();
    const btn = screen.getByLabelText("Set margin-top to 32") as HTMLButtonElement;
    expect(btn.tagName).toBe("BUTTON");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("current preset is exposed via aria-pressed", () => {
    renderPopover(vi.fn(), 16);
    expect(screen.getByLabelText("Set margin-top to 16").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Set margin-top to 32").getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking a preset still applies it (mouse unchanged)", () => {
    const { onChange } = renderPopover();
    fireEvent.click(screen.getByLabelText("Set margin-top to 32"));
    expect(onChange).toHaveBeenCalledWith(32);
  });
});

// ─── PositionOffsetDiagram ─────────────────────────────────────────────

describe("PositionOffsetDiagram AutoLabel + editable values a11y", () => {
  function renderDiagram(overrides: Partial<Parameters<typeof PositionOffsetDiagram>[0]> = {}) {
    const onAutoDisable = vi.fn();
    const utils = render(
      <PositionOffsetDiagram
        top={0}
        right={2}
        bottom={3}
        left={4}
        onChange={vi.fn()}
        units={{ top: "px", right: "px", bottom: "px", left: "px" }}
        availableUnits={["px", "%"]}
        onUnitChange={vi.fn()}
        autoStates={{ top: true, right: false, bottom: false, left: false }}
        onAutoDisable={onAutoDisable}
        {...overrides}
      />,
    );
    return { ...utils, onAutoDisable };
  }

  it("Auto label is a focusable button", () => {
    renderDiagram();
    const auto = screen.getByText("Auto") as HTMLElement;
    expect(auto.getAttribute("role")).toBe("button");
    expect(auto.tabIndex).toBe(0);
    auto.focus();
    expect(document.activeElement).toBe(auto);
  });

  it("Enter and Space activate the Auto label like click", () => {
    const { onAutoDisable } = renderDiagram();
    const auto = screen.getByText("Auto") as HTMLElement;
    fireEvent.keyDown(auto, { key: "Enter" });
    expect(onAutoDisable).toHaveBeenCalledWith("top");
    fireEvent.keyDown(auto, { key: " " });
    expect(onAutoDisable).toHaveBeenCalledTimes(2);
  });

  it("mouse click on Auto still works (unchanged)", () => {
    const { onAutoDisable } = renderDiagram();
    fireEvent.click(screen.getByText("Auto"));
    expect(onAutoDisable).toHaveBeenCalledWith("top");
  });

  it("editable value spans are focusable; Enter starts editing", () => {
    const { container } = renderDiagram();
    const span = screen.getByText("3") as HTMLElement; // bottom offset
    expect(span.tabIndex).toBe(0);
    fireEvent.keyDown(span, { key: "Enter" });
    const input = container.querySelector("input:not([type])") ?? container.querySelector("input");
    expect(input).toBeTruthy();
  });

  it("mouse click on a value still starts editing (unchanged)", () => {
    const { container } = renderDiagram();
    fireEvent.click(screen.getByText("4"));
    expect(container.querySelector("input")).toBeTruthy();
  });
});
