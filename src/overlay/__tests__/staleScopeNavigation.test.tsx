// @vitest-environment happy-dom
/**
 * staleScopeNavigation.test.tsx — stale class scope after breadcrumb / arrow-key
 * navigation (audit: 08-stale-scope-navigation, data-loss grade).
 *
 * Only the click path (handleSelect) re-derives the class-scope defaults for a
 * newly selected element. Navigating via the Header breadcrumb
 * (handleBreadcrumbClick) or the arrow keys (useOverlayHotkeys) swaps
 * `selectedEl` but keeps the PREVIOUS element's `scope`/`activeClassName` — so
 * the next edit resolves to a `class` target carrying the OLD element's class
 * and silently rewrites `.OldClass { prop !important }` across the page.
 *
 * These are MOUNTED tests of the real <Overlay/>: the real tuner:select event
 * drives the real click path, a real click on the Header's breadcrumb ancestor
 * drives the real breadcrumb path, and a real capture-phase ArrowUp keydown
 * drives the real hotkey path. The WebflowPanel mock captures the exact
 * `(element, scopeCtx)` pair the section controls would edit with, and the
 * "edit" is applied precisely the way sections do:
 * `styleEngine.apply(resolveTarget(element, scopeCtx), prop, value)`.
 * Where the edit landed is read back from the class-scope sheet.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Overlay } from "../shell/Overlay";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { destroyClassStyles, getClassScopeCss } from "../core/scope";

// The live `(element, scopeCtx)` pair the panel sections would edit with.
const captured = vi.hoisted(() => ({
  current: null as null | { element: Element; scopeCtx: ScopeContext },
}));

// Not under test — keep the mounted tree light. WebflowPanel is replaced by a
// prop recorder; the Header (breadcrumb under test) stays REAL.
vi.mock("../shell/WebflowPanel", () => ({
  WebflowPanel: (props: { element: Element; scopeCtx: ScopeContext }) => {
    captured.current = { element: props.element, scopeCtx: props.scopeCtx };
    return null;
  },
}));
vi.mock("../shell/PromptPanel", () => ({ PromptPanel: () => null }));
vi.mock("../variables/GlobalVariablesPanel", () => ({ GlobalVariablesPanel: () => null }));
vi.mock("../navigator/NavigatorPanel", () => ({ NavigatorPanel: () => null }));

// CSS-module classnames (webpack convention) so class scope engages.
const PARENT_CLASS = "Hero_hero__h1x2z";
const CHILD_CLASS = "Card_card__c3y4w";

let parentEl: HTMLElement;
let childEl: HTMLElement;
let unmountOverlay: (() => void) | null = null;

async function flushMicrotasks() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

/** Mount the real Overlay and select `el` via the real programmatic path. */
async function mountAndSelect(el: Element) {
  const { unmount } = render(<Overlay />);
  unmountOverlay = unmount;
  await act(async () => {
    document.dispatchEvent(new CustomEvent("tuner:select", { detail: el }));
    await flushMicrotasks();
  });
}

/** Click the Header's breadcrumb ancestor segment (the real DOM node). */
async function clickBreadcrumbAncestor() {
  const ancestor = document.querySelector("[data-breadcrumb-ancestor]");
  expect(ancestor, "breadcrumb ancestor segment should be rendered").toBeTruthy();
  await act(async () => {
    ancestor!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await flushMicrotasks();
  });
}

/** Drive the real arrow-key navigation (capture-phase document listener). */
async function pressArrowUp() {
  await act(async () => {
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true }),
    );
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
  captured.current = null;
  document.body.innerHTML = "";
  try { localStorage.clear(); } catch { /* ignore */ }

  parentEl = document.createElement("div");
  parentEl.className = PARENT_CLASS;
  childEl = document.createElement("div");
  childEl.className = CHILD_CLASS;
  parentEl.appendChild(childEl);
  document.body.appendChild(parentEl);
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
  vi.restoreAllMocks();
});

describe("stale scope after navigation (audit 08-stale-scope-navigation)", () => {
  it("click path (baseline): selecting the child scopes to the child's class", async () => {
    await mountAndSelect(childEl);
    expect(captured.current).not.toBeNull();
    expect(captured.current!.element).toBe(childEl);
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);
  });

  it("breadcrumb navigation re-derives scope for the new element and edits land on ITS class", async () => {
    await mountAndSelect(childEl);
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);

    // Navigate to the parent via the REAL breadcrumb path.
    await clickBreadcrumbAncestor();
    expect(captured.current!.element).toBe(parentEl);

    // The active scope must now target the parent's class — not the child's.
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(PARENT_CLASS);

    // And an edit made through the live panel props lands on the parent's
    // class rule, never the previous element's.
    applyEditWithLivePanelProps("color", "rgb(9, 9, 9)");
    const css = getClassScopeCss() ?? "";
    expect(css).toContain(PARENT_CLASS);
    expect(css).not.toContain(CHILD_CLASS);
  });

  it("arrow-key navigation re-derives scope for the new element and edits land on ITS class", async () => {
    await mountAndSelect(childEl);
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);

    // Navigate to the parent via the REAL ArrowUp hotkey path.
    await pressArrowUp();
    expect(captured.current!.element).toBe(parentEl);

    // The active scope must now target the parent's class — not the child's.
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(PARENT_CLASS);

    applyEditWithLivePanelProps("background-color", "rgb(8, 8, 8)");
    const css = getClassScopeCss() ?? "";
    expect(css).toContain(PARENT_CLASS);
    expect(css).not.toContain(CHILD_CLASS);
  });

  it("breadcrumb navigation to a class-less element falls back to element scope", async () => {
    // Parent WITHOUT a CSS-module class: navigation must drop class scope
    // entirely, not keep targeting the previous element's class.
    parentEl.className = "";
    await mountAndSelect(childEl);
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);

    await clickBreadcrumbAncestor();
    expect(captured.current!.element).toBe(parentEl);
    expect(captured.current!.scopeCtx.scope).toBe("element");
    expect(captured.current!.scopeCtx.activeClassName).toBeNull();
  });
});
