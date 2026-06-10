import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getSourceMap,
  trySourceMapResolution,
  tryFirstMappedSourceFile,
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

// --- Turbopack dev layout (issue #59) ---
//
// Turbopack (the `next dev` default since Next 15) differs from webpack dev in
// three ways the resolver must handle: assets live under .next/dev/… while
// served from /_next/…, maps are SECTIONED ({ sections: [...] }), and sources
// are anchored as turbopack:///[project]/… at the workspace root.

/** A sectioned map in Turbopack's shape: banner line unmapped, one section. */
function turbopackSectionedMap(sources: string[]): string {
  return JSON.stringify({
    version: 3,
    sources: [],
    sections: [
      {
        offset: { line: 1, column: 0 },
        map: { version: 3, sources, names: [], mappings: "AAAA" },
      },
    ],
  });
}

describe("Turbopack dev resolution (issue #59)", () => {
  it("finds maps under .next/dev/ when .next/static does not exist", async () => {
    await writeFixture("app/page.module.scss", ".hero { color: red; }");
    await writeFixture(".next/dev/static/chunks/page.css", "/* banner */\n.x{color:red}");
    await writeFixture(
      ".next/dev/static/chunks/page.css.map",
      turbopackSectionedMap(["turbopack:///[project]/app/page.module.scss"]),
    );

    const result = trySourceMapResolution("/_next/static/chunks/page.css", 2, 0, tempDir);
    expect(result).toEqual({ file: "app/page.module.scss", line: 1 });
  });

  it("parses sectioned maps (TraceMap alone rejects them)", async () => {
    const cssPath = join(tempDir, ".next/dev/static/chunks/sectioned.css");
    await writeFixture(".next/dev/static/chunks/sectioned.css", "/* b */\n.y{}");
    await writeFixture(
      ".next/dev/static/chunks/sectioned.css.map",
      turbopackSectionedMap(["turbopack:///[project]/styles.css"]),
    );
    expect(getSourceMap(cssPath, tempDir)).not.toBeNull();
  });

  it("strips stacked turbopack prefixes, including the collapsed single-slash form", async () => {
    await writeFixture("app/page.module.scss", ".hero {}");
    await writeFixture(".next/dev/static/chunks/stacked.css", "/* b */\n.x{}");
    await writeFixture(
      ".next/dev/static/chunks/stacked.css.map",
      turbopackSectionedMap(["turbopack:///turbopack:/[project]/app/page.module.scss"]),
    );

    const result = trySourceMapResolution("/_next/static/chunks/stacked.css", 2, 0, tempDir);
    expect(result).toEqual({ file: "app/page.module.scss", line: 1 });
  });

  it("anchors [project] sources at an ancestor for nested apps", async () => {
    // Workspace root = tempDir; the Next project = tempDir/test-app. Turbopack
    // anchors [project] at the WORKSPACE root, so the source carries the
    // nested app's directory prefix.
    const appRoot = join(tempDir, "test-app");
    await writeFixture("test-app/app/page.module.scss", ".hero {}");
    await writeFixture("test-app/.next/dev/static/chunks/nested.css", "/* b */\n.x{}");
    await writeFixture(
      "test-app/.next/dev/static/chunks/nested.css.map",
      turbopackSectionedMap(["turbopack:///[project]/test-app/app/page.module.scss"]),
    );

    const result = trySourceMapResolution("/_next/static/chunks/nested.css", 2, 0, appRoot);
    expect(result).toEqual({ file: "app/page.module.scss", line: 1 });
  });

  it("resolves file: URL sources relative to the project root", async () => {
    await writeFixture("app/globals.css", "body {}");
    await writeFixture(".next/dev/static/chunks/glob.css", "/* b */\n.x{}");
    await writeFixture(
      ".next/dev/static/chunks/glob.css.map",
      turbopackSectionedMap([`file://${join(tempDir, "app/globals.css")}`]),
    );

    const result = trySourceMapResolution("/_next/static/chunks/glob.css", 2, 0, tempDir);
    expect(result).toEqual({ file: "app/globals.css", line: 1 });
  });
});

// --- tryFirstMappedSourceFile ---

describe("tryFirstMappedSourceFile", () => {
  it("answers the which-file question even though the banner line is unmapped", async () => {
    await writeFixture("app/page.module.scss", ".hero {}");
    await writeFixture(".next/dev/static/chunks/which.css", "/* b */\n.x{}");
    await writeFixture(
      ".next/dev/static/chunks/which.css.map",
      turbopackSectionedMap(["turbopack:///[project]/app/page.module.scss"]),
    );

    // Sectioned maps leave line 1 outside every section, so a position probe
    // at (1,0) cannot work — the sources list can.
    expect(trySourceMapResolution("/_next/static/chunks/which.css", 1, 0, tempDir)).toBeNull();
    expect(tryFirstMappedSourceFile("/_next/static/chunks/which.css", tempDir)).toBe(
      "app/page.module.scss",
    );
  });

  it("skips bundler-internal sources like [next]", async () => {
    await writeFixture("app/page.module.scss", ".hero {}");
    await writeFixture(".next/dev/static/chunks/internal.css", "/* b */\n.x{}");
    await writeFixture(
      ".next/dev/static/chunks/internal.css.map",
      turbopackSectionedMap([
        "turbopack:///[next]/internal/font/google/geist.css",
        "turbopack:///[project]/app/page.module.scss",
      ]),
    );

    expect(tryFirstMappedSourceFile("/_next/static/chunks/internal.css", tempDir)).toBe(
      "app/page.module.scss",
    );
  });

  it("returns null when no map exists", () => {
    expect(tryFirstMappedSourceFile("/_next/static/css/none.css", tempDir)).toBeNull();
    expect(tryFirstMappedSourceFile(undefined, tempDir)).toBeNull();
  });

  it("works for classic webpack maps too", async () => {
    await writeFixture(".next/static/css/app.css", "body{}");
    await writeFixture(
      ".next/static/css/app.css.map",
      JSON.stringify({
        version: 3,
        // Map-dir-relative source, the same shape the existing
        // trySourceMapResolution tests use.
        sources: ["../../../src/app/globals.css"],
        names: [],
        mappings: "AAAA",
      }),
    );

    expect(tryFirstMappedSourceFile("/_next/static/css/app.css", tempDir)).toBe(
      "src/app/globals.css",
    );
  });
});
