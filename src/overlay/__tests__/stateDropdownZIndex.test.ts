// @vitest-environment happy-dom
/**
 * Test: All portal/overlay z-indices must be >= the panel z-index.
 *
 * The panel uses z-[2147483647] with !important utilities (the `important`
 * modifier on the utilities import since the issue #58 rescope).
 * Any dropdown/popover/portal that appears on top of the panel must
 * also use z-index 2147483647. Two classes of bugs:
 *
 * 1. Shadcn/Radix components using `z-50` (Tailwind class) — it compiles
 *    to `z-index: 50 !important`, overriding any inline zIndex.
 *
 * 2. Manual createPortal components whose portal container has
 *    zIndex < 2147483647 — these render at body level but behind
 *    the panel.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const PANEL_Z = 2147483647;
const COMPONENTS_DIR = join(__dirname, "../../components/ui");
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
    // import carries the `important` modifier, and the config scopes the
    // selector instead of using `important: true`.
    const globals = readSrc(join(__dirname, "../../styles/globals.css"));
    expect(globals).toMatch(/@import "tailwindcss\/utilities\.css"[^;\n]*\bimportant\b/);
    expect(readSrc(TAILWIND_CONFIG_PATH)).toContain('important: ".__tuner-root"');
  });
});

// ── Shadcn/Radix portal components: no z-50 class ──────────────

describe("Shadcn portal components must not use z-50 (important: true conflict)", () => {
  const portalFiles = tsxFiles(COMPONENTS_DIR).filter((f) => {
    const src = readSrc(f);
    return src.includes("Portal");
  });

  it.each(portalFiles)("%s has no z-<number> class on portaled content", (file) => {
    const src = readSrc(file);
    // z-50 with important: true → z-index: 50 !important → overrides inline styles
    // Match z-NN (numeric only, not z-[...] which is an arbitrary value)
    const hasZNumeric = /\bz-\d+\b/.test(src);
    expect(
      hasZNumeric,
      `${file} has a Tailwind z-<number> class which, with important: true, will override inline zIndex`,
    ).toBe(false);
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

// ── SelectContent specific check ────────────────────────────────

describe("SelectContent z-index", () => {
  const selectSrc = readSrc(join(COMPONENTS_DIR, "select.tsx"));

  it("inline zIndex matches the panel z-index", () => {
    expect(selectSrc).toContain(`zIndex: ${PANEL_Z}`);
  });
});
