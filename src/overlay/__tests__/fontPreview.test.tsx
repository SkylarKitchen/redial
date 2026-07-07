// @vitest-environment happy-dom
/**
 * fontPreview.test.tsx — Behavioral tests for the fontPreview prop
 * (issue #105 exemplar migration; formerly component-source regexes).
 *
 * Mounted-DOM guarantees:
 * 1. SelectRowCustom's trigger renders the selected font's own typeface,
 *    with a monospace fallback chain for graceful degradation.
 * 2. Each dropdown option is styled with its own font-family (+ monospace
 *    fallback); without fontPreview, options use the mono theme font.
 * 3. TypographySection's Font row is searchable + font-previewed; the Weight
 *    row is weight-previewed (options at their own font-weight), not
 *    font-previewed.
 * 4. Font enumeration from document.fonts feeds the option list, merged with
 *    FALLBACK_FONTS and deduplicated.
 * 5. Rendering + opening the font dropdown performs no remote font loading
 *    (no fetch, no FontFace construction, no @font-face/googleapis injection).
 *
 * Dropdowns render through data-tuner-portal portals into document.body, so
 * queries go against the whole document.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { readFileSync } from "fs";
import { join } from "path";
import { SelectRow } from "../controls/SelectRow";
import { TypographySection } from "../sections/TypographySection";
import { FALLBACK_FONTS } from "../panelConstants";
import { font } from "../theme";
import { applyInlineStyle, resetAll } from "../core/apply";
import type { SectionCtx } from "../panelUtils";
import type { UnitConversionContext } from "../unitConversion";

// happy-dom lacks document.fonts; TypographySection's mount effect awaits
// document.fonts.ready then enumerates via forEach. Stub a FontFaceSet whose
// families include a page-only font AND a duplicate of a FALLBACK_FONTS entry
// (Georgia) so the merge/dedup behavior is observable. Families are quoted to
// exercise the quote-stripping the component performs.
const PAGE_FONT_FAMILIES = ["Custom Font", "Georgia"];
(document as unknown as { fonts: unknown }).fonts = {
  ready: Promise.resolve(),
  forEach: (cb: (f: { family: string }) => void) => {
    for (const family of PAGE_FONT_FAMILIES) cb({ family: `"${family}"` });
  },
  addEventListener: () => {},
  removeEventListener: () => {},
};

afterEach(() => {
  cleanup();
  resetAll();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

/** Normalize quote styles so font stacks compare reliably across serializers. */
const norm = (s: string | null | undefined) => (s ?? "").replace(/["']/g, "");

/** Flush document.fonts.ready → setPageFonts inside act(). */
async function flushFonts() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

function getOptions(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll('[role="option"]'));
}

/** SearchableMenu wraps renderItem output in the role=option div; the inner div carries the font styling. */
function optionInner(opt: HTMLElement): HTMLElement {
  return (opt.firstElementChild ?? opt) as HTMLElement;
}

// ─── 1+2. SelectRowCustom — trigger + options in their own typeface ────

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter" },
  { value: "Playfair Display", label: "Playfair Display" },
];

function renderFontRow(extra: { fontPreview?: boolean; searchable?: boolean }) {
  const { container } = render(
    <SelectRow label="Font" value="Inter" options={FONT_OPTIONS} onChange={vi.fn()} {...extra} />,
  );
  return { trigger: container.querySelector("button") as HTMLElement };
}

describe("fontPreview — trigger button shows selected font in its own typeface", () => {
  it("trigger fontFamily leads with the selected value and falls back to monospace", () => {
    const { trigger } = renderFontRow({ fontPreview: true });
    const stack = norm(trigger.style.fontFamily);
    expect(stack.startsWith("Inter")).toBe(true);
    expect(stack).toContain("monospace");
  });

  it("without fontPreview the trigger uses the mono theme font, not the selected font", () => {
    const { trigger } = renderFontRow({ searchable: true });
    expect(norm(trigger.style.fontFamily)).toBe(norm(font.mono));
    expect(norm(trigger.style.fontFamily)).not.toContain("Inter");
  });
});

describe("fontPreview — dropdown options styled per-font", () => {
  it("each option's fontFamily leads with its own value and includes a monospace fallback", () => {
    const { trigger } = renderFontRow({ fontPreview: true });
    fireEvent.click(trigger);
    const options = getOptions();
    expect(options.map((o) => o.textContent)).toEqual(["Inter", "Playfair Display"]);
    for (const opt of options) {
      const stack = norm(optionInner(opt).style.fontFamily);
      expect(stack.startsWith(opt.textContent!)).toBe(true);
      expect(stack).toContain("monospace");
    }
  });

  it("falls back to font.mono for every option when fontPreview is false", () => {
    const { trigger } = renderFontRow({ searchable: true });
    fireEvent.click(trigger);
    const options = getOptions();
    expect(options.length).toBe(FONT_OPTIONS.length);
    for (const opt of options) {
      expect(norm(optionInner(opt).style.fontFamily)).toBe(norm(font.mono));
    }
  });
});

// ─── 3–5. TypographySection integration ────────────────────────────────

