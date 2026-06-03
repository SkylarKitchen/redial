/**
 * Outlier hunt: source-rewrite AMBIGUITY in commit.ts.
 *
 * commit.ts locates a CSS declaration with substring matching
 * (`lines[i].includes(prop) && lines[i].includes(value)`) and then does a
 * surgical regex replace. That heuristic is robust for the 90% case but can be
 * fooled when the property name and/or value also appear somewhere they
 * shouldn't be edited: inside comments, inside url()/transition values, in a
 * different (minified) rule, or in a comment that mentions a shorthand.
 *
 * Each test below feeds a hand-crafted source string through the real
 * findPropertyInFile / handleCommit and asserts the CORRECT outcome.
 *
 *   - `it(...)`        : Redial already behaves correctly — a regression lock.
 *   - `it.fails(...)`  : a genuine bug (the body asserts correct behavior and
 *                        FAILS, documenting the defect without breaking CI).
 *
 * No production code is modified.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { findPropertyInFile, resolveSourceFile, handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-ambiguity-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<string> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return content;
}

// ---------------------------------------------------------------------------
// Comments that mention the property/value
// ---------------------------------------------------------------------------

describe("commit ambiguity — comments", () => {
  // BUG: a `/* color: blue */` comment above the real `color: blue;` is rewritten
  // instead of the real declaration. searchClassBlock scans the block top-down
  // and `.includes("color") && .includes("blue")` matches the comment line first.
  it.fails("does NOT rewrite a comment that mentions prop+value above the real declaration", async () => {
    const filePath = "src/Card.module.css";
    await writeFixture(filePath, [
      ".card {",
      "  /* color: blue */",
      "  color: blue;",
      "}",
    ].join("\n"));

    await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "card" }],
      tempDir
    );

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // The real declaration must become green…
    expect(content).toMatch(/[^*]\s*color:\s*green;/);
    // …and the comment text must be left exactly as written.
    expect(content).toContain("/* color: blue */");
  });

  // BUG: when only a comment mentions the property (no real declaration exists),
  // handleCommit reports written/success and silently edits the COMMENT body,
  // changing nothing functional. It should fail("property not found") instead.
  it.fails("fails (not silently edits a comment) when only a comment mentions the property", async () => {
    const filePath = "src/Ghost.module.css";
    const original = await writeFixture(filePath, [
      ".ghost {",
      "  /* color: blue please */",
      "  font-size: 12px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "ghost" }],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
    expect(result.written).toHaveLength(0);
    expect(await readFile(join(tempDir, filePath), "utf-8")).toBe(original);
  });

  // BUG: even with an accurate sourceLine pointing AT the real declaration, the
  // window search scans the whole ±5 window top-down and returns the earlier
  // comment line (which also contains prop+value) before reaching sourceLine.
  it.fails("window search at the exact sourceLine still skips an earlier matching comment", async () => {
    const filePath = "src/Win.module.css";
    await writeFixture(filePath, [
      ".win {",          // 0
      "  /* color: blue */", // 1
      "  color: blue;",  // 2  <- sourceLine points here
      "}",               // 3
    ].join("\n"));

    await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "win", sourceLine: 2 }],
      tempDir
    );

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("/* color: blue */");        // comment preserved
    expect(content).toMatch(/[^*]\s*color:\s*green;/);     // real decl changed
  });
});

// ---------------------------------------------------------------------------
// Property name appearing inside a value (url / transition / longhand parent)
// ---------------------------------------------------------------------------

describe("commit ambiguity — prop name inside a value", () => {
  it("does not clobber background:url(color.png) when editing color", async () => {
    const filePath = "src/Hero.module.css";
    await writeFixture(filePath, [
      ".hero {",
      "  background: url(color.png);",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "hero" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("background: url(color.png);"); // url untouched
    expect(content).toContain("color: green;");
  });

  it("does not clobber transition: background-color 1s when editing background-color", async () => {
    const filePath = "src/Box.module.css";
    await writeFixture(filePath, [
      ".box {",
      "  transition: background-color 1s;",
      "  background-color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "background-color", from: "red", to: "green", sourceFile: filePath, className: "box" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("transition: background-color 1s;"); // transition untouched
    expect(content).toContain("background-color: green;");
  });

  it("editing `border` does not touch a `border-radius` line above it", async () => {
    const filePath = "src/Bord.module.css";
    await writeFixture(filePath, [
      ".bord {",
      "  border-radius: 4px;",
      "  border: 1px solid red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "border", from: "1px solid red", to: "2px solid blue", sourceFile: filePath, className: "bord" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("border-radius: 4px;"); // radius untouched
    expect(content).toContain("border: 2px solid blue;");
  });
});

// ---------------------------------------------------------------------------
// Minified single-line CSS
// ---------------------------------------------------------------------------

describe("commit ambiguity — minified single-line", () => {
  // distinct values self-disambiguate via the surgical (prop:from) regex.
  it("minified: editing .b with a unique value does not touch .a", async () => {
    const filePath = "src/Min.module.css";
    await writeFixture(filePath, ".a{color:red}.b{color:blue}");

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "b" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".a{color:red}.b{color:green}");
  });

  // BUG: with IDENTICAL values, searchClassBlock can't isolate the block on a
  // single minified line (its `j > blockStart` guard never inspects line 0), so
  // full-file search returns line 0 and the surgical regex rewrites the FIRST
  // `color:red` — i.e. .a — even though the user targeted .b.
  it.fails("minified: editing .b with a value shared by .a must not rewrite .a", async () => {
    const filePath = "src/MinDup.module.css";
    await writeFixture(filePath, ".a{color:red}.b{color:red}");

    await handleCommit(
      [{ prop: "color", from: "red", to: "green", sourceFile: filePath, className: "b" }],
      tempDir
    );

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".a{color:red}.b{color:green}");
  });
});

// ---------------------------------------------------------------------------
// Shorthand fallback fooled by a comment
// ---------------------------------------------------------------------------

describe("commit ambiguity — shorthand fallback vs comments", () => {
  // BUG: tryShorthandFallback uses searchClassBlockFuzzy which matches the
  // `padding:` substring inside a comment, then expands the comment's value and
  // rewrites it — producing garbage like `/* padding: 12px legacy */` while the
  // real `padding: 16px 24px;` is left unchanged.
  it.fails("padding-top fallback must skip a comment containing `padding:` and edit the real shorthand", async () => {
    const filePath = "src/Pad.module.css";
    await writeFixture(filePath, [
      ".pad {",
      "  /* padding: 16px legacy */",
      "  padding: 16px 24px;",
      "}",
    ].join("\n"));

    await handleCommit(
      [{ prop: "padding-top", from: "16px", to: "12px", sourceFile: filePath, className: "pad" }],
      tempDir
    );

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("/* padding: 16px legacy */"); // comment intact
    expect(content).toContain("padding: 12px 24px;");        // real shorthand edited
  });

  // Regression lock: the normal shorthand fallback (no comment) still works.
  it("padding-top fallback rewrites the real shorthand when no comment interferes", async () => {
    const filePath = "src/Pad2.module.css";
    await writeFixture(filePath, [
      ".pad2 {",
      "  padding: 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "padding-top", from: "16px", to: "12px", sourceFile: filePath, className: "pad2" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // [16,24,16,24] with top→12 = [12,24,16,24] → right===left → 3-value form.
    expect(content).toContain("padding: 12px 24px 16px;");
  });
});

// ---------------------------------------------------------------------------
// Selector disambiguation edge cases
// ---------------------------------------------------------------------------

describe("commit ambiguity — selector matching", () => {
  it("editing .btn does not match a longer class .btn-primary", async () => {
    const filePath = "src/Btn.module.css";
    await writeFixture(filePath, [
      ".btn-primary {",
      "  color: red;",
      "}",
      ".btn {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "btn" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toMatch(/\.btn-primary\s*\{[^}]*color:\s*red/); // sibling untouched
    expect(content).toMatch(/\.btn\s*\{[^}]*color:\s*green/);
  });

  it("editing .card does not match a chained selector .card.active", async () => {
    const filePath = "src/Chain.module.css";
    await writeFixture(filePath, [
      ".card.active {",
      "  color: red;",
      "}",
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "green", sourceFile: filePath, className: "card" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toMatch(/\.card\.active\s*\{[^}]*color:\s*red/); // chained untouched
    expect(content).toMatch(/\.card\s*\{[^}]*color:\s*green/);
  });

  // Honest limitation lock: a grouped selector `.a, .b { color: red }` is ONE
  // physical declaration. Editing it through className "a" necessarily also
  // changes the rule for .b — the writer can't split a shared declaration.
  // This documents the (currently unavoidable) behavior so a regression that
  // *fails to write at all* would still be caught.
  it("grouped selector: editing via one member updates the shared declaration for all", async () => {
    const filePath = "src/Group.module.css";
    await writeFixture(filePath, [
      ".a,",
      ".b {",
      "  color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "red", to: "green", sourceFile: filePath, className: "a" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // The single shared declaration is rewritten once.
    expect(content).toContain("color: green;");
    expect(content).not.toContain("color: red;");
  });
});

// ---------------------------------------------------------------------------
// Value-matching edge cases
// ---------------------------------------------------------------------------

describe("commit ambiguity — value matching", () => {
  it("does not edit `color: darkred` when from is the substring `red` (honest failure)", async () => {
    const filePath = "src/Dark.module.css";
    const original = await writeFixture(filePath, [
      ".dark {",
      "  color: darkred;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "red", to: "blue", sourceFile: filePath, className: "dark" }],
      tempDir
    );

    // Surgical regex `color:\s*red` cannot match `darkred` → reported as failed,
    // file left untouched. (This is the desired honest degradation.)
    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(join(tempDir, filePath), "utf-8")).toBe(original);
  });

  it("preserves a `to` value containing `$` (no regex backreference corruption)", async () => {
    const filePath = "src/Dollar.module.css";
    await writeFixture(filePath, [
      ".dollar {",
      '  content: "a";',
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "content", from: '"a"', to: '"$5.00"', sourceFile: filePath, className: "dollar" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain('content: "$5.00";');
  });

  it("handles a `from` value with regex-special chars: calc(100% - 20px)", async () => {
    const filePath = "src/Calc.module.css";
    await writeFixture(filePath, [
      ".calc {",
      "  width: calc(100% - 20px);",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "width", from: "calc(100% - 20px)", to: "calc(100% - 40px)", sourceFile: filePath, className: "calc" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("width: calc(100% - 40px);");
  });

  it("editing the fallback half of a double `display:` declaration targets the right line", async () => {
    const filePath = "src/Disp.module.css";
    await writeFixture(filePath, [
      ".disp {",
      "  display: -webkit-box;",
      "  display: flex;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "display", from: "-webkit-box", to: "grid", sourceFile: filePath, className: "disp" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("display: grid;");  // fallback line changed
    expect(content).toContain("display: flex;");  // standard line preserved
  });
});

// ---------------------------------------------------------------------------
// resolveSourceFile ambiguity
// ---------------------------------------------------------------------------

describe("commit ambiguity — duplicate filename across directories", () => {
  // Honest limitation lock: with the same module filename in two feature dirs
  // and no componentName hint, resolveSourceFile deterministically returns the
  // first match found by the recursive walk. This documents that it does NOT
  // throw / return null on ambiguity (it picks one), so callers know to pass a
  // componentName when disambiguation matters.
  it("returns a single deterministic match (not null) for an ambiguous bare filename", async () => {
    await writeFixture("src/featureA/Card.module.css", ".card { color: red; }");
    await writeFixture("src/featureB/Card.module.css", ".card { color: blue; }");

    const resolved = await resolveSourceFile(tempDir, "Card.module.css");
    expect(resolved).not.toBeNull();
    expect(resolved!).toMatch(/Card\.module\.css$/);
    expect([
      join(tempDir, "src/featureA/Card.module.css"),
      join(tempDir, "src/featureB/Card.module.css"),
    ]).toContain(resolved);
  });

  it("uses the componentName hint to disambiguate duplicate filenames", async () => {
    await writeFixture("src/featureA/Card.module.css", ".card { color: red; }");
    await writeFixture("src/featureB/Widget/Card.module.css", ".card { color: blue; }");

    const resolved = await resolveSourceFile(tempDir, "Card.module.css", "Widget");
    expect(resolved).toBe(join(tempDir, "src/featureB/Widget/Card.module.css"));
  });
});

// ---------------------------------------------------------------------------
// findPropertyInFile unit-level confirmation of the comment defect
// ---------------------------------------------------------------------------

describe("findPropertyInFile — comment confusion (unit)", () => {
  // BUG: findPropertyInFile points at the comment line (1) rather than the real
  // declaration (2) because both lines contain the prop and the value substring.
  it.fails("class-block search points at the real declaration line, not the comment", () => {
    const lines = [
      ".x {",                 // 0
      "  /* color: blue */",  // 1
      "  color: blue;",       // 2
      "}",                    // 3
    ];
    const result = findPropertyInFile(lines, "color", "blue", undefined, "x");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(2);
  });
});
