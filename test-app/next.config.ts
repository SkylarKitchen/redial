import type { NextConfig } from "next";
// Since this is a local dev test app, import directly from source.
// The parent next-plugin.js can't be required directly because the parent
// package.json has "type": "module", so we use a local CJS copy.
const withTuner = require("./with-tuner.cjs");

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
};

export default withTuner(nextConfig);
