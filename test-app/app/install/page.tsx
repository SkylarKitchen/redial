import DocsNav from "../components/DocsNav";
import styles from "../docs.module.scss";

export default function InstallPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContentWithSidebar}>
        {/* Sidebar */}
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

        {/* Content */}
        <div className={styles.withSidebar} style={{ paddingTop: 56 }}>
          <h1 className={styles.pageTitle}>Install</h1>
          <p className={styles.pageSubtitle}>
            Three steps to add Redial to any Next.js project.
          </p>

          {/* Install */}
          <section id="install" className={styles.contentSection}>
            <h2>Install</h2>
            <p>Add Redial to your project from GitHub:</p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>npm install github:SkylarKitchen/redial</code>
            </pre>
          </section>

          {/* Step 1: Next.js Plugin */}
          <section id="next-plugin" className={styles.contentSection}>
            <h2>Step 1: Next.js Plugin</h2>
            <p>
              Wrap your Next.js config with the Redial plugin. This injects the
              necessary Webpack configuration for source-file commits and HMR.
            </p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>{`// next.config.js
const withTuner = require("redial/next-plugin");

module.exports = withTuner({
  // your existing Next.js config
});`}</code>
            </pre>
          </section>

          {/* Step 2: API Route */}
          <section id="api-route" className={styles.contentSection}>
            <h2>Step 2: API Route</h2>
            <p>
              Create an API route so Redial can write style changes back to your
              source files.
            </p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>{`// app/api/tuner/[...path]/route.ts
export { GET, POST } from "redial/server";`}</code>
            </pre>
          </section>

          {/* Step 3: Component */}
          <section id="component" className={styles.contentSection}>
            <h2>Step 3: Component</h2>
            <p>
              Add the Tuner component to your root layout. It renders the
              floating panel and is only active in development.
            </p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>{`// app/layout.tsx
import { Tuner } from "redial";
import "redial/styles.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Tuner />
      </body>
    </html>
  );
}`}</code>
            </pre>
          </section>

          {/* Configuration */}
          <section id="configuration" className={styles.contentSection}>
            <h2>Configuration</h2>
            <p>
              Pass props to the Tuner component to customize behavior:
            </p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>{`<Tuner commitEndpoint="/api/tuner" />`}</code>
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
                  <td>Base path for the API route that writes changes to source files</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Exports */}
          <section id="exports" className={styles.contentSection}>
            <h2>Exports</h2>
            <p>Everything Redial exposes:</p>
            <pre className={styles.codeBlockMulti} style={{ whiteSpace: "pre" }}>
              <code>{`import { Tuner } from "redial";          // React component
import { configure } from "redial";       // runtime config
import "redial/styles.css";               // panel stylesheet
export { GET, POST } from "redial/server"; // API handlers
const withTuner = require("redial/next-plugin"); // Webpack plugin`}</code>
            </pre>
          </section>

          {/* Requirements */}
          <section id="requirements" className={styles.contentSection}>
            <h2>Requirements</h2>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Dependency</th>
                  <th>Minimum Version</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>Next.js</code></td>
                  <td>{"\u2265"}13</td>
                </tr>
                <tr>
                  <td><code>React</code></td>
                  <td>{"\u2265"}18</td>
                </tr>
                <tr>
                  <td><code>Node.js</code></td>
                  <td>{"\u2265"}18</td>
                </tr>
              </tbody>
            </table>
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
