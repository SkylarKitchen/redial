"use client";

// Direct import — no dynamic()/ssr:false wrapper needed. Tuner is
// intrinsically SSR-safe: it renders null on the server AND on the first
// client render (so hydration always matches), then mounts the overlay via
// an effect. This matches the README quickstart exactly.
import { Tuner } from "../../src/index";

export function TunerProvider() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Tuner commitEndpoint="/api/tuner/commit" />;
}
