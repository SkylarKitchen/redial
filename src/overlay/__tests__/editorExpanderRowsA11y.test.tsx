// @vitest-environment happy-dom
/**
 * Sub-editor expander rows — keyboard accessibility (issue #85).
 *
 * Four list-row expanders were mouse-only <div onClick> surfaces:
 *   - FilterSliders.tsx  — filter item summary row (expands the item editor)
 *   - TransformEditor.tsx — TransformPill (expands the transform editor)
 *   - BackgroundLayerList.tsx — layer collapsed row (expands layer settings)
 *   - GridSettingsPopup.tsx — TrackItem header (expands track size editor)
 *
 * These rows contain nested interactive controls (delete/visibility buttons,
 * drag handles), so they cannot become native <button>s (button-in-button is
 * invalid HTML). The fix is role="button" + tabIndex={0} + Enter/Space keydown
 * + aria-expanded, with a target-guard so keystrokes on nested controls don't
 * also toggle the row.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { FilterEditor, createDefaultItem } from "../sections/FilterSliders";
import { TransformEditor, type TransformValue } from "../sections/TransformEditor";
import { BackgroundLayerList, type BackgroundLayer } from "../sections/BackgroundLayerList";
import { GridSettingsPopup } from "../sections/GridSettingsPopup";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture — useDragReorder calls it in
  // pointer handlers, so polyfill as no-ops to prevent throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** All role="button" expander rows (they carry aria-expanded). */
function expanderRows(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll('[role="button"][aria-expanded]'),
  ) as HTMLElement[];
}

function firstExpanderRow(container: HTMLElement): HTMLElement {
  const rows = expanderRows(container);
  if (rows.length === 0) {
    throw new Error("no role='button'[aria-expanded] expander row found — mouse-only surface");
  }
  return rows[0];
}

// ─── FilterSliders ────────────────────────────────────────────────────

describe("FilterSliders item row expander a11y", () => {
  function setup() {
    const onChange = vi.fn();
    const item = createDefaultItem("brightness"); // expanded: true by default? use as-is
    item.expanded = false;
    const utils = render(<FilterEditor items={[item]} onChange={onChange} type="filter" />);
    return { onChange, item, ...utils };
  }

  it("summary row is focusable with role='button' and aria-expanded", () => {
    const { container } = setup();
    const row = firstExpanderRow(container);
    expect(row.tabIndex).toBe(0);
    expect(row.getAttribute("aria-expanded")).toBe("false");
    row.focus();
    expect(document.activeElement).toBe(row);
  });

  it("Enter toggles expansion", () => {
    const { container, onChange } = setup();
    const row = firstExpanderRow(container);
    fireEvent.keyDown(row, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ expanded: true })]);
  });

  it("Space toggles expansion", () => {
    const { container, onChange } = setup();
    const row = firstExpanderRow(container);
    fireEvent.keyDown(row, { key: " " });
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ expanded: true })]);
  });

  it("keystrokes on nested controls do NOT toggle the row (target guard)", () => {
    const { container, onChange } = setup();
    const row = firstExpanderRow(container);
    const nested = row.querySelector("button");
    expect(nested).toBeTruthy();
    fireEvent.keyDown(nested as HTMLElement, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalledWith([expect.objectContaining({ expanded: true })]);
  });

  it("mouse click still toggles expansion (unchanged)", () => {
    const { container, onChange } = setup();
    fireEvent.click(firstExpanderRow(container));
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ expanded: true })]);
  });
});

// ─── TransformEditor ──────────────────────────────────────────────────

const TRANSLATE: TransformValue = { type: "translate", x: 0, y: 0, z: 0 };

function renderTransformEditor() {
  return render(
    <TransformEditor
      transforms={[TRANSLATE]}
      onChange={() => {}}
      origin="50% 50%"
      onOriginChange={() => {}}
      backfaceVisibility="visible"
      onBackfaceChange={() => {}}
      selfPerspective={0}
      onSelfPerspectiveChange={() => {}}
      childrenPerspective={0}
      onChildrenPerspectiveChange={() => {}}
      perspectiveOrigin="50% 50%"
      onPerspectiveOriginChange={() => {}}
      settingsOpen={false}
    />,
  );
}

