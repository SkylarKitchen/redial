// @vitest-environment happy-dom
/**
 * Element-scope save — overlay half (audit 06-element-scope-save).
 *
 * Selecting "element" scope previews the edit on ONE element, so saving it
 * must persist with element semantics. The Footer save pipeline (the ONE
 * pipeline — Save button, Cmd+S, palette) opts in via `elementScopeSave`;
 * enrichment then tags stateless base changes with
 * `elementScope: { jsxSourceFile?, jsxSourceLine?, existingClasses }` (the
 * same anchors createClass uses) INSTEAD of resolving a shared CSS rule
 * target. The server writes those into the element's JSX `style` attribute —
 * never the class rule.
 *
 * Deliberately unchanged:
 *  - class-scope enrichment (rule targeting);
 *  - var-redirected edits (a var edit is inherently global — definition site);
 *  - state-tagged entries (a pseudo-state can't be an inline style; the
 *    `.class:state` rule path is pinned by commitUtils.test.ts / issue #57);
 *  - breakpoint-tagged entries (an inline style can't express @media; the
 *    class-@media file-bound path is pinned by breakpointFileSave.test.tsx);
 *  - surfaces without per-edit scope provenance (ChangesDrawer Save All
 *    passes no `elementScopeSave` and keeps legacy rule targeting).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createRef } from "react";
import { Footer } from "../shell/Footer";
import { styleEngine } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { enrichChangesForCommit } from "../core/commitUtils";
import {
  attachClassToElement,
  detachSessionClasses,
  destroyClassStyles,
} from "../core/scope";
import type { DiffEntry } from "../core/apply";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(className = ""): HTMLElement {
  const el = document.createElement("div");
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

const entry = (over: Partial<DiffEntry> = {}): DiffEntry => ({
  prop: "color",
  from: "blue",
  to: "red",
  ...over,
});

const elementCtx = {
  scope: "element",
  activeClassName: null,
  activeState: "none",
  elementScopeSave: true,
} as const;

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  vi.restoreAllMocks();
});

// ─── Enrichment ───────────────────────────────────────────────────────

describe("element scope save — enrichment tags elementScope, not the class rule", () => {
  it("tags a stateless base change with elementScope and NO CSS rule targeting", () => {
    const el = makeEl("card");
    const [c] = enrichChangesForCommit(el, [entry()], elementCtx);

    expect(c.elementScope).toBeTruthy();
    expect(c.elementScope?.existingClasses).toBe("card");
    // The exact bug: element scope must NOT resolve the shared rule's file/class.
    expect(c.sourceFile).toBeUndefined();
    expect(c.className).toBeUndefined();
  });

  it("excludes session-attached classes and tuner chrome from the existingClasses anchor", () => {
    const el = makeEl("card __tuner-outline");
    const res = attachClassToElement(el, "session-temp");
    expect(res.ok).toBe(true);

    const [c] = enrichChangesForCommit(el, [entry()], elementCtx);
    expect(c.elementScope?.existingClasses).toBe("card");
  });

  it("leaves class-scope enrichment unchanged (rule targeting, no elementScope)", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "class",
      activeClassName: "Button_btn__a1b2c",
      activeState: "none",
      elementScopeSave: true, // the flag only matters IN element scope
    });

    expect(c.elementScope).toBeUndefined();
    expect(c.className).toBe("btn");
  });

  it("keeps legacy targeting on surfaces that do not opt in (no elementScopeSave)", () => {
    const el = makeEl("card");
    const [c] = enrichChangesForCommit(el, [entry()], {
      scope: "element",
      activeClassName: null,
      activeState: "none",
    });
    expect(c.elementScope).toBeUndefined();
  });

  it("keeps var-redirected edits on the variable's definition site (a var edit is global)", () => {
    const el = makeEl("card");
    el.style.setProperty("color", "var(--brand)");
    const [c] = enrichChangesForCommit(el, [entry()], elementCtx);

    expect(c.prop).toBe("--brand");
    expect(c.elementScope).toBeUndefined();
  });

  it("keeps state-tagged entries on the .class:state rule path (inline styles can't express :hover)", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })], elementCtx);

    expect(c.elementScope).toBeUndefined();
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("keeps breakpoint-tagged entries on the class-@media path — never elementScope", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ breakpoint: "768" })], elementCtx);

    expect(c.elementScope).toBeUndefined();
    expect(c.breakpoint).toEqual({ id: "768", minWidth: 768 });
    expect(c.className).toBe("btn");
  });

  it("keeps Tailwind elements on the utility-class path (already element-level blast radius)", () => {
    const el = makeEl("flex items-center gap-2 p-4");
    const [c] = enrichChangesForCommit(el, [entry()], elementCtx);

    expect(c.mode).toBe("tailwind");
    expect(c.elementScope).toBeUndefined();
  });
});

// ─── Footer save POST ─────────────────────────────────────────────────

describe("element scope save — Footer save POST carries elementScope", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ written: ["app/page.tsx"], failed: [] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.resolve()) },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  async function flushMicrotasks() {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  }

  async function renderAndSave(el: HTMLElement, scope: "element" | "class", activeClassName: string | null = null) {
    const saveRef = createRef<(() => void) | null>() as React.MutableRefObject<(() => void) | null>;
    saveRef.current = null;
    await act(async () => {
      root.render(
        <Footer
          element={el}
          onReset={() => {}}
          saveRef={saveRef}
          scopeCtx={{ scope, activeClassName, activeState: "none" }}
        />,
      );
    });
    expect(saveRef.current).toBeTypeOf("function");
    await act(async () => {
      saveRef.current!();
      await flushMicrotasks();
    });
  }

  it("an element-scope edit POSTs with elementScope and no class-rule targeting", async () => {
    const el = makeEl("card");
    styleEngine.apply({ scope: "element", el }, "color", "red");

    await renderAndSave(el, "element");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.mode).toBeUndefined();
    expect(body.changes).toHaveLength(1);
    expect(body.changes[0].prop).toBe("color");
    expect(body.changes[0].elementScope).toBeTruthy();
    expect(body.changes[0].elementScope.existingClasses).toBe("card");
    expect(body.changes[0].className).toBeUndefined();
    expect(body.changes[0].sourceFile).toBeUndefined();
  });

  it("a class-scope save POSTs WITHOUT elementScope (rule targeting preserved)", async () => {
    const el = makeEl("Button_btn__a1b2c");
    // The tracked override; enrichment routes on the PANEL's current scope
    // (the Footer's scopeCtx below), which is what's under test here.
    styleEngine.apply({ scope: "element", el }, "color", "red");

    await renderAndSave(el, "class", "Button_btn__a1b2c");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes.length).toBeGreaterThan(0);
    for (const c of body.changes) {
      expect(c.elementScope).toBeUndefined();
    }
    expect(body.changes[0].className).toBe("btn");
  });
});
