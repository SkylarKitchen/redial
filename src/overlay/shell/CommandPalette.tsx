/**
 * CommandPalette.tsx — Universal Cmd+K search overlay
 *
 * Searches across CSS properties/sections, actions, and DOM elements.
 * Fuzzy substring matching with keyboard navigation and debounced element search.
 *
 * Rendered inside the inline `Modal` (portal + focus-trap + Esc/backdrop close);
 * the grouped, keyboard-navigable result list is plain inline-styled markup driven
 * by `useListKeyboardNav` (no shadcn/Radix Dialog, no cmdk).
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Modal } from "./Modal";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";
import { isNavigableElement, buildBreadcrumb, getDisplayClass } from "../util";
import { SECTION_PROPERTIES } from "./PropertySearch";
import { color, text, border, surface, font, primaryAlpha, badge } from "../theme";

// ─── Types ───────────────────────────────────────────────────────────

interface SearchResult {
  category: "Property" | "Action" | "Element";
  label: string;
  detail?: string;
  action: () => void;
}

export interface CommandPaletteProps {
  onSelectElement: (el: Element) => void;
  onScrollToSection: (sectionName: string) => void;
  onAction: (action: string) => void;
  onClose: () => void;
}

// ─── Constants ───────────────────────────────────────────────────────

const ACTIONS = [
  "Save",
  "Reset",
  "Copy CSS",
  "Copy Tailwind",
  "Paste Styles",
  "Toggle Diff",
  "Toggle Changes Drawer",
  "Toggle Navigator",
] as const;

const CATEGORY_BADGE_STYLES: Record<SearchResult["category"], React.CSSProperties> = {
  Property: { color: color.primary, background: primaryAlpha(0.15) },
  Action: { color: badge.action, background: badge.actionBg },
  Element: { color: badge.element, background: badge.elementBg },
};

const MAX_RESULTS = 30;
const MAX_ELEMENT_RESULTS = 10;
const ELEMENT_DEBOUNCE_MS = 300;

// ─── Helpers ─────────────────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): boolean {
  return target.toLowerCase().includes(query.toLowerCase());
}

function getElementLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls = getDisplayClass(el);
  const clsStr = cls ? `.${cls}` : "";
  return `${tag}${id}${clsStr}`;
}

function getElementDetail(el: Element): string {
  const text = el.textContent?.trim() ?? "";
  if (text.length > 0) {
    return text.length > 60 ? text.slice(0, 60) + "…" : text;
  }
  // Fall back to breadcrumb
  const crumbs = buildBreadcrumb(el, 3);
  return crumbs.map((s) => s.className ? `${s.tag}.${s.className}` : s.tag).join(" > ");
}

function searchProperties(query: string): Array<{ section: string; props: string[] }> {
  const results: Array<{ section: string; props: string[] }> = [];
  for (const [section, props] of Object.entries(SECTION_PROPERTIES)) {
    // Match section name
    if (fuzzyMatch(query, section)) {
      results.push({ section, props: [] });
      continue;
    }
    // Match individual property names
    const matched = props.filter((p) => fuzzyMatch(query, p));
    if (matched.length > 0) {
      results.push({ section, props: matched });
    }
  }
  return results;
}

function searchActions(query: string): string[] {
  return ACTIONS.filter((a) => fuzzyMatch(query, a));
}

let _cachedAllElements: NodeListOf<Element> | null = null;

function searchElements(query: string): Element[] {
  if (!query) return [];
  // Cache the querySelectorAll snapshot for the lifetime of the palette.
  // Cleared when the component unmounts (see clearElementCache).
  if (!_cachedAllElements) {
    _cachedAllElements = document.querySelectorAll("*");
  }
  const all = _cachedAllElements;
  const results: Element[] = [];
  for (let i = 0; i < all.length && results.length < MAX_ELEMENT_RESULTS; i++) {
    const el = all[i];
    if (!isNavigableElement(el)) continue;

    const tag = el.tagName.toLowerCase();
    const id = el.id || "";
    const cls = typeof el.className === "string" ? el.className : "";
    const text = (el.textContent ?? "").slice(0, 60);
    const haystack = `${tag} ${id} ${cls} ${text}`;

    if (fuzzyMatch(query, haystack)) {
      results.push(el);
    }
  }
  return results;
}

function clearElementCache() {
  _cachedAllElements = null;
}

// ─── Component ───────────────────────────────────────────────────────

export function CommandPalette({
  onSelectElement,
  onScrollToSection,
  onAction,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [elementResults, setElementResults] = useState<Element[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear element cache on unmount
  useEffect(() => {
    return () => clearElementCache();
  }, []);

  // Debounced element search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query) {
      setElementResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      setElementResults(searchElements(query));
    }, ELEMENT_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Build merged result list
  const results: SearchResult[] = useMemo(() => {
    if (!query) return [];
    const all: SearchResult[] = [];

    // Properties
    const propMatches = searchProperties(query);
    for (const { section, props } of propMatches) {
      if (props.length === 0) {
        // Section name matched
        all.push({
          category: "Property",
          label: section,
          detail: SECTION_PROPERTIES[section]?.slice(0, 5).join(", ") + "…",
          action: () => onScrollToSection(section),
        });
      } else {
        // Individual properties matched
        for (const prop of props) {
          all.push({
            category: "Property",
            label: prop,
            detail: section,
            action: () => onScrollToSection(section),
          });
        }
      }
    }

    // Actions
    const actionMatches = searchActions(query);
    for (const act of actionMatches) {
      all.push({
        category: "Action",
        label: act,
        action: () => onAction(act),
      });
    }

    // Elements
    for (const el of elementResults) {
      all.push({
        category: "Element",
        label: getElementLabel(el),
        detail: getElementDetail(el),
        action: () => onSelectElement(el),
      });
    }

    return all.slice(0, MAX_RESULTS);
  }, [query, elementResults, onScrollToSection, onAction, onSelectElement]);

  // Group results by category
  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    for (const r of results) {
      if (!map[r.category]) map[r.category] = [];
      map[r.category].push(r);
    }
    return map;
  }, [results]);

  const executeResult = useCallback(
    (result: SearchResult) => {
      result.action();
      onClose();
    },
    [onClose],
  );

  // Keyboard navigation over the flat `results` array (cmdk replacement).
  const nav = useListKeyboardNav({
    itemCount: results.length,
    onSelect: (i) => {
      const r = results[i];
      if (r) executeResult(r);
    },
  });

  return (
    <Modal
      onClose={onClose}
      maxWidth={500}
      ariaLabel="Command palette"
      contentStyle={{ padding: 0, overflow: "hidden", background: color.background }}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={nav.handleKeyDown}
        autoFocus
        placeholder="Search properties, actions, or elements..."
        aria-label="Search properties, actions, or elements"
        style={{
          width: "100%",
          boxSizing: "border-box",
          height: 48,
          padding: "0 12px",
          fontSize: 14,
          border: "none",
          borderBottom: `1px solid ${border.default}`,
          background: "transparent",
          color: text.primary,
          outline: "none",
        }}
      />

      <div role="listbox" style={{ maxHeight: 360, overflowY: "auto" }}>
        {query && results.length === 0 && (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontSize: 13,
              color: text.label,
            }}
          >
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {!query && (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontSize: 13,
              color: text.label,
            }}
          >
            Type to search properties, actions, or elements
          </div>
        )}

        {(["Property", "Action", "Element"] as const).map((category) => {
          const items = grouped[category];
          if (!items || items.length === 0) return null;
          return (
            <div key={category} style={{ padding: "0 8px" }}>
              <span
                style={{
                  display: "block",
                  padding: "4px 8px",
                  fontWeight: 500,
                  fontSize: 11,
                  color: text.label,
                }}
              >
                {category}
              </span>
              {items.map((r, i) => {
                const flatIndex = results.indexOf(r);
                const highlighted = flatIndex === nav.activeIndex;
                return (
                  <div
                    key={`${r.category}-${r.label}-${i}`}
                    role="option"
                    aria-selected={highlighted}
                    onMouseEnter={() => nav.setActiveIndex(flatIndex)}
                    onClick={() => executeResult(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      background: highlighted ? surface.hover : "transparent",
                    }}
                  >
                    {/* Category badge */}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        padding: "2px 6px",
                        borderRadius: 2,
                        flexShrink: 0,
                        lineHeight: 1.2,
                        ...CATEGORY_BADGE_STYLES[r.category],
                      }}
                    >
                      {r.category}
                    </span>

                    {/* Label */}
                    <span
                      style={{
                        fontSize: 13,
                        color: text.primary,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        flexShrink: 0,
                        fontFamily: r.category === "Property" ? font.mono : undefined,
                      }}
                    >
                      {r.label}
                    </span>

                    {/* Detail */}
                    {r.detail && (
                      <span
                        style={{
                          fontSize: 11,
                          color: text.label,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          marginLeft: "auto",
                          flexShrink: 1,
                          minWidth: 0,
                        }}
                      >
                        {r.detail}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
