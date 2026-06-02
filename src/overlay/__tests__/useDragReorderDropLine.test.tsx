// @vitest-environment happy-dom
/**
 * useDragReorderDropLine.test.tsx — behavioral test for useDragReorder's
 * drag gesture + the drop-line indicator node.
 *
 * The hand-rolled `{(() => { const s = dropLineStyle(); return s ? <div
 * style={s}/> : null })()}` IIFE was copy-pasted into all four list editors.
 * We're moving that into the hook as a ready `dropLine: ReactNode`. This test
 * drives the actual pointer-drag (previously only the pure reorder math was
 * tested) and asserts the hook now yields a drop-line node during a drag and
 * still emits the reordered array on drop.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useDragReorder } from "../hooks/useDragReorder";

beforeAll(() => {
  // happy-dom doesn't implement pointer capture; the hook calls it in
  // onPointerDown, so polyfill it as a no-op or the handler throws.
  const proto = Element.prototype as unknown as Record<string, unknown>;
  if (!proto.setPointerCapture) proto.setPointerCapture = () => {};
  if (!proto.releasePointerCapture) proto.releasePointerCapture = () => {};
  if (!proto.hasPointerCapture) proto.hasPointerCapture = () => false;
});

afterEach(() => {
  cleanup();
});

function Harness({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const { registerRef, handleProps, itemStyle, dropLine } = useDragReorder(
    items,
    onChange,
  );
  return (
    <div data-testid="list" style={{ position: "relative" }}>
      {items.map((it, i) => (
        <div key={i} ref={registerRef(i)} style={itemStyle(i)}>
          <span data-testid={`handle-${i}`} {...handleProps(i)}>
            {it}
          </span>
        </div>
      ))}
      {dropLine}
    </div>
  );
}

/** A drop-line is the 2px indicator div the hook renders during a drag. */
function dropLineEl(container: HTMLElement): Element | null {
  return container.querySelector('div[style*="height: 2px"]');
}

describe("useDragReorder — drop-line node + drag gesture", () => {
  it("renders no drop-line when idle", () => {
    const { container } = render(
      <Harness items={["a", "b"]} onChange={vi.fn()} />,
    );
    expect(dropLineEl(container)).toBeNull();
  });

  it("shows a drop-line while dragging and emits the reordered array on drop", () => {
    const onChange = vi.fn();
    const { container, getByTestId } = render(
      <Harness items={["a", "b"]} onChange={onChange} />,
    );

    const handle = getByTestId("handle-1");
    fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientY: 0 });
    // move past the 3px dead zone to enter the dragging state
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 50 });

    expect(dropLineEl(container)).not.toBeNull();

    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 50 });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(["b", "a"]);
  });
});
