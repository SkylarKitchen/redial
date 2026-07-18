// @vitest-environment happy-dom
/**
 * hoverStates.test.tsx — QA_CHECKLIST "Visual → Hover States" (items 1–5),
 * locked in as behavioral regression tests (issue #105 style: mounted
 * components + fired events, no source-text assertions).
 *
 * Covers the five hover affordances the checklist calls out:
 *   1. Section header (collapsed) — background lifts to surface.hover.
 *      Open headers are sticky with a solid background and must NOT change.
 *   2. Slider track — the global stylesheet must ship a
 *      `:hover::-webkit-slider-runnable-track` rule whose background differs
 *      from the base track. (Pseudo-element hover can't be fired in happy-dom,
 *      so this asserts the rendered <style> contract instead.)
 *   3. Footer buttons — Copy: surface.hover → surface.active. Reset: hover
 *      background only when there are pending changes (count > 0). Save:
 *      opacity 1 → 0.9 on hover once changes exist; 0.5 while disabled.
 *   4. Header close button — transparent → surface.hover.
 *   5. IconButtonGroup — inactive item gets surface.hover; the active item
 *      keeps color.primary (hover must not wash out the selection).
 *
 * Colors are compared through a probe element so happy-dom's rgba
 * serialization normalizes both sides.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { Section } from "../controls/Section";
import { IconButtonGroup } from "../controls/IconButtonGroup";
import { Footer } from "../shell/Footer";
import { Header } from "../shell/Header";
import { OverlayScrollbarStyles } from "../shell/OverlayStyles";
import { styleEngine } from "../core/engine";
import { color, surface } from "../theme";

/** Normalize a CSS color the same way happy-dom serializes inline styles. */
function normalize(cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.background = cssColor;
  return probe.style.background;
}

/** Same, but through the backgroundColor longhand (serializes differently). */
function normalizeBgColor(cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = cssColor;
  return probe.style.backgroundColor;
}

afterEach(() => {
  cleanup();
  styleEngine.resetAll();
  document.body.innerHTML = "";
});

