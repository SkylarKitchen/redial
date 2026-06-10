// @vitest-environment happy-dom
/**
 * shadowDomBoundary.test.tsx — runtime locks for ADR-0008.
 *
 * Verifies the contract that production wiring depends on:
 *  - ensureTunerHost() mounts a single `<div data-tuner-host>` with an open
 *    shadow root and a portal container inside it
 *  - the host element does NOT create a containing block (no transform,
 *    filter, or perspective) — required for `position: fixed` to resolve
 *    against the viewport
 *  - `pointer-events: none` is NOT applied to the host (it inherits and
 *    would disable interactivity inside the panel)
 *  - `composedTarget(event)` unwraps retargeted shadow events
 *  - `shadowAwareActiveElement()` returns the focused descendant when
 *    `document.activeElement` resolves to the shadow host
 *  - `isInsideTunerUI` recognizes the shadow host
 *  - `isNavigableElement` excludes the shadow host (Tab cycle in selection
 *    mode must not include it)
 *  - `navigatorFilter.shouldSkipEntirely` excludes the shadow host
 *  - `usePortalTarget()` falls back to `document.body` when no provider
 *    is mounted (so isolated component tests keep working)
 */
import React from "react";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { createPortal } from "react-dom";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
import {
  ensureTunerHost,
  getTunerHost,
  getTunerShadowRoot,
  composedTarget,
  shadowAwareActiveElement,
  _resetTunerHostForTests,
} from "../core/shadowRoot";
import { isInsideTunerUI, isNavigableElement } from "../util";
import { shouldSkipEntirely } from "../navigator/navigatorFilter";
import { PortalTargetContext, usePortalTarget } from "../hooks/usePortalTarget";

afterEach(() => {
  _resetTunerHostForTests();
  document.body.innerHTML = "";
});

describe("ensureTunerHost — mount + shadow root", () => {
  it("creates a single <div data-tuner-host> on document.body", () => {
    ensureTunerHost();
    const hosts = document.body.querySelectorAll("[data-tuner-host]");
    expect(hosts.length).toBe(1);
    expect(hosts[0]).toBe(getTunerHost());
  });

  it("attaches an open shadow root", () => {
    ensureTunerHost();
    const host = getTunerHost()!;
    expect(host.shadowRoot).not.toBeNull();
    expect(host.shadowRoot!.mode).toBe("open");
    expect(getTunerShadowRoot()).toBe(host.shadowRoot);
  });

  it("creates the portal container inside the shadow root", () => {
    const container = ensureTunerHost();
    const shadowRoot = getTunerShadowRoot()!;
    expect(container.getRootNode()).toBe(shadowRoot);
    expect(container.getAttribute("data-tuner-portal-container")).toBe("");
  });

  it("re-entrant calls reuse the same host + container", () => {
    const a = ensureTunerHost();
    const b = ensureTunerHost();
    expect(a).toBe(b);
    expect(document.body.querySelectorAll("[data-tuner-host]").length).toBe(1);
  });

  it("host computed styles never create a containing block", () => {
    ensureTunerHost();
    const host = getTunerHost()!;
    const cs = getComputedStyle(host);
    // Inline-set in ensureTunerHost so happy-dom returns 'none' literally.
    expect(cs.transform).toBe("none");
    expect(cs.filter).toBe("none");
    expect(cs.perspective).toBe("none");
  });

  it("host does NOT set pointer-events: none (would inherit into the panel)", () => {
    ensureTunerHost();
    const host = getTunerHost()!;
    const cs = getComputedStyle(host);
    expect(cs.pointerEvents).not.toBe("none");
  });

  it("adopts the panel chrome + Tailwind sheets into the shadow root", () => {
    ensureTunerHost();
    const sheets = getTunerShadowRoot()!.adoptedStyleSheets;
    expect(sheets.length).toBeGreaterThanOrEqual(2);
  });
});