describe("TransformEditor pill expander a11y", () => {
  it("pill is focusable with role='button' and aria-expanded", () => {
    const { container } = renderTransformEditor();
    const pill = firstExpanderRow(container);
    expect(pill.tabIndex).toBe(0);
    expect(pill.getAttribute("aria-expanded")).toBe("false");
    pill.focus();
    expect(document.activeElement).toBe(pill);
  });

  it("Enter expands the pill (aria-expanded flips, editor renders)", () => {
    const { container } = renderTransformEditor();
    fireEvent.keyDown(firstExpanderRow(container), { key: "Enter" });
    expect(firstExpanderRow(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("Space expands the pill", () => {
    const { container } = renderTransformEditor();
    fireEvent.keyDown(firstExpanderRow(container), { key: " " });
    expect(firstExpanderRow(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("mouse click still expands (unchanged)", () => {
    const { container } = renderTransformEditor();
    fireEvent.click(firstExpanderRow(container));
    expect(firstExpanderRow(container).getAttribute("aria-expanded")).toBe("true");
  });
});

// ─── BackgroundLayerList ──────────────────────────────────────────────

const COLOR_LAYER: BackgroundLayer = {
  id: "bg_test_1",
  type: "color",
  color: "#ff0000",
  opacity: 1,
  blendMode: "normal",
  visible: true,
};

describe("BackgroundLayerList layer row expander a11y", () => {
  it("collapsed row is focusable with role='button' and aria-expanded", () => {
    const { container } = render(
      <BackgroundLayerList layers={[COLOR_LAYER]} onChange={() => {}} />,
    );
    const row = firstExpanderRow(container);
    expect(row.tabIndex).toBe(0);
    expect(row.getAttribute("aria-expanded")).toBe("false");
    row.focus();
    expect(document.activeElement).toBe(row);
  });

  it("Enter and Space toggle expansion", () => {
    const { container } = render(
      <BackgroundLayerList layers={[COLOR_LAYER]} onChange={() => {}} />,
    );
    fireEvent.keyDown(firstExpanderRow(container), { key: "Enter" });
    expect(firstExpanderRow(container).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(firstExpanderRow(container), { key: " " });
    expect(firstExpanderRow(container).getAttribute("aria-expanded")).toBe("false");
  });

  it("keystrokes on nested controls do NOT toggle the row (target guard)", () => {
    const { container } = render(
      <BackgroundLayerList layers={[COLOR_LAYER]} onChange={() => {}} />,
    );
    const row = firstExpanderRow(container);
    const nested = row.querySelector("button");
    expect(nested).toBeTruthy();
    fireEvent.keyDown(nested as HTMLElement, { key: "Enter" });
    expect(row.getAttribute("aria-expanded")).toBe("false");
  });
});

// ─── GridSettingsPopup ────────────────────────────────────────────────

describe("GridSettingsPopup track row expander a11y", () => {
  function renderPopup() {
    const anchorRect = {
      top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0,
      toJSON: () => ({}),
    } as DOMRect;
    return render(
      <GridSettingsPopup
        gridCols="1fr 100px"
        gridRows="auto"
        onGridColsChange={() => {}}
        onGridRowsChange={() => {}}
        anchorRect={anchorRect}
        onClose={() => {}}
      />,
    );
  }

  // The popup renders into a document.body portal ([data-tuner-portal]),
  // so query the portal root rather than the render container.
  function portalRoot(): HTMLElement {
    const portal = document.querySelector("[data-tuner-portal]");
    if (!portal) throw new Error("GridSettingsPopup portal not found");
    return portal as HTMLElement;
  }

  it("track header rows are focusable with role='button' and aria-expanded", () => {
    renderPopup();
    const rows = expanderRows(portalRoot());
    expect(rows.length).toBeGreaterThanOrEqual(3); // 2 col tracks + 1 row track
    for (const row of rows) {
      expect(row.tabIndex).toBe(0);
      expect(row.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("Enter and Space toggle a track row", () => {
    renderPopup();
    fireEvent.keyDown(firstExpanderRow(portalRoot()), { key: "Enter" });
    expect(firstExpanderRow(portalRoot()).getAttribute("aria-expanded")).toBe("true");
    fireEvent.keyDown(firstExpanderRow(portalRoot()), { key: " " });
    expect(firstExpanderRow(portalRoot()).getAttribute("aria-expanded")).toBe("false");
  });

  it("mouse click still toggles (unchanged)", () => {
    renderPopup();
    fireEvent.click(firstExpanderRow(portalRoot()));
    expect(firstExpanderRow(portalRoot()).getAttribute("aria-expanded")).toBe("true");
  });
});
