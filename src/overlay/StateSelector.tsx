/**
 * StateSelector.tsx — Dropdown for selecting CSS pseudo-class states
 *
 * Compact trigger shows current state + chevron. Green text when
 * a non-base state is active, matching Webflow's state indicator.
 *
 * Uses Shadcn Select (Radix) for dropdown behavior — no manual
 * click-outside or open state management needed.
 */

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        className={cn(
          "h-6 text-[11px] bg-transparent border-none px-1.5 w-auto gap-1 shadow-none focus:ring-0",
          isBase ? "text-muted-foreground" : "text-emerald-400"
        )}
      >
        <SelectValue>
          {isBase ? "State" : current.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="__tuner-root min-w-[180px]">
        {STATES.map((state) => (
          <SelectItem
            key={state.value}
            value={state.value}
            className="text-[11px] py-1.5 pl-2 pr-8"
          >
            {state.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
