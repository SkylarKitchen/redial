/**
 * Local CJS wrapper for the parent next-plugin.
 * The parent package uses "type": "module", so next-plugin.js can't be
 * required directly. This .cjs file is always treated as CommonJS.
 */

const path = require("path");

/** @param {import('next').NextConfig} nextConfig */
function withTuner(nextConfig = {}) {
  return {
    ...nextConfig,

    webpack(config, options) {
      // Enable CSS source maps in dev for source file resolution
      if (options.dev && !options.isServer) {
        if (!config.devtool || config.devtool === "eval") {
          config.devtool = "eval-source-map";
        }

        // Prevent webpack from watching generated/tooling dirs in parent root.
        // webpack's `ignored` is string | string[] | RegExp — a RegExp (Next 16's
        // dev default) can't be spread or mixed into a string array, so keep it.
        const parentRoot = path.resolve(__dirname, "..");
        const prevIgnored = config.watchOptions?.ignored;
        config.watchOptions = {
          ...config.watchOptions,
          ignored:
            prevIgnored instanceof RegExp
              ? prevIgnored
              : [
                  ...(Array.isArray(prevIgnored)
                    ? prevIgnored
                    : prevIgnored
                      ? [prevIgnored]
                      : []),
                  path.join(parentRoot, ".claude", "**"),
                  path.join(parentRoot, ".git", "**"),
                  "**/node_modules/**",
                ],
        };
      }

      // Call user's webpack config if provided
      if (typeof nextConfig.webpack === "function") {
        return nextConfig.webpack(config, options);
      }

      return config;
    },
  };
}

module.exports = withTuner;
module.exports.withTuner = withTuner;
