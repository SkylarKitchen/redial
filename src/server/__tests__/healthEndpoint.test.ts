/**
 * healthEndpoint.test.ts — the GET route is the overlay's save-endpoint
 * health check (audit: opaque first-save failures).
 *
 * The Footer pings GET once per session on mount to verify the catch-all
 * route (app/api/tuner/[...path]/route.ts) is actually mounted before the
 * user invests edits. The client validates the SHAPE of the response — a 200
 * from some other coincidental route must not count as healthy — so the
 * payload contract is pinned here:
 *
 *   { ok: true, version: <number>, status: "tuner server active" }
 *
 * `ok`/`version` are the machine-checkable health fields; `status` is the
 * legacy field kept for anything already reading it.
 *
 * RED pre-fix: GET returns only { status: "tuner server active" } — no `ok`,
 * no `version`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GET } from "../index";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET — health payload shape", () => {
  it("returns ok:true with a numeric version in development", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(typeof json.version).toBe("number");
  });

  it("keeps the legacy status field for backward compatibility", async () => {
    const res = await GET();
    const json = await res.json();
    expect(json.status).toBe("tuner server active");
  });

  it("still 404s outside development (health must not leak into prod)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await GET();
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.ok).not.toBe(true);
  });
});
