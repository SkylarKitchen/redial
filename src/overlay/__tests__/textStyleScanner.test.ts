// @vitest-environment happy-dom
/**
 * Issue #106 — behavioral coverage for src/overlay/textStyleScanner.ts.
 *
 * scanTextStyles(): probe creation/cleanup and the CSS-reset fallback.
 * happy-dom's UA stylesheet reports the same font-size for every heading
 * (like a Tailwind Preflight reset would), which deterministically triggers
 * the HEADING_DEFAULTS branch — each test asserts that precondition first so
 * a happy-dom UA-style change fails loudly instead of silently shifting what
 * is being tested.
 *
 * matchTextStyle(): pure function — driven with a handcrafted fixture.
 */
import { describe, it, expect, afterEach } from "vitest";
import { scanTextStyles, matchTextStyle, type TextStyle } from "../textStyleScanner";

const PROBE_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "small", "blockquote"];

/** Assert the environment precondition the fallback tests rely on. */
function expectFlattenedHeadings() {
  const h1 = document.createElement("h1");
  const h3 = document.createElement("h3");
  document.body.append(h1, h3);
  expect(getComputedStyle(h1).fontSize).toBe(getComputedStyle(h3).fontSize);
  h1.remove();
  h3.remove();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("scanTextStyles — probe scan", () => {
  it("returns one style per probe tag, in hierarchy order", () => {
    const styles = scanTextStyles();
    expect(styles.map((s) => s.tag)).toEqual(PROBE_TAGS);
    expect(styles[0].name).toBe("Heading 1");
    expect(styles[6].name).toBe("Paragraph");
    expect(styles[8].name).toBe("Blockquote");
  });

  it("removes its hidden probe container from the DOM", () => {
    expect(document.body.childElementCount).toBe(0);
    scanTextStyles();
    expect(document.body.childElementCount).toBe(0);
    expect(document.body.innerHTML).toBe("");
  });

  it("captures the computed typography fields for every style", () => {
    // happy-dom computes font metrics but returns "" for letterSpacing /
    // color / textTransform — the scanner copies computed values verbatim,
    // so only the metric fields are asserted non-empty here.
    for (const style of scanTextStyles()) {
      expect(style.fontSize).toMatch(/px$/);
      expect(style.fontFamily).not.toBe("");
      expect(style.fontWeight).not.toBe("");
      expect(style.lineHeight).not.toBe("");
    }
  });

  it("applies the browser-default heading hierarchy when a CSS reset flattens headings", () => {
    expectFlattenedHeadings();
    const styles = scanTextStyles();
    const byTag = Object.fromEntries(styles.map((s) => [s.tag, s]));

    // HEADING_DEFAULTS: fontSize px, weight 700, lineHeight = round(size × 1.2)
    expect(byTag.h1.fontSize).toBe("32px");
    expect(byTag.h1.fontWeight).toBe("700");
    expect(byTag.h1.lineHeight).toBe("38px"); // round(38.4)
    expect(byTag.h2.fontSize).toBe("24px");
    expect(byTag.h2.lineHeight).toBe("29px"); // round(28.8)
    expect(byTag.h6.fontSize).toBe("11px");
    expect(byTag.h6.lineHeight).toBe("13px"); // round(13.2)

    // The hierarchy must be strictly descending — the point of the fallback.
    const sizes = ["h1", "h2", "h3", "h4", "h5", "h6"].map((t) => parseFloat(byTag[t].fontSize));
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it("leaves non-heading probes untouched by the reset fallback", () => {
    expectFlattenedHeadings();
    const styles = scanTextStyles();
    const p = styles.find((s) => s.tag === "p")!;
    // p keeps its computed size (happy-dom default 16px), not a heading default
    expect(p.fontSize).toBe("16px");
    expect(p.fontWeight).not.toBe("700");
  });
});

describe("matchTextStyle — matching an element against scanned styles", () => {
  const fixture: TextStyle[] = [
    {
      name: "Heading 2",
      tag: "h2",
      fontFamily: "Arial",
      fontWeight: "700",
      fontSize: "24px",
      lineHeight: "29px",
      letterSpacing: "normal",
      color: "rgb(0, 0, 0)",
      textTransform: "none",
    },
    {
      name: "Paragraph",
      tag: "p",
      fontFamily: "Georgia",
      fontWeight: "400",
      fontSize: "16px",
      lineHeight: "24px",
      letterSpacing: "0.5px",
      color: "rgb(20, 20, 20)",
      textTransform: "none",
    },
  ];

  function fakeCs(overrides: Partial<CSSStyleDeclaration> = {}): CSSStyleDeclaration {
    return {
      fontFamily: "system-ui",
      fontWeight: "300",
      fontSize: "13px",
      lineHeight: "18px",
      letterSpacing: "normal",
      color: "rgb(99, 99, 99)",
      textTransform: "none",
      ...overrides,
    } as CSSStyleDeclaration;
  }

  it("matches by tag name even when the computed styles differ completely", () => {
    const el = document.createElement("h2");
    const match = matchTextStyle(el, fakeCs(), fixture);
    expect(match?.name).toBe("Heading 2");
  });

  it("matches a non-probe tag by typography properties", () => {
    const el = document.createElement("span");
    const cs = fakeCs({
      fontFamily: "Georgia",
      fontWeight: "400",
      fontSize: "16px",
      lineHeight: "24px",
      textTransform: "none",
    });
    expect(matchTextStyle(el, cs, fixture)?.name).toBe("Paragraph");
  });

  it("ignores color and letter-spacing when property-matching (too volatile)", () => {
    const el = document.createElement("div");
    const cs = fakeCs({
      fontFamily: "Georgia",
      fontWeight: "400",
      fontSize: "16px",
      lineHeight: "24px",
      textTransform: "none",
      color: "rgb(255, 0, 0)", // differs from the fixture
      letterSpacing: "3px", // differs from the fixture
    });
    expect(matchTextStyle(el, cs, fixture)?.name).toBe("Paragraph");
  });

  it("requires all five matched properties to line up", () => {
    const el = document.createElement("span");
    const cs = fakeCs({
      fontFamily: "Georgia",
      fontWeight: "400",
      fontSize: "17px", // one property off → no match
      lineHeight: "24px",
      textTransform: "none",
    });
    expect(matchTextStyle(el, cs, fixture)).toBeNull();
  });

  it("returns null when nothing matches", () => {
    const el = document.createElement("code");
    expect(matchTextStyle(el, fakeCs(), fixture)).toBeNull();
  });

  it("tag match wins over a property match for a different style", () => {
    const el = document.createElement("h2");
    // Computed styles are exactly the Paragraph fixture — but the tag is h2.
    const cs = fakeCs({
      fontFamily: "Georgia",
      fontWeight: "400",
      fontSize: "16px",
      lineHeight: "24px",
      textTransform: "none",
    });
    expect(matchTextStyle(el, cs, fixture)?.name).toBe("Heading 2");
  });
});
