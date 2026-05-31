/**
 * variableAudit.test.ts — Source-level audit tests for variable system consistency.
 *
 * Covers:
 * - Portal data-tuner-portal attribute on all createPortal wrappers
 * - VariableField usage in all control linked states
 * - Unlink null guards and computed value restoration
 * - Variable prop wiring in section files
 * - Save path var() preservation
 * - Element scoping for variable discovery
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "..");

function readSrc(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf-8");
}

// ─── Portal data-tuner-portal attribute ───────────────────────────────

describe("createPortal wrappers must have data-tuner-portal", () => {
  const portalFiles = [
    "controls/VariablePicker.tsx",
    "controls/VariableField.tsx",
    "controls/ColorRow.tsx",
    "controls/SelectRow.tsx",
    "controls/UnitSelector.tsx",
    "controls/ResetPopover.tsx",
    "sections/SpacingValuePopover.tsx",
    "sections/SpacingBoxModel.tsx",
    "sections/TextStyleRow.tsx",
    "sections/EffectsSection.tsx",
    "sections/GridSettingsPopup.tsx",
    "sections/PositionSelector.tsx",
    "shell/ContextMenu.tsx",
    "shell/PropertyContextMenu.tsx",
    "variables/DetailContextMenu.tsx",
    "variables/ModeValueCell.tsx",
    "variables/CollectionSidebar.tsx",
  ];

  for (const file of portalFiles) {
    it(`${file} has data-tuner-portal on portal root`, () => {
      const src = readSrc(file);
      if (!src.includes("createPortal")) return;
      expect(src).toContain("data-tuner-portal");
    });
  }
});

// ─── VariableField usage in all controls ──────────────────────────────

describe("all variable-capable controls use VariableField for linked state", () => {
  const controls: Array<{ file: string; name: string }> = [
    { file: "controls/ColorRow.tsx", name: "ColorRow" },
    { file: "controls/SliderRow.tsx", name: "SliderRow" },
    { file: "sections/SizeInputCell.tsx", name: "SizeInputCell" },
    { file: "sections/layoutMisc.tsx", name: "TypoValueCell" },
    { file: "sections/SpacingValuePopover.tsx", name: "SpacingValuePopover" },
    { file: "variables/ModeValueCell.tsx", name: "ModeValueCell" },
    { file: "variables/DetailVariableRow.tsx", name: "DetailVariableRow" },
  ];

  for (const { file, name } of controls) {
    it(`${name} imports VariableField`, () => {
      const src = readSrc(file);
      expect(src).toMatch(/import.*VariableField.*from/);
    });

    it(`${name} renders <VariableField> in linked state`, () => {
      const src = readSrc(file);
      expect(src).toContain("<VariableField");
    });
  }
});

// ─── VariableLinkDot usage in unlinked state ──────────────────────────

describe("all variable-capable controls use VariableLinkDot for unlinked state", () => {
  const controls: Array<{ file: string; name: string }> = [
    { file: "controls/ColorRow.tsx", name: "ColorRow" },
    { file: "controls/SliderRow.tsx", name: "SliderRow" },
    { file: "sections/SizeInputCell.tsx", name: "SizeInputCell" },
    { file: "sections/layoutMisc.tsx", name: "TypoValueCell" },
    { file: "sections/SpacingValuePopover.tsx", name: "SpacingValuePopover" },
  ];

  for (const { file, name } of controls) {
    it(`${name} imports VariableLinkDot`, () => {
      const src = readSrc(file);
      expect(src).toMatch(/import.*VariableLinkDot.*from/);
    });

    it(`${name} renders <VariableLinkDot> in unlinked state`, () => {
      const src = readSrc(file);
      expect(src).toContain("<VariableLinkDot");
    });
  }
});

// ─── ColorRow variable wiring ─────────────────────────────────────────

describe("ColorRow variable integration", () => {
  const src = readSrc("controls/ColorRow.tsx");

  it("detects var() references via parseVarRef", () => {
    expect(src).toMatch(/parseVarRef\s*\(/);
  });

  it("passes element to VariableField for scoped discovery", () => {
    // VariableField should receive element={computedElement} so the picker
    // discovers element-scoped variables, not just root ones
    expect(src).toMatch(/element=\{computedElement\}/);
  });

  it("passes variableType='color' to VariableField", () => {
    expect(src).toContain('variableType="color"');
  });

  it("has fallback when resolveVarColor returns null on unlink", () => {
    const unlinkSection = src.slice(
      src.indexOf("onUnlink"),
      src.indexOf("onUnlink") + 200,
    );
    const hasNullGuard =
      unlinkSection.includes("getComputedStyle") ||
      unlinkSection.includes("||") ||
      unlinkSection.includes("??");
    expect(hasNullGuard).toBe(true);
  });

  it("hides reset X button when linked", () => {
    // The reset X should only show when !varName (unlinked)
    expect(src).toMatch(/!varName.*indicator.*===.*"modified"/s);
  });
});

// ─── SliderRow variable wiring ────────────────────────────────────────

describe("SliderRow variable integration", () => {
  const src = readSrc("controls/SliderRow.tsx");

  it("accepts onSelectVariable prop", () => {
    expect(src).toMatch(/onSelectVariable\??\s*:/);
  });

  it("accepts activeVariable prop", () => {
    expect(src).toMatch(/activeVariable\??\s*:/);
  });

  it("accepts variableType prop with default", () => {
    expect(src).toContain("variableType");
    // Default should be "length" not "all"
    expect(src).toMatch(/variableType\s*\?\?\s*"length"/);
  });

  it("renders variable mode when activeVariable is set", () => {
    // The early return branch should check activeVariable
    expect(src).toMatch(/if\s*\(\s*activeVariable\s*\)/);
  });

  it("passes element to VariableField for scoped discovery", () => {
    expect(src).toMatch(/element=\{variableElement\}/);
  });

  it("uses beginBatch/endBatch for slider drag coalescing", () => {
    expect(src).toContain("beginBatch");
    expect(src).toContain("endBatch");
  });

  it("resolves computed value on unlink via getComputedStyle", () => {
    expect(src).toMatch(/getComputedStyle\s*\(\s*variableElement\s*\)/);
  });
});

// ─── SizeInputCell variable wiring ────────────────────────────────────

describe("SizeInputCell variable integration", () => {
  const src = readSrc("sections/SizeInputCell.tsx");

  it("accepts cssVar and onCssVarChange props", () => {
    expect(src).toContain("cssVar?:");
    expect(src).toContain("onCssVarChange?:");
  });

  it("detects variable state from cssVar prop", () => {
    expect(src).toMatch(/isVariable.*=.*cssVar/);
  });

  it("disables wheel adjust when variable is linked", () => {
    expect(src).toMatch(/disabled.*isVariable/);
  });

  it("passes variableType='length' to VariableField", () => {
    expect(src).toContain('variableType="length"');
  });
});

// ─── TypoValueCell variable wiring ────────────────────────────────────

describe("TypoValueCell variable integration", () => {
  const src = readSrc("sections/layoutMisc.tsx");

  it("accepts cssVar and onCssVarChange props", () => {
    const tvCell = src.slice(src.indexOf("function TypoValueCell"));
    expect(tvCell).toContain("cssVar?:");
    expect(tvCell).toContain("onCssVarChange?:");
  });

  it("passes variableType='length' to VariableField", () => {
    const tvCell = src.slice(src.indexOf("function TypoValueCell"));
    expect(tvCell).toContain('variableType="length"');
  });
});

// ─── Section-level variable prop wiring ───────────────────────────────

describe("section files wire variable props to controls", () => {
  it("LayoutSection passes onSelectVariable and activeVariable to gap SliderRows", () => {
    const src = readSrc("sections/LayoutSection.tsx");
    expect(src).toContain("onSelectVariable={handleGapSelectVar}");
    expect(src).toContain("activeVariable={gapVar}");
  });

  it("EffectsSection passes variable props to opacity SliderRow", () => {
    const src = readSrc("sections/EffectsSection.tsx");
    expect(src).toContain("onSelectVariable={handleOpacitySelectVar}");
    expect(src).toContain("activeVariable={opacityVar}");
  });

  it("TypographySection passes cssVar props to font-size TypoValueCell", () => {
    const src = readSrc("sections/TypographySection.tsx");
    expect(src).toContain("cssVar={fontSizeVar}");
    expect(src).toContain("onCssVarChange={handleFontSizeVarChange}");
  });

  it("TypographySection passes cssVar props to line-height TypoValueCell", () => {
    const src = readSrc("sections/TypographySection.tsx");
    expect(src).toContain("cssVar={lineHeightVar}");
    expect(src).toContain("onCssVarChange={handleLineHeightVarChange}");
  });

  it("TypographySection passes cssVar props to letter-spacing TypoValueCell", () => {
    const src = readSrc("sections/TypographySection.tsx");
    expect(src).toContain("cssVar={letterSpacingVar}");
    expect(src).toContain("onCssVarChange={handleLetterSpacingVarChange}");
  });

  it("SizeSection passes cssVar props to all 6 SizeInputCells", () => {
    const src = readSrc("sections/SizeSection.tsx");
    expect(src).toContain("cssVar={widthVar}");
    expect(src).toContain("cssVar={heightVar}");
    expect(src).toContain("cssVar={minWidthVar}");
    expect(src).toContain("cssVar={minHeightVar}");
    expect(src).toContain("cssVar={maxWidthVar}");
    expect(src).toContain("cssVar={maxHeightVar}");
  });
});

// ─── Section unlink handlers restore computed values ──────────────────

describe("section unlink handlers restore computed values", () => {
  it("TypographySection font-size handler reads getComputedStyle on unlink", () => {
    const src = readSrc("sections/TypographySection.tsx");
    // The handler for null varName should call getComputedStyle
    const handler = src.slice(
      src.indexOf("handleFontSizeVarChange"),
      src.indexOf("handleFontSizeVarChange") + 300,
    );
    expect(handler).toContain("getComputedStyle");
  });

  it("TypographySection line-height handler reads getComputedStyle on unlink", () => {
    const src = readSrc("sections/TypographySection.tsx");
    const handler = src.slice(
      src.indexOf("handleLineHeightVarChange"),
      src.indexOf("handleLineHeightVarChange") + 300,
    );
    expect(handler).toContain("getComputedStyle");
  });

  it("SizeSection width handler reads getComputedStyle on unlink", () => {
    const src = readSrc("sections/SizeSection.tsx");
    const handler = src.slice(
      src.indexOf("handleWidthVarChange"),
      src.indexOf("handleWidthVarChange") + 300,
    );
    expect(handler).toContain("getComputedStyle");
  });

  it("SliderRow unlink handler reads getComputedStyle", () => {
    const src = readSrc("controls/SliderRow.tsx");
    const handler = src.slice(
      src.indexOf("handleUnlink"),
      src.indexOf("handleUnlink") + 300,
    );
    expect(handler).toContain("getComputedStyle");
  });
});

// ─── ModeValueCell rendering branches ─────────────────────────────────

describe("ModeValueCell has all 4 rendering branches", () => {
  const src = readSrc("variables/ModeValueCell.tsx");

  it("has editing state (text input)", () => {
    // Should have an editing branch with an <input>
    const modeCell = src.slice(
      src.indexOf("function ModeValueCell"),
      src.indexOf("function DetailVariableRow"),
    );
    expect(modeCell).toMatch(/if\s*\(\s*editing\s*\)/);
    expect(modeCell).toContain("<input");
  });

  it("has linked + editable state (VariableField)", () => {
    const modeCell = src.slice(
      src.indexOf("function ModeValueCell"),
      src.indexOf("function DetailVariableRow"),
    );
    expect(modeCell).toContain("isLinked && editable");
    expect(modeCell).toContain("<VariableField");
  });

  it("has linked + read-only state", () => {
    const modeCell = src.slice(
      src.indexOf("function ModeValueCell"),
      src.indexOf("function DetailVariableRow"),
    );
    expect(modeCell).toContain("isLinked && !editable");
  });

  it("has unlinked state with VariableLinkDot", () => {
    const modeCell = src.slice(
      src.indexOf("function ModeValueCell"),
      src.indexOf("function DetailVariableRow"),
    );
    expect(modeCell).toContain("<VariableLinkDot");
  });

  it("detects linked state via parseVarRef", () => {
    const modeCell = src.slice(
      src.indexOf("function ModeValueCell"),
      src.indexOf("function DetailVariableRow"),
    );
    expect(modeCell).toMatch(/parseVarRef\s*\(/);
  });
});

// ─── DetailVariableRow alias pill rendering ───────────────────────────

describe("DetailVariableRow alias values use VariableField", () => {
  const src = readSrc("variables/DetailVariableRow.tsx");

  it("checks variable.aliasOf for alias detection", () => {
    const row = src.slice(
      src.indexOf("function DetailVariableRow"),
      src.indexOf("function SubgroupSection"),
    );
    expect(row).toContain("variable.aliasOf");
  });

  it("renders VariableField when aliasOf is set", () => {
    const row = src.slice(
      src.indexOf("function DetailVariableRow"),
      src.indexOf("function SubgroupSection"),
    );
    // Should have a conditional: aliasOf ? <VariableField> : <VariableValue>
    expect(row).toContain("<VariableField");
    expect(row).toContain("aliasOf");
  });

  it("resolves computed value on unlink via getComputedStyle", () => {
    const row = src.slice(
      src.indexOf("function DetailVariableRow"),
      src.indexOf("function SubgroupSection"),
    );
    expect(row).toContain("getComputedStyle");
  });
});

// ─── Save path preserves var() references ─────────────────────────────

describe("save path preserves var() references", () => {
  const src = readSrc("core/commitUtils.ts");

  it("imports parseVarRef for variable detection", () => {
    expect(src).toMatch(/import.*parseVarRef.*from/);
  });

  it("checks authored value for var() references before commit", () => {
    expect(src).toContain("getAuthoredValue");
    expect(src).toContain("parseVarRef");
  });

  it("redirects commit to variable definition site when var() is detected", () => {
    // When the property value is var(--x), commit should modify the variable
    // definition, not the usage site
    expect(src).toContain("getVariableDefinitionSource");
  });
});

// ─── VariableField component structure ────────────────────────────────

describe("VariableField component structure", () => {
  const src = readSrc("controls/VariableField.tsx");

  it("renders a clickable pill that opens VariablePicker", () => {
    expect(src).toContain("<VariablePicker");
    expect(src).toContain("pickerOpen");
  });

  it("has a pencil icon that opens EditVariablePopover", () => {
    expect(src).toContain("Pencil");
    expect(src).toContain("EditVariablePopover");
    expect(src).toContain("editOpen");
  });

  it("passes onUnlink to VariablePicker", () => {
    expect(src).toContain("onUnlink={onUnlink}");
  });

  it("strips -- prefix for display name", () => {
    expect(src).toMatch(/variableName\.startsWith\s*\(\s*"--"\s*\)/);
  });
});

// ─── VariableLinkDot component structure ──────────────────────────────

describe("VariableLinkDot component structure", () => {
  const src = readSrc("controls/VariableLinkDot.tsx");

  it("shows picker on click when unlinked", () => {
    expect(src).toContain("<VariablePicker");
    expect(src).toContain("pickerOpen");
  });

  it("calls onUnlink on click when linked", () => {
    expect(src).toMatch(/isLinked\s*&&\s*onUnlink/);
  });

  it("supports inline rendering mode", () => {
    expect(src).toContain("inline");
  });

  it("uses progressive disclosure (hidden until row hover)", () => {
    expect(src).toContain("rowHovered");
    expect(src).toMatch(/opacity.*visible/);
  });
});
