// @vitest-environment happy-dom
/**
 * Test: Overlay click handler must NOT intercept clicks on Radix portal elements.
 *
 * Bug: The Overlay's capture-phase handlePageClick calls preventDefault() +
 * stopPropagation() on any click that isn't inside .__tuner-root or
 * [data-tuner-portal]. Radix UI's <Select> portals its dropdown to
 * document.body as <div data-radix-portal>, which doesn't match either
 * exclusion. Result: dropdown items can never be clicked.
 *
 * The fix: Add [data-radix-portal] (or a broader check) to the exclusion list
 * in handlePageClick and handleContextMenu.
 */
import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Simulates the Overlay's handlePageClick logic from Overlay.tsx lines 1022-1041.
 * This is the CURRENT (buggy) behavior.
 */
function buggyHandlePageClick(e: MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as Element;
  if (target.closest(".__tuner-root")) return;
  if (target.closest(".__tuner-selected-outline")) return;
  if (target.closest("[data-tuner-portal]")) return;

  e.preventDefault();
  e.stopPropagation();
}

describe("Bug: Radix portal clicks are intercepted by Overlay", () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  });

  it("clicks on [data-radix-portal] children are swallowed (proves the bug)", () => {
    // Simulate Radix Select portal structure on document.body:
    // <div data-radix-portal>
    //   <div data-radix-select-content>
    //     <div role="option">Solid</div>
    const portal = document.createElement("div");
    portal.setAttribute("data-radix-portal", "");
    const content = document.createElement("div");
    content.setAttribute("data-radix-select-content", "");
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "Solid";
    content.appendChild(option);
    portal.appendChild(content);
    document.body.appendChild(portal);
    cleanups.push(() => portal.remove());

    const optionClicked = vi.fn();
    option.addEventListener("click", optionClicked);
    cleanups.push(() => option.removeEventListener("click", optionClicked));

    // Register the buggy handler (capture phase, like Overlay.tsx)
    document.addEventListener("click", buggyHandlePageClick, true);
    cleanups.push(() =>
      document.removeEventListener("click", buggyHandlePageClick, true)
    );

    // Click the dropdown option
    option.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    // BUG: The option's click handler never fires because stopPropagation was called
    expect(optionClicked).toHaveBeenCalledTimes(0);
  });

  it("[data-tuner-portal] clicks pass through correctly (existing behavior)", () => {
    // Our own portals already work
    const portal = document.createElement("div");
    portal.setAttribute("data-tuner-portal", "");
    const btn = document.createElement("button");
    btn.textContent = "Copy";
    portal.appendChild(btn);
    document.body.appendChild(portal);
    cleanups.push(() => portal.remove());

    const btnClicked = vi.fn();
    btn.addEventListener("click", btnClicked);
    cleanups.push(() => btn.removeEventListener("click", btnClicked));

    document.addEventListener("click", buggyHandlePageClick, true);
    cleanups.push(() =>
      document.removeEventListener("click", buggyHandlePageClick, true)
    );

    btn.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    // This works because data-tuner-portal is in the exclusion list
    expect(btnClicked).toHaveBeenCalledTimes(1);
  });
});

/**
 * After the fix, this suite should pass: Radix portal clicks must NOT be
 * intercepted by the Overlay's click handler.
 */
describe("Fix: Radix portal clicks should pass through", () => {
  const cleanups: (() => void)[] = [];

  afterEach(() => {
    cleanups.forEach((fn) => fn());
    cleanups.length = 0;
  });

  /** Fixed version of handlePageClick that also excludes Radix portals */
  function fixedHandlePageClick(e: MouseEvent) {
    if (e.button !== 0) return;
    const target = e.target as Element;
    if (target.closest(".__tuner-root")) return;
    if (target.closest(".__tuner-selected-outline")) return;
    if (target.closest("[data-tuner-portal]")) return;
    if (target.closest("[data-radix-portal]")) return; // THE FIX

    e.preventDefault();
    e.stopPropagation();
  }

  it("clicks on Radix Select options should reach their handlers", () => {
    const portal = document.createElement("div");
    portal.setAttribute("data-radix-portal", "");
    const content = document.createElement("div");
    content.setAttribute("data-radix-select-content", "");
    const option = document.createElement("div");
    option.setAttribute("role", "option");
    option.textContent = "Dashed";
    content.appendChild(option);
    portal.appendChild(content);
    document.body.appendChild(portal);
    cleanups.push(() => portal.remove());

    const optionClicked = vi.fn();
    option.addEventListener("click", optionClicked);
    cleanups.push(() => option.removeEventListener("click", optionClicked));

    document.addEventListener("click", fixedHandlePageClick, true);
    cleanups.push(() =>
      document.removeEventListener("click", fixedHandlePageClick, true)
    );

    option.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    // After fix: option click should work
    expect(optionClicked).toHaveBeenCalledTimes(1);
  });

  it("page element clicks are still intercepted (no regression)", () => {
    const pageEl = document.createElement("div");
    pageEl.className = "some-page-element";
    document.body.appendChild(pageEl);
    cleanups.push(() => pageEl.remove());

    const pageClicked = vi.fn();
    pageEl.addEventListener("click", pageClicked);
    cleanups.push(() => pageEl.removeEventListener("click", pageClicked));

    document.addEventListener("click", fixedHandlePageClick, true);
    cleanups.push(() =>
      document.removeEventListener("click", fixedHandlePageClick, true)
    );

    pageEl.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));

    // Page clicks should still be intercepted
    expect(pageClicked).toHaveBeenCalledTimes(0);
  });
});
