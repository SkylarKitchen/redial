# Docs Site Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an agentation.com-style docs site into the existing test-app with 3 pages: landing (`/`), install (`/install`), features (`/features`).

**Architecture:** New pages in test-app/app using the existing SCSS token system. Shared `DocsNav` component for top navigation. Docs-specific SCSS module. Current homepage sample content already duplicated in `/demo` — replace `/` with landing page.

**Tech Stack:** Next.js App Router, SCSS Modules, semantic CSS tokens from `tokens/semantic.css`

---

### Task 1: Create docs SCSS module

**Files:**
- Create: `test-app/app/docs.module.scss`

**Step 1: Create the docs-specific stylesheet**

This module provides all styles for the 3 docs pages. Uses the same semantic token system as `page.module.scss`.

```scss
// docs.module.scss — Styles for documentation pages
//
// Uses ONLY semantic tokens from tokens/semantic.css.

// ── Layout Shell ──

.docsPage {
  display: flex;
  min-height: 100vh;
  font-family: var(--font-geist-sans);
  background-color: #faf9f7;
}

.docsContent {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  padding: 80px 40px 120px;
}

.docsContentWithSidebar {
  flex: 1;
  max-width: 720px;
  padding: 80px 40px 120px;
}

// ── Top Navigation ──

.topNav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 32px;
  background-color: rgba(250, 249, 247, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-default);
}

.navLogo {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  text-decoration: none;
  margin-right: 32px;
}

.navLinks {
  display: flex;
  gap: 24px;

  a {
    font-size: 14px;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 0.15s;

    &:hover {
      color: var(--text-primary);
    }
  }
}

.navLinksRight {
  margin-left: auto;
}

.navActive {
  color: var(--text-primary) !important;
  font-weight: 500;
}

// ── Sidebar ──

.sidebar {
  position: fixed;
  top: 56px;
  left: 0;
  width: 220px;
  height: calc(100vh - 56px);
  padding: 24px 16px;
  overflow-y: auto;
  border-right: 1px solid var(--border-default);
  background-color: #faf9f7;
}

.sidebarSection {
  margin-bottom: 24px;

  h4 {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin-bottom: 8px;
    padding: 0 12px;
  }
}

.sidebarLink {
  display: block;
  font-size: 13px;
  color: var(--text-secondary);
  text-decoration: none;
  padding: 4px 12px;
  border-radius: 6px;
  transition: color 0.15s, background-color 0.15s;

  &:hover {
    color: var(--text-primary);
    background-color: rgba(0, 0, 0, 0.04);
  }
}

.sidebarLinkActive {
  color: var(--text-primary);
  font-weight: 500;
  background-color: rgba(0, 0, 0, 0.04);
}

.withSidebar {
  margin-left: 220px;
}

// ── Hero (landing page) ──

.hero {
  text-align: center;
  padding: 80px 0 48px;
}

.heroTitle {
  font-size: 48px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.heroSubtitle {
  font-size: 18px;
  line-height: 1.6;
  color: var(--text-secondary);
  max-width: 540px;
  margin: 0 auto 32px;
}

// ── Install Snippet ──

.installSnippet {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 48px;
}

.codeBlock {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  background-color: var(--surface-inset);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  font-family: var(--font-geist-mono);
  font-size: 14px;
  color: var(--text-primary);
}

.copyBtn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--border-default);
  border-radius: 8px;
  background: var(--surface-primary);
  cursor: pointer;
  color: var(--text-secondary);
  transition: color 0.15s, border-color 0.15s;

  &:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }
}

// ── Steps (How it works) ──

.steps {
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 64px;
}

.step {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.stepNumber {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--interactive-default);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.stepContent {
  h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  p {
    font-size: 14px;
    line-height: 1.5;
    color: var(--text-secondary);
  }
}

// ── Section Heading ──

.sectionHeading {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

// ── Feature Cards (landing) ──

.featureGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-bottom: 64px;
}

.featureCard {
  padding: 24px;
  border-radius: 12px;
  background-color: var(--surface-primary);
  border: 1px solid var(--border-default);

  h3 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
  }

  p {
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-secondary);
  }
}

// ── Stats Row (landing) ──

.statsRow {
  display: flex;
  justify-content: center;
  gap: 0;
  margin-bottom: 64px;
  border: 1px solid var(--border-default);
  border-radius: 12px;
  overflow: hidden;
  background-color: var(--surface-primary);
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 24px 16px;
  border-right: 1px solid var(--border-default);

  &:last-child {
    border-right: none;
  }
}

.statValue {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.statLabel {
  font-size: 12px;
  color: var(--text-secondary);
}

// ── CTA Button ──

.ctaButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  padding: 0 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.9;
  }
}

.ctaPrimary {
  background-color: var(--interactive-default);
  color: #fff;
  border: none;
}

.ctaSecondary {
  background-color: transparent;
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

// ── Content Pages (install, features) ──

.pageTitle {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.pageSubtitle {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 40px;
}

.contentSection {
  margin-bottom: 48px;
}

.contentSection h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.contentSection h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.contentSection p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

// ── Code Block (multi-line) ──

.codeBlockMulti {
  display: block;
  padding: 16px 20px;
  background-color: #1e1e2e;
  color: #cdd6f4;
  border-radius: 10px;
  font-family: var(--font-geist-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
  margin-bottom: 16px;
  white-space: pre;
}

.codeBlockMulti .codeComment {
  color: #6c7086;
}

.codeBlockMulti .codeKeyword {
  color: #cba6f7;
}

.codeBlockMulti .codeString {
  color: #a6e3a1;
}

.codeBlockMulti .codeTag {
  color: #89b4fa;
}

// ── Tables ──

.propsTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  margin-bottom: 16px;

  th {
    text-align: left;
    padding: 8px 12px;
    font-weight: 600;
    color: var(--text-primary);
    border-bottom: 2px solid var(--border-default);
    font-size: 12px;
  }

  td {
    padding: 8px 12px;
    color: var(--text-secondary);
    border-bottom: 1px solid var(--border-default);
  }

  code {
    font-family: var(--font-geist-mono);
    font-size: 12px;
    background-color: var(--surface-inset);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--text-primary);
  }
}

// ── Feature List (features page) ──

.featureSection {
  margin-bottom: 48px;
}

.featureSection h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.featureSection > p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.panelSectionGrid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.panelSectionCard {
  padding: 16px;
  border-radius: 10px;
  border: 1px solid var(--border-default);
  background-color: var(--surface-primary);

  h4 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
  }

  p {
    font-size: 12px;
    line-height: 1.5;
    color: var(--text-secondary);
    margin: 0;
  }
}

// ── Keyboard Shortcuts Table ──

.shortcutsTable {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;

  td {
    padding: 6px 12px;
    border-bottom: 1px solid var(--border-default);
    color: var(--text-secondary);
  }

  td:first-child {
    width: 140px;
  }

  kbd {
    display: inline-block;
    padding: 2px 8px;
    font-family: var(--font-geist-mono);
    font-size: 12px;
    background-color: var(--surface-inset);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    color: var(--text-primary);
  }
}

// ── Footer ──

.docsFooter {
  margin-top: 64px;
  padding-top: 24px;
  border-top: 1px solid var(--border-default);
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);

  a {
    color: var(--interactive-default);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/skylar/code/redial/test-app && npx next build --no-lint 2>&1 | head -20`

