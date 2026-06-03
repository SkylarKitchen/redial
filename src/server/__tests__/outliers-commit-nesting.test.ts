/**
 * Outlier coverage for commit.ts nesting / at-rules / brace counting.
 *
 * These probe the char-by-char brace-depth counters in searchClassBlock,
 * searchNestedPseudoBlock, findClassBlockEnd, searchRootBlock, and the
 * @layer / :root handling — with weird-but-real CSS/SCSS that the naive
 * counters can plausibly mishandle.
 *
 * No production code is modified. GREEN tests lock correct behavior;
 * it.fails tests document genuine bugs (body must fail internally).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { findPropertyInFile, handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-outlier-nest-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<string> {
  const fullPath = join(tempDir, relativePath);
  const dir = fullPath.substring(0, fullPath.lastIndexOf("/"));
  await mkdir(dir, { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return fullPath;
}

// -------------------------------------------------------------------------
// 1. Brace literal INSIDE a value confuses the char-by-char depth counter.
// -------------------------------------------------------------------------

describe("brace literals inside values vs. brace-depth counters", () => {
  // searchClassBlock counts every '{' / '}' char regardless of string context,
  // so `content: "}"` closes the .tag block early in the counter's view and the
  // real `color: red` on line 6 becomes unreachable to the class-scoped search.
  // The tiered fallback then runs a full-file search by value, which picks the
  // FIRST `color: red` in the file — the unrelated .decoy block on line 1.
  // RESULT: a class-scoped edit silently lands in the WRONG class.
  // BUG: stray closing-brace literal in a value defeats class scoping, so the
  // edit is misattributed to an earlier block with the same prop+value.
  it("scopes color:red to .tag (not earlier .decoy) despite a content: \"}\" literal", () => {
    const lines = [
      ".decoy {",                     // 0
      "  color: red;",                // 1  full-file picks THIS (wrong block)
      "}",                            // 2
      "",                             // 3
      ".tag {",                       // 4  depth->1
      '  content: "}";',              // 5  stray '}' closes .tag early in counter
      "  color: red;",                // 6  the CORRECT target line
      "}",                            // 7
    ];
    const result = findPropertyInFile(lines, "color", "red", undefined, "tag");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(6); // must be .tag's color, not .decoy's
  });

  // Mirror of the above with an opening-brace literal. `content: "{"` pushes the
  // counter to depth 2 inside .tag; the block never appears to close, but the
  // class search still passes over the right line here because depth stays > 0.
  // This variant DOES resolve correctly via class-block search — lock it green.
  it("scopes a property correctly even when the block contains content: \"{\"", () => {
    const lines = [
      ".decoy {",                     // 0
      "  color: red;",                // 1
      "}",                            // 2
      "",                             // 3
      ".tag {",                       // 4
      '  content: "{";',              // 5  stray '{' -> depth 2 (block stays open)
      "  color: red;",                // 6  target, still reachable (depth > 0)
      "}",                            // 7
    ];
    const result = findPropertyInFile(lines, "color", "red", undefined, "tag");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(6);
    expect(result!.strategy).toBe("class-block");
  });

  // A data-URI value containing braces in handleCommit. The brace counter sees
  // unbalanced braces but the property we want is on the SAME line as the
  // selector-adjacent declaration, so this one can still succeed. Verify the
  // write lands and does not corrupt the data URI.
  it("writes a sibling property when block contains a url(data:...{...}) value", async () => {
    const filePath = "src/Icon.module.css";
    await writeFixture(filePath, [
      ".icon {",
      "  color: red;",
      "  background: url(\"data:image/svg+xml,<svg>{stuff}</svg>\");",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "red", to: "green", sourceFile: filePath, className: "icon" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("color: green");
    // The data URI must be preserved intact.
    expect(content).toContain("data:image/svg+xml,<svg>{stuff}</svg>");
  });
});

// -------------------------------------------------------------------------
// 2. @supports / @container / @media wrapping a class block.
//    searchClassBlock should still find the class regardless of the wrapper.
// -------------------------------------------------------------------------

describe("at-rule wrappers around a class block", () => {
  it("finds a property in a class block nested inside @media", async () => {
    const filePath = "src/Resp.module.css";
    await writeFixture(filePath, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    padding: 16px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "padding", from: "16px", to: "24px", sourceFile: filePath, className: "card" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("padding: 24px");
  });

  it("finds a property in a class block nested inside @supports", async () => {
    const filePath = "src/Sup.module.css";
    await writeFixture(filePath, [
      "@supports (display: grid) {",
      "  .grid {",
      "    gap: 8px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "gap", from: "8px", to: "12px", sourceFile: filePath, className: "grid" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("gap: 12px");
  });

  // The dangerous case: the SAME class exists both inside an @media wrapper
  // (responsive override) and at the top level (base). A class-scoped search
  // with no value-disambiguation could land on the wrong one. We send the
  // base value 16px which only matches the base block, so it should land
  // there. Verifies the brace counter doesn't leak across the wrapper.
  it("updates the base .card, not the @media override, when value matches base", async () => {
    const filePath = "src/Dup.module.css";
    await writeFixture(filePath, [
      ".card {",
      "  padding: 16px;",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card {",
      "    padding: 32px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "padding", from: "16px", to: "20px", sourceFile: filePath, className: "card" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // base updated
    expect(content).toMatch(/\.card\s*\{\s*\n\s*padding: 20px/);
    // @media override untouched
    expect(content).toContain("padding: 32px");
  });
});

// -------------------------------------------------------------------------
// 3. :root custom property nested past searchRootBlock's one-level @layer.
// -------------------------------------------------------------------------

describe("custom-property :root nesting depth", () => {
  it("finds a --var defined in plain :root", () => {
    const lines = [
      ":root {",
      "  --accent: #6366f1;",
      "}",
    ];
    const result = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
  });

  it("finds a --var inside @layer base { :root { } }", () => {
    const lines = [
      "@layer base {",
      "  :root {",
      "    --accent: #6366f1;",
      "  }",
      "}",
    ];
    const result = findPropertyInFile(lines, "--accent", "#6366f1");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(2);
  });

  // :root nested inside @media inside @layer. searchRootBlock scans @layer
  // contents for any line matching the :root pattern regardless of @media
  // depth, so this should still resolve.
  it("finds a --var inside @layer base { @media { :root { } } }", () => {
    const lines = [
      "@layer base {",
      "  @media (prefers-color-scheme: dark) {",
      "    :root {",
      "      --accent: #818cf8;",
      "    }",
      "  }",
      "}",
    ];
    const result = findPropertyInFile(lines, "--accent", "#818cf8");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(3);
  });

  // A --var inside a bare @media (no @layer at all). searchRootBlock's
  // rootPattern is anchored `^\s*:root` so the indented `:root` inside @media
  // still matches as a "direct" :root block on its own line. This should work.
  it("finds a --var inside a bare @media { :root { } }", () => {
    const lines = [
      "@media (min-width: 1px) {",
      "  :root {",
      "    --accent: #abc;",
      "  }",
      "}",
    ];
    const result = findPropertyInFile(lines, "--accent", "#abc");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(2);
  });

  // A --var defined directly in a class block (NOT in :root). Tier 1.5 only
  // searches root/theme blocks for custom props; when absent it should fall
  // through to the class-block / full-file tiers and still find it.
  it("finds a --var defined inside a normal class block (no :root)", () => {
    const lines = [
      ".scope {",
      "  --local: 4px;",
      "  padding: var(--local);",
      "}",
    ];
    const result = findPropertyInFile(lines, "--local", "4px", undefined, "scope");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
  });
});

// -------------------------------------------------------------------------
// 4. Deeply nested SCSS — class block search returns the right inner line.
// -------------------------------------------------------------------------

describe("deeply nested SCSS class blocks", () => {
  // 3-level nesting: .card { .header { .title { font-size } } }. The
  // class-scoped search for "card" walks the whole subtree until depth<=0,
  // and full-file value-match should land on the right inner font-size.
  it("updates a property three levels deep under the class", async () => {
    const filePath = "src/Nest.module.scss";
    await writeFixture(filePath, [
      ".card {",
      "  color: black;",
      "  .header {",
      "    .title {",
      "      font-size: 12px;",
      "    }",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "font-size", from: "12px", to: "14px", sourceFile: filePath, className: "card" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 14px");
  });

  // Two sibling nested blocks share the same inner property name + value, but
  // only one matches the `from`. Make sure the brace counter does not stop at
  // the first nested block's closing brace and miss the second.
  it("reaches a property in the SECOND nested sibling block", async () => {
    const filePath = "src/Sibs.module.scss";
    await writeFixture(filePath, [
      ".panel {",
      "  .a {",
      "    width: 10px;",
      "  }",
      "  .b {",
      "    width: 20px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "width", from: "20px", to: "30px", sourceFile: filePath, className: "panel" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("width: 30px");
    expect(content).toContain("width: 10px");
  });
});

// -------------------------------------------------------------------------
// 5. Selector list whose opening brace is several lines below the selector.
// -------------------------------------------------------------------------

describe("multi-line selector lists", () => {
  // searchClassBlock looks for the opening brace only within i..i+3. With a
  // 2-line selector list the brace is on line i+1, which is inside the window.
  it("finds a property when the selector list spans two lines", async () => {
    const filePath = "src/List.module.css";
    await writeFixture(filePath, [
      ".btn,",
      ".alt {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: filePath, className: "btn" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("color: red");
  });

  // BUG: searchClassBlock only looks for the opening brace within i..i+2
  // (`for (j = i; j < i + 3 ...)`). When a selector list pushes the opening
  // brace 3+ lines below the matched selector, blockStart stays on the
  // selector line, the brace is never counted, depth never rises, and the
  // `depth <= 0 && j > blockStart` guard breaks the scan immediately. The
  // class-scoped search finds nothing, so the tiered fallback runs full-file
  // by value and lands on an earlier .decoy block with the same prop+value —
  // the edit is misattributed.
  it("scopes color:blue to .btn when its opening brace is 3 lines below the selector", () => {
    const lines = [
      ".decoy {",     // 0
      "  color: blue;", // 1  full-file picks THIS (wrong block)
      "}",            // 2
      "",             // 3
      ".btn,",        // 4  matched selector
      ".alt,",        // 5
      ".extra,",      // 6
      ".more {",      // 7  opening brace — outside the i..i+2 window
      "  color: blue;", // 8  the CORRECT target line
      "}",            // 9
    ];
    const result = findPropertyInFile(lines, "color", "blue", undefined, "btn");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(8); // must be .btn's block, not .decoy's
  });
});

// -------------------------------------------------------------------------
// 6. Native CSS nesting (& syntax) in a plain .css file.
// -------------------------------------------------------------------------

describe("native CSS nesting (& syntax)", () => {
  // searchNestedPseudoBlock matches `&:hover {` inside `.btn {`. It is
  // file-extension agnostic, so native CSS nesting in a .css file should also
  // be found for state edits.
  it("updates a property in a native-CSS nested &:hover block (.css file)", async () => {
    const filePath = "src/Native.module.css";
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
        prop: "color",
        from: "red",
        to: "green",
        sourceFile: filePath,
        className: "btn",
        state: "hover",
      }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toMatch(/&:hover\s*\{[^}]*color:\s*green/);
    // Base color untouched.
    expect(content).toContain("color: blue");
  });

  // Native nested bare `& { ... }` (no pseudo) — a same-selector nest. We are
  // editing the OUTER class property. The bare `&` block's inner property is a
  // different value; class-scoped search by value should still land correctly.
  it("updates the outer property when block also has a bare & { } nest", async () => {
    const filePath = "src/Amp.module.css";
    await writeFixture(filePath, [
      ".box {",
      "  margin: 4px;",
      "  & {",
      "    margin: 8px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "margin", from: "4px", to: "6px", sourceFile: filePath, className: "box" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("margin: 6px");
    expect(content).toContain("margin: 8px");
  });
});

// -------------------------------------------------------------------------
// 7. Vendor-prefixed properties.
// -------------------------------------------------------------------------

describe("vendor-prefixed properties", () => {
  it("updates a -webkit- prefixed property in a class block", async () => {
    const filePath = "src/Vendor.module.css";
    await writeFixture(filePath, [
      ".clamp {",
      "  -webkit-line-clamp: 2;",
      "  display: -webkit-box;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "-webkit-line-clamp",
        from: "2",
        to: "3",
        sourceFile: filePath,
        className: "clamp",
      }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("-webkit-line-clamp: 3");
  });
});

// -------------------------------------------------------------------------
// 8. findClassBlockEnd vs. brace literals when CREATING a new :hover block.
//    The same char-by-char counter decides where the new state block goes.
// -------------------------------------------------------------------------

describe("findClassBlockEnd / pseudo-create with brace literals", () => {
  // findClassBlockEnd inside an @media wrapper works positionally because the
  // inner `.card {` is where depth first rises. Lock the (correct) behavior:
  // the new flat .card:hover rule is created as a sibling INSIDE the @media.
  it("creates a :hover sibling inside an @media-wrapped class", async () => {
    const filePath = "src/MediaCreate.module.css";
    await writeFixture(filePath, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: blue;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red",
        sourceFile: filePath,
        className: "card",
        state: "hover",
      }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    const hoverIdx = content.indexOf(":hover");
    const lastBrace = content.lastIndexOf("}");
    expect(hoverIdx).toBeGreaterThan(-1);
    // The hover rule lives before the final closing brace (inside @media).
    expect(hoverIdx).toBeLessThan(lastBrace);
  });

  // BUG: findClassBlockEnd uses the same naive brace counter. An unbalanced
  // opening-brace literal (`content: "{"`) means depth never returns to 0, so
  // it returns null. handleCommit then reports the base class "not found" and
  // REFUSES to create the :hover block — the user cannot add any state to a
  // class whose block contains a brace-literal value.
  it("creates a :hover block for a class whose value contains content: \"{\"", async () => {
    const filePath = "src/StrayOpen.module.css";
    await writeFixture(filePath, [
      ".card {",
      '  content: "{";',
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red",
        sourceFile: filePath,
        className: "card",
        state: "hover",
      }],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain(".card:hover");
  });

  // BUG: the mirror case. `content: "}"` makes findClassBlockEnd return early
  // (depth hits 0 at the content line), so the new .card:hover block is spliced
  // into the MIDDLE of the .card block — producing structurally broken CSS with
  // a rule nested inside another rule and an orphaned declaration.
  it("creates a valid (non-nested) :hover block when value contains content: \"}\"", async () => {
    const filePath = "src/StrayClose.module.css";
    await writeFixture(filePath, [
      ".card {",
      '  content: "}";',
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red",
        sourceFile: filePath,
        className: "card",
        state: "hover",
      }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // The created hover rule must come AFTER the base block fully closes —
    // i.e. after the `color: blue` declaration, not spliced before it.
    const colorBlueIdx = content.indexOf("color: blue");
    const hoverIdx = content.indexOf(".card:hover");
    expect(hoverIdx).toBeGreaterThan(-1);
    expect(hoverIdx).toBeGreaterThan(colorBlueIdx);
  });
});

// -------------------------------------------------------------------------
// 9. Empty-line / brace-on-its-own-line and tab indentation robustness.
// -------------------------------------------------------------------------

describe("formatting robustness in brace counting", () => {
  // Opening brace alone on its own line (Allman style). searchClassBlock's
  // window (i..i+2) should catch the brace on line i+1.
  it("handles Allman-style brace on its own line", async () => {
    const filePath = "src/Allman.module.css";
    await writeFixture(filePath, [
      ".panel",
      "{",
      "  color: teal;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "teal", to: "navy", sourceFile: filePath, className: "panel" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("color: navy");
  });

  // Multiple declarations on a single line (minified-ish). The brace counter
  // runs char-by-char, so a one-line rule should still resolve via class search.
  it("handles multiple declarations on one line", async () => {
    const filePath = "src/OneLine.module.css";
    await writeFixture(filePath, [
      ".inline { color: red; padding: 4px; }",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "padding", from: "4px", to: "8px", sourceFile: filePath, className: "inline" }],
      tempDir,
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("padding: 8px");
    expect(content).toContain("color: red");
  });
});
