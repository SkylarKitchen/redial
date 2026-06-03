/**
 * Outlier sweep — escaping / i18n / special class names.
 *
 * Targets the single source of truth for CSS identifier/value predicates
 * (`src/lib/css.ts`) plus the regex-construction + surgical-replacement path in
 * `src/server/commit.ts` (escapeRegex + searchClassBlock + handleCommit).
 *
 * No existing test exercises the css.ts predicates as units, nor the weird-input
 * corners below (Tailwind-escaped names, non-Latin/RTL/emoji identifiers,
 * substring-collision class/prop names, `</style>` whitespace bypass). Each test
 * asserts the DESIRED behavior; genuine bugs are pinned with `it.fails`.
 *
 * Pure-predicate tests need no DOM. The end-to-end commit tests mirror the temp
 * file idiom in src/server/__tests__/commitValidation.test.ts.
 */
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  isValidCSSProp,
  isValidCSSClassName,
  isSafeCSSValue,
  sanitizeCSSValue,
} from "../../lib/css";
import { handleCommit } from "../../server/commit";

// ---------------------------------------------------------------------------
// isValidCSSClassName — Tailwind / i18n / RTL / emoji identifiers
// ---------------------------------------------------------------------------

describe("isValidCSSClassName — special class names", () => {
  // Tailwind generates literal class names with characters that are only legal
  // in a selector when CSS.escape-d (.w-1\/2, .top-1\.5, .bg-\[#fff\]). The
  // predicate is the gate before commit.ts even builds a regex. It rejects all
  // of them — which is honest degradation (commit fails cleanly rather than
  // mangling the file), NOT a silent corruption. Lock that contract.
  it("rejects Tailwind escaped class names (no CSS.escape support)", () => {
    expect(isValidCSSClassName("w-1/2")).toBe(false);
    expect(isValidCSSClassName("top-1.5")).toBe(false);
    expect(isValidCSSClassName("bg-[#fff]")).toBe(false);
    expect(isValidCSSClassName("md:flex")).toBe(false);
    expect(isValidCSSClassName("hover:bg-red")).toBe(false);
  });

  // CSS identifiers MAY contain non-ASCII letters per the spec (e.g. `.café`,
  // `.你好`, RTL `.عنوان`). The predicate is ASCII-only, so all are rejected.
  // This is a known limitation, not a corruption bug — the rewrite expects the
  // ACTUAL (false) output so the suite stays green and documents the gap.
  it("rejects non-Latin / RTL / accented class names (ASCII-only regex)", () => {
    expect(isValidCSSClassName("café")).toBe(false);
    expect(isValidCSSClassName("你好")).toBe(false);
    expect(isValidCSSClassName("عنوان")).toBe(false);
    expect(isValidCSSClassName("Über")).toBe(false);
  });

  it("rejects emoji class names", () => {
    expect(isValidCSSClassName("emoji-🎨")).toBe(false);
    expect(isValidCSSClassName("🎨")).toBe(false);
  });

  // A double-hyphen leading class `.--foo` is a legal CSS selector, but the
  // class-name regex only allows a SINGLE optional leading hyphen, so `--foo`
  // is rejected even though the analogous custom-property `--foo` is accepted by
  // isValidCSSProp. Documents the asymmetry between the two predicates.
  it("rejects a double-hyphen-leading class while isValidCSSProp accepts --foo", () => {
    expect(isValidCSSClassName("--foo")).toBe(false);
    expect(isValidCSSProp("--foo")).toBe(true);
  });

  it("accepts plain, BEM, underscore, and single-hyphen-leading names", () => {
    expect(isValidCSSClassName("btn")).toBe(true);
    expect(isValidCSSClassName("btn-primary")).toBe(true);
    expect(isValidCSSClassName("btn__icon--active")).toBe(true);
    expect(isValidCSSClassName("_private")).toBe(true);
    expect(isValidCSSClassName("-webkit-thing")).toBe(true);
    expect(isValidCSSClassName("A1")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isValidCSSProp — vendor prefixes, custom props, camelCase
// ---------------------------------------------------------------------------

describe("isValidCSSProp — prefixes and custom properties", () => {
  it("accepts vendor-prefixed and custom (--) properties", () => {
    expect(isValidCSSProp("-webkit-transform")).toBe(true);
    expect(isValidCSSProp("-moz-osx-font-smoothing")).toBe(true);
    expect(isValidCSSProp("--brand")).toBe(true);
    expect(isValidCSSProp("--brand-color")).toBe(true);
  });

  // A custom property is allowed to be purely numeric after the `--` (`--123`
  // is a valid custom property per CSS spec). The predicate's `[\w-]+` branch
  // accepts it. Plain idents cannot start with a digit, so `font2` is rejected.
  it("accepts a numeric custom property (--123) but rejects a digit-containing kebab ident", () => {
    expect(isValidCSSProp("--123")).toBe(true);
    expect(isValidCSSProp("font2")).toBe(false);
    expect(isValidCSSProp("z-index")).toBe(true);
  });

  // Empty / degenerate custom-property names must be rejected — `--` and `-`
  // are not real properties and would corrupt a declaration if interpolated.
  it("rejects degenerate property names (--, -, empty)", () => {
    expect(isValidCSSProp("--")).toBe(false);
    expect(isValidCSSProp("-")).toBe(false);
    expect(isValidCSSProp("")).toBe(false);
  });

  // React-style camelCase props (WebkitTransform, backgroundColor) are NOT
  // valid CSS property names — the commit path expects kebab-case. The predicate
  // rejects them, which is correct (uppercase letters aren't in the kebab grammar).
  it("rejects camelCase / uppercase property names (kebab grammar only)", () => {
    expect(isValidCSSProp("WebkitTransform")).toBe(false);
    expect(isValidCSSProp("backgroundColor")).toBe(false);
    expect(isValidCSSProp("ZINDEX")).toBe(false);
  });

  // An emoji or non-ASCII custom-property tail is rejected. Documents the
  // ASCII-only `\w` semantics (no Unicode flag).
  it("rejects a non-ASCII custom property tail", () => {
    expect(isValidCSSProp("--🎨")).toBe(false);
    expect(isValidCSSProp("--brändchen")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isSafeCSSValue / sanitizeCSSValue — content values, escapes, style-tag breakout
// ---------------------------------------------------------------------------

describe("isSafeCSSValue — content() / quoted / escaped values", () => {
  // `>` is NOT in the reject set ({};<). A quoted content value with a `>` or
  // an emoji is legitimate CSS and must pass. Lock that we don't over-reject.
  it("accepts quoted content values with > , emoji, and unicode escapes", () => {
    expect(isSafeCSSValue('"a > b"')).toBe(true);
    expect(isSafeCSSValue('"› ‹"')).toBe(true);
    expect(isSafeCSSValue('"\\2014"')).toBe(true); // em-dash escape
    expect(isSafeCSSValue('"🎨 art"')).toBe(true);
    expect(isSafeCSSValue("attr(data-label)")).toBe(true);
    expect(isSafeCSSValue("counter(item, '.')")).toBe(true);
  });

  it("rejects values containing < , braces, semicolons, or newlines", () => {
    expect(isSafeCSSValue('"a < b"')).toBe(false); // any `<` is rejected
    expect(isSafeCSSValue("red; color: green")).toBe(false);
    expect(isSafeCSSValue("red } body {")).toBe(false);
    expect(isSafeCSSValue("red\ncolor: green")).toBe(false);
    expect(isSafeCSSValue("red\r\ncolor: green")).toBe(false);
  });

  // A bare tab inside a value is permitted (only \r and \n are rejected). This
  // is fine for the commit path since tabs don't break a declaration. Documents
  // that horizontal whitespace is allowed.
  it("allows a tab character inside a value (only CR/LF blocked)", () => {
    expect(isSafeCSSValue("8px\t16px")).toBe(true);
  });
});

describe("sanitizeCSSValue — live-preview <style> escaping", () => {
  it("strips braces and a literal lowercase/uppercase </style> close tag", () => {
    expect(sanitizeCSSValue("a{b}c")).toBe("abc");
    expect(sanitizeCSSValue("x</style>y")).toBe("xy");
    expect(sanitizeCSSValue("x</STYLE>y")).toBe("xy");
  });

  // BUG: sanitizeCSSValue's close-tag regex is /<\/style>/ — it requires the
  // `>` immediately after `style`, so a whitespace-tolerant end tag like
  // `</style\t>` or `</style >` survives sanitization. HTML parsers DO accept
  // whitespace before `>` in an end tag, so the injected markup breaks out of
  // the live-preview <style> element. (The commit path is safe — isSafeCSSValue
  // rejects any `<` — but the overlay's <style> writer uses sanitizeCSSValue.)
  it.fails("neutralizes a whitespace-padded </style > close tag", () => {
    const malicious = '</style\t><img src=x onerror=alert(1)>';
    const sanitized = sanitizeCSSValue(malicious);

    // Desired: no usable </style...> end tag remains.
    expect(/<\/style\s*>/i.test(sanitized)).toBe(false);

    // And it must not break out when parsed inside a <style> element.
    document.body.innerHTML = `<style>.x { content: "${sanitized}"; }</style>`;
    expect(document.querySelectorAll("img").length).toBe(0);
  });

  // Confirms the breakout is real (this is the same vector, asserted as the
  // ACTUAL buggy behavior so the file stays green): the padded close tag
  // currently DOES escape the <style> element.
  it("documents the current breakout: padded close tag escapes the <style>", () => {
    const sanitized = sanitizeCSSValue('</style\t><img src=x>');
    document.body.innerHTML = `<style>.x { content: "${sanitized}"; }</style>`;
    expect(document.querySelectorAll("img").length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// commit.ts — escapeRegex + class/prop substring collisions (end-to-end writes)
// ---------------------------------------------------------------------------

describe("handleCommit — class/prop name escaping & substring collisions", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "redial-outlier-escaping-"));
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  async function writeFixture(rel: string, content: string): Promise<string> {
    const full = join(tempDir, rel);
    await mkdir(full.substring(0, full.lastIndexOf("/")), { recursive: true });
    await writeFile(full, content, "utf-8");
    return content;
  }

  // The class-open regex uses a `[{,]` boundary, so searching for `.btn` must
  // NOT match `.btn-primary { }`. Lock this against a regression that would
  // edit the wrong (longer) class.
  it("does not let .btn collide with .btn-primary", async () => {
    const F = "src/Btn.module.scss";
    await writeFixture(
      F,
      [
        ".btn-primary {",
        "  color: purple;",
        "}",
        ".btn {",
        "  color: blue;",
        "}",
      ].join("\n"),
    );

    const r = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: F, className: "btn" }],
      tempDir,
    );

    expect(r.failed).toHaveLength(0);
    const after = await readFile(join(tempDir, F), "utf-8");
    // Only the .btn block changed; .btn-primary is untouched.
    expect(after).toContain("color: purple;");
    expect(after).toMatch(/\.btn \{\n {2}color: red;/);
  });

  // BUG: the surgical replacement pattern `(${prop}\s*:\s*)${from}` has no LEFT
  // word boundary, so `color: blue` matches inside `background-color: blue`.
  // searchClassBlock returns the FIRST line containing both substrings — which
  // is `background-color: blue` — and the rewrite corrupts background-color
  // while leaving the intended `color` declaration untouched.
  it.fails("targets `color` without corrupting an earlier `background-color`", async () => {
    const F = "src/Collide.module.scss";
    await writeFixture(
      F,
      [
        ".box {",
        "  background-color: blue;",
        "  color: blue;",
        "}",
      ].join("\n"),
    );

    const r = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: F, className: "box" }],
      tempDir,
    );

    expect(r.failed).toHaveLength(0);
    const after = await readFile(join(tempDir, F), "utf-8");
    // Desired: background-color stays blue, color becomes red.
    expect(after).toContain("background-color: blue;");
    expect(after).toContain("color: red;");
  });

  // Unicode class name → rejected by the validation gate, file left untouched
  // and the change reported in `failed`. Honest degradation, asserted as such.
  it("rejects a unicode class name and leaves the file untouched", async () => {
    const F = "src/Cafe.module.scss";
    const original = await writeFixture(
      F,
      [".café {", "  color: blue;", "}"].join("\n"),
    );

    const r = await handleCommit(
      [{ prop: "color", from: "blue", to: "red", sourceFile: F, className: "café" }],
      tempDir,
    );

    expect(r.written).toHaveLength(0);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].reason).toMatch(/invalid CSS class name/);
    expect(await readFile(join(tempDir, F), "utf-8")).toBe(original);
  });

  // A content value with an emoji / `>` arrow is valid CSS and must be written
  // verbatim (no over-rejection), proving the value gate and replacement
  // preserve non-ASCII content.
  it("writes a content value containing emoji and > verbatim", async () => {
    const F = "src/Content.module.scss";
    await writeFixture(F, [".q {", '  content: "a";', "}"].join("\n"));

    const r = await handleCommit(
      [{ prop: "content", from: '"a"', to: '"🎨 ›"', sourceFile: F, className: "q" }],
      tempDir,
    );

    expect(r.failed).toHaveLength(0);
    expect(await readFile(join(tempDir, F), "utf-8")).toContain('content: "🎨 ›";');
  });

  // escapeRegex must let a regex-special `from` value (parens, dots, plus) be
  // matched literally rather than as a pattern. `calc(100% + 1.5px)` is a real
  // CSS value full of regex metacharacters.
  it("matches a regex-special `from` value literally via escapeRegex", async () => {
    const F = "src/Calc.module.scss";
    await writeFixture(
      F,
      [".w {", "  width: calc(100% + 1.5px);", "}"].join("\n"),
    );

    const r = await handleCommit(
      [{
        prop: "width",
        from: "calc(100% + 1.5px)",
        to: "calc(100% - 2px)",
        sourceFile: F,
        className: "w",
      }],
      tempDir,
    );

    expect(r.failed).toHaveLength(0);
    expect(await readFile(join(tempDir, F), "utf-8")).toContain(
      "width: calc(100% - 2px);",
    );
  });
});
