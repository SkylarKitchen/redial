/**
 * Defense-in-depth: the commit path must reject semantically-invalid values.
 *
 * Companion to src/overlay/__tests__/invalidValueGuard.test.ts. The browser
 * write layer (apply.ts) now drops invalid `none` before it is recorded, but
 * the server commit path is the LAST line of defense — stale localStorage
 * written before the apply.ts guard shipped, or a direct /commit POST, could
 * still carry `box-sizing: none`. changeValidationError() only checked
 * *syntactic* safety (isSafeCSSValue: no `{};<`/newline); `box-sizing: none`
 * passes that and would be written to source as invalid CSS.
 *
 * The fix shares the same predicate (isInvalidDeclaration in src/lib/css.ts)
 * so the client preview and the server write path can't drift apart.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-semantic-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

async function writeFixture(relativePath: string, content: string): Promise<string> {
  const fullPath = join(tempDir, relativePath);
  await mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
  return content;
}

const FIXTURE = "src/Card.module.scss";

describe("handleCommit — semantic-validity guard", () => {
  it("rejects `box-sizing: none` and leaves the source untouched", async () => {
    const original = await writeFixture(
      FIXTURE,
      [".card {", "  box-sizing: border-box;", "}"].join("\n"),
    );

    const result = await handleCommit(
      [{ prop: "box-sizing", from: "border-box", to: "none", sourceFile: FIXTURE, sourceLine: 2 }],
      tempDir,
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    const content = await readFile(join(tempDir, FIXTURE), "utf-8");
    expect(content).toBe(original);
    expect(content).not.toContain("box-sizing: none");
  });

  it("rejects `text-align: none` (toggle-deselect sentinel)", async () => {
    const original = await writeFixture(
      FIXTURE,
      [".card {", "  text-align: center;", "}"].join("\n"),
    );

    const result = await handleCommit(
      [{ prop: "text-align", from: "center", to: "none", sourceFile: FIXTURE, sourceLine: 2 }],
      tempDir,
    );

    expect(result.written).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toBe(original);
  });

  // --- Must NOT over-reject a legitimate `none` ---

  it("still writes `display: none` (none is valid there)", async () => {
    await writeFixture(FIXTURE, [".card {", "  display: block;", "}"].join("\n"));

    const result = await handleCommit(
      [{ prop: "display", from: "block", to: "none", sourceFile: FIXTURE, sourceLine: 2 }],
      tempDir,
    );

    expect(result.failed).toHaveLength(0);
    expect(result.written).toContain(FIXTURE);
    expect(await readFile(join(tempDir, FIXTURE), "utf-8")).toContain("display: none");
  });
});
