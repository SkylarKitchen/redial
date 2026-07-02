/**
 * Insert-missing-declaration coverage — closes the replace-only save gap.
 *
 * Historically handleCommit could only REPLACE an existing `prop: value`
 * declaration; when the target rule block existed but never authored the
 * property (fresh/AI-generated markup — the common case), the save failed
 * with "property not found" and the panel edit was a dead end.
 *
 * These tests pin the insertion path:
 *  - a change whose prop is authored NOWHERE in the file is INSERTED into the
 *    existing `.className` (or `.className:state` / nested `&:state`) block,
 *    before the closing brace, matching the block's indentation;
 *  - single-line/minified blocks get an in-place splice confined to the target
 *    block's body span, so sibling blocks on the same physical line are
 *    untouched (issue #47 machinery);
 *  - a second identical commit REPLACES the inserted declaration (via the
 *    fuzzy tier / in-block prop match) instead of duplicating it;
 *  - when NO rule block matches the className, the save still fails — with an
 *    accurate "create the class first" message — and the file is untouched.
 *
 * Scope boundary: creating a brand-new rule when no block matches is a
 * separate feature (class creation) and stays a failure here.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-add-decl-"));
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
// (a) Multi-line block missing the prop → inserted before the closing brace
// ---------------------------------------------------------------------------

describe("insert into a multi-line class block", () => {
  it("inserts the declaration before the closing brace with matching indentation", async () => {
    const filePath = "src/Card.module.css";
    await writeFixture(filePath, [
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      // `from` is the COMPUTED value — the source never authored the prop.
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "card" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".card {",
      "  color: blue;",
      "  letter-spacing: 0.05em;",
      "}",
    ].join("\n"));
  });

  it("copies the block's tab indentation", async () => {
    const filePath = "src/Tab.module.css";
    await writeFixture(filePath, [
      ".tab {",
      "\tcolor: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "tab" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".tab {",
      "\tcolor: blue;",
      "\tletter-spacing: 0.05em;",
      "}",
    ].join("\n"));
  });

  it("inserts into an empty block with derived indentation", async () => {
    const filePath = "src/Empty.module.css";
    await writeFixture(filePath, [
      ".empty {",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "empty" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".empty {",
      "  letter-spacing: 0.05em;",
      "}",
    ].join("\n"));
  });

  it("inserts into a class block nested inside @media with the deeper indentation", async () => {
    const filePath = "src/Resp.module.css";
    await writeFixture(filePath, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    padding: 16px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "gap", from: "normal", to: "8px", sourceFile: filePath, className: "card" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      "@media (min-width: 768px) {",
      "  .card {",
      "    padding: 16px;",
      "    gap: 8px;",
      "  }",
      "}",
    ].join("\n"));
  });

  it("handles an Allman-style block (brace on its own line)", async () => {
    const filePath = "src/Allman.module.css";
    await writeFixture(filePath, [
      ".panel",
      "{",
      "  color: teal;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "panel" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".panel",
      "{",
      "  color: teal;",
      "  letter-spacing: 0.05em;",
      "}",
    ].join("\n"));
  });
});

// ---------------------------------------------------------------------------
// (b) Single-line / minified block → splice confined to the body range
// ---------------------------------------------------------------------------

describe("insert into a minified single-line block", () => {
  it("inserts inside .b's body without touching the sibling .a block on the same line", async () => {
    const filePath = "src/Min.module.css";
    await writeFixture(filePath, ".a{color:red}.b{color:red}");

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "b" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".a{color:red}.b{color:red;letter-spacing: 0.05em;}");
  });

  it("inserts inside .a's body without touching the sibling .b block after it", async () => {
    const filePath = "src/MinFirst.module.css";
    await writeFixture(filePath, ".a{color:red}.b{color:red}");

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "a" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".a{color:red;letter-spacing: 0.05em;}.b{color:red}");
  });

  it("does not double the semicolon when the body already ends with one", async () => {
    const filePath = "src/MinSemi.module.css";
    await writeFixture(filePath, ".inline { color: red; }");

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "inline" }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".inline { color: red; letter-spacing: 0.05em;}");
  });
});

// ---------------------------------------------------------------------------
// (c) Pseudo-state blocks — flat, minified, and nested SCSS
// ---------------------------------------------------------------------------

describe("insert into an existing pseudo-state block", () => {
  it("inserts into the existing .btn:hover block instead of creating a duplicate", async () => {
    const filePath = "src/Btn.module.css";
    await writeFixture(filePath, [
      ".btn {",
      "  color: blue;",
      "}",
      "",
      ".btn:hover {",
      "  color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "letter-spacing", from: "normal", to: "0.05em",
        sourceFile: filePath, className: "btn", state: "hover",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".btn {",
      "  color: blue;",
      "}",
      "",
      ".btn:hover {",
      "  color: red;",
      "  letter-spacing: 0.05em;",
      "}",
    ].join("\n"));
    // Exactly one hover block — no duplicate sibling created.
    expect(content.split(".btn:hover").length - 1).toBe(1);
  });

  it("minified: inserts into .b:hover's body range without touching .a:hover on the same line", async () => {
    const filePath = "src/MinPseudo.module.css";
    await writeFixture(filePath, ".a:hover{color:red}.b:hover{color:red}");

    const result = await handleCommit(
      [{
        prop: "letter-spacing", from: "normal", to: "0.05em",
        sourceFile: filePath, className: "b", state: "hover",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(".a:hover{color:red}.b:hover{color:red;letter-spacing: 0.05em;}");
  });

  it("SCSS: inserts into the existing nested &:hover block instead of creating a second one", async () => {
    const filePath = "src/Nest.module.scss";
    await writeFixture(filePath, [
      ".btn {",
      "  color: blue;",
      "  &:hover {",
      "    color: red;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "letter-spacing", from: "normal", to: "0.05em",
        sourceFile: filePath, className: "btn", state: "hover",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe([
      ".btn {",
      "  color: blue;",
      "  &:hover {",
      "    color: red;",
      "    letter-spacing: 0.05em;",
      "  }",
      "}",
    ].join("\n"));
    expect(content.split("&:hover").length - 1).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (d) Idempotence — a second identical commit replaces, never duplicates
// ---------------------------------------------------------------------------

describe("idempotence of an inserted declaration", () => {
  it("a second identical commit replaces the inserted declaration (base block)", async () => {
    const filePath = "src/Idem.module.css";
    await writeFixture(filePath, [
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const change = {
      prop: "letter-spacing", from: "normal", to: "0.05em",
      sourceFile: filePath, className: "card",
    };

    const first = await handleCommit([{ ...change }], tempDir);
    expect(first.failed).toHaveLength(0);
    const afterFirst = await readFile(join(tempDir, filePath), "utf-8");

    const second = await handleCommit([{ ...change }], tempDir);
    expect(second.failed).toHaveLength(0);
    const afterSecond = await readFile(join(tempDir, filePath), "utf-8");

    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.split("letter-spacing").length - 1).toBe(1);
  });

  it("a second identical commit replaces the inserted declaration (pseudo block)", async () => {
    const filePath = "src/IdemHover.module.css";
    await writeFixture(filePath, [
      ".btn {",
      "  color: blue;",
      "}",
      "",
      ".btn:hover {",
      "  color: red;",
      "}",
    ].join("\n"));

    const change = {
      prop: "letter-spacing", from: "normal", to: "0.05em",
      sourceFile: filePath, className: "btn", state: "hover",
    };

    const first = await handleCommit([{ ...change }], tempDir);
    expect(first.failed).toHaveLength(0);
    const afterFirst = await readFile(join(tempDir, filePath), "utf-8");

    const second = await handleCommit([{ ...change }], tempDir);
    expect(second.failed).toHaveLength(0);
    const afterSecond = await readFile(join(tempDir, filePath), "utf-8");

    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.split("letter-spacing").length - 1).toBe(1);
    expect(afterSecond.split(".btn:hover").length - 1).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (e) No matching rule block → accurate failure, file untouched
// ---------------------------------------------------------------------------

describe("no matching rule block", () => {
  it("fails with an accurate 'create the class first' message and leaves the file untouched", async () => {
    const filePath = "src/Other.module.css";
    const original = await writeFixture(filePath, [
      ".other {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "missing" }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/no rule for \.missing/);
    expect(result.failed[0].reason).toMatch(/create the class/);
    expect(await readFile(join(tempDir, filePath), "utf-8")).toBe(original);
  });

  it("keeps the classic 'not found' failure when no className is provided", async () => {
    const filePath = "src/NoClass.module.css";
    const original = await writeFixture(filePath, [
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("not found");
    expect(await readFile(join(tempDir, filePath), "utf-8")).toBe(original);
  });

  it("refuses to re-enable a commented-out declaration (outlier contract)", async () => {
    // A `/* prop: ... */` inside the block is a deliberately disabled
    // declaration — insertion must not silently override it. Mirrors
    // outliers-commit-ambiguity's "only a comment mentions the property".
    const filePath = "src/Ghost.module.css";
    const original = await writeFixture(filePath, [
      ".ghost {",
      "  /* letter-spacing: 0.1em; */",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "letter-spacing", from: "normal", to: "0.05em", sourceFile: filePath, className: "ghost" }],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("not found");
    expect(await readFile(join(tempDir, filePath), "utf-8")).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// (f) CSS Modules resolution path (bare filename + componentName hint)
// ---------------------------------------------------------------------------

describe("CSS Modules resolution still applies to inserts", () => {
  it("resolves a bare module filename via recursive search and inserts", async () => {
    // The overlay demangles `Button_btn__abc12` → className "btn",
    // componentName "Button", sourceFile "Button.module.scss" (bare).
    await writeFixture("src/components/Button.module.scss", [
      ".btn {",
      "  color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "letter-spacing", from: "normal", to: "0.05em",
        sourceFile: "Button.module.scss", componentName: "Button", className: "btn",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain("Button.module.scss");
    const content = await readFile(join(tempDir, "src/components/Button.module.scss"), "utf-8");
    expect(content).toBe([
      ".btn {",
      "  color: red;",
      "  letter-spacing: 0.05em;",
      "}",
    ].join("\n"));
  });
});
