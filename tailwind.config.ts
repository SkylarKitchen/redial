import type { Config } from "tailwindcss";

// Selector strategy: every utility is compiled as `.__tuner-root .util` with
// !important. The descendant scope keeps the published stylesheet from
// restyling host-app elements that share utility class names (issue #58);
// !important still lets panel utilities beat host resets. The panel roots
// themselves use inline styles, never utilities, so descendant-only matching
// is safe.
export default {
  important: ".__tuner-root",
} satisfies Config;
