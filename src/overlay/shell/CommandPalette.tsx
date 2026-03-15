/**
 * CommandPalette.tsx — Universal Cmd+K search overlay
 *
 * Searches across CSS properties/sections, actions, and DOM elements.
 * Fuzzy substring matching with keyboard navigation and debounced element search.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isNavigableElement, buildBreadcrumb, getDisplayClass } from "../util";
import { SECTION_PROPERTIES } from "./PropertySearch";
import { color, text, border, surface, font, primaryAlpha, shadow, badge } from "../theme";

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

  return (
    <div className="__tuner-root">
      <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          style={{
            overflow: "hidden",
            padding: 0,
            maxWidth: 500,
            background: color.background,
            border: `1px solid ${border.default}`,
          }}
        >
          <style>{`
            .tuner-cmd [cmdk-group-heading] { padding: 0 8px; font-weight: 500; color: ${text.label}; }
            .tuner-cmd [cmdk-group]:not([hidden]) ~ [cmdk-group] { padding-top: 0; }
            .tuner-cmd [cmdk-group] { padding: 0 8px; }
            .tuner-cmd [cmdk-input-wrapper] svg { height: 20px; width: 20px; }
            .tuner-cmd [cmdk-input] { height: 48px; }
            .tuner-cmd [cmdk-item] { padding: 6px 8px; }
            .tuner-cmd [cmdk-item] svg { height: 20px; width: 20px; }
          `}</style>
          <Command
            shouldFilter={false}
            className="tuner-cmd"
          >
            <CommandInput
              placeholder="Search properties, actions, or elements..."
              value={query}
              onValueChange={(value) => setQuery(value)}
            />
            <CommandList className="max-h-[360px]">
              {query && results.length === 0 && (
                <CommandEmpty>
                  No results for &ldquo;{query}&rdquo;
                </CommandEmpty>
              )}

              {!query && (
                <div style={{
                  padding: "24px 0",
                  textAlign: "center",
                  fontSize: 13,
                  color: text.label,
                }}>
                  Type to search properties, actions, or elements
                </div>
              )}

              {(["Property", "Action", "Element"] as const).map((category) => {
                const items = grouped[category];
                if (!items || items.length === 0) return null;
                return (
                  <CommandGroup key={category} heading={category}>
                    {items.map((r, i) => (
                      <CommandItem
                        key={`${r.category}-${r.label}-${i}`}
                        value={`${r.category}-${r.label}-${i}`}
                        onSelect={() => executeResult(r)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
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
                            color: "rgba(0,0,0,0.9)",
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
                          <span style={{
                            fontSize: 11,
                            color: text.label,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            marginLeft: "auto",
                            flexShrink: 1,
                            minWidth: 0,
                          }}>
                            {r.detail}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              })}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
