/**
 * sourceMapCacheStale.test.ts — issue #68 (cache-invalidation half).
 *
 * The source-map LRU cache was keyed solely by compiled path with no
 * mtime/size validation, so after an HMR rebuild rewrote a .map file the
 * cache kept returning the STALE parsed map — resolving saves into whatever
 * the sources list said before the rebuild.
 *
 * Entries must be revalidated against the .map file's mtime/size: unchanged
 * files still hit the cache (same parsed object), changed files re-parse,
 * deleted files stop resolving.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  getSourceMap,
  tryFirstMappedSourceFile,
  clearCache,
} from "../sourceMapCache";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-sourcemap-stale-"));
  clearCache();
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

/** Minimal valid map whose single source is `source`. Content length varies
 *  with the source name, so rewrites always change the file size — the
 *  invalidation must trip even when two writes share an mtime tick. */
function mapWith(source: string): string {
  return JSON.stringify({ version: 3, sources: [source], names: [], mappings: "AAAA" });
}

describe("source map cache invalidation (issue #68)", () => {
  it("re-parses when the .map file changes on disk (HMR rebuild)", async () => {
    const cssPath = join(tempDir, ".next/static/css/app.css");
    await writeFixture(".next/static/css/app.css", "body{}");
    await writeFixture(".next/static/css/app.css.map", mapWith("src/before.css"));

    const first = getSourceMap(cssPath, tempDir);
    expect(first).not.toBeNull();
    expect(first!.sources).toContain("src/before.css");

    // Simulate the HMR rebuild rewriting the map in place.
    await writeFixture(".next/static/css/app.css.map", mapWith("src/after-rebuild.css"));

    const second = getSourceMap(cssPath, tempDir);
    expect(second).not.toBeNull();
    expect(second!.sources).toContain("src/after-rebuild.css");
    expect(second!.sources).not.toContain("src/before.css");
  });

  it("still returns the same parsed object while the file is unchanged", async () => {
    const cssPath = join(tempDir, ".next/static/css/stable.css");
    await writeFixture(".next/static/css/stable.css", "body{}");
    await writeFixture(".next/static/css/stable.css.map", mapWith("src/stable.css"));

    const first = getSourceMap(cssPath, tempDir);
    const second = getSourceMap(cssPath, tempDir);
    expect(first).toBe(second);
  });

  it("tryFirstMappedSourceFile picks up the rewritten map", async () => {
    await writeFixture(".next/static/css/page.css", "body{}");
    await writeFixture(
      ".next/static/css/page.css.map",
      mapWith("../../../app/old.module.css"),
    );

    expect(tryFirstMappedSourceFile("/_next/static/css/page.css", tempDir)).toBe(
      "app/old.module.css",
    );

    await writeFixture(
      ".next/static/css/page.css.map",
      mapWith("../../../app/renamed-by-rebuild.module.css"),
    );

    expect(tryFirstMappedSourceFile("/_next/static/css/page.css", tempDir)).toBe(
      "app/renamed-by-rebuild.module.css",
    );
  });

  it("stops resolving after the .map file is deleted", async () => {
    const cssPath = join(tempDir, ".next/static/css/gone.css");
    await writeFixture(".next/static/css/gone.css", "body{}");
    await writeFixture(".next/static/css/gone.css.map", mapWith("src/gone.css"));

    expect(getSourceMap(cssPath, tempDir)).not.toBeNull();

    await rm(cssPath + ".map");

    expect(getSourceMap(cssPath, tempDir)).toBeNull();
  });
});
