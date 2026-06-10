/**
 * stylesContainment.test.ts — the published stylesheet must not restyle the
 * host app (issue #58).
 *
 * `redial/styles.css` is imported unconditionally by HOST applications, so
 * everything it emits has to stay inside the panel. These tests compile
 * src/styles/globals.css through the real @tailwindcss/postcss pipeline (the
 * same plugin the tsup build runs) and walk the output with postcss, asserting
 * the containment invariant: every style rule is scoped to the panel.
 *
 * Allowed exceptions, both inert for hosts:
 *  - Tailwind's `@layer properties` fallback (`*, ::before, ::after,
 *    ::backdrop` inside `@supports`), which only initializes `--tw-*` custom
 *    properties for browsers without `@property` support;
 *  - `@property --tw-*` registrations, identical to what any Tailwind v4 host
 *    would register itself.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import postcss, { type Root, type Rule, type AtRule, type Container, type Document } from "postcss";

const GLOBALS = join(__dirname, "../globals.css");

let root: Root;

beforeAll(async () => {
  const { default: tailwindcss } = await import("@tailwindcss/postcss");
  const css = readFileSync(GLOBALS, "utf-8");
  const result = await postcss([tailwindcss()]).process(css, {
    from: GLOBALS,
    map: false,
  });
  root = result.root;
}, 60_000);

/** Walk a rule's ancestors looking for an at-rule of the given name. */
function insideAtRule(rule: Rule, name: string): boolean {
  let parent: Container | Document | undefined = rule.parent;
  while (parent) {
    if (parent.type === "atrule" && (parent as AtRule).name === name) return true;
    parent = parent.parent;
  }
  return false;
}

/** Walk a rule's ancestors looking for a rule whose selector scopes the panel. */
function insidePanelScope(rule: Rule): boolean {
  let parent: Container | Document | undefined = rule.parent;
  while (parent) {
    if (parent.type === "rule" && (parent as Rule).selector.includes("__tuner-root")) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

/** True when every declaration in the rule is a `--tw-*` custom property. */
function onlyTwVariables(rule: Rule): boolean {
  let ok = true;
  let count = 0;
  rule.walkDecls((decl) => {
    count++;
    if (!decl.prop.startsWith("--tw-")) ok = false;
  });
  return count > 0 && ok;
}

describe("published stylesheet containment (issue #58)", () => {
  it("emits no :root, html, or body selectors", () => {
    const offenders: string[] = [];
    root.walkRules((rule) => {
      if (/(^|[^\w-]):root|\bhtml\b|\bbody\b/.test(rule.selector)) {
        offenders.push(rule.selector);
      }
    });
    expect(offenders, "host-global selectors leaked into the build").toEqual([]);
  });

  it("emits no preflight reset", () => {
    // Preflight's signature: a bare universal reset with margin/border
    // declarations. The only `*` selectors allowed are Tailwind's --tw-*
    // fallback block inside @supports.
    const offenders: string[] = [];
    root.walkRules((rule) => {
      const hasUniversal = rule.selectors.some((s) => s.trim().startsWith("*") || s.trim().startsWith("::"));
      if (!hasUniversal) return;
      if (rule.selector.includes("__tuner-root")) return; // panel's own scoped reset
      if (insideAtRule(rule, "supports") && onlyTwVariables(rule)) return;
      offenders.push(rule.selector);
    });
    expect(offenders, "unscoped universal selectors beyond the --tw-* fallback").toEqual([]);
  });

  it("scopes every style rule to the panel", () => {
    const offenders: string[] = [];
    root.walkRules((rule) => {
      // Keyframe steps style nothing by themselves.
      if (insideAtRule(rule, "keyframes")) return;
      // The --tw-* @supports fallback is inert for hosts.
      if (insideAtRule(rule, "supports") && onlyTwVariables(rule)) return;
      const scoped =
        rule.selector.includes("__tuner-") || // panel containers + selection outline
        rule.selector.includes("dialkit-") || // legacy scoped overrides (always nested under __tuner-root)
        insidePanelScope(rule);
      if (!scoped) offenders.push(rule.selector);
    });
    expect(offenders, "rules that can match host-app elements").toEqual([]);
  });

  it("emits utilities under .__tuner-root with !important", () => {
    // Sanity that the scoping didn't silently produce an empty build:
    // utilities must exist, nested under the panel scope, and keep
    // !important so panel layout still beats unlayered host CSS.
    let flexRule: Rule | undefined;
    root.walkRules((rule) => {
      if (rule.selector === ".flex" && insidePanelScope(rule)) flexRule = rule;
    });
    expect(flexRule, "expected a .flex utility nested under .__tuner-root").toBeDefined();
    let display: string | undefined;
    let important = false;
    flexRule!.walkDecls("display", (decl) => {
      display = decl.value;
      important = decl.important === true;
    });
    expect(display).toBe("flex");
    expect(important, ".flex must keep !important").toBe(true);
  });

  it("emits no Tailwind theme variables outside the panel scope", () => {
    const offenders: string[] = [];
    root.walkRules((rule) => {
      if (insideAtRule(rule, "supports") || insideAtRule(rule, "keyframes")) return;
      if (rule.selector.includes("__tuner-root") || insidePanelScope(rule)) return;
      rule.walkDecls((decl) => {
        if (decl.prop.startsWith("--")) offenders.push(`${rule.selector} { ${decl.prop} }`);
      });
    });
    expect(offenders, "custom properties leaked outside the panel").toEqual([]);
  });
});
