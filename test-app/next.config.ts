import type { NextConfig } from "next";
import path from "path";
// Since this is a local dev test app, import directly from source.
// The parent next-plugin.js can't be required directly because the parent
// package.json has "type": "module", so we use a local CJS copy.
const withTuner = require("./with-tuner.cjs");

const nextConfig: NextConfig = {
  devIndicators: false,
  turbopack: {
    root: path.resolve(__dirname, ".."),
    resolveAlias: {
      // Redial source uses @/* → src/*; map it for Turbopack
      "@": path.resolve(__dirname, "../src"),
    },
  },
};

export default withTuner(nextConfig);
