import { defineConfig } from "tsup";

export default defineConfig((options) => ({
  entry: ["src/index.tsx"],
  format: ["esm"],
  dts: !options.watch,
  splitting: false,
  sourcemap: true,
  clean: !options.watch,
  external: ["react", "react-dom", "next"],
  esbuildOptions(esbuildOpts) {
    esbuildOpts.jsx = "automatic";
  },
}));
