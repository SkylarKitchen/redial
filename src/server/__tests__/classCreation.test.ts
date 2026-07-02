/**
 * Class creation — the Webflow "type a class name" flow, server half.
 *
 * A `CommitChange` may carry `createClass: { name, jsxSourceFile?,
 * jsxSourceLine?, existingClasses? }`. On save the server must:
 *
 *  (a) CREATE the rule block when `.name` has no rule in the target
 *      stylesheet — appended at the end of the file, formatted to the file's
 *      own conventions (indent unit, trailing-newline state), with the batch's
 *      declarations inserted via the existing insert-missing-declaration
 *      machinery;
 *  (b) ATTACH the class to the JSX source's className attribute (token
 *      append — NOT the Tailwind conflict merge, which would eat sibling
 *      classes sharing a utility prefix), inserting a fresh
 *      `className="..."` attribute when the element has none;
 *  (c) FAIL ACCURATELY when no target stylesheet is resolvable — never guess;
 *  (d) enforce the same path-safety envelope as every other write;
 *  (e) be IDEMPOTENT: a second identical save appends no duplicate block and
 *      no duplicate class token.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-class-create-"));
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

/**
 * The JSX half of a createClass fixture. Class creation always attaches the
 * class token in JSX too — a createClass with no attachable JSX reports an
 * honest per-batch failure — so the CSS-formatting tests each seed a minimal
 * component and pass these hints.
 */
async function seedJsx(relativePath: string): Promise<{
  jsxSourceFile: string;
  jsxSourceLine: number;
  existingClasses: string;
}> {
  await writeFixture(
    relativePath,
    ['export const C = () => <div className="seed">x</div>;', ""].join("\n")
  );
  return { jsxSourceFile: relativePath, jsxSourceLine: 1, existingClasses: "seed" };
}

// ---------------------------------------------------------------------------
// (a) Rule-block creation in an existing stylesheet
// ---------------------------------------------------------------------------

