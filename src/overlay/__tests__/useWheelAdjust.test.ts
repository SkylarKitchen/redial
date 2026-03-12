import { describe, it, expect } from "vitest";
import { computeWheelValue } from "../useWheelAdjust";

// Helpers: deltaY < 0 = scroll up (increment), deltaY > 0 = scroll down (decrement)
const UP = -1;
const DOWN = 1;
const NO_SHIFT = false;
const NO_ALT = false;

describe("computeWheelValue", () => {
  // --- Base step ---
  it("scroll up increments by baseStep", () => {
    expect(computeWheelValue(10, UP, NO_SHIFT, NO_ALT, 1)).toBe(11);
  });

  it("scroll down decrements by baseStep", () => {
    expect(computeWheelValue(10, DOWN, NO_SHIFT, NO_ALT, 1)).toBe(9);
  });

  it("respects custom baseStep", () => {
    expect(computeWheelValue(50, UP, NO_SHIFT, NO_ALT, 5)).toBe(55);
    expect(computeWheelValue(50, DOWN, NO_SHIFT, NO_ALT, 5)).toBe(45);
  });

  // --- Shift modifier ---
  it("shift forces step to 10 regardless of baseStep", () => {
    expect(computeWheelValue(100, UP, true, NO_ALT, 1)).toBe(110);
    expect(computeWheelValue(100, DOWN, true, NO_ALT, 1)).toBe(90);
  });

  it("shift overrides a large baseStep", () => {
    expect(computeWheelValue(0, UP, true, NO_ALT, 50)).toBe(10);
  });

  // --- Alt modifier ---
  it("alt forces step to 0.1 regardless of baseStep", () => {
    expect(computeWheelValue(5, UP, NO_SHIFT, true, 1)).toBe(5.1);
    expect(computeWheelValue(5, DOWN, NO_SHIFT, true, 1)).toBe(4.9);
  });

  // --- Shift + Alt: Shift takes priority ---
  it("shift takes priority over alt when both are held", () => {
    expect(computeWheelValue(0, UP, true, true, 1)).toBe(10);
    expect(computeWheelValue(20, DOWN, true, true, 1)).toBe(10);
  });

  // --- Rounding (no floating point errors) ---
  it("rounds to avoid floating point drift", () => {
    // 0.1 + 0.1 should be exactly 0.2, not 0.20000000000000001
    expect(computeWheelValue(0.1, UP, NO_SHIFT, true, 1)).toBe(0.2);
  });

  it("rounds negative results cleanly", () => {
    expect(computeWheelValue(0, DOWN, NO_SHIFT, true, 1)).toBe(-0.1);
  });

  it("handles repeated small increments without drift", () => {
    let val = 0;
    for (let i = 0; i < 10; i++) {
      val = computeWheelValue(val, UP, NO_SHIFT, true, 1);
    }
    expect(val).toBe(1);
  });

  // --- Clamping max ---
  it("clamps to max when result would exceed it", () => {
    expect(computeWheelValue(99, UP, NO_SHIFT, NO_ALT, 5, undefined, 100)).toBe(100);
  });

  it("does not clamp when result is below max", () => {
    expect(computeWheelValue(90, UP, NO_SHIFT, NO_ALT, 5, undefined, 100)).toBe(95);
  });

  // --- Clamping min ---
  it("clamps to min when result would go below it", () => {
    expect(computeWheelValue(1, DOWN, NO_SHIFT, NO_ALT, 5, 0)).toBe(0);
  });

  it("does not clamp when result is above min", () => {
    expect(computeWheelValue(10, DOWN, NO_SHIFT, NO_ALT, 5, 0)).toBe(5);
  });

  // --- Both clamps ---
  it("clamps within min and max range", () => {
    expect(computeWheelValue(100, UP, true, NO_ALT, 1, 0, 100)).toBe(100);
    expect(computeWheelValue(0, DOWN, true, NO_ALT, 1, 0, 100)).toBe(0);
  });

  // --- No clamps ---
  it("allows unbounded values when min/max are undefined", () => {
    expect(computeWheelValue(1000, UP, true, NO_ALT, 1)).toBe(1010);
    expect(computeWheelValue(-1000, DOWN, true, NO_ALT, 1)).toBe(-1010);
  });

  // --- deltaY sign ---
  it("treats negative deltaY as scroll-up (increment)", () => {
    expect(computeWheelValue(0, -100, NO_SHIFT, NO_ALT, 1)).toBe(1);
  });

  it("treats positive deltaY as scroll-down (decrement)", () => {
    expect(computeWheelValue(0, 100, NO_SHIFT, NO_ALT, 1)).toBe(-1);
  });

  // --- Edge cases ---
  it("zero deltaY is treated as scroll-down (not less than 0)", () => {
    // deltaY < 0 is the increment condition; 0 is not < 0, so it decrements
    expect(computeWheelValue(10, 0, NO_SHIFT, NO_ALT, 1)).toBe(9);
  });

  it("current at exact min boundary, scroll down stays at min", () => {
    expect(computeWheelValue(0, DOWN, NO_SHIFT, NO_ALT, 1, 0, 100)).toBe(0);
  });

  it("current at exact max boundary, scroll up stays at max", () => {
    expect(computeWheelValue(100, UP, NO_SHIFT, NO_ALT, 1, 0, 100)).toBe(100);
  });
});
