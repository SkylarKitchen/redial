// @vitest-environment happy-dom
/**
 * transformOriginComputed.test.tsx — Pattern-C bug: the transform-origin picker
 * mis-reads the px value that getComputedStyle ALWAYS supplies.
 *
 * Sweep finding (adversarially verified): getComputedStyle().transformOrigin
 * returns the RESOLVED value in absolute pixels for any laid-out element
 * (e.g. a 200×100 default-centered box yields "100px 50px"). The picker's
 * tokenToIndex returns -1 for px tokens, so parseOrigin -> [-1,-1] and NO grid
 * cell highlights on essentially every element — including the default center
 * case. The Left/Top inputs likewise read parseFloat("100px")=100 (clamped to
 * 100%) instead of the true 50%. The 19 existing tests only feed keyword/percent
 * values that getComputedStyle never returns, so they are blind to this.
 *
 * The fix: the picker accepts the element's box size and converts px -> % before
 * mapping. These tests pin that contract on the (now exported) pure helpers so
 * they cannot regress to the px-blind behavior.
 */
import { describe, it, expect } from "vitest";
import { parseOrigin, originToPercents } from "../sections/TransformOriginPicker";

const BOX = { width: 200, height: 100 };

describe("parseOrigin — maps computed px origins to the right grid cell", () => {
  it("centers (1,1) for the default '100px 50px' on a 200×100 box", () => {
    expect(parseOrigin("100px 50px", BOX)).toEqual([1, 1]);
  });

  it("top-left (0,0) for '0px 0px'", () => {
    expect(parseOrigin("0px 0px", BOX)).toEqual([0, 0]);
  });

  it("bottom-right (2,2) for '200px 100px'", () => {
    expect(parseOrigin("200px 100px", BOX)).toEqual([2, 2]);
  });

  // Keyword/percent paths must still work (no regression).
  it("still maps keywords ('top left' -> [0,0])", () => {
    expect(parseOrigin("top left", BOX)).toEqual([0, 0]);
  });
  it("still maps percentages ('50% 50%' -> [1,1])", () => {
    expect(parseOrigin("50% 50%", BOX)).toEqual([1, 1]);
  });
});

describe("originToPercents — converts computed px origins to true percentages", () => {
  it("'100px 50px' on a 200×100 box -> [50, 50] (not [100, 50])", () => {
    expect(originToPercents("100px 50px", BOX)).toEqual([50, 50]);
  });

  it("'200px 100px' -> [100, 100]", () => {
    expect(originToPercents("200px 100px", BOX)).toEqual([100, 100]);
  });

  it("still handles keywords ('center' -> [50, 50])", () => {
    expect(originToPercents("center", BOX)).toEqual([50, 50]);
  });
});
