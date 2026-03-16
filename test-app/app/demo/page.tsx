"use client";

import { useEffect } from "react";
import styles from "../page.module.scss";

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
