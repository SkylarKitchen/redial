/**
 * Tests for the POST /open-editor route (issue #82).
 *
 * The Header's source-file link posts { file, line } to the open-editor
 * endpoint (a sibling of the commit endpoint under the same catch-all
 * route.ts mount). Before the fix no handler existed anywhere, so the click
 * always failed. These tests pin the contract:
 *
 *  - a valid in-root file → 200 { ok: true } + the editor launch side effect
 *  - path safety via the pathSafety API: traversal / out-of-root → 403,
 *    missing file (or symlink escape) → 404, and the launcher NEVER runs
 *  - malformed body → 400; launch failure → 500 with a clear message
 *  - the existing CSRF gates (issue #54) cover the new route too
 *
 * The editor-launch side effect is swapped out through the exported
 * __setLaunchEditorForTests seam. The seam is read defensively so that
 * pre-fix (when neither the seam nor the route exists) the tests fail on the
 * handler's real wrong behavior instead of erroring at import time.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as server from "../index";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";
import { resolve } from "node:path";

const { POST } = server;

type LaunchFn = (file: string, line: number) => Promise<void>;
const setLauncher = (server as Record<string, unknown>).__setLaunchEditorForTests as
  | ((fn: LaunchFn | null) => void)
  | undefined;

const ENDPOINT = "http://localhost:3000/api/tuner/open-editor";

function makeRequest(body: unknown, opts: { marker?: boolean } = {}): Request {
  const headers: Record<string, string> = {
    host: "localhost:3000",
    origin: "http://localhost:3000",
    "content-type": "application/json",
  };
  if (opts.marker !== false) headers[REDIAL_MARKER_HEADER] = "1";
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

let launch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
  launch = vi.fn().mockResolvedValue(undefined);
  setLauncher?.(launch as unknown as LaunchFn);
});

afterEach(() => {
  setLauncher?.(null);
  vi.unstubAllEnvs();
});

describe("POST /open-editor (issue #82)", () => {
  it("exposes the launcher test seam so tests never spawn a real editor", () => {
    expect(typeof (server as Record<string, unknown>).__setLaunchEditorForTests).toBe(
      "function",
    );
  });

  it("does not 404: a valid in-root file returns 200 { ok: true } and launches at the resolved path/line", async () => {
    const res = await POST(makeRequest({ file: "package.json", line: 3 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith(resolve(process.cwd(), "package.json"), 3);
  });

  it("defaults a missing line to 1", async () => {
    const res = await POST(makeRequest({ file: "package.json" }));
    expect(res.status).toBe(200);
    expect(launch).toHaveBeenCalledWith(resolve(process.cwd(), "package.json"), 1);
  });

  it("rejects a '..' traversal path with 403 and never launches", async () => {
    const res = await POST(makeRequest({ file: "../../etc/passwd", line: 1 }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/project root|traversal/i);
    expect(launch).not.toHaveBeenCalled();
  });

  it("rejects an absolute path outside the project root with 403 and never launches", async () => {
    const res = await POST(makeRequest({ file: "/etc/passwd", line: 1 }));
    expect(res.status).toBe(403);
    expect(launch).not.toHaveBeenCalled();
  });

  it("responds 404 for an in-root path that doesn't exist, without launching", async () => {
    const res = await POST(makeRequest({ file: "no-such-file-issue82.tsx", line: 1 }));
    expect(res.status).toBe(404);
    expect(launch).not.toHaveBeenCalled();
  });

  it("responds 400 when file is missing or not a string", async () => {
    expect((await POST(makeRequest({ line: 4 }))).status).toBe(400);
    expect((await POST(makeRequest({ file: 42, line: 4 }))).status).toBe(400);
    expect(launch).not.toHaveBeenCalled();
  });

  it("responds 500 with a clear capability message when the editor fails to launch", async () => {
    launch.mockRejectedValueOnce(new Error("spawn code ENOENT"));
    const res = await POST(makeRequest({ file: "package.json", line: 1 }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/editor/i);
  });

  it("still enforces the CSRF marker gate (issue #54) on the open-editor route", async () => {
    const res = await POST(
      makeRequest({ file: "package.json", line: 1 }, { marker: false }),
    );
    expect(res.status).toBe(403);
    expect(launch).not.toHaveBeenCalled();
  });
});
