"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled — Tuner accesses DOM APIs
const Tuner = dynamic(
  () => import("../../src/index").then((m) => ({ default: m.Tuner })),
  { ssr: false }
);

export function TunerProvider() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Tuner commitEndpoint="/api/tuner/commit" />;
}
