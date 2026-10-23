# System Design Path

A minimal, browser-based system design course with **10 phases, 30 lessons, 30 patterns and 25 worked design questions**. Each lesson includes theory, an example, tradeoffs, an exercise, answer reasoning and primary references. Navigation has three sections: Learn, Patterns and Design Questions.

The course follows a practical loop: predict, learn, design, break and explain. It includes suggested study schedules, three backend project exercises, a capacity calculator, per-design mock timer, a self-assessment rubric, local progress and a downloadable Markdown guide. Project exercises are instructions to implement in your own environment, not browser-executed backend labs.

## Run

Requires Node.js 22 or newer. No dependencies or installation needed.

```sh
npm run build
npm test
npm start
```

Open http://127.0.0.1:4174. The static output is `dist/`; hash routes work on GitHub Pages under a repository subpath.

## Edit

- `curriculum.cjs`: phases, lessons and reference links.
- `patterns.cjs`: recognition signals, mechanisms, failure modes and applicability limits.
- `designs.cjs`: scoped design blueprints, assumptions, APIs, data flows and follow-ups.
- `dist/app.js`, `dist/style.css`: application behavior and layout.
- `build.cjs`: creates browser data and the complete downloadable guide.

Run the build after changing course content. GitHub Actions validates and publishes `dist/` on pushes to main.

## Scope and privacy

This is an independent educational guide to high-level system design. It does not claim to describe any company's production architecture or guarantee interview outcomes. Capacity figures are teaching assumptions. Low-level object design and coding require separate preparation. Progress stays in this browser's local storage; no account or analytics service is used. Timer and self-assessment are session-only.

The phased, practical course structure is inspired by [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch); explanations and design exercises here are independently written. Further-reading references link to original documentation, research and engineering sources. Source links were checked on 2026-10-23.
