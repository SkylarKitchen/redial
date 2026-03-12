/**
 * ComputedTooltip.tsx — Hover tooltip showing the computed CSS value
 *
 * Wraps any label element; on hover reads
 * getComputedStyle(element).getPropertyValue(property) and displays
 * a Shadcn/Radix Tooltip above the label.
 *
 * Hides when the computed value matches the displayed value.
 */

import React, { useState, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface ComputedTooltipProps {
  property: string;
  element: Element;
  /** The currently-displayed value so we can skip showing when identical */
  displayValue?: string;
  children: React.ReactNode;
}

export function ComputedTooltip({ property, element, displayValue, children }: ComputedTooltipProps) {
  const [computedValue, setComputedValue] = useState("");
  const [shouldShow, setShouldShow] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        try {
          const val = getComputedStyle(element).getPropertyValue(property).trim();
          // Don't show if empty or matches what's already displayed
          if (!val || (displayValue && val === displayValue)) {
            setShouldShow(false);
            return;
          }
          setComputedValue(val);
          setShouldShow(true);
        } catch {
          // Element may have been removed
          setShouldShow(false);
        }
      } else {
        setShouldShow(false);
      }
    },
    [element, property, displayValue]
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300} open={shouldShow} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <span className="relative inline-flex items-center">
            {children}
          </span>
        </TooltipTrigger>
        {shouldShow && computedValue && (
          <TooltipContent className="text-[10px] font-mono" side="top">
            Computed: {computedValue}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
