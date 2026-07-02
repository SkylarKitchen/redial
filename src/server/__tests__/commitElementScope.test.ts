/**
 * Element-scope save — server half (audit 06-element-scope-save).
 *
 * A `CommitChange` may carry `elementScope: { jsxSourceFile?, jsxSourceLine?,
 * existingClasses? }` — the panel's Element scope at save time. Element scope
 * previews on ONE element, so it must PERSIST to that one element: the server
 * writes the change into the element's JSX `style` attribute at the
 * fiber-resolved source location, and NEVER into the shared CSS class rule
 * (that silent blast-radius widening is the exact bug this pins).
 *
 * Contracts:
 *  (a) CREATE `style={{ … }}` on a tag that has none (camelCased props,
 *      string-literal values);
 *  (b) MERGE into an existing object literal — replace matching keys, append
 *      missing ones, leave unrelated keys untouched;
 *  (c) REFUSE non-literal style expressions (`style={styles}`, spreads)
 *      per-item with an accurate "edit the style object manually" reason;
 *  (d) disambiguate same-className elements via the sourceLine hint (issue
 *      #42 machinery) and refuse ambiguity without a hint;
 *  (e) enforce the same path-safety envelope as every other write;
 *  (f) be IDEMPOTENT — a re-save leaves the file byte-identical;
 *  (g) CRITICAL regression pin: an element-scoped change never modifies the
 *      `.class` rule in the CSS file, even when one exists and the payload
 *      carries the CSS targeting fields;
 *  (h) fail accurately (file untouched) when the element's JSX can't be
 *      located — never fall back to the class rule.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-element-scope-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<void> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

async function readFixture(relativePath: string): Promise<string> {
  return readFile(join(tempDir, relativePath), "utf-8");
}

// ---------------------------------------------------------------------------
// (a) style attribute creation
// ---------------------------------------------------------------------------

describe("element scope save — style attribute creation", () => {
  it("creates style={{ … }} on a bare tag, camelCasing the CSS prop", async () => {
    const jsxFile = "src/Card.tsx";
    await writeFixture(
      jsxFile,
      [
        "export function Card() {",
        '  return <div className="card">hi</div>;',
        "}",
        "",
      ].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "background-color",
          from: "rgb(255, 0, 0)",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 2, existingClasses: "card" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(jsxFile);
    expect(await readFixture(jsxFile)).toContain(
      '<div style={{ backgroundColor: "rgb(1, 2, 3)" }} className="card">'
    );
  });

  it("batches multiple properties for one element into ONE style object", async () => {
    const jsxFile = "src/Multi.tsx";
    await writeFixture(
      jsxFile,
      ['export const M = () => <span className="tag">x</span>;', ""].join("\n")
    );

    const anchor = { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "tag" };
    const result = await handleCommit(
      [
        { prop: "color", from: "rgb(0, 0, 0)", to: "rgb(9, 9, 9)", elementScope: anchor },
        { prop: "margin-top", from: "0px", to: "12px", elementScope: anchor },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(jsxFile);
    expect(content.match(/style=\{\{/g)).toHaveLength(1);
    expect(content).toContain('color: "rgb(9, 9, 9)"');
    expect(content).toContain('marginTop: "12px"');
  });

  it("writes a custom property as a quoted key", async () => {
    const jsxFile = "src/Var.tsx";
    await writeFixture(
      jsxFile,
      ['export const V = () => <div className="v">x</div>;', ""].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "--accent",
          from: "red",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "v" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(jsxFile)).toContain('"--accent": "rgb(1, 2, 3)"');
  });
});

// ---------------------------------------------------------------------------
// (b) merge into an existing object literal
// ---------------------------------------------------------------------------

describe("element scope save — merge into existing style object", () => {
  it("replaces a matching key and appends a missing one, preserving unrelated keys", async () => {
    const jsxFile = "src/Merge.tsx";
    await writeFixture(
      jsxFile,
      [
        "export function Merge() {",
        '  return <div className="card" style={{ color: "blue", padding: "4px" }}>x</div>;',
        "}",
        "",
      ].join("\n")
    );

    const anchor = { jsxSourceFile: jsxFile, jsxSourceLine: 2, existingClasses: "card" };
    const result = await handleCommit(
      [
        { prop: "color", from: "blue", to: "rgb(9, 9, 9)", elementScope: anchor },
        { prop: "margin-top", from: "0px", to: "12px", elementScope: anchor },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(jsxFile);
    expect(content).toContain('color: "rgb(9, 9, 9)"');
    expect(content).toContain('padding: "4px"'); // untouched sibling key
    expect(content).toContain('marginTop: "12px"');
    expect(content).not.toContain('"blue"');
    expect(content.match(/style=\{\{/g)).toHaveLength(1);
  });

  it("matches quoted keys in the existing object", async () => {
    const jsxFile = "src/Quoted.tsx";
    await writeFixture(
      jsxFile,
      [
        'export const Q = () => <div className="q" style={{ "background-color": "red" }}>x</div>;',
        "",
      ].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "background-color",
          from: "red",
          to: "rgb(1, 2, 3)",
          // React accepts BOTH "background-color" (quoted) and backgroundColor;
          // the merge must recognize the quoted spelling as the same property
          // instead of appending a duplicate.
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "q" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(jsxFile);
    expect(content).toContain('"rgb(1, 2, 3)"');
    expect(content).not.toContain('"red"');
    // No duplicate property under the camelCase spelling.
    expect(content).not.toContain("backgroundColor");
  });
});

// ---------------------------------------------------------------------------
// (c) refusal cases
// ---------------------------------------------------------------------------

describe("element scope save — non-literal refusal (per-item)", () => {
  it("refuses style={styles.card} with an accurate reason; other items in the batch still save", async () => {
    const jsxFile = "src/Mixed.tsx";
    const original = [
      'import styles from "./m.module.css";',
      "export function Mixed() {",
      "  return (",
      "    <div>",
      '      <div className="a" style={styles.card}>a</div>',
      '      <div className="b">b</div>',
      "    </div>",
      "  );",
      "}",
      "",
    ].join("\n");
    await writeFixture(jsxFile, original);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 1, 1)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 5, existingClasses: "a" },
        },
        {
          prop: "color",
          from: "blue",
          to: "rgb(2, 2, 2)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 6, existingClasses: "b" },
        },
      ],
      tempDir
    );

    // The non-literal element fails per-item…
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].to).toBe("rgb(1, 1, 1)");
    expect(result.failed[0].reason).toMatch(/manually|object literal/i);
    // …its line is untouched…
    const content = await readFixture(jsxFile);
    expect(content).toContain('<div className="a" style={styles.card}>a</div>');
    // …while the sibling element saved.
    expect(result.written).toContain(jsxFile);
    expect(content).toMatch(/<div style=\{\{ color: "rgb\(2, 2, 2\)" \}\} className="b">/);
  });

  it("refuses a style object containing a spread", async () => {
    const jsxFile = "src/Spread.tsx";
    const original = [
      'export const S = ({ base }: { base: object }) => <div className="s" style={{ ...base, color: "red" }}>x</div>;',
      "",
    ].join("\n");
    await writeFixture(jsxFile, original);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "red",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "s" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/spread|manually/i);
    expect(await readFixture(jsxFile)).toBe(original);
  });

  it("refuses an element-scoped change that carries a pseudo-state (inline styles can't express :hover)", async () => {
    const jsxFile = "src/State.tsx";
    const original = ['export const T = () => <div className="t">x</div>;', ""].join("\n");
    await writeFixture(jsxFile, original);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          state: "hover",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "t" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/hover/);
    expect(result.failed[0].reason).toMatch(/inline|class scope/i);
    expect(await readFixture(jsxFile)).toBe(original);
  });

  it("refuses an element-scoped change that carries a breakpoint (inline styles can't express @media)", async () => {
    const jsxFile = "src/Bp.tsx";
    const original = ['export const B = () => <div className="bp">x</div>;', ""].join("\n");
    await writeFixture(jsxFile, original);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          breakpoint: { id: "768", minWidth: 768 },
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "bp" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/inline|@media|breakpoint/i);
    expect(await readFixture(jsxFile)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// (d) disambiguation
// ---------------------------------------------------------------------------

describe("element scope save — className-anchor disambiguation", () => {
  const twoCards = [
    "export function List() {",
    "  return (",
    "    <div>",
    '      <div className="card">first</div>',
    "      <p>divider</p>",
    '      <div className="card">second</div>',
    "    </div>",
    "  );",
    "}",
    "",
  ].join("\n");

  it("uses the sourceLine hint to pick between two same-tag same-className elements", async () => {
    const jsxFile = "src/List.tsx";
    await writeFixture(jsxFile, twoCards);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 6, existingClasses: "card" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const lines = (await readFixture(jsxFile)).split("\n");
    expect(lines[3]).toBe('      <div className="card">first</div>'); // untouched
    expect(lines[5]).toContain('style={{ color: "rgb(1, 2, 3)" }}');
    expect(lines[5]).toContain("second");
  });

  it("refuses ambiguity (two candidates, no sourceLine) instead of guessing", async () => {
    const jsxFile = "src/Ambig.tsx";
    await writeFixture(jsxFile, twoCards);

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: jsxFile, existingClasses: "card" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/ambiguous/i);
    expect(await readFixture(jsxFile)).toBe(twoCards);
  });
});

// ---------------------------------------------------------------------------
// (e) path safety
// ---------------------------------------------------------------------------

describe("element scope save — path safety", () => {
  it("rejects a jsxSourceFile that traverses out of the project root", async () => {
    const outsideDir = await mkdtemp(join(tmpdir(), "redial-outside-"));
    const outsideFile = join(outsideDir, "App.tsx");
    const outsideOriginal = '<div className="x">x</div>\n';
    await writeFile(outsideFile, outsideOriginal, "utf-8");

    try {
      const result = await handleCommit(
        [
          {
            prop: "color",
            from: "blue",
            to: "rgb(1, 2, 3)",
            elementScope: {
              jsxSourceFile: `../${outsideDir.split("/").pop()}/App.tsx`,
              jsxSourceLine: 1,
              existingClasses: "x",
            },
          },
        ],
        tempDir
      );

      expect(result.written).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toMatch(/traversal|escape|cannot open/i);
      expect(await readFile(outsideFile, "utf-8")).toBe(outsideOriginal);
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (f) idempotent re-save
// ---------------------------------------------------------------------------

describe("element scope save — idempotent re-save", () => {
  it("a second identical commit leaves the file byte-identical", async () => {
    const jsxFile = "src/Idem.tsx";
    await writeFixture(
      jsxFile,
      ['export const I = () => <div className="idem">x</div>;', ""].join("\n")
    );

    const change = {
      prop: "padding",
      from: "0px",
      to: "16px",
      elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "idem" },
    };

    const first = await handleCommit([change], tempDir);
    expect(first.failed).toHaveLength(0);
    const afterFirst = await readFixture(jsxFile);
    expect(afterFirst).toContain('style={{ padding: "16px" }}');

    const second = await handleCommit(
      [{ ...change, elementScope: { ...change.elementScope } }],
      tempDir
    );
    expect(second.failed).toHaveLength(0);
    expect(await readFixture(jsxFile)).toBe(afterFirst);
  });
});

// ---------------------------------------------------------------------------
// (g) CRITICAL regression pin — the class rule is NEVER touched
// ---------------------------------------------------------------------------

describe("element scope save — never writes the shared class rule", () => {
  it("leaves the CSS file byte-identical even when a .class rule exists AND the payload carries CSS targeting fields", async () => {
    const cssFile = "src/styles.css";
    const cssOriginal = [
      ".card {",
      "  background-color: red;",
      "  color: blue;",
      "}",
      "",
    ].join("\n");
    await writeFixture(cssFile, cssOriginal);

    const jsxFile = "src/Card.tsx";
    await writeFixture(
      jsxFile,
      ['export const C = () => <div className="card">x</div>;', ""].join("\n")
    );

    // Worst-case payload: a confused client sends the CSS rule target TOO.
    // elementScope must win — the class rule is exactly what element scope
    // promises NOT to touch.
    const result = await handleCommit(
      [
        {
          prop: "background-color",
          from: "red",
          to: "rgb(1, 2, 3)",
          sourceFile: cssFile,
          className: "card",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "card" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    // CSS byte-identical — the shared rule was never modified.
    expect(await readFixture(cssFile)).toBe(cssOriginal);
    expect(result.written).not.toContain(cssFile);
    // The inline style landed on the element instead.
    expect(result.written).toContain(jsxFile);
    expect(await readFixture(jsxFile)).toContain('backgroundColor: "rgb(1, 2, 3)"');
  });

  it("a mixed batch writes the class-scoped change to CSS and the element-scoped one to JSX", async () => {
    const cssFile = "src/mixed.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    const jsxFile = "src/MixedScope.tsx";
    await writeFixture(
      jsxFile,
      ['export const M = () => <div className="card">x</div>;', ""].join("\n")
    );

    const result = await handleCommit(
      [
        // class scope: ordinary CSS rule edit
        { prop: "color", from: "blue", to: "rgb(4, 5, 6)", sourceFile: cssFile, className: "card" },
        // element scope: inline JSX write
        {
          prop: "padding",
          from: "0px",
          to: "8px",
          elementScope: { jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "card" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(cssFile)).toContain("color: rgb(4, 5, 6);");
    expect(await readFixture(cssFile)).not.toContain("padding");
    expect(await readFixture(jsxFile)).toContain('style={{ padding: "8px" }}');
  });
});

// ---------------------------------------------------------------------------
// (h) truthful failure when the JSX can't be located
// ---------------------------------------------------------------------------

describe("element scope save — truthful failure, no fallback", () => {
  it("fails accurately when there is no JSX hint and no className anchor", async () => {
    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          elementScope: {},
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/locate|JSX/i);
    expect(result.failed[0].reason).toMatch(/class scope|source/i);
  });

  it("resolves the file via the className anchor walk when no fiber hint exists", async () => {
    const jsxFile = "src/Walk.tsx";
    await writeFixture(
      jsxFile,
      ['export const W = () => <div className="walk-me">x</div>;', ""].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          elementScope: { existingClasses: "walk-me" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(jsxFile);
    expect(await readFixture(jsxFile)).toContain('style={{ color: "rgb(1, 2, 3)" }}');
  });

  it("fails accurately when the resolved JSX file does not exist — no file touched", async () => {
    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "blue",
          to: "rgb(1, 2, 3)",
          elementScope: { jsxSourceFile: "src/Missing.tsx", jsxSourceLine: 1, existingClasses: "x" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/cannot open|not found|locate/i);
  });
});
