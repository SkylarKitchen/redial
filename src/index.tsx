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

import { useEffect } from "react";
import "./styles/globals.css";
import { Overlay } from "./overlay/shell/Overlay";
import { configure, type TunerConfig } from "./overlay/core/config";

export interface TunerProps extends Partial<TunerConfig> {}

export function Tuner({ commitEndpoint }: TunerProps = {}) {
  // Apply config overrides on mount
  useEffect(() => {
    const overrides: Partial<TunerConfig> = {};
    if (commitEndpoint) overrides.commitEndpoint = commitEndpoint;
    if (Object.keys(overrides).length > 0) configure(overrides);
  }, [commitEndpoint]);

  // Only render in dev mode
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV !== "development") return null;

  return <Overlay />;
}

// Re-export types and utilities for consumers
export type { InferResult } from "./overlay/core/infer";
export { infer, PX_PROPS, TOGGLE_CSS, toCSSValue, flattenValues } from "./overlay/core/infer";
export type { Scope } from "./overlay/core/scope";
export type { SourceInfo } from "./overlay/core/sourcemap";
export { configure } from "./overlay/core/config";
export type { TunerConfig } from "./overlay/core/config";
