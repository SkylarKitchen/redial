/**
 * inputMath.ts — Evaluate simple math expressions in numeric inputs
 *
 * Supports: "200+50", "*2", "/3", "16-4"
 * When the left operand is omitted, uses the current value.
 */

export function evaluateMathExpr(input: string, currentValue: number): number | null {
  const match = input.match(/^([0-9.]*)\s*([+\-*/])\s*([0-9.]+)$/);
  if (!match) return null;
  const left = match[1] ? parseFloat(match[1]) : currentValue;
  const right = parseFloat(match[3]);
  if (isNaN(left) || isNaN(right)) return null;
  switch (match[2]) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return right !== 0 ? left / right : null;
  }
  return null;
}