Expected: No SCSS compilation errors

**Step 3: Commit**

```bash
git add test-app/app/docs.module.scss
git commit -m "feat: add docs site SCSS module"
```

---

### Task 2: Create DocsNav component

**Files:**
- Create: `test-app/app/components/DocsNav.tsx`

**Step 1: Create the shared navigation component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../docs.module.scss";

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.topNav}>
      <Link href="/" className={styles.navLogo}>
        Redial
      </Link>
      <div className={styles.navLinks}>
        <Link href="/" className={pathname === "/" ? styles.navActive : undefined}>
          Overview
        </Link>
        <Link
          href="/install"
          className={pathname === "/install" ? styles.navActive : undefined}
        >
          Install
        </Link>
        <Link
          href="/features"
          className={pathname === "/features" ? styles.navActive : undefined}
        >
          Features
        </Link>
      </div>
      <div className={`${styles.navLinks} ${styles.navLinksRight}`}>
        <a
          href="https://github.com/SkylarKitchen/redial"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </div>
    </nav>
  );
}
```

**Step 2: Commit**

```bash
git add test-app/app/components/DocsNav.tsx
git commit -m "feat: add DocsNav shared component"
```

---

### Task 3: Create landing page (replace `/`)

**Files:**
- Modify: `test-app/app/page.tsx` (full rewrite)

**Step 1: Replace the homepage with the docs landing page**

```tsx
import Link from "next/link";
import { DocsNav } from "./components/DocsNav";
import styles from "./docs.module.scss";

