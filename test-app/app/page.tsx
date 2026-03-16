import Link from "next/link";
import DocsNav from "./components/DocsNav";
import styles from "./docs.module.scss";

export default function Home() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContent} style={{ paddingTop: 136 }}>
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
          {/* CTA Buttons */}
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
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h3>Press ` (backtick)</h3>
              <p>Enter selection mode</p>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h3>Click any element</h3>
              <p>Panel appears with context-aware controls</p>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h3>Drag sliders, pick colors</h3>
              <p>Changes apply instantly</p>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepContent}>
              <h3>Undo, redo, reset</h3>
              <p>Full undo stack, Alt+click to reset</p>
            </div>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>5</div>
            <div className={styles.stepContent}>
              <h3>Hit Save</h3>
              <p>
                Writes to source files via CSS source maps, HMR reloads
              </p>
            </div>
          </div>
        </div>

        {/* ── Stats Row ── */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>8+1</span>
            <span className={styles.statLabel}>CSS Sections</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>120+</span>
            <span className={styles.statLabel}>Properties</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>0ms</span>
            <span className={styles.statLabel}>Latency</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>HMR</span>
            <span className={styles.statLabel}>Save Target</span>
          </div>
        </div>

        {/* ── Feature Highlights ── */}
        <h2 className={styles.sectionHeading}>Feature highlights</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <h3>Layout</h3>
            <p>Display, flexbox, grid, and alignment controls with visual diagrams.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Spacing</h3>
            <p>Interactive box model for margin and padding on all four sides.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Typography</h3>
            <p>Font family, size, weight, line height, letter spacing, and color.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Backgrounds</h3>
            <p>Solid colors, gradients, and layered backgrounds with live preview.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Borders</h3>
            <p>Width, style, color, and per-corner radius with a visual editor.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Effects</h3>
            <p>Shadows, transforms, transitions, filters, and blend modes.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>CSS Variables</h3>
            <p>Browse, search, and edit custom properties defined in your stylesheets.</p>
          </div>
          <div className={styles.featureCard}>
            <h3>Save to Source</h3>
            <p>Writes changes back to CSS/SCSS source files and triggers HMR reload.</p>
          </div>
        </div>

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
