/**
 * stylingSystem.ts — classify which styling system authored an element's
 * styles, and whether the save pipeline can write edits back to source.
 *
 * Why: the save path (commitUtils.enrichChangesForCommit → src/server/commit.ts)
 * only supports two write targets:
 *   1. Tailwind — CSS diffs are converted to utility classes and merged into
 *      the JSX `className` (isTailwindElement routes here FIRST).
 *   2. CSS files — the server searches project .css/.scss files, guided by
 *      CSS-module class info (getModuleClassInfo) or a stylesheet href that
 *      resolves to a project file (getGlobalCSSSource).
 *
 * Everything else — styled-components, Emotion, styled-jsx, runtime-injected
 * <style> tags, stylesheets from other origins, inline-only styling — has NO
 * save path and fails at save time with per-property "not found" errors.
 * This classifier is the upfront signal so the panel can warn BEFORE the user
 * invests edits (see WebflowPanel's capability notice).
 *
 * All heuristics are read-only over the DOM/CSSOM; `saveable` mirrors what
 * the commit enrichment can actually resolve, it does not guess.
 */

import { isTailwindElement } from "./scope";
import { getModuleClassInfo } from "./sourcemap";

export type StylingSystem =
  | "css-modules"
  | "tailwind"
  | "inline"
  | "css-in-js"
  | "external-stylesheet"
  | "unknown";

export interface StylingSystemInfo {
  system: StylingSystem;
  /** Whether the save pipeline can write this element's edits to source. */
  saveable: boolean;
  /** Human-readable, panel-ready explanation. */
  reason: string;
}

const CANT_SAVE = "edits preview live but can't be saved to source";

/** styled-components stable component class, e.g. "sc-bdVaJa". */
const SC_CLASS_RE = /^sc-[A-Za-z0-9_-]+$/;
/** Emotion generated class, e.g. "css-1q2w3e" or "css-1q2w3e-Label". */
const EMOTION_CLASS_RE = /^css-[a-z0-9]+(?:-[\w-]+)?$/;

function cssInJsResult(flavor: string | null): StylingSystemInfo {
  const by = flavor ?? "a runtime-injected style tag (CSS-in-JS)";
  return {
    system: "css-in-js",
    saveable: false,
    reason: `Styled by ${by} — ${CANT_SAVE}.`,
  };
}

/** Which CSS-in-JS library owns a runtime <style> tag, by its marker attrs. */
function cssInJsFlavor(owner: Element): string | null {
  if (owner.hasAttribute("data-styled") || owner.hasAttribute("data-styled-components")) {
    return "styled-components";
  }
  if (owner.hasAttribute("data-emotion")) return "Emotion";
  if (owner.hasAttribute("data-styled-jsx")) return "styled-jsx";
  return null;
}

/** Redial's own managed sheets must never count as authored-source evidence
 *  (same guard as commitUtils.findGlobalClassName). */
function isTunerNode(owner: Node | null): boolean {
  return (
    owner instanceof Element &&
    (owner.hasAttribute("data-tuner-scope") || /^(redial-|__tuner|tuner-)/.test(owner.id))
  );
}

/**
 * Resolve the <style>/<link> element that owns a sheet. Some environments
 * (notably happy-dom in tests) don't populate `sheet.ownerNode`, so fall back
 * to correlating via `styleEl.sheet === sheet`.
 */
function resolveOwner(sheet: CSSStyleSheet): Element | null {
  const owner = sheet.ownerNode;
  if (owner instanceof Element) return owner;
  try {
    for (const styleEl of document.querySelectorAll("style, link[rel=stylesheet]")) {
      if ((styleEl as HTMLStyleElement | HTMLLinkElement).sheet === sheet) return styleEl;
    }
  } catch {
    // querySelectorAll failed — no owner resolvable
  }
  return null;
}

/**
 * Guard against generic rules (`* {}`, `body {}` from resets or
 * createGlobalStyle) counting as evidence for every element on the page:
 * the selector must actually name the element's id, one of its classes,
 * or its tag.
 */
function selectorMentionsElement(selector: string, el: Element): boolean {
  if (el.id && selector.includes(`#${el.id}`)) return true;
  for (const cls of Array.from(el.classList)) {
    if (cls && selector.includes(`.${cls}`)) return true;
  }
  const tag = el.tagName.toLowerCase();
  try {
    return new RegExp(`(^|[\\s>+~,(])${tag}(?![\\w-])`, "i").test(selector);
  } catch {
    return false;
  }
}

function getClasses(el: Element): string[] {
  const classes = el.className;
  if (typeof classes !== "string" || !classes.trim()) return [];
  return classes.split(/\s+/).filter(Boolean);
}

