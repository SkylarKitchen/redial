// @vitest-environment happy-dom
/**
 * Issue #87 — CSS import was implemented twice with inconsistent undo batching.
 *
 * The Footer path (Clipboard ▸ Import CSS → Overlay's legacy handleCSSImport)
 * applied N declarations as N separate undo entries, so reverting one paste
 * took N undos. The Cmd+Shift+V hotkey path batched correctly via
 * beginBatch/endBatch (this repo's rule: batching via beginBatch/endBatch
 * only, never time-based).
 *
 * Consolidation contract locked here:
 *   1. The Footer's Import CSS menu item applies the whole blob itself through
 *      the ONE shared `importCSSText` implementation — batched, so a
 *      multi-property import is a SINGLE undo step.
 *   2. The legacy `onCSSImport` prop (Overlay's unbatched copy) is never
 *      invoked anymore.
 *   3. Both surviving triggers (Footer item + hotkey) route through
 *      `importCSSText` — no second copy of the loop exists.
 *
 * RED pre-fix: the Footer item delegates to `onCSSImport` (replicated below,
 * byte-faithful to Overlay's legacy loop), one undo reverts only the LAST
 * property, and the legacy callback fires.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { Footer } from "../shell/Footer";
import { styleEngine, resolveTarget, type ScopeContext } from "../core/engine";
import { overrideCount, resetAll } from "../core/apply";
import { resetAllModeOverrides } from "../core/modeOverrides";
import { parseCSSText } from "../cssImport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CSS_BLOB = "color: red;\nmargin-top: 4px;\npadding-left: 2px;";

const SCOPE_CTX: ScopeContext = {
  scope: "element",
  activeClassName: null,
  activeState: "none",
};

function makeEl(id: string): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  resetAll();
  resetAllModeOverrides();
  document.body.innerHTML = "";
  // happy-dom may not implement navigator.clipboard — define a spyable stub.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      readText: vi.fn().mockResolvedValue(CSS_BLOB),
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

afterEach(() => {
  resetAll();
  resetAllModeOverrides();
});

/** Open the Footer's Clipboard dropdown and click "Import CSS". */
async function clickImportCSS(): Promise<void> {
  const trigger = Array.from(document.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("Clipboard"),
  );
  expect(trigger, "Clipboard dropdown trigger should render").toBeTruthy();
  fireEvent.click(trigger as HTMLButtonElement);
  const item = screen.getByRole("menuitem", { name: /Import CSS/ });
  await act(async () => {
    fireEvent.click(item);
  });
}

describe("footer CSS import (#87) — one batched implementation", () => {
  it("footer import applies a multi-property blob and ONE undo reverts all of it", async () => {
    const el = makeEl("import-target");

    // Byte-faithful replica of Overlay.tsx's LEGACY handleCSSImport loop (the
    // unbatched Footer path this test kills). Post-consolidation the Footer
    // must not call it — it survives here only to prove the pre-fix failure.
    const legacyImport = vi.fn(async () => {
      const text = await navigator.clipboard.readText();
      const declarations = parseCSSText(text);
      for (const { prop, value } of declarations) {
        styleEngine.apply(resolveTarget(el, SCOPE_CTX), prop, value);
      }
    });
    const onReset = vi.fn();

    render(
      <Footer
        element={el}
        onReset={onReset}
        scopeCtx={SCOPE_CTX}
        onCSSImport={legacyImport}
      />,
    );

    await clickImportCSS();

    // The whole blob landed on the element.
    expect(el.style.getPropertyValue("color")).toBe("red");
    expect(el.style.getPropertyValue("margin-top")).toBe("4px");
    expect(el.style.getPropertyValue("padding-left")).toBe("2px");
    expect(overrideCount(el)).toBe(3);

    // Consolidation: the legacy unbatched copy is dead — never invoked.
    expect(legacyImport).not.toHaveBeenCalled();

    // The host is told to refresh the panel (Overlay wires onReset to
    // refreshPanel) so section controls show the imported values.
    expect(onReset).toHaveBeenCalled();

    // THE BUG (#87): ONE undo must revert the ENTIRE import. Pre-fix the
    // Footer path pushed 3 separate entries, so one undo left 2 applied.
    act(() => {
      styleEngine.undo();
    });
    expect(overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");
    expect(el.style.getPropertyValue("margin-top")).toBe("");
    expect(el.style.getPropertyValue("padding-left")).toBe("");
  });

  it("footer import shows the imported-count message and works without the legacy prop", async () => {
    const el = makeEl("import-standalone");

    // No onCSSImport passed at all: the Footer owns the import now, so the
    // menu item must still work (pre-fix it was disabled without the prop).
    render(<Footer element={el} onReset={() => {}} scopeCtx={SCOPE_CTX} />);

    await clickImportCSS();

    expect(overrideCount(el)).toBe(3);
    expect(screen.getByText(/Imported 3 properties/)).toBeTruthy();
  });

  it("one implementation: footer and hotkey both route through importCSSText", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const footerSrc = readFileSync(join(__dirname, "..", "shell", "Footer.tsx"), "utf-8");
    const hotkeysSrc = readFileSync(
      join(__dirname, "..", "hooks", "useOverlayHotkeys.ts"),
      "utf-8",
    );

    // Both triggers call the ONE shared implementation…
    expect(footerSrc).toContain("importCSSText(");
    expect(hotkeysSrc).toContain("importCSSText(");
    // …which is the batched one.
    expect(hotkeysSrc).toMatch(/export function importCSSText/);
    const impl = hotkeysSrc.slice(hotkeysSrc.indexOf("export function importCSSText"));
    expect(impl).toContain("beginBatch");
    expect(impl).toContain("endBatch");
    // The Footer no longer invokes the legacy Overlay copy.
    expect(footerSrc).not.toContain("onCSSImport?.()");
  });
});