describe("Section header hover (checklist: Hover States 1)", () => {
  it("collapsed header lifts to surface.hover on enter and clears on leave", () => {
    const { container } = render(
      <Section title="Probe" collapsed>
        <div>content</div>
      </Section>
    );
    const header = container.querySelector('[role="button"][aria-expanded="false"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.style.background).toBe(normalize("transparent"));

    fireEvent.mouseEnter(header);
    expect(header.style.background).toBe(normalize(surface.hover));

    fireEvent.mouseLeave(header);
    expect(header.style.background).toBe(normalize("transparent"));
  });

  it("open (sticky) header keeps its solid background on hover", () => {
    const { container } = render(
      <Section title="Probe">
        <div>content</div>
      </Section>
    );
    const header = container.querySelector('[role="button"][aria-expanded="true"]') as HTMLElement;
    expect(header).not.toBeNull();
    expect(header.style.background).toBe(normalize(color.background));

    fireEvent.mouseEnter(header);
    expect(header.style.background).toBe(normalize(color.background));
  });
});

describe("Slider track hover rule (checklist: Hover States 2)", () => {
  it("ships a :hover track rule whose background differs from the base track", () => {
    const { container } = render(<OverlayScrollbarStyles />);
    const css = container.querySelector("style")?.textContent ?? "";

    const base = css.match(
      /\[type="range"\]::-webkit-slider-runnable-track\s*\{[^}]*background:\s*([^;]+);/
    );
    const hover = css.match(
      /\[type="range"\]:hover::-webkit-slider-runnable-track\s*\{[^}]*background:\s*([^;]+);/
    );
    expect(base?.[1], "base track rule must exist").toBeTruthy();
    expect(hover?.[1], "hover track rule must exist").toBeTruthy();
    expect(normalize(hover![1].trim())).not.toBe(normalize(base![1].trim()));
  });
});

describe("Footer button hover (checklist: Hover States 3)", () => {
  function renderFooter(withChange: boolean) {
    const el = document.createElement("div");
    document.body.appendChild(el);
    if (withChange) styleEngine.apply({ scope: "element", el }, "color", "red");
    const { container } = render(<Footer element={el} onReset={() => {}} />);
    const buttons = Array.from(container.querySelectorAll("button")) as HTMLElement[];
    const copy = buttons.find((b) => b.title.startsWith("Copy CSS"));
    const reset = buttons.find((b) => (b.textContent ?? "").trim().startsWith("Reset"));
    const save = buttons.find((b) => (b.textContent ?? "").trim().startsWith("Save"));
    return { copy: copy!, reset: reset!, save: save! };
  }

  it("Copy button: surface.hover base, surface.active on hover", () => {
    const { copy } = renderFooter(false);
    expect(copy).toBeTruthy();
    expect(copy.style.background).toBe(normalize(surface.hover));

    fireEvent.mouseEnter(copy);
    expect(copy.style.background).toBe(normalize(surface.active));

    fireEvent.mouseLeave(copy);
    expect(copy.style.background).toBe(normalize(surface.hover));
  });

  it("Reset button: no hover feedback while there is nothing to reset", () => {
    const { reset } = renderFooter(false);
    expect(reset).toBeTruthy();
    const idle = reset.style.background;

    fireEvent.mouseEnter(reset);
    expect(reset.style.background).toBe(idle);
  });

  it("Reset button: hover feedback once changes are pending", () => {
    const { reset } = renderFooter(true);
    expect(reset).toBeTruthy();
    const idle = reset.style.background;

    fireEvent.mouseEnter(reset);
    expect(reset.style.background).toBe(normalize(surface.hover));
    expect(reset.style.background).not.toBe(idle);

    fireEvent.mouseLeave(reset);
    expect(reset.style.background).toBe(idle);
  });

  it("Save button: 0.5 opacity disabled; 1 → 0.9 on hover with pending changes", () => {
    const disabled = renderFooter(false);
    expect(disabled.save.style.opacity).toBe("0.5");
    cleanup();
    styleEngine.resetAll();
    document.body.innerHTML = "";

    const enabled = renderFooter(true);
    expect(enabled.save.style.opacity).toBe("1");

    fireEvent.mouseEnter(enabled.save);
    expect(enabled.save.style.opacity).toBe("0.9");

    fireEvent.mouseLeave(enabled.save);
    expect(enabled.save.style.opacity).toBe("1");
  });
});

describe("Header close button hover (checklist: Hover States 4)", () => {
  it("transparent at rest, surface.hover on enter, transparent on leave", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const { container } = render(
      <Header
        element={el}
        onClose={vi.fn()}
        onDragStart={vi.fn()}
        onScopeChange={vi.fn()}
        cssClasses={[]}
      />
    );
    const close = container.querySelector('button[title="Close (Esc)"]') as HTMLElement;
    expect(close).not.toBeNull();
    expect(close.style.background).toBe(normalize("transparent"));

    fireEvent.mouseEnter(close);
    expect(close.style.background).toBe(normalize(surface.hover));

    fireEvent.mouseLeave(close);
    expect(close.style.background).toBe(normalize("transparent"));
  });
});

describe("IconButtonGroup hover (checklist: Hover States 5)", () => {
  function renderGroup() {
    const { container } = render(
      <IconButtonGroup
        aria-label="Probe group"
        options={[
          { value: "left", icon: <span>L</span>, label: "Left" },
          { value: "right", icon: <span>R</span>, label: "Right" },
        ]}
        value="left"
        onChange={vi.fn()}
      />
    );
    const buttons = Array.from(container.querySelectorAll("button")) as HTMLElement[];
    const active = buttons.find((b) => b.textContent === "L")!;
    const inactive = buttons.find((b) => b.textContent === "R")!;
    return { active, inactive };
  }

  // IconButtonItem styles the longhand backgroundColor (not the background
  // shorthand the other chrome uses), so assert that property directly.
  it("inactive item gets surface.hover on enter and clears on leave", () => {
    const { inactive } = renderGroup();
    expect(inactive.style.backgroundColor).toBe("");

    fireEvent.mouseEnter(inactive);
    expect(inactive.style.backgroundColor).toBe(normalizeBgColor(surface.hover));

    fireEvent.mouseLeave(inactive);
    expect(inactive.style.backgroundColor).toBe("");
  });

  it("active item keeps color.primary through hover", () => {
    const { active } = renderGroup();
    expect(active.style.backgroundColor).toBe(normalizeBgColor(color.primary));

    fireEvent.mouseEnter(active);
    expect(active.style.backgroundColor).toBe(normalizeBgColor(color.primary));

    fireEvent.mouseLeave(active);
    expect(active.style.backgroundColor).toBe(normalizeBgColor(color.primary));
  });
});
