// @vitest-environment happy-dom
/**
 * Issue #107 — the localStorage/sessionStorage polyfill (vitest.setup.ts)
 * must reset between tests.
 *
 * Before the fix, the MemoryStorage backing Map was installed once per test
 * file and never cleared, so anything a test wrote leaked into every later
 * test in the same file (the order coupling that already bit
 * useSwatches.test.ts). The global beforeEach in vitest.setup.ts now clears
 * both storages, making test order irrelevant.
 *
 * These tests are order-dependent BY DESIGN (vitest runs tests in a file in
 * declaration order): the first test writes, the following tests assert the
 * writes did not leak. Reload-persistence tests that write → vi.resetModules
 * → read WITHIN one test body are unaffected — clearing only happens between
 * tests.
 */
import { describe, it, expect } from "vitest";

const KEY = "__storage_isolation_probe__";

describe("storage isolation between tests (#107)", () => {
  it("writes to both storages (setup for the isolation assertions below)", () => {
    localStorage.setItem(KEY, "leaked");
    sessionStorage.setItem(KEY, "leaked");
    // sanity: the polyfill itself works within a test
    expect(localStorage.getItem(KEY)).toBe("leaked");
    expect(sessionStorage.getItem(KEY)).toBe("leaked");
  });

  it("localStorage starts empty in the next test — no cross-test leakage", () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("sessionStorage starts empty in the next test — no cross-test leakage", () => {
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("clearing between tests does not break write→read within a single test", () => {
    localStorage.setItem(KEY, "same-test");
    expect(localStorage.getItem(KEY)).toBe("same-test");
    localStorage.removeItem(KEY);
  });
});
