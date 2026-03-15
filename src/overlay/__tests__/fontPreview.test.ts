// @vitest-environment happy-dom
/**
 * fontPreview.test.ts — Verifies the fontPreview prop in SelectRow
 *
 * Validates:
 * 1. SelectRowCustom renders trigger with selected font's own typeface
 * 2. Each dropdown option is styled with its own font-family
 * 3. Fallback chain includes monospace so missing fonts degrade gracefully
 * 4. When fontPreview is false/absent, options use the mono theme font instead
 * 5. Font enumeration from document.fonts feeds the option list
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const overlayDir = join(__dirname, "..");
const selectRowSrc = readFileSync(join(overlayDir, "controls", "SelectRow.tsx"), "utf-8");
const typoSrc = readFileSync(join(overlayDir, "sections", "TypographySection.tsx"), "utf-8");

// ─── 1. SelectRowCustom trigger applies selected font ─────────────────

describe("fontPreview — trigger button shows selected font in its own typeface", () => {
  // Extract the SelectRowCustom function body
  const fnStart = selectRowSrc.indexOf("function SelectRowCustom(");
  const fnBody = selectRowSrc.slice(fnStart);

  it("trigger button fontFamily includes current.value when fontPreview is true", () => {
    // The trigger uses: fontFamily: fontPreview && current ? `${current.value}, ...` : font.mono
    expect(fnBody).toMatch(
      /fontFamily:\s*fontPreview\s*&&\s*current\s*\?\s*`\$\{current\.value\}/
    );
  });

  it("trigger has monospace fallback in the font stack", () => {
    // The fallback chain: `${current.value}, ui-monospace, 'SF Mono', monospace`
    const triggerStyle = fnBody.match(/fontFamily:\s*fontPreview\s*&&\s*current\s*\?[^:]+/s);
    expect(triggerStyle).toBeTruthy();
    expect(triggerStyle![0]).toContain("monospace");
  });
});

// ─── 2. Dropdown options render in their own font ─────────────────────

describe("fontPreview — dropdown options styled per-font", () => {
  const fnStart = selectRowSrc.indexOf("function SelectRowCustom(");
  const fnBody = selectRowSrc.slice(fnStart);

  it("each CommandItem fontFamily includes opt.value when fontPreview is true", () => {
    // The option uses: fontFamily: fontPreview ? `${opt.value}, ...` : font.mono
    expect(fnBody).toMatch(
      /fontFamily:\s*fontPreview\s*\?\s*`\$\{opt\.value\}/
    );
  });

  it("option fallback includes monospace for graceful degradation", () => {
    const optionStyle = fnBody.match(/fontFamily:\s*fontPreview\s*\?\s*`\$\{opt\.value\}[^`]*`/);
    expect(optionStyle).toBeTruthy();
    expect(optionStyle![0]).toContain("monospace");
  });

  it("falls back to font.mono when fontPreview is false", () => {
    // The ternary: fontPreview ? `${opt.value}, ...` : font.mono
    // Use [^:]+ to skip through the template literal (which contains commas)
    const optionLine = fnBody.match(/fontFamily:\s*fontPreview\s*\?[^:]+:\s*font\.mono/);
    expect(optionLine).toBeTruthy();
  });
});

// ─── 3. TypographySection passes fontPreview to Font dropdown ─────────

describe("fontPreview — TypographySection integration", () => {
  it("Font SelectRow has both searchable and fontPreview props", () => {
    expect(typoSrc).toMatch(/SelectRow[^>]*label="Font"[^>]*searchable[^>]*fontPreview/);
  });

  it("Weight SelectRow does NOT have fontPreview (uses weightPreview instead)", () => {
    const weightRow = typoSrc.match(/SelectRow[^>]*label="Weight"[^/>]*/);
    expect(weightRow).toBeTruthy();
    expect(weightRow![0]).not.toContain("fontPreview");
    expect(weightRow![0]).toContain("weightPreview");
  });
});

// ─── 4. Font list sourced from document.fonts + fallbacks ─────────────

describe("fontPreview — font list construction", () => {
  it("enumerates page fonts from document.fonts API", () => {
    expect(typoSrc).toContain("document.fonts.ready");
    expect(typoSrc).toContain("document.fonts.forEach");
  });

  it("merges page fonts with FALLBACK_FONTS using Set for dedup", () => {
    expect(typoSrc).toMatch(/new Set\(\[\.\.\.pageFonts,\s*\.\.\.FALLBACK_FONTS\]\)/);
  });

  it("font options are memoized on pageFonts", () => {
    expect(typoSrc).toMatch(/useMemo\(\s*\(\)\s*=>\s*\[\.\.\.new Set/);
  });
});

// ─── 5. No remote font loading on dropdown open (perf) ────────────────

describe("fontPreview — no remote font loading needed", () => {
  it("does not contain Google Fonts API or @font-face injection", () => {
    expect(selectRowSrc).not.toContain("fonts.googleapis.com");
    expect(selectRowSrc).not.toContain("@font-face");
    expect(selectRowSrc).not.toContain("FontFace(");
  });

  it("TypographySection does not fetch remote fonts", () => {
    expect(typoSrc).not.toContain("fonts.googleapis.com");
    expect(typoSrc).not.toContain("@font-face");
    // The only fetch-like call is document.fonts.ready (local API)
  });
});
