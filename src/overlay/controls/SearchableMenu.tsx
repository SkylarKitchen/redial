/**
 * controls/SearchableMenu.tsx — Inline searchable dropdown box (no shadcn/cmdk).
 *
 * Replaces the `@/components/ui/command` (cmdk) box that TextStyleRow and
 * SelectRowCustom rendered inside their portals. It is *just the content box*
 * (search input + filtered, keyboard-navigable list) — the trigger button and
 * the portal positioning stay with each caller (they already use
 * usePortalDropdown + createPortal and style their triggers differently).
 *
 * cmdk gave us three things; this reproduces them with plain code:
 *   - substring filtering (the callers' old `filter` prop did `.includes()`)
 *   - keyboard nav (Arrow/Enter/Home/End) via useListKeyboardNav
 *   - an accessible listbox (role=listbox/option, aria-selected)
 *
 * Styling contract: the WRAPPER owns the row background (active = primary,
 * keyboard-highlighted = surface.hover, else transparent). `renderItem` owns the
 * row's padding/font/text and uses the `active` flag to pick text colors
 * (e.g. primaryForeground on the applied row). This keeps full per-item styling
 * (font-preview, weight rows, size badges) with the caller while the keyboard
 * highlight stays consistent.
 */

import React, { useMemo, useRef, useState, useEffect } from "react";
import { color, border, shadow, surface, text, font } from "../theme";
import { useListKeyboardNav } from "../hooks/useListKeyboardNav";

export interface SearchableMenuProps<T> {
  items: T[];
  /** Stable identity for an item (also compared against activeKey). */
  getKey: (item: T) => string;
  /** Text the substring filter matches against. */
  getSearchText: (item: T) => string;
  /** Render a row's inner content. `active` = the currently-applied item. */
  renderItem: (item: T, state: { active: boolean; highlighted: boolean }) => React.ReactNode;
  /** Fired on click or Enter. The caller is responsible for closing the dropdown. */
  onSelect: (item: T) => void;
  /** Fired on Escape in the search box. */
  onClose: () => void;
  /** Key of the applied item, for active-row styling. */
  activeKey?: string;
  placeholder?: string;
  emptyText?: string;
  /** Outer box style overrides (minWidth, etc.). */
  style?: React.CSSProperties;
  /** Search input font-family (default font.sans). */
  searchFontFamily?: string;
  listMaxHeight?: number;
}

export function SearchableMenu<T>({
  items,
  getKey,
  getSearchText,
  renderItem,
  onSelect,
  onClose,
  activeKey,
  placeholder = "Search...",
  emptyText = "No matches",
  style,
  searchFontFamily,
  listMaxHeight = 180,
}: SearchableMenuProps<T>) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => getSearchText(it).toLowerCase().includes(q));
  }, [items, search, getSearchText]);

  const { activeIndex, setActiveIndex, handleKeyDown } = useListKeyboardNav({
    itemCount: filtered.length,
    onSelect: (i) => {
      const it = filtered[i];
      if (it) onSelect(it);
    },
  });

  // Keep the keyboard-highlighted row scrolled into view.
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      style={{
        borderRadius: 4,
        background: color.popover,
        border: `1px solid ${border.default}`,
        boxShadow: shadow.dropdown,
        overflow: "hidden",
        ...style,
      }}
    >
      <input
        autoFocus
        value={search}
        placeholder={placeholder}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
            return;
          }
          handleKeyDown(e);
        }}
        style={{
          width: "100%",
          boxSizing: "border-box",
          height: 28,
          padding: "0 8px",
          fontSize: 11,
          fontFamily: searchFontFamily ?? font.sans,
          color: text.primary,
          background: "transparent",
          border: "none",
          borderBottom: `1px solid ${border.default}`,
          outline: "none",
        }}
      />
      <div role="listbox" style={{ maxHeight: listMaxHeight, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "6px 0",
              textAlign: "center",
              fontSize: 11,
              fontStyle: "italic",
              color: text.label,
            }}
          >
            {emptyText}
          </div>
        ) : (
          filtered.map((item, i) => {
            const key = getKey(item);
            const active = activeKey != null && key === activeKey;
            const highlighted = i === activeIndex;
            return (
              <div
                key={key}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                role="option"
                aria-selected={highlighted}
                onMouseEnter={() => setActiveIndex(i)}
                // mousedown (not click) + preventDefault so selecting doesn't
                // blur the search input before the handler runs.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(item);
                }}
                style={{
                  cursor: "pointer",
                  background: active ? color.primary : highlighted ? surface.hover : "transparent",
                }}
              >
                {renderItem(item, { active, highlighted })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
