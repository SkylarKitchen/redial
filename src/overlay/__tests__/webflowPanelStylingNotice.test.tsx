// @vitest-environment happy-dom
/**
 * webflowPanelStylingNotice.test.tsx — the panel must surface a compact,
 * dismissible capability notice BEFORE the user invests edits when the
 * selected element's styling system has no save path (styled-components,
 * Emotion, runtime style tags, external stylesheets, inline-only).
 *
 * Mounted tests of the real <WebflowPanel/>; heavy section children that
 * aren't under test are mocked out (same pattern as overlaySaveShortcut).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { WebflowPanel } from "../shell/WebflowPanel";
import type { SpacingValues } from "../core/infer";

// Not under test — keep the mounted tree light and deterministic.
vi.mock("../sections/LayoutSection", () => ({ LayoutSection: () => null }));
vi.mock("../sections/SpacingSection", () => ({ SpacingSection: () => null }));
vi.mock("../sections/SizeSection", () => ({ SizeSection: () => null }));
vi.mock("../sections/PositionSection", () => ({ PositionSection: () => null }));
vi.mock("../sections/TypographySection", () => ({ TypographySection: () => null }));
vi.mock("../sections/BackgroundsSection", () => ({ BackgroundsSection: () => null }));
vi.mock("../sections/BordersSection", () => ({ BordersSection: () => null }));
vi.mock("../sections/EffectsSection", () => ({ EffectsSection: () => null }));
vi.mock("../sections/CustomPropertiesSection", () => ({ CustomPropertiesSection: () => null }));

const SPACING: SpacingValues = {
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
};

function makeEl(className = ""): HTMLElement {
  const el = document.createElement("div");
  if (className) el.className = className;
  document.body.appendChild(el);
  return el;
}

function renderPanel(element: Element) {
  return render(
    <WebflowPanel element={element} spacing={SPACING} onSpacingChange={() => {}} />,
  );
}

function getNotice(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[role="status"]');
}

let cleanupFns: Array<() => void> = [];

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const fn of cleanupFns.splice(0)) act(() => fn());
  document.body.innerHTML = "";
});

describe("WebflowPanel styling-capability notice", () => {
  it("shows the notice for a styled-components element (not saveable)", () => {
    const el = makeEl("sc-bdVaJa gJkLmn");
    const { container, unmount } = renderPanel(el);
    cleanupFns.push(unmount);

    const notice = getNotice(container);
    expect(notice, "notice bar must be rendered for unsaveable elements").toBeTruthy();
    expect(notice!.textContent).toMatch(/styled-components/);
    expect(notice!.textContent).toMatch(/can't be saved/);
  });

  it("does not show the notice for a CSS-modules element (saveable)", () => {
    const el = makeEl("Button_btn__a8f2k");
    const { container, unmount } = renderPanel(el);
    cleanupFns.push(unmount);

    expect(getNotice(container)).toBeNull();
  });

  it("does not show the notice for a Tailwind element (saveable)", () => {
    const el = makeEl("flex items-center mt-4 bg-blue-500");
    const { container, unmount } = renderPanel(el);
    cleanupFns.push(unmount);

    expect(getNotice(container)).toBeNull();
  });

  it("is dismissible — the dismiss button hides the notice", () => {
    const el = makeEl("sc-bdVaJa");
    const { container, unmount } = renderPanel(el);
    cleanupFns.push(unmount);

    const dismiss = container.querySelector(
      'button[aria-label="Dismiss styling notice"]',
    ) as HTMLButtonElement | null;
    expect(dismiss, "notice must have a labelled dismiss button").toBeTruthy();

    act(() => dismiss!.click());
    expect(getNotice(container)).toBeNull();
  });

  it("dismissal is per element selection — a new unsaveable element shows the notice again", () => {
    const el1 = makeEl("sc-bdVaJa");
    const el2 = makeEl("sc-AxjAm");
    const { container, rerender, unmount } = renderPanel(el1);
    cleanupFns.push(unmount);

    const dismiss = container.querySelector(
      'button[aria-label="Dismiss styling notice"]',
    ) as HTMLButtonElement;
    act(() => dismiss.click());
    expect(getNotice(container)).toBeNull();

    rerender(
      <WebflowPanel element={el2} spacing={SPACING} onSpacingChange={() => {}} />,
    );
    expect(
      getNotice(container),
      "notice must reappear for a newly selected unsaveable element",
    ).toBeTruthy();
  });
});
