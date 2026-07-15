// @vitest-environment happy-dom
/**
 * Element-scope save — overlay half (audit 06 + ADR-0011 provenance).
 *
 * An edit made under NO class (element provenance) previews on ONE element,
 * so saving it must persist with element semantics: enrichment tags stateless
 * base changes with `elementScope: { jsxSourceFile?, jsxSourceLine?,
 * existingClasses }` (the same anchors createClass uses) INSTEAD of resolving
 * a shared CSS rule target. The server writes those into the element's JSX
 * `style` attribute — never the class rule.
 *
 * Targeting derives from each entry's RECORDED provenance (ADR-0011), not
 * from any scoping context at save time — the old `elementScopeSave` opt-in
 * flag (and the Footer-vs-Save-All divergence it created) is gone: every
 * save surface resolves the same edit to the same file.
 *
 * Deliberately unchanged:
 *  - class-provenance entries (rule targeting);
 *  - var-redirected edits (a var edit is inherently global — definition site);
 *  - state-tagged entries (a pseudo-state can't be an inline style; the
 *    `.class:state` rule path is pinned by commitUtils.test.ts / issue #57);
 *  - breakpoint-tagged entries (an inline style can't express @media; the
 *    class-@media file-bound path is pinned by breakpointFileSave.test.tsx).
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

describe("element provenance — enrichment tags elementScope, not the class rule", () => {
  it("tags a stateless element-provenance change with elementScope and NO CSS rule targeting", () => {
    const el = makeEl("card");
    const [c] = enrichChangesForCommit(el, [entry()]);

    expect(c.elementScope).toBeTruthy();
    expect(c.elementScope?.existingClasses).toBe("card");
    // The exact bug: element provenance must NOT resolve the shared rule's file/class.
    expect(c.sourceFile).toBeUndefined();
    expect(c.className).toBeUndefined();
  });

  it("excludes session-attached classes and tuner chrome from the existingClasses anchor", () => {
    const el = makeEl("card __tuner-outline");
    const res = attachClassToElement(el, "session-temp");
    expect(res.ok).toBe(true);

    const [c] = enrichChangesForCommit(el, [entry()]);
    expect(c.elementScope?.existingClasses).toBe("card");
  });

  it("keeps class-provenance entries on rule targeting (no elementScope)", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ className: "Button_btn__a1b2c" })]);

    expect(c.elementScope).toBeUndefined();
    expect(c.className).toBe("btn");
  });

  it("provenance decides per entry — a mixed batch routes each change to its own target", () => {
    // Inexpressible before ADR-0011: one element, one save, both targets.
    const el = makeEl("Button_btn__a1b2c");
    const [inline, ruled] = enrichChangesForCommit(el, [
      entry(),
      entry({ prop: "background-color", className: "Button_btn__a1b2c" }),
    ]);

    expect(inline.elementScope).toBeTruthy();
    expect(inline.className).toBeUndefined();
    expect(ruled.elementScope).toBeUndefined();
    expect(ruled.className).toBe("btn");
  });

  it("keeps var-redirected edits on the variable's definition site (a var edit is global)", () => {
    const el = makeEl("card");
    el.style.setProperty("color", "var(--brand)");
    const [c] = enrichChangesForCommit(el, [entry()]);

    expect(c.prop).toBe("--brand");
    expect(c.elementScope).toBeUndefined();
  });

  it("keeps state-tagged entries on the .class:state rule path (inline styles can't express :hover)", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ state: "hover" })]);

    expect(c.elementScope).toBeUndefined();
    expect(c.state).toBe("hover");
    expect(c.className).toBe("btn");
  });

  it("keeps breakpoint-tagged entries on the class-@media path — never elementScope", () => {
    const el = makeEl("Button_btn__a1b2c");
    const [c] = enrichChangesForCommit(el, [entry({ breakpoint: "768" })]);

    expect(c.elementScope).toBeUndefined();
    expect(c.breakpoint).toEqual({ id: "768", minWidth: 768 });
    expect(c.className).toBe("btn");
  });

  it("keeps Tailwind elements on the utility-class path (already element-level blast radius)", () => {
    const el = makeEl("flex items-center gap-2 p-4");
    const [c] = enrichChangesForCommit(el, [entry()]);

    expect(c.mode).toBe("tailwind");
    expect(c.elementScope).toBeUndefined();
  });
});

// ─── Footer save POST ─────────────────────────────────────────────────

describe("Footer save POST — targeting follows recorded provenance, not the toggle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
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

  it("an element-provenance edit POSTs with elementScope and no class-rule targeting", async () => {
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

  it("a class-provenance edit keeps rule targeting even when the panel has toggled back to element scope", async () => {
    // THE ADR-0011 regression: edit under a class, re-toggle the panel to
    // element, hit Save — the edit must still land in the class rule. Before
    // provenance, the save-time scoping context rerouted it to a JSX style
    // write (Footer) or a class rule (Save All) depending on the button.
    const el = makeEl("Button_btn__a1b2c");
    // Batched like every real interaction (scrub/slider/input commit): the
    // batch defers the class-rule rebuild (issue #29) so the mirror captures
    // the PRE-rule computed value as `initial` and the edit registers dirty.
    styleEngine.beginBatch();
    styleEngine.apply({ scope: "class", el, className: "Button_btn__a1b2c" }, "color", "red");
    styleEngine.endBatch();

    await renderAndSave(el, "element");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.changes.length).toBeGreaterThan(0);
    for (const c of body.changes) {
      expect(c.elementScope).toBeUndefined();
    }
    expect(body.changes[0].className).toBe("btn");
  });
});
