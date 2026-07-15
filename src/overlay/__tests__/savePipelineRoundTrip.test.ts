// @vitest-environment happy-dom
/**
 * savePipelineRoundTrip.test.ts — the client↔server save contract, exercised
 * end-to-end (ADR-0011).
 *
 * Before this suite the contract was tested at exactly ONE point (CSS
 * pseudo-state, stateCommitEndToEnd.test.ts); the Tailwind round-trip had
 * zero coverage, and every UI save suite stubbed global fetch — client
 * asserted "I sent X", server asserted "given X I write Y", and nobody
 * asserted the two X's were the same.
 *
 * Here `save()` runs against its SECOND transport adapter: a test transport
 * that hands the real body to the real handlers (`handleCommit` /
 * `handleTailwindCommit`) writing real temp files — fetch in prod, direct
 * handlers in tests; two adapters, one seam. Fiber/stylesheet-derived
 * anchors that happy-dom cannot produce (getReactSource needs React fibers;
 * <style> sheets have no href) are pinned onto the enriched entries inside
 * the transport, mirroring what a real browser resolves — targeting fields
 * (className / state / breakpoint / elementScope / createClass) always flow
 * from enrichment itself.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { styleEngine, resolveTarget } from "../core/engine";
import { save, __setTransportForTests, type SaveTransport } from "../core/save";
import type { EnrichedChange } from "../core/commitUtils";
import { configure } from "../core/config";
import { resetAllModeOverrides, applyModeOverride } from "../core/modeOverrides";
import { attachClassToElement, detachSessionClasses, destroyClassStyles } from "../core/scope";
import { handleCommit } from "../../server/commit";
import { handleTailwindCommit } from "../../server/commitTailwind";
import type { CommitChange, TailwindChange } from "../../lib/protocol";

let tempDir: string;
let clipboardWrites: string[];
let transportCalls: Array<{ mode?: "tailwind"; changes: EnrichedChange[] }>;

const JSX_FILE = "src/Card.tsx";
const TW_FILE = "src/Row.tsx";
const CSS_FILE = "Button.module.scss";
const GLOBALS = "globals.css";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-save-rt-"));
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  transportCalls = [];
  clipboardWrites = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) => {
        clipboardWrites.push(text);
        return Promise.resolve();
      },
    },
  });
});

afterEach(async () => {
  __setTransportForTests(null);
  configure({ commitEndpoint: "/api/tuner/commit" });
  await rm(tempDir, { recursive: true, force: true });
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  for (const style of injectedStyles.splice(0)) style.remove();
  document.body.innerHTML = "";
});

/** Write a CSS fixture to disk AND mirror it into the DOM cascade. */
async function writeCssFixture(rel: string, content: string): Promise<void> {
  await writeFixture(rel, content);
  injectStyle(content);
}

async function writeFixture(rel: string, content: string): Promise<void> {
  const full = join(tempDir, rel);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content, "utf-8");
}

async function readFixture(rel: string): Promise<string> {
  return readFile(join(tempDir, rel), "utf-8");
}

