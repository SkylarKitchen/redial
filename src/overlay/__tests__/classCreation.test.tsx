// @vitest-environment happy-dom
/**
 * Class creation — the Webflow "type a class name" flow, overlay half
 * (audit: 05-class-creation).
 *
 * The Header's scope-pill row gains a "+ class" affordance: an inline text
 * input that (1) validates the draft as a CSS identifier that isn't already on
 * the element, (2) suggests existing page classes matching the prefix (the
 * flow doubles as "attach existing class"), and (3) on commit attaches the
 * class to the element (`element.classList.add`) and makes it the active
 * scope, so subsequent edits land on the new class via the existing
 * class-scope machinery.
 *
 * Attaching is part of the session's UNSAVED state: the Discard path
 * (CloseWarningBar → styleEngine.resetAll) must remove the attached class.
 *
 * These are MOUNTED tests of the real <Overlay/> (WebflowPanel mocked to a
 * prop recorder, Header REAL) — the same harness as
 * staleScopeNavigation.test.tsx.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";
import { Overlay } from "../shell/Overlay";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import {
  destroyClassStyles,
  getClassScopeCss,
  attachClassToElement,
  getSessionAttachedClasses,
  detachSessionClasses,
} from "../core/scope";
import { enrichChangesForCommit } from "../core/commitUtils";

// The live `(element, scopeCtx)` pair the panel sections would edit with.
const captured = vi.hoisted(() => ({
  current: null as null | { element: Element; scopeCtx: ScopeContext },
}));

vi.mock("../shell/WebflowPanel", () => ({
  WebflowPanel: (props: { element: Element; scopeCtx: ScopeContext }) => {
    captured.current = { element: props.element, scopeCtx: props.scopeCtx };
    return null;
  },
}));
vi.mock("../shell/PromptPanel", () => ({ PromptPanel: () => null }));
vi.mock("../variables/GlobalVariablesPanel", () => ({ GlobalVariablesPanel: () => null }));
vi.mock("../navigator/NavigatorPanel", () => ({ NavigatorPanel: () => null }));

let targetEl: HTMLElement;
let unmountOverlay: (() => void) | null = null;

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

async function mountAndSelect(el: Element) {
  const { unmount } = render(<Overlay />);
  unmountOverlay = unmount;
  await act(async () => {
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    await flushMicrotasks();
  });
}

function addClassButton(): HTMLElement {
  const btn = document.querySelector('[aria-label="Add class"]');
  expect(btn, 'the "+ class" affordance should render in the scope row').toBeTruthy();
  return btn as HTMLElement;
}

function classInput(): HTMLInputElement {
  const input = document.querySelector('[aria-label="New class name"]');
  expect(input, "the inline class-name input should render").toBeTruthy();
  return input as HTMLInputElement;
}

async function openInputAndType(value: string) {
  await act(async () => {
    fireEvent.click(addClassButton());
    await flushMicrotasks();
  });
  await act(async () => {
    fireEvent.change(classInput(), { target: { value } });
    await flushMicrotasks();
  });
}

async function pressEnter() {
  await act(async () => {
    fireEvent.keyDown(classInput(), { key: "Enter" });
    await flushMicrotasks();
  });
}

/** Apply an edit exactly the way a section control does. */
function applyEditWithLivePanelProps(prop: string, value: string) {
  const { element, scopeCtx } = captured.current!;
  styleEngine.apply(resolveTarget(element, scopeCtx), prop, value);
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  captured.current = null;
  document.body.innerHTML = "";
  try { localStorage.clear(); } catch { /* ignore */ }

  targetEl = document.createElement("div");
  document.body.appendChild(targetEl);
});

afterEach(() => {
  if (unmountOverlay) {
    act(() => unmountOverlay!());
    unmountOverlay = null;
  }
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  vi.restoreAllMocks();
});

