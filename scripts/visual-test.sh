#!/usr/bin/env bash
#
# Run the Playwright visual-regression sweep (tests/visual) inside an
# Orbstack/Docker Linux sandbox.
#
# Why the sandbox: on this macOS host, binary-authorization (Santa) kills a
# Playwright-spawned Chromium (SIGKILL right after launch). Inside the Linux VM
# the browser binaries are not subject to Santa, so they run normally. The
# container mounts the repo (for the pure-JS @playwright/test runner) and uses
# the image's Linux browsers (PLAYWRIGHT_BROWSERS_PATH=/ms-playwright).
#
# The dev server runs on the HOST (not the container) and is reached over
# host.docker.internal. Start it first:
#
#     npm --prefix test-app run dev      # serves http://localhost:3000
#     npm run test:visual                # in another terminal
#
# Pass extra Playwright args through, e.g.:  npm run test:visual -- panel-states
#
# CI (Linux, no Santa) should use `npm run test:visual:ci` instead, which lets
# Playwright start the dev server itself (see playwright.config.ts webServer).
set -euo pipefail

# Keep this tag in sync with the @playwright/test version in package.json.
IMAGE="mcr.microsoft.com/playwright:v1.60.0-noble"
PORT="${PORT:-3000}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

exec docker run --rm --add-host=host.docker.internal:host-gateway \
  -v "${REPO_ROOT}":/work -w /work \
  -e BASE_URL="http://host.docker.internal:${PORT}" \
  -e PW_NO_SERVER=1 \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
  "${IMAGE}" \
  npx playwright test "$@"
