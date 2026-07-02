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

import { useEffect, useState } from "react";
import "./styles/globals.css";
import { Overlay } from "./overlay/shell/Overlay";
import { configure, type TunerConfig } from "./overlay/core/config";

export interface TunerProps extends Partial<TunerConfig> {}

export function Tuner({ commitEndpoint, breakpoints }: TunerProps = {}) {
  // SSR safety: two-pass mount gate. Render null on the server AND on the
  // first client render so hydration output always matches (a bare
  // `typeof window` check diverges on the first client pass and logs a
  // React hydration error). The overlay mounts via the effect below, after
  // hydration completes. See src/__tests__/tunerSsrHydration.test.tsx.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply config overrides on mount — this effect runs before the `mounted`
  // re-render commits, so the config is in place before <Overlay /> mounts.
  useEffect(() => {
    const overrides: Partial<TunerConfig> = {};
    if (commitEndpoint) overrides.commitEndpoint = commitEndpoint;
    if (breakpoints) overrides.breakpoints = breakpoints;
    if (Object.keys(overrides).length > 0) configure(overrides);
  }, [commitEndpoint, breakpoints]);

  // Only render in dev mode, and only after the client has mounted
  if (!mounted) return null;
  if (process.env.NODE_ENV !== "development") return null;

  return <Overlay />;
}

// Re-export types and utilities for consumers
export type { InferResult } from "./overlay/core/infer";
export { infer } from "./overlay/core/infer";
export type { Scope } from "./overlay/core/scope";
export type { SourceInfo } from "./overlay/core/sourcemap";
export { configure } from "./overlay/core/config";
export type { TunerConfig, TunerBreakpoint } from "./overlay/core/config";
