/**
 * End-to-end regression for issue #57 — pseudo-state edits must land in the
 * `.class:state { }` block, never the base rule.
 *
 * The earlier client-only fix preserved each entry's `state` but left
 * `className` ungated-off for element-scope saves, and the server only routes
 * a change to a pseudo block when BOTH fields are present — so a hover edit
 * saved while the panel was on "None" (or via the drawer's Save All) was
 * still flattened into the BASE rule with a success toast. These tests run
 * the real pipeline: enrichChangesForCommit() → handleCommit() → file bytes.
 *
 * Temp-file idiom mirrors outliers-escaping.test.ts.
 */
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { enrichChangesForCommit } from "../core/commitUtils";
import { handleCommit } from "../../server/commit";
import type { DiffEntry } from "../core/apply";
import type { ScopeContext } from "../core/engine";

let tempDir: string;
const injectedStyles: HTMLStyleElement[] = [];

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-state-commit-"));
  document.body.innerHTML = "";
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  document.body.innerHTML = "";
  for (const style of injectedStyles.splice(0)) style.remove();
});

async function writeFixture(rel: string, content: string): Promise<void> {
  const full = join(tempDir, rel);
  await mkdir(full.substring(0, full.lastIndexOf("/")), { recursive: true });
  await writeFile(full, content, "utf-8");
}

function makeEl(className: string): HTMLElement {
  const el = document.createElement("div");
  el.className = className;
  document.body.appendChild(el);
  return el;
}

function addStyle(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  injectedStyles.push(style);
}

const hoverEntry: DiffEntry = { prop: "color", from: "blue", to: "red", state: "hover" };

describe("state-tagged save → pseudo block targeting (issue #57, end-to-end)", () => {
  it("writes a hover edit into `.btn:hover`, not the base rule, with the panel on 'None'", async () => {
    const F = "src/Button.module.scss";
    await writeFixture(
      F,
      [".btn {", "  color: blue;", "}", "", ".btn:hover {", "  color: blue;", "}"].join("\n"),
    );

    const el = makeEl("Button_btn__a1b2c");
    // Footer save / Cmd+S with the state selector back on "None": the diff
    // entry itself carries state:"hover".
    const enriched = enrichChangesForCommit(el, [hoverEntry], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });
    expect(enriched[0].state).toBe("hover");
    expect(enriched[0].className).toBe("btn");

    const r = await handleCommit(enriched, tempDir);

    expect(r.failed).toHaveLength(0);
    expect(r.written).toHaveLength(1);
    const after = await readFile(join(tempDir, F), "utf-8");
    // Base rule untouched, pseudo block updated.
    expect(after).toMatch(/\.btn \{\n {2}color: blue;/);
    expect(after).toMatch(/\.btn:hover \{\n {2}color: red;/);
  });

  it("targets the pseudo block on the ChangesDrawer Save-All path (scope only)", async () => {
    const F = "src/Button.module.scss";
    await writeFixture(
      F,
      [".btn {", "  color: blue;", "}", "", ".btn:hover {", "  color: blue;", "}"].join("\n"),
    );

    const el = makeEl("Button_btn__a1b2c");
    // ChangesDrawer.handleSaveAll passes only { scope: "element" }.
    const enriched = enrichChangesForCommit(el, [hoverEntry], {
      // Deliberately partial — mirrors the historical Save-All payload shape.
      scope: "element",
    } as ScopeContext);

    const r = await handleCommit(enriched, tempDir);

    expect(r.failed).toHaveLength(0);
    const after = await readFile(join(tempDir, F), "utf-8");
    expect(after).toMatch(/\.btn \{\n {2}color: blue;/);
    expect(after).toMatch(/\.btn:hover \{\n {2}color: red;/);
  });

  it("creates a `.btn:hover` block instead of flattening when none exists", async () => {
    const F = "src/Button.module.scss";
    await writeFixture(F, [".btn {", "  color: blue;", "}"].join("\n"));

    const el = makeEl("Button_btn__a1b2c");
    const enriched = enrichChangesForCommit(el, [hoverEntry], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });

    const r = await handleCommit(enriched, tempDir);

    expect(r.failed).toHaveLength(0);
    const after = await readFile(join(tempDir, F), "utf-8");
    expect(after).toMatch(/\.btn \{\n {2}color: blue;/);
    expect(after).toContain(".btn:hover {");
    expect(after).toContain("color: red;");
  });

  it("routes a global-class hover edit via stylesheet-evidence class resolution", async () => {
    const F = "src/globals.css";
    await writeFixture(
      F,
      [".btn {", "  color: blue;", "}", "", ".btn:hover {", "  color: blue;", "}"].join("\n"),
    );

    addStyle(".btn { color: blue; }\n.btn:hover { color: blue; }");
    const el = makeEl("btn");
    const enriched = enrichChangesForCommit(el, [hoverEntry], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });
    expect(enriched[0].className).toBe("btn");
    // happy-dom <style> sheets have no href, so getGlobalCSSSource can't name
    // the file here (a browser resolves it from the stylesheet URL). Pin the
    // fixture path; className/state targeting still flows from enrichment.
    const withFile = enriched.map((c) => ({ ...c, sourceFile: F }));

    const r = await handleCommit(withFile, tempDir);

    expect(r.failed).toHaveLength(0);
    const after = await readFile(join(tempDir, F), "utf-8");
    expect(after).toMatch(/\.btn \{\n {2}color: blue;/);
    expect(after).toMatch(/\.btn:hover \{\n {2}color: red;/);
  });
});

describe("handleCommit — state without class info fail-safe (issue #57)", () => {
  it("rejects a state-tagged change with no className instead of flattening it", async () => {
    const F = "src/globals.css";
    const fixture = [".btn {", "  color: blue;", "}", "", ".btn:hover {", "  color: blue;", "}"].join("\n");
    await writeFixture(F, fixture);

    const r = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", state: "hover", sourceFile: F, sourceLine: 2 }],
      tempDir,
    );

    expect(r.written).toHaveLength(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].reason).toMatch(/refusing to write/);
    // File must be byte-identical — no base-rule corruption.
    expect(await readFile(join(tempDir, F), "utf-8")).toBe(fixture);
  });

  it("still writes custom-property redirects that carry a state", async () => {
    const F = "src/tokens.css";
    await writeFixture(F, [":root {", "  --brand: blue;", "}"].join("\n"));

    // The var() redirect path intentionally ships no className: the edit
    // targets the variable's definition site regardless of state.
    const r = await handleCommit(
      [{ prop: "--brand", from: "blue", to: "red", state: "hover", sourceFile: F }],
      tempDir,
    );

    expect(r.failed).toHaveLength(0);
    expect(r.written).toHaveLength(1);
    expect(await readFile(join(tempDir, F), "utf-8")).toContain("--brand: red;");
  });
});
