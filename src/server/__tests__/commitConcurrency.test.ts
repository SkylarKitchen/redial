/**
 * Issue #64 — no write serialization in the commit pipeline.
 *
 * handleCommit does read-file → mutate-in-memory → write-file. Without a
 * lock, two overlapping calls that touch the same file both read the
 * original content and the second writeFile silently discards the first
 * call's edit (last writer wins). These tests fire genuinely concurrent
 * handleCommit calls against the same fixture file and assert BOTH changes
 * land on disk.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit } from "../commit";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "redial-concurrency-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

const FIXTURE = [
  ".btn {",
  "  color: red;",
  "  font-size: 16px;",
  "  padding: 8px;",
  "}",
  "",
].join("\n");

describe("handleCommit — concurrent saves to the same file (issue #64)", () => {
  it("two overlapping commits both land (no lost update)", async () => {
    // The lost-update race is timing-dependent; run several rounds and
    // require every one to keep both edits.
    for (let round = 0; round < 5; round++) {
      const name = `styles-${round}.css`;
      const file = join(tempDir, name);
      await writeFile(file, FIXTURE, "utf-8");

      const [a, b] = await Promise.all([
        handleCommit(
          [{ prop: "color", from: "red", to: "blue", sourceFile: name }],
          tempDir
        ),
        handleCommit(
          [{ prop: "font-size", from: "16px", to: "20px", sourceFile: name }],
          tempDir
        ),
      ]);

      expect(a.failed).toEqual([]);
      expect(b.failed).toEqual([]);
      expect(a.written).toEqual([name]);
      expect(b.written).toEqual([name]);

      const final = await readFile(file, "utf-8");
      expect(final).toContain("color: blue;");
      expect(final).toContain("font-size: 20px;");
    }
  });

  it("three-way concurrent commits all land", async () => {
    const name = "three-way.css";
    const file = join(tempDir, name);
    await writeFile(file, FIXTURE, "utf-8");

    await Promise.all([
      handleCommit(
        [{ prop: "color", from: "red", to: "blue", sourceFile: name }],
        tempDir
      ),
      handleCommit(
        [{ prop: "font-size", from: "16px", to: "20px", sourceFile: name }],
        tempDir
      ),
      handleCommit(
        [{ prop: "padding", from: "8px", to: "12px", sourceFile: name }],
        tempDir
      ),
    ]);

    const final = await readFile(file, "utf-8");
    expect(final).toContain("color: blue;");
    expect(final).toContain("font-size: 20px;");
    expect(final).toContain("padding: 12px;");
  });

  it("concurrent commits to DIFFERENT files still both succeed", async () => {
    const fileA = join(tempDir, "a.css");
    const fileB = join(tempDir, "b.css");
    await writeFile(fileA, FIXTURE, "utf-8");
    await writeFile(fileB, FIXTURE, "utf-8");

    const [a, b] = await Promise.all([
      handleCommit(
        [{ prop: "color", from: "red", to: "blue", sourceFile: "a.css" }],
        tempDir
      ),
      handleCommit(
        [{ prop: "color", from: "red", to: "green", sourceFile: "b.css" }],
        tempDir
      ),
    ]);

    expect(a.failed).toEqual([]);
    expect(b.failed).toEqual([]);
    expect(await readFile(fileA, "utf-8")).toContain("color: blue;");
    expect(await readFile(fileB, "utf-8")).toContain("color: green;");
  });
});
