import styles from "./page.module.scss";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* ── Navigation ── */}
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

        {/* ── Badge ── */}
        <span className={styles.badge}>Tuner Test App</span>

        {/* ── Hero ── */}
        <section className={styles.hero}>
          <h1>Click any element to start tuning</h1>
          <p>
            Press the backtick key (`) to enter selection mode. Hover over
            elements to see the indigo outline, then click to open the tuning
            panel.
          </p>
          <div className={styles.buttons}>
            <button className={styles.btnPrimary}>Primary Action</button>
            <button className={styles.btnSecondary}>Secondary</button>
            <button className={styles.btnGhost}>Ghost</button>
          </div>
        </section>

        {/* ── Feature Cards (flex) ── */}
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

        {/* ── Image Gallery (grid) ── */}
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

        {/* ── Testimonial ── */}
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

        {/* ── Stats Row ── */}
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

        {/* ── Tags / Pills ── */}
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

        {/* ── Form Elements ── */}
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
            <div className={styles.checkboxRow}>
              <input id="agree" type="checkbox" />
              <label htmlFor="agree">I agree to the terms</label>
            </div>
          </div>
        </section>

        {/* ── Table ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Data Table</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Property</th>
                <th>Section</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>font-size</td>
                <td>Typography</td>
                <td>Slider</td>
              </tr>
              <tr>
                <td>border-radius</td>
                <td>Appearance</td>
                <td>Slider</td>
              </tr>
              <tr>
                <td>background-color</td>
                <td>Backgrounds</td>
                <td>Color Picker</td>
              </tr>
              <tr>
                <td>box-shadow</td>
                <td>Shadows</td>
                <td>Shadow Editor</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* ── Callout / Alert ── */}
        <section className={styles.section}>
          <div className={styles.callout}>
            <strong>Tip:</strong> You can also use keyboard shortcuts to adjust values. Arrow keys nudge by 1, Shift+Arrow by 10.
          </div>
          <div className={styles.calloutWarning}>
            <strong>Note:</strong> Inline style changes are temporary until you click Save to write them back to source.
          </div>
        </section>

        {/* ── Pricing Cards (grid) ── */}
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

        {/* ── Progress Bars ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Progress</h2>
          <div className={styles.progressGroup}>
            <div className={styles.progressRow}>
              <span>Phase A</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "85%" }} />
              </div>
            </div>
            <div className={styles.progressRow}>
              <span>Phase B</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "40%" }} />
              </div>
            </div>
            <div className={styles.progressRow}>
              <span>Phase C</span>
              <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "10%" }} />
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
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
