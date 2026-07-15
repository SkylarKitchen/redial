/**
 * Regression: server-side validation on the /commit POST body (issue #16).
 *
 * handleCommit() trusts client-supplied CommitChange fields and feeds them into
 * regex search + raw file writes. escapeRegex() neutralizes regex-injection and a
 * NODE_ENV guard + project-root confinement cap the blast radius — but `change.to`
 * and `change.prop` are still written into source files VERBATIM:
 *
 *   - commit.ts:907-911 — standard replacement substitutes `change.to` (only `$`
 *     escaped). A value like `red; } body { display:none` breaks out of the CSS
 *     block and injects a new rule.
 *   - commit.ts:856 — a freshly-created `.cls:state {}` block interpolates
 *     `change.prop` and `change.to` directly into new lines.
 *
 * The bug: malformed input corrupts the user's source file instead of being
 * rejected. These tests drive the exact corruption and assert the file is left
 * untouched + the change is reported in `failed` (acceptance criteria #16).
 *
 * Contract the fix should satisfy (mirrors src/overlay/core/statePreview.ts:61):
 *   - prop:      /^--[\w-]+$/  OR  /^[a-z][a-z-]*$/
 *   - className: a single CSS identifier (no braces/semicolons/whitespace)
 *   - to:        no `{`, `}`, `;`, newline, or `<` (legit values like
 *                `rgba(0,0,0,.5)`, `calc(100% - 2rem)`, `8px 16px` must pass)
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";
import { isSafeCSSValue, sanitizeCSSValue } from "../../lib/css";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-validation-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<string> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return content; // return the exact bytes for an unchanged-content assertion
}

const FIXTURE = "src/Button.module.scss";
const BASE_CSS = [".btn {", "  color: blue;", "}"].join("\n");

describe("handleCommit — server-side input validation (issue #16)", () => {
  it("rejects a `to` value that breaks out of the CSS block (brace injection)", async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red; } body { display: none",
        sourceFile: FIXTURE,
        sourceLine: 1,
      }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toBe(original);
    expect(content).not.toContain("body { display: none");
  });

  it("rejects a multi-line `to` value (newline injection)", async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red;\n  position: fixed;\n  top: 0",
        sourceFile: FIXTURE,
        sourceLine: 1,
      }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toBe(original);
  });

  it("rejects an invalid `prop` when creating a new pseudo-state block", async () => {
    // No existing :hover block, so handleCommit creates one and interpolates
    // `prop` verbatim into the new lines — the injection vector at commit.ts:856.
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{
        prop: "color; } body { width",
        from: "x",
        to: "red",
        className: "btn",
        state: "hover",
        sourceFile: FIXTURE,
      }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toBe(original);
    expect(content).not.toContain("body { width");
  });

  it("rejects an invalid `prop` on a standard replacement", async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "co lor", from: "blue", to: "red", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toBe(original);
  });

  // --- Guards: the fix must NOT over-reject legitimate CSS ---

  it("still writes a normal change (no over-rejection)", async () => {
    await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toContain("color: red");
  });

  it("accepts CSS values with parens, commas, and spaces (rgba/calc/multi-value)", async () => {
    for (const to of ["rgba(0, 0, 0, 0.5)", "calc(100% - 2rem)", "8px 16px"]) {
      await writeFixture(FIXTURE, BASE_CSS);
      const result = await handleCommit(
        [{ prop: "color", from: "blue", to, sourceFile: FIXTURE, sourceLine: 1 }],
        tempDir
      );
      expect(result.failed, `value "${to}" should be accepted`).toHaveLength(0);
      expect(result.written).toContain(FIXTURE);
    }
  });

  it("accepts a CSS custom property name (--token)", async () => {
    await writeFixture(FIXTURE, [".btn {", "  --brand: blue;", "}"].join("\n"));

    const result = await handleCommit(
      [{ prop: "--brand", from: "blue", to: "red", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
  });
});

describe("comment-sequence injection (issue #55)", () => {
  // A value like `red/*` is written as `color: red/*;` — an unterminated
  // comment that swallows the rest of the stylesheet. Both delimiters must be
  // rejected by the commit-path predicate.
  it("isSafeCSSValue rejects values containing /* or */", () => {
    expect(isSafeCSSValue("red/*")).toBe(false);
    expect(isSafeCSSValue("red*/")).toBe(false);
    expect(isSafeCSSValue("url(/*x)")).toBe(false);
  });

  it("isSafeCSSValue still accepts slash and asterisk on their own", () => {
    expect(isSafeCSSValue("1 / 2")).toBe(true); // grid-row shorthand
    expect(isSafeCSSValue("calc(2 * 1rem)")).toBe(true);
  });

  it("handleCommit refuses a comment-opening value and leaves the file untouched", async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "red/*", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toBe(original);
    expect(content).not.toContain("/*");
  });

  it("sanitizeCSSValue strips comment delimiters, including re-formed ones", () => {
    expect(sanitizeCSSValue("a/*b*/c")).toBe("abc");
    // A single global pass over `//**` removes the inner `/*` and leaves the
    // outer chars re-joined as a fresh `/*` — the strip must run to a fixpoint.
    expect(sanitizeCSSValue("//**")).not.toContain("/*");
    // Earlier sanitize steps can splice delimiters together (`/{*}` → `/*`).
    expect(sanitizeCSSValue("/{*}")).not.toContain("/*");
    expect(sanitizeCSSValue("/<*")).not.toContain("/*");
  });
});

