/**
 * Issue #65 — a malformed element in the commit POST body 500s the whole
 * batch.
 *
 * The route's body validation checks Array.isArray(changes) but not element
 * shape; handleCommit's grouping loop dereferences change.sourceFile before
 * any try/catch, so a body like {changes:[null]} throws a TypeError that
 * escapes the handler and turns the entire batch into a generic 500 —
 * instead of a per-item `failed` entry.
 *
 * Two layers of coverage:
 *   - handleCommit directly, with real temp files, proving valid elements
 *     in the same batch still get written;
 *   - the exported POST route, proving malformed bodies never 500 (CSS and
 *     tailwind modes). Route payloads use missing/nonexistent sourceFiles
 *     so the handler (running against process.cwd()) never touches repo files.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { handleCommit, type CommitChange } from "../commit";
import { POST } from "../index";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";

// --- handleCommit-level (behavioral, real temp files) ---

describe("handleCommit — malformed batch elements (issue #65)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "redial-malformed-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("a null element fails per-item while the valid element still writes", async () => {
    const file = join(tempDir, "styles.css");
    await writeFile(file, ".btn {\n  color: red;\n}\n", "utf-8");

    const changes = [
      null,
      { prop: "color", from: "red", to: "blue", sourceFile: "styles.css" },
    ] as unknown as CommitChange[];

    const result = await handleCommit(changes, tempDir);

    expect(result.written).toEqual(["styles.css"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/malformed/i);
    expect(await readFile(file, "utf-8")).toContain("color: blue;");
  });

  it("non-object elements (string, number, array) each fail per-item without throwing", async () => {
    const changes = ["bogus", 42, ["nested"]] as unknown as CommitChange[];
    const result = await handleCommit(changes, tempDir);
    expect(result.written).toEqual([]);
    expect(result.failed).toHaveLength(3);
    for (const f of result.failed) {
      expect(f.reason).toMatch(/malformed/i);
    }
  });

  it("an object element missing required string fields fails per-item", async () => {
    const file = join(tempDir, "styles.css");
    await writeFile(file, ".btn {\n  color: red;\n}\n", "utf-8");

    const changes = [
      { sourceFile: "styles.css" }, // no prop/from/to
      { prop: "color", from: "red", to: "blue", sourceFile: "styles.css" },
    ] as unknown as CommitChange[];

    const result = await handleCommit(changes, tempDir);

    expect(result.written).toEqual(["styles.css"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].reason).toMatch(/malformed/i);
    expect(await readFile(file, "utf-8")).toContain("color: blue;");
  });
});

// --- Route-level (exported POST) ---

const ENDPOINT = "http://localhost:3000/api/tuner/commit";

function makeRequest(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      "content-type": "application/json",
      [REDIAL_MARKER_HEADER]: "1",
    },
    body: JSON.stringify(body),
  });
}

describe("POST — malformed batch elements do not 500 (issue #65)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("CSS mode: a batch containing null returns per-item failures, not a 500", async () => {
    const res = await POST(
      makeRequest({
        changes: [
          null,
          { prop: "color", from: "red", to: "blue" }, // valid shape, no sourceFile
        ],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.written).toEqual([]);
    expect(json.failed).toHaveLength(2);
    const reasons = json.failed.map((f: { reason: string }) => f.reason);
    // The malformed element gets its own failure...
    expect(reasons.some((r: string) => /malformed/i.test(r))).toBe(true);
    // ...and the valid element is still processed on its own merits.
    expect(reasons).toContain("no source file specified");
  });

  it("CSS mode: a batch of only malformed elements returns 200 with all-failed", async () => {
    const res = await POST(makeRequest({ changes: [null, "junk", 7] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.failed).toHaveLength(3);
  });

  it("tailwind mode: a batch containing null returns per-item failures, not a 500", async () => {
    const res = await POST(
      makeRequest({
        mode: "tailwind",
        changes: [
          null,
          {
            sourceFile: "redial-no-such-file-issue65.tsx",
            existingClasses: "text-red-500",
            newClasses: "text-blue-500",
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.written).toEqual([]);
    expect(json.failed).toHaveLength(2);
    const reasons = json.failed.map((f: { reason: string }) => f.reason);
    expect(reasons.some((r: string) => /malformed/i.test(r))).toBe(true);
    // The valid-shaped element still ran (its nonexistent file fails per-item).
    expect(reasons.some((r: string) => /file error/i.test(r))).toBe(true);
  });
});
