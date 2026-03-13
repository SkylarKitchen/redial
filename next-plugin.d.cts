import type { NextConfig } from 'next';

declare function withTuner(nextConfig?: NextConfig): NextConfig;

export = withTuner;
export { withTuner };
