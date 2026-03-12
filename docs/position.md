# Why Redial Exists

## The gap Webflow proved matters

Webflow proved something important: designers who think in CSS shouldn't have to leave a visual interface to make visual changes. The gap between seeing what you want and getting it into production should be measured in seconds, not minutes. Drag a slider, see the result, move on. That insight built a company.

But Webflow is a platform — it owns your hosting, your CMS, your deployment pipeline. If you're building in Next.js, you don't get that workflow. You get code. And code is precise, powerful, and painfully slow for the kind of iterative tuning that visual work demands. Adjusting a `letter-spacing` value means opening a file, finding the right line, changing a number, saving, waiting for HMR, checking the result, and repeating. A change that takes two seconds with a slider takes thirty seconds in a text editor — and that adds up across hundreds of micro-decisions that define whether a UI feels polished or just functional.

## What exists today doesn't close the gap

The tools that exist today don't solve this. Browser DevTools let you tweak styles live, but those changes evaporate on reload — they're a debugging tool, not a design tool. Libraries like DialKit and Agitation give you drag-to-tune primitives, but they're building blocks, not workflows. They don't know what CSS properties matter for the element you're looking at. They don't write changes back to your source files. They don't persist anything.

And AI-assisted coding, for all its power, introduces a fundamentally different latency problem: you describe what you want in a prompt, wait for a response, review the output, copy it into your project, check the result, and iterate again if it's wrong. The feedback loop is measured in minutes, not milliseconds. You're communicating through language what your eyes could resolve instantly through direct manipulation.

## What Redial does differently

Redial is the missing layer. You click an element in your running Next.js app, and a Webflow-style panel appears with context-aware controls — the exact CSS properties that matter for that element, inferred from its computed styles. You drag a slider, and the change appears instantly. When you're done, it writes directly to your source files through HMR. No copy-pasting. No prompt engineering. No platform lock-in. Your code stays your code — Redial just gives you a faster way to shape it.

## Why this is worth building

The fastest design iteration loop is the one with the fewest steps between intent and outcome. Webflow understood that for its platform. Redial brings that same philosophy to the open ecosystem where most production web development actually happens.