/**
 * Classify the styling system of an element and whether edits can be saved.
 * Checks run in the same priority order as the save pipeline itself.
 */
export function classifyStylingSystem(el: Element): StylingSystemInfo {
  // 1. Tailwind — enrichChangesForCommit checks isTailwindElement() FIRST,
  //    so it wins even when a CSS-module class is also present.
  if (isTailwindElement(el)) {
    return {
      system: "tailwind",
      saveable: true,
      reason: "Styled with Tailwind utilities — edits save to the JSX className.",
    };
  }

  // 2. CSS modules — getModuleClassInfo is exactly what the commit enrichment
  //    resolves (webpack / Turbopack / Vite class shapes), so a hit here means
  //    the server can locate the .module.css/.scss block.
  if (getModuleClassInfo(el) !== null) {
    return {
      system: "css-modules",
      saveable: true,
      reason: "Styled with CSS Modules — edits save to the module stylesheet.",
    };
  }

  const classes = getClasses(el);

  // 3. CSS-in-JS class shapes — strong signals that need no stylesheet walk.
  if (classes.some((c) => SC_CLASS_RE.test(c))) {
    return cssInJsResult("styled-components");
  }
  if (
    classes.some((c) => EMOTION_CLASS_RE.test(c)) &&
    document.querySelector("style[data-emotion]") !== null
  ) {
    return cssInJsResult("Emotion");
  }

  // 4. Walk the CSSOM for rule evidence, bucketed by where the sheet came from.
  let cssInJsMatch: string | null = null;
  let sawCssInJsTagMatch = false;
  let runtimeTagMatch = false;
  let projectMatch = false;
  let externalMatch = false;
  let unreadableExternalSheet = false;

  try {
    for (const sheet of document.styleSheets) {
      const owner = resolveOwner(sheet);
      if (isTunerNode(owner)) continue;

      const flavor = owner ? cssInJsFlavor(owner) : null;

      // Bucket the sheet by origin: linked project CSS, external CDN, or a
      // runtime-injected <style> tag (Next.js dev serves project CSS via
      // href-ed links/chunks, so href-less tags are runtime-generated).
      let origin: "project" | "external" | "runtime-tag";
      if (sheet.href) {
        try {
          origin =
            new URL(sheet.href, location.href).origin === location.origin
              ? "project"
              : "external";
        } catch {
          origin = "project";
        }
      } else {
        origin = "runtime-tag";
      }

      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        // CORS-blocked — unreadable sheets are external by definition.
        if (origin === "external") unreadableExternalSheet = true;
        continue;
      }

      for (const rule of rules) {
        const selector = (rule as CSSStyleRule).selectorText;
        if (typeof selector !== "string") continue;
        // Belt-and-braces for redial-injected rules (mirrors commitUtils).
        if (selector.includes("data-tuner") || selector.includes("__tuner")) continue;

        let matches = false;
        try {
          matches = el.matches(selector);
        } catch {
          // Invalid/unsupported selector for matches()
        }
        if (!matches || !selectorMentionsElement(selector, el)) continue;

        if (flavor) {
          cssInJsMatch ??= flavor;
          sawCssInJsTagMatch = true;
        } else if (origin === "external") {
          externalMatch = true;
        } else if (origin === "project") {
          projectMatch = true;
        } else {
          runtimeTagMatch = true;
        }
      }
    }
  } catch {
    // Stylesheet iteration failed — fall through to weaker signals.
  }

  if (sawCssInJsTagMatch) return cssInJsResult(cssInJsMatch);
  if (runtimeTagMatch) return cssInJsResult(null);
  if (projectMatch) {
    // Same-origin stylesheet — getGlobalCSSSource can resolve the href back
    // to a project .css/.scss file for the server search.
    return {
      system: "unknown",
      saveable: true,
      reason: "Styled by a project stylesheet — edits save to the source CSS file.",
    };
  }
  if (externalMatch || (unreadableExternalSheet && classes.length > 0)) {
    return {
      system: "external-stylesheet",
      saveable: false,
      reason: `Styled by an external stylesheet outside this project — ${CANT_SAVE}.`,
    };
  }

  // 5. Inline-only — no stylesheet rules anywhere, just the style attribute.
  if (el instanceof HTMLElement && el.style.length > 0) {
    return {
      system: "inline",
      saveable: false,
      reason: `Styled with inline styles only — ${CANT_SAVE}.`,
    };
  }

  return {
    system: "unknown",
    saveable: false,
    reason: "Couldn't detect this element's styling source — edits preview live but saving may fail.",
  };
}
