// @vitest-environment happy-dom
/**
 * transitionsIndicators.test.tsx — QA_CHECKLIST "Visual → Transitions" and
 * "Visual → Indicators", locked in as behavioral regression tests (issue #105
 * style: mounted components + fired events, no source-text assertions).
 *
 * Transitions:
 *   1. Section collapse/expand — chevron rotates 0→90deg with a transform
 *      transition; content mounts/unmounts with the toggle. (The smoothness
 *      itself is visual; the animated affordance contract is what's testable.)
 *   2. Dropdown open — the portal only renders once a position exists
 *      (`open && dropdownPos &&` gate), so it must appear with top/left
 *      already applied: no unpositioned first paint, no jump.
 *   3. Panel drag — useOverlayDrag flips panelDragging on drag start and
 *      clears it on mouseup; the drag shadow token differs from the resting
 *      panel shadow.
 *   4. Save success — Save turns color.success with "✓ Saved" after a
 *      successful save, then reverts to color.primary (1.5s timer).
 *
 * Indicators:
 *   5. Section header indicator — indicatorStyle pill on the title.
 *   6. Property label (ScrubLabel) — modified indicator on the label span.
 *   7. Value flash — ValueInput briefly highlights (primaryAlpha(0.12) bg +
 *      scale bump) when its value prop changes, then reverts.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, fireEvent, act, renderHook } from "@testing-library/react";
import { Section } from "../controls/Section";
import { SelectRow } from "../controls/SelectRow";
import { ScrubLabel } from "../controls/ScrubLabel";
import { ValueInput } from "../controls/ValueInput";
import { Footer } from "../shell/Footer";
import { useOverlayDrag } from "../hooks/useOverlayDrag";
import { styleEngine } from "../core/engine";
import { __setTransportForTests, type SaveTransport } from "../core/save";
import { color, shadow, labelIndicator, primaryAlpha } from "../theme";

/** Normalize a CSS color the way happy-dom serializes the background shorthand. */
function normalize(cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.background = cssColor;
  return probe.style.background;
}

/** Same, through the backgroundColor longhand (serializes differently). */
function normalizeBgColor(cssColor: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = cssColor;
  return probe.style.backgroundColor;
}

afterEach(() => {
  cleanup();
  styleEngine.resetAll();
  __setTransportForTests(null);
  document.body.innerHTML = "";
});

describe("Section collapse/expand (checklist: Transitions 1)", () => {
  function chevronOf(container: HTMLElement): HTMLElement {
    const header = container.querySelector('[role="button"]') as HTMLElement;
    return Array.from(header.querySelectorAll("span")).find((s) =>
      (s.getAttribute("style") ?? "").includes("rotate")
    ) as HTMLElement;
  }

  it("chevron rotates 0→90deg with a transform transition; content follows the toggle", () => {
    const { container } = render(
      <Section title="Probe" collapsed>
        <div data-probe-content>content</div>
      </Section>
    );
    const header = container.querySelector('[role="button"]') as HTMLElement;
    const chevron = chevronOf(container);

    expect(chevron.style.transform).toBe("rotate(0deg)");
    expect(chevron.style.transition).toContain("transform");
    expect(container.querySelector("[data-probe-content]")).toBeNull();

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("true");
    expect(chevron.style.transform).toBe("rotate(90deg)");
    expect(container.querySelector("[data-probe-content]")).not.toBeNull();

    fireEvent.click(header);
    expect(header.getAttribute("aria-expanded")).toBe("false");
    expect(chevron.style.transform).toBe("rotate(0deg)");
    expect(container.querySelector("[data-probe-content]")).toBeNull();
  });
});

describe("Dropdown open positioning (checklist: Transitions 2)", () => {
  const OPTIONS = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
  ];

  it("portal appears with top/left already set — never an unpositioned frame", () => {
    const { container } = render(
      <SelectRow label="Kind" value="alpha" options={OPTIONS} onChange={vi.fn()} searchable />
    );
    expect(document.querySelector("[data-select-custom-portal]")).toBeNull();

    const trigger = container.querySelector("button") as HTMLElement;
    fireEvent.click(trigger);

    const portal = document.querySelector("[data-select-custom-portal]") as HTMLElement;
    expect(portal, "dropdown portal must render on open").not.toBeNull();
    // The `open && dropdownPos &&` gate means position is computed before the
    // first paint — top/left must be present from the very first appearance.
    expect(portal.style.top).not.toBe("");
    expect(portal.style.left).not.toBe("");
  });
});

