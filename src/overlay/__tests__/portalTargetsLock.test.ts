/**
 * portalTargetsLock.test.ts — locks the ADR-0008 portal contract.
 *
 * Every overlay `createPortal(…)` site must route through `usePortalTarget()`,
 * which under production resolves to a container inside the shadow root. A
 * raw `document.body` target leaks the portal into the host document and
 * breaks the boundary.
 *
 * The matcher is multiline because several call sites span lines (JSX
 * children + the second arg). A single-line `createPortal(.*document.body)`
 * search misses those and the lock would pass vacuously.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const OVERLAY_DIR = join(__dirname, "..");

function tsxAndTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "assets") continue;
      out.push(...tsxAndTsFiles(full));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

const PORTAL_TO_BODY = /createPortal\s*\(\s*[\s\S]*?,\s*document\.body/m;

describe("ADR-0008 portal target lock", () => {
  it("no production overlay file targets createPortal(…, document.body)", () => {
    const offenders: string[] = [];
    for (const file of tsxAndTsFiles(OVERLAY_DIR)) {
      const src = readFileSync(file, "utf-8");
      if (PORTAL_TO_BODY.test(src)) offenders.push(file);
    }
    expect(offenders, "createPortal must target usePortalTarget() under ADR-0008").toEqual([]);
  });

  it("no production overlay file inlines `.contains(e.target as …)` for click-outside", () => {
    // composedTarget(e) is required so retargeted shadow-host events are
    // unwrapped before the contains check (otherwise click-outside fires
    // for every click that originated inside the panel).
    const offenders: string[] = [];
    const PAT = /\.contains\(\s*(?:e|event)\.target as (?:Node|Element)/;
    for (const file of tsxAndTsFiles(OVERLAY_DIR)) {
      const src = readFileSync(file, "utf-8");
      if (PAT.test(src)) offenders.push(file);
    }
    expect(offenders, "use composedTarget(e) instead of e.target casts in click-outside handlers").toEqual([]);
  });
});
