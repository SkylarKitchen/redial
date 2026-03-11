// Allow CSS imports in TypeScript (handled by consumer's bundler)
declare module "*.css" {
  const content: string;
  export default content;
}

declare module "dialkit/styles.css" {
  const content: string;
  export default content;
}

// HMR types for Turbopack / Vite / webpack
interface ImportMetaHot {
  on(event: string, cb: (...args: any[]) => void): void;
  off?(event: string, cb: (...args: any[]) => void): void;
  dispose(cb: () => void): void;
  accept(cb?: () => void): void;
}

interface ImportMeta {
  hot?: ImportMetaHot;
}
