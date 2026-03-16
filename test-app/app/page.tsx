import Link from "next/link";
import DocsNav from "./components/DocsNav";
import PageNav from "./components/PageNav";
import styles from "./docs.module.scss";

export default function Home() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContent}>
        {/* ── Hero ── */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>Visual CSS tuning for Next.js</h1>
          <p className={styles.heroSubtitle}>
            Click any element, drag sliders and pick colors, then save changes
            straight to your source files. Zero config, full undo stack, instant
            HMR reload.
          </p>
          <div className={styles.installSnippet}>
            <div className={styles.codeBlock}>
              <code>npm install github:SkylarKitchen/redial</code>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
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

        {/* ── How It Works ── */}
        <h2 className={styles.sectionHeading}>How it works</h2>
        <div className={styles.steps}>
          {[
            ["Press ` (backtick)", "Enter selection mode"],
            ["Click any element", "Panel appears with context-aware controls"],
            ["Drag sliders, pick colors", "Changes apply instantly"],
            ["Undo, redo, reset", "Full undo stack, Alt+click to reset"],
            [
              "Hit Save",
              "Writes to source files via CSS source maps, HMR reloads",
            ],
          ].map(([title, desc], i) => (
            <div key={i} className={styles.step}>
              <div className={styles.stepNumber}>{i + 1}</div>
              <div className={styles.stepContent}>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Stats Row ── */}
        <div className={styles.statsRow}>
          {[
            ["8+1", "CSS Sections"],
            ["120+", "Properties"],
            ["0ms", "Latency"],
            ["HMR", "Save Target"],
          ].map(([value, label]) => (
            <div key={label} className={styles.stat}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>

        {/* ── Feature Highlights ── */}
        <h2 className={styles.sectionHeading}>Feature highlights</h2>
        <div className={styles.featureGrid}>
          {[
            [
              "Layout",
              "Display, flexbox, grid, and alignment controls with visual diagrams.",
            ],
            [
              "Spacing",
              "Interactive box model for margin and padding on all four sides.",
            ],
            [
              "Typography",
              "Font family, size, weight, line height, letter spacing, and color.",
            ],
            [
              "Backgrounds",
              "Solid colors, gradients, and layered backgrounds with live preview.",
            ],
            [
              "Borders",
              "Width, style, color, and per-corner radius with a visual editor.",
            ],
            [
              "Effects",
              "Shadows, transforms, transitions, filters, and blend modes.",
            ],
            [
              "CSS Variables",
              "Browse, search, and edit custom properties defined in your stylesheets.",
            ],
            [
              "Save to Source",
              "Writes changes back to CSS/SCSS source files and triggers HMR reload.",
            ],
          ].map(([title, desc]) => (
            <div key={title} className={styles.featureCard}>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>

        {/* ── Page Nav ── */}
        <PageNav next={{ href: "/install", label: "Install" }} />

        {/* ── Footer ── */}
        <footer className={styles.docsFooter}>
          <p>
            MIT License{" · "}
            <a
              href="https://github.com/SkylarKitchen/redial"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
