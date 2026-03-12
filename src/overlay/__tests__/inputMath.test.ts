import { describe, it, expect } from "vitest";
import { evaluateMathExpr } from "../inputMath";

describe("evaluateMathExpr", () => {
  it("adds two numbers", () => {
    expect(evaluateMathExpr("200+50", 0)).toBe(250);
  });

  it("subtracts two numbers", () => {
    expect(evaluateMathExpr("100-25", 0)).toBe(75);
  });

  it("multiplies two numbers", () => {
    expect(evaluateMathExpr("10*3", 0)).toBe(30);
  });

  it("divides two numbers", () => {
    expect(evaluateMathExpr("100/4", 0)).toBe(25);
  });

  it("uses currentValue when left operand is omitted", () => {
    expect(evaluateMathExpr("*2", 16)).toBe(32);
    expect(evaluateMathExpr("+10", 5)).toBe(15);
    expect(evaluateMathExpr("-3", 20)).toBe(17);
    expect(evaluateMathExpr("/4", 100)).toBe(25);
  });

  it("returns null for division by zero", () => {
    expect(evaluateMathExpr("100/0", 0)).toBeNull();
    expect(evaluateMathExpr("/0", 50)).toBeNull();
  });

  it("returns null for non-expression input", () => {
    expect(evaluateMathExpr("200", 0)).toBeNull();
    expect(evaluateMathExpr("abc", 0)).toBeNull();
    expect(evaluateMathExpr("", 0)).toBeNull();
    expect(evaluateMathExpr("hello+world", 0)).toBeNull();
  });

  it("handles decimal numbers", () => {
    expect(evaluateMathExpr("1.5*2", 0)).toBe(3);
    expect(evaluateMathExpr("10.5+0.5", 0)).toBe(11);
    expect(evaluateMathExpr("*1.5", 10)).toBe(15);
  });

  it("handles large numbers", () => {
    expect(evaluateMathExpr("1000000+1", 0)).toBe(1000001);
    expect(evaluateMathExpr("*1000", 999)).toBe(999000);
  });

  it("handles spaces around operator", () => {
    expect(evaluateMathExpr("200 + 50", 0)).toBe(250);
    expect(evaluateMathExpr("10 * 3", 0)).toBe(30);
  });
});
