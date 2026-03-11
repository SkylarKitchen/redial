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

  it("reports SCSS variable changes as failed gracefully", async () => {
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
    // but the literal replacement fails since "14px" isn't in the source
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("not found literally");
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
