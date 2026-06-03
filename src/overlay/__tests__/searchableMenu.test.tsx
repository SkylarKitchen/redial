// @vitest-environment happy-dom
/**
 * searchableMenu.test.tsx — guards the inline searchable dropdown that replaced
 * cmdk in TextStyleRow + SelectRowCustom (shadcn migration, 2026-06-03).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { fireEvent } from "@testing-library/react";
import { SearchableMenu } from "../controls/SearchableMenu";
import { color } from "../theme";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Opt {
  value: string;
  label: string;
}
const OPTS: Opt[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderMenu(overrides: Partial<Parameters<typeof SearchableMenu<Opt>>[0]> = {}) {
  const props = {
    items: OPTS,
    getKey: (o: Opt) => o.value,
    getSearchText: (o: Opt) => o.label,
    renderItem: (o: Opt) => createElement("span", null, o.label),
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  act(() => {
    root.render(createElement(SearchableMenu<Opt>, props));
  });
  return props;
}

function options(): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="option"]'));
}
function searchInput(): HTMLInputElement {
  return container.querySelector("input") as HTMLInputElement;
}

describe("SearchableMenu", () => {
  it("renders all items initially", () => {
    renderMenu();
    expect(options().map((o) => o.textContent)).toEqual(["Apple", "Banana", "Cherry"]);
  });

  it("filters by substring on getSearchText", () => {
    renderMenu();
    act(() => {
      fireEvent.change(searchInput(), { target: { value: "an" } });
    });
    expect(options().map((o) => o.textContent)).toEqual(["Banana"]);
  });

  it("shows the empty state when nothing matches", () => {
    renderMenu({ emptyText: "Nada" });
    act(() => {
      fireEvent.change(searchInput(), { target: { value: "zzz" } });
    });
    expect(options()).toHaveLength(0);
    expect(container.textContent).toContain("Nada");
  });

  it("calls onSelect when an item is clicked", () => {
    const props = renderMenu();
    act(() => {
      fireEvent.mouseDown(options()[2]);
    });
    expect(props.onSelect).toHaveBeenCalledWith(OPTS[2]);
  });

  it("ArrowDown + Enter selects the highlighted (filtered) item", () => {
    const props = renderMenu();
    act(() => {
      fireEvent.keyDown(searchInput(), { key: "ArrowDown" }); // 0 -> 1
    });
    act(() => {
      fireEvent.keyDown(searchInput(), { key: "Enter" });
    });
    expect(props.onSelect).toHaveBeenCalledWith(OPTS[1]);
  });

  it("Enter selects within the filtered subset, not the full list", () => {
    const props = renderMenu();
    act(() => {
      fireEvent.change(searchInput(), { target: { value: "cher" } }); // only Cherry
    });
    act(() => {
      fireEvent.keyDown(searchInput(), { key: "Enter" }); // highlight auto-reset to 0 = Cherry
    });
    expect(props.onSelect).toHaveBeenCalledWith(OPTS[2]);
  });

  it("Escape calls onClose", () => {
    const props = renderMenu();
    act(() => {
      fireEvent.keyDown(searchInput(), { key: "Escape" });
    });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("marks the highlighted row aria-selected and the active row with primary bg", () => {
    renderMenu({ activeKey: "banana" });
    // active row = Banana has primary background
    const banana = options()[1];
    expect(banana.style.background).toContain(color.primary);
    // first row auto-highlighted
    expect(options()[0].getAttribute("aria-selected")).toBe("true");
  });

  it("does not import shadcn/cmdk", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const src = readFileSync(join(__dirname, "../controls/SearchableMenu.tsx"), "utf-8");
    expect(src).not.toMatch(/from\s+["']@\/components\/ui/);
    expect(src).not.toMatch(/from\s+["']cmdk/);
  });
});
