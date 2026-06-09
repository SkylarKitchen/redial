/**
 * No shadcn/ui or @/lib/utils in the overlay (issue #25).
 *
 * Every overlay control was migrated off shadcn/Radix (@/components/ui/*) and
 * the cn() helper (@/lib/utils) to inline-styled implementations (eslint.config.js
 * documents the ratchet as fully paid down on 2026-06-03). This test is the
 * regression guard for that contract: it scans every non-test overlay source
 * file and fails if any reintroduces the dependency.
 *
 * Acceptance criterion #25 is "the overlay no longer depends on shadcn" — an
 * absence property, which is proven by a source scan (mirroring the lint rule),
 * not a fired event.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const OVERLAY_ROOT = join(__dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

// Matches `from "@/components/ui/..."`, `from "../../components/ui/..."`, and
// `from "@/lib/utils"` import specifiers, plus a `cn(` call from that helper.
const SHADCN_IMPORT = /from\s+["'][^"']*\/components\/ui\/[^"']*["']/;
const LIB_UTILS_IMPORT = /from\s+["']@\/lib\/utils["']/;

describe("overlay has no shadcn/ui dependency (#25)", () => {
  const files = walk(OVERLAY_ROOT);

  it("scans a non-trivial number of overlay source files", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no overlay source file imports from components/ui (shadcn/Radix)", () => {
    const offenders = files.filter((f) =>
      SHADCN_IMPORT.test(readFileSync(f, "utf-8")),
    );
    expect(offenders).toEqual([]);
  });

  it("no overlay source file imports cn() from @/lib/utils", () => {
    const offenders = files.filter((f) =>
      LIB_UTILS_IMPORT.test(readFileSync(f, "utf-8")),
    );
    expect(offenders).toEqual([]);
  });
});
