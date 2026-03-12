/**
 * CommandPalette.tsx — Universal Cmd+K search overlay
 *
 * Searches across CSS properties/sections, actions, and DOM elements.
 * Fuzzy substring matching with keyboard navigation and debounced element search.
 * Built on Shadcn Command (cmdk) + Tailwind CSS.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { isNavigableElement, buildBreadcrumb, getDisplayClass } from "./util";
import { SECTION_PROPERTIES } from "./PropertySearch";

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

const CATEGORY_BADGE_CLASSES: Record<SearchResult["category"], string> = {
  Property: "text-orange-700 bg-orange-500/15",
  Action: "text-emerald-700 bg-emerald-500/15",
  Element: "text-amber-700 bg-amber-500/15",
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
        <DialogContent className="overflow-hidden p-0 max-w-[500px] bg-[var(--background)] border-[var(--border)]">
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-1.5 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
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
                <div className="py-6 text-center text-sm text-muted-foreground">
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
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        {/* Category badge */}
                        <span
                          className={cn(
                            "text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm shrink-0 leading-tight",
                            CATEGORY_BADGE_CLASSES[r.category],
                          )}
                        >
                          {r.category}
                        </span>

                        {/* Label */}
                        <span
                          className={cn(
                            "text-[13px] text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis shrink-0",
                            r.category === "Property" && "font-mono",
                          )}
                        >
                          {r.label}
                        </span>

                        {/* Detail */}
                        {r.detail && (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis ml-auto shrink min-w-0">
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