describe("composedTarget — retargeted events", () => {
  it("returns composedPath()[0] when the path crosses the shadow boundary", () => {
    ensureTunerHost();
    const shadow = getTunerShadowRoot()!;
    const inner = document.createElement("button");
    shadow.appendChild(inner);
    let observed: Element | null = null;
    inner.addEventListener("click", (e) => {
      observed = composedTarget(e);
    });
    inner.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    expect(observed).toBe(inner);
  });

  it("falls back to event.target when composedPath is empty", () => {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const synthetic = new Event("test", { bubbles: false });
    Object.defineProperty(synthetic, "target", { value: target });
    expect(composedTarget(synthetic)).toBe(target);
  });
});

describe("shadowAwareActiveElement — focus inside the shadow root", () => {
  it("unwraps the host to the actual focused descendant", () => {
    ensureTunerHost();
    const shadow = getTunerShadowRoot()!;
    const input = document.createElement("input");
    shadow.appendChild(input);
    input.focus();
    // In production document.activeElement === host whenever focus is inside
    // the shadow tree. happy-dom mirrors this behavior; the helper unwraps.
    const active = shadowAwareActiveElement();
    expect(active).toBe(input);
  });

  it("returns null when no element is focused", () => {
    ensureTunerHost();
    const active = shadowAwareActiveElement();
    // Either null or <body> depending on the environment; never the host.
    expect(active).not.toBe(getTunerHost());
  });
});

describe("ownership helpers recognize the shadow host", () => {
  it("isInsideTunerUI returns true for [data-tuner-host]", () => {
    ensureTunerHost();
    expect(isInsideTunerUI(getTunerHost())).toBe(true);
  });

  it("isNavigableElement returns false for the shadow host", () => {
    ensureTunerHost();
    expect(isNavigableElement(getTunerHost()!)).toBe(false);
  });

  it("navigatorFilter.shouldSkipEntirely excludes the shadow host", () => {
    ensureTunerHost();
    expect(shouldSkipEntirely(getTunerHost()!)).toBe(true);
  });
});

describe("usePortalTarget — fallback semantics", () => {
  it("falls back to document.body when no provider is mounted", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);
    let observed: Element | null = null;
    function Probe() {
      observed = usePortalTarget();
      return null;
    }
    act(() => {
      root.render(<Probe />);
    });
    expect(observed).toBe(document.body);
    act(() => {
      root.unmount();
    });
  });

  it("returns the provider value when wrapped", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);
    let observed: Element | null = null;
    function Probe() {
      observed = usePortalTarget();
      return null;
    }
    act(() => {
      root.render(
        <PortalTargetContext.Provider value={container}>
          <Probe />
        </PortalTargetContext.Provider>,
      );
    });
    expect(observed).toBe(container);
    act(() => {
      root.unmount();
    });
  });

  it("createPortal lands inside the shadow root when the provider is present", () => {
    const portalContainer = ensureTunerHost();
    const mount = document.createElement("div");
    document.body.appendChild(mount);
    const root: Root = createRoot(mount);
    function Inner() {
      const target = usePortalTarget();
      return createPortal(<span data-test="probe">x</span>, target);
    }
    act(() => {
      root.render(
        <PortalTargetContext.Provider value={portalContainer}>
          <Inner />
        </PortalTargetContext.Provider>,
      );
    });
    const probe = getTunerShadowRoot()!.querySelector('[data-test="probe"]');
    expect(probe).not.toBeNull();
    expect(probe!.getRootNode()).toBe(getTunerShadowRoot());
    act(() => {
      root.unmount();
    });
  });
});

describe(":host inherited-property reset", () => {
  it("the panel chrome sheet contains the :host reset", () => {
    ensureTunerHost();
    const shadow = getTunerShadowRoot()!;
    // The chrome sheet is one of the adopted sheets; assert at least one
    // sheet declares `:host { ... font-family ... }`.
    const sheets = Array.from(shadow.adoptedStyleSheets);
    const hostRule = sheets.some((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules);
        return rules.some((r) => {
          if (!(r instanceof CSSStyleRule)) return false;
          return r.selectorText === ":host" && /font-family/i.test(r.cssText);
        });
      } catch {
        return false;
      }
    });
    expect(hostRule, "expected a :host rule resetting font-family in the shadow root").toBe(true);
  });
});
