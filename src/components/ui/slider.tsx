import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ComponentRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center h-5",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-black/[0.08] hover:bg-black/[0.12] transition-colors">
      <SliderPrimitive.Range className="absolute h-full bg-[var(--primary)]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="block h-2.5 w-2.5 rounded-full border border-transparent bg-transparent shadow-none transition-colors focus-visible:outline-none focus-visible:border-[var(--primary)]/50 focus-visible:bg-[var(--background)] focus-visible:shadow-sm focus-visible:ring-1 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