export default function Home() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContent} style={{ paddingTop: 136 }}>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>
            Visual CSS tuning for Next.js
          </h1>
          <p className={styles.heroSubtitle}>
            Click any element, get context-aware controls, drag to tune, save
            directly to your source files. The Webflow workflow — in your own
            codebase.
          </p>
          <div className={styles.installSnippet}>
            <code className={styles.codeBlock}>
              npm install github:SkylarKitchen/redial
            </code>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              href="/install"
              className={`${styles.ctaButton} ${styles.ctaPrimary}`}
            >
              Get Started
            </Link>
            <Link
              href="/features"
              className={`${styles.ctaButton} ${styles.ctaSecondary}`}
            >
              Features
            </Link>
          </div>
        </section>

        {/* ── How it works ── */}
        <h2 className={styles.sectionHeading}>How it works</h2>
        <div className={styles.steps}>
          {[
            ["Press ` (backtick)", "Enter selection mode — elements highlight as you hover."],
            ["Click any element", "A floating panel appears with context-aware CSS controls."],
            ["Drag sliders, pick colors", "Changes apply instantly as inline style overrides."],
            ["Undo, redo, reset", "Full undo stack. Alt+click any label to reset one property."],
            ["Hit Save", "Changes write to your actual source files via CSS source maps. HMR reloads instantly."],
          ].map(([title, desc], i) => (
            <div className={styles.step} key={i}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <div className={styles.stepContent}>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats ── */}
        <div className={styles.statsRow}>
          {[
            ["8+1", "CSS Sections"],
            ["120+", "Properties"],
            ["0ms", "Latency"],
            ["HMR", "Save Target"],
          ].map(([value, label]) => (
            <div className={styles.stat} key={label}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Feature Highlights ── */}
        <h2 className={styles.sectionHeading}>What you get</h2>
        <div className={styles.featureGrid}>
          {[
            ["Layout", "Display, flex, grid, gap, alignment — with a 3x3 alignment grid and flex/grid child controls."],
            ["Spacing", "Margin and padding via a visual box model diagram. Click any zone to edit."],
            ["Typography", "Font size, weight, line height, letter spacing, color, and text alignment."],
            ["Backgrounds", "Solid colors, gradients, multi-layer support with a full gradient editor."],
            ["Borders", "Side selector, linked/unlinked corner radius, border color and width."],
            ["Effects", "Shadows, transforms, filters, transitions — each with dedicated sub-editors."],
            ["CSS Variables", "Discovers custom properties on the selected element. Tune --var values directly."],
            ["Save to Source", "Traces styles back to source files via CSS source maps. Surgical string replacement."],
          ].map(([title, desc]) => (
            <div className={styles.featureCard} key={title}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <footer className={styles.docsFooter}>
          MIT License &middot;{" "}
          <a
            href="https://github.com/SkylarKitchen/redial"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page renders**

Run: `cd /Users/skylar/code/redial/test-app && npx next build --no-lint 2>&1 | tail -5`

Expected: Build succeeds

**Step 3: Commit**

```bash
git add test-app/app/page.tsx
git commit -m "feat: replace homepage with docs landing page"
```

---

### Task 4: Create install page (`/install`)

**Files:**
- Create: `test-app/app/install/page.tsx`

**Step 1: Create the install page with 3-step setup guide**

```tsx
import { DocsNav } from "../components/DocsNav";
import styles from "../docs.module.scss";

export default function InstallPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <h4>Setup</h4>
          <a href="#install" className={styles.sidebarLink}>Install</a>
          <a href="#next-plugin" className={styles.sidebarLink}>Next.js Plugin</a>
          <a href="#api-route" className={styles.sidebarLink}>API Route</a>
          <a href="#component" className={styles.sidebarLink}>Component</a>
        </div>
        <div className={styles.sidebarSection}>
          <h4>Reference</h4>
          <a href="#configuration" className={styles.sidebarLink}>Configuration</a>
          <a href="#exports" className={styles.sidebarLink}>Exports</a>
          <a href="#requirements" className={styles.sidebarLink}>Requirements</a>
        </div>
      </aside>
      <div className={`${styles.docsContentWithSidebar} ${styles.withSidebar}`}>
        <div style={{ paddingTop: 56 }}>
          <h1 className={styles.pageTitle}>Install</h1>
          <p className={styles.pageSubtitle}>
            Three steps to add Redial to any Next.js project.
          </p>

          {/* ── Install ── */}
          <section id="install" className={styles.contentSection}>
            <h2>Install the package</h2>
            <pre className={styles.codeBlockMulti}>
              npm install github:SkylarKitchen/redial
            </pre>
          </section>

          {/* ── Step 1: Next.js Plugin ── */}
          <section id="next-plugin" className={styles.contentSection}>
            <h2>1. Next.js plugin</h2>
            <p>
              Enables CSS source maps in dev mode so Redial can trace styles back
              to their source files.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// next.config.js
const withTuner = require("redial/next-plugin");

module.exports = withTuner({
  // your existing config
});`}
            </pre>
          </section>

          {/* ── Step 2: API Route ── */}
          <section id="api-route" className={styles.contentSection}>
            <h2>2. API route</h2>
            <p>
              The server-side handler that writes CSS changes to your source files.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// app/api/tuner/[...path]/route.ts
export { GET, POST } from "redial/server";`}
            </pre>
          </section>

          {/* ── Step 3: Component ── */}
          <section id="component" className={styles.contentSection}>
            <h2>3. Component</h2>
            <p>
              Drop the <code>&lt;Tuner /&gt;</code> component into your root
              layout. It only renders in development.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// app/layout.tsx
import { Tuner } from "redial";
import "redial/styles.css";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Tuner />}
      </body>
    </html>
  );
}`}
            </pre>
          </section>

          {/* ── Configuration ── */}
          <section id="configuration" className={styles.contentSection}>
            <h2>Configuration</h2>
            <pre className={styles.codeBlockMulti}>
{`<Tuner commitEndpoint="/api/tuner" />`}
            </pre>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Prop</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>commitEndpoint</code></td>
                  <td><code>string</code></td>
                  <td><code>{`"/api/tuner"`}</code></td>
                  <td>API route path for the commit server</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── Exports ── */}
          <section id="exports" className={styles.contentSection}>
            <h2>Exports</h2>
            <pre className={styles.codeBlockMulti}>
{`import { Tuner } from "redial";              // Main component
import { configure } from "redial";           // Runtime config
import "redial/styles.css";                   // Required stylesheet

export { GET, POST } from "redial/server";    // API route handlers
const withTuner = require("redial/next-plugin"); // Next.js plugin`}
            </pre>
          </section>

          {/* ── Requirements ── */}
          <section id="requirements" className={styles.contentSection}>
            <h2>Requirements</h2>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Dependency</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>Next.js</td><td>{`≥ 13 (App Router)`}</td></tr>
                <tr><td>React</td><td>{`≥ 18`}</td></tr>
                <tr><td>Node.js</td><td>{`≥ 18`}</td></tr>
              </tbody>
            </table>
          </section>

          <footer className={styles.docsFooter}>
            MIT License &middot;{" "}
            <a
              href="https://github.com/SkylarKitchen/redial"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the page builds**

Run: `cd /Users/skylar/code/redial/test-app && npx next build --no-lint 2>&1 | tail -5`

Expected: Build succeeds, `/install` route listed

**Step 3: Commit**

```bash
git add test-app/app/install/page.tsx
git commit -m "feat: add install docs page"
```

---

### Task 5: Create features page (`/features`)

**Files:**
- Create: `test-app/app/features/page.tsx`

**Step 1: Create the features page with all capabilities**

```tsx
import { DocsNav } from "../components/DocsNav";
import styles from "../docs.module.scss";

const panelSections = [
  { name: "Layout", desc: "display, flex-direction, justify-content, align-items, gap, flex-wrap. 3x3 alignment grid, display type selector." },
  { name: "Spacing", desc: "margin-*, padding-*. Visual box model diagram with click-to-edit values." },
  { name: "Size", desc: "width, height, min-*, max-*, overflow, object-fit. Sliders with unit selectors (px, %, vw, vh, em, rem)." },
  { name: "Position", desc: "position, top/right/bottom/left, z-index. Visual offset diagram, contextual controls." },
  { name: "Typography", desc: "font-size, weight, line-height, letter-spacing, color, text-align. Color picker, font selector." },
  { name: "Backgrounds", desc: "background-color, gradients. Multi-layer support, gradient editor, color picker with opacity." },
  { name: "Borders", desc: "border-*, border-radius. Side selector tabs, linked/unlinked corner radius, color picker." },
  { name: "Effects", desc: "opacity, box-shadow, transform, filter, backdrop-filter, transitions. Dedicated sub-editors for each." },
];

const shortcuts = [
  ["`", "Toggle selection mode"],
  ["Esc", "Close panel / cancel selection"],
  ["Cmd+Z", "Undo"],
  ["Cmd+Shift+Z", "Redo"],
  ["Cmd+S", "Save changes to source files"],
  ["Cmd+C", "Copy CSS"],
  ["Cmd+K", "Command palette"],
  ["D (hold)", "Diff peek — strips overrides while held"],
  ["S", "Cycle scope (element / class)"],
  ["R", "Reset current element"],
  ["Arrow Up/Down", "Navigate sections"],
  ["Tab", "Move between controls"],
];

export default function FeaturesPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSection}>
          <h4>Panel</h4>
          <a href="#sections" className={styles.sidebarLink}>CSS Sections</a>
          <a href="#variables" className={styles.sidebarLink}>CSS Variables</a>
        </div>
        <div className={styles.sidebarSection}>
          <h4>Workflow</h4>
          <a href="#scoping" className={styles.sidebarLink}>Scoping</a>
          <a href="#state-editing" className={styles.sidebarLink}>State Editing</a>
          <a href="#undo-redo" className={styles.sidebarLink}>Undo / Redo</a>
          <a href="#session" className={styles.sidebarLink}>Session Persistence</a>
          <a href="#overlays" className={styles.sidebarLink}>Visual Overlays</a>
        </div>
        <div className={styles.sidebarSection}>
          <h4>Output</h4>
          <a href="#commit" className={styles.sidebarLink}>Commit Flow</a>
          <a href="#copy" className={styles.sidebarLink}>Copy / Export</a>
        </div>
        <div className={styles.sidebarSection}>
          <h4>Reference</h4>
          <a href="#shortcuts" className={styles.sidebarLink}>Keyboard Shortcuts</a>
          <a href="#scrubbing" className={styles.sidebarLink}>Label-Drag Scrubbing</a>
        </div>
      </aside>
      <div className={`${styles.docsContentWithSidebar} ${styles.withSidebar}`}>
        <div style={{ paddingTop: 56 }}>
          <h1 className={styles.pageTitle}>Features</h1>
          <p className={styles.pageSubtitle}>
            Everything Redial gives you — context-aware controls, visual
            overlays, and source-file saves.
          </p>

          {/* ── Panel Sections ── */}
          <section id="sections" className={styles.featureSection}>
            <h2>Panel Sections</h2>
            <p>
              8 CSS sections modeled after the Webflow Designer. Each section is
              context-aware — flex controls only appear for flex elements,
              typography only for text-bearing elements.
            </p>
            <div className={styles.panelSectionGrid}>
              {panelSections.map((s) => (
                <div className={styles.panelSectionCard} key={s.name}>
                  <h4>{s.name}</h4>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── CSS Variables ── */}
          <section id="variables" className={styles.featureSection}>
            <h2>CSS Variables</h2>
            <p>
              Discovers all CSS custom properties (<code>--var</code>) affecting the
              selected element. Organizes them into collections (primitives,
              semantic, component tokens). Link any value to a variable via the
              variable picker.
            </p>
          </section>

          {/* ── Scoping ── */}
          <section id="scoping" className={styles.featureSection}>
            <h2>Scoping</h2>
            <p>
              Toggle between <strong>element</strong> scope (inline overrides on
              the specific element) and <strong>class</strong> scope (writes to
              the CSS class definition). The header shows scope pills and a
              breadcrumb of the element's DOM ancestry.
            </p>
          </section>

          {/* ── State Editing ── */}
          <section id="state-editing" className={styles.featureSection}>
            <h2>State Editing</h2>
            <p>
              Edit pseudo-class styles (<code>:hover</code>, <code>:focus</code>,{" "}
              <code>:active</code>, <code>:focus-within</code>,{" "}
              <code>:focus-visible</code>) via the state selector dropdown.
              Changes are previewed live and committed to the appropriate state
              block in your source file.
            </p>
          </section>

          {/* ── Undo / Redo ── */}
          <section id="undo-redo" className={styles.featureSection}>
            <h2>Undo / Redo</h2>
            <p>
              Full undo stack with batch support. Every slider drag, color pick,
              or value change is reversible. Redo support with{" "}
              <kbd>Cmd+Shift+Z</kbd>.
            </p>
          </section>

          {/* ── Session Persistence ── */}
          <section id="session" className={styles.featureSection}>
            <h2>Session Persistence</h2>
            <p>
              Override state is serialized to <code>localStorage</code> keyed by
              pathname. Unsaved changes survive page refreshes and HMR reloads.
            </p>
          </section>

          {/* ── Visual Overlays ── */}
          <section id="overlays" className={styles.featureSection}>
            <h2>Visual Overlays</h2>
            <p>
              <strong>Grid overlay</strong> — grid lines, track numbers, and gap
              regions for CSS Grid elements.
              <br />
              <strong>Flex gap overlay</strong> — visualizes flex gap spacing with
              hatched fill.
              <br />
              <strong>Spacing guides</strong> — margin and padding zone
              visualization.
              <br />
              <strong>Box model overlay</strong> — highlights
              content/padding/border/margin boxes.
            </p>
          </section>

          {/* ── Commit Flow ── */}
          <section id="commit" className={styles.featureSection}>
            <h2>Commit Flow</h2>
            <p>
              Save writes changes back to source files:
            </p>
            <ol style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: 20, marginBottom: 16 }}>
              <li>Traces the CSS property to its source file via CSS source maps</li>
              <li>Finds the exact line with a tiered search strategy</li>
              <li>Performs a surgical string replacement</li>
              <li>Next.js HMR picks up the change — the page updates instantly</li>
            </ol>
            <p>
              Supports CSS Modules (<code>.module.css</code>,{" "}
              <code>.module.scss</code>) and Tailwind CSS projects.
            </p>
          </section>

          {/* ── Copy / Export ── */}
          <section id="copy" className={styles.featureSection}>
            <h2>Copy / Export</h2>
            <p>
              <strong>Copy CSS</strong> — clean CSS rule block with your changes.
              <br />
              <strong>Copy as Variables</strong> — exports as CSS custom
              properties.
              <br />
              <strong>Copy as Tailwind</strong> — formats as Tailwind utility
              classes.
              <br />
              <strong>Diff view</strong> — before/after for every changed
              property.
            </p>
          </section>

          {/* ── Keyboard Shortcuts ── */}
          <section id="shortcuts" className={styles.featureSection}>
            <h2>Keyboard Shortcuts</h2>
            <table className={styles.shortcutsTable}>
              <tbody>
                {shortcuts.map(([key, action]) => (
                  <tr key={key}>
                    <td><kbd>{key}</kbd></td>
                    <td>{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── Label-Drag Scrubbing ── */}
          <section id="scrubbing" className={styles.featureSection}>
            <h2>Label-Drag Scrubbing</h2>
            <p>
              Click and drag on any property label (e.g. the word "Width") to
              scrub its value — the same signature interaction from Webflow. Hold{" "}
              <kbd>Shift</kbd> for 10x speed, <kbd>Alt</kbd> for 0.1x fine
              control.
            </p>
          </section>

          <footer className={styles.docsFooter}>
            MIT License &middot;{" "}
            <a
              href="https://github.com/SkylarKitchen/redial"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </footer>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify all pages build**

Run: `cd /Users/skylar/code/redial/test-app && npx next build --no-lint 2>&1 | tail -10`

Expected: Build succeeds, `/`, `/install`, `/features` all listed

**Step 3: Commit**

```bash
git add test-app/app/features/page.tsx
git commit -m "feat: add features docs page"
```

---

### Task 6: Visual verification and polish

**Step 1: Start dev server and check all 3 pages**

Run: `cd /Users/skylar/code/redial/test-app && npm run dev`

Check in browser:
- `http://localhost:3000` — landing page with hero, steps, stats, features grid
- `http://localhost:3000/install` — sidebar + 3-step setup guide
- `http://localhost:3000/features` — sidebar + all feature sections

**Step 2: Verify Redial panel works on docs pages**

Press backtick on any docs page — the panel should appear and let you tune the docs elements.

**Step 3: Fix any visual issues found during review**

Adjust spacing, colors, or layout as needed.

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete docs site — landing, install, features pages"
```
