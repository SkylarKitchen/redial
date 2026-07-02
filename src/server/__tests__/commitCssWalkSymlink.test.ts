/**
 * commitCssWalkSymlink.test.ts — issue #56 (the #22 hardening gap).
 *
 * findCSSFiles — the walk behind the custom-property definition fallback
 * (findVariableDefinitionFile) — collected candidates with no realpath
 * containment check, so a symlink inside the project pointing OUTSIDE the
 * root caused out-of-root READS during the variable search. The final write
 * chokepoint still blocked the write, but the walk itself must never surface
 * (or read) an out-of-root file.
 *
 * Observable distinction: when the only "definition" lives outside the root,
 * a hardened walk never finds it, so the commit fails with `file not found`.
 * The unhardened walk found it and was only stopped later by the chokepoint
 * (`resolved path escapes project root`) — proof the out-of-root read
 * happened.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm, symlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let sandbox: string;
let projectRoot: string;
let outsideDir: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), "redial-csswalk-"));
  projectRoot = join(sandbox, "project");
  outsideDir = join(sandbox, "outside");
  await mkdir(projectRoot, { recursive: true });
  await mkdir(outsideDir, { recursive: true });
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

/** A change whose sourceFile can't resolve, forcing the --var fallback walk. */
function varChange(prop: string, from: string, to: string) {
  return [{ prop, from, to, sourceFile: "ghost.css" }];
}

describe("findCSSFiles symlink containment (issue #56)", () => {
  it("does not read a --var definition through a symlinked-out FILE", async () => {
    const leaked = join(outsideDir, "leaked.css");
    const original = ":root {\n  --leak: red;\n}\n";
    await writeFile(leaked, original, "utf-8");
    // In-root symlink with a stylesheet name, pointing outside the root.
    await symlink(leaked, join(projectRoot, "vars.css"), "file");

    const result = await handleCommit(varChange("--leak", "red", "blue"), projectRoot);

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    // The walk must never have surfaced the out-of-root definition at all —
    // "resolved path escapes project root" here would mean the file WAS read
    // and only the last-resort write chokepoint saved us.
    expect(result.failed[0].reason).toContain("file not found");
    // The outside file is byte-for-byte unchanged either way.
    expect(await readFile(leaked, "utf-8")).toBe(original);
  });

  it("does not descend into a symlinked-out DIRECTORY", async () => {
    const secrets = join(outsideDir, "secrets");
    await mkdir(secrets, { recursive: true });
    const leaked = join(secrets, "tokens.css");
    const original = ":root {\n  --leak: red;\n}\n";
    await writeFile(leaked, original, "utf-8");
    // In-root directory symlink pointing outside the root.
    await symlink(secrets, join(projectRoot, "themes"), "dir");

    const result = await handleCommit(varChange("--leak", "red", "blue"), projectRoot);

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toContain("file not found");
    expect(await readFile(leaked, "utf-8")).toBe(original);
  });

  it("still finds and updates a legitimate in-root definition (positive control)", async () => {
    const stylesDir = join(projectRoot, "styles");
    await mkdir(stylesDir, { recursive: true });
    await writeFile(
      join(stylesDir, "vars.css"),
      ":root {\n  --brand: red;\n}\n",
      "utf-8",
    );

    const result = await handleCommit(varChange("--brand", "red", "blue"), projectRoot);

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain("ghost.css");
    const content = await readFile(join(stylesDir, "vars.css"), "utf-8");
    expect(content).toContain("--brand: blue;");
  });
});
