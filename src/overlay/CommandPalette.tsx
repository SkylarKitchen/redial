/**
 * CommandPalette.tsx — Universal Cmd+K search overlay
 *
 * Searches across CSS properties/sections, actions, and DOM elements.
 * Fuzzy substring matching with keyboard navigation and debounced element search.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { isNavigableElement, buildBreadcrumb, getDisplayClass } from "./util";
import { SECTION_PROPERTIES } from "./PropertySearch";
import { timing } from "./timing";
import { useFocusTrap } from "./useFocusTrap";

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
] as const;

const CATEGORY_COLORS: Record<SearchResult["category"], string> = {
  Property: "rgba(99,102,241,0.85)",   // indigo
  Action: "rgba(52,211,153,0.85)",     // emerald
  Element: "rgba(251,191,36,0.85)",    // amber
};

const CATEGORY_BG: Record<SearchResult["category"], string> = {
  Property: "rgba(99,102,241,0.15)",
  Action: "rgba(52,211,153,0.15)",
  Element: "rgba(251,191,36,0.15)",
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
    return text.length > 60 ? text.slice(0, 60) + "\u2026" : text;
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [elementResults, setElementResults] = useState<Element[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusTrap(cardRef, true);

  // Auto-focus + clear element cache on unmount
  useEffect(() => {
    inputRef.current?.focus();
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
          detail: SECTION_PROPERTIES[section]?.slice(0, 5).join(", ") + "\u2026",
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

  // Clamp selected index when results change
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Scroll selected row into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const row = list.children[selectedIndex] as HTMLElement | undefined;
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const executeResult = useCallback(
    (index: number) => {
      const r = results[index];
      if (r) {
        r.action();
        onClose();
      }
    },
    [results, onClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
          break;
        case "Enter":
          e.preventDefault();
          executeResult(selectedIndex);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results.length, selectedIndex, executeResult, onClose],
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "20vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        style={{
          width: "100%",
          minWidth: 400,
          maxWidth: 500,
          background: "#1e1e1e",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: results.length > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search..."
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "rgba(255,255,255,0.95)",
              fontSize: 16,
              fontFamily: "system-ui, -apple-system, sans-serif",
              padding: 0,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Results list */}
        {results.length > 0 && (
          <div
            ref={listRef}
            style={{
              maxHeight: 360,
              overflowY: "auto",
              padding: "4px 0",
            }}
          >
            {results.map((r, i) => (
              <div
                key={`${r.category}-${r.label}-${i}`}
                onClick={() => executeResult(i)}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  cursor: "pointer",
                  background: i === selectedIndex ? "rgba(255,255,255,0.08)" : "transparent",
                  transition: `background ${timing.fast}ms ease`,
                }}
              >
                {/* Category badge */}
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "2px 5px",
                    borderRadius: 3,
                    color: CATEGORY_COLORS[r.category],
                    background: CATEGORY_BG[r.category],
                    flexShrink: 0,
                    lineHeight: 1.3,
                  }}
                >
                  {r.category}
                </span>

                {/* Label */}
                <span
                  style={{
                    fontSize: 13,
                    color: "rgba(255,255,255,0.9)",
                    fontFamily:
                      r.category === "Property"
                        ? "ui-monospace, 'SF Mono', monospace"
                        : "system-ui, -apple-system, sans-serif",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flexShrink: 0,
                  }}
                >
                  {r.label}
                </span>

                {/* Detail */}
                {r.detail && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.35)",
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
            ))}
          </div>
        )}

        {/* Empty state */}
        {query && results.length === 0 && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: 13,
            }}
          >
            No results for &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Hint footer */}
        {!query && (
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "rgba(255,255,255,0.25)",
              fontSize: 11,
            }}
          >
            Type to search properties, actions, or elements
          </div>
        )}
      </div>
    </div>
  );
}
