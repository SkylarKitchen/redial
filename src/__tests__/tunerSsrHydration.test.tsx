// @vitest-environment happy-dom
/**
 * tunerSsrHydration.test.tsx — hydration-mismatch audit issue:
 * **Mounting `<Tuner />` per the README causes a React hydration mismatch.**
 *
 * The public entry (`src/index.tsx`) gated rendering on
 * `typeof window === "undefined"` only. On the server that returns null, but
 * on the FIRST client render (hydration pass) window exists, so the Tuner
 * immediately rendered `<Overlay />` — markup the server never produced.
 * React logs a hydration error on every page load and falls back to a full
 * client re-render. The repo's own test-app quietly dodged this with an
 * undocumented `next/dynamic` `ssr: false` wrapper, so the documented
 * consumer path was broken while the demo worked.
 *
 * SSR-safety contract pinned here:
 *  1. Server render (no window) produces no markup.
 *  2. The first client render produces IDENTICAL output to the server
 *     (null), regardless of window being present — this is what makes
 *     hydration match by construction. (`renderToString` never runs effects,
 *     so with window present it is exactly the first client render.)
 *  3. Hydrating the server HTML logs ZERO hydration errors (console.error
 *     spied, `onRecoverableError` captured).
 *  4. No regression: after the mount effect runs, the overlay genuinely
 *     appears (Toolbar in the DOM) and the selection bootstrap works
 *     (`tuner:select` opens the inspector panel) — same mounted-Overlay
 *     pattern as overlaySaveShortcut.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderToString } from "react-dom/server";
import { hydrateRoot, type Root } from "react-dom/client";
import { render, act, cleanup } from "@testing-library/react";
import { Tuner } from "../index";

// Not under test — keep the mounted tree light and deterministic (same
// mocks as overlaySaveShortcut.test.tsx).
vi.mock("../overlay/shell/WebflowPanel", () => ({ WebflowPanel: () => null }));
vi.mock("../overlay/shell/PromptPanel", () => ({ PromptPanel: () => null }));
vi.mock("../overlay/variables/GlobalVariablesPanel", () => ({ GlobalVariablesPanel: () => null }));
vi.mock("../overlay/navigator/NavigatorPanel", () => ({ NavigatorPanel: () => null }));

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

/**
 * Render `<Tuner />` the way a real Next.js server does: no `window` global.
 * `vi.stubGlobal("window", undefined)` makes `typeof window` evaluate to
 * "undefined", exactly like Node during SSR. Restored via unstubAllGlobals.
 */
function renderOnServer(): string {
  vi.stubGlobal("window", undefined);
  try {
    return renderToString(<Tuner />);
  } finally {
    vi.unstubAllGlobals();
  }
}

let hydrationRoot: Root | null = null;

beforeEach(() => {
  // The Tuner only renders in development; vitest defaults NODE_ENV to "test".
  vi.stubEnv("NODE_ENV", "development");
  document.body.innerHTML = "";
});

afterEach(() => {
  if (hydrationRoot) {
    act(() => hydrationRoot!.unmount());
    hydrationRoot = null;
  }
  cleanup();
  document.body.innerHTML = "";
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Tuner SSR safety (hydration mismatch)", () => {
  it("server render (no window) produces no markup", () => {
    expect(renderOnServer()).toBe("");
  });

  it("first client render produces the same output as the server (null)", () => {
    const serverHtml = renderOnServer();

    // renderToString never runs effects, so with window present this is
    // byte-for-byte the FIRST client render — the one hydration compares.
    let firstClientHtml: string;
    try {
      firstClientHtml = renderToString(<Tuner />);
    } catch (err) {
      throw new Error(
        "Tuner's first render is not SSR-safe — rendering it without effects threw: " +
          (err as Error).message,
      );
    }

    expect(firstClientHtml).toBe(serverHtml);
  });

  it("hydrating the server HTML logs zero hydration errors", async () => {
    const serverHtml = renderOnServer();

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    const consoleErrors: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      consoleErrors.push(args.map(String).join(" "));
    });
    const recoverableErrors: unknown[] = [];

    await act(async () => {
      hydrationRoot = hydrateRoot(container, <Tuner />, {
        onRecoverableError: (err) => recoverableErrors.push(err),
      });
      await flushMicrotasks();
    });

    const hydrationConsoleErrors = consoleErrors.filter((msg) =>
      /hydrat|did not match|didn't match|server rendered/i.test(msg),
    );
    expect(recoverableErrors).toEqual([]);
    expect(hydrationConsoleErrors).toEqual([]);
  });

  it("hydration still mounts the real overlay after the effect pass", async () => {
    const serverHtml = renderOnServer();

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);

    await act(async () => {
      hydrationRoot = hydrateRoot(container, <Tuner />);
      await flushMicrotasks();
    });

    // The Toolbar FAB is the overlay's always-visible entry point.
    expect(
      container.querySelector('[title="Inspect element"]'),
      "Overlay Toolbar should appear after the mount effect",
    ).toBeTruthy();
  });
});

describe("Tuner client bootstrap (no regression from the mount gate)", () => {
  it("renders the Toolbar after mount and opens the inspector on tuner:select", async () => {
    const { container } = render(<Tuner />);
    await act(async () => {
      await flushMicrotasks();
    });

    // Overlay mounted: Toolbar FAB present.
    expect(container.querySelector('[title="Inspect element"]')).toBeTruthy();
    const rootsBefore = document.querySelectorAll(".__tuner-root").length;
    expect(rootsBefore).toBeGreaterThan(0);

    // Selection bootstrap (document listener wired in Overlay's effect):
    // programmatic select must open the inspector panel.
    const el = document.createElement("div");
    el.id = "hydration-target";
    document.body.appendChild(el);

    await act(async () => {
      document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
      await flushMicrotasks();
    });

    const rootsAfter = document.querySelectorAll(".__tuner-root").length;
    expect(
      rootsAfter,
      "inspector panel should mount after tuner:select",
    ).toBeGreaterThan(rootsBefore);
  });
});
