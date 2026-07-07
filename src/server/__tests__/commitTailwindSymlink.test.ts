/**
 * commitTailwindSymlink.test.ts — the Turbopack className→file fallback walk
 * must not follow symlinks out of the project (issue #22 regression).
 *
 * The earlier #22 fix added isRealPathWithinRoot at the WRITE chokepoint, so a
 * symlinked path is never written. But findFileByClassName's `walk` still
 * `readFile`s every JSX-named entry — including symlinks — BEFORE that check.
 * A symlink `src/sneaky.tsx -> ~/.ssh/id_rsa` therefore leaks the target's
 * contents into the process (information disclosure) even though the write is
 * blocked. The walk must skip symlinks entirely (read regular files only).
 *
 * readFile is spied via vi.mock so BOTH this test and the module-under-test
 * share the same binding; an assertion that a legit in-tree file WAS read
 * guards against a no-op spy giving a false pass.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleTailwindCommit, clearClassNameFileCache } from "../commitTailwind";

vi.mock("fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs/promises")>();
  return { ...actual, readFile: vi.fn(actual.readFile) };
});

let base: string;
let projectRoot: string;
let outsideDir: string;

beforeEach(async () => {
  clearClassNameFileCache();
  base = await mkdtemp(join(tmpdir(), "redial-tw-symlink-"));
  projectRoot = join(base, "project");
  outsideDir = join(base, "outside");
  await mkdir(join(projectRoot, "src"), { recursive: true });
  await mkdir(outsideDir, { recursive: true });
});

afterEach(async () => {
  vi.mocked(readFile).mockClear();
  clearClassNameFileCache();
  await rm(base, { recursive: true, force: true });
});

describe("findFileByClassName walk — symlink containment (issue #22)", () => {
  it("never reads a symlinked file pointing outside the project root", async () => {
    // A real in-tree file WITHOUT the class — proves the walk runs and the spy
    // observes the walk's reads (guards against a no-op spy false-passing).
    const legit = join(projectRoot, "src", "Legit.tsx");
    await writeFile(
      legit,
      'export const Legit = () => <div className="not-the-class">x</div>;',
      "utf-8",
    );

    // A "secret" OUTSIDE the root that DOES contain the searched class.
    const secret = join(outsideDir, "secret.tsx");
    await writeFile(secret, 'SENSITIVE className="hijack-cls" SENSITIVE', "utf-8");

    // A symlink inside the project (JSX-named) pointing at the outside secret.
    const sneaky = join(projectRoot, "src", "sneaky.tsx");
    await symlink(secret, sneaky);

    const res = await handleTailwindCommit(
      [{ sourceFile: "", existingClasses: "hijack-cls", newClasses: "p-4" }],
      projectRoot,
    );

    // Sanity: the spy DID observe the walk reading the legit in-tree file.
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(legit, "utf-8");
    // The vulnerability: the symlink to the outside secret must NEVER be read.
    expect(vi.mocked(readFile)).not.toHaveBeenCalledWith(sneaky, "utf-8");
    // And nothing is written (the class only "exists" behind the blocked symlink).
    expect(res.written).toHaveLength(0);
  });
});
