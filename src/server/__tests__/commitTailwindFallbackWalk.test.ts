/**
 * commitTailwindFallbackWalk.test.ts — fallback file discovery must consider
 * ALL className attributes in a candidate file (issue #66).
 *
 * The #42 fix (findClassNameForChange / findAllClassNameAttributes) was wired
 * into the handler path only. The no-sourceFile discovery walk still checked
 * only the FIRST className attribute in each file, so an element whose classes
 * appear in a later className attribute was never found ("no source file
 * specified") — or, when the cache re-validation path hit the same first-match
 * check, a valid cache entry was wrongly evicted.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleTailwindCommit, clearClassNameFileCache } from "../commitTailwind";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-tw-fallback-"));
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

describe("fallback walk matches non-first className attributes (issue #66)", () => {
  it("finds a file where the target classes are in the SECOND className attribute", async () => {
    await write(
      "src/Card.tsx",
      [
        "export function Card() {",
        "  return (",
        '    <div className="card-shell p-2">',
        '      <span className="card-title-unique text-lg">Title</span>',
        "    </div>",
        "  );",
        "}",
      ].join("\n"),
    );

    const result = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "card-title-unique text-lg",
          newClasses: "text-xl",
        },
      ],
      tempDir,
    );

    expect(result.failed).toEqual([]);
    expect(result.written).toEqual(["src/Card.tsx"]);
    const content = await readFile(join(tempDir, "src/Card.tsx"), "utf-8");
    expect(content).toContain('className="card-title-unique text-xl"');
    // The first className attribute must be untouched.
    expect(content).toContain('className="card-shell p-2"');
  });

  it("re-validates a cached file whose target classes are in a later className attribute", async () => {
    await write(
      "src/List.tsx",
      [
        "export function List() {",
        "  return (",
        '    <ul className="list-wrap gap-2">',
        '      <li className="list-item-unique m-1">one</li>',
        "    </ul>",
        "  );",
        "}",
      ].join("\n"),
    );

    // First save resolves via the walk and caches className → file. Idempotent
    // merge keeps the attribute content identical, so the entry stays valid.
    const first = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "list-item-unique m-1",
          newClasses: "list-item-unique m-1",
        },
      ],
      tempDir,
    );
    expect(first.written).toEqual(["src/List.tsx"]);

    // Second save hits the cache; fileStillHasClassName must accept the match
    // on the SECOND className attribute instead of evicting a valid entry.
    const second = await handleTailwindCommit(
      [
        {
          sourceFile: "",
          existingClasses: "list-item-unique m-1",
          newClasses: "m-4",
        },
      ],
      tempDir,
    );
    expect(second.failed).toEqual([]);
    expect(second.written).toEqual(["src/List.tsx"]);
    const content = await readFile(join(tempDir, "src/List.tsx"), "utf-8");
    expect(content).toContain('className="list-item-unique m-4"');
    expect(content).toContain('className="list-wrap gap-2"');
  });
});