describe("class creation UI (audit 05-class-creation)", () => {
  it("typing a name attaches the class and makes it the active scope; edits land on it", async () => {
    await mountAndSelect(targetEl);
    expect(captured.current!.scopeCtx.scope).toBe("element");

    await openInputAndType("hero-card");
    await pressEnter();

    // Attached to the DOM element and registered as session state.
    expect(targetEl.classList.contains("hero-card")).toBe(true);
    expect(getSessionAttachedClasses(targetEl)).toContain("hero-card");

    // The new class is the active scope.
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe("hero-card");

    // An edit made through the live panel props lands on the new class rule.
    applyEditWithLivePanelProps("color", "rgb(9, 9, 9)");
    const css = getClassScopeCss() ?? "";
    expect(css).toContain("hero-card");
    expect(css).toContain("color: rgb(9, 9, 9)");
  });

  it("rejects an invalid CSS identifier with a visible error and no attach", async () => {
    await mountAndSelect(targetEl);

    await openInputAndType("1bad");
    await pressEnter();

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent ?? "").toMatch(/not a valid/i);
    expect(targetEl.classList.contains("1bad")).toBe(false);
    expect(captured.current!.scopeCtx.scope).toBe("element");
  });

  it("rejects a class that is already on the element", async () => {
    targetEl.className = "plainhero";
    await mountAndSelect(targetEl);

    await openInputAndType("plainhero");
    await pressEnter();

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent ?? "").toMatch(/already/i);
    expect(Array.from(targetEl.classList).filter((c) => c === "plainhero")).toHaveLength(1);
    expect(getSessionAttachedClasses(targetEl)).toHaveLength(0);
  });

  it("suggests existing page classes matching the prefix, and clicking one attaches it", async () => {
    const other = document.createElement("div");
    other.className = "hero-banner";
    document.body.appendChild(other);

    await mountAndSelect(targetEl);
    await openInputAndType("hero");

    const suggestion = document.querySelector('[data-class-suggestion="hero-banner"]');
    expect(suggestion, "existing page class should be suggested").toBeTruthy();

    await act(async () => {
      fireEvent.click(suggestion!);
      await flushMicrotasks();
    });

    expect(targetEl.classList.contains("hero-banner")).toBe(true);
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe("hero-banner");
  });

  it("does not suggest the panel's own chrome classes", async () => {
    await mountAndSelect(targetEl);
    await openInputAndType("__tuner");
    expect(document.querySelector("[data-class-suggestion]")).toBeNull();
  });

  it("Discard (styleEngine.resetAll) removes the session-attached class", async () => {
    await mountAndSelect(targetEl);
    await openInputAndType("hero-card");
    await pressEnter();
    expect(targetEl.classList.contains("hero-card")).toBe(true);

    // The CloseWarningBar Discard path: styleEngine.resetAll() + mode reset.
    act(() => {
      styleEngine.resetAll();
      resetAllModeOverrides();
    });

    expect(targetEl.classList.contains("hero-card")).toBe(false);
    expect(getSessionAttachedClasses(targetEl)).toHaveLength(0);
  });
});

describe("commit payload enrichment for created classes", () => {
  it("carries createClass with the name and the element's pre-attach classes", () => {
    const el = document.createElement("div");
    el.className = "Card_card__x1z2";
    document.body.appendChild(el);

    const res = attachClassToElement(el, "promo");
    expect(res.ok).toBe(true);

    // The edit was applied under the freshly-attached class — provenance
    // rides the entry (ADR-0011).
    const enriched = enrichChangesForCommit(el, [
      { prop: "color", from: "rgb(0, 0, 0)", to: "rgb(1, 2, 3)", className: "promo" },
    ]);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].className).toBe("promo");
    expect(enriched[0].createClass?.name).toBe("promo");
    // existingClasses = the element's classes BEFORE the session attach, so
    // the server can locate the JSX className attribute to rewrite.
    expect(enriched[0].createClass?.existingClasses).toBe("Card_card__x1z2");
  });

  it("adds no createClass for a plain module-class save", () => {
    const el = document.createElement("div");
    el.className = "Card_card__x1z2";
    document.body.appendChild(el);

    const enriched = enrichChangesForCommit(el, [
      { prop: "color", from: "rgb(0, 0, 0)", to: "rgb(1, 2, 3)", className: "Card_card__x1z2" },
    ]);

    expect(enriched[0].createClass).toBeUndefined();
    expect(enriched[0].className).toBe("card");
  });
});
