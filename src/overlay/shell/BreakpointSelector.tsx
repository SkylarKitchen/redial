/**
 * BreakpointSelector.tsx — Dropdown for choosing the target responsive breakpoint
 *
 * The "which breakpoint am I editing" indicator + selector for issue #35. While
 * a non-base breakpoint is active, every style edit is keyed to that breakpoint
 * (ADR-0005) and previewed media-gated (breakpointPreview.ts).
 *
 * Thin declaration over PortalListboxSelect — portal/keyboard/trigger/listbox
 * wiring lives there; this file owns only the options list and the prop contract.
 */

import { Monitor } from "lucide-react";
import { PortalListboxSelect } from "../controls/PortalListboxSelect";
import { BREAKPOINTS, BASE_BREAKPOINT_ID } from "../breakpoints";

export interface BreakpointSelectorProps {
  value: string;
  onChange: (breakpoint: string) => void;
}

const BREAKPOINT_OPTIONS = BREAKPOINTS.map((b) => ({ id: b.id, label: b.label }));

export function BreakpointSelector({ value, onChange }: BreakpointSelectorProps) {
  return (
    <PortalListboxSelect
      value={value}
      onChange={onChange}
      options={BREAKPOINT_OPTIONS}
      baseId={BASE_BREAKPOINT_ID}
      leadingIcon={(isBase) => (
        <Monitor size={12} style={{ flexShrink: 0, opacity: isBase ? 0.6 : 0.9 }} />
      )}
      estimatedWidth={160}
      triggerTitle="Target breakpoint"
    />
  );
}
