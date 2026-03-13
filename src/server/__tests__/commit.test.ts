import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { findPropertyInFile, resolveSourceFile, handleCommit } from "../commit";

// --- Test helpers ---

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-test-"));
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

// --- findPropertyInFile ---

describe("findPropertyInFile", () => {
  const sampleLines = [
    ".btn {",                      // 0
    "  font-size: 16px;",          // 1
    "  color: #333;",              // 2
    "  padding: 8px 16px;",        // 3
    "}",                           // 4
    "",                            // 5
    ".header {",                   // 6
    "  font-size: 24px;",          // 7
    "  background: #fff;",         // 8
    "}",                           // 9
  ];

  it("finds property at exact sourceLine via window search", () => {
    const result = findPropertyInFile(sampleLines, "font-size", "16px", 1);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(result!.strategy).toBe("window");
  });

  it("finds property in nearby window (+/- 5 lines)", () => {
    const result = findPropertyInFile(sampleLines, "font-size", "16px", 4);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(result!.strategy).toBe("window");
  });

  it("finds property far from sourceLine via full-file search", () => {
    const result = findPropertyInFile(sampleLines, "font-size", "24px", undefined);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(7);
    expect(result!.strategy).toBe("full-file");
  });

  it("finds property inside correct class block via class-scoped search", () => {
    const result = findPropertyInFile(sampleLines, "font-size", "24px", undefined, "header");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(7);
    expect(result!.strategy).toBe("class-block");
  });

  it("class-scoped search disambiguates between same property in different blocks", () => {
    const btnResult = findPropertyInFile(sampleLines, "font-size", "16px", undefined, "btn");
    expect(btnResult).not.toBeNull();
    expect(btnResult!.lineIdx).toBe(1);
    expect(btnResult!.strategy).toBe("class-block");

    const headerResult = findPropertyInFile(sampleLines, "font-size", "24px", undefined, "header");
    expect(headerResult).not.toBeNull();
    expect(headerResult!.lineIdx).toBe(7);
    expect(headerResult!.strategy).toBe("class-block");
  });

  it("finds SCSS variable line via full-file search ($variable pattern)", () => {
    const scssLines = [
      ".card {",
      "  font-size: $font-sm;",
      "  color: blue;",
      "}",
    ];
    // $font-sm matches the SCSS variable pattern in full-file search
    const result = findPropertyInFile(scssLines, "font-size", "14px");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(result!.strategy).toBe("full-file");
  });

  it("finds property via fuzzy search when no value matches at all", () => {
    const scssLines = [
      ".card {",
      "  font-size: calc(100% - 2px);",
      "  color: blue;",
      "}",
    ];
    // calc() has no $ variable, and "14px" won't match — falls to fuzzy
    const result = findPropertyInFile(scssLines, "font-size", "14px");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
    expect(result!.strategy).toBe("fuzzy");
  });

  it("returns null when property is not in file at all", () => {
    const result = findPropertyInFile(sampleLines, "z-index", "10");
    expect(result).toBeNull();
  });

  it("handles CSS custom properties in :root block", () => {
    const rootLines = [
      ":root {",
      "  --color-primary: #E8764B;",
      "  --font-size-sm: 14px;",
      "}",
      "",
      ".btn {",
      "  color: var(--color-primary);",
      "}",
    ];
    const result = findPropertyInFile(rootLines, "--color-primary", "#E8764B");
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(1);
  });

  it("skips sourceLine=0 and falls through to broader search", () => {
    const result = findPropertyInFile(sampleLines, "background", "#fff", 0);
    expect(result).not.toBeNull();
    expect(result!.lineIdx).toBe(8);
    expect(result!.strategy).toBe("full-file");
  });
});

// --- resolveSourceFile ---