describe('empty/whitespace `from` — zero-width splice guard', () => {
  // escapeRegex("") is "", so replacePropRegex(prop, escapeRegex(from))
  // degenerates to `(^|[;{\s])(prop\s*:\s*)` — the value pattern is
  // zero-width, the "match" is just the declaration prefix, and the
  // replacement SPLICES `to` into the middle of the old value:
  // "color: blue;" + to:"red" → "color: redblue;". Splice sites:
  // commit.ts (pseudo + base surgical replace) and cssSearch.ts
  // applyChangeWithinBody (@media body replace).
  //
  // A plain base-path value replacement has no legitimate empty `from`
  // (getComputedStyle never returns "" for a standard longhand), so it must
  // be REJECTED as malformed input. Paths whose `from` is legitimately
  // empty — state saves (diffState reports from:"" by contract, locked in
  // outliers-scope-state.test.ts), fresh custom-prop adds (unset vars
  // compute to ""), createClass / @media creation / elementScope (append
  // semantics, `from` unused) — must NOT be rejected, and must never build
  // a zero-width exact pattern either: the broad tier rewrites the whole
  // value instead.

  it('rejects an empty `from` on a plain value replacement and leaves the file untouched', async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "color", from: "", to: "red", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    // Lock the reason so the rejection is identifiable, not a generic miss.
    expect(result.failed[0].reason).toMatch(/empty "from" value/);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toBe(original);
    expect(content).not.toContain("redblue");
  });

  it('rejects a whitespace-only `from` the same way', async () => {
    const original = await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "color", from: "   ", to: "red", sourceFile: FIXTURE, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/empty "from" value/);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toBe(original);
  });

  // ── Splice prevention on the contractually-empty paths (can't reject
  // these — the client has no `from` to send). The exact tier must be
  // skipped; the existing broad tier rewrites the WHOLE value cleanly.

  it('state save with empty `from` rewrites an authored pseudo value cleanly (no splice)', async () => {
    await writeFixture(
      FIXTURE,
      [".btn {", "  color: black;", "}", "", ".btn:hover {", "  color: blue;", "}"].join("\n")
    );

    const result = await handleCommit(
      [{ prop: "color", from: "", to: "red", className: "btn", state: "hover", sourceFile: FIXTURE }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toContain("color: red;");
    expect(content).not.toContain("redblue");
    // Only the :hover block changes — the base rule keeps its value.
    expect(content).toContain("color: black;");
  });

  it('breakpoint state save with empty `from` rewrites an authored @media value cleanly (no splice)', async () => {
    await writeFixture(
      FIXTURE,
      [
        ".card {", "  color: black;", "}", "",
        "@media (min-width: 768px) {", "  .card:hover {", "    color: blue;", "  }", "}",
      ].join("\n")
    );

    const result = await handleCommit(
      [{
        prop: "color", from: "", to: "red",
        className: "card", state: "hover",
        breakpoint: { minWidth: 768 },
        sourceFile: FIXTURE,
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);

    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toContain("color: red;");
    expect(content).not.toContain("redblue");
    expect(content).toContain("color: black;");
  });

  // ── Guards: append/create paths legitimately carry an empty `from` and
  // must NOT be over-rejected.

  it("still creates a pseudo block for a state change with empty `from`", async () => {
    await writeFixture(FIXTURE, BASE_CSS); // no :hover block yet

    const result = await handleCommit(
      [{ prop: "color", from: "", to: "red", className: "btn", state: "hover", sourceFile: FIXTURE }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toContain(".btn:hover");
    expect(content).toContain("color: red;");
    expect(content).toContain("color: blue;"); // base untouched
  });

  it("still creates a fresh @media block for a breakpoint change with empty `from`", async () => {
    await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{
        prop: "padding", from: "", to: "24px",
        className: "btn", breakpoint: { minWidth: 640 },
        sourceFile: FIXTURE,
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toContain("@media (min-width: 640px)");
    expect(content).toContain("padding: 24px;");
  });

  it("still creates a class for a createClass change with empty `from`", async () => {
    await writeFixture(FIXTURE, BASE_CSS);
    // createClass always attaches the class in JSX too — seed a component.
    const jsxFile = "src/Button.tsx";
    await writeFixture(
      jsxFile,
      ['export const B = () => <div className="seed">x</div>;', ""].join("\n")
    );

    const result = await handleCommit(
      [{
        prop: "padding", from: "", to: "16px",
        sourceFile: FIXTURE, className: "hero",
        createClass: {
          name: "hero", jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "seed",
        },
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toContain(".hero {");
    expect(content).toContain("padding: 16px;");
  });

  it("still writes an element-scope change with empty `from` (inline merge never reads it)", async () => {
    const jsxFile = "src/Card.tsx";
    await writeFixture(
      jsxFile,
      ["export function Card() {", '  return <div className="card">hi</div>;', "}", ""].join("\n")
    );

    const result = await handleCommit(
      [{
        prop: "background-color", from: "", to: "rgb(1, 2, 3)",
        elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 2, existingClasses: "card" },
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(jsxFile);
    expect(await readFile(join(tempDir, jsxFile), "utf-8")).toContain("backgroundColor");
  });

  it("still inserts a previously-unset custom property with empty `from`", async () => {
    // getComputedStyle().getPropertyValue("--x") is "" when the var is unset,
    // so a fresh custom-prop add legitimately posts from:"" on the base path.
    await writeFixture(FIXTURE, BASE_CSS);

    const result = await handleCommit(
      [{ prop: "--radius", from: "", to: "8px", sourceFile: FIXTURE, className: "btn" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toContain("--radius: 8px;");
  });
});
