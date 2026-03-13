/**
 * StateSelector.tsx — Dropdown for selecting CSS pseudo-class states
 *
 * Compact trigger shows current state + chevron. Green text when
 * a non-base state is active, matching Webflow's state indicator.
 *
 * Uses Shadcn Select (Radix) for dropdown behavior — no manual
 * click-outside or open state management needed.
 */

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { text } from "./theme";

export interface StateSelectorProps {
  value: string;
  onChange: (state: string) => void;
}

interface StateOption {
  value: string;
  label: string;
}

const STATES: StateOption[] = [
  { value: "none", label: "None \u2014 base styles" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Focus" },
  { value: "active", label: "Active" },
  { value: "visited", label: "Visited" },
  { value: "focus-within", label: "Focus Within" },
  { value: "focus-visible", label: "Focus Visible" },
  { value: "first-child", label: "First Child" },
  { value: "last-child", label: "Last Child" },
];

export function StateSelector({ value, onChange }: StateSelectorProps) {
  const current = STATES.find((s) => s.value === value) ?? STATES[0];
  const isBase = value === "none";

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        style={{
          height: 24,
          fontSize: 11,
          background: "transparent",
          border: "none",
          paddingLeft: 6,
          paddingRight: 6,
          width: "auto",
          gap: 4,
          boxShadow: "none",
          color: isBase ? text.label : "#34d399",
        }}
      >
        <SelectValue>
          {isBase ? "State" : current.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="__tuner-root" style={{ minWidth: 180 }}>
        {STATES.map((state) => (
          <SelectItem
            key={state.value}
            value={state.value}
            style={{
              fontSize: 11,
              padding: "6px 32px 6px 8px",
            }}
          >
            {state.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
