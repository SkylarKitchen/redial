# Redial

A floating Webflow-style CSS tuning panel for Next.js. Click any element, get context-aware controls, drag to tune, save to source files via HMR.

DevTools changes vanish on reload. AI coding tools add minutes of latency per visual tweak. Redial gives you the direct-manipulation workflow that Webflow proved essential — but for your own Next.js codebase, writing changes straight to your source files.

**Status: Pre-release — API may change.**

## Install

```sh
npm install redial
```

## Setup

### 1. Add the Next.js plugin

```js
// next.config.js
const withTuner = require("redial/next-plugin");

module.exports = withTuner({
  // your existing config
});
```

### 2. Add the API route

```ts
// app/api/tuner/[...path]/route.ts
export { GET, POST } from "redial/server";
```

### 3. Add the component

```tsx
// app/layout.tsx
import { Tuner } from "redial";
import "redial/styles.css";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Tuner />}
      </body>
    </html>
  );
}
```

## Usage

Press the hotkey to enter selection mode. Click any element to open the panel. Drag sliders to adjust CSS properties. Changes save directly to your source files.

## License

MIT
