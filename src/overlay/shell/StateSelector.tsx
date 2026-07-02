/**
 * StateSelector.tsx — Dropdown for selecting CSS pseudo-class states
 *
 * Compact trigger shows current state + chevron. Green text when
 * a non-base state is active, matching Webflow's state indicator.
 *
 * Thin declaration over PortalListboxSelect — portal/keyboard/trigger/listbox
 * wiring lives there; this file owns only the options list and the prop contract.
 */

import { PortalListboxSelect } from "../controls/PortalListboxSelect";

export interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
}

// "visited" is deliberately NOT offered: browser privacy restrictions make
// :visited impossible to preview — getComputedStyle lies about visited-only
// styles and the state can't be force-rendered, so selecting it did nothing.
const STATE_OPTIONS = [
  { id: "none", label: "None — base styles" },
  { id: "hover", label: "Hover" },
  { id: "focus", label: "Focus" },
  { id: "active", label: "Active" },
  { id: "focus-within", label: "Focus Within" },
  { id: "focus-visible", label: "Focus Visible" },
];

export function StateSelector({ value, onChange }: StateSelectorProps) {
  return (
    <PortalListboxSelect
      value={value}
      onChange={onChange}
      options={STATE_OPTIONS}
      baseId="none"
      baseTriggerLabel="State"
      estimatedWidth={180}
    />
  );
}
