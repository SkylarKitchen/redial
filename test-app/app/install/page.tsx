import DocsNav from "../components/DocsNav";
import DocsSidebar from "../components/DocsSidebar";
import PageNav from "../components/PageNav";
import styles from "../docs.module.scss";

const sidebarSections = [
  {
    title: "Setup",
    links: [
      { id: "install", label: "Install" },
      { id: "next-plugin", label: "Next.js Plugin" },
      { id: "api-route", label: "API Route" },
      { id: "component", label: "Component" },
    ],
  },
  {
    title: "Reference",
    links: [
      { id: "configuration", label: "Configuration" },
      { id: "exports", label: "Exports" },
      { id: "requirements", label: "Requirements" },
    ],
  },
];

export default function InstallPage() {
  return (
    <div className={styles.docsPage}>
      <DocsNav />
      <div className={styles.docsContentWithSidebar}>
        <DocsSidebar sections={sidebarSections} />

        <div className={styles.withSidebar}>
          <h1 className={styles.pageTitle}>Install</h1>
          <p className={styles.pageSubtitle}>
            Three steps to add Redial to any Next.js project.
          </p>

          <section id="install" className={styles.contentSection}>
            <h2>§1 Install</h2>
            <p>Add Redial to your project from GitHub:</p>
            <pre className={styles.codeBlockMulti}>
              <code>npm install github:SkylarKitchen/redial</code>
            </pre>
          </section>

          <hr className={styles.rule} />
          <section id="next-plugin" className={styles.contentSection}>
            <h2>§2 Next.js Plugin</h2>
            <p>
              Wrap your Next.js config with the Redial plugin. This injects the
              necessary Webpack configuration for source-file commits and HMR.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// next.config.js
const withTuner = require("redial/next-plugin");

module.exports = withTuner({
  // your existing Next.js config
});`}
            </pre>
          </section>

          <hr className={styles.rule} />
          <section id="api-route" className={styles.contentSection}>
            <h2>§3 API Route</h2>
            <p>
              Create an API route so Redial can write style changes back to your
              source files.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// app/api/tuner/[...path]/route.ts
export { GET, POST } from "redial/server";`}
            </pre>
          </section>

          <hr className={styles.rule} />
          <section id="component" className={styles.contentSection}>
            <h2>§4 Component</h2>
            <p>
              Add the Tuner component to your root layout. It renders the
              floating panel and is only active in development.
            </p>
            <pre className={styles.codeBlockMulti}>
{`// app/layout.tsx
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
}`}
            </pre>
          </section>

          <hr className={styles.rule} />
          <section id="configuration" className={styles.contentSection}>
            <h2>§5 Configuration</h2>
            <p>Pass props to the Tuner component to customize behavior:</p>
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
                  <td>
                    <code>commitEndpoint</code>
                  </td>
                  <td>
                    <code>string</code>
                  </td>
                  <td>
                    <code>{`"/api/tuner"`}</code>
                  </td>
                  <td>
                    Base path for the API route that writes changes to source
                    files
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <hr className={styles.rule} />
          <section id="exports" className={styles.contentSection}>
            <h2>§6 Exports</h2>
            <p>Everything Redial exposes:</p>
            <pre className={styles.codeBlockMulti}>
{`import { Tuner } from "redial";              // React component
import { configure } from "redial";           // runtime config
import "redial/styles.css";                   // panel stylesheet
export { GET, POST } from "redial/server";    // API handlers
const withTuner = require("redial/next-plugin"); // Webpack plugin`}
            </pre>
          </section>

          <hr className={styles.rule} />
          <section id="requirements" className={styles.contentSection}>
            <h2>§7 Requirements</h2>
            <table className={styles.propsTable}>
              <thead>
                <tr>
                  <th>Dependency</th>
                  <th>Minimum Version</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <code>Next.js</code>
                  </td>
                  <td>{"\u2265"}13</td>
                </tr>
                <tr>
                  <td>
                    <code>React</code>
                  </td>
                  <td>{"\u2265"}18</td>
                </tr>
                <tr>
                  <td>
                    <code>Node.js</code>
                  </td>
                  <td>{"\u2265"}18</td>
                </tr>
              </tbody>
            </table>
          </section>

          <PageNav
            prev={{ href: "/", label: "Overview" }}
            next={{ href: "/features", label: "Features" }}
          />

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
