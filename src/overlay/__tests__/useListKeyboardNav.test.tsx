// @vitest-environment happy-dom
/**
 * useListKeyboardNav.test.tsx — guards the keyboard behavior the shadcn Command
 * (cmdk) gave us, now hand-rolled (shadcn migration, 2026-06-03).
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function key(k: string) {
  const preventDefault = vi.fn();
  return { event: { key: k, preventDefault } as unknown as React.KeyboardEvent, preventDefault };
}

describe("useListKeyboardNav", () => {
  it("auto-highlights the first item when items are present", () => {
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 3, onSelect: vi.fn() }));
    expect(result.current.activeIndex).toBe(0);
  });

  it("reports -1 when the list is empty", () => {
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 0, onSelect: vi.fn() }));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("ArrowDown advances and wraps at the end", () => {
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 2, onSelect: vi.fn() }));
    const d1 = key("ArrowDown");
    act(() => result.current.handleKeyDown(d1.event));
    expect(result.current.activeIndex).toBe(1);
    expect(d1.preventDefault).toHaveBeenCalled();
    act(() => result.current.handleKeyDown(key("ArrowDown").event));
    expect(result.current.activeIndex).toBe(0); // wrapped
  });

  it("ArrowUp retreats and wraps at the start", () => {
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 3, onSelect: vi.fn() }));
    act(() => result.current.handleKeyDown(key("ArrowUp").event));
    expect(result.current.activeIndex).toBe(2); // wrapped to last
  });

  it("Home and End jump to the ends", () => {
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 5, onSelect: vi.fn() }));
    act(() => result.current.handleKeyDown(key("End").event));
    expect(result.current.activeIndex).toBe(4);
    act(() => result.current.handleKeyDown(key("Home").event));
    expect(result.current.activeIndex).toBe(0);
  });

  it("Enter selects the highlighted index", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useListKeyboardNav({ itemCount: 3, onSelect }));
    act(() => result.current.handleKeyDown(key("ArrowDown").event)); // -> 1
    const enter = key("Enter");
    act(() => result.current.handleKeyDown(enter.event));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(enter.preventDefault).toHaveBeenCalled();
  });

  it("does not loop when loop=false", () => {
    const { result } = renderHook(() =>
      useListKeyboardNav({ itemCount: 2, onSelect: vi.fn(), loop: false }),
    );
    act(() => result.current.handleKeyDown(key("ArrowUp").event));
    expect(result.current.activeIndex).toBe(0); // clamped, no wrap
    act(() => result.current.handleKeyDown(key("ArrowDown").event)); // -> 1
    act(() => result.current.handleKeyDown(key("ArrowDown").event)); // clamps at 1
    expect(result.current.activeIndex).toBe(1);
  });

  it("re-clamps when the list shrinks (filter narrows results)", () => {
    const { result, rerender } = renderHook(
      ({ n }) => useListKeyboardNav({ itemCount: n, onSelect: vi.fn() }),
      { initialProps: { n: 5 } },
    );
    act(() => result.current.handleKeyDown(key("End").event)); // -> 4
    expect(result.current.activeIndex).toBe(4);
    rerender({ n: 2 }); // filter narrowed to 2 results
    expect(result.current.activeIndex).toBe(0); // re-highlighted first
  });

  it("ignores keys when disabled", () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() =>
      useListKeyboardNav({ itemCount: 3, onSelect, enabled: false }),
    );
    act(() => result.current.handleKeyDown(key("ArrowDown").event));
    expect(result.current.activeIndex).toBe(0); // unchanged
    act(() => result.current.handleKeyDown(key("Enter").event));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