describe("resolveSourceFile", () => {
  it("resolves a full relative path directly", async () => {
    await writeFixture("src/components/Button.module.scss", ".btn { color: red; }");
    const result = await resolveSourceFile(tempDir, "src/components/Button.module.scss");
    expect(result).toBe(join(tempDir, "src/components/Button.module.scss"));
  });

  it("finds a bare filename via recursive search", async () => {
    await writeFixture("src/components/Button.module.scss", ".btn { color: red; }");
    const result = await resolveSourceFile(tempDir, "Button.module.scss");
    expect(result).toBe(join(tempDir, "src/components/Button.module.scss"));
  });

  it("uses component name hint to find the right file", async () => {
    await writeFixture("src/Button.module.scss", ".btn { color: red; }");
    const result = await resolveSourceFile(tempDir, "NonExistent.module.scss", "Button");
    expect(result).toBe(join(tempDir, "src/Button.module.scss"));
  });

  it("returns null for non-existent file", async () => {
    const result = await resolveSourceFile(tempDir, "DoesNotExist.module.scss");
    expect(result).toBeNull();
  });

  it("excludes node_modules from search", async () => {
    await writeFixture("node_modules/pkg/Button.module.scss", ".btn { color: red; }");
    const result = await resolveSourceFile(tempDir, "Button.module.scss");
    expect(result).toBeNull();
  });

  it("prefers component-name path when multiple matches exist", async () => {
    await writeFixture("src/components/Button/Button.module.scss", ".btn {}");
    await writeFixture("src/other/Button.module.scss", ".btn {}");
    const result = await resolveSourceFile(tempDir, "Button.module.scss", "Button");
    expect(result).toBeTruthy();
    expect(result!).toContain("Button");
  });
});

// --- handleCommit (integration) ---

