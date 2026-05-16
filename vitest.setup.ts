/**
 * vitest.setup.ts — global test setup
 *
 * Installs a working in-memory `localStorage` / `sessionStorage` polyfill
 * before each test file is evaluated.
 *
 * Why: Node 25 ships an experimental `localStorage` global that is a broken
 * stub (`{}` with no methods) unless `--localstorage-file=<path>` is provided.
 * That stub lives on `globalThis` and shadows happy-dom's real Storage on
 * `window.localStorage` (vitest's happy-dom env mirrors them — both end up
 * pointing to the same `{}`). Production code's `try/catch` silently swallows
 * the resulting TypeErrors, but tests that read/write storage directly blow up.
 *
 * See GH #45.
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  key(index: number): string | null {
    const keys = [...this.store.keys()];
    return index >= 0 && index < keys.length ? keys[index] : null;
  }
}

function installStorage(name: "localStorage" | "sessionStorage"): void {
  const impl = new MemoryStorage();
  Object.defineProperty(globalThis, name, {
    value: impl,
    writable: true,
    configurable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, name, {
      value: impl,
      writable: true,
      configurable: true,
    });
  }
}

installStorage("localStorage");
installStorage("sessionStorage");
