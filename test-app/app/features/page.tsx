import DocsNav from "../components/DocsNav";
import DocsSidebar from "../components/DocsSidebar";
import PageNav from "../components/PageNav";
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

const sidebarSections = [
  {
    title: "Panel",
    links: [
      { id: "sections", label: "CSS Sections" },
      { id: "variables", label: "CSS Variables" },
    ],
  },
  {
    title: "Workflow",
    links: [
      { id: "scoping", label: "Scoping" },
      { id: "state-editing", label: "State Editing" },
      { id: "undo-redo", label: "Undo/Redo" },
      { id: "session", label: "Session Persistence" },
      { id: "overlays", label: "Visual Overlays" },
    ],
  },
  {
    title: "Output",
    links: [
      { id: "commit", label: "Commit Flow" },
      { id: "copy", label: "Copy/Export" },
    ],
  },
  {
    title: "Reference",
    links: [
      { id: "shortcuts", label: "Keyboard Shortcuts" },
      { id: "scrubbing", label: "Label-Drag Scrubbing" },
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContentWithSidebar}>
        <DocsSidebar sections={sidebarSections} />

        <div className={styles.withSidebar}>
          <h1 className={styles.pageTitle}>Features</h1>
          <p className={styles.pageSubtitle}>
            Context-aware controls that read your element&apos;s computed styles
            and save changes directly to source files via HMR.
          </p>

          <section id="sections" className={styles.featureSection}>
            <h2>Panel Sections</h2>
            <p>
              Eight context-aware sections that adapt their controls based on the
              selected element&apos;s current styles and display type.
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

          <section id="variables" className={styles.featureSection}>
            <h2>CSS Variables</h2>
            <p>
              Automatically discovers --var() tokens used by the selected element
              and groups them into collections. Edit variable values in place,
              link colors to tokens, and see all references update live.
            </p>
          </section>

          <section id="scoping" className={styles.featureSection}>
            <h2>Scoping</h2>
            <p>
              Choose between element scope (inline styles on one node) and class
              scope (affect every element sharing a CSS class). Scope pills in
              the header show available classes; the breadcrumb displays the DOM
              path to the selected element.
            </p>
          </section>

          <section id="state-editing" className={styles.featureSection}>
            <h2>State Editing</h2>
            <p>
              Preview and edit pseudo-class styles like :hover, :focus, :active,
              and :focus-visible. The panel forces the pseudo-state on the
              element so you can tune it visually without holding the mouse.
            </p>
          </section>

          <section id="undo-redo" className={styles.featureSection}>
            <h2>Undo / Redo</h2>
            <p>
              Full undo stack for every change. Cmd+Z to undo, Cmd+Shift+Z to
              redo. Each property change is a discrete entry, so you can step
              back through granular adjustments.
            </p>
          </section>

          <section id="session" className={styles.featureSection}>
            <h2>Session Persistence</h2>
            <p>
              All unsaved overrides are persisted to localStorage. Your work
              survives page refreshes, HMR reloads, and browser restarts.
              Changes are restored automatically when you reselect the same
              element.
            </p>
          </section>

          <section id="overlays" className={styles.featureSection}>
            <h2>Visual Overlays</h2>
            <p>
              Toggle visual overlays to inspect layout at a glance: Grid lines,
              Flex gap indicators, Spacing guides (margin + padding), and Box
              model highlights.
            </p>
          </section>

          <section id="commit" className={styles.featureSection}>
            <h2>Commit Flow</h2>
            <p>
              Save changes back to your source files without leaving the browser.
              Supports CSS Modules and Tailwind.
            </p>
            <ol className={styles.orderedList}>
              <li>
                Read source maps to locate the original file and line number
              </li>
              <li>Find the matching declaration in the source file</li>
              <li>String-replace the old value with the new one</li>
              <li>Trigger HMR so the browser updates instantly</li>
            </ol>
          </section>

          <section id="copy" className={styles.featureSection}>
            <h2>Copy / Export</h2>
            <p>
              Multiple export formats from the footer dropdown: Copy CSS (raw
              declarations), Copy as Variables (--custom-property format), Copy
              as Tailwind (utility classes), and Diff view (before/after
              comparison).
            </p>
          </section>

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
                    <td>
                      <kbd>{s.key}</kbd>
                    </td>
                    <td>{s.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section id="scrubbing" className={styles.featureSection}>
            <h2>Label-Drag Scrubbing</h2>
            <p>
              Click and drag on any numeric label to scrub its value. Hold Shift
              for 10x speed, or Alt for 0.1x fine-tuning.
            </p>
          </section>

          <PageNav prev={{ href: "/install", label: "Install" }} />

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