describe("rule-block creation", () => {
  it("appends the class block with the batch's declarations (two-space file)", async () => {
    const cssFile = "src/styles.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    const jsx = await seedJsx("src/Styles.tsx");

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", ...jsx },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(cssFile);
    expect(await readFixture(cssFile)).toBe(
      [".card {", "  color: blue;", "}", "", ".hero {", "  padding: 16px;", "}", ""].join("\n")
    );
  });

  it("matches the file's tab indentation convention", async () => {
    const cssFile = "src/tabs.css";
    await writeFixture(cssFile, [".card {", "\tcolor: blue;", "}", ""].join("\n"));
    const jsx = await seedJsx("src/Tabs.tsx");

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", ...jsx },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(cssFile)).toBe(
      [".card {", "\tcolor: blue;", "}", "", ".hero {", "\tpadding: 16px;", "}", ""].join("\n")
    );
  });

  it("preserves a file WITHOUT a trailing newline", async () => {
    const cssFile = "src/nonewline.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}"].join("\n"));
    const jsx = await seedJsx("src/NoNewline.tsx");

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", ...jsx },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(cssFile)).toBe(
      [".card {", "  color: blue;", "}", "", ".hero {", "  padding: 16px;", "}"].join("\n")
    );
  });

  it("lands multiple declarations for the new class in ONE block", async () => {
    const cssFile = "src/multi.module.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    const jsx = await seedJsx("src/Multi.tsx");

    const result = await handleCommit(
      [
        { prop: "padding", from: "0px", to: "16px", sourceFile: cssFile, className: "hero", createClass: { name: "hero", ...jsx } },
        { prop: "color", from: "rgb(0, 0, 0)", to: "rgb(10, 20, 30)", sourceFile: cssFile, className: "hero", createClass: { name: "hero", ...jsx } },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(cssFile);
    expect(content.match(/\.hero\s*\{/g)).toHaveLength(1);
    expect(content).toContain("padding: 16px;");
    expect(content).toContain("color: rgb(10, 20, 30);");
  });

  it("reuses an EXISTING block instead of duplicating it (attach-existing-class flow)", async () => {
    const cssFile = "src/existing.css";
    await writeFixture(cssFile, [".hero {", "  color: blue;", "}", ""].join("\n"));
    const jsx = await seedJsx("src/Existing.tsx");

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", ...jsx },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(cssFile);
    expect(content.match(/\.hero\s*\{/g)).toHaveLength(1);
    expect(content).toContain("padding: 16px;");
  });

  it("creates the pseudo-state block for a state-tagged change on a new class", async () => {
    const cssFile = "src/state.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    const jsx = await seedJsx("src/State.tsx");

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "rgb(0, 0, 0)",
          to: "rgb(255, 0, 0)",
          sourceFile: cssFile,
          className: "hero",
          state: "hover",
          createClass: { name: "hero", ...jsx },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(cssFile);
    expect(content).toMatch(/\.hero\s*\{/);
    expect(content).toMatch(/\.hero:hover\s*\{/);
    expect(content).toContain("color: rgb(255, 0, 0);");
  });

  it("rejects an invalid createClass name without touching the file", async () => {
    const cssFile = "src/invalid.css";
    const original = [".card {", "  color: blue;", "}", ""].join("\n");
    await writeFixture(cssFile, original);

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "card",
          createClass: { name: "bad name{}" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/invalid/i);
    expect(await readFixture(cssFile)).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// (b) JSX className attach
// ---------------------------------------------------------------------------

describe("JSX className attach", () => {
  it("appends the class token to the element's existing className attribute", async () => {
    const cssFile = "src/Hero.css";
    const jsxFile = "src/Hero.tsx";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    await writeFixture(
      jsxFile,
      [
        "export function Hero() {",
        '  return <div className="hero-old">hi</div>;',
        "}",
        "",
      ].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", jsxSourceFile: jsxFile, jsxSourceLine: 2, existingClasses: "hero-old" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(cssFile);
    expect(result.written).toContain(jsxFile);
    expect(await readFixture(jsxFile)).toContain('className="hero-old hero"');
  });

  it("does NOT run the Tailwind conflict merge — sibling classes sharing a prefix survive", async () => {
    const cssFile = "src/Text.css";
    const jsxFile = "src/Text.tsx";
    await writeFixture(cssFile, [".base {", "  color: blue;", "}", ""].join("\n"));
    await writeFixture(
      jsxFile,
      ['export const T = () => <p className="text-large">x</p>;', ""].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "color",
          from: "rgb(0, 0, 0)",
          to: "rgb(1, 2, 3)",
          sourceFile: cssFile,
          className: "text-brand",
          createClass: { name: "text-brand", jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "text-large" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    // Tailwind's mergeClasses would collapse text-large/text-brand into one
    // "text" group; a plain-class attach must keep BOTH.
    expect(await readFixture(jsxFile)).toContain('className="text-large text-brand"');
  });

  it("inserts a className attribute when the element has none", async () => {
    const cssFile = "src/Fresh.css";
    const jsxFile = "src/Fresh.tsx";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    await writeFixture(
      jsxFile,
      [
        "export function Fresh() {",
        "  return (",
        "    <div>",
        "      <span>hi</span>",
        "    </div>",
        "  );",
        "}",
        "",
      ].join("\n")
    );

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", jsxSourceFile: jsxFile, jsxSourceLine: 3, existingClasses: "" },
        },
      ],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(await readFixture(jsxFile)).toContain('<div className="hero">');
  });

  it("fails accurately on a non-literal className expression (CSS still written)", async () => {
    const cssFile = "src/Mod.module.css";
    const jsxFile = "src/Mod.tsx";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    const jsxOriginal = [
      'import styles from "./Mod.module.css";',
      "export const M = () => <div className={styles.card}>x</div>;",
      "",
    ].join("\n");
    await writeFixture(jsxFile, jsxOriginal);

    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: cssFile,
          className: "hero",
          createClass: { name: "hero", jsxSourceFile: jsxFile, jsxSourceLine: 2, existingClasses: "" },
        },
      ],
      tempDir
    );

    // The CSS half landed…
    expect(result.written).toContain(cssFile);
    expect(await readFixture(cssFile)).toContain(".hero {");
    // …but the JSX attach reports an honest failure and leaves the file alone.
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/hero/);
    expect(result.failed[0].reason).toMatch(/non-literal|manually/i);
    expect(await readFixture(jsxFile)).toBe(jsxOriginal);
  });
});

// ---------------------------------------------------------------------------
// (c) Failure accuracy + (d) path safety
// ---------------------------------------------------------------------------

describe("failure accuracy and path safety", () => {
  it("fails accurately when no target stylesheet was resolved (no sourceFile)", async () => {
    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          className: "hero",
          createClass: { name: "hero" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/cannot create/i);
    expect(result.failed[0].reason).toContain("hero");
  });

  it("fails accurately when the target stylesheet does not exist — never guesses", async () => {
    const result = await handleCommit(
      [
        {
          prop: "padding",
          from: "0px",
          to: "16px",
          sourceFile: "styles/missing.css",
          className: "hero",
          createClass: { name: "hero" },
        },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/cannot create/i);
    expect(result.failed[0].reason).toContain("hero");
  });

  it("rejects a jsxSourceFile that traverses out of the project root", async () => {
    const cssFile = "src/safe.css";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));

    // A sibling directory OUTSIDE the project root that must never be written.
    const outsideDir = await mkdtemp(join(tmpdir(), "redial-outside-"));
    const outsideFile = join(outsideDir, "App.tsx");
    const outsideOriginal = '<div className="x">x</div>\n';
    await writeFile(outsideFile, outsideOriginal, "utf-8");

    try {
      const result = await handleCommit(
        [
          {
            prop: "padding",
            from: "0px",
            to: "16px",
            sourceFile: cssFile,
            className: "hero",
            createClass: {
              name: "hero",
              jsxSourceFile: `../${outsideDir.split("/").pop()}/App.tsx`,
              jsxSourceLine: 1,
              existingClasses: "x",
            },
          },
        ],
        tempDir
      );

      // CSS write succeeds; JSX attach is refused with an accurate reason.
      expect(result.written).toContain(cssFile);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].reason).toMatch(/attach|traversal|escape/i);
      expect(await readFile(outsideFile, "utf-8")).toBe(outsideOriginal);
    } finally {
      await rm(outsideDir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// (e) Idempotent re-save
// ---------------------------------------------------------------------------

describe("idempotent re-save", () => {
  it("a second identical commit adds no duplicate block and no duplicate class token", async () => {
    const cssFile = "src/idem.css";
    const jsxFile = "src/Idem.tsx";
    await writeFixture(cssFile, [".card {", "  color: blue;", "}", ""].join("\n"));
    await writeFixture(
      jsxFile,
      ['export const I = () => <div className="base">x</div>;', ""].join("\n")
    );

    const change = {
      prop: "padding",
      from: "0px",
      to: "16px",
      sourceFile: cssFile,
      className: "hero",
      createClass: { name: "hero", jsxSourceFile: jsxFile, jsxSourceLine: 1, existingClasses: "base" },
    };

    const first = await handleCommit([change], tempDir);
    expect(first.failed).toHaveLength(0);
    const cssAfterFirst = await readFixture(cssFile);
    const jsxAfterFirst = await readFixture(jsxFile);

    const second = await handleCommit([{ ...change, createClass: { ...change.createClass } }], tempDir);
    expect(second.failed).toHaveLength(0);

    const cssAfterSecond = await readFixture(cssFile);
    const jsxAfterSecond = await readFixture(jsxFile);
    expect(cssAfterSecond).toBe(cssAfterFirst);
    expect(jsxAfterSecond).toBe(jsxAfterFirst);
    expect(cssAfterSecond.match(/\.hero\s*\{/g)).toHaveLength(1);
    expect(jsxAfterSecond.match(/\bhero\b/g)).toHaveLength(1);
  });
});