describe("Panel drag shadow (checklist: Transitions 3)", () => {
  it("panelDragging flips on drag start and clears on mouseup", () => {
    const { result } = renderHook(() => useOverlayDrag("panel", 0));
    expect(result.current.panelDragging).toBe(false);

    act(() => {
      result.current.handleDragStart({
        clientX: 100,
        clientY: 100,
        preventDefault: () => {},
      } as unknown as React.MouseEvent);
    });
    expect(result.current.panelDragging).toBe(true);

    act(() => {
      document.dispatchEvent(new MouseEvent("mousemove", { clientX: 120, clientY: 130 }));
    });
    expect(result.current.panelDragging).toBe(true);

    act(() => {
      document.dispatchEvent(new MouseEvent("mouseup"));
    });
    expect(result.current.panelDragging).toBe(false);
  });

  it("drag shadow token is deeper than the resting panel shadow", () => {
    expect(shadow.panelDrag).not.toBe(shadow.panel);
  });
});

describe("Save success flash (checklist: Transitions 4)", () => {
  beforeEach(() => {
    __setTransportForTests(
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ written: ["app/page.tsx"], failed: [] }),
      }) as unknown as SaveTransport
    );
  });

  it("Save turns green with '✓ Saved', then reverts to primary", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    styleEngine.apply({ scope: "element", el }, "color", "red");

    const saveRef = { current: null as (() => void) | null };
    const { container } = render(
      <Footer
        element={el}
        onReset={() => {}}
        saveRef={saveRef}
        scopeCtx={{ scope: "element", activeClassName: null, activeState: "none" }}
      />
    );
    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").trim().startsWith("Save")
    ) as HTMLElement;
    expect(saveBtn.style.background).toBe(normalize(color.primary));

    expect(saveRef.current).toBeTypeOf("function");
    await act(async () => {
      saveRef.current!();
    });

    await vi.waitFor(() => {
      expect(saveBtn.textContent).toContain("Saved");
      expect(saveBtn.style.background).toBe(normalize(color.success));
    });

    // The 1.5s savedTimer reverts the flash.
    await vi.waitFor(
      () => {
        expect(saveBtn.style.background).toBe(normalize(color.primary));
      },
      { timeout: 3000, interval: 100 }
    );
  });
});

describe("Section header indicator (checklist: Indicators 2)", () => {
  it("modified indicator renders the amber pill on the title", () => {
    const { container } = render(
      <Section title="Spacing" indicator="modified">
        <div>content</div>
      </Section>
    );
    const pill = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Spacing" && (s.getAttribute("style") ?? "").includes("background")
    ) as HTMLElement;
    expect(pill, "title span must carry the indicator pill").toBeTruthy();
    expect(pill.style.background).toBe(normalize(labelIndicator.modified.bg));
  });

  it("no indicator → no pill background", () => {
    const { container } = render(
      <Section title="Spacing">
        <div>content</div>
      </Section>
    );
    const spans = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent === "Spacing"
    );
    for (const s of spans) {
      expect(s.style.background).toBe("");
    }
  });
});

describe("Property label indicator (checklist: Indicators 1)", () => {
  it("ScrubLabel with modified indicator highlights the label span", () => {
    const { container } = render(
      <ScrubLabel value={10} onChange={vi.fn()} indicator="modified">
        Width
      </ScrubLabel>
    );
    const pill = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "Width" && (s.getAttribute("style") ?? "").includes("background")
    ) as HTMLElement;
    expect(pill, "label span must carry the indicator pill").toBeTruthy();
    expect(pill.style.background).toBe(normalize(labelIndicator.modified.bg));
  });
});

describe("Value flash (checklist: Indicators 3)", () => {
  it("input flashes (bg highlight + scale) when the value prop changes, then reverts", async () => {
    const { container, rerender } = render(<ValueInput value={10} onChange={vi.fn()} />);
    const input = container.querySelector("input") as HTMLElement;
    const restingBg = input.style.backgroundColor;

    rerender(<ValueInput value={20} onChange={vi.fn()} />);

    expect(input.style.transform).toBe("scale(1.02)");
    // The checklist item is the *background* highlight — the flash must win
    // over the input's resting backgroundColor while active.
    expect(input.style.backgroundColor).toBe(normalizeBgColor(primaryAlpha(0.12)));

    // Flash clears after its 200ms timer.
    await vi.waitFor(
      () => {
        expect(input.style.backgroundColor).toBe(restingBg);
        expect(input.style.transform).not.toBe("scale(1.02)");
      },
      { timeout: 2000, interval: 50 }
    );
  });
});
