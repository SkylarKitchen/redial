"use client";

import { useEffect } from "react";

/**
 * Test Fixture Page — purpose-built elements covering all panel sections.
 *
 * Each element has a `data-testid` for browser-automation selection.
 * Auto-selects `fixture-block` on mount via the `tuner:select` custom event.
 */
export default function TestFixturePage() {
  useEffect(() => {
    const timer = setTimeout(() => {
      const target = document.querySelector('[data-testid="fixture-block"]');
      if (target) {
        document.dispatchEvent(
          new CustomEvent("tuner:select", { detail: target })
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const label: React.CSSProperties = {
    fontSize: 10,
    color: "#666",
    marginBottom: 4,
    fontFamily: "monospace",
  };

  return (
    <div style={{ padding: 32, display: "flex", flexDirection: "column", gap: 24, maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Test Fixture Page</h1>

      {/* ── Flex container ── */}
      <div>
        <div style={label}>fixture-flex</div>
        <div
          data-testid="fixture-flex"
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            padding: 16,
            background: "#f0f4f8",
            border: "1px solid #cbd5e1",
          }}
        >
          <div
            data-testid="fixture-flex-child"
            style={{ width: 80, height: 60, background: "#93c5fd" }}
          />
          <div style={{ width: 80, height: 60, background: "#60a5fa" }} />
          <div style={{ width: 80, height: 60, background: "#3b82f6" }} />
        </div>
      </div>

      {/* ── Grid container ── */}
      <div>
        <div style={label}>fixture-grid</div>
        <div
          data-testid="fixture-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
            padding: 16,
            background: "#f0fdf4",
            border: "1px solid #86efac",
          }}
        >
          <div style={{ height: 50, background: "#6ee7b7" }} />
          <div style={{ height: 50, background: "#6ee7b7" }} />
          <div style={{ height: 50, background: "#6ee7b7" }} />
          <div style={{ height: 50, background: "#6ee7b7" }} />
        </div>
      </div>

      {/* ── Block with CSS custom properties ── */}
      <div>
        <div style={label}>fixture-block</div>
        <div
          data-testid="fixture-block"
          style={
            {
              position: "relative",
              padding: 20,
              width: 200,
              height: 100,
              background: "#eeeeee",
              border: "1px solid #cccccc",
              "--test-color": "#3b82f6",
              "--test-spacing": "16px",
              "--test-radius": "8px",
              "--test-opacity": "0.8",
            } as React.CSSProperties
          }
        >
          Block
        </div>
      </div>

      {/* ── Typography ── */}
      <div>
        <div style={label}>fixture-text</div>
        <h2
          data-testid="fixture-text"
          style={{ fontSize: 24, fontWeight: 600, margin: 0 }}
        >
          Typography Test Heading
        </h2>
      </div>

      {/* ── Image ── */}
      <div>
        <div style={label}>fixture-img</div>
        <img
          data-testid="fixture-img"
          src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=300&fit=crop"
          alt="Test fixture image"
          style={{ width: 200, height: 150, objectFit: "cover", display: "block" }}
        />
      </div>

      {/* ── Positioned parent + child ── */}
      <div>
        <div style={label}>fixture-pos-parent / fixture-positioned</div>
        <div
          data-testid="fixture-pos-parent"
          style={{
            position: "relative",
            width: 300,
            height: 200,
            background: "#f5f5f5",
            border: "1px dashed #aaa",
          }}
        >
          <div
            data-testid="fixture-positioned"
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              width: 80,
              height: 80,
              background: "#fbbf24",
            }}
          />
        </div>
      </div>

      {/* ── Background gradient ── */}
      <div>
        <div style={label}>fixture-bg</div>
        <div
          data-testid="fixture-bg"
          style={{
            width: 200,
            height: 100,
            background: "linear-gradient(135deg, #ff0000, #0000ff)",
          }}
        />
      </div>

      {/* ── Tailwind element (for save-path testing) ── */}
      <div>
        <div style={label}>fixture-tailwind</div>
        <div
          data-testid="fixture-tailwind"
          className="flex items-center gap-4 p-4 bg-slate-100 rounded-lg"
        >
          <div className="w-10 h-10 bg-blue-500 rounded" />
          <span className="text-sm font-medium text-slate-700">Tailwind Card</span>
        </div>
      </div>

      {/* ── Effects ── */}
      <div>
        <div style={label}>fixture-effects</div>
        <div
          data-testid="fixture-effects"
          style={{
            width: 200,
            height: 100,
            background: "#e2e8f0",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}
