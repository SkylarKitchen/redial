// @vitest-environment happy-dom
/**
 * saveDiagnostics.test.tsx — misconfigured first save must fail LOUDLY and
 * truthfully (audit: "save-failure diagnostics" / opaque first-save gap).
 *
 * Three verified holes in the current Footer save pipeline:
 *   1. No health check — nothing ever calls the server's GET endpoint, so a
 *      missing/typo'd route mount is only discovered after the user has
 *      invested edits and hits Save.
 *   2. Status-blind toasts — every non-2xx collapses to a bare "Save failed"
 *      (404 route-missing and 500 server-bug are indistinguishable), and the
 *      server-provided error body is thrown away.
 *   3. Misdiagnosis — a fetch REJECTION (dev server down / route not mounted)
 *      shows "No commit endpoint — copied CSS to clipboard", which blames the
 *      endpoint *config* when the config is fine and the network is not.
 *
 * Contract locked here (message matrix):
 *   fetch rejection      → "Can't reach the dev server route — is
 *                           app/api/tuner/[...path]/route.ts mounted?"
 *   non-2xx              → "Save failed (STATUS) — <server error text>"
 *   2xx with failed[]    → "Saved N, failed M — first failure: <reason>"
 *   2xx clean            → "Saved N propert(y|ies) → file" (unchanged)
 *
 * Health check: one GET per session on Footer mount (dev only, cached at
 * module scope — never re-pinged per render/remount); unreachable or
 * wrong-shaped → persistent dismissible notice; healthy → no notice.
 *
 * RED pre-fix: rejection shows the misdiagnosing "No commit endpoint" text,
 * non-2xx shows status-less "Save failed", partial failure uses the old
 * "Saved N, M failed:" wording, and no health notice exists at all.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { render, fireEvent, type RenderResult } from "@testing-library/react";
import { Footer, __resetSaveHealthForTests } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { getConfig } from "../core/config";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

let fetchMock: ReturnType<typeof vi.fn>;
let clipboardWrites: string[];

/** Route the global fetch mock by HTTP method so the health-check GET and the
 *  save POST can be scripted independently within one test. */
function stubFetch(handlers: {
  GET?: () => Promise<unknown>;
  POST?: () => Promise<unknown>;
}) {
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = handlers[method as "GET" | "POST"];
    if (!handler) return Promise.reject(new TypeError("Failed to fetch"));
    return handler();
  });
  vi.stubGlobal("fetch", fetchMock);
}

function jsonResponse(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

/** A non-JSON error response (e.g. Next's HTML 404 page): json() rejects. */
function htmlResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token < in JSON");
    },
  });
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  __resetSaveHealthForTests();
  document.body.innerHTML = "";
  clipboardWrites = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn((text: string) => {
        clipboardWrites.push(text);
        return Promise.resolve();
      }),
      readText: vi.fn().mockResolvedValue(""),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
  __resetSaveHealthForTests();
});

/** Mount the Footer on an element that has one pending edit, click Save,
 *  flush, and return the status-region text. */
async function saveAndReadMessage(): Promise<{ message: string; view: RenderResult }> {
  const el = makeEl("diag-target");
  styleEngine.apply({ scope: "element", el }, "color", "red");
  const view = render(<Footer element={el} onReset={() => {}} />);
  const saveBtn = Array.from(view.container.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().startsWith("Save"),
  ) as HTMLButtonElement;
  expect(saveBtn, "Save button should render").toBeTruthy();
  await act(async () => {
    fireEvent.click(saveBtn);
    await flushMicrotasks();
  });
  const status = view.container.querySelector('[role="status"]');
  expect(status, "status live region should be mounted").toBeTruthy();
  return { message: status!.textContent ?? "", view };
}

