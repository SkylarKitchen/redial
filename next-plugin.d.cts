import type { NextConfig } from 'next';

declare function withTuner(nextConfig?: NextConfig): NextConfig;

// Models the CJS runtime shape (next-plugin.cjs assigns both
// `module.exports` and `module.exports.withTuner`) without mixing
// `export =` with other exports, which is illegal TS (TS2309).
declare namespace withTuner {
  export { withTuner };
}

export = withTuner;
