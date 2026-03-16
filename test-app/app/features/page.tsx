import DocsNav from "../components/DocsNav";
import styles from "../docs.module.scss";

const panelSections = [
  {
    name: "Layout",
    desc: "display, flex-direction, justify-content, align-items, gap, flex-wrap. 3x3 alignment grid, display type selector.",
  },
  {
    name: "Spacing",
    desc: "margin-*, padding-*. Visual box model diagram with click-to-edit values.",
  },
  {
    name: "Size",
    desc: "width, height, min-*, max-*, overflow, object-fit. Sliders with unit selectors (px, %, vw, vh, em, rem).",
  },
  {
    name: "Position",
    desc: "position, top/right/bottom/left, z-index. Visual offset diagram, contextual controls.",
  },
  {
    name: "Typography",
    desc: "font-size, weight, line-height, letter-spacing, color, text-align. Color picker, font selector.",
  },
  {
    name: "Backgrounds",
    desc: "background-color, gradients. Multi-layer support, gradient editor, color picker with opacity.",
  },
  {
    name: "Borders",
    desc: "border-*, border-radius. Side selector tabs, linked/unlinked corner radius, color picker.",
  },
  {
    name: "Effects",
    desc: "opacity, box-shadow, transform, filter, backdrop-filter, transitions. Dedicated sub-editors for each.",
  },
];

const shortcuts = [
  { key: "`", action: "Toggle selection mode" },
  { key: "Esc", action: "Close panel / cancel selection" },
  { key: "Cmd+Z", action: "Undo" },
  { key: "Cmd+Shift+Z", action: "Redo" },
  { key: "Cmd+S", action: "Save changes to source files" },
  { key: "Cmd+C", action: "Copy CSS" },
  { key: "Cmd+K", action: "Command palette" },
  { key: "D (hold)", action: "Diff peek" },
  { key: "S", action: "Cycle scope" },
  { key: "R", action: "Reset current element" },
  { key: "Arrow Up/Down", action: "Navigate sections" },
  { key: "Tab", action: "Move between controls" },
];

export default function FeaturesPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContentWithSidebar}>
        {/* ── Sidebar ── */}
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
            <a href="#undo-redo" className={styles.sidebarLink}>Undo/Redo</a>
            <a href="#session" className={styles.sidebarLink}>Session Persistence</a>
            <a href="#overlays" className={styles.sidebarLink}>Visual Overlays</a>
          </div>
          <div className={styles.sidebarSection}>
            <h4>Output</h4>
            <a href="#commit" className={styles.sidebarLink}>Commit Flow</a>
            <a href="#copy" className={styles.sidebarLink}>Copy/Export</a>
          </div>
          <div className={styles.sidebarSection}>
            <h4>Reference</h4>
            <a href="#shortcuts" className={styles.sidebarLink}>Keyboard Shortcuts</a>
            <a href="#scrubbing" className={styles.sidebarLink}>Label-Drag Scrubbing</a>
          </div>
        </aside>

        {/* ── Content ── */}
        <div className={styles.withSidebar} style={{ paddingTop: 56 }}>
          {/* Page Header */}
          <h1 className={styles.pageTitle}>Features</h1>
          <p className={styles.pageSubtitle}>
            Context-aware controls that read your element's computed styles and
            save changes directly to source files via HMR.
          </p>

          {/* Panel Sections */}
          <section id="sections" className={styles.featureSection}>
            <h2>Panel Sections</h2>
            <p>
              Eight context-aware sections that adapt their controls based on the
              selected element's current styles and display type.
            </p>
            <div className={styles.panelSectionGrid}>
              {panelSections.map((s) => (
                <div key={s.name} className={styles.panelSectionCard}>
                  <h4>{s.name}</h4>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CSS Variables */}
          <section id="variables" className={styles.featureSection}>
            <h2>CSS Variables</h2>
            <p>
              Automatically discovers --var() tokens used by the selected element
              and groups them into collections. Edit variable values in place,
              link colors to tokens, and see all references update live.
            </p>
          </section>

          {/* Scoping */}
          <section id="scoping" className={styles.featureSection}>
            <h2>Scoping</h2>
            <p>
              Choose between element scope (inline styles on one node) and class
              scope (affect every element sharing a CSS class). Scope pills in
              the header show available classes; the breadcrumb displays the DOM
              path to the selected element.
            </p>
          </section>

          {/* State Editing */}
          <section id="state-editing" className={styles.featureSection}>
            <h2>State Editing</h2>
            <p>
              Preview and edit pseudo-class styles like :hover, :focus,
              :active, and :focus-visible. The panel forces the pseudo-state on
              the element so you can tune it visually without holding the mouse.
            </p>
          </section>

          {/* Undo/Redo */}
          <section id="undo-redo" className={styles.featureSection}>
            <h2>Undo / Redo</h2>
            <p>
              Full undo stack for every change. Cmd+Z to undo,
              Cmd+Shift+Z to redo. Each property change is a discrete entry,
              so you can step back through granular adjustments.
            </p>
          </section>

          {/* Session Persistence */}
          <section id="session" className={styles.featureSection}>
            <h2>Session Persistence</h2>
            <p>
              All unsaved overrides are persisted to localStorage. Your work
              survives page refreshes, HMR reloads, and browser restarts. Changes
              are restored automatically when you reselect the same element.
            </p>
          </section>

          {/* Visual Overlays */}
          <section id="overlays" className={styles.featureSection}>
            <h2>Visual Overlays</h2>
            <p>
              Toggle visual overlays to inspect layout at a glance: Grid lines,
              Flex gap indicators, Spacing guides (margin + padding), and Box
              model highlights.
            </p>
          </section>

          {/* Commit Flow */}
          <section id="commit" className={styles.featureSection}>
            <h2>Commit Flow</h2>
            <p>
              Save changes back to your source files without leaving the
              browser. Supports CSS Modules and Tailwind.
            </p>
            <ol style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: 20, marginBottom: 16 }}>
              <li>Read source maps to locate the original file and line number</li>
              <li>Find the matching declaration in the source file</li>
              <li>String-replace the old value with the new one</li>
              <li>Trigger HMR so the browser updates instantly</li>
            </ol>
          </section>

          {/* Copy/Export */}
          <section id="copy" className={styles.featureSection}>
            <h2>Copy / Export</h2>
            <p>
              Multiple export formats from the footer dropdown: Copy CSS (raw
              declarations), Copy as Variables (--custom-property format), Copy
              as Tailwind (utility classes), and Diff view (before/after
              comparison).
            </p>
          </section>

          {/* Keyboard Shortcuts */}
          <section id="shortcuts" className={styles.featureSection}>
            <h2>Keyboard Shortcuts</h2>
            <table className={styles.shortcutsTable}>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {shortcuts.map((s) => (
                  <tr key={s.key}>
                    <td><kbd>{s.key}</kbd></td>
                    <td>{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Label-Drag Scrubbing */}
          <section id="scrubbing" className={styles.featureSection}>
            <h2>Label-Drag Scrubbing</h2>
            <p>
              Click and drag on any numeric label to scrub its value. Hold
              Shift for 10x speed, or Alt for 0.1x fine-tuning.
            </p>
          </section>

          {/* Footer */}
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
    </div>
  );
}
