"use client";

import { useEffect } from "react";
import styles from "../page.module.css";

/**
 * Demo page — auto-opens the real Tuner panel on a sample element.
 *
 * Uses the `tuner:select` custom event to programmatically select
 * the hero heading on mount, so visitors see the real panel immediately.
 * All panel components rendered here are the actual production components
 * (via Overlay mounted in layout.tsx), so there's nothing to keep in sync.
 */
export default function DemoPage() {
  useEffect(() => {
    // Small delay to let Overlay mount and the DOM settle
    const timer = setTimeout(() => {
      const target = document.querySelector("[data-tuner-demo]");
      if (target) {
        document.dispatchEvent(
          new CustomEvent("tuner:select", { detail: target })
        );
      }
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.page}>
      {/* Design system variables — injected via <style> to bypass Tailwind/LightningCSS tree-shaking */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          /* ── Colors — Brand ─────────────── */
          --color-brand-50: #eff6ff;
          --color-brand-100: #dbeafe;
          --color-brand-200: #bfdbfe;
          --color-brand-300: #93c5fd;
          --color-brand-400: #60a5fa;
          --color-brand-500: #3b82f6;
          --color-brand-600: #2563eb;
          --color-brand-700: #1d4ed8;
          --color-brand-800: #1e40af;
          --color-brand-900: #1e3a8a;

          /* ── Colors — Neutral ───────────── */
          --color-neutral-50: #fafafa;
          --color-neutral-100: #f5f5f5;
          --color-neutral-200: #e5e5e5;
          --color-neutral-300: #d4d4d4;
          --color-neutral-400: #a3a3a3;
          --color-neutral-500: #737373;
          --color-neutral-600: #525252;
          --color-neutral-700: #404040;
          --color-neutral-800: #262626;
          --color-neutral-900: #171717;

          /* ── Colors — Semantic ──────────── */
          --color-success: #22c55e;
          --color-success-light: #bbf7d0;
          --color-warning: #f59e0b;
          --color-warning-light: #fef3c7;
          --color-error: #ef4444;
          --color-error-light: #fecaca;
          --color-info: #3b82f6;
          --color-info-light: #dbeafe;

          /* ── Colors — Surface ───────────── */
          --surface-primary: #ffffff;
          --surface-secondary: #fafafa;
          --surface-tertiary: #f5f5f5;
          --surface-elevated: #ffffff;
          --surface-overlay: rgba(0, 0, 0, 0.5);
          --surface-inverse: #171717;

          /* ── Spacing ────────────────────── */
          --space-1: 4px;
          --space-2: 8px;
          --space-3: 12px;
          --space-4: 16px;
          --space-5: 20px;
          --space-6: 24px;
          --space-8: 32px;
          --space-10: 40px;
          --space-12: 48px;
          --space-16: 64px;
          --space-20: 80px;
          --space-24: 96px;

          /* ── Typography — Font Size ─────── */
          --font-size-xs: 12px;
          --font-size-sm: 14px;
          --font-size-base: 16px;
          --font-size-lg: 18px;
          --font-size-xl: 20px;
          --font-size-2xl: 24px;
          --font-size-3xl: 30px;
          --font-size-4xl: 36px;
          --font-size-5xl: 48px;

          /* ── Typography — Line Height ───── */
          --line-height-tight: 1.25;
          --line-height-normal: 1.5;
          --line-height-relaxed: 1.75;
          --line-height-loose: 2;

          /* ── Typography — Letter Spacing ── */
          --letter-spacing-tight: -0.025em;
          --letter-spacing-normal: 0em;
          --letter-spacing-wide: 0.025em;
          --letter-spacing-wider: 0.05em;

          /* ── Typography — Font Weight ───── */
          --font-weight-normal: 400;
          --font-weight-medium: 500;
          --font-weight-semibold: 600;
          --font-weight-bold: 700;

          /* ── Border Radius ──────────────── */
          --radius-sm: 4px;
          --radius-md: 6px;
          --radius-lg: 8px;
          --radius-xl: 12px;
          --radius-2xl: 16px;
          --radius-full: 9999px;

          /* ── Border Width ───────────────── */
          --border-width-thin: 1px;
          --border-width-medium: 2px;
          --border-width-thick: 4px;

          /* ── Container Widths ───────────── */
          --container-sm: 640px;
          --container-md: 768px;
          --container-lg: 1024px;
          --container-xl: 1280px;
        }
      `}} />
      <main className={styles.main}>
        {/* Navigation */}
        <nav className={styles.nav}>
          <span className={styles.logo}>Redial</span>
          <div className={styles.navLinks}>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Docs</a>
            <a href="#">Blog</a>
          </div>
          <button className={styles.btnPrimary}>Get Started</button>
        </nav>

        {/* Hero — this is the auto-selected element */}
        <section className={styles.hero}>
          <h1 data-tuner-demo>The real panel, on real elements</h1>
          <p>
            This page auto-opens the Tuner panel on the heading above.
            Every control you see is the actual production component —
            sliders, color pickers, spacing box, sections — all live.
            Press backtick (`) to select a different element.
          </p>
          <div className={styles.buttons}>
            <button className={styles.btnPrimary}>Primary Action</button>
            <button className={styles.btnSecondary}>Secondary</button>
            <button className={styles.btnGhost}>Ghost</button>
          </div>
        </section>

        {/* Feature Cards (flex) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Feature Cards</h2>
          <div className={styles.cards}>
            <div className={styles.card}>
              <h3>Typography</h3>
              <p>Font size, weight, line height, letter spacing, and color.</p>
            </div>
            <div className={styles.card}>
              <h3>Spacing</h3>
              <p>Padding and margin for all four sides with live preview.</p>
            </div>
            <div className={styles.card}>
              <h3>Appearance</h3>
              <p>Background color, border radius, opacity, and borders.</p>
            </div>
          </div>
        </section>

        {/* Image Gallery (grid) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Image Gallery</h2>
          <div className={styles.gallery}>
            <img
              className={styles.galleryImgLarge}
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=600&fit=crop"
              alt="Abstract gradient"
            />
            <img
              className={styles.galleryImg}
              src="https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=400&h=300&fit=crop"
              alt="Colorful abstract"
            />
            <img
              className={styles.galleryImg}
              src="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=400&h=300&fit=crop"
              alt="Gradient mesh"
            />
          </div>
        </section>

        {/* Testimonial */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Testimonial</h2>
          <blockquote className={styles.testimonial}>
            <p>&ldquo;This is exactly the kind of tool I&rsquo;ve been waiting for. The ability to visually tune any CSS property and save it back to source is a game changer.&rdquo;</p>
            <footer className={styles.testimonialAuthor}>
              <div className={styles.avatar} />
              <div>
                <strong>Jane Cooper</strong>
                <span>Staff Engineer, Acme Inc.</span>
              </div>
            </footer>
          </blockquote>
        </section>

        {/* Stats Row */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Stats</h2>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.statNumber}>13</span>
              <span className={styles.statLabel}>CSS Sections</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>120+</span>
              <span className={styles.statLabel}>Properties</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>0ms</span>
              <span className={styles.statLabel}>Latency</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statNumber}>HMR</span>
              <span className={styles.statLabel}>Save Target</span>
            </div>
          </div>
        </section>

        {/* Tags / Pills */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tags</h2>
          <div className={styles.tags}>
            <span className={styles.tag}>React</span>
            <span className={styles.tag}>Next.js</span>
            <span className={styles.tag}>CSS</span>
            <span className={styles.tag}>TypeScript</span>
            <span className={styles.tagAccent}>New</span>
            <span className={styles.tagAccent}>Beta</span>
          </div>
        </section>

        {/* Form Elements */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Form Elements</h2>
          <div className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="name">Name</label>
              <input id="name" type="text" placeholder="Enter your name" />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className={styles.inputGroup}>
              <label htmlFor="message">Message</label>
              <textarea id="message" rows={3} placeholder="Write something..." />
            </div>
          </div>
        </section>

        {/* Pricing Cards (grid) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Pricing</h2>
          <div className={styles.pricing}>
            <div className={styles.pricingCard}>
              <h3>Free</h3>
              <div className={styles.price}>$0</div>
              <ul>
                <li>3 projects</li>
                <li>Basic controls</li>
                <li>Community support</li>
              </ul>
              <button className={styles.btnSecondary}>Get Started</button>
            </div>
            <div className={`${styles.pricingCard} ${styles.pricingFeatured}`}>
              <h3>Pro</h3>
              <div className={styles.price}>$19</div>
              <ul>
                <li>Unlimited projects</li>
                <li>All controls</li>
                <li>Priority support</li>
                <li>Custom themes</li>
              </ul>
              <button className={styles.btnPrimary}>Upgrade</button>
            </div>
            <div className={styles.pricingCard}>
              <h3>Team</h3>
              <div className={styles.price}>$49</div>
              <ul>
                <li>Everything in Pro</li>
                <li>Team sharing</li>
                <li>Admin dashboard</li>
              </ul>
              <button className={styles.btnSecondary}>Contact Us</button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerCol}>
            <h4>Product</h4>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">Changelog</a>
          </div>
          <div className={styles.footerCol}>
            <h4>Resources</h4>
            <a href="#">Docs</a>
            <a href="#">Guides</a>
            <a href="#">API</a>
          </div>
          <div className={styles.footerCol}>
            <h4>Company</h4>
            <a href="#">About</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
          </div>
          <div className={styles.footerCol}>
            <h4>Legal</h4>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">License</a>
          </div>
        </footer>
      </main>
    </div>
  );
}
