/**
 * Breakpoint file-save coverage (issue #53) — closes the clipboard-only gap.
 *
 * Historically a change carrying a responsive breakpoint was dropped from the
 * commit payload entirely (clipboard side-channel only). These tests pin the
 * server half of the file-save path: a change with a
 * `breakpoint: { id, minWidth }` field is written INSIDE the matching
 * `@media (min-width: Npx)` block —
 *  - declaration replaced when the media block already has a matching rule
 *    (multi-line AND minified single-line, confined to the target block so an
 *    identical sibling declaration outside the media block is untouched);
 *  - rule created inside the media block when the block exists but has no
 *    rule for the class;
 *  - whole media block created at EOF (blank-line separated, file indent
 *    conventions) when no matching block exists — inserted in ascending
 *    min-width order relative to a trailing run of media blocks;
 *  - condition matching tolerates spacing variants and em-equivalents (×16),
 *    but new blocks are always WRITTEN in the px form from the payload;
 *  - media-nested pseudo (`.cls:hover` inside `@media`) replace/insert/create;
 *  - a malformed `breakpoint` field fails per-item (never a 500);
 *  - re-saving the same change is idempotent (no duplicate blocks/decls).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit, type CommitChange } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-bp-commit-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<void> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

async function readFixture(relativePath: string): Promise<string> {
  return readFile(join(tempDir, relativePath), "utf-8");
}

const bpChange = (over: Partial<CommitChange> = {}): CommitChange => ({
  prop: "color",
  from: "green",
  to: "red",
  sourceFile: "src/Card.module.css",
  className: "card",
  breakpoint: { id: "768", minWidth: 768 },
  ...over,
});

// ---------------------------------------------------------------------------
// Replace inside an existing media block
// ---------------------------------------------------------------------------

describe("replace inside an existing @media block", () => {
  it("replaces the declaration in the matching min-width block, leaving the base rule alone", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: green;",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: green;",
      "  }",
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(file);
    const content = await readFixture(file);
    expect(content).toBe([
      ".card {",
      "  color: green;", // base rule untouched
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: red;",
      "  }",
      "}",
      "",
    ].join("\n"));
  });

  it("confines a minified same-line replacement to the media block's body", async () => {
    const file = "src/Card.module.css";
    // Base and media rules share ONE physical line with IDENTICAL declarations.
    await writeFixture(
      file,
      ".card{color:green}@media (min-width: 768px){.card{color:green}}",
    );

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe(
      ".card{color:green}@media (min-width: 768px){.card{color:red}}",
    );
  });

  it("rewrites via broad match when the authored value representation differs from `from`", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: #00ff00;", // hex, client sent computed "green"
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain("color: red;");
    expect(content).not.toContain("#00ff00");
  });

  it("inserts the declaration when the media rule exists but never authored the prop", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    gap: 8px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ prop: "padding", from: "0px", to: "24px" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe([
      "@media (min-width: 768px) {",
      "  .card {",
      "    gap: 8px;",
      "    padding: 24px;",
      "  }",
      "}",
    ].join("\n"));
  });
});

// ---------------------------------------------------------------------------
// Condition-matching tolerance
// ---------------------------------------------------------------------------

describe("media condition matching tolerance", () => {
  it("matches a spacing variant `(min-width:768px)`", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width:768px){",
      "  .card { color: green; }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain("color: red;");
    // No NEW block was appended — the variant-spaced block was recognized.
    expect(content.match(/@media/g)).toHaveLength(1);
  });

  it("matches an em-equivalent condition (48em × 16 = 768px) without creating a new block", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 48em) {",
      "  .card { color: green; }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain("color: red;");
    expect(content).toContain("(min-width: 48em)"); // author's units untouched
    expect(content).not.toContain("(min-width: 768px)"); // no duplicate block
  });

  it("does NOT write into a range band (`min-width and max-width`)", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 768px) and (max-width: 1023px) {",
      "  .card { color: green; }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    // The band keeps its value; a NEW pure min-width block carries the edit.
    expect(content).toContain("@media (min-width: 768px) and (max-width: 1023px) {\n  .card { color: green; }\n}");
    expect(content).toContain("@media (min-width: 768px) {");
    expect(content).toContain("color: red;");
  });
});

// ---------------------------------------------------------------------------
// Rule creation inside an existing media block
// ---------------------------------------------------------------------------

describe("rule creation inside an existing @media block", () => {
  it("creates the class rule inside the matching block when only other rules live there", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: blue;",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .hero {",
      "    gap: 8px;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ prop: "padding", from: "0px", to: "24px" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe([
      ".card {",
      "  color: blue;",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .hero {",
      "    gap: 8px;",
      "  }",
      "",
      "  .card {",
      "    padding: 24px;",
      "  }",
      "}",
    ].join("\n"));
  });

  it("prefers the matching media block that already contains the class rule", async () => {
    const file = "src/Card.module.css";
    // TWO blocks for the same min-width; only the second has .card.
    await writeFixture(file, [
      "@media (min-width: 768px) {",
      "  .hero { gap: 8px; }",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card { color: green; }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange()], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain(".card { color: red; }");
    // No .card rule was created in the first block.
    expect(content.indexOf(".card")).toBe(content.lastIndexOf(".card"));
  });
});

// ---------------------------------------------------------------------------
// Whole-media-block creation at EOF + ordering
// ---------------------------------------------------------------------------

describe("media block creation", () => {
  it("appends a new @media block at EOF, blank-line separated, in the file's indent", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: blue;",
      "}",
      "",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ breakpoint: { id: "640", minWidth: 640 }, from: "blue" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe([
      ".card {",
      "  color: blue;",
      "}",
      "",
      "@media (min-width: 640px) {",
      "  .card {",
      "    color: red;",
      "  }",
      "}",
      "",
    ].join("\n"));
    expect(content).not.toContain("!important");
  });

  it("uses the file's tab indentation for a created block", async () => {
    const file = "src/Tab.module.css";
    await writeFixture(file, [
      ".card {",
      "\tcolor: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ sourceFile: file, from: "blue" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain("@media (min-width: 768px) {\n\t.card {\n\t\tcolor: red;\n\t}\n}");
  });

  it("inserts a new block in ascending min-width order within a trailing media run", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: blue;",
      "}",
      "",
      "@media (min-width: 640px) {",
      "  .card { gap: 4px; }",
      "}",
      "",
      "@media (min-width: 1024px) {",
      "  .card { gap: 12px; }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ prop: "gap", from: "4px", to: "8px" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    const i640 = content.indexOf("(min-width: 640px)");
    const i768 = content.indexOf("(min-width: 768px)");
    const i1024 = content.indexOf("(min-width: 1024px)");
    expect(i640).toBeGreaterThanOrEqual(0);
    expect(i768).toBeGreaterThan(i640);
    expect(i1024).toBeGreaterThan(i768);
    expect(content).toContain("gap: 8px;");
    // Existing blocks untouched.
    expect(content).toContain(".card { gap: 4px; }");
    expect(content).toContain(".card { gap: 12px; }");
  });

  it("appends at EOF (never reorders) when author rules follow the media blocks", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 1024px) {",
      "  .card { gap: 12px; }",
      "}",
      "",
      ".footer {",
      "  color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ prop: "gap", from: "0px", to: "8px" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    // The .footer author rule was not displaced…
    const iFooter = content.indexOf(".footer");
    const i768 = content.indexOf("(min-width: 768px)");
    expect(i768).toBeGreaterThan(iFooter);
    // …and the 1024 block was not moved.
    expect(content.indexOf("(min-width: 1024px)")).toBeLessThan(iFooter);
  });
});

// ---------------------------------------------------------------------------
// Media-nested pseudo-state
// ---------------------------------------------------------------------------

describe("pseudo-state inside @media", () => {
  it("replaces a declaration inside `.cls:hover` within the media block", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card:hover {",
      "  color: green;",
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card:hover {",
      "    color: green;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange({ state: "hover" })], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe([
      ".card:hover {",
      "  color: green;", // base pseudo untouched
      "}",
      "",
      "@media (min-width: 768px) {",
      "  .card:hover {",
      "    color: red;",
      "  }",
      "}",
    ].join("\n"));
  });

  it("creates a `.cls:hover` block inside the media block after the base rule", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: green;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [bpChange({ state: "hover", from: "green", to: "red" })],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toBe([
      "@media (min-width: 768px) {",
      "  .card {",
      "    color: green;",
      "  }",
      "",
      "  .card:hover {",
      "    color: red;",
      "  }",
      "}",
    ].join("\n"));
  });

  it("creates a whole media block with the pseudo selector when none matches", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit([bpChange({ state: "hover" })], tempDir);

    expect(result.failed).toHaveLength(0);
    const content = await readFixture(file);
    expect(content).toContain([
      "@media (min-width: 768px) {",
      "  .card:hover {",
      "    color: red;",
      "  }",
      "}",
    ].join("\n"));
  });

  it("rejects a state not on the allowlist (CSS injection guard)", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, ".card { color: green; }");

    const result = await handleCommit(
      [bpChange({ state: "hover{}.evil" })],
      tempDir,
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/state/);
  });
});

// ---------------------------------------------------------------------------
// Validation + idempotence
// ---------------------------------------------------------------------------

describe("breakpoint payload validation", () => {
  it("fails per-item (not 500) for a malformed breakpoint field, still writing the valid sibling", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: green;",
      "}",
    ].join("\n"));

    const malformed = {
      prop: "gap",
      from: "0px",
      to: "8px",
      sourceFile: file,
      className: "card",
      breakpoint: "768", // wrong shape: string, not { id, minWidth }
    } as unknown as CommitChange;

    const result = await handleCommit(
      [malformed, { prop: "color", from: "green", to: "red", sourceFile: file, className: "card" }],
      tempDir,
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/malformed/i);
    expect(result.written).toContain(file);
    const content = await readFixture(file);
    expect(content).toContain("color: red;");
    expect(content).not.toContain("gap: 8px");
  });

  it("fails per-item for a non-finite minWidth", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, ".card { color: green; }");

    const malformed = {
      ...bpChange(),
      breakpoint: { id: "768", minWidth: Infinity },
    } as unknown as CommitChange;

    const result = await handleCommit([malformed], tempDir);

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/malformed/i);
  });

  it("fails accurately when a breakpoint change carries no class info", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, ".card { color: green; }");

    const result = await handleCommit(
      [bpChange({ className: undefined })],
      tempDir,
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/class/i);
    expect(await readFixture(file)).toBe(".card { color: green; }");
  });

  it("re-saving the same breakpoint change is idempotent", async () => {
    const file = "src/Card.module.css";
    await writeFixture(file, [
      ".card {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const first = await handleCommit([bpChange({ from: "blue" })], tempDir);
    expect(first.failed).toHaveLength(0);
    const afterFirst = await readFixture(file);

    // Same change again — the client's `from` is still the ORIGINAL value.
    const second = await handleCommit([bpChange({ from: "blue" })], tempDir);
    expect(second.failed).toHaveLength(0);
    const afterSecond = await readFixture(file);

    expect(afterSecond).toBe(afterFirst);
    expect(afterSecond.match(/@media/g)).toHaveLength(1);
    expect(afterSecond.match(/color: red;/g)).toHaveLength(1);
  });
});
