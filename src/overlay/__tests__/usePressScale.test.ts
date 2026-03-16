// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePressScale } from "../controls/helpers";

describe("usePressScale", () => {
  it("returns pressStyle with no transform when not pressed", () => {
    const { result } = renderHook(() => usePressScale());
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("returns pressHandlers with onMouseDown, onMouseUp, onMouseLeave", () => {
    const { result } = renderHook(() => usePressScale());
    expect(typeof result.current.pressHandlers.onMouseDown).toBe("function");
    expect(typeof result.current.pressHandlers.onMouseUp).toBe("function");
    expect(typeof result.current.pressHandlers.onMouseLeave).toBe("function");
  });

  it("sets scale on mouseDown", () => {
    const { result } = renderHook(() => usePressScale(0.95));
    act(() => { result.current.pressHandlers.onMouseDown(); });
    expect(result.current.pressStyle.transform).toBe("scale(0.95)");
  });

  it("clears scale on mouseUp", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    act(() => { result.current.pressHandlers.onMouseUp(); });
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("clears scale on mouseLeave", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    act(() => { result.current.pressHandlers.onMouseLeave(); });
    expect(result.current.pressStyle.transform).toBeUndefined();
  });

  it("uses default scale of 0.97", () => {
    const { result } = renderHook(() => usePressScale());
    act(() => { result.current.pressHandlers.onMouseDown(); });
    expect(result.current.pressStyle.transform).toBe("scale(0.97)");
  });

  it("accepts custom scale", () => {
    const { result } = renderHook(() => usePressScale(0.92));
    act(() => { result.current.pressHandlers.onMouseDown(); });
    expect(result.current.pressStyle.transform).toBe("scale(0.92)");
  });

  it("includes transition in pressStyle", () => {
    const { result } = renderHook(() => usePressScale());
    expect(result.current.pressStyle.transition).toContain("transform");
  });

  it("pressHandlers are referentially stable", () => {
    const { result, rerender } = renderHook(() => usePressScale());
    const first = result.current.pressHandlers;
    rerender();
    expect(result.current.pressHandlers).toBe(first);
  });
});
