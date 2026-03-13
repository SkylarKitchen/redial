import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getSourceMap,
  trySourceMapResolution,
  clearCache,
  cacheSize,
} from "../sourceMapCache";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-sourcemap-test-"));
  clearCache();
});

// Clean up after all tests
import { afterEach } from "vitest";
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

// --- getSourceMap ---

describe("getSourceMap", () => {
  it("returns null for non-existent .map file", () => {
    const result = getSourceMap("/does/not/exist.css", tempDir);
    expect(result).toBeNull();
  });

  it("parses a valid source map file", async () => {
    const cssPath = join(tempDir, "test.css");
    await writeFixture("test.css", "body { color: red; }");
    await writeFixture("test.css.map", JSON.stringify({
      version: 3,
      sources: ["../../src/app/globals.css"],
      names: [],
      mappings: "AAAA;AACA",
    }));

    const result = getSourceMap(cssPath, tempDir);
    expect(result).not.toBeNull();
    expect(result!.sources).toContain("../../src/app/globals.css");
  });

  it("returns null for malformed source map", async () => {
    const cssPath = join(tempDir, "bad.css");
    await writeFixture("bad.css", "body { color: red; }");
    await writeFixture("bad.css.map", "this is not valid json{{{");

    const result = getSourceMap(cssPath, tempDir);
    expect(result).toBeNull();
  });

  it("caches parsed source maps on repeated calls", async () => {
    const cssPath = join(tempDir, "cached.css");
    await writeFixture("cached.css", "body { color: red; }");
    await writeFixture("cached.css.map", JSON.stringify({
      version: 3,
      sources: ["src/styles.css"],
      names: [],
      mappings: "AAAA",
    }));

    const first = getSourceMap(cssPath, tempDir);
    const second = getSourceMap(cssPath, tempDir);
    // Same object reference — came from cache
    expect(first).toBe(second);
  });
});

// --- LRU cache eviction ---

describe("LRU cache", () => {
  it("evicts oldest entry when max size (50) is exceeded", async () => {
    // Fill cache with 50 entries
    for (let i = 0; i < 50; i++) {
      const cssPath = join(tempDir, `file${i}.css`);
      await writeFixture(`file${i}.css`, `body { color: red; }`);
      await writeFixture(`file${i}.css.map`, JSON.stringify({
        version: 3,
        sources: [`src/file${i}.css`],
        names: [],
        mappings: "AAAA",
      }));
      getSourceMap(cssPath, tempDir);
    }

    expect(cacheSize()).toBe(50);

    // Add one more — should evict the oldest (file0)
    const extraPath = join(tempDir, "extra.css");
    await writeFixture("extra.css", "body { color: blue; }");
    await writeFixture("extra.css.map", JSON.stringify({
      version: 3,
      sources: ["src/extra.css"],
      names: [],
      mappings: "AAAA",
    }));
    getSourceMap(extraPath, tempDir);

    expect(cacheSize()).toBe(50);
  });

  it("clearCache empties the cache", async () => {
    const cssPath = join(tempDir, "clear.css");
    await writeFixture("clear.css", "body {}");
    await writeFixture("clear.css.map", JSON.stringify({
      version: 3,
      sources: ["src/clear.css"],
      names: [],
      mappings: "AAAA",
    }));
    getSourceMap(cssPath, tempDir);
    expect(cacheSize()).toBe(1);

    clearCache();
    expect(cacheSize()).toBe(0);
  });
});

// --- trySourceMapResolution ---

describe("trySourceMapResolution", () => {
  it("returns null when no cssHref provided", () => {
    const result = trySourceMapResolution(undefined, 1, 0, tempDir);
    expect(result).toBeNull();
  });

  it("returns null when .map file does not exist for href", () => {
    const result = trySourceMapResolution(
      "/_next/static/css/nonexistent.css",
      1,
      0,
      tempDir,
    );
    expect(result).toBeNull();
  });

  it("resolves source file + line from a valid source map", async () => {
    // Create the .next/static/css/ directory structure
    const mapContent = JSON.stringify({
      version: 3,
      sources: ["../../../src/app/globals.css"],
      names: [],
      // "AAAA" maps line 1, col 0 → source 0, line 1, col 0
      mappings: "AAAA",
    });

    await writeFixture(".next/static/css/app.css", "body { color: red; }");
    await writeFixture(".next/static/css/app.css.map", mapContent);

    const result = trySourceMapResolution(
      "/_next/static/css/app.css",
      1,
      0,
      tempDir,
    );

    expect(result).not.toBeNull();
    expect(result!.file).toContain("globals.css");
    expect(result!.line).toBe(1);
  });

  it("handles full URL hrefs (strips to pathname)", async () => {
    const mapContent = JSON.stringify({
      version: 3,
      sources: ["../../../src/styles.css"],
      names: [],
      mappings: "AAAA",
    });

    await writeFixture(".next/static/css/styles.css", "h1 { font-size: 2rem; }");
    await writeFixture(".next/static/css/styles.css.map", mapContent);

    const result = trySourceMapResolution(
      "http://localhost:3000/_next/static/css/styles.css",
      1,
      0,
      tempDir,
    );

    expect(result).not.toBeNull();
    expect(result!.file).toContain("styles.css");
  });
});
