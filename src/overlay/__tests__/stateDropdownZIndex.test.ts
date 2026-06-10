// @vitest-environment happy-dom
/**
 * Test: All portal/overlay z-indices must be >= the panel z-index.
 *
 * The panel uses z-[2147483647] with !important utilities (the `important`
 * modifier on the utilities import since the issue #58 rescope).
 * Any dropdown/popover/portal that appears on top of the panel must
 * also use z-index 2147483647: a createPortal component whose portal
 * container has zIndex < 2147483647 renders at body level but behind
 * the panel. (A second bug class — shadcn components carrying `z-50` —
 * went away with src/components/ui in the issue #92 dead-code sweep.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const PANEL_Z = 2147483647;
const OVERLAY_DIR = join(__dirname, "..");
const TAILWIND_CONFIG_PATH = join(__dirname, "../../../tailwind.config.ts");

// ── Helpers ─────────────────────────────────────────────────────

function readSrc(path: string) {
  return readFileSync(path, "utf-8");
}

/** Find all .tsx files in a directory (recursive). */
function tsxFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "__tests__" && entry.name !== "assets") {
      results.push(...tsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx")) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Check if file has at least one panel-level z-index (inline, token, or Tailwind). */
function hasPanelLevelZ(src: string): boolean {
  // Inline literal: zIndex: 2147483647
  if (src.includes(`zIndex: ${PANEL_Z}`)) return true;
  // Theme token: zIndex: zIndex.max
  if (src.includes("zIndex: zIndex.max")) return true;
  // Tailwind arbitrary value: z-[2147483647]
  if (src.includes(`z-[${PANEL_Z}]`)) return true;
  return false;
}

// ── Precondition ────────────────────────────────────────────────

describe("Precondition", () => {
  it("utilities still compile with !important (scoped strategy, issue #58)", () => {
    // The z-index discipline below exists because utilities beat inline
    // styles. That stays true after the issue #58 rescope: the utilities
    // import carries the `important` modifier. ADR-0008 moved the Tailwind
    // input from `globals.css` to `panel.tailwind.css` for shadow-root
    // adoption, but the `important` modifier and config-scoped strategy
    // are unchanged.
    const panelInput = readSrc(join(__dirname, "../../styles/panel.tailwind.css"));
    expect(panelInput).toMatch(/@import "tailwindcss\/utilities\.css"[^;\n]*\bimportant\b/);
    expect(readSrc(TAILWIND_CONFIG_PATH)).toContain('important: ".__tuner-root"');
  });
});

// ── Manual createPortal components: portal root must have zIndex >= PANEL_Z ─

describe("createPortal components must have at least one zIndex >= panel z-index", () => {
  const portalFiles = tsxFiles(OVERLAY_DIR).filter((f) => {
    const src = readSrc(f);
    // Match an actual createPortal CALL, not the bare word in a doc comment —
    // e.g. SearchableMenu documents that its callers use createPortal but does
    // not portal itself, so it must not be flagged as a portal root.
    return src.includes("createPortal(");
  });

  it.each(portalFiles)("%s has portal-level zIndex >= 2147483647", (file) => {
    const src = readSrc(file);
    expect(
      hasPanelLevelZ(src),
      `${file}: no zIndex: ${PANEL_Z} or z-[${PANEL_Z}] found — portal will render behind the panel`,
    ).toBe(true);
  });
});
