// @vitest-environment happy-dom
/**
 * Header — keyboard accessibility (issue #85, Header piece).
 *
 * Three mouse-only surfaces in the panel Header must be keyboard-operable:
 *
 *   1. Changes badge — the unsaved-changes count was a <div onClick>: not
 *      focusable, no accessible name. It must be a native <button> with an
 *      aria-label like "3 unsaved changes — open changes drawer" that
 *      activates on Enter AND Space.
 *   2. Scope pills — the class/element scope selector (including
 *      session-attached class pills) is a single-select group, so it must be
 *      a role="radiogroup" of focusable role="radio" buttons with
 *      aria-checked, each activatable via Enter AND Space. The "+ class"
 *      pill must likewise open its inline input from the keyboard.
 *   3. Breadcrumb — each ancestor crumb must be focusable, carry an
 *      aria-label ("Select parent <tag>"), and navigate on Enter AND Space
 *      through the same selection-change path as a click.
 *
 * Badge/pill ARIA contracts are tested on a directly-rendered real <Header/>
 * (the headerClassReuseCount.test.tsx harness); scope switches and breadcrumb
 * navigation are tested on the real mounted <Overlay/> (the
 * classCreation.test.tsx / staleScopeNavigation.test.tsx harness) so the
 * assertion is that the LIVE scope state actually changes, not just that a
 * callback fired.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Header } from "../shell/Header";
import { Overlay } from "../shell/Overlay";
import { styleEngine, type ScopeContext } from "../core/engine";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { destroyClassStyles, detachSessionClasses } from "../core/scope";

// The live `(element, scopeCtx)` pair the panel sections would edit with.
const captured = vi.hoisted(() => ({
  current: null as null | { element: Element; scopeCtx: ScopeContext },
}));

// Not under test — keep the mounted tree light (Header stays REAL).
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

async function pressKey(el: Element, key: string) {
  await act(async () => {
    fireEvent.keyDown(el, { key });
    await flushMicrotasks();
  });
}

function liveRadios(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[role="radio"]')) as HTMLElement[];
}

beforeEach(() => {
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  captured.current = null;
  document.body.innerHTML = "";
  try { localStorage.clear(); } catch { /* ignore */ }
});

afterEach(() => {
  if (unmountOverlay) {
    act(() => unmountOverlay!());
    unmountOverlay = null;
  }
  cleanup();
  document.body.innerHTML = "";
  styleEngine.resetAll();
  resetAllModeOverrides();
  destroyClassStyles();
  detachSessionClasses();
  vi.restoreAllMocks();
});

/** Direct-render the real Header (badge / pill ARIA contract tests). */
function renderHeader(props: Partial<React.ComponentProps<typeof Header>> = {}) {
  const el = document.createElement("div");
  document.body.appendChild(el);
  const utils = render(
    <Header element={el} onClose={vi.fn()} onDragStart={vi.fn()} {...props} />
  );
  return { el, ...utils };
}

// ─── 1. Changes badge ─────────────────────────────────────────────────

describe("Header changes badge a11y", () => {
  it("is a focusable native <button> with a descriptive aria-label", () => {
    renderHeader({ totalChanges: 3, onShowSession: vi.fn() });
    const badge = screen.getByLabelText("3 unsaved changes — open changes drawer");
    expect(badge.tagName).toBe("BUTTON");
    expect(badge.tabIndex).toBe(0);
    (badge as HTMLElement).focus();
    expect(document.activeElement).toBe(badge);
  });

  it("uses a singular aria-label for exactly one change", () => {
    renderHeader({ totalChanges: 1, onShowSession: vi.fn() });
    expect(
      screen.getByLabelText("1 unsaved change — open changes drawer")
    ).toBeTruthy();
  });

  it("Enter and Space open the changes drawer; mouse click is unchanged", () => {
    const onShowSession = vi.fn();
    renderHeader({ totalChanges: 2, onShowSession });
    const badge = screen.getByLabelText("2 unsaved changes — open changes drawer");
    fireEvent.keyDown(badge, { key: "Enter" });
    expect(onShowSession).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(badge, { key: " " });
    expect(onShowSession).toHaveBeenCalledTimes(2);
    fireEvent.click(badge);
    expect(onShowSession).toHaveBeenCalledTimes(3);
  });
});

// ─── 2. Scope pills ───────────────────────────────────────────────────