/** Minimal SectionCtx wired to the real apply engine (house pattern). */
function makeCtx(): SectionCtx {
  const element = document.createElement("div");
  element.style.display = "block";
  element.style.fontFamily = "Georgia"; // the "currently applied" font
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

async function renderTypography() {
  render(
    <TypographySection
      ctx={makeCtx()}
      columnGap={0}
      columnGapUnit="px"
      onColumnGapChange={vi.fn()}
      onColumnGapUnitChange={vi.fn()}
      forceOpen
    />,
  );
  await flushFonts();
}

/** The trigger button inside the row labeled `label`. */
function rowTrigger(label: string): HTMLElement {
  const row = screen.getByText(label).parentElement as HTMLElement;
  return row.querySelector("button") as HTMLElement;
}

describe("fontPreview — TypographySection integration", () => {
  it("Font row is searchable AND font-previewed: opening shows a search input and per-font options; trigger renders the current font in its own face", async () => {
    await renderTypography();
    const trigger = rowTrigger("Font");
    // Trigger previews the applied font (fontPreview behavior).
    expect(norm(trigger.style.fontFamily).startsWith("Georgia")).toBe(true);
    fireEvent.click(trigger);
    // Searchable behavior: the custom portal renders a search input.
    const portal = document.querySelector("[data-select-custom-portal]") as HTMLElement;
    expect(portal).not.toBeNull();
    expect(portal.querySelector("input")).not.toBeNull();
    // fontPreview behavior on options: each renders in its own family.
    const custom = getOptions(portal).find((o) => o.textContent === "Custom Font")!;
    expect(norm(optionInner(custom).style.fontFamily).startsWith("Custom Font")).toBe(true);
  });

  it("Weight row is weight-previewed, NOT font-previewed: plain dropdown (no search input), options at their own font-weight in the mono font", async () => {
    await renderTypography();
    fireEvent.click(rowTrigger("Weight"));
    // Plain SelectRow path — a searchable/fontPreview row would use the custom portal.
    expect(document.querySelector("[data-select-custom-portal]")).toBeNull();
    const portal = document.querySelector("[data-select-portal]") as HTMLElement;
    expect(portal).not.toBeNull();
    expect(portal.querySelector("input")).toBeNull();
    const bold = getOptions(portal).find((o) => o.textContent === "700 - Bold") as HTMLElement;
    expect(bold).toBeTruthy();
    expect(bold.style.fontWeight).toBe("700"); // weightPreview: rendered at its own weight
    expect(norm(bold.style.fontFamily)).toBe(norm(font.mono)); // no per-font preview
  });
});

// ─── 4. Font list sourced from document.fonts + fallbacks ─────────────

describe("fontPreview — font list construction", () => {
  it("page fonts enumerated from document.fonts appear in the option list (quotes stripped), merged with FALLBACK_FONTS", async () => {
    await renderTypography();
    fireEvent.click(rowTrigger("Font"));
    const portal = document.querySelector("[data-select-custom-portal]") as HTMLElement;
    const labels = getOptions(portal).map((o) => o.textContent);
    expect(labels).toContain("Custom Font"); // from the document.fonts stub
    for (const fallback of FALLBACK_FONTS) {
      expect(labels).toContain(fallback);
    }
  });

  it("page fonts that duplicate a fallback are deduplicated (Georgia appears exactly once)", async () => {
    await renderTypography();
    fireEvent.click(rowTrigger("Font"));
    const portal = document.querySelector("[data-select-custom-portal]") as HTMLElement;
    const labels = getOptions(portal).map((o) => o.textContent);
    // Guard against a vacuous pass: prove page-font enumeration ran in THIS render.
    expect(labels).toContain("Custom Font");
    expect(labels.filter((l) => l === "Georgia")).toHaveLength(1);
  });

  it("CONVENTION: fontOptions stays memoized on pageFonts (perf convention, not observable behavior)", () => {
    // Kept as a source-text check: referential stability of the memoized
    // options array is not observable from the rendered DOM.
    const typoSrc = readFileSync(
      join(__dirname, "..", "sections", "TypographySection.tsx"),
      "utf-8",
    );
    expect(typoSrc).toMatch(/useMemo\(\s*\(\)\s*=>\s*\[\.\.\.new Set/);
  });
});

// ─── 5. No remote font loading on dropdown open (perf) ────────────────

describe("fontPreview — no remote font loading needed", () => {
  it("rendering the section and opening the Font dropdown triggers no fetch, no FontFace construction, and injects no @font-face/googleapis resources", async () => {
    const fetchSpy = vi.fn();
    const fontFaceSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("FontFace", fontFaceSpy);

    await renderTypography();
    fireEvent.click(rowTrigger("Font"));
    expect(document.querySelector("[data-select-custom-portal]")).not.toBeNull();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fontFaceSpy).not.toHaveBeenCalled();
    expect(document.querySelector('link[href*="fonts.googleapis.com"]')).toBeNull();
    const styleTags = Array.from(document.querySelectorAll("style"));
    expect(styleTags.some((s) => (s.textContent ?? "").includes("@font-face"))).toBe(false);
  });
});
