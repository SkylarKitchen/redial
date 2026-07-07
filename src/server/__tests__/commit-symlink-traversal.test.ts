/**
 * commit-symlink-traversal.test.ts — Security regression for issue #22.
 *
 * Path containment was guarded with a STRING normalize() check, which does not
 * resolve symlinks. A symlink INSIDE the project root whose basename looks like
 * a normal stylesheet but points OUTSIDE the root would therefore be resolved
 * (directly, or via findFileRecursive) and then read/written through — letting a
 * commit modify a file outside the project root (e.g. a malicious repo shipping
 * `styles.module.css -> ~/.ssh/authorized_keys`).
 *
 * The fix validates the resolved path via fs.realpath before any read/write, so
 * a path whose real location escapes the project root is rejected.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm, symlink } from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";
import { resolveSourceFile } from "../cssResolve";

let sandbox: string;
let projectRoot: string;
let outsideDir: string;

beforeEach(async () => {
  // A sandbox holding both the "project" and a sibling "outside" dir.
  sandbox = await mkdtemp(join(tmpdir(), "redial-symlink-"));
  projectRoot = join(sandbox, "project");
  outsideDir = join(sandbox, "outside");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

describe("symlink path traversal (issue #22)", () => {
  it("does not resolve a root-level symlink that escapes the project root", async () => {
    const secretPath = join(outsideDir, "secret.module.css");
    await writeFile(secretPath, ".styles { color: blue; }", "utf-8");
    // A symlink inside the repo, named like a normal stylesheet, pointing out.
    await symlink(secretPath, join(projectRoot, "styles.module.css"), "file");

    const resolved = await resolveSourceFile(projectRoot, "styles.module.css");
    expect(resolved).toBeNull();
  });

  it("does not resolve a symlinked file found by recursive search", async () => {
    const secretPath = join(outsideDir, "secret.module.css");
    await writeFile(secretPath, ".comp { color: blue; }", "utf-8");
    const sub = join(projectRoot, "src", "components");
    await mkdir(sub, { recursive: true });
    // Bare-basename lookup misses the root, recurses, and finds this symlink.
    await symlink(secretPath, join(sub, "Comp.module.css"), "file");

    const resolved = await resolveSourceFile(projectRoot, "Comp.module.css");
    expect(resolved).toBeNull();
  });

  it("a commit through a symlinked-out file fails and leaves it untouched", async () => {
    const secretPath = join(outsideDir, "secret.module.css");
    const original = ".styles { color: blue; }";
    await writeFile(secretPath, original, "utf-8");
    await symlink(secretPath, join(projectRoot, "styles.module.css"), "file");

    const result = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: "styles.module.css", className: "styles" }],
      projectRoot,
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    // The outside file must be byte-for-byte unchanged.
    expect(await readFile(secretPath, "utf-8")).toBe(original);
  });

  it("still resolves a legitimate file inside the project root", async () => {
    const inside = join(projectRoot, "src");
    await mkdir(inside, { recursive: true });
    const real = join(inside, "Real.module.css");
    await writeFile(real, ".real { color: green; }", "utf-8");

    const resolved = await resolveSourceFile(projectRoot, "Real.module.css");
    expect(resolved).not.toBeNull();
    // realpath may canonicalize /tmp → /private/tmp; compare by basename.
    expect(dirname(resolved!).endsWith("src")).toBe(true);
  });
});
