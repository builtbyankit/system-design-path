# Runnable system design labs

Node.js **22.13+**, no packages to install. Run `npm run labs` from the repository root, or `node labs/run.cjs reservation` (also: outbox, cache, overload).

The downloadable runner is generated at dist/labs.cjs. Run `node labs.cjs all` wherever you downloaded it. Each run prints JSON measurements and exits nonzero if an assertion fails.

## Predict before running

| Experiment | Prediction | Evidence |
|---|---|---|
| Reservation | Twelve processes read the last unit before writing. | Broken control sells 12; transaction sells 1; retry returns the same reservation. |
| Outbox | Sink commits, then worker dies before acknowledgment. | Exit 17, replay, one effect, source acknowledgment. |
| Cache | One hundred simultaneous misses. | Baseline 100 loads; coalesced 1; failed load retry and LRU checks pass. |
| Overload | A low accepted-request p99 may hide failures. | Bounded queue rejects 108 of 120; report rejections alongside latency. |

## Extend the reference implementations

1. Reservation: add hold expiry and confirmation with a fake clock. Race both and assert one winner. An old hold must never release a newly owned unit. Extend to all-or-nothing multi-item claims.
2. Outbox: separate the inbox marker from its effect and crash between them. Demonstrate missing or duplicate effects. Restore the shared transaction and test three retries.
3. Cache: add TTL and global fill limits. Test expiry races using a fake clock and load many distinct keys, not just one hot key.
4. Overload: implement fixed-rate arrivals, a slowdown and recovery. Compare open-loop with closed-loop traffic and record intended-arrival latency.

## Limits

SQLite serializes local writes; this is not a sharded database simulator. The crash test kills a process, not machine power. The load experiment uses event-loop timers, not a networked HTTP service. Durations vary. Assertions target correctness and admission counts rather than fragile latency thresholds.

Only temporary files created in the runner's own temporary directory are removed. Review run.cjs to see the reference code and crash points.
