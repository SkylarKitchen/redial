/**
 * collectionDetailShared.tsx — Shared helpers and style constants for the
 * CollectionDetail master-detail pieces (context menu, mode cells, rows).
 */

import React from "react";
import { text, surface, color, font } from "../theme";

// ─── Display Name Logic ─────────────────────────────────────────────

/** Strip `--` prefix and optional subgroup prefix for cleaner display. */
export function displayName(varName: string, subgroupName: string): string {
  let name = varName.startsWith("--") ? varName.slice(2) : varName;
  if (subgroupName && name.startsWith(subgroupName + "-")) {
    name = name.slice(subgroupName.length + 1);
  }
  return name;
}

// ─── Shared Styles ──────────────────────────────────────────────────

export const INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  height: 22,
  background: surface.subtle,
  border: `1px solid ${color.primary}`,
  borderRadius: 3,
  padding: "0 6px",
  fontSize: 10,
  fontFamily: font.mono,
  color: text.primary,
  outline: "none",
  boxSizing: "border-box",
};

export const RENAME_INPUT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  flex: "none",
  width: "100%",
  maxWidth: 160,
};

export const COLUMN_HEADER_STYLE: React.CSSProperties = {
  fontSize: 10,
  fontFamily: font.sans,
  fontWeight: 500,
  color: text.hint,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  userSelect: "none",
};
