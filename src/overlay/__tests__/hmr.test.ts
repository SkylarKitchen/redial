// @vitest-environment happy-dom
/**
 * Issue #106 — behavioral coverage for src/overlay/core/hmr.ts (onHmrUpdate).
 *
 * Branch selection in onHmrUpdate depends on module-environment handles that
 * vitest fixes at transform time: vitest injects its own per-module
 * `import.meta.hot` stub whose `on` is a no-op (`() => {}`), so events can
 * never fire through it, and it shadows the webpack `module.hot` branch
 * entirely. There is no seam to inject a runtime (see #106's refactor note).
 *
 * To exercise the real logic with controllable runtimes, the harness below
 * evaluates the REAL hmr.ts source — esbuild-transformed to CJS with
 * `import.meta.hot` redirected to an injectable global — against fake
 * Vite/Turbopack and webpack hot APIs. This executes the actual module code
 * (not a reimplementation); only the environment handles are substituted.
 *
 * Direct-import tests at the bottom cover what the untransformed module can
 * reach in vitest: runtime detection and `off`-less cleanup safety.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { onHmrUpdate } from "../core/hmr";

const hmrPath = resolve(dirname(fileURLToPath(import.meta.url)), "../core/hmr.ts");

const HOT_GLOBAL = "__hmr_test_import_meta_hot__";

type HmrExports = { onHmrUpdate: (cb: () => void) => (() => void) | null };

let compiledCache: string | null = null;
function compile(): string {
  if (compiledCache === null) {
    const src = readFileSync(hmrPath, "utf8");
    compiledCache = transformSync(src, {
      loader: "ts",
      format: "cjs",
      // Redirect the module's `import.meta.hot` reads to a global we control.
      define: { "import.meta.hot": `globalThis.${HOT_GLOBAL}` },
    }).code;
  }
  return compiledCache;
}

/** Evaluate the real hmr.ts with controlled `import.meta.hot` / `module.hot`. */
function loadHmr(env: { importMetaHot?: unknown; moduleHot?: unknown }): HmrExports {
  (globalThis as Record<string, unknown>)[HOT_GLOBAL] = env.importMetaHot;
  const cjsModule: { exports: HmrExports; hot: unknown } = {
    exports: {} as HmrExports,
    hot: env.moduleHot,
  };
  new Function("module", "exports", compile())(cjsModule, cjsModule.exports);
  return cjsModule.exports;
}

// ─── Fake runtimes ───────────────────────────────────────────────────

type Listener = () => void;

function makeViteHot({ withOff = true }: { withOff?: boolean } = {}) {
  const listeners = new Map<string, Set<Listener>>();
  const hot: {
    on: (event: string, cb: Listener) => void;
    off?: (event: string, cb: Listener) => void;
    emit: (event: string) => void;
    count: (event: string) => number;
  } = {
    on(event, cb) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(cb);
    },
    emit(event) {
      listeners.get(event)?.forEach((cb) => cb());
    },
    count(event) {
      return listeners.get(event)?.size ?? 0;
    },
  };
  if (withOff) {
    hot.off = (event, cb) => {
      listeners.get(event)?.delete(cb);
    };
  }
  return hot;
}

function makeWebpackHot({ withRemove = true }: { withRemove?: boolean } = {}) {
  const handlers: Array<(status: string) => void> = [];
  const hot: {
    addStatusHandler: (h: (status: string) => void) => void;
    removeStatusHandler?: (h: (status: string) => void) => void;
    setStatus: (status: string) => void;
    handlers: Array<(status: string) => void>;
  } = {
    handlers,
    addStatusHandler(h) {
      handlers.push(h);
    },
    setStatus(status) {
      [...handlers].forEach((h) => h(status));
    },
  };
  if (withRemove) {
    hot.removeStatusHandler = (h) => {
      const i = handlers.indexOf(h);
      if (i !== -1) handlers.splice(i, 1);
    };
  }
  return hot;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as Record<string, unknown>)[HOT_GLOBAL];
});

// ─── Turbopack / Vite branch (import.meta.hot) ───────────────────────