describe("handleCommit", () => {
  it("writes a single change with good source info", async () => {
    const filePath = "src/Button.module.scss";
    await writeFixture(filePath, [
      ".btn {",
      "  font-size: 16px;",
      "  color: #333;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "16px",
        to: "18px",
        sourceFile: filePath,
        sourceLine: 1,
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 18px");
    expect(content).not.toContain("font-size: 16px");
  });

  it("finds and writes via full-file search when sourceLine is undefined", async () => {
    const filePath = "src/Page.module.scss";
    await writeFixture(filePath, [
      ".wrapper {",
      "  max-width: 1200px;",
      "}",
      "",
      ".title {",
      "  font-size: 32px;",
      "  color: navy;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "32px",
        to: "28px",
        sourceFile: filePath,
        sourceLine: undefined,
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 28px");
  });

  it("resolves bare filenames via recursive search", async () => {
    await writeFixture("src/components/Card.module.scss", [
      ".card {",
      "  padding: 16px;",
      "  border-radius: 8px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding",
        from: "16px",
        to: "24px",
        sourceFile: "Card.module.scss",
        componentName: "Card",
      }],
      tempDir
    );

    expect(result.written).toContain("Card.module.scss");
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, "src/components/Card.module.scss"), "utf-8");
    expect(content).toContain("padding: 24px");
  });

  it("reports SCSS variable changes as failed with variable name", async () => {
    const filePath = "src/Button.module.scss";
    await writeFixture(filePath, [
      ".btn {",
      "  font-size: $font-sm;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "14px",
        to: "16px",
        sourceFile: filePath,
      }],
      tempDir
    );

    // full-file search finds the line (SCSS $variable matches),
    // fuzzy guard detects $font-sm and refuses to overwrite
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("$font-sm");
    expect(result.failed[0].reason).toContain("manual edit");
  });

  it("does not overwrite SCSS variable when found via fuzzy search", async () => {
    const filePath = "src/Card.module.scss";
    const original = [
      ".card {",
      "  padding: $spacing-md;",
      "  color: blue;",
      "}",
    ].join("\n");
    await writeFixture(filePath, original);

    const result = await handleCommit(
      [{
        prop: "padding",
        from: "16px",
        to: "24px",
        sourceFile: filePath,
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("$spacing-md");

    // Verify the file was NOT modified
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toBe(original);
  });

  it("batches multiple changes to the same file into a single write", async () => {
    const filePath = "src/Button.module.scss";
    await writeFixture(filePath, [
      ".btn {",
      "  font-size: 16px;",
      "  padding: 8px 16px;",
      "  color: #333;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [
        { prop: "font-size", from: "16px", to: "18px", sourceFile: filePath },
        { prop: "color", from: "#333", to: "#000", sourceFile: filePath },
      ],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.written).toHaveLength(1);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 18px");
    expect(content).toContain("color: #000");
    expect(content).toContain("padding: 8px 16px");
  });

  it("reports all changes as failed when file is not found", async () => {
    const result = await handleCommit(
      [
        { prop: "font-size", from: "16px", to: "18px", sourceFile: "NonExistent.module.scss" },
        { prop: "color", from: "#333", to: "#000", sourceFile: "NonExistent.module.scss" },
      ],
      tempDir
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(2);
    expect(result.failed[0].reason).toContain("not found");
  });

  it("fails changes with no sourceFile specified", async () => {
    const result = await handleCommit(
      [{ prop: "font-size", from: "16px", to: "18px" }],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("no source file");
  });

  it("handles hex color in source when from value is computed rgb()", async () => {
    const filePath = "src/Badge.module.css";
    await writeFixture(filePath, [
      ".badge {",
      "  background-color: #eef2ff;",
      "  color: #6366f1;",
      "  font-size: 13px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "background-color",
        // getComputedStyle returns rgb(), but source has hex
        from: "rgb(238, 242, 255)",
        to: "rgb(200, 210, 255)",
        sourceFile: filePath,
        className: "badge",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("background-color: rgb(200, 210, 255)");
  });

  it("handles CSS var() in source when from value is computed", async () => {
    const filePath = "src/Page.module.css";
    await writeFixture(filePath, [
      ".page {",
      "  --accent: #6366f1;",
      "}",
      "",
      ".badge {",
      "  color: var(--accent);",
      "  font-size: 13px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        // getComputedStyle resolves var(--accent) to the computed rgb value
        from: "rgb(99, 102, 241)",
        to: "rgb(255, 0, 0)",
        sourceFile: filePath,
        className: "badge",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("color: rgb(255, 0, 0)");
  });

  it("class-scoped change writes to the correct class block, not other blocks with same property", async () => {
    const filePath = "src/Page.module.scss";
    await writeFixture(filePath, [
      ".title {",
      "  font-size: 32px;",
      "  color: navy;",
      "}",
      "",
      ".subtitle {",
      "  font-size: 18px;",
      "  color: gray;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "font-size", from: "18px", to: "20px", sourceFile: filePath, className: "subtitle" }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // subtitle block updated
    expect(content).toContain("font-size: 20px");
    // title block preserved
    expect(content).toContain("font-size: 32px");
    // other properties in both blocks untouched
    expect(content).toContain("color: navy");
    expect(content).toContain("color: gray");
  });

  it("element-scoped change (no className) uses sourceLine, not class block", async () => {
    const filePath = "src/Component.module.scss";
    await writeFixture(filePath, [
      ".wrapper {",
      "  padding: 16px;",
      "}",
      "",
      ".inner {",
      "  padding: 8px;",
      "}",
    ].join("\n"));

    // Element scope: no className provided, sourceLine points to .wrapper block
    const result = await handleCommit(
      [{ prop: "padding", from: "16px", to: "24px", sourceFile: filePath, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // .wrapper updated (via window search at sourceLine)
    expect(content).toContain("padding: 24px");
    // .inner preserved
    expect(content).toContain("padding: 8px");
  });

  it("resolves a global CSS file by bare filename", async () => {
    await writeFixture("app/globals.css", [
      "body {",
      "  font-family: sans-serif;",
      "  margin: 0;",
      "}",
    ].join("\n"));

    const result = await resolveSourceFile(tempDir, "globals.css");
    expect(result).toBe(join(tempDir, "app/globals.css"));
  });

  it("handleCommit writes to global CSS files", async () => {
    const filePath = "app/globals.css";
    await writeFixture(filePath, [
      "body {",
      "  font-size: 16px;",
      "  color: #333;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "16px",
        to: "18px",
        sourceFile: filePath,
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 18px");
  });

  it("class-scoped change targets correct block when multiple class blocks exist", async () => {
    const filePath = "src/Buttons.module.css";
    await writeFixture(filePath, [
      ".btn {",
      "  color: red;",
      "  padding: 8px;",
      "}",
      "",
      ".card {",
      "  color: blue;",
      "  padding: 16px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{ prop: "color", from: "red", to: "green", sourceFile: filePath, className: "btn" }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // .btn block was modified
    expect(content).toContain("color: green");
    // .card block was NOT modified
    expect(content).toContain("color: blue");
    // Other properties in both blocks are untouched
    expect(content).toContain("padding: 8px");
    expect(content).toContain("padding: 16px");
  });

  it("element-scoped change without className skips class block search", async () => {
    const filePath = "src/Layout.module.css";
    await writeFixture(filePath, [
      ".btn {",
      "  color: red;",
      "}",
      "",
      ".header {",
      "  color: red;",
      "}",
    ].join("\n"));

    // Element-scoped: no className, sourceLine points to .btn block (line 1)
    const result = await handleCommit(
      [{ prop: "color", from: "red", to: "purple", sourceFile: filePath, sourceLine: 1 }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Window search found .btn's color (near sourceLine 1) and changed it
    expect(content).toMatch(/\.btn\s*\{[^}]*color:\s*purple/);
    // .header's color was NOT modified — element scope used window search, not class block
    expect(content).toMatch(/\.header\s*\{[^}]*color:\s*red/);
  });

  it("uses className for class-scoped search to find correct block", async () => {
    const filePath = "src/Page.module.scss";
    await writeFixture(filePath, [
      ".title {",
      "  font-size: 32px;",
      "}",
      "",
      ".subtitle {",
      "  font-size: 18px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "18px",
        to: "20px",
        sourceFile: filePath,
        className: "subtitle",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("font-size: 20px");
    expect(content).toContain("font-size: 32px");
  });
});

// --- Pseudo-class (state) commit ---

describe("handleCommit — pseudo-class state", () => {
  it("finds and writes inside an existing .className:hover { } block", async () => {
    const filePath = "src/Button.module.css";
    await writeFixture(filePath, [
      ".btn {",
      "  color: blue;",
      "  font-size: 16px;",
      "}",
      "",
      ".btn:hover {",
      "  color: red;",
      "  font-size: 18px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "font-size",
        from: "18px",
        to: "20px",
        sourceFile: filePath,
        className: "btn",
        state: "hover",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Hover block updated
    expect(content).toContain(".btn:hover {");
    // The base block should NOT be modified
    expect(content).toMatch(/\.btn\s*\{[^}]*font-size:\s*16px/);
    // The hover block should have the new value
    expect(content).toMatch(/\.btn:hover\s*\{[^}]*font-size:\s*20px/);
  });

  it("creates a new .className:hover { } block when none exists", async () => {
    const filePath = "src/Card.module.css";
    await writeFixture(filePath, [
      ".card {",
      "  color: blue;",
      "  font-size: 16px;",
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
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Base block untouched
    expect(content).toMatch(/\.card\s*\{[^}]*color:\s*blue/);
    // New hover block appended
    expect(content).toContain(".card:hover {");
    expect(content).toContain("color: red;");
  });

  it("does not confuse base class block with pseudo-class block", async () => {
    const filePath = "src/Link.module.css";
    await writeFixture(filePath, [
      ".link {",
      "  color: blue;",
      "}",
      "",
      ".link:hover {",
      "  color: red;",
      "}",
    ].join("\n"));

    // Change hover color — should NOT touch the base block's color
    const result = await handleCommit(
      [{
        prop: "color",
        from: "red",
        to: "green",
        sourceFile: filePath,
        className: "link",
        state: "hover",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Base .link has "color: blue" — must be untouched
    expect(content).toMatch(/\.link\s*\{[^}]*color:\s*blue/);
    // Hover .link:hover updated to green
    expect(content).toMatch(/\.link:hover\s*\{[^}]*color:\s*green/);
  });

  it("appends new hover block after base class, preserving other blocks", async () => {
    const filePath = "src/Nav.module.css";
    await writeFixture(filePath, [
      ".navItem {",
      "  color: gray;",
      "}",
      "",
      ".navBrand {",
      "  font-weight: bold;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "gray",
        to: "blue",
        sourceFile: filePath,
        className: "navItem",
        state: "hover",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Base block untouched
    expect(content).toMatch(/\.navItem\s*\{[^}]*color:\s*gray/);
    // New hover block exists
    expect(content).toContain(".navItem:hover {");
    expect(content).toContain("color: blue;");
    // Other blocks preserved
    expect(content).toContain(".navBrand {");
    expect(content).toContain("font-weight: bold;");
  });

  it("handles :focus state the same way as :hover", async () => {
    const filePath = "src/Input.module.css";
    await writeFixture(filePath, [
      ".input {",
      "  border-color: gray;",
      "}",
      "",
      ".input:focus {",
      "  border-color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "border-color",
        from: "blue",
        to: "green",
        sourceFile: filePath,
        className: "input",
        state: "focus",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toMatch(/\.input:focus\s*\{[^}]*border-color:\s*green/);
    expect(content).toMatch(/\.input\s*\{[^}]*border-color:\s*gray/);
  });
});

// --- SCSS nested pseudo-class ---

describe("handleCommit — SCSS nested pseudo-class", () => {
  it("finds and updates property inside nested &:hover block", async () => {
    const filePath = "src/Button.module.scss";
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
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("color: green");
    // Base block untouched
    expect(content).toMatch(/\.btn\s*\{[^&]*color:\s*blue/);
  });

  it("finds and updates property inside nested &:focus block", async () => {
    const filePath = "src/Input.module.scss";
    await writeFixture(filePath, [
      ".input {",
      "  border: 1px solid gray;",
      "  &:focus {",
      "    border: 2px solid blue;",
      "  }",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "border",
        from: "2px solid blue",
        to: "2px solid green",
        sourceFile: filePath,
        className: "input",
        state: "focus",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("border: 2px solid green");
    expect(content).toContain("border: 1px solid gray");
  });

  it("creates nested &:hover block inside parent when file uses SCSS nesting", async () => {
    const filePath = "src/Nav.module.scss";
    await writeFixture(filePath, [
      ".other {",
      "  &:focus { outline: none; }",
      "}",
      "",
      ".btn {",
      "  color: blue;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "blue",
        to: "red",
        sourceFile: filePath,
        className: "btn",
        state: "hover",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // Nested block should be inside .btn { ... }
    expect(content).toContain("&:hover {");
    expect(content).toContain("color: red;");
    // Base block preserved
    expect(content).toMatch(/\.btn\s*\{[^}]*color:\s*blue/);
  });

  it("flat pseudo-class search still works (regression)", async () => {
    const filePath = "src/Link.module.css";
    await writeFixture(filePath, [
      ".link {",
      "  color: blue;",
      "}",
      "",
      ".link:hover {",
      "  color: red;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "color",
        from: "red",
        to: "green",
        sourceFile: filePath,
        className: "link",
        state: "hover",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toMatch(/\.link:hover\s*\{[^}]*color:\s*green/);
    expect(content).toMatch(/\.link\s*\{[^}]*color:\s*blue/);
  });
});

// --- Shorthand property fallback ---

describe("handleCommit — shorthand fallback", () => {
  it("rewrites 2-value padding shorthand when changing padding-top", async () => {
    const filePath = "src/Card.module.scss";
    await writeFixture(filePath, [
      ".card {",
      "  padding: 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-top",
        from: "16px",
        to: "12px",
        sourceFile: filePath,
        className: "card",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("padding: 12px 24px");
  });

  it("expands uniform padding when changing one side", async () => {
    const filePath = "src/Box.module.scss";
    await writeFixture(filePath, [
      ".box {",
      "  padding: 16px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-left",
        from: "16px",
        to: "24px",
        sourceFile: filePath,
        className: "box",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("padding: 16px 16px 16px 24px");
  });

  it("rewrites 3-value margin shorthand", async () => {
    const filePath = "src/Section.module.scss";
    await writeFixture(filePath, [
      ".section {",
      "  margin: 8px 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "margin-bottom",
        from: "24px",
        to: "32px",
        sourceFile: filePath,
        className: "section",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("margin: 8px 16px 32px");
  });

  it("rewrites 4-value margin shorthand", async () => {
    const filePath = "src/Widget.module.scss";
    await writeFixture(filePath, [
      ".widget {",
      "  margin: 8px 16px 24px 32px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "margin-right",
        from: "16px",
        to: "20px",
        sourceFile: filePath,
        className: "widget",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("margin: 8px 20px 24px 32px");
  });

  it("rewrites border-radius shorthand", async () => {
    const filePath = "src/Chip.module.scss";
    await writeFixture(filePath, [
      ".chip {",
      "  border-radius: 8px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "border-top-left-radius",
        from: "8px",
        to: "12px",
        sourceFile: filePath,
        className: "chip",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // TL=12, TR=8, BR=8, BL=8 → right=left so 3-value form
    expect(content).toContain("border-radius: 12px 8px 8px");
  });

  it("rewrites gap shorthand", async () => {
    const filePath = "src/Grid.module.scss";
    await writeFixture(filePath, [
      ".grid {",
      "  gap: 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "row-gap",
        from: "16px",
        to: "20px",
        sourceFile: filePath,
        className: "grid",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("gap: 20px 24px");
  });

  it("bails gracefully when shorthand uses SCSS variable", async () => {
    const filePath = "src/Spaced.module.scss";
    await writeFixture(filePath, [
      ".spaced {",
      "  padding: $spacing-md;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-top",
        from: "16px",
        to: "24px",
        sourceFile: filePath,
        className: "spaced",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("not found");
  });

  it("bails when sub-value does not match from value", async () => {
    const filePath = "src/Mismatch.module.scss";
    await writeFixture(filePath, [
      ".mismatch {",
      "  padding: 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-top",
        from: "99px",
        to: "12px",
        sourceFile: filePath,
        className: "mismatch",
      }],
      tempDir
    );

    expect(result.failed).toHaveLength(1);
  });

  it("targets correct class block when multiple blocks have same shorthand", async () => {
    const filePath = "src/Multi.module.scss";
    await writeFixture(filePath, [
      ".header {",
      "  padding: 8px 12px;",
      "}",
      "",
      ".footer {",
      "  padding: 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-top",
        from: "16px",
        to: "12px",
        sourceFile: filePath,
        className: "footer",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    // .footer updated
    expect(content).toContain("padding: 12px 24px");
    // .header untouched
    expect(content).toContain("padding: 8px 12px");
  });

  it("collapses to single value when all sides become equal", async () => {
    const filePath = "src/Collapse.module.scss";
    await writeFixture(filePath, [
      ".collapse {",
      "  padding: 16px 16px 16px 24px;",
      "}",
    ].join("\n"));

    const result = await handleCommit(
      [{
        prop: "padding-left",
        from: "24px",
        to: "16px",
        sourceFile: filePath,
        className: "collapse",
      }],
      tempDir
    );

    expect(result.written).toContain(filePath);
    expect(result.failed).toHaveLength(0);

    const content = await readFile(join(tempDir, filePath), "utf-8");
    expect(content).toContain("padding: 16px;");
  });
});
