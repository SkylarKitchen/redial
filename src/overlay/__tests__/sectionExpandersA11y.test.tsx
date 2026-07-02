// @vitest-environment happy-dom
/**
 * Section "advanced options" expanders — keyboard accessibility (issue #85).
 *
 * The Size section's "More size options" and the Layout section's (grid)
 * "More alignment options" toggles were mouse-only <div onClick> strips:
 * not focusable, no keyboard activation, no ARIA expanded state. They must
 * be native <button>s with aria-expanded.
 *
 * The Typography ("More type options") and Position ("Float and clear")
 * expanders were already native buttons — they must additionally expose
 * aria-expanded so the expansion state is announced.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LayoutSection } from "../sections/LayoutSection";
import { SizeSection } from "../sections/SizeSection";
import { TypographySection } from "../sections/TypographySection";
import { PositionSection } from "../sections/PositionSection";
import { applyInlineStyle, resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// happy-dom lacks document.fonts; TypographySection's mount effect reads
// document.fonts.ready. Stub it so client-side render doesn't throw.
if (!(document as unknown as { fonts?: unknown }).fonts) {
  (document as unknown as { fonts: unknown }).fonts = {
    ready: Promise.resolve(),
    forEach: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

afterEach(() => {
  cleanup();
  resetAll();
  document.body.innerHTML = "";
});

/** Minimal SectionCtx wired to the real apply engine (happy-dom computed styles). */
function makeCtx(display: string): SectionCtx {
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

/** The expander control that owns the given label text. */
function expanderFor(label: string): HTMLElement {
  const span = screen.getByText(label);
  const btn = span.closest("button");
  if (!btn) throw new Error(`"${label}" expander is not a <button> — mouse-only surface`);
  return btn as HTMLElement;
}

describe("SizeSection 'More size options' expander a11y", () => {
  it("is a keyboard-focusable native button with aria-expanded", () => {
    render(<SizeSection ctx={makeCtx("block")} display="block" isMedia={false} forceOpen />);
    const btn = expanderFor("More size options");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.tabIndex).toBe(0);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("click toggles aria-expanded and reveals the advanced rows (mouse unchanged)", () => {
    render(<SizeSection ctx={makeCtx("block")} display="block" isMedia={false} forceOpen />);
    const btn = expanderFor("More size options");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Aspect")).toBeTruthy();
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("LayoutSection (grid) 'More alignment options' expander a11y", () => {
  function renderGridLayout() {
    const ctx = makeCtx("grid");
    render(
      <LayoutSection
        ctx={ctx}
        display="grid"
        onDisplayChange={vi.fn()}
        columnGap={0}
        columnGapUnit="px"
        onColumnGapChange={vi.fn()}
        onColumnGapUnitChange={vi.fn()}
        isFlex={false}
        isGrid={true}
        parentIsFlex={false}
        parentIsGrid={false}
        forceOpen
      />,
    );
  }

  it("is a keyboard-focusable native button with aria-expanded", () => {
    renderGridLayout();
    const btn = expanderFor("More alignment options");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.tabIndex).toBe(0);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });

  it("click toggles aria-expanded (mouse unchanged)", () => {
    renderGridLayout();
    const btn = expanderFor("More alignment options");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("TypographySection 'More type options' expander a11y", () => {
  it("exposes aria-expanded that toggles with the expansion", () => {
    render(
      <TypographySection
        ctx={makeCtx("block")}
        columnGap={0}
        columnGapUnit="px"
        onColumnGapChange={vi.fn()}
        onColumnGapUnitChange={vi.fn()}
        forceOpen
      />,
    );
    const btn = screen.getByText("More type options").closest("button") as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("PositionSection 'Float and clear' expander a11y", () => {
  it("exposes aria-expanded that toggles with the expansion", () => {
    render(<PositionSection ctx={makeCtx("block")} forceOpen />);
    const btn = screen.getByText("Float and clear").closest("button") as HTMLElement;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});
