import "./styles/globals.css";

/**
 * redial — main entry point
 *
 * Usage in your Next.js layout:
 *
 *   import { Tuner } from "redial";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html>
 *         <body>
 *           {children}
 *           {process.env.NODE_ENV === "development" && <Tuner />}
 *         </body>
 *       </html>
 *     );
 *   }
 */

"use client";

import { Overlay } from "./overlay/Overlay";

export function Tuner() {
  // Only render in dev mode
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "development") return null;

  return <Overlay />;
}

// Re-export types and utilities for consumers
export type { InferResult } from "./overlay/infer";
export { infer, PX_PROPS, TOGGLE_CSS, toCSSValue, flattenValues } from "./overlay/infer";
export type { Scope } from "./overlay/scope";
export type { SourceInfo } from "./overlay/sourcemap";