function makeEl(className = ""): HTMLElement {
  const el = document.createElement("div");
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

const injectedStyles: HTMLStyleElement[] = [];

/**
 * Mirror a CSS fixture into the live DOM. In production the page's cascade
 * and the source file agree, so `DiffEntry.from` (the computed initial)
 * matches the authored value the server's literal replacement looks for —
 * fixtures must reproduce that agreement or `from` arrives empty.
 */
function injectStyle(css: string): void {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
  injectedStyles.push(style);
}

/** Batched like every real interaction — the batch defers the class-rule
 *  rebuild (issue #29) so the mirror captures a pre-rule `initial`. */
function applyBatched(target: Parameters<typeof styleEngine.apply>[0], prop: string, value: string) {
  styleEngine.beginBatch();
  styleEngine.apply(target, prop, value);
  styleEngine.endBatch();
}

/** Pin the anchors happy-dom can't derive (see file header). */
function pinAnchors(c: EnrichedChange): EnrichedChange {
  if (c.elementScope) {
    return { ...c, elementScope: { ...c.elementScope, jsxSourceFile: JSX_FILE } };
  }
  if (c.mode === "tailwind") {
    return { ...c, sourceFile: c.sourceFile ?? TW_FILE };
  }
  if (c.createClass) {
    return { ...c, createClass: { ...c.createClass, jsxSourceFile: JSX_FILE } };
  }
  return c;
}

/** The second adapter at the transport seam: real handlers, temp cwd. */
function installRealServerTransport(): void {
  const transport: SaveTransport = async (body) => {
    transportCalls.push(body);
    const patched = body.changes.map(pinAnchors);
    const result =
      body.mode === "tailwind"
        ? await handleTailwindCommit(patched as unknown as TailwindChange[], tempDir)
        : await handleCommit(patched as unknown as CommitChange[], tempDir);
    return { ok: true, status: 200, json: async () => result };
  };
  __setTransportForTests(transport);
}

// ─── The headline regression (ADR-0011) ───────────────────────────────

describe("provenance targeting — the Footer/Save-All divergence is dead", () => {
  it("a class-provenance edit lands in the class rule, never the JSX style attribute", async () => {
    await writeFixture(CSS_FILE, ".btn {\n  color: blue;\n}");
    injectStyle(".Button_btn__a1b2c { color: blue; }"); // the COMPILED stylesheet (hashed selector)
    await writeFixture(JSX_FILE, `export const C = () => <div className="Button_btn__a1b2c">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "class", el, className: "Button_btn__a1b2c" }, "color", "red");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    expect(await readFixture(CSS_FILE)).toContain("color: red;");
    // The JSX file is byte-untouched — no style attribute write.
    expect(await readFixture(JSX_FILE)).not.toContain("style=");
    expect(transportCalls[0].changes[0].elementScope).toBeUndefined();
    expect(transportCalls[0].changes[0].className).toBe("btn");
  });

  it("an element-provenance edit lands in the JSX style attribute, never the class rule", async () => {
    const cssFixture = ".card {\n  color: blue;\n}";
    await writeCssFixture(GLOBALS, cssFixture);
    await writeFixture(JSX_FILE, `export const C = () => <div className="card">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("card");
    applyBatched({ scope: "element", el }, "color", "red");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    expect(await readFixture(JSX_FILE)).toContain(`style={{ color: "red" }}`);
    // The shared rule is byte-untouched — the audit-06 contract.
    expect(await readFixture(GLOBALS)).toBe(cssFixture);
  });

  it("a mixed-provenance batch routes each change to its own file in one save", async () => {
    await writeFixture(CSS_FILE, ".btn {\n  color: blue;\n}");
    injectStyle(".Button_btn__a1b2c { color: blue; }"); // the COMPILED stylesheet (hashed selector)
    await writeFixture(JSX_FILE, `export const C = () => <div className="Button_btn__a1b2c">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "class", el, className: "Button_btn__a1b2c" }, "color", "red");
    applyBatched({ scope: "element", el }, "margin-top", "8px");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    // One CSS batch, two targets.
    expect(transportCalls).toHaveLength(1);
    expect(await readFixture(CSS_FILE)).toContain("color: red;");
    expect(await readFixture(JSX_FILE)).toContain(`style={{ marginTop: "8px" }}`);
    expect(await readFixture(CSS_FILE)).not.toContain("margin-top");
  });

  it("a frozen-class pseudo-state edit writes `.btn:hover` after the panel re-pills (diffState round-trip)", async () => {
    await writeFixture(CSS_FILE, ".btn {\n  color: blue;\n}\n\n.btn:hover {\n  color: blue;\n}");
    injectStyle(".Button_btn__a1b2c { color: blue; }");
    installRealServerTransport();

    const el = makeEl("Button_btn__a1b2c");
    // resolveTarget freezes the active class onto the state target.
    applyBatched(
      resolveTarget(el, { scope: "class", activeClassName: "Button_btn__a1b2c", activeState: "hover" }),
      "color",
      "red",
    );

    const outcome = await save([{ el, changes: styleEngine.diffState(el, "hover") }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    const after = await readFixture(CSS_FILE);
    expect(after).toMatch(/\.btn \{\n {2}color: blue;/); // base untouched
    expect(after).toMatch(/\.btn:hover \{\n {2}color: red;/);
  });

  it("creates the rule and attaches the class for a session-attached provenance class", async () => {
    await writeFixture("Card.module.scss", ".card {\n  color: blue;\n}");
    injectStyle(".Card_card__x1z2 { color: blue; }");
    await writeFixture(JSX_FILE, `export const C = () => <div className="Card_card__x1z2">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("Card_card__x1z2");
    expect(attachClassToElement(el, "promo").ok).toBe(true);
    applyBatched({ scope: "class", el, className: "promo" }, "color", "red");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    expect(await readFixture("Card.module.scss")).toContain(".promo {");
    expect(await readFixture("Card.module.scss")).toContain("color: red;");
    expect(await readFixture(JSX_FILE)).toContain(`className="Card_card__x1z2 promo"`);
  });
});

// ─── Breakpoints: file-bound writes + surgical reconciliation (#53) ────

describe("breakpoint round-trip — @media writes and post-save reconciliation", () => {
  it("writes a class-backed breakpoint edit into an @media block and clears its tracking", async () => {
    await writeFixture(CSS_FILE, ".btn {\n  color: blue;\n}");
    injectStyle(".Button_btn__a1b2c { color: blue; }"); // the COMPILED stylesheet (hashed selector)
    installRealServerTransport();

    const el = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "element", el, breakpoint: "768" }, "color", "teal");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    const after = await readFixture(CSS_FILE);
    expect(after).toContain("@media (min-width: 768px)");
    expect(after).toContain("color: teal;");
    // Reconciliation: the file-bound cell stops counting as dirty…
    expect(styleEngine.diffElement(el)).toHaveLength(0);
    // …and nothing rode the clipboard side-channel.
    expect((await outcome.extras).breakpointCount).toBe(0);
    expect(clipboardWrites.find((t) => t.includes("@media"))).toBeUndefined();
  });

  it("keeps tracking (no reconciliation) when the batch has per-item failures", async () => {
    installRealServerTransport();
    // No fixture file on disk → the server fails the item accurately.
    const el = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "element", el, breakpoint: "768" }, "color", "teal");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed.length).toBeGreaterThan(0);
    // The edit is NOT dropped from tracking on a failed save.
    expect(styleEngine.diffElement(el)).toHaveLength(1);
  });

  it("a classless breakpoint edit stays on the clipboard side-channel with its tracking intact", async () => {
    await writeFixture(JSX_FILE, `export const C = () => <div className="card">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("card"); // no CSS-module class → bp edit can't bind to a file
    applyBatched({ scope: "element", el }, "color", "red");
    applyBatched({ scope: "element", el, breakpoint: "768" }, "width", "100px");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    // Base change reached the file; breakpoint change reached the clipboard.
    expect(await readFixture(JSX_FILE)).toContain(`style={{ color: "red" }}`);
    const extras = await outcome.extras;
    expect(extras.breakpointCount).toBe(1);
    expect(extras.clipboardWritten).toBe(true);
    expect(clipboardWrites.find((t) => t.includes("@media (min-width: 768px)"))).toContain("width: 100px");
    // Clipboard-bound tracking is retained (only file-bound cells reconcile).
    expect(styleEngine.diffElement(el).filter((c) => c.breakpoint)).toHaveLength(1);
  });
});

// ─── Tailwind round-trip (previously zero coverage) ─────────────────────

describe("Tailwind round-trip — utilities merge into the JSX className", () => {
  it("merges a base utility into the authored className attribute", async () => {
    await writeFixture(TW_FILE, `export const R = () => <div className="flex items-center gap-2 p-4">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("flex items-center gap-2 p-4");
    applyBatched({ scope: "element", el }, "display", "grid");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    expect(transportCalls).toHaveLength(1);
    expect(transportCalls[0].mode).toBe("tailwind");
    expect(await readFixture(TW_FILE)).toContain("grid");
  });

  it("merges a pseudo-state edit as its variant-prefixed utility (issue #57's Tailwind twin)", async () => {
    await writeFixture(TW_FILE, `export const R = () => <div className="flex items-center gap-2 p-4">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("flex items-center gap-2 p-4");
    applyBatched(resolveTarget(el, { scope: "element", activeClassName: null, activeState: "hover" }), "color", "red");

    const outcome = await save([{ el, changes: styleEngine.diffState(el, "hover") }]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    const after = await readFixture(TW_FILE);
    expect(after).toContain("hover:text-[red]");
    expect(after).not.toMatch(/className="[^"]*(?<![:\w-])text-\[red\]/);
  });

  it("a state with no Tailwind variant is refused — nothing POSTs, nothing is written", async () => {
    await writeFixture(TW_FILE, `export const R = () => <div className="flex items-center gap-2 p-4">x</div>;\n`);
    installRealServerTransport();

    const el = makeEl("flex items-center gap-2 p-4");
    const outcome = await save([
      { el, changes: [{ prop: "color", from: "blue", to: "red", state: "first-child" }] },
    ]);

    // Enrichment refuses the unmappable state → nothing file-bound.
    expect(outcome.kind).toBe("extras-only");
    expect(transportCalls).toHaveLength(0);
  });

  it("a mixed CSS + Tailwind Save All partitions into two POSTs (one per handler)", async () => {
    await writeFixture(CSS_FILE, ".btn {\n  color: blue;\n}");
    injectStyle(".Button_btn__a1b2c { color: blue; }"); // the COMPILED stylesheet (hashed selector)
    await writeFixture(TW_FILE, `export const R = () => <div className="flex items-center gap-2 p-4">x</div>;\n`);
    installRealServerTransport();

    const cssEl = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "class", el: cssEl, className: "Button_btn__a1b2c" }, "color", "red");
    const twEl = makeEl("flex items-center gap-2 p-4");
    applyBatched({ scope: "element", el: twEl }, "display", "grid");

    const outcome = await save([
      { el: cssEl, changes: styleEngine.diffElement(cssEl) },
      { el: twEl, changes: styleEngine.diffElement(twEl) },
    ]);

    expect(outcome.kind).toBe("saved");
    if (outcome.kind !== "saved") return;
    expect(outcome.failed).toEqual([]);
    // The route dispatches the WHOLE request on body.mode — so save() must
    // split. Before the pipeline, one Tailwind element sent every CSS change
    // to the Tailwind handler, which failed them item by item.
    expect(transportCalls).toHaveLength(2);
    expect(transportCalls[0].mode).toBeUndefined();
    expect(transportCalls[1].mode).toBe("tailwind");
    expect(await readFixture(CSS_FILE)).toContain("color: red;");
    expect(await readFixture(TW_FILE)).toContain("grid");
  });
});

// ─── Fallback outcomes ──────────────────────────────────────────────────

describe("fallback outcomes", () => {
  it("no endpoint configured → full clipboard export (base + @media + mode overrides)", async () => {
    configure({ commitEndpoint: "" });
    // No transport override either — the real no-endpoint path.
    const el = makeEl("card");
    applyBatched({ scope: "element", el }, "color", "red");
    applyBatched({ scope: "element", el, breakpoint: "768" }, "width", "100px");
    applyModeOverride(":root", "--brand", "rebeccapurple");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("clipboard");
    if (outcome.kind !== "clipboard") return;
    expect(outcome.clipboardWritten).toBe(true);
    expect(outcome.propertyCount).toBe(2);
    expect(outcome.modeCount).toBe(1);
    const text = clipboardWrites.join("\n");
    expect(text).toContain("color: red;");
    expect(text).toContain("@media (min-width: 768px)");
    expect(text).toContain("--brand: rebeccapurple;");
  });

  it("unreachable route → best-effort clipboard copy + honest outcome", async () => {
    __setTransportForTests(() => Promise.reject(new TypeError("fetch failed")));
    const el = makeEl("card");
    applyBatched({ scope: "element", el }, "color", "red");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("unreachable");
    if (outcome.kind !== "unreachable") return;
    expect(outcome.clipboardWritten).toBe(true);
    expect(clipboardWrites.join("\n")).toContain("color: red;");
  });

  it("HTTP error → status + server-provided detail, nothing reconciled", async () => {
    __setTransportForTests(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({ error: "disk on fire" }) }),
    );
    const el = makeEl("Button_btn__a1b2c");
    applyBatched({ scope: "element", el, breakpoint: "768" }, "color", "teal");

    const outcome = await save([{ el, changes: styleEngine.diffElement(el) }]);

    expect(outcome.kind).toBe("http-error");
    if (outcome.kind !== "http-error") return;
    expect(outcome.status).toBe(500);
    expect(outcome.detail).toBe("disk on fire");
    expect(styleEngine.diffElement(el)).toHaveLength(1);
  });

  it("nothing dirty at all → nothing-to-save", async () => {
    installRealServerTransport();
    const outcome = await save([]);
    expect(outcome.kind).toBe("nothing-to-save");
    expect(transportCalls).toHaveLength(0);
  });
});
