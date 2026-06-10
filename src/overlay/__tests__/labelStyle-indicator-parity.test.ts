/**
 * labelStyle-indicator-parity.test.ts
 *
 * Guards that `labelStyle()` in controls/helpers.tsx applies the full
 * 6-member IndicatorType palette rather than the old binary modified/none
 * branch it previously used.
 *
 * Bug: `labelStyle()` checked `indicator === "modified"` and fell back to
 * `labelIndicator.none` for all other non-none types ("authored-here",
 * "inherited", "element-inline", "state") — so those rows rendered unstyled
 * even though provenance tooltips were already being shown.
 *
 * Fix: delegate to `indicatorStyle()` from theme.ts (the same Record-based
 * lookup that section headers use) so there is exactly one IndicatorType→style
 * mapping in the codebase.
 */

import { describe, it, expect } from "vitest";
import { labelStyle } from "../controls/helpers";
import { indicatorStyle, labelIndicator, type IndicatorType } from "../theme";

const ALL_TYPES: IndicatorType[] = [
  "authored-here",
  "inherited",
  "element-inline",
  "state",
  "modified",
  "none",
];

// ─── Parity: labelStyle must agree with indicatorStyle for every variant ──

describe("labelStyle() parity with indicatorStyle()", () => {
  for (const type of ALL_TYPES) {
    it(`labelStyle("${type}") applies the same highlight as indicatorStyle("${type}")`, () => {
      const rowStyle = labelStyle(type);
      const expected = indicatorStyle(type);

      // For types with a visible highlight ("none" returns {}), each property
      // in the expected object must appear verbatim in the row style.
      for (const [key, value] of Object.entries(expected)) {
        expect(rowStyle).toHaveProperty(key, value);
      }
    });
  }

  it('labelStyle("authored-here") color matches labelIndicator["authored-here"].text', () => {
    const style = labelStyle("authored-here");
    expect(style.color).toBe(labelIndicator["authored-here"].text);
  });

  it('labelStyle("inherited") color matches labelIndicator.inherited.text', () => {
    const style = labelStyle("inherited");
    expect(style.color).toBe(labelIndicator.inherited.text);
  });

  it('labelStyle("element-inline") color matches labelIndicator["element-inline"].text', () => {
    const style = labelStyle("element-inline");
    expect(style.color).toBe(labelIndicator["element-inline"].text);
  });

  it('labelStyle("state") color matches labelIndicator.state.text', () => {
    const style = labelStyle("state");
    expect(style.color).toBe(labelIndicator.state.text);
  });

  it('labelStyle("none") uses the none text color (not any indicator color)', () => {
    const style = labelStyle("none");
    expect(style.color).toBe(labelIndicator.none.text);
  });
});

// ─── Regression: old binary branch would return none-style for non-modified ──

describe("regression: non-modified provenance variants must not render as 'none'", () => {
  const PROVENANCE_TYPES: IndicatorType[] = [
    "authored-here",
    "inherited",
    "element-inline",
    "state",
  ];

  for (const type of PROVENANCE_TYPES) {
    it(`labelStyle("${type}").background is NOT the none background`, () => {
      const style = labelStyle(type);
      // The old code returned labelIndicator.none.bg ("transparent") for all
      // these types; after the fix they should get their own distinct bg.
      const noneStyle = indicatorStyle("none");
      const expectedBg = labelIndicator[type].bg;
      expect(style.background).toBe(expectedBg);
      // And it must differ from the none background (which is transparent / "").
      if (noneStyle.background !== undefined) {
        expect(style.background).not.toBe(noneStyle.background);
      } else {
        // indicatorStyle("none") returns {} — so just confirm background exists
        expect(style.background).toBeTruthy();
      }
    });
  }
});