describe("save failure diagnostics — message matrix", () => {
  it("(a) fetch rejection → names the unreachable route, NOT a missing endpoint config", async () => {
    stubFetch({ POST: () => Promise.reject(new TypeError("Failed to fetch")) });

    const { message } = await saveAndReadMessage();

    // THE BUG: pre-fix this reads "No commit endpoint — copied CSS to
    // clipboard", blaming the config when the network call itself failed.
    expect(message).toContain("Can't reach the dev server route");
    expect(message).toContain("app/api/tuner/[...path]/route.ts");
    expect(message).not.toContain("No commit endpoint");

    // The best-effort clipboard fallback still preserves the edit.
    expect(clipboardWrites.some((t) => t.includes("color: red"))).toBe(true);
  });

  it("(b) 404 (route not mounted) → surfaces the HTTP status", async () => {
    stubFetch({ POST: () => htmlResponse(404) });

    const { message } = await saveAndReadMessage();

    // THE BUG: pre-fix every non-2xx collapses to a status-less "Save failed".
    expect(message).toContain("Save failed (404)");
  });

  it("(b) 500 with a JSON error body → surfaces status AND the server's error text", async () => {
    stubFetch({ POST: () => jsonResponse(500, { error: "Internal server error" }) });

    const { message } = await saveAndReadMessage();

    expect(message).toContain("Save failed (500)");
    expect(message).toContain("Internal server error");
  });

  it("(c) 2xx with failed[] entries → truthful partial-save summary with the first reason", async () => {
    stubFetch({
      POST: () =>
        jsonResponse(200, {
          written: ["app/styles.css"],
          failed: [{ reason: "selector not found in any stylesheet" }],
        }),
    });

    const { message } = await saveAndReadMessage();

    expect(message).toContain("Saved 1, failed 1");
    expect(message).toContain("first failure: selector not found in any stylesheet");
  });

  it("(d) clean 2xx → unchanged success path (count + file hint)", async () => {
    stubFetch({
      POST: () => jsonResponse(200, { written: ["app/styles.css"], failed: [] }),
    });

    const { message } = await saveAndReadMessage();

    expect(message).toContain("Saved 1 property");
    expect(message).toContain("styles.css");
  });
});

describe("save endpoint health check — one GET per session on Footer mount (dev only)", () => {
  it("shows a persistent notice when the endpoint is unreachable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFetch({ GET: () => Promise.reject(new TypeError("Failed to fetch")) });

    const el = makeEl("health-el");
    const view = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    // THE BUG: pre-fix no health check exists — nothing pings GET, no notice.
    const getCalls = fetchMock.mock.calls.filter(
      (c) => ((c[1] as RequestInit | undefined)?.method ?? "GET").toUpperCase() === "GET",
    );
    expect(getCalls.length, "health check must GET the commit endpoint").toBe(1);
    expect(getCalls[0][0]).toBe(getConfig().commitEndpoint);

    const notice = view.container.querySelector('[role="alert"]');
    expect(notice, "unreachable endpoint must surface a notice").toBeTruthy();
    expect(notice!.textContent).toContain("Save endpoint not reachable");
    expect(notice!.textContent).toContain(getConfig().commitEndpoint);
  });

  it("shows a notice when the endpoint responds with the wrong shape (not the health payload)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    // A 200 from some OTHER route (e.g. catch-all page) is not a healthy save
    // endpoint — shape matters, not just reachability.
    stubFetch({ GET: () => jsonResponse(200, { hello: "world" }) });

    const el = makeEl("health-shape-el");
    const view = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(view.container.querySelector('[role="alert"]')?.textContent).toContain(
      "Save endpoint not reachable",
    );
  });

  it("shows NO notice when the endpoint answers with the health payload", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFetch({ GET: () => jsonResponse(200, { ok: true, version: 1, status: "tuner server active" }) });

    const el = makeEl("health-ok-el");
    const view = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("accepts the legacy health payload ({status:'tuner server active'} without ok)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFetch({ GET: () => jsonResponse(200, { status: "tuner server active" }) });

    const el = makeEl("health-legacy-el");
    const view = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("caches the result — remounting the Footer never re-pings", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFetch({ GET: () => Promise.reject(new TypeError("Failed to fetch")) });

    const el = makeEl("health-cache-el");
    const first = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });
    act(() => first.unmount());

    const second = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The cached bad result still surfaces on the remount.
    expect(second.container.querySelector('[role="alert"]')).toBeTruthy();
  });

  it("is dismissible, and the dismissal sticks across remounts", async () => {
    vi.stubEnv("NODE_ENV", "development");
    stubFetch({ GET: () => Promise.reject(new TypeError("Failed to fetch")) });

    const el = makeEl("health-dismiss-el");
    const first = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    const dismiss = first.container.querySelector(
      'button[aria-label="Dismiss save endpoint notice"]',
    ) as HTMLButtonElement;
    expect(dismiss, "notice must have a dismiss button").toBeTruthy();
    await act(async () => {
      fireEvent.click(dismiss);
    });
    expect(first.container.querySelector('[role="alert"]')).toBeNull();

    // Footer remounts on every element selection — the dismissed notice must
    // not nag again.
    act(() => first.unmount());
    const second = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });
    expect(second.container.querySelector('[role="alert"]')).toBeNull();
  });

  it("does not ping outside development (the endpoint deliberately 404s in prod)", async () => {
    // NODE_ENV stays "test" (vitest default) — closest analogue to prod here,
    // and what keeps every other Footer test free of stray health GETs.
    stubFetch({ GET: () => jsonResponse(200, { ok: true }) });

    const el = makeEl("health-prod-el");
    const view = render(<Footer element={el} onReset={() => {}} />);
    await act(async () => {
      await flushMicrotasks();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(view.container.querySelector('[role="alert"]')).toBeNull();
  });
});