describe("onHmrUpdate — Turbopack/Vite runtime (import.meta.hot)", () => {
  it("subscribes to both turbopack:afterUpdate and vite:afterUpdate", () => {
    const hot = makeViteHot();
    const cleanup = loadHmr({ importMetaHot: hot }).onHmrUpdate(() => {});
    expect(typeof cleanup).toBe("function");
    expect(hot.count("turbopack:afterUpdate")).toBe(1);
    expect(hot.count("vite:afterUpdate")).toBe(1);
  });

  it("invokes the callback 100ms after a turbopack:afterUpdate — debounced, not immediate", () => {
    const hot = makeViteHot();
    const cb = vi.fn();
    loadHmr({ importMetaHot: hot }).onHmrUpdate(cb);

    hot.emit("turbopack:afterUpdate");
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("vite:afterUpdate triggers the same debounced callback", () => {
    const hot = makeViteHot();
    const cb = vi.fn();
    loadHmr({ importMetaHot: hot }).onHmrUpdate(cb);

    hot.emit("vite:afterUpdate");
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("rapid-fire updates coalesce into a single callback", () => {
    const hot = makeViteHot();
    const cb = vi.fn();
    loadHmr({ importMetaHot: hot }).onHmrUpdate(cb);

    for (let i = 0; i < 5; i++) hot.emit("turbopack:afterUpdate");
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("each new update resets the debounce window", () => {
    const hot = makeViteHot();
    const cb = vi.fn();
    loadHmr({ importMetaHot: hot }).onHmrUpdate(cb);

    hot.emit("turbopack:afterUpdate");
    vi.advanceTimersByTime(50);
    hot.emit("vite:afterUpdate"); // batched update from the other event name
    vi.advanceTimersByTime(99); // 149ms after first event — window was reset
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cleanup unsubscribes both events and cancels a pending debounce", () => {
    const hot = makeViteHot();
    const cb = vi.fn();
    const cleanup = loadHmr({ importMetaHot: hot }).onHmrUpdate(cb)!;

    hot.emit("turbopack:afterUpdate");
    cleanup();
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
    expect(hot.count("turbopack:afterUpdate")).toBe(0);
    expect(hot.count("vite:afterUpdate")).toBe(0);
  });

  it("cleanup is best-effort when the runtime lacks hot.off (still cancels the pending timer, no throw)", () => {
    const hot = makeViteHot({ withOff: false });
    const cb = vi.fn();
    const cleanup = loadHmr({ importMetaHot: hot }).onHmrUpdate(cb)!;

    hot.emit("turbopack:afterUpdate");
    expect(() => cleanup()).not.toThrow();
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
  });

  it("import.meta.hot takes priority over module.hot when both exist", () => {
    const viteHot = makeViteHot();
    const webpackHot = makeWebpackHot();
    loadHmr({ importMetaHot: viteHot, moduleHot: webpackHot }).onHmrUpdate(() => {});
    expect(viteHot.count("turbopack:afterUpdate")).toBe(1);
    expect(webpackHot.handlers).toHaveLength(0);
  });
});

// ─── webpack branch (module.hot) ─────────────────────────────────────

describe("onHmrUpdate — webpack runtime (module.hot)", () => {
  it("registers a status handler and fires the debounced callback on 'idle'", () => {
    const hot = makeWebpackHot();
    const cb = vi.fn();
    const cleanup = loadHmr({ moduleHot: hot }).onHmrUpdate(cb);

    expect(typeof cleanup).toBe("function");
    expect(hot.handlers).toHaveLength(1);
    hot.setStatus("idle");
    expect(cb).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("non-idle statuses never trigger the callback", () => {
    const hot = makeWebpackHot();
    const cb = vi.fn();
    loadHmr({ moduleHot: hot }).onHmrUpdate(cb);

    for (const status of ["check", "prepare", "ready", "dispose", "apply", "abort", "fail"]) {
      hot.setStatus(status);
    }
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
  });

  it("repeated idle statuses coalesce into a single callback", () => {
    const hot = makeWebpackHot();
    const cb = vi.fn();
    loadHmr({ moduleHot: hot }).onHmrUpdate(cb);

    hot.setStatus("idle");
    hot.setStatus("idle");
    hot.setStatus("idle");
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cleanup removes the status handler and cancels a pending debounce", () => {
    const hot = makeWebpackHot();
    const cb = vi.fn();
    const cleanup = loadHmr({ moduleHot: hot }).onHmrUpdate(cb)!;

    hot.setStatus("idle");
    cleanup();
    vi.advanceTimersByTime(500);
    expect(cb).not.toHaveBeenCalled();
    expect(hot.handlers).toHaveLength(0);
  });

  it("cleanup tolerates webpack versions without removeStatusHandler", () => {
    const hot = makeWebpackHot({ withRemove: false });
    const cleanup = loadHmr({ moduleHot: hot }).onHmrUpdate(() => {})!;
    expect(() => cleanup()).not.toThrow();
  });
});

// ─── No runtime ──────────────────────────────────────────────────────

describe("onHmrUpdate — no HMR runtime", () => {
  it("returns null when neither import.meta.hot nor module.hot is present", () => {
    const result = loadHmr({}).onHmrUpdate(() => {});
    expect(result).toBeNull();
  });
});

// ─── Direct import — real module in vitest's own environment ─────────

describe("onHmrUpdate — direct import (vitest's Vite-flavored environment)", () => {
  it("detects vitest's import.meta.hot and returns a cleanup function", () => {
    const cleanup = onHmrUpdate(() => {});
    // vitest provides a Vite-style import.meta.hot stub, so detection must
    // report a live runtime (cleanup), not null.
    expect(typeof cleanup).toBe("function");
    // vitest's hot stub has no `off` — cleanup must stay safe (hot.off?.()).
    expect(() => cleanup!()).not.toThrow();
  });
});
