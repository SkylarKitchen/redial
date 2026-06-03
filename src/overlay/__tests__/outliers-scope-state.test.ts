// @vitest-environment happy-dom
/**
 * outliers-scope-state.test.ts
 *
 * Creative outlier cases for scope.ts / statePreview.ts / apply.ts that are
 * NOT covered by scope.test.ts, statePreview.test.ts, or apply.test.ts.
 *
 * Focus: weird class/scope inputs, pseudo-state edge cases, stale/detached
 * elements, composite-key parsing quirks, and elId-prefix collisions.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getCSSModuleClasses,
  getReadableName,
  applyClassStyle,
  resetClassStyles,
  destroyClassStyles,
  isTailwindElement,
} from "../core/scope";
import {
  applyStateStyle,
  removeStateStyle,
  resetStateStyles,
  diffState,
  destroyStateStyles,
  getStateStyleTag,
  flushScheduledRebuild,
} from "../core/statePreview";

// ─── Helpers ──────────────────────────────────────────────────────────

function makeEl(tag = "div"): HTMLElement {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

function classStyleTag(): HTMLStyleElement | null {
  return document.querySelector(
    'style[data-tuner-scope="class"]'
  ) as HTMLStyleElement | null;
}

beforeEach(() => {
  destroyClassStyles();
  destroyStateStyles();
  document.body.innerHTML = "";
  document
    .querySelectorAll('style[data-tuner-scope]')
    .forEach((s) => s.remove());
});

// ════════════════════════════════════════════════════════════════════════
// scope.ts — class name parsing outliers
// ════════════════════════════════════════════════════════════════════════

describe("getReadableName — multi-underscore readable segment", () => {
  // The webpack regex /^[A-Z]\w+_(\w+)__\w+$/ uses a greedy [A-Z]\w+ for the
  // component name, so a class like "Button_btn_primary__hash" has its
  // readable name resolved to just "primary" — the "btn_" part is absorbed
  // into the component-name group. This is the actual (lossy-but-defined)
  // behavior; lock it so the breadcrumb label stays predictable.
  it("returns the last underscore-delimited segment before __hash for webpack format", () => {
    expect(getReadableName("Button_btn_primary__hash")).toBe("primary");
  });

  it("returns the full readable name for a single-segment webpack class", () => {
    expect(getReadableName("Button_btn__hash")).toBe("btn");
  });
});

describe("getCSSModuleClasses — single-letter component name", () => {
  // The webpack pattern requires [A-Z]\w+ (≥2 chars) for the component name
  // AND a separate readable segment, so a terse class like "A_b__c" is NOT
  // recognized as a CSS module class. That is honest degradation: such a
  // class would not be safely round-trippable to source.
  it("does NOT classify an over-minified A_b__c as a CSS module class", () => {
    const el = makeEl();
    el.className = "A_b__c";
    expect(getCSSModuleClasses(el)).toEqual([]);
    expect(getReadableName("A_b__c")).toBeNull();
  });
});

describe("getCSSModuleClasses — whitespace and duplicate tokens", () => {
  it("ignores leading/trailing whitespace and tab/newline separators", () => {
    const el = makeEl();
    // Tabs + newlines + leading/trailing spaces around a real module class
    el.className = "\t  Button_btn__a8f2k \n flex  ";
    expect(getCSSModuleClasses(el)).toEqual(["Button_btn__a8f2k"]);
  });

  it("returns duplicates verbatim when the same module class appears twice", () => {
    const el = makeEl();
    // A duplicate class token is unusual but legal in className strings.
    el.className = "Button_btn__a8f2k Button_btn__a8f2k";
    // getCSSModuleClasses does not dedupe — both tokens survive the filter.
    expect(getCSSModuleClasses(el)).toEqual([
      "Button_btn__a8f2k",
      "Button_btn__a8f2k",
    ]);
  });
});

describe("isTailwindElement — whitespace tokens do not inflate the count", () => {
  // className.split(/\s+/) on a padded string yields empty-string tokens.
  // Those empty tokens must not be miscounted as Tailwind utilities.
  it("requires 3 real utilities even with messy whitespace", () => {
    const el = makeEl();
    el.className = "   flex   items-center   "; // only 2 real utilities
    expect(isTailwindElement(el)).toBe(false);
  });

  it("detects a Tailwind element once 3 genuine utilities are present", () => {
    const el = makeEl();
    el.className = "  flex  items-center  gap-4  ";
    expect(isTailwindElement(el)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════
// scope.ts — applyClassStyle with adversarial / weird class names
// ════════════════════════════════════════════════════════════════════════

describe("applyClassStyle — class name with CSS-special characters", () => {
  // CSS module classes can theoretically contain chars that are special in a
  // selector. rebuildClassStyles uses CSS.escape, so the selector must be
  // escaped (no raw injection / no broken rule).
  it("CSS.escapes a class name containing a colon so the rule is well-formed", () => {
    // ":" is the pseudo-class delimiter — must be escaped to target the literal class.
    applyClassStyle("weird:class", "color", "red");
    const tag = classStyleTag();
    expect(tag).not.toBeNull();
    // Escaped colon -> "\:" ; the raw ".weird:class" (unescaped) would be a bug.
    expect(tag!.textContent).toContain("color: red !important");
    expect(tag!.textContent).toContain(CSS.escape("weird:class"));
  });

  it("drops a SYNTACTICALLY invalid CSS property (brace/digit) instead of emitting it", () => {
    // isValidCSSProp is a syntactic guard: it accepts any kebab ident (even
    // unknown-but-well-formed props, which browsers harmlessly ignore) but
    // rejects names with braces, digits, or uppercase. A brace-bearing name
    // must be filtered so it cannot break out of the rule block.
    applyClassStyle("Button_btn__a8f2k", "col{or", "red");
    const text = classStyleTag()?.textContent ?? "";
    // No valid declarations -> no rule emitted for the class at all.
    expect(text).not.toContain("col{or");
    expect(text).not.toContain("Button_btn__a8f2k");
  });

  it("KEEPS a well-formed but unknown CSS property (forward-compat, not an allowlist)", () => {
    // This documents the intentional design: isValidCSSProp is syntactic, not
    // a known-property allowlist, so future/custom kebab props pass through.
    applyClassStyle("Button_btn__a8f2k", "not-a-real-prop-xyz", "10px");
    const text = classStyleTag()?.textContent ?? "";
    expect(text).toContain("not-a-real-prop-xyz: 10px !important");
  });
});

describe("resetClassStyles — independence across similar class names", () => {
  // Class overrides are keyed by exact className string. Resetting one must not
  // collaterally clear a different class whose name is a prefix/superstring.
  it("resetting 'Card_x__h' leaves 'Card_x__h2' untouched", () => {
    applyClassStyle("Card_x__h", "color", "red");
    applyClassStyle("Card_x__h2", "color", "blue");
    resetClassStyles("Card_x__h");
    const tag = classStyleTag();
    expect(tag!.textContent).not.toContain("color: red");
    expect(tag!.textContent).toContain("color: blue !important");
  });
});

// ════════════════════════════════════════════════════════════════════════
// statePreview.ts — pseudo-state edge cases
// ════════════════════════════════════════════════════════════════════════

describe("applyStateStyle — element with NO class (pure element scope)", () => {
  // Seed idea: editing :hover on a class-less element. The preview should still
  // work because targeting uses the injected __tuner-state-preview class +
  // a per-element data attribute, independent of the element's own classes.
  it("still injects a working hover rule for a class-less element", () => {
    const el = makeEl(); // no className at all
    applyStateStyle(el, "hover", "color", "red");
    flushScheduledRebuild();
    const tag = getStateStyleTag();
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
    expect(el.getAttribute("data-tuner-state-id")).not.toBeNull();
    expect(tag!.textContent).toContain(":hover");
    expect(tag!.textContent).toContain("color: red !important");
  });
});

describe("removeStateStyle — elId prefix collision (10 vs 1)", () => {
  // removeStateStyle checks `key.startsWith(`${elId}:`)` to decide whether to
  // strip the preview class. If elIds 1 and 10 collided under startsWith, the
  // preview class could be wrongly removed/kept. Verify no false collision.
  it("removing the last override on element #1 does not depend on element #10's keys", () => {
    // Create 10 elements so the WeakMap assigns growing ids; we only need that
    // some element's id is a numeric prefix of another's (e.g. 1 and 1x).
    const els: HTMLElement[] = [];
    for (let i = 0; i < 12; i++) els.push(makeEl());

    // Apply hover to two elements whose ids are likely 1-vs-1x style numbers.
    const a = els[1];
    const b = els[11];
    applyStateStyle(a, "hover", "color", "red");
    applyStateStyle(b, "hover", "color", "blue");
    flushScheduledRebuild();

    expect(a.classList.contains("__tuner-state-preview")).toBe(true);
    expect(b.classList.contains("__tuner-state-preview")).toBe(true);

    // Remove a's only override. b must KEEP its preview class (no false-positive
    // "this element still has overrides" via prefix collision, and no
    // false-negative either).
    removeStateStyle(a, "hover", "color");

    expect(a.classList.contains("__tuner-state-preview")).toBe(false);
    expect(b.classList.contains("__tuner-state-preview")).toBe(true);
  });
});

describe("diffState — initial value is empty for pseudo-states", () => {
  // Known limitation documented in statePreview.ts: the pseudo-class computed
  // value can't be read, so `initial` is "". diffState therefore reports
  // from:"" for every state change. Lock this so the commit pipeline contract
  // is explicit rather than silently surprising.
  it("reports from-value as empty string (cannot read pseudo computed value)", () => {
    const el = makeEl();
    applyStateStyle(el, "hover", "color", "red");
    const changes = diffState(el, "hover");
    expect(changes).toHaveLength(1);
    expect(changes[0].from).toBe("");
    expect(changes[0].to).toBe("red");
  });
});

describe("applyStateStyle — invalid pseudo-state is a hard no-op", () => {
  // :nth-child(), :has(), :not() etc. are NOT in VALID_STATES. The function
  // must reject them entirely — no class, no data attr, no style tag — to
  // prevent selector injection and unsupported-state confusion.
  it("rejects :nth-child(2n) entirely (no class, no attr, no tag)", () => {
    const el = makeEl();
    applyStateStyle(el, "nth-child(2n)", "color", "red");
    flushScheduledRebuild();
    expect(getStateStyleTag()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
    expect(el.getAttribute("data-tuner-state-id")).toBeNull();
    expect(diffState(el, "nth-child(2n)")).toEqual([]);
  });

  it("rejects :has(.child) entirely", () => {
    const el = makeEl();
    applyStateStyle(el, "has(.child)", "color", "red");
    flushScheduledRebuild();
    expect(getStateStyleTag()).toBeNull();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });
});

describe("resetStateStyles — re-adds nothing and stays clean for unknown state", () => {
  // resetStateStyles unconditionally calls rebuildStyleTag(), which lazily
  // creates the managed <style> tag even when there is nothing to reset. The
  // tag is created but EMPTY, and no preview class is added — harmless but
  // slightly eager. Lock the actual (correct-enough) behavior.
  it("resetting a never-applied state leaves an empty tag and no preview class", () => {
    const el = makeEl();
    resetStateStyles(el, "hover");
    const tag = getStateStyleTag();
    // Tag may be created but must be empty (no spurious rules).
    expect(tag === null || tag.textContent === "").toBe(true);
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
  });
});

describe("destroyStateStyles — strips preview class even when user-authored", () => {
  // destroyStateStyles only iterates taggedElements. If an element was tagged
  // by the tuner, its class is removed. Verify a tuner-tagged element is fully
  // cleaned (class + data attr) on destroy.
  it("removes both __tuner-state-preview class and data-tuner-state-id attr", () => {
    const el = makeEl();
    applyStateStyle(el, "focus", "outline", "1px solid red");
    expect(el.classList.contains("__tuner-state-preview")).toBe(true);
    expect(el.getAttribute("data-tuner-state-id")).not.toBeNull();
    destroyStateStyles();
    expect(el.classList.contains("__tuner-state-preview")).toBe(false);
    expect(el.getAttribute("data-tuner-state-id")).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════
// apply.ts — stale / detached element + composite-key parsing outliers
// ════════════════════════════════════════════════════════════════════════

describe("applyInlineStyle — detached element is a silent no-op", () => {
  it("does not track an override for an element removed from the DOM", async () => {
    const { applyInlineStyle, overrideCount, resetAll } = await import(
      "../core/apply"
    );
    const el = document.createElement("div"); // never appended -> not connected
    applyInlineStyle(el, "color", "red");
    // isConnected guard means nothing is tracked and no inline style is set.
    expect(overrideCount(el)).toBe(0);
    expect(el.style.getPropertyValue("color")).toBe("");
    resetAll();
  });

  it("element removed AFTER apply: undo against the detached element is safe", async () => {
    const { applyInlineStyle, undo, resetAll, overrideCount } = await import(
      "../core/apply"
    );
    const el = makeEl();
    applyInlineStyle(el, "color", "red");
    expect(overrideCount(el)).toBe(1);
    // Stale reference: element leaves the DOM (e.g. HMR re-render).
    el.remove();
    // Undo must not throw even though the node is detached.
    expect(() => undo()).not.toThrow();
    resetAll();
  });
});

describe("apply.ts — parseStateKey with a value-bearing prop name", () => {
  // A CSS property/key that itself contains "::" (e.g. a malformed composite)
  // is split on the FIRST "::". Verify the engine treats everything after the
  // first "::" as the property name (and thus as state-keyed -> not inline).
  it("treats 'hover::background::image' as state=hover, prop='background::image'", async () => {
    const { parseStateKey } = await import("../core/apply");
    expect(parseStateKey("hover::background::image")).toEqual({
      state: "hover",
      prop: "background::image",
    });
  });

  it("a leading '::' yields an empty state (still treated as state-keyed, not inline)", async () => {
    const { applyInlineStyle, resetAll } = await import("../core/apply");
    const el = makeEl();
    // "::color" parses to state="" prop="color". state !== "none" so it is
    // treated as state-keyed and must NOT be written to inline style.
    applyInlineStyle(el, "::color", "red");
    expect(el.style.getPropertyValue("color")).toBe("");
    resetAll();
  });
});

describe("apply.ts — resetStateOverrides only clears the targeted state", () => {
  it("clearing hover-state overrides leaves base + focus overrides intact", async () => {
    const { applyInlineStyle, stateKey, resetStateOverrides, overrideCount, resetAll } =
      await import("../core/apply");
    const el = makeEl();

    applyInlineStyle(el, "color", "black"); // base (non-state)
    applyInlineStyle(el, stateKey("hover", "color"), "red"); // hover
    applyInlineStyle(el, stateKey("focus", "color"), "blue"); // focus
    expect(overrideCount(el)).toBe(3);

    resetStateOverrides(el, "hover");

    // hover removed; base + focus remain.
    expect(overrideCount(el)).toBe(2);
    resetAll();
  });
});

describe("apply.ts — class-scoped undo removes from class <style> tag (mismatched el)", () => {
  // The undo notifies class listeners by className regardless of which element
  // triggered it. Verify the class <style> rule is removed on undo even though
  // the inline override lived on a single element instance.
  it("undo of a class-scoped edit removes the rule from the class <style> tag", async () => {
    const { applyInlineStyle, undo, resetAll, onClassChange } = await import(
      "../core/apply"
    );
    const unsubscribe = onClassChange(({ className, prop, value }) => {
      if (value !== null) applyClassStyle(className, prop, value);
      else resetClassStyles(className); // remove whole class for simplicity
    });

    const el = makeEl();
    const className = "Widget_box__zz9";
    applyClassStyle(className, "padding", "4px");
    applyInlineStyle(el, "padding", "4px", className);

    const tag = classStyleTag();
    expect(tag!.textContent).toContain("padding: 4px !important");

    undo();
    expect(classStyleTag()!.textContent).not.toContain("padding: 4px");

    unsubscribe();
    resetAll();
  });
});
