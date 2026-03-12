/**
 * parseValueWithUnit.ts — Extract numeric value + optional CSS unit from user input
 *
 * Parses strings like "68em", "50%", "1.5rem", "200" into { value, unit }.
 * Only recognizes units from the provided allowedUnits list.
 */

const KNOWN_UNITS = ["px", "%", "vw", "vh", "em", "rem", "ch", "vmin", "vmax", "ex", "cap", "lh", "rlh"];

export interface ParsedValueUnit {
  value: number;
  unit: string | null;
}

/**
 * Parse a user-typed string like "68em" or "50%" into value + unit.
 * @param input   Raw text from the input field
 * @param allowedUnits  Units this field accepts (e.g. ["px","%","em","rem"])
 * @returns { value, unit } — unit is null if no recognized unit suffix was found
 */
export function parseValueWithUnit(input: string, allowedUnits: string[]): ParsedValueUnit {
  const trimmed = input.trim();
  if (trimmed === "") return { value: NaN, unit: null };

  // Try matching a number followed by an optional unit suffix
  // Supports: 68px, 1.5rem, .5em, -10%, 200, etc.
  const match = trimmed.match(/^(-?\d*\.?\d+)\s*([a-z%]+)?$/i);
  if (!match) return { value: NaN, unit: null };

  const numericValue = parseFloat(match[1]);
  const unitStr = match[2]?.toLowerCase() ?? null;

  if (unitStr === null) {
    return { value: numericValue, unit: null };
  }

  // Check if the typed unit is in the allowed list for this field
  if (allowedUnits.includes(unitStr)) {
    return { value: numericValue, unit: unitStr };
  }

  // Also check against known CSS units even if not in allowedUnits
  if (KNOWN_UNITS.includes(unitStr)) {
    return { value: numericValue, unit: unitStr };
  }

  // Unknown suffix — treat the whole thing as invalid
  return { value: NaN, unit: null };
}
