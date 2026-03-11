import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        {/* Badge — small text + appearance */}
        <span className={styles.badge}>Tuner Test App</span>

        {/* Hero — typography + spacing */}
        <section className={styles.hero}>
          <h1>Click any element to start tuning</h1>
          <p>
            Press the backtick key (`) to enter selection mode. Hover over
            elements to see the indigo outline, then click to open the tuning
            panel.
          </p>
        </section>

        {/* Buttons — typography + appearance + spacing */}
        <div className={styles.buttons}>
          <button className={styles.btnPrimary}>Primary Action</button>
          <button className={styles.btnSecondary}>Secondary</button>
        </div>

        {/* Cards — flex layout + appearance */}
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

        {/* Input — typography + appearance */}
        <div className={styles.inputGroup}>
          <label htmlFor="demo-input">Input Field</label>
          <input
            id="demo-input"
            type="text"
            placeholder="Try tuning this input's styles"
          />
        </div>

        {/* Image — size + appearance */}
        <div className={styles.imageSection}>
          <img
            src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=400&fit=crop"
            alt="Abstract gradient"
          />
        </div>
      </main>
    </div>
  );
}
