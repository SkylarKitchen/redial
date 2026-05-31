// @vitest-environment happy-dom
/**
 * Session persistence — apply.ts restoreSession() round-trip.
 *
 * Verified live in the /demo panel: a fresh page load showed "Save (2)"
 * because apply.ts rehydrates prior overrides from localStorage
 * (key `__tuner_session:<pathname>`). apply.test.ts covers apply/diff/undo/
 * reset but NOT the restore path — this file locks down restoreSession().
 *
 * We seed localStorage directly (mirroring the on-disk shape captured in the
 * browser) and assert restoreSession re-resolves selectors and re-applies the
 * persisted inline styles.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { restoreSession, resetAll, isDirty, overrideCount } from "../core/apply";

// Mirrors apply.ts storageKey(): STORAGE_PREFIX + location.pathname
const KEY = "__tuner_session:" + location.pathname;

type Session = Record<string, Record<string, { initial: string; current: string }>>;

function seed(session: Session): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

beforeEach(() => {
  resetAll();
  document.body.innerHTML = "";
  localStorage.clear();
});

afterEach(() => {
  resetAll();
  localStorage.clear();
});

describe("restoreSession — rehydrate overrides from localStorage", () => {
  it("returns 0 when no session is stored", () => {
    expect(restoreSession()).toBe(0);
  });

  it("re-applies a persisted override to a matching element (with !important)", () => {
    const el = document.createElement("div");
    el.id = "restore-target";
    document.body.appendChild(el);

    seed({ "#restore-target": { color: { initial: "rgb(0, 0, 0)", current: "red" } } });

    expect(restoreSession()).toBe(1);
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyPriority("color")).toBe("important");
  });

  it("skips selectors whose element is no longer on the page", () => {
    seed({ "#not-on-page": { color: { initial: "rgb(0, 0, 0)", current: "red" } } });
    expect(restoreSession()).toBe(0);
  });

  it("restores multiple properties across multiple elements and counts them", () => {
    const a = document.createElement("div");
    a.id = "a";
    document.body.appendChild(a);
    const b = document.createElement("div");
    b.id = "b";
    document.body.appendChild(b);

    seed({
      "#a": {
        color: { initial: "rgb(0, 0, 0)", current: "red" },
        "padding-top": { initial: "0px", current: "8px" },
      },
      "#b": { display: { initial: "block", current: "flex" } },
    });

    expect(restoreSession()).toBe(3);
    expect(a.style.getPropertyValue("color")).toBe("red");
    expect(a.style.getPropertyValue("padding-top")).toBe("8px");
    expect(b.style.getPropertyValue("display")).toBe("flex");
  });

  it("tracks rehydrated overrides so the panel reports them as changed", () => {
    const el = document.createElement("div");
    el.id = "tracked";
    document.body.appendChild(el);

    seed({ "#tracked": { color: { initial: "rgb(0, 0, 0)", current: "red" } } });
    restoreSession();

    expect(isDirty(el, "color")).toBe(true);
    expect(overrideCount(el)).toBe(1);
  });

  it("recovers from corrupt JSON by returning 0 without throwing", () => {
    localStorage.setItem(KEY, "{not valid json");
    expect(() => restoreSession()).not.toThrow();
    expect(restoreSession()).toBe(0);
  });
});
