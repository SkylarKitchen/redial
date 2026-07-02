// @vitest-environment happy-dom
/**
 * Header source-file link → open-editor tests (issue #82).
 *
 * The Header shows the selected element's source file (from the React fiber
 * _debugSource) as a clickable link. Before the fix it POSTed to
 * "/__tuner/open-editor" — a URL no route handler serves — without the
 * REDIAL marker header, and the 404 response (which fetch does NOT reject)
 * was silently swallowed. Contract pinned here:
 *
 *  - clicking POSTs { file, line } to the open-editor sibling of the
 *    configured commit endpoint, carrying the marker header
 *  - a non-ok response or network failure surfaces a VISIBLE status message
 *    and copies the file:line path to the clipboard as a fallback
 *  - success shows no failure message
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { createElement } from "react";
import { Header } from "../shell/Header";
import { REDIAL_MARKER_HEADER } from "../../lib/protocol";

const FILE = "/Users/dev/proj/src/App.tsx";
const LINE = 12;

function makeSourceElement(): Element {
  const el = document.createElement("div");
  // SWC/Babel inject _debugSource on the fiber in dev — fabricate the same shape.
  (el as unknown as Record<string, unknown>)["__reactFiber$issue82"] = {
    _debugSource: { fileName: FILE, lineNumber: LINE },
  };
  document.body.appendChild(el);
  return el;
}

function renderHeader(el: Element) {
  return render(
    createElement(Header, {
      element: el,
      onClose: vi.fn(),
      onDragStart: vi.fn(),
    }),
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("Header source link → open-editor (issue #82)", () => {
  it("POSTs file+line to the open-editor sibling of the commit endpoint, with the marker header", () => {
    renderHeader(makeSourceElement());

    fireEvent.click(screen.getByText("src/App.tsx:12"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Derived from the configured commit endpoint ("/api/tuner/commit"),
    // NOT the dead "/__tuner/open-editor" URL.
    expect(url).toBe("/api/tuner/open-editor");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)[REDIAL_MARKER_HEADER]).toBe("1");
    expect(JSON.parse(init.body as string)).toEqual({ file: FILE, line: LINE });
  });

  it("surfaces a visible failure message when the server responds non-ok (fetch does not reject on 404)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), { status: 404 }),
    );
    renderHeader(makeSourceElement());

    fireEvent.click(screen.getByText("src/App.tsx:12"));

    expect(await screen.findByText(/couldn't open editor/i)).toBeTruthy();
  });

  it("surfaces the failure message AND copies file:line to the clipboard on network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    renderHeader(makeSourceElement());

    fireEvent.click(screen.getByText("src/App.tsx:12"));

    expect(await screen.findByText(/couldn't open editor/i)).toBeTruthy();
    expect(writeText).toHaveBeenCalledWith(`${FILE}:${LINE}`);
  });

  it("shows no failure message when the server responds ok", async () => {
    renderHeader(makeSourceElement());

    fireEvent.click(screen.getByText("src/App.tsx:12"));

    // Let the resolved fetch promise chain flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByText(/couldn't open editor/i)).toBeNull();
  });
});