describe("Header scope pills a11y", () => {
  const classCtx: ScopeContext = { scope: "class", activeClassName: "card", activeState: "none" };
  const elementCtx: ScopeContext = { scope: "element", activeClassName: null, activeState: "none" };

  function renderPills(scopeCtx: ScopeContext, onScopeChange = vi.fn()) {
    const el = document.createElement("div");
    el.className = "card";
    document.body.appendChild(el);
    const utils = render(
      <Header
        element={el}
        onClose={vi.fn()}
        onDragStart={vi.fn()}
        onScopeChange={onScopeChange}
        cssClasses={["card"]}
        scopeCtx={scopeCtx}
      />
    );
    return { el, onScopeChange, ...utils };
  }

  it("pills form a radiogroup of focusable native radio buttons", () => {
    renderPills(classCtx);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual([".card", "element"]);
    for (const radio of radios) {
      expect(radio.tagName).toBe("BUTTON");
      expect(radio.tabIndex).toBe(0);
      (radio as HTMLElement).focus();
      expect(document.activeElement).toBe(radio);
    }
  });

  it("aria-checked reflects the active scope and flips when it changes", () => {
    const el = document.createElement("div");
    el.className = "card";
    document.body.appendChild(el);
    const shared = {
      element: el,
      onClose: vi.fn(),
      onDragStart: vi.fn(),
      onScopeChange: vi.fn(),
      cssClasses: ["card"],
    };
    const { rerender } = render(<Header {...shared} scopeCtx={classCtx} />);
    let [classPill, elementPill] = screen.getAllByRole("radio");
    expect(classPill.getAttribute("aria-checked")).toBe("true");
    expect(elementPill.getAttribute("aria-checked")).toBe("false");

    rerender(<Header {...shared} scopeCtx={elementCtx} />);
    [classPill, elementPill] = screen.getAllByRole("radio");
    expect(classPill.getAttribute("aria-checked")).toBe("false");
    expect(elementPill.getAttribute("aria-checked")).toBe("true");
  });

  it("Enter and Space activate a pill; mouse click is unchanged", () => {
    const { onScopeChange } = renderPills(classCtx);
    const [classPill, elementPill] = screen.getAllByRole("radio");

    fireEvent.keyDown(elementPill, { key: "Enter" });
    expect(onScopeChange).toHaveBeenCalledWith("element");

    fireEvent.keyDown(classPill, { key: " " });
    expect(onScopeChange).toHaveBeenCalledWith("class", "card");

    onScopeChange.mockClear();
    fireEvent.click(elementPill);
    expect(onScopeChange).toHaveBeenCalledWith("element");
  });

  it("the '+ class' pill is Tab-reachable and opens the input on Enter and Space", () => {
    renderHeader({ onScopeChange: vi.fn() });
    const add = screen.getByLabelText("Add class");
    expect(add.tagName).toBe("BUTTON");
    expect(add.tabIndex).toBe(0);
    (add as HTMLElement).focus();
    expect(document.activeElement).toBe(add);

    // Enter opens the inline class-name input…
    fireEvent.keyDown(add, { key: "Enter" });
    let input = document.querySelector('[aria-label="New class name"]');
    expect(input, "Enter on the + class pill should open the input").toBeTruthy();

    // …Escape closes it (existing input behavior)…
    fireEvent.keyDown(input!, { key: "Escape" });
    expect(document.querySelector('[aria-label="New class name"]')).toBeNull();

    // …and Space opens it again.
    fireEvent.keyDown(screen.getByLabelText("Add class"), { key: " " });
    input = document.querySelector('[aria-label="New class name"]');
    expect(input, "Space on the + class pill should open the input").toBeTruthy();
  });
});

// ─── 2b. Scope pills — the LIVE scope actually changes (mounted Overlay) ──

describe("Header scope pills — keyboard switches the live scope (mounted Overlay)", () => {
  let parentEl: HTMLElement;
  let childEl: HTMLElement;

  beforeEach(() => {
    parentEl = document.createElement("div");
    parentEl.className = PARENT_CLASS;
    childEl = document.createElement("div");
    childEl.className = CHILD_CLASS;
    parentEl.appendChild(childEl);
    document.body.appendChild(parentEl);
  });

  it("Enter on the 'element' pill moves the live scope off the class; Space moves it back", async () => {
    await mountAndSelect(childEl);
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);

    // Enter on the "element" radio → the live scopeCtx is element scope.
    const elementPill = liveRadios().find((r) => r.textContent === "element")!;
    expect(elementPill, "'element' scope radio should render").toBeTruthy();
    await pressKey(elementPill, "Enter");
    expect(captured.current!.scopeCtx.scope).toBe("element");
    expect(
      liveRadios().find((r) => r.textContent === "element")!.getAttribute("aria-checked")
    ).toBe("true");

    // Space on the class radio → back to class scope with the right class.
    const classPill = liveRadios().find((r) => r.textContent?.startsWith("."))!;
    await pressKey(classPill, " ");
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(CHILD_CLASS);
  });
});

// ─── 3. Breadcrumb ────────────────────────────────────────────────────

describe("Header breadcrumb a11y (mounted Overlay)", () => {
  let parentEl: HTMLElement;
  let childEl: HTMLElement;

  beforeEach(() => {
    parentEl = document.createElement("div");
    parentEl.className = PARENT_CLASS;
    childEl = document.createElement("div");
    childEl.className = CHILD_CLASS;
    parentEl.appendChild(childEl);
    document.body.appendChild(parentEl);
  });

  function ancestorCrumb(): HTMLElement {
    const crumb = document.querySelector("[data-breadcrumb-ancestor]");
    expect(crumb, "breadcrumb ancestor segment should render").toBeTruthy();
    return crumb as HTMLElement;
  }

  it("ancestor crumbs are focusable buttons with a 'Select parent' aria-label", async () => {
    await mountAndSelect(childEl);
    const crumb = ancestorCrumb();
    expect(crumb.getAttribute("role")).toBe("button");
    expect(crumb.tabIndex).toBe(0);
    expect(crumb.getAttribute("aria-label")).toBe("Select parent <div>");
    crumb.focus();
    expect(document.activeElement).toBe(crumb);
  });

  it("Enter navigates to the parent through the real selection path (scope re-derived)", async () => {
    await mountAndSelect(childEl);
    expect(captured.current!.element).toBe(childEl);

    await pressKey(ancestorCrumb(), "Enter");

    expect(captured.current!.element).toBe(parentEl);
    // Same gate as the click path: the scope is re-derived for the parent —
    // proof the keydown routed through the real selection-change handler.
    expect(captured.current!.scopeCtx.scope).toBe("class");
    expect(captured.current!.scopeCtx.activeClassName).toBe(PARENT_CLASS);
  });

  it("Space navigates to the parent as well", async () => {
    await mountAndSelect(childEl);
    expect(captured.current!.element).toBe(childEl);

    await pressKey(ancestorCrumb(), " ");

    expect(captured.current!.element).toBe(parentEl);
    expect(captured.current!.scopeCtx.activeClassName).toBe(PARENT_CLASS);
  });
});
