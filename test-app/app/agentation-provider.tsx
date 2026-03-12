"use client";

import dynamic from "next/dynamic";

// Dynamic import with SSR disabled — Agentation accesses DOM APIs
const Agentation = dynamic(
  () => import("agentation").then((m) => ({ default: m.Agentation })),
  { ssr: false }
);

export function AgentationProvider() {
  if (process.env.NODE_ENV !== "development") return null;
  return <Agentation />;
}
