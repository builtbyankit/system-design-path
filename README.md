# System Design Path

[Open the guide](https://builtbyankit.github.io/system-design-path/)

A practical course with **16 phases, 48 lessons, 30 patterns, 30 worked designs and four runnable labs**. Navigation stays minimal: **Learn, Patterns, Design Questions**. Existing page URLs and saved completion IDs are preserved.

## Coverage

- Foundations: requirements, estimates, networks, APIs, databases, caches, queues and reliability.
- Internals: WAL, LSM/B-tree tradeoffs, MVCC anomalies, distributed commit, safe replication reads, membership, logical clocks and CRDT semantics.
- Low-level design: object contracts, interfaces, state machines, LRU implementation, reservations, scheduling and bounded event dispatch.
- Specialized systems: recommendations, ad auctions, distributed batch processing and distributed SQL.
- Every design: requirements, sizing, APIs, data, critical-path diagrams, alternatives, numerical deep dive, failure timeline, migration, hints, three answered follow-ups and weak/strong reasoning comparisons.
- Eleven representative designs also have labeled component diagrams. All thirty have critical-path diagrams.
- Interview practice: timer, self-assessment rubric and study schedules. The rubric is not a hiring predictor.

## Run

Requires **Node.js 22.13 or newer**. No npm dependencies.

```sh
npm run build
npm test
npm start
```

Open http://127.0.0.1:4174. Tests check all 108 detail routes, content relationships, application interactions and four executable labs. GitHub Actions builds, tests and publishes dist/ on pushes to main.

## Runnable labs

```sh
npm run labs
npm run lab:reservation
npm run lab:outbox
npm run lab:cache
npm run lab:overload
```

The Learn page includes instructions, expected evidence and extension exercises. Download labs.cjs from the site and run `node labs.cjs all` without cloning anything.

1. **Reservation race:** twelve independent processes reproduce overselling, then demonstrate a guarded SQLite transaction and idempotent replay.
2. **Outbox crash:** a child process commits a sink effect and exits before acknowledgment; replay leaves one intended effect.
3. **Cache stampede:** compare 100 independent loads with one coalesced load, test failed-load recovery and LRU edge cases.
4. **Overload:** compare the same burst under bounded/unbounded queues, reporting admissions, rejections and measured latency together.

SQLite labs create and clean only their own temporary databases. A Node SQLite experimental warning may appear. These local experiments do not establish power-loss durability, distributed consensus or fleet throughput. Timings vary by machine; invariant counts are asserted.

## Edit

content.cjs assembles curriculum.cjs, advanced.cjs, patterns.cjs, designs.cjs, specialized.cjs, walkthroughs.cjs, architectures.cjs and labs/catalog.cjs. Browser behavior lives in dist/app.js and dist/depth.js. build.cjs generates browser data, the complete guide.md and the downloadable lab runner.

## Scope and privacy

An independent educational guide, not a description of any company's production systems or a guarantee of interview outcomes. Capacity figures are explicit teaching assumptions. Further reading links to original documentation, research and engineering sources. The phased, practical structure is inspired by [AI Engineering from Scratch](https://github.com/rohitg00/ai-engineering-from-scratch); explanations and exercises are independently written.

Completion stays in browser local storage. No account or tracking service is used. Timer and rubric are session-only. Backend labs run locally, not inside the static website.
