/**
 * commitTailwindClassCache.test.ts — className→file memo for the Turbopack
 * fallback walk (issue #43).
 *
 * The cache is a pure optimization: it must never change WHICH file is chosen.
 * These tests lock the two correctness properties that make that true —
 *   1. negative results are not cached (a file created later is still found), and
 *   2. a stale positive is re-validated and re-walked (a moved className resolves
 *      to its new home, not the cached-but-now-wrong one).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleTailwindCommit, clearClassNameFileCache } from "../commitTailwind";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-tw-cache-"));
  clearClassNameFileCache();
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
  clearClassNameFileCache();
});

async function write(rel: string, content: string) {
  const full = join(tempDir, rel);
  await mkdir(full.substring(0, full.lastIndexOf("/")), { recursive: true });
  await writeFile(full, content, "utf-8");
  return full;
}

describe("findFileByClassName memo (issue #43)", () => {
  it("does not cache a negative result — a file created later is still found", async () => {
    // Lookup #1: nothing in the project has the class → fails (must NOT cache null).
    const miss = await handleTailwindCommit(
      [{ sourceFile: "", existingClasses: "late-unique-cls", newClasses: "p-4" }],
      tempDir,
    );
    expect(miss.written).toHaveLength(0);

    // The element's file appears afterwards.
    await write(
      "src/Late.tsx",
      'export const Late = () => <div className="late-unique-cls">x</div>;',
    );

    // Lookup #2 (same class) must walk fresh and find it.
    const hit = await handleTailwindCommit(
      [{ sourceFile: "", existingClasses: "late-unique-cls", newClasses: "grid" }],
      tempDir,
    );
    expect(hit.written).toEqual(["src/Late.tsx"]);
    expect(await readFile(join(tempDir, "src/Late.tsx"), "utf-8")).toContain("grid");
  });

  it("re-validates a stale positive and re-walks to the moved file", async () => {
    // First resolve caches moveme-cls → A.tsx. An idempotent merge leaves the
    // className attribute unchanged, so the cache entry stays a valid positive.
    await write(
      "src/A.tsx",
      'export const A = () => <div className="moveme-cls">a</div>;',
    );
    const first = await handleTailwindCommit(
      [{ sourceFile: "", existingClasses: "moveme-cls", newClasses: "moveme-cls" }],
      tempDir,
    );
    expect(first.written).toEqual(["src/A.tsx"]);

    // The element moves to a different file; the old one is gone.
    await unlink(join(tempDir, "src/A.tsx"));
    await write(
      "src/B.tsx",
      'export const B = () => <div className="moveme-cls">b</div>;',
    );

    // Cache hit on A.tsx is re-validated (A is gone), evicted, and the walk finds B.tsx.
    const second = await handleTailwindCommit(
      [{ sourceFile: "", existingClasses: "moveme-cls", newClasses: "p-2" }],
      tempDir,
    );
    expect(second.written).toEqual(["src/B.tsx"]);
    expect(await readFile(join(tempDir, "src/B.tsx"), "utf-8")).toContain("p-2");
  });
});
