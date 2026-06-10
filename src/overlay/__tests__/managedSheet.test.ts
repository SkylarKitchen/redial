// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import { managedSheet, _readManagedSheetCss } from "../core/managedSheet";

beforeEach(() => {
  document.adoptedStyleSheets = [];
});

describe("managedSheet — idempotency by key", () => {
  it("returns a handle whose replace operates on the same underlying sheet across calls", () => {
    const k = "idempo-1";
    managedSheet(k).replace(".a { color: red; }");
    expect(_readManagedSheetCss(k)).toContain(".a");
    expect(_readManagedSheetCss(k)).toContain("red");

    managedSheet(k).replace(".b { color: blue; }");
    const after = _readManagedSheetCss(k);
    expect(after).toContain(".b");
    expect(after).toContain("blue");
    expect(after).not.toContain(".a");
    expect(after).not.toContain("red");
  });

  it("a second managedSheet(key) call returns a handle for the same sheet", () => {
    const k = "idempo-2";
    const lengthBefore = document.adoptedStyleSheets.length;
    managedSheet(k).replace(".x {}");
    managedSheet(k).replace(".y {}");
    managedSheet(k).replace(".z {}");
    // Only one sheet should have been appended despite three replace calls.
    expect(document.adoptedStyleSheets.length).toBe(lengthBefore + 1);
  });
});

describe("managedSheet — append, don't assign", () => {
  it("preserves host-app pre-registered adopted sheets", () => {
    const hostSheet = new CSSStyleSheet();
    hostSheet.replaceSync(".host { color: pink; }");
    document.adoptedStyleSheets = [hostSheet];

    managedSheet("append-1").replace(".helper { color: gold; }");

    expect(document.adoptedStyleSheets).toContain(hostSheet);
    expect(document.adoptedStyleSheets.length).toBe(2);
  });
});

describe("managedSheet — dispose isolation", () => {
  it("disposing one helper-managed sheet leaves siblings adopted", () => {
    const a = "iso-a";
    const b = "iso-b";
    managedSheet(a).replace(".a {}");
    managedSheet(b).replace(".b {}");
    expect(_readManagedSheetCss(a)).not.toBeNull();
    expect(_readManagedSheetCss(b)).not.toBeNull();

    managedSheet(a).dispose();

    expect(_readManagedSheetCss(a)).toBeNull();
    expect(_readManagedSheetCss(b)).not.toBeNull();
    expect(_readManagedSheetCss(b)).toContain(".b");
  });

  it("dispose is a no-op when nothing was registered for the key", () => {
    expect(() => managedSheet("never-registered").dispose()).not.toThrow();
  });

  it("after dispose, the next replace creates a fresh sheet", () => {
    const k = "iso-recreate";
    managedSheet(k).replace(".first {}");
    managedSheet(k).dispose();
    managedSheet(k).replace(".second {}");
    const css = _readManagedSheetCss(k);
    expect(css).toContain(".second");
    expect(css).not.toContain(".first");
  });
});

describe("managedSheet — @import rejection", () => {
  it("throws for a leading @import url(...)", () => {
    expect(() =>
      managedSheet("imp-1").replace("@import url('x.css'); .a {}"),
    ).toThrow(/managedSheet: @import/);
  });

  it("throws for @import with leading whitespace", () => {
    expect(() =>
      managedSheet("imp-2").replace("  @import url('x.css');"),
    ).toThrow(/managedSheet: @import/);
  });

  it("throws for @import on a non-first line", () => {
    expect(() =>
      managedSheet("imp-3").replace(".a {}\n@import url('x.css');"),
    ).toThrow(/managedSheet: @import/);
  });

  it("does not register a sheet when @import rejection fires", () => {
    const k = "imp-no-register";
    expect(() => managedSheet(k).replace("@import url('x.css');")).toThrow();
    expect(_readManagedSheetCss(k)).toBeNull();
  });
});

describe("managedSheet — shadow-root targets (ADR-0008)", () => {
  function makeShadow(): ShadowRoot {
    const host = document.createElement("div");
    document.body.appendChild(host);
    return host.attachShadow({ mode: "open" });
  }

  it("same key on document and a ShadowRoot are independent entries", () => {
    const shadow = makeShadow();
    managedSheet("split").replace(".doc {}");
    managedSheet("split", shadow).replace(".shadow {}");

    expect(_readManagedSheetCss("split")).toContain(".doc");
    expect(_readManagedSheetCss("split", shadow)).toContain(".shadow");
    expect(_readManagedSheetCss("split")).not.toContain(".shadow");
  });

  it("appends to shadowRoot.adoptedStyleSheets without clobbering document", () => {
    const shadow = makeShadow();
    const docBefore = document.adoptedStyleSheets.length;
    managedSheet("shadow-only", shadow).replace(".x {}");
    expect(shadow.adoptedStyleSheets.length).toBe(1);
    expect(document.adoptedStyleSheets.length).toBe(docBefore);
  });

  it("dispose on a shadow target leaves document sheets untouched", () => {
    const shadow = makeShadow();
    managedSheet("doc-side").replace(".a {}");
    managedSheet("shadow-side", shadow).replace(".b {}");
    const docCountBefore = document.adoptedStyleSheets.length;
    managedSheet("shadow-side", shadow).dispose();
    expect(_readManagedSheetCss("shadow-side", shadow)).toBeNull();
    expect(_readManagedSheetCss("doc-side")).toContain(".a");
    expect(document.adoptedStyleSheets.length).toBe(docCountBefore);
  });
});

describe("managedSheet — fallback path (no adoptedStyleSheets)", () => {
  it("falls back to <style> element injection and supports replace + dispose", () => {
    // Walk the prototype chain to find where the descriptor actually lives,
    // since environments may place it on a Document subclass or a parent.
    let owner: object | null = Document.prototype;
    let desc: PropertyDescriptor | undefined;
    while (owner && !desc) {
      desc = Object.getOwnPropertyDescriptor(owner, "adoptedStyleSheets");
      if (!desc) owner = Object.getPrototypeOf(owner);
    }
    expect(desc).toBeTruthy();
    expect(owner).toBeTruthy();

    const k = "fallback-1";
    try {
      // @ts-expect-error — purposely deleting for the test
      delete (owner as { adoptedStyleSheets?: unknown }).adoptedStyleSheets;
      expect("adoptedStyleSheets" in Document.prototype).toBe(false);

      const headBefore = document.head.querySelectorAll("style").length;
      managedSheet(k).replace(".fb { color: green; }");
      const headAfter = document.head.querySelectorAll("style").length;
      expect(headAfter).toBe(headBefore + 1);

      const css = _readManagedSheetCss(k);
      expect(css).toContain(".fb");
      expect(css).toContain("green");

      managedSheet(k).replace(".fb2 { color: yellow; }");
      expect(_readManagedSheetCss(k)).toContain(".fb2");
      expect(_readManagedSheetCss(k)).not.toContain(".fb {");

      managedSheet(k).dispose();
      expect(_readManagedSheetCss(k)).toBeNull();
      expect(document.head.querySelectorAll("style").length).toBe(headBefore);
    } finally {
      if (desc && owner) {
        Object.defineProperty(owner, "adoptedStyleSheets", desc);
      }
    }
  });
});
