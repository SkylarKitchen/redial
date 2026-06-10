/**
 * Tests for the exported route handlers themselves (issue #54).
 *
 * The existing server suites call handleCommit() directly; nothing exercised
 * POST/GET's request gating. POST's only gate used to be NODE_ENV, and
 * request.json() parses regardless of Content-Type — so a text/plain CORS
 * "simple request" from ANY page the developer visits could mutate source
 * files while `next dev` runs. The fix: (a) when an Origin header is present
 * its host must match the request's Host, (b) a custom marker header is
 * required, forcing a CORS preflight for cross-origin pages.
 *
 * Payloads deliberately omit sourceFile so handleCommit fails fast in its
 * grouping loop — the handler runs against process.cwd(), and these tests
 * must never touch the repo's real files.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { POST, GET } from "../index";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";

const ENDPOINT = "http://localhost:3000/api/tuner/commit";

function makeRequest(opts: {
  origin?: string;
  marker?: boolean;
  body?: unknown;
} = {}): Request {
  const headers: Record<string, string> = {
    host: "localhost:3000",
    "content-type": "application/json",
  };
  if (opts.origin !== undefined) headers.origin = opts.origin;
  if (opts.marker !== false) headers[REDIAL_MARKER_HEADER] = "1";
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(
      opts.body ?? { changes: [{ prop: "color", from: "blue", to: "red" }] },
    ),
  });
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST — request gating (issue #54)", () => {
  it("accepts a same-origin request carrying the marker header", async () => {
    const res = await POST(makeRequest({ origin: "http://localhost:3000" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // The sourceFile-less change fails fast inside handleCommit — proves the
    // request got past the gates and reached the handler.
    expect(json.written).toEqual([]);
    expect(json.failed).toHaveLength(1);
  });

  it("accepts a request with no Origin header (non-browser client)", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
  });

  it("rejects a cross-origin request with 403", async () => {
    const res = await POST(makeRequest({ origin: "http://evil.example" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("rejects an opaque 'null' Origin (sandboxed iframe) with 403", async () => {
    const res = await POST(makeRequest({ origin: "null" }));
    expect(res.status).toBe(403);
  });

  it("rejects a same-origin request missing the marker header with 403", async () => {
    const res = await POST(
      makeRequest({ origin: "http://localhost:3000", marker: false }),
    );
    expect(res.status).toBe(403);
  });

  it("still rejects a non-array changes payload with 400", async () => {
    const res = await POST(makeRequest({ body: { changes: {} } }));
    expect(res.status).toBe(400);
  });
});

describe("NODE_ENV guard stays first", () => {
  it("returns 404 outside development even for a fully-valid request", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(makeRequest({ origin: "http://localhost:3000" }));
    expect(res.status).toBe(404);
  });

  it("GET returns 404 outside development and 200 in development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await GET()).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development");
    expect((await GET()).status).toBe(200);
  });
});
