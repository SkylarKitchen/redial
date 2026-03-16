/**
 * autoCollections.ts — Pure inference engine for auto-grouping CSS variables.
 *
 * No React, no DOM. Given a flat list of CSSVariables and a set of
 * manually-assigned names, produces semantically grouped collections
 * by detecting namespace prefixes and clustering by type.
 */

import { naturalCompare, type CSSVariable, type VarType } from "./discoverVariables";

// ─── Types ───────────────────────────────────────────────────────────

export interface AutoCollection {
  id: string;           // e.g. "auto:color" — prefixed to avoid collision with manual IDs
  name: string;         // e.g. "Color"
  variableNames: string[];
  subgroups: { name: string; variableNames: string[] }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Strip `--` prefix and split on `-` */
function segments(name: string): string[] {
  return name.slice(2).split("-");
}

// ─── Namespace Detection ─────────────────────────────────────────────

/**
 * Detect if a common namespace prefix exists among the variables.
 * A first segment that appears in 60%+ of variables (with at least 5 vars)
 * is treated as a namespace (e.g. `tw`, `chakra`).
 */
function detectNamespace(vars: CSSVariable[]): string | null {
  if (vars.length < 5) return null;

  const counts = new Map<string, number>();
  for (const v of vars) {
    const segs = segments(v.name);
    if (segs.length >= 2) {
      const first = segs[0];
      counts.set(first, (counts.get(first) ?? 0) + 1);
    }
  }

  for (const [prefix, count] of counts) {
    if (count / vars.length >= 0.6) return prefix;
  }
  return null;
}

// ─── Within-Collection Subgroups ──────────────────────────────────

export interface Subgroup {
  name: string; // "" for ungrouped single-segment vars
  variables: CSSVariable[];
}

export function inferSubgroups(vars: CSSVariable[]): Subgroup[] {
  if (vars.length === 0) return [];

  const byFirst = new Map<string, CSSVariable[]>();
  const ungrouped: CSSVariable[] = [];

  for (const v of vars) {
    const segs = v.name.slice(2).split("-");
    if (segs.length === 1) {
      ungrouped.push(v);
    } else {
      const first = segs[0];
      if (!byFirst.has(first)) byFirst.set(first, []);
      byFirst.get(first)!.push(v);
    }
  }

  const result: Subgroup[] = [];

  for (const [first, groupVars] of byFirst) {
    const bySecond = new Map<string, CSSVariable[]>();
    let allHaveThirdSeg = true;

    for (const v of groupVars) {
      const segs = v.name.slice(2).split("-");
      if (segs.length >= 3) {
        const key = `${segs[0]}-${segs[1]}`;
        if (!bySecond.has(key)) bySecond.set(key, []);
        bySecond.get(key)!.push(v);
      } else {
        allHaveThirdSeg = false;
      }
    }

    if (allHaveThirdSeg && bySecond.size > 1) {
      // Multiple distinct second-segment prefixes → split into separate subgroups
      for (const [prefix, subVars] of bySecond) {
        result.push({
          name: prefix,
          variables: subVars.sort((a, b) => naturalCompare(a.name, b.name)),
        });
      }
    } else if (allHaveThirdSeg && bySecond.size === 1) {
      // All vars share the same two-segment prefix → use it as the group name
      const [[prefix, subVars]] = bySecond;
      result.push({
        name: prefix,
        variables: subVars.sort((a, b) => naturalCompare(a.name, b.name)),
      });
    } else {
      result.push({
        name: first,
        variables: groupVars.sort((a, b) => naturalCompare(a.name, b.name)),
      });
    }
  }

  if (ungrouped.length > 0) {
    result.unshift({
      name: "",
      variables: ungrouped.sort((a, b) => naturalCompare(a.name, b.name)),
    });
  }

  return result.sort((a, b) => naturalCompare(a.name, b.name));
}

// ─── Main Engine ─────────────────────────────────────────────────────

export function inferAutoCollections(
  vars: CSSVariable[],
  manuallyAssigned: Set<string>,
): AutoCollection[] {
  // 1. Filter out manually assigned
  const remaining = vars.filter((v) => !manuallyAssigned.has(v.name));
  if (remaining.length === 0) return [];

  const namespace = detectNamespace(remaining);
  const buckets = new Map<string, CSSVariable[]>();

  if (namespace) {
    // ── Namespace mode ───────────────────────────────────────────
    for (const v of remaining) {
      const segs = segments(v.name);
      // Only process vars that start with the namespace
      if (segs[0] !== namespace) {
        // Non-namespace var — group by first segment as-is
        const group = capitalize(segs[0]);
        if (!buckets.has(group)) buckets.set(group, []);
        buckets.get(group)!.push(v);
        continue;
      }
      // Strip namespace prefix — group by the next segment
      if (segs.length >= 2) {
        const group = capitalize(segs[1]);
        if (!buckets.has(group)) buckets.set(group, []);
        buckets.get(group)!.push(v);
      }
    }
  } else {
    // ── No namespace — group by first segment after `--` ─────────
    for (const v of remaining) {
      const segs = segments(v.name);
      const group = capitalize(segs[0]);
      if (!buckets.has(group)) buckets.set(group, []);
      buckets.get(group)!.push(v);
    }
  }

  // Type-based splitting for large groups (no-namespace mode only)
  if (!namespace) {
    for (const [key, groupVars] of buckets) {
      if (groupVars.length > 20) {
        // Split by VarType into subgroups within the same collection
        // (handled via subgroups in the collection output below)
        // Keep the bucket as-is — subgroup logic runs during collection build
      }
    }
  }

  // ── Collapse small groups into "Other" ─────────────────────────
  const otherVars: CSSVariable[] = [];
  const validBuckets = new Map<string, CSSVariable[]>();

  for (const [key, groupVars] of buckets) {
    if (groupVars.length < 2) {
      otherVars.push(...groupVars);
    } else {
      validBuckets.set(key, groupVars);
    }
  }

  // ── Build AutoCollection array ─────────────────────────────────
  const result: AutoCollection[] = [];

  for (const [name, groupVars] of validBuckets) {
    const subgroups: AutoCollection["subgroups"] = [];

    // If no namespace and group is large (>20), split by VarType
    if (!namespace && groupVars.length > 20) {
      const byType = new Map<VarType, CSSVariable[]>();
      for (const v of groupVars) {
        if (!byType.has(v.type)) byType.set(v.type, []);
        byType.get(v.type)!.push(v);
      }
      if (byType.size > 1) {
        for (const [type, typeVars] of byType) {
          subgroups.push({
            name: capitalize(type),
            variableNames: typeVars.map((v) => v.name).sort(),
          });
        }
      }
    }

    result.push({
      id: `auto:${name.toLowerCase()}`,
      name,
      variableNames: groupVars.map((v) => v.name).sort(),
      subgroups,
    });
  }

  // Add "Other" collection if there are leftover small-group vars
  if (otherVars.length > 0) {
    result.push({
      id: "auto:other",
      name: "Other",
      variableNames: otherVars.map((v) => v.name).sort(),
      subgroups: [],
    });
  }

  // Sort alphabetically by name
  result.sort((a, b) => naturalCompare(a.name, b.name));

  return result;
}
