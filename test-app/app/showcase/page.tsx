"use client";

import { useEffect, useState } from "react";

/**
 * Showcase page — renders the figma-component-showcase.html
 * inside the Next.js app so Agentation can annotate every element.
 *
 * The HTML is loaded from /showcase.html (public dir) and injected
 * via dangerouslySetInnerHTML. The Tuner overlay is NOT mounted here
 * to avoid event conflicts — only Agentation runs on this page.
 */
export default function ShowcasePage() {
  const [html, setHtml] = useState<{ styles: string; body: string } | null>(null);

  useEffect(() => {
    fetch("/showcase.html")
      .then((r) => r.text())
      .then((text) => {
        // Extract <style>...</style> content
        const styleMatch = text.match(/<style>([\s\S]*?)<\/style>/);
        const styles = styleMatch?.[1] ?? "";

        // Extract <body>...</body> content
        const bodyMatch = text.match(/<body>([\s\S]*?)<\/body>/);
        const body = bodyMatch?.[1] ?? "";

        setHtml({ styles, body });
      });
  }, []);

  if (!html) {
    return (
      <div style={{ padding: 48, fontFamily: "system-ui", color: "rgba(0,0,0,0.4)" }}>
        Loading showcase…
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: html.styles }} />
      <div dangerouslySetInnerHTML={{ __html: html.body }} />
    </>
  );
}
