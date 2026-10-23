# System Design Path

An independent course and interview workbook. Examples and capacity numbers are teaching assumptions, not descriptions of company production systems.

Study loop: predict → learn → design → break → explain. Complete the exercises before revealing answers. This guide covers high-level and low-level system design, specialized systems, runnable labs and interview reasoning.

## Phase 1: Frame the problem

Turn an ambiguous prompt into measurable requirements and a defensible plan.

### Requirements, invariants and scope

A design starts with user actions and promises. Separate functional requirements (send a message, reserve a seat) from quality targets (latency, availability, durability, freshness). An invariant is a statement that must remain true through concurrent requests and failures: a seat has at most one confirmed owner. Ask about geographic scope, peak traffic, retention and what can be excluded. Record assumptions explicitly; revisit them when a constraint changes.

**Worked example.** For ticket booking, agree on browsing events, temporarily holding seats and paying. Search may be seconds stale; confirmation cannot sell the same seat twice. A plausible exercise target is 99.9% successful booking requests over a month and p99 under 500 ms for the reservation step, excluding the payment provider. Define how timeout and sold-out responses count in the SLI before choosing infrastructure.

**Tradeoffs.** Do not spend the interview designing every feature. A single hard invariant usually drives more architecture than ten boxes. An availability target alone does not tell you how much acknowledged data may be lost; define durability and recovery objectives separately.

**Exercise.** Write three invariants for a wallet and identify one screen that can tolerate stale data.

**Answer.** Transfers balance across ledger accounts, a request key creates at most one transfer, and an account cannot exceed its agreed credit limit. A spending chart can lag; authorization must use authoritative balances or an equivalent reservation protocol.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Capacity, units and bottleneck estimates

Estimate the resources that influence a decision. Average QPS = daily operations / 86,400. Peak QPS is an explicit multiplier, not a universal constant. Retained bytes = writes per second × bytes per record × retention seconds; then account separately for replicas, indexes, compression and overhead. Bandwidth is bytes per response × responses per second. Distinguish decimal GB from binary GiB.

**Worked example.** 10 million daily users × 20 reads gives 200 million reads/day, about 2,315 average QPS. At an assumed 5× peak, plan for 11,575 reads/s. Two writes per user per day at 1 KB each produce about 20 GB/day raw, or 600 GB over 30 days. Three full replicas require about 1.8 TB before indexes and safety margin. A 100 KB response at peak is roughly 1.16 GB/s.

**Tradeoffs.** An estimate is not a benchmark. CPU, skew, network saturation and storage latency can invalidate a count of machines. State assumptions, show the order of magnitude, then explain what you would measure. Never size a system only from average load.

**Exercise.** A queue receives 3,000 jobs/s but workers finish 2,500/s for ten minutes. How much backlog forms, and how long to drain it at 4,000/s with unchanged arrivals?

**Answer.** Backlog is (3,000 − 2,500) × 600 = 300,000 jobs. Spare drain capacity is 4,000 − 3,000 = 1,000/s, so recovery takes 300 seconds. This ignores retries and service-time variance.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### A 45-minute design conversation

Use time boxes as a guide: 0–5 minutes requirements; 5–10 scale and APIs; 10–20 core architecture and data flows; 20–35 two deep dives; 35–42 failure, security and operations; 42–45 recap and tradeoffs. Ask the interviewer where to go deeper. Explain one complete write and read before adding extra components.

**Worked example.** For a URL shortener, start with POST /links and GET /{code}. Draw client → service → mapping store. Then add a cache because reads dominate, and discuss ID collision handling and cache invalidation after deletion. Every new component addresses a named bottleneck or failure mode. End with the remaining limit, such as a viral key or abuse detection.

**Tradeoffs.** A familiar company name is a product prompt, not permission to recite a memorized diagram. If the interviewer changes the workload to strict privacy or instant deletion, the design must change too. Discuss alternatives in terms of costs, failure behavior and user impact.

**Exercise.** Explain why you chose a relational database without naming a vendor or saying it is scalable.

**Answer.** The workload needs uniqueness, atomic multi-row updates and indexed lookups at a manageable write rate. Start with one transactional boundary and add read replicas or partitioning only when measurements justify them.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

## Phase 2: Requests and networks

Follow a request from a client to the service and back.

### DNS, TCP, TLS and request latency

DNS maps names to endpoints with cached answers. Connections then incur transport and security negotiation costs before application work. Connection pooling and reuse amortize these costs. A proxy or load balancer can terminate TLS and forward traffic, but downstream hops still need identity, timeouts and capacity limits. HTTP/3 uses QUIC rather than TCP; do not assume every HTTP request follows an identical transport path.

**Worked example.** A mobile client reusing a connection avoids repeating all setup work. If a service issues ten serial 20 ms calls, it spends about 200 ms just waiting on those calls; independent parallel calls reduce the critical path but increase concurrent load. DNS TTL expiration does not instantly move established connections during failover.

**Tradeoffs.** Connection count, packet loss and geography often dominate a supposedly fast service. A DNS change is not an instantaneous global switch. Aggressive health checks can also cause unstable routing when an overloaded service briefly pauses.

**Exercise.** A service has low CPU but high p99 latency. Name four things to inspect before adding instances.

**Answer.** Connection-pool waits, slow downstream calls, network retransmission or cross-region round trips, and queued requests. Trace phases of the request rather than treating low CPU as proof of spare useful capacity.

- [HTTP overview · MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)

### API contracts, pagination and versioning

An API is a contract for inputs, outputs, failures and retries. Choose resource identifiers, authentication, validation and error semantics explicitly. Cursor pagination resumes after a stable ordering key; offset pagination can skip or duplicate items when concurrent writes move boundaries. Use a unique tie-breaker such as (created_at, id), and sign or validate opaque cursors.

**Worked example.** GET /messages?conversation_id=c&after_seq=120 returns messages ordered by conversation sequence and a next cursor. POST /messages includes client_message_id for safe retries. If a bulk export takes minutes, POST /exports returns a job ID and GET /exports/{id} reports status instead of holding an unbounded request open.

**Tradeoffs.** REST is convenient for public resources, RPC for typed internal commands, and GraphQL for flexible projections; none solves correctness automatically. Additive schema evolution is easier than renaming fields. Set page-size and query-complexity limits to prevent expensive requests.

**Exercise.** Two records have the same timestamp. Why is a timestamp-only cursor unsafe?

**Answer.** The next page may exclude unseen rows with the same timestamp or include the last row again. Use a total order such as timestamp plus unique ID and a matching composite index. Define the snapshot semantics if the sort key can change.

- [HTTP overview · MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview)
- [API Security · OWASP](https://owasp.org/API-Security/)

### Load balancing and stateless services

Distribute requests across healthy capacity. Layer 4 balancing operates on transport connections; Layer 7 routing can inspect application properties. Round robin is simple, while least-connections or load-aware policies help uneven work. Stateless request handlers put durable state in shared storage so any instance can serve a request. They can still have local caches and active connections.

**Worked example.** A chat gateway holds WebSockets in memory, while durable messages live in storage. A gateway registry maps users to current connections. During deployment, stop accepting new connections, drain existing ones within a deadline and let clients reconnect with their last acknowledged sequence.

**Tradeoffs.** Sticky routing can reduce cache misses but creates uneven load and makes failures more visible. Health should distinguish readiness to accept work from process liveness. Autoscaling on CPU alone misses a blocked connection pool or an overloaded database.

**Exercise.** Why can doubling API servers make an outage worse?

**Answer.** Each instance may open more database connections and create more simultaneous downstream work. Bound global or downstream concurrency, add admission control and scale the actual bottleneck.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

## Phase 3: Data foundations

Choose models, indexes and transaction boundaries from access patterns.

### Data models and access patterns

List your reads and writes before choosing storage. Relational models suit constraints and joins; document models colocate aggregates; key-value models suit predictable key access; wide-column models support designed partition and sort keys. A logical schema and a physical layout are different decisions. Denormalization makes specific reads cheaper by adding write and repair work.

**Worked example.** For chat, conversations(conversation_id, membership_version) and messages(conversation_id, sequence, sender_id, body_ref) support ordered history. Very long conversations may need time buckets to bound partitions. A user_conversations projection supports an inbox without scanning message history. The message store remains authoritative if projections lag.

**Tradeoffs.** Do not choose a database by the claim that SQL cannot scale or NoSQL has no schema. Both have constraints. For each derived view, specify who updates it, how stale it can be, and how it is rebuilt after bugs.

**Exercise.** Design keys for a tenant-scoped audit log queried by tenant and time.

**Answer.** Partition by tenant plus time bucket; order within the bucket by event time and event ID. Large tenants may need subpartitions. Cross-tenant analytics belongs in a separate projection rather than an unbounded operational scan.

- [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)

### Indexes, storage engines and query cost

An index trades extra storage and write work for cheaper lookup. B-tree families support ordered ranges; log-structured merge designs buffer writes and merge immutable runs, moving cost into compaction and read amplification. Bloom filters can rule out absent keys with no false negatives under correct construction, but a positive result still requires verification. A covering index can avoid extra row reads.

**Worked example.** For SELECT messages WHERE conversation_id=? AND sequence>? ORDER BY sequence LIMIT 50, an index beginning with (conversation_id, sequence) matches the access path. An index on sequence alone may inspect irrelevant conversations. Every additional index adds updates to the write path and can increase tail latency during maintenance.

**Tradeoffs.** Big-O is not enough: disk seeks, cache locality, page size, compression and compaction matter. Benchmark representative distributions, including hot and cold data. A full scan can be appropriate for analytics even when it is unacceptable for a per-request API.

**Exercise.** Why might a new index improve reads but hurt message-send p99?

**Answer.** Writes now maintain another structure and consume more I/O and memory. Background compaction or page splits can increase contention. Measure both read benefit and write amplification before retaining it.

- [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)
- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)

### Transactions, isolation and concurrency

Atomicity means a transaction commits as a unit; isolation controls which concurrent effects it can observe. A read followed by a write is not automatically safe. Encode invariants with unique constraints, conditional writes, row locks or serializable transactions as appropriate. Serializability describes an equivalent serial execution; it is distinct from real-time ordering across independent operations.

**Worked example.** Reserve inventory with UPDATE inventory SET available=available-1 WHERE sku=? AND available>0, and inspect the affected row count. Create the reservation in the same transaction. Two callers reading available=1 and then each writing available=0 can both believe they succeeded unless the mutation is guarded.

**Tradeoffs.** Higher isolation can cause retries or lock contention. Keep transactions short, acquire locks consistently and retry the entire transaction when required. A transaction in one database does not atomically commit a payment provider call.

**Exercise.** Two doctors each see the other on call, then remove themselves. Why can snapshot isolation still violate the rule that someone remains on call?

**Answer.** They update different rows, so neither necessarily conflicts at the row-write level. This is write skew. Serialize the decision with a shared lock or invariant row, or use a serializable transaction and handle aborts.

- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)

## Phase 4: Scale reads and writes

Cache, replicate and partition without hiding correctness problems.

### Caching, freshness and invalidation

A cache is a disposable projection with a freshness contract. Cache-aside reads the cache, falls back to the source and fills on a miss. Write-through updates through a coordinated path; write-behind acknowledges before durable storage and changes the loss model. Specify keys, TTL, eviction, invalidation and behavior when the cache fails. Separate authentication-sensitive data across users and tenants.

**Worked example.** For product descriptions, a 60-second TTL may be acceptable. On update, commit the database and invalidate the key. A concurrent old read can refill stale data after invalidation; versioned values, bounded TTLs or carefully ordered invalidation can mitigate this. For stock confirmation, check the authoritative write path rather than trusting cached availability.

**Tradeoffs.** A 99% hit ratio can hide a catastrophic miss storm. Coalesce concurrent fills per key, jitter expirations and limit fallback load. Stale-while-revalidate is useful only when serving stale data meets the product contract.

**Exercise.** At 10,000 reads/s and 95% hits, what source read rate must you support? What happens if the cache restarts?

**Answer.** Steady-state misses are 500/s. A cold cache can send close to 10,000/s to the source, before retries. Warm key subsets, bound fills and degrade gracefully rather than assuming the normal hit ratio.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Replication, failover and lag

Replication copies data for durability, availability and read capacity. Synchronous acknowledgment waits for selected replicas; asynchronous replication can lag or lose recent acknowledged writes on failover. State what acknowledgment means. Replica reads can be stale; read-your-writes may require a leader read, a replication-position token or session routing.

**Worked example.** A user changes their display name on the leader and immediately loads a profile from a follower 400 ms behind. The old name is expected under asynchronous replication. Route the session to a replica that has applied the write position or to the leader until it is safe. Do not solve this by sleeping an arbitrary interval.

**Tradeoffs.** More replicas do not automatically increase write throughput. A failover mechanism must prevent two writable leaders or use a deliberate conflict-resolution model. Backups protect against logical deletion and corruption that replicas faithfully copy.

**Exercise.** A leader acknowledges a write before any follower receives it and then dies. Can failover promise zero data loss?

**Answer.** No. That acknowledgment policy permits loss of the write if the old leader cannot be recovered. A stricter durable replication acknowledgment changes latency and availability, but is necessary for the stronger promise.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)
- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Sharding, consistent hashing and hot keys

Partitioning spreads data and work across owners. Hash partitioning balances many independent keys; range partitioning supports locality and range scans but can create hot ranges. Consistent hashing reduces key movement as owners change, often with virtual nodes. It does not make a single hot key distributed. Partition keys determine transaction and query boundaries.

**Worked example.** Partition orders by customer_id for customer history. Merchant analytics then needs a projection or scatter-gather query. A celebrity feed or giant tenant can overwhelm one owner even if the overall hash distribution is uniform. Split that workload, cache it, or assign dedicated capacity based on its semantics.

**Tradeoffs.** Resharding needs a migration protocol: copy a snapshot, replay changes, validate, switch ownership and retire the old copy. Dual writes without versioning can reorder updates. Cross-shard transactions and joins add coordination cost.

**Exercise.** Why can hash(user_id) mod N be expensive when N changes?

**Answer.** Changing N remaps a large fraction of keys. A stable partition map or consistent hashing limits movement. You still need transfer bandwidth, ownership epochs and a plan for requests during migration.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)
- [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)

## Phase 5: Distributed correctness

Reason about failure, ordering, consensus and coordination.

### Consistency models, CAP and quorums

Linearizability makes operations appear atomic in a real-time order. Eventual consistency promises convergence under suitable conditions, not a maximum lag by itself. Causal consistency preserves cause-before-effect dependencies. CAP concerns the inability to provide both linearizable consistency and availability for every request during a partition under its formal model; it is not a menu to pick any two features during normal operation.

**Worked example.** A globally available like counter may accept regional increments and merge later. A unique seat assignment should reject or delay requests on a side that cannot establish ownership. With N=3, W=2 and R=2, read/write sets intersect, but intersection alone does not prove linearizability: version selection, concurrent writes, failed operations and membership changes matter.

**Tradeoffs.** Choose guarantees per operation. A product can have strongly consistent purchases and eventually consistent recommendations. Measure staleness and define user-visible fallback instead of calling the entire database simply CP or AP.

**Exercise.** Can a system guarantee every partitioned client a successful write and also guarantee a single real-time value for all reads?

**Answer.** Not under the CAP partition scenario. Some requests must wait or fail to preserve the strong guarantee, or the system must accept weaker consistency and reconcile later.

- [Spanner · Google research](https://research.google/pubs/spanner-googles-globally-distributed-database/)
- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Consensus, logs and leader election

Consensus lets a group agree on an ordered sequence despite failures within its assumed model. A replicated state machine applies the same committed commands in the same order. Raft separates leader election, log replication and safety rules; terms distinguish leadership generations. Elections alone do not guarantee safe writes: log matching, commitment and membership rules matter.

**Worked example.** A five-voter group normally requires three voters for progress and can tolerate two unavailable voters. During a 3/2 partition, the majority side can elect a leader; the minority cannot commit new entries. The old leader may still be running, so downstream systems must reject stale authority when it attempts external effects.

**Tradeoffs.** Consensus pays coordination latency and does not tolerate arbitrary Byzantine behavior by default. Use established implementations for production. A consensus log does not automatically make a nontransactional external email or payment exactly-once.

**Exercise.** Why does increasing a three-node quorum group to four not increase the number of failures tolerated for majority progress?

**Answer.** Both require a majority: two of three or three of four. Both can lose only one member and still form a majority. Five members can tolerate two failures, with extra replication overhead.

- [Raft paper and visualization](https://raft.github.io/)

### Clocks, leases, fencing and identifiers

Wall clocks drift and can jump. Use monotonic time for local elapsed durations, and explicit logical ordering where necessary. A lease grants time-limited ownership, but a paused holder may resume after expiry. Fencing tokens are monotonically increasing ownership generations checked by the resource receiving writes. The check must happen at the protected resource, not only in the lock service.

**Worked example.** Worker A has token 41 and pauses. Worker B acquires token 42 and writes. When A resumes, the storage service rejects token 41. Without this check, the expired worker can overwrite newer output. Time-based ID generators also need policies for clock rollback, worker-ID uniqueness and per-tick exhaustion.

**Tradeoffs.** Globally increasing identifiers require coordination or careful assumptions. Random identifiers avoid a central allocator but need sufficient entropy and collision handling. Sequential IDs reveal ordering and sometimes volume; they are not authorization controls.

**Exercise.** Is checking a lease once before a long file upload sufficient?

**Answer.** No. The lease can expire during the upload. Commit must be conditional on a valid generation at the authoritative destination, or the upload must produce an immutable object whose reference is conditionally published.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Phase 6: Asynchronous systems

Design reliable workflows, queues and streaming pipelines.

### Queues, logs and delivery semantics

A work queue distributes tasks; a retained log supports replay and independent consumer positions. Partitioning usually scopes ordering. At-most-once can lose work; at-least-once can repeat work. Exactly-once claims need a precise boundary: a broker transaction may coordinate records and offsets inside that platform without covering an external side effect.

**Worked example.** A thumbnail worker reads an event, writes an immutable output keyed by image/version, records completion and acknowledges. If it crashes after writing but before acknowledging, delivery repeats; deterministic output keys and guarded completion make replay harmless. Poison messages need bounded retries, a dead-letter path and an operator replay procedure.

**Tradeoffs.** Adding partitions increases parallelism but can change ordering assumptions and rebalance work. A queue absorbs bursts only until retention, disk or latency budgets are exhausted. Monitor oldest-message age, not just count.

**Exercise.** Should a consumer acknowledge before or after writing the database result?

**Answer.** Acknowledging first risks losing work if it crashes before the write. Acknowledging after allows duplicates if it crashes between write and acknowledgment. Make the effect and deduplication record atomic, then acknowledge.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)

### Idempotency, outbox and sagas

Idempotency means repeating an operation has the same intended effect as performing it once. Scope a request key to the caller and operation, bind it to a payload fingerprint, and store the outcome durably. An outbox writes business state and an event record in one local transaction; a relay publishes later. A saga coordinates local transactions with business compensations rather than pretending to provide a global rollback.

**Worked example.** An order transaction inserts the order and outbox event. A relay may publish twice, so inventory consumes with a unique event ID. The workflow reserves inventory, requests payment and confirms shipment. If payment fails, release the reservation. If payment status is unknown, reconcile with the provider instead of creating another charge.

**Tradeoffs.** Compensation can fail and may not undo reality: a refund is a new transaction, not erased history. Use explicit states, retries, operator escalation and reconciliation. Define how long deduplication records live relative to retry windows.

**Exercise.** The server completes a charge but the response is lost. What should the client send next?

**Answer.** Retry with the same request key and identical parameters or query status by a stable operation ID. A new key may create another charge. The server must resolve the existing durable operation rather than treating the timeout as proof of failure.

- [Idempotent requests · Stripe](https://docs.stripe.com/api/idempotent_requests)
- [Transactional outbox · Chris Richardson](https://microservices.io/patterns/data/transactional-outbox.html)

### Stream processing, windows and late data

Event time describes when something happened; processing time describes when the system saw it. Out-of-order arrival makes time windows nontrivial. A watermark is a progress estimate used to decide when windows can be finalized; it is not proof that no late event exists. Define allowed lateness, update or correction policy and state retention.

**Worked example.** For clicks per minute, partition by campaign, deduplicate event IDs and aggregate event-time windows. Publish provisional counts, then finalize after the chosen lateness allowance. A mobile client reconnecting hours later may require a correction stream or batch reconciliation rather than silently discarding revenue-relevant data.

**Tradeoffs.** A hot campaign can overload one partition. Partial aggregates spread computation and merge later, but exact distinct counts require more state than sums. Approximate sketches trade bounded error for memory; explain whether approximation is acceptable.

**Exercise.** If a watermark has passed 12:01 and an event timestamped 12:00:30 arrives, what happens?

**Answer.** That is a product and pipeline policy decision: update within allowed lateness, emit a correction, route to a late-data stream or discard with a metric. Never claim the watermark prevents late arrival.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)

## Phase 7: Reliability under pressure

Keep useful work flowing during overload and dependency failures.

### Deadlines, retries and circuit breakers

A deadline bounds total operation time; per-hop timeouts consume that budget. Retry only errors for which repetition is safe and likely useful. Use capped backoff with jitter, a retry budget and a single deliberate retry layer. A circuit breaker temporarily stops calls to a failing dependency and probes recovery; it is distinct from a concurrency limiter.

**Worked example.** A 300 ms request budget might reserve 30 ms for parsing and response work and allow at most 270 ms for dependencies. Three layers each performing three attempts can create 27 downstream attempts. A slow dependency can hold sockets and workers even while CPU remains low.

**Tradeoffs.** Timeout does not mean an operation failed; it means the caller does not know the outcome. Retries require idempotency or reconciliation. Avoid automatic retries of validation failures and avoid synchronized retries that create another spike.

**Exercise.** Why can a retry improve individual success probability but reduce overall availability?

**Answer.** During overload it consumes scarce capacity, delays original traffic and causes more timeouts. Bound attempts and concurrency, add jitter, and stop retrying when the deadline or retry budget is exhausted.

- [Timeouts, retries and jitter · AWS](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

### Rate limiting, backpressure and load shedding

Rate limits restrict arrivals over time; concurrency limits bound in-flight work. A token bucket allows bursts up to capacity and replenishes at a fixed rate. Backpressure asks upstream producers to slow down. Load shedding rejects selected work to preserve essential capacity. Fairness and tenant isolation prevent one customer from exhausting the system.

**Worked example.** With a bucket capacity of 100 and refill of 10 tokens/s, an idle client can burst 100 requests, then sustain about 10/s. A distributed limiter must atomically update state or tolerate bounded overshoot. Local allocations reduce shared-store load but weaken exact global limits unless coordinated.

**Tradeoffs.** Queues cannot solve permanent overload. If arrivals exceed service rate, latency grows without bound until a limit is reached. Choose fail-open or fail-closed deliberately for limiter outages; authentication abuse and low-risk reads have different consequences.

**Exercise.** A service can process 1,000 requests/s but receives 2,000/s indefinitely. What is the stable solution?

**Answer.** Reduce admitted traffic, add effective processing capacity or reduce work per request. Buffering merely postpones failure. Preserve high-priority work, communicate retry timing and monitor rejected requests.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### SLOs, tail latency and disaster recovery

An SLI measures a user-visible outcome; an SLO sets its target over a window. An error budget is the allowed unsuccessful fraction. p99 describes the slowest one percent boundary, not an average. RPO is the acceptable amount of data loss; RTO is the target restoration time. Failover, backups and restore testing address different failure modes.

**Worked example.** At 99.9% over a 30-day time-based window, the unavailability budget is about 43.2 minutes. For a request-based SLO, use failed eligible requests instead of converting directly to minutes. If 100 independent subcalls each meet a latency threshold 99% of the time, all finish under it only about 0.99^100 = 36.6% of the time.

**Tradeoffs.** Correlated failures make independence assumptions optimistic. Synchronous cross-region durability increases latency, while asynchronous replication changes RPO. A backup that has never been restored is unverified recovery capability.

**Exercise.** Does a replica in another zone protect against an accidental DELETE replicated to every node?

**Answer.** No. Use retained backups or point-in-time recovery, protect credentials and test restoration. Recovery also needs application configuration, keys and a way to validate data integrity.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

## Phase 8: Specialized building blocks

Search, media, realtime connections and spatial workloads.

### Search indexes and autocomplete

An inverted index maps terms to document postings; retrieval combines postings and ranking signals. Autocomplete needs prefix lookup and top suggestions, often via tries, finite-state structures or precomputed prefix tables. The search index is typically a derived view of authoritative content. Track update lag, deletion propagation and index version.

**Worked example.** A product update commits to storage and emits an indexing event. The indexer applies a document version so an older event cannot overwrite a newer one. Build a fresh index in parallel, validate results and switch an alias. Query-time filters must enforce access controls even when cached rankings are reused.

**Tradeoffs.** Freshness, ranking quality and latency compete. Prefix explosion and high-cardinality filters consume memory. Do not send every keystroke through an expensive full search without debouncing, caching and query limits.

**Exercise.** How do you delete a private document from search safely?

**Answer.** Revoke authoritative access immediately, propagate a versioned tombstone to the index and invalidate caches. Query-time authorization protects the gap before indexing catches up. Track deletion lag and audit retained copies.

- [API Security · OWASP](https://owasp.org/API-Security/)
- [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)

### Object storage, CDNs and media pipelines

Store large immutable blobs separately from transactional metadata. Upload directly using short-lived scoped authorization, then finalize metadata after verifying the object. A CDN caches near users; cache keys, TTL and invalidation determine freshness. Media pipelines transform source files asynchronously into multiple sizes or bitrates.

**Worked example.** A video upload creates a pending asset and a multipart upload session. After checksum verification, an event triggers transcoding. Outputs use immutable versioned paths; a manifest becomes visible only when required renditions exist. A player fetches short segments through a CDN and adjusts bitrate to available bandwidth.

**Tradeoffs.** Replication costs storage; erasure coding can reduce overhead while increasing repair work and read complexity. CDN savings depend on cacheability, egress and audience geography. Deleting metadata alone does not delete blobs, cached segments or derived outputs.

**Exercise.** A client uploads all bytes but never calls finalize. What must the service do?

**Answer.** Keep the asset uncommitted, expire abandoned multipart sessions, and garbage-collect orphaned objects after a safe grace period. Reconciliation should recover a lost finalize response without publishing incomplete media.

- [Google File System paper](https://research.google/pubs/the-google-file-system/)
- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Realtime, presence and geospatial systems

WebSockets provide bidirectional connections; server-sent events fit server-to-client streams; polling is simpler when updates are infrequent. Durable events and ephemeral presence have different guarantees. Heartbeats with expiry estimate presence but cannot distinguish every network partition from a disconnected user. Geospatial cells narrow candidate search; exact distance filtering completes it.

**Worked example.** A ride service stores recent driver locations in spatial buckets with freshness timestamps. Query neighboring cells, filter by distance and availability, then use a conditional reservation to assign a driver once. A WebSocket informs the selected driver; it is not the authoritative assignment record.

**Tradeoffs.** Small cells improve precision but increase cross-cell work and update churn. Hot downtown cells need subdivision. Presence can be approximate; financial or ownership decisions cannot rely on a green online dot.

**Exercise.** Two riders choose the same nearby driver. How do you prevent two active assignments?

**Answer.** Use an authoritative conditional state transition from AVAILABLE to RESERVED with a reservation ID and expiry, or a transaction. Notify only after winning ownership; release or reconcile expired reservations.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Phase 9: Security and operations

Make the system observable, recoverable and safe to change.

### Authentication, authorization and tenant isolation

Authentication establishes identity; authorization checks permission for this action on this object. Check both at every trust boundary. Scope data access by tenant, validate object ownership and avoid trusting client-supplied roles. Encrypt transport, manage keys separately from data and minimize sensitive fields in logs. Rate limits and quotas also protect expensive business flows.

**Worked example.** GET /files/{id} first loads or queries metadata under the authenticated tenant, checks current sharing permissions and issues a short-lived download capability. A random file ID is not an authorization mechanism. Revocation semantics depend on already issued capabilities and cached content.

**Tradeoffs.** Fine-grained checks cost work but cannot be replaced by hiding buttons. Shared databases require reliable tenant predicates and tests; dedicated storage increases isolation at operational cost. Treat external webhook payloads and URLs as untrusted input.

**Exercise.** Why is a cache keyed only by report_id dangerous in a multi-tenant service?

**Answer.** Two tenants can collide or receive a response generated under different permissions. Include tenant and relevant authorization scope, and invalidate on permission changes. The source query must also enforce access.

- [API Security · OWASP](https://owasp.org/API-Security/)

### Metrics, logs, traces and incident response

Metrics show aggregate behavior; logs capture events; traces connect work across services. Instrument request rate, errors, latency and saturation, plus domain signals such as duplicate charges or stale projections. Propagate correlation context across queues. Keep metric labels bounded: raw user IDs can create unmanageable cardinality.

**Worked example.** For a message pipeline, monitor send success, durable-commit latency, queue age, delivery latency and replay rate. A trace links API acceptance, broker publication and consumer processing. When delivery slows, queue age distinguishes an accumulating backlog from an isolated slow request.

**Tradeoffs.** Sampling reduces cost but can hide rare failures; retain targeted error traces and aggregate counters. Alert on actionable user impact with ownership and a runbook. CPU thresholds alone often wake someone without explaining what users are losing.

**Exercise.** The API returns 202 successfully while notifications are delayed for hours. Is the system healthy?

**Answer.** Acceptance alone is an incomplete SLI. Measure end-to-end delivery within the promised deadline, oldest pending age and failure outcomes. The API can look healthy while the user journey violates its SLO.

- [Signals · OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/)
- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Deployments, schema changes and recovery drills

Changes must tolerate mixed versions during rollout. Expand-contract migrations add compatible fields, backfill, switch readers and writers, then remove old fields after the compatibility window. Canary deployments expose a small cohort and compare user-facing signals before expansion. Rollback requires data compatibility, not only the previous binary.

**Worked example.** To rename a database column, add the new column, write compatible values, backfill with checkpoints, verify equality, switch reads and later remove the old one. Rate-limit the backfill so it does not steal production I/O. For a derived index, build a new version and switch a pointer after validation.

**Tradeoffs.** Dual writes can diverge; instrument discrepancies and define the source of truth. A destructive migration may make binary rollback unsafe. Run recovery drills with realistic credentials, data sizes and dependencies to establish an actual restoration time.

**Exercise.** Why should a backfill be resumable and idempotent?

**Answer.** It can be interrupted or retried during deployment and failures. Checkpoints bound repeated work; version checks prevent old backfill data from overwriting newer writes; idempotency prevents duplicate effects.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)
- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

## Phase 10: Architecture and interview mastery

Choose boundaries, evolve systems and defend decisions under follow-ups.

### Monoliths, microservices and ownership

Choose service boundaries around cohesive responsibilities and data ownership. A modular monolith can provide clear boundaries with simple deployment and transactions. Microservices allow independent release and scaling but introduce network failure, schema compatibility and distributed workflows. Each service should own its invariants rather than share writable tables casually.

**Worked example.** Start a small commerce product with catalog, orders and billing modules in one deployable service. Extract transcoding or search indexing when asynchronous scale and ownership justify it. Extract billing only with explicit contracts for payment states, idempotency and reconciliation.

**Tradeoffs.** A service per database table creates chatty requests and weak ownership. Separate control-plane configuration from data-plane serving when configuration outages should not stop existing traffic. Architecture should reflect team and operational constraints as well as QPS.

**Exercise.** What evidence would justify extracting a service?

**Answer.** A clear ownership boundary plus independent scaling, deployment or isolation requirements that outweigh operational costs. Demonstrate the contract, failure behavior and data migration path before splitting.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Multi-region design and conflict resolution

Global placement trades proximity, fault isolation and coordination cost. Active-passive simplifies write ownership but needs failover and capacity readiness. Active-active allows regional writes but requires partition ownership or a merge model. Last-write-wins is simple but may lose updates and depends on an ordering policy; CRDTs support specific convergent operations, not arbitrary business invariants.

**Worked example.** A shopping cart can merge add/remove operations with carefully chosen set semantics, while seat inventory needs authoritative ownership or escrowed regional allocations. Route each account to a home region for writes and replicate read projections. During failover, fence the old writer and state the possible loss window.

**Tradeoffs.** Data residency limits placement and backup choices. Cross-region quorums add network latency; local writes with asynchronous replication change conflict and recovery semantics. A global design should name exactly which operations continue during a regional outage.

**Exercise.** Two regions each see one remaining item and sell it. Can merging counters afterward preserve the no-oversell invariant?

**Answer.** No. Reconciliation detects the violation after it happened. Coordinate allocation before sale, use a single owner, or preallocate nonoverlapping inventory rights to regions.

- [Spanner · Google research](https://research.google/pubs/spanner-googles-globally-distributed-database/)
- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### From worked designs to independent performance

Use a repeated loop: predict a design, write assumptions, draw a request flow, calculate the dominant load, identify the hardest invariant, then stress it with failures. Compare to the worked blueprint only after committing to your own answer. Redesign with a changed constraint to test transfer rather than recall.

**Worked example.** Build a tiny URL service, add a bounded cache, then drive concurrent traffic. Build an outbox worker that crashes after publishing and demonstrate safe replay. Build a reservation endpoint and run two concurrent requests against the last unit. Keep measurements and counterexamples; they reveal more than a polished diagram.

**Tradeoffs.** A content checklist is not interview readiness. Practice unfamiliar prompts, explain uncertainty and defend one rejected alternative. Senior interviews often probe migration, cost, operations and organizational boundaries; role-specific expectations vary.

**Exercise.** Score an unseen 45-minute design from 0–2 in requirements, sizing, data/API, correctness, tradeoffs and operations. What should a zero imply?

**Answer.** Treat a zero as a gap to remediate, not something hidden by the total. Repeat a different prompt after targeted study. This rubric is a practice aid, not a validated predictor of a hiring decision.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)
- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

## Phase 11: Storage and transaction internals

Trace disk writes, snapshots and distributed commit rather than treating a database as a black box.

### WAL, B-trees, LSM trees and compaction

A storage engine converts logical mutations into durable byte changes. A write-ahead log records enough information to recover before dirty data pages are considered durable. Group commit amortizes synchronization across writes but adds waiting. B-tree designs maintain sorted pages with splits and merges; LSM designs flush sorted memory tables into immutable files and compact overlapping runs. Read, write and space amplification describe different costs: bytes read per useful read, bytes written per logical write, and physical bytes per live byte.

**Worked example.** Suppose 1 GB of logical updates produces 8 GB of storage writes during flushes and compaction: write amplification is 8, not 8 replicas. A point lookup may consult a memory table and several files; filters skip definitely absent keys while sparse indexes find candidate blocks. A range scan merges sorted iterators and resolves versions and tombstones. An old tombstone cannot be discarded while a retained snapshot or older file still needs it.

**Tradeoffs.** Compaction competes with foreground I/O. A system can accept a burst quickly and then stall as compaction debt grows. Measure sustained load after caches and background work reach steady state; crash consistency depends on real filesystem and synchronization semantics, not merely calling write().

**Exercise.** A benchmark runs for 30 seconds on empty storage and reports exceptional write throughput. What experiment could invalidate its result?

**Answer.** Run long enough to cycle through flush and compaction, use a dataset larger than memory, include overwrites and concurrent reads, record p99 latency and physical bytes written, and recover after a process crash. Compare acknowledged records to recovered records.

- [RocksDB documentation](https://rocksdb.org/docs/)
- [Google File System paper](https://research.google/pubs/the-google-file-system/)

### MVCC, write skew and serializable execution

MVCC retains row versions so readers can observe a snapshot without locking every writer. Snapshot isolation prevents some anomalies but does not imply serializability. Draw a dependency graph: if concurrent transactions create a cycle of read/write dependencies, their result may have no equivalent serial order. Unique constraints prevent duplicate keys, not arbitrary predicates such as at least one doctor is on call. Serializable implementations may block or abort; callers must retry whole transactions with fresh reads.

**Worked example.** Initially A and B are on call. T1 reads both, then turns A off. T2 reads both from its snapshot, then turns B off. Different updated rows mean ordinary write-write conflict detection may allow both commits. Protect the shared invariant with a locked roster row or a serializable transaction. If T2 aborts, its retry sees A off and must leave B on. Retrying only the final UPDATE repeats the stale decision.

**Tradeoffs.** Long snapshots retain old versions and increase storage cleanup pressure. Explicit locks make contention visible but can deadlock; acquire in a stable order and bound wait time. A serializable transaction does not protect effects performed outside it before commit.

**Exercise.** Sketch the two transactions and add one mechanism that prevents write skew without locking every doctor row.

**Answer.** Both transactions lock the same roster-invariant row before reading the roster, then make the decision and update within that transaction. Alternatively, use a database-supported serializable isolation mode and a bounded whole-transaction retry loop.

```text
BEGIN;
SELECT id FROM rosters WHERE id = :roster FOR UPDATE;
-- Read the current roster only after obtaining the lock.
-- Reject removing the last on-call doctor.
UPDATE doctors SET on_call = false WHERE id = :doctor;
COMMIT;
```

- [Concurrency control · PostgreSQL](https://www.postgresql.org/docs/current/mvcc.html)
- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)

### Two-phase commit, sagas and recovery logs

Two-phase commit coordinates an atomic decision across transactional participants. In prepare, each participant durably records whether it can commit and promises not to decide independently. The coordinator then durably decides commit or abort and communicates the decision. A prepared participant may hold locks while the decision is unavailable. Replicating the coordinator improves recovery but does not remove all protocol assumptions or make arbitrary HTTP services transactional.

**Worked example.** An account transfer touches shards A and B. Both prepare; the coordinator records COMMIT and crashes before notifying B. B must recover the durable decision rather than time out and abort independently. If no commit decision was durably recorded, recovery follows the protocol’s abort rules. The transaction identity and participant state must survive restarts.

**Tradeoffs.** Use 2PC when atomic cross-participant invariants justify coordination and participants support it. Use a saga when intermediate states and compensations are acceptable. A compensating refund cannot undo a shipped item or erase a visible debit. Do not describe consensus and atomic commit as interchangeable: they solve different problems, even when combined.

**Exercise.** Why is “abort a prepared transaction after 30 seconds” unsafe without consulting the protocol decision?

**Answer.** Another participant may already have committed based on a durable commit decision. An independent abort creates a partial commit. Resolve the coordinator decision through its recovery mechanism or remain in doubt until the supported recovery policy can safely decide.

- [Spanner · Google research](https://research.google/pubs/spanner-googles-globally-distributed-database/)
- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Phase 12: Replication protocols and convergence

Distinguish safe replication from copying bytes and understand the limits of ordering and merge rules.

### Replication logs, safe reads and membership

Replication needs a definition of accepted, durable, committed and applied. A follower may have an entry on disk that is not committed; applying it early can expose a value later removed by leader recovery. Safe reads need evidence that leadership is current and the node has applied the necessary committed position. A heartbeat received earlier is not indefinite authority. Membership changes must ensure that old and new configurations cannot each form disjoint authoritative quorums.

**Worked example.** A three-voter cluster has leader A and followers B and C. A replicates an entry to B and commits under the protocol, but loses contact with both before responding. A client retry must reuse operation identity because the write may already have happened. A newly elected leader restores committed history before serving safe reads. A stale follower read must be labeled weaker or wait for an appropriate position.

**Tradeoffs.** A lease-based read optimization depends on timing assumptions and lease validity. Log compaction transfers snapshots plus later entries; the snapshot boundary must include its applied index and relevant metadata. Changing voters by simply replacing the list can violate quorum overlap.

**Exercise.** A follower’s commit index is ahead of its applied index. Can it serve the latest state by checking only commit index?

**Answer.** No. Its state machine has not yet applied all committed commands. It must wait for the required applied position as well as satisfy the protocol’s freshness/leadership conditions.

- [Raft extended paper](https://raft.github.io/raft.pdf)
- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Version vectors, CRDTs and deletion semantics

Concurrent writes need a defined resolution policy. A scalar timestamp orders values but can discard independent updates. A version vector tracks per-replica progress and can distinguish causal succession from concurrency. A state-based CRDT uses an associative, commutative and idempotent merge with appropriately monotone state. These algebraic properties explain why duplicate and reordered state exchange converges; they do not preserve arbitrary application constraints.

**Worked example.** A grow-only counter keeps one component per replica. If A has [3,0] and B has [0,4], componentwise max yields [3,4], total 7. Merging the same state again still yields 7; summing whole states would double-count. A PN-counter uses two such counters for increases and decreases. It can go negative, so it cannot independently guarantee inventory never falls below zero.

**Tradeoffs.** Observed-remove sets need operation identities or causal context so a removal says which additions it observed. Dropping tombstones without knowledge of offline replicas can resurrect deletions. Replica identities cannot be casually reused after losing their monotonic state.

**Exercise.** Two replicas each decrement a PN-counter initialized to one. Is convergence enough to prevent overselling?

**Answer.** No. The merged value can be minus one. Allocate nonoverlapping rights through escrow, coordinate reservations, or route ownership to one authority. Convergence answers whether replicas agree eventually, not whether every accepted transition was legal.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Logical clocks, uncertainty and external consistency

Wall time, causality and total order are different concepts. Lamport clocks advance on local events and received messages; causality implies increasing Lamport time, but the reverse does not prove causality. Vector clocks capture more causal relationships at a metadata cost. Hybrid logical clocks combine physical proximity with logical ordering. None makes untrusted physical clocks perfectly accurate.

**Worked example.** Service A emits event a at local clock 100; service B receives it while its clock reads 90. A logical update ensures B’s dependent event orders after a. For an externally consistent transaction, the guarantee is stronger: if T1 finishes before T2 starts, serialization must respect that real-time relation. Systems using bounded clock uncertainty may wait until the uncertainty interval permits the chosen ordering.

**Tradeoffs.** A timestamp ID is useful for approximate sort order but not a substitute for transaction serialization. Waiting out uncertainty costs latency; clock uncertainty spikes can affect availability or tail latency. Specify what clients are promised before selecting the mechanism.

**Exercise.** If two events have Lamport times 10 and 20, can you conclude that the first caused the second?

**Answer.** No. Independent processes can produce those timestamps. You can say that a causal predecessor must have a lower Lamport time, but a lower value alone does not establish a causal path.

- [Spanner · Google research](https://research.google/pubs/spanner-googles-globally-distributed-database/)
- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Phase 13: Low-level design foundations

Model objects, contracts and concurrent state transitions with executable examples.

### Object modeling, interfaces and dependency boundaries

Low-level design turns requirements into enforceable responsibilities. Identify entities with identity, immutable values, lifecycle transitions and services that coordinate them. Write invariants before classes. Keep domain decisions independent of databases, clocks and network providers by depending on narrow interfaces. Composition lets a policy vary without making every variation a subclass. Avoid modeling every noun as a mutable object.

**Worked example.** For parking, Ticket owns entry time and lifecycle; Spot tracks compatible vehicle class and occupancy; AllocationPolicy selects a candidate; PricingPolicy calculates a quote; ParkingService coordinates allocation and ticket creation through a repository transaction. A Clock is injected so tests can cross midnight without sleeping. PaymentGateway returns pending, successful or failed outcomes rather than a bare boolean.

**Tradeoffs.** Too many abstractions obscure a small problem. Introduce an interface when it isolates a side effect, supports a real variation or enables deterministic tests. Do not let both Spot and Ticket independently claim to own occupancy truth.

**Exercise.** Design the boundary for reserving a parking spot. Which object must prevent two tickets from receiving the same spot?

**Answer.** The repository transaction or authoritative aggregate enforces one active occupant per spot. AllocationPolicy may suggest a candidate but cannot guarantee ownership from a read alone. ParkingService retries selection after an atomic claim conflict.

```text
interface SpotRepository {
  reserve(candidateId, ticketId, expectedVersion): Promise<ClaimResult>;
}
interface PricingPolicy { quote(ticket, exitTime): Money; }
interface Clock { now(): Instant; }
// ClaimResult distinguishes acquired, conflict and unavailable.
```

- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)

### State machines and valid transitions

Represent lifecycle states explicitly, with guards, effects and terminal-state rules. An enum alone does not enforce transitions. Each command verifies the current state and version, then atomically records the new state and any durable events. Separate a command’s identity from the entity’s identity. Make retries return the existing outcome rather than replaying effects.

**Worked example.** A hold can be ACTIVE → CONFIRMED or ACTIVE → EXPIRED. Both transitions require the same current version. If expiry wins, confirmation cannot later succeed without a new allocation. Payment may independently become SUCCEEDED after expiry, triggering a refund workflow instead of moving the old hold back to ACTIVE.

**Tradeoffs.** Putting all failure states into FAILED loses recovery information. Distinguish known failure from unknown outcome and retryable from terminal states. State machine tests should explore illegal edges and repeated commands, not only the happy path.

**Exercise.** Write a test for confirm and expire racing at the deadline.

**Answer.** Use a controlled clock and launch both conditional transitions against the same version. Assert exactly one transition wins; CONFIRMED never becomes EXPIRED; a late payment triggers compensation rather than seat reassignment. Repeat each command and verify no additional effect.

```text
transition(hold, command, now) {
  if (hold.state !== "ACTIVE") return previousOutcomeOrConflict();
  if (command === "confirm" && now >= hold.expiresAt) return "expired";
  // Repository compares the version and commits one transition.
}
```

- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Idempotent requests · Stripe](https://docs.stripe.com/api/idempotent_requests)

### LRU cache: data structures and concurrency

An LRU cache needs O(1) lookup and recency updates: a hash map indexes nodes in a doubly linked list. Access moves a node to the most-recent end; insertion above capacity removes the least-recent node and its map entry. The map and list must change as one logical operation. Define zero capacity, overwrite behavior, missing keys and whether expired reads update recency.

**Worked example.** With capacity two, put A, put B, get A, put C must evict B. In JavaScript, Map insertion order can implement the same observable behavior by delete-and-set on hits and replacements. A multithreaded implementation needs locking or another validated coordination strategy. Calling a user loader while holding the global lock can serialize unrelated keys or deadlock on re-entry.

**Tradeoffs.** Entry-count capacity ignores value sizes. Production caches may need byte budgets, admission policy and TTL. Singleflight is separate from LRU eviction: deduplicate in-flight loads, remove failed promises, and let a later caller retry.

**Exercise.** Implement LRU get and put, then test overwrite, capacity zero, and eviction after a hit.

**Answer.** The runnable cache lab includes a reference implementation and assertions. Predict the eviction order before running it. Modify the implementation to forget the recency update and confirm the test catches B remaining when it should be evicted.

```text
get(key) {
  if (!this.values.has(key)) return undefined;
  const value = this.values.get(key);
  this.values.delete(key); this.values.set(key, value);
  return value;
}
put(key, value) {
  if (this.capacity === 0) return;
  this.values.delete(key); this.values.set(key, value);
  if (this.values.size > this.capacity)
    this.values.delete(this.values.keys().next().value);
}
```

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

## Phase 14: Low-level design case studies

Work through reservations, scheduling and event dispatch at interface and implementation level.

### Reservation service: interfaces and transaction boundaries

Keep allocation policy separate from ownership enforcement. InventoryRepository exposes a conditional claim inside a transaction; ReservationService validates commands, calculates expiry and stores an idempotent result. PaymentGateway owns provider interaction but not inventory. A durable workflow coordinates their state. Model Money using integer minor units and a currency, not floating-point dollars.

**Worked example.** reserve(sku, requestKey) begins a transaction, returns an existing reservation for that key if present, conditionally decrements available inventory, inserts the reservation and commits. An out-of-stock result is distinct from a database error. confirm(reservationId, paymentId) validates ownership and state in a transaction; repeating a confirmed command returns its prior outcome.

**Tradeoffs.** Do not hold a database lock while waiting for a payment network. A local transaction cannot atomically cover the provider. Persist pending state, make the remote operation idempotent, and reconcile ambiguous responses. The lab demonstrates one transaction boundary and real concurrent processes, not a production payment integration.

**Exercise.** Run the reservation lab with 24 contenders for one unit, then repeat the winning request key. What must remain true?

**Answer.** Exactly one distinct reservation succeeds, remaining inventory is zero, and replaying its key returns the same reservation without another decrement. The included intentionally broken read-then-write case demonstrates overselling before the correct conditional transaction is tested.

- [SQLite transaction semantics](https://www.sqlite.org/lang_transaction.html)
- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)
- [Idempotent requests · Stripe](https://docs.stripe.com/api/idempotent_requests)

### Scheduler internals: heaps, clocks and cancellation

Separate due-time selection from executing jobs. A min-heap orders the next eligible job; a worker pool bounds concurrent execution; a durable repository stores authoritative state. Clock and Executor interfaces allow deterministic testing. Cancellation should have a documented linearization point: cancel-before-claim prevents start, while cancel-after-start may only request cooperative cancellation.

**Worked example.** Jobs A and B are due at time 10 and 20. Advance a fake monotonic clock to 15 and dispatch only A. If A retries, assign next_attempt_at from a backoff policy; do not sleep inside the scheduler loop. The worker reports a terminal result under an execution generation so a stale attempt cannot overwrite a later result.

**Tradeoffs.** A heap in one process is an accelerator, not durable scheduling. Rebuild it from storage after restart, and use a claim transaction when multiple schedulers run. Wall-clock cron semantics need a separate policy for daylight-saving and missed occurrences.

**Exercise.** What should happen when cancellation and worker claim race?

**Answer.** Both perform guarded transitions from the same pending version. If cancellation wins, claim fails. If claim wins, cancellation returns already-running or sets a cooperative cancellation request; it must not claim the external task never ran.

```text
interface JobStore { claimDue(now, worker, generation): Job | null; }
interface Executor { run(job, cancellationToken): Promise<Result>; }
interface RetryPolicy { nextAttempt(attempt, now): Instant | null; }
// Test through fake Clock and Executor; never rely on sleep timing.
```

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Event dispatch, bounded queues and thread safety

A local event bus routes typed events to subscribers; a durable broker additionally defines persistence, delivery and recovery. Specify subscriber ordering, exception isolation, re-entrancy and queue limits. Copy the subscriber collection before dispatch if handlers may register or unsubscribe. Keep slow handlers off a shared critical path when the contract permits asynchronous delivery.

**Worked example.** If subscriber A throws, decide whether B still receives the event. For independent observers, catch and record A’s error, then continue to B. For a transactional business workflow, silent continuation may be wrong: represent the step durably and retry it. If producers outpace consumers, a bounded queue returns backpressure instead of allocating forever.

**Tradeoffs.** Using an async function does not make CPU-heavy code parallel in a single event loop. A thread-safe collection does not make a multi-step business invariant atomic. Document whether one subscriber can observe events out of order when processed concurrently.

**Exercise.** A subscriber publishes another event recursively. How do you prevent unbounded call-stack growth and preserve a clear order?

**Answer.** Enqueue nested events and drain iteratively with a bound, rather than immediately recursing into publish. Define FIFO order within that dispatcher, isolate handler errors, and reject or defer when the bound is reached.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

## Phase 15: Specialized systems

Design recommendation serving, ad auctions and batch compute with domain-specific constraints.

### Recommendation pipelines and online feature serving

Separate candidate generation, ranking and policy filtering. Retrieval narrows millions of items to hundreds or thousands; ranking spends more compute on those candidates; filtering enforces availability, privacy and safety. Offline training, streaming features and online serving have different freshness needs. Specify which features are available at request time to avoid training-serving skew and label leakage.

**Worked example.** A feed retrieves 500 candidates from multiple sources, ranks them with a versioned model and filters blocked or deleted items before returning 20. If the model service times out, return a cached or popularity-based list filtered under current policy. Log exposures with request and model versions so experiments can interpret outcomes rather than mixing incomparable populations.

**Tradeoffs.** More complex ranking may improve a metric but increase latency and operational cost. Cold-start users need fallback candidates; exploration changes feedback distributions. A/B tests need stable assignment and guardrails such as latency, diversity and user satisfaction, not clicks alone.

**Exercise.** An offline metric improves, but online results get worse. Name three architectural causes to investigate.

**Answer.** Features may be stale or computed differently online, training may use information unavailable at serving time, or serving may fall back frequently because the new model exceeds its latency budget. Inspect versioned features, exposure logs and timeout rates before blaming the ranking formula.

- [YouTube recommendations research](https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/)

### Ad auctions, budget pacing and attribution

An ad system filters eligible campaigns, scores candidates, runs a declared auction rule and records a billable outcome. First-price and second-price mechanisms have different payment rules; do not assume one universal industry mechanism. Budget reservation, frequency caps, fraud detection and delayed conversion attribution are separate stateful problems. Bid responses have deadlines and untrusted inputs.

**Worked example.** For an illustrative first-price auction, eligible bids 4, 3 and 1 currency units yield a winning price of 4 before the agreed billing model. A campaign with 100 units remaining cannot let every region independently spend those same 100 units. Allocate regional budget rights or use an authoritative reservation service, then reconcile reservations with actual impressions and expiry.

**Tradeoffs.** Exact global budgets add coordination latency; allocated quotas may underutilize budget while bounding overspend. Attribution can arrive days later and is not identical to auction-time billing. Use immutable event identities and correction records so duplicate callbacks cannot inflate charges.

**Exercise.** How do you keep a fast auction path while bounding overspend during a regional partition?

**Answer.** Preallocate nonoverlapping spend rights to regions, enforce the local allocation atomically and stop or conservatively degrade when it is exhausted. Reallocate only through an authoritative protocol. State the reservation and rounding rules that determine the bound.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)
- [Idempotent requests · Stripe](https://docs.stripe.com/api/idempotent_requests)

### Batch engines, shuffle, skew and speculative work

A batch engine partitions input, schedules tasks, transfers intermediate data and commits outputs. Map tasks emit key-value records; shuffle groups related keys; reduce tasks combine each group. A DAG generalizes this into stages with dependencies. Task completion is not the same as publishing output: retries and speculative attempts can produce competing files.

**Worked example.** A 10 TB input split into 256 MB pieces yields roughly 39,063 decimal-sized splits. If one percent of keys receive half the records, equal input splits will not balance reducers. Partial aggregation or salting can spread associative aggregates; a later merge reconstructs totals. Non-associative operations require more care.

**Tradeoffs.** Speculative execution helps stragglers only when extra attempts do not amplify a shared bottleneck. Commit one winning attempt through a manifest or conditional pointer; garbage-collect losing output. A combiner must preserve the operation’s algebraic semantics.

**Exercise.** Why is averaging mapper averages usually incorrect?

**Answer.** Mappers may process different counts. Carry (sum, count) pairs, merge sums and counts, and divide once at the end. For example, averages of 100 over one item and 0 over 99 items combine to 1, not 50.

- [MapReduce paper · Google](https://research.google/pubs/mapreduce-simplified-data-processing-on-large-clusters/)

## Phase 16: Engineering evidence and interview depth

Run the labs, inject failures, interpret measurements and practice unfamiliar follow-ups.

### Runnable labs: hypotheses, counterexamples and evidence

Run a controlled experiment that can falsify a claim. Each included lab has a reference implementation, an explicit failure boundary and assertions about observable behavior. Predict the output first, run the correct implementation, then enable or inspect the broken control. A passing toy lab validates its modeled invariant, not a complete production deployment.

**Worked example.** The reservation lab launches independent processes against SQLite. The outbox lab terminates a worker after its durable sink effect but before acknowledging the event, then replays and verifies one effect. The cache lab compares duplicate origin loads with coalesced loads. The queue lab measures accepted, rejected and completed work under bounded and unbounded admission.

**Tradeoffs.** These labs use local storage and clocks, not regional networks. SQLite serializes writes differently from many server databases. The deterministic controls make bugs reproducible; they are not proof against every failure schedule. Extend the experiment before generalizing its result.

**Exercise.** Run all labs, retain the printed JSON, and explain one thing the experiments do not establish.

**Answer.** Use npm run labs with Node.js 22.13 or newer. The tests establish the specified local crash/concurrency properties. They do not establish power-loss durability of your disk, distributed consensus, cross-region failover or a throughput SLA. Each lab page includes extension tasks and expected invariants.

- [SQLite transaction semantics](https://www.sqlite.org/lang_transaction.html)
- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Load tests, saturation and honest latency statistics

A load test defines arrival process, payload distribution, concurrency, duration and success criteria. Closed-loop clients wait for a response before issuing more work, which can hide overload by slowing arrivals. Open-loop traffic maintains arrivals independently but must bound its own generator resources. Measure latency from intended or actual arrival consistently and report rejected work separately from completed work.

**Worked example.** A service with ten workers and 20 ms per job has an ideal service capacity near 500 jobs/s before overhead. Sending 2,000/s builds backlog unless work is rejected. Reporting p99 only for successful requests without rejection rate can make the overloaded system appear healthy. The queue lab compares the same workload under bounded and unbounded queueing and reports both.

**Tradeoffs.** Short benchmarks miss cache churn, compaction and garbage collection. Percentiles from small samples are unstable. Do not extrapolate a local toy benchmark into company-scale capacity. Include warm-up, sustained and recovery periods and keep raw measurements when making a decision.

**Exercise.** A limiter rejects 90% of requests but accepted-request p99 is 10 ms. Is that a successful test?

**Answer.** Only if the workload and service contract permit that rejection rate. Report offered load, admitted load, completion rate, errors, rejections and latency together. The goal is useful work within the promised budget, not a flattering percentile.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)
- [Signals · OpenTelemetry](https://opentelemetry.io/docs/concepts/signals/)

### Hints, answered follow-ups and calibrated feedback

Use three passes: attempt without help; reveal the first hint only when stuck; compare the complete walkthrough after committing to an answer. A strong explanation names an invariant, a concrete mechanism and its failure boundary. A weak explanation names a technology and assumes it solves all three. Evaluate reasoning on an unfamiliar variation, not agreement with one reference diagram.

**Worked example.** Weak: “Kafka guarantees exactly once, so payment retries are safe.” Strong: “The provider call lies outside the log transaction. I persist an intent and stable provider key, reconcile unknown outcomes, and make the ledger transition atomic with deduplication.” The second answer identifies a boundary and a recovery action that can be tested.

**Tradeoffs.** The six-area rubric is a self-assessment, not a hiring prediction. A peer should challenge assumptions, select a failure point and ask for an alternative. Repeat the prompt with ten times the load or a stricter consistency requirement and record which component must change.

**Exercise.** Pick a design, use only its first hint, then answer all three follow-ups aloud before revealing the answer keys.

**Answer.** Score each answer on mechanism, failure behavior and tradeoff. An answer that only repeats a pattern name needs revision even if it sounds familiar. Use the concrete weak/strong comparison on that design page to find missing evidence.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)
- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

## Pattern catalog

### Cache-aside

**Recognize:** Repeated reads with tolerable bounded staleness.

**Apply:** Read cache → on miss read source → populate with TTL. Commit writes to the source, then invalidate or update the projection. Coalesce concurrent fills and version values when old fills can race with new writes.

**Failure:** A cache outage floods storage. Bound fallback concurrency and use stale data only where allowed.

**Boundary:** Do not use cached stock to authorize a sale.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Write-through and write-behind

**Recognize:** A common access layer must keep frequently read values warm.

**Apply:** Write-through persists through the caching layer before acknowledging under a defined durability contract. Write-behind batches persistence later, reducing write latency while exposing a loss window.

**Failure:** A successful cache write may not mean durable storage. Specify ordering and crash recovery.

**Boundary:** Avoid write-behind for an authoritative ledger unless a durable log protects acknowledged data.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### CDN and immutable assets

**Recognize:** Geographically distributed reads of cacheable content.

**Apply:** Publish versioned object paths and serve through edge caches. Cache a small mutable manifest separately. Control origin access and signed URL expiry for private content.

**Failure:** A bad cache key can leak private responses; an origin outage appears when caches miss.

**Boundary:** Low-reuse personalized content may not benefit enough to justify caching.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Request coalescing and stale revalidation

**Recognize:** A popular key expires and many callers request it together.

**Apply:** Allow one in-flight fill per key; let peers wait within a deadline or receive an allowed stale value. Jitter expiration and cap concurrent refreshes across keys.

**Failure:** A hung fill can block every waiter. Time out ownership and avoid recursively retrying fills.

**Boundary:** Stale authorization or financial decisions are not safe fallback values.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Read replicas and session consistency

**Recognize:** Read volume exceeds one primary and some reads tolerate lag.

**Apply:** Send eligible reads to replicas; carry a write-position token or use primary reads when a session needs its own latest update. Monitor lag and remove unhealthy replicas from routing.

**Failure:** Failover can lose writes if replication acknowledgments were asynchronous.

**Boundary:** Replicas do not remove a primary write bottleneck.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Hash partitioning and virtual nodes

**Recognize:** Many independent keys need balanced ownership.

**Apply:** Map keys to stable partitions or a consistent-hash ring, then map partitions to nodes. Use virtual nodes to smooth placement and ownership epochs during movement.

**Failure:** A single viral key remains hot; movement competes with normal traffic.

**Boundary:** Range scans spanning many hash partitions may be expensive.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Range partitioning and splitting

**Recognize:** Queries need ordered scans within a key range.

**Apply:** Assign contiguous key ranges to owners. Split growing or hot ranges and maintain a routing directory. Choose composite keys that avoid one sequential write hotspot.

**Failure:** A monotonically increasing leading key can send all new writes to one shard.

**Boundary:** Uniform random lookups may be simpler with hash partitioning.

- [Bigtable paper](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)

### Scatter-gather and partial aggregation

**Recognize:** A query genuinely needs results from several partitions.

**Apply:** Fan out with a shared deadline, compute local top-k or partial aggregates, then merge. Define whether missing shards yield partial results or an error.

**Failure:** Fanout amplifies tail latency and load; retries can multiply the work.

**Boundary:** Prefer a purpose-built projection for a frequent expensive global query.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### CQRS and materialized views

**Recognize:** Read shapes differ substantially from write invariants.

**Apply:** Keep commands in an authoritative model and asynchronously build read-specific projections. Version events, expose freshness when useful and support replay into a new view.

**Failure:** Projection drift or lag creates stale reads; rebuild must coexist with live updates.

**Boundary:** A small CRUD service usually does not need separate models and pipelines.

- [Transactional outbox · Chris Richardson](https://microservices.io/patterns/data/transactional-outbox.html)

### Event sourcing

**Recognize:** Historical state transitions and replay are first-class requirements.

**Apply:** Store accepted domain events as the authority and derive current state. Use optimistic stream versions, deterministic reducers and snapshots to bound replay time.

**Failure:** Bad event schemas persist; replay can accidentally repeat external effects unless isolated.

**Boundary:** An audit table alone does not require turning all business state into events.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Idempotent commands and consumers

**Recognize:** Requests or messages can be repeated after ambiguous failures.

**Apply:** Use a stable scoped operation ID. Atomically claim the ID with the business effect or store a durable state machine. Return the stored outcome; reject reuse with a different payload.

**Failure:** An in-memory dedup set disappears on restart. Expiring keys before the retry horizon allows duplicates.

**Boundary:** Idempotency does not imply ordered delivery.

- [Idempotent requests · Stripe](https://docs.stripe.com/api/idempotent_requests)

### Transactional outbox and CDC

**Recognize:** A database update must reliably cause an asynchronous event.

**Apply:** Commit business state and an outbox row together; relay by polling or change-data capture. Record event IDs and apply idempotent consumption. Preserve required ordering per aggregate.

**Failure:** Relay crash after publish causes duplicates. Monitor unpublished age and cleanup safely.

**Boundary:** Do not claim atomicity with arbitrary external side effects merely because an outbox exists.

- [Transactional outbox · Chris Richardson](https://microservices.io/patterns/data/transactional-outbox.html)

### Saga and compensation

**Recognize:** A business workflow crosses separately owned transaction boundaries.

**Apply:** Use explicit durable states. Each step commits locally; failures trigger retries or business compensation. Orchestration centralizes workflow visibility; choreography reduces a central coordinator but obscures flow.

**Failure:** Compensation can also fail. Keep reconciliation and an operator intervention path.

**Boundary:** If one local transaction naturally fits, a saga adds unnecessary complexity.

- [Transactional outbox · Chris Richardson](https://microservices.io/patterns/data/transactional-outbox.html)

### Compare-and-set and optimistic concurrency

**Recognize:** Concurrent updates must detect stale assumptions.

**Apply:** Read a version, then update only if that version or expected state still matches. On conflict, re-read and re-evaluate. Unique constraints defend invariants at the storage boundary.

**Failure:** Unbounded conflict retries create livelock under contention.

**Boundary:** Long multi-entity workflows need more than an isolated version check.

- [Transaction isolation · PostgreSQL](https://www.postgresql.org/docs/current/transaction-iso.html)

### Leases with fencing tokens

**Recognize:** A resource needs temporary ownership despite pauses and failover.

**Apply:** Grant a monotonically increasing generation with ownership. Require the protected resource to reject writes with a generation older than the latest accepted one.

**Failure:** Lease expiry alone cannot stop a paused worker from resuming and writing.

**Boundary:** If the resource cannot enforce fencing, do not promise exclusive effects from the lock alone.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Quorum replication and consensus

**Recognize:** Authoritative state needs agreed ordering across failed nodes.

**Apply:** Use a proven protocol with leader generations, replicated logs and membership rules. A majority can maintain progress when enough voters communicate. Separate commit from application of effects.

**Failure:** Losing quorum stops writes. External side effects still need their own safe protocol.

**Boundary:** A counter with a valid merge rule may not need global consensus for every increment.

- [Raft paper and visualization](https://raft.github.io/)

### Durable queue and competing consumers

**Recognize:** Bursty work can finish outside the request deadline.

**Apply:** Durably accept a job, let workers claim it, renew visibility while processing and acknowledge after its effect is safe. Use bounded retries and a dead-letter path.

**Failure:** Worker crashes can cause redelivery; a queue grows forever under sustained overload.

**Boundary:** Immediate strict request-response work cannot simply be hidden behind a queue.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)

### Partitioned log and replay

**Recognize:** Multiple consumers need independent ordered history.

**Apply:** Choose a partition key that matches the ordering scope. Retain events and track offsets per consumer group. Rebuild projections by replaying without invoking unsafe side effects.

**Failure:** Hot partitions limit throughput; changing partition count can affect key ordering.

**Boundary:** A log does not provide global order across all partitions.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)

### Fanout-on-write, fanout-on-read and hybrid

**Recognize:** A feed distributes producer content to followers.

**Apply:** Push pointers into ordinary followers’ inboxes on write; pull high-fanout producers on read. Merge by a stable ranking key and enforce visibility at delivery time.

**Failure:** Celebrity writes create enormous amplification; precomputed feeds can contain revoked content.

**Boundary:** Choose the threshold from measured activity and cost, not a memorized follower number.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Event-time windows and correction streams

**Recognize:** Aggregates depend on when an event occurred.

**Apply:** Group by event time, use watermarks as progress estimates and retain state for an explicit lateness window. Emit revisions or corrections for late events when the domain requires accuracy.

**Failure:** Idle partitions can stall progress; late data can alter previously published totals.

**Boundary:** Processing-time windows are simpler when event-time correctness is unnecessary.

- [Apache Kafka documentation](https://kafka.apache.org/documentation/)

### Deadlines and retry budgets

**Recognize:** Transient failures occur but downstream capacity is finite.

**Apply:** Propagate an end-to-end deadline, retry safe operations with bounded jittered backoff and cap aggregate retries. Prefer one intentional retry layer.

**Failure:** Layered retries multiply requests and can turn a slowdown into a cascading failure.

**Boundary:** Validation errors and unsafe non-idempotent commands should not be blindly retried.

- [Timeouts, retries and jitter · AWS](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

### Circuit breaker and bulkhead

**Recognize:** One failing dependency must not exhaust all resources.

**Apply:** Open a breaker after meaningful failures; probe recovery with limited traffic. Use separate bounded pools for different dependencies or tenant classes.

**Failure:** A badly tuned breaker can flap or reject useful work. Half-open probes need limits too.

**Boundary:** A breaker is not a replacement for timeouts, capacity limits or fallback semantics.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Token bucket and distributed quotas

**Recognize:** Clients need a sustained quota with controlled bursts.

**Apply:** Refill tokens at rate r up to capacity b, atomically spend on acceptance and return retry guidance when empty. Shard by tenant or allocate local token budgets.

**Failure:** Concurrent nonatomic reads overspend. Regional allocations can create bounded global overshoot.

**Boundary:** Use a concurrency limit as well when requests have variable duration.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Backpressure and admission control

**Recognize:** Downstream work capacity is lower than incoming demand.

**Apply:** Bound queues and in-flight work; reject or delay before expensive processing. Propagate pressure upstream and prioritize essential operations. Monitor queue age and rejection rates.

**Failure:** Unbounded buffers hide overload until timeouts and memory exhaustion happen together.

**Boundary:** Only slow producers that can actually respond; otherwise shed load explicitly.

- [Site Reliability Engineering · Google](https://sre.google/sre-book/table-of-contents/)

### Home-region ownership and active-active merge

**Recognize:** Users are global and regional failure matters.

**Apply:** Assign authoritative write ownership per entity, or choose operations with a valid merge model. Replicate projections close to users. Fence ownership transfer and define recovery point objectives.

**Failure:** Two writable owners can violate invariants during a partition. Clock-based last-write-wins may discard valid changes.

**Boundary:** Arbitrary financial or inventory invariants do not become safe by selecting a CRDT.

- [Spanner · Google research](https://research.google/pubs/spanner-googles-globally-distributed-database/)

### Anti-entropy and reconciliation

**Recognize:** Replicas or derived views can diverge over time.

**Apply:** Compare versioned ranges, checksums or trees to locate differences, then repair from authoritative history or a domain merge rule. Keep tombstones long enough to prevent resurrection.

**Failure:** Repair traffic can overload nodes; deleting tombstones too early revives old data.

**Boundary:** Reconciliation detects some violations after the fact and cannot replace precondition enforcement.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

### Strangler migration and expand-contract

**Recognize:** A live system must change without a flag-day replacement.

**Apply:** Move one route or capability at a time behind an abstraction. Add compatible schemas, backfill with versions, compare outputs and switch reads before removing old paths.

**Failure:** Mixed versions and dual writes can diverge. Define a rollback boundary before destructive changes.

**Boundary:** A full distributed migration is excessive for a small offline transformation.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Control plane and data plane

**Recognize:** Configuration management should not be on every serving request.

**Apply:** Validate and distribute versioned configurations through a control plane. Serving nodes retain a known-good configuration and report applied versions. Specify how revocations propagate.

**Failure:** Stale configuration may be unsafe for access revocation even if serving remains available.

**Boundary:** Do not place a remote control-plane lookup in every latency-sensitive request by default.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### Cells and shuffle sharding

**Recognize:** A large tenant or failure should affect a bounded subset of customers.

**Apply:** Assign tenants to independently capacity-limited cells, each with its own serving resources. Use placement and spare capacity to avoid correlated overload; rehearse tenant movement.

**Failure:** Shared global dependencies can defeat cell isolation. Moving tenants needs consistent routing.

**Boundary:** Small services may get enough isolation from simpler bounded pools.

- [Builders’ Library · AWS](https://aws.amazon.com/builders-library/)

### CRDTs and convergent operations

**Recognize:** Offline or regional updates must merge without coordination for selected operations.

**Apply:** Choose a mathematically defined state or operation merge, such as per-replica grow-only counters merged by componentwise maximum. Specify deletion, identity and garbage-collection semantics.

**Failure:** A naive sum of repeated states double-counts. Tombstone and replica lifecycle rules matter.

**Boundary:** Convergence alone cannot preserve arbitrary constraints such as no overdraft.

- [Distributed systems pattern catalog](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Design questions

### URL shortener

**Scope:** Create links, redirect by code and expire or delete links. Exclude custom analytics initially. Redirects dominate; deleted or malicious links must stop resolving within a stated freshness bound.

**Capacity assumptions:** Assume 100M redirects/day: about 1,157/s average and 11,570/s at 10× peak. At 1M new links/day and 500 bytes of metadata, raw growth is about 500 MB/day before indexes and replication.

**API:** POST /links {url, expiry, request_id}; GET /{code}; DELETE /links/{id}. Authenticate creation and deletion; validate schemes and prevent unsafe redirects.

**Data:** links(code UNIQUE, owner_id, destination, expires_at, status, version). Generate a sufficiently large random code with a unique insert-and-retry or allocate unique IDs and encode them.

1. Client → redirect edge/service → cache
2. Cache miss → mapping store → cache fill with TTL
3. Create → validate → unique insert → return code
4. Click events → bounded asynchronous analytics pipeline

**Decision:** Choose redirect status and cache headers to match edit/delete semantics. Very long browser caching undermines immediate revocation. A cache protects hot links; partitioning the store does not split one hot key.

**Failure:** If storage is unavailable, serve an allowed cached mapping or fail explicitly. Tombstones and bounded TTL prevent deleted links from resurfacing; abuse rules must also cover cached redirects.

**Follow-ups:**
- How does a viral link change your bottleneck?
- What if links must be unguessable?
- How do you invalidate a cached malicious destination?

### Distributed rate limiter

**Scope:** Enforce per-tenant API budgets with bursts and return retry guidance. Define whether limits must be exact globally or can have bounded overshoot. Protect both rate and expensive concurrent work.

**Capacity assumptions:** At 100K decisions/s, one remote store call per request also means 100K store operations/s. Local token allocations reduce coordination but require an explicit overshoot bound.

**API:** check(tenant, route, cost) → allowed, remaining, retry_after. Management API changes versioned policies separately from the request path.

**Data:** bucket(tenant, route, tokens, last_refill, policy_version). Update refill and spending atomically; choose a trusted time source and clamp backward elapsed time.

1. Request → authenticated tenant → local policy
2. Atomic bucket decision → accept or reject
3. Accepted request → concurrency gate → service
4. Policy service → versioned configuration distribution

**Decision:** Token buckets support bursts; a sliding log is more exact for rolling windows but costs more memory. Per-region quotas bound coordination but can leave unused capacity in one region.

**Failure:** State-store outage needs a documented fail-open, fail-closed or conservative local allowance policy. Bound the fallback per tenant so a partition cannot unlock unlimited traffic.

**Follow-ups:**
- How do you handle a hot tenant?
- How much can two regions overshoot?
- How do policy reductions affect already issued local tokens?

### Distributed cache

**Scope:** Provide get/set/delete with TTL for disposable values. Define maximum object size, eviction behavior and acceptable miss handling. Durability is not required unless the contract explicitly says so.

**Capacity assumptions:** 100M entries × 1 KB is 100 GB of values, before keys, allocator overhead, metadata and replication. Reserve memory headroom rather than filling RAM to the last byte.

**API:** GET key; SET key value ttl version; DELETE key. Optional compare-and-set prevents older fills replacing newer versions.

**Data:** Key ownership map with epochs; per-node hash table plus expiration and eviction structures. Stable virtual partitions allow gradual movement.

1. Client → routing layer → partition owner
2. Miss → caller fetches authoritative source
3. Membership change → warm or migrate partitions
4. Hot key → read replicas or local bounded cache

**Decision:** Client routing saves a proxy hop but complicates membership updates. A proxy centralizes routing but adds capacity and failure concerns. Eviction policy should reflect workload and object sizes.

**Failure:** Node loss creates correlated misses. Rate-limit refills, coalesce per-key requests and keep spare source capacity. Do not turn cache replication into a false promise of database durability.

**Follow-ups:**
- How do you detect a hot key?
- What happens during rebalancing?
- How do you prevent a cache stampede after restart?

### Distributed key-value store

**Scope:** Support key lookup and conditional writes with a precise consistency contract. Decide whether ranges and multi-key transactions are in scope. Acknowledged durability and behavior during partitions are central.

**Capacity assumptions:** 1B records × 1 KB is 1 TB raw. Three replicas require about 3 TB before indexes, logs and compaction. Benchmark peak write throughput and skew per partition.

**API:** GET key; PUT key value expected_version; DELETE key expected_version. Return an explicit conflict when the version precondition fails.

**Data:** Partition map; versioned records and tombstones; durable write-ahead log; replica membership and committed positions.

1. Client → partition router → leader
2. Leader → durable quorum log → commit → apply
3. Read → leader or protocol-safe read path
4. Snapshot and log catch-up → replacement replicas

**Decision:** Start with linearizable single-key operations via a proven consensus group per partition. Read replicas need a safe read protocol or an explicitly weaker consistency mode. Avoid claiming R+W>N alone proves correctness.

**Failure:** A minority partition rejects writes. Ownership changes require epochs and log catch-up. Compaction must preserve needed tombstones; backup restoration must not resurrect deleted values.

**Follow-ups:**
- How does membership change safely?
- What is the write acknowledgment point?
- What changes for cross-key transactions?

### Notification platform

**Scope:** Send email, push and SMS from durable business events. Support preferences, priority and retry limits. Distinguish accepted, dispatched and provider-confirmed delivery.

**Capacity assumptions:** 50M notifications/day is about 579/s average; a campaign can produce a much higher burst. Provider rate limits and fanout, not just daily average, determine drain time.

**API:** POST /notifications {event_id, recipient, template, channel}; GET /notifications/{id}. Management endpoints update preferences and templates.

**Data:** notification(id, event_id, recipient, channel, state, attempt, next_attempt_at); unique dedup key; versioned templates and preference snapshots where appropriate.

1. Business transaction → outbox → notification queue
2. Dispatcher → preference and quota checks
3. Channel worker → provider with stable request key
4. Provider callback → validated status transition

**Decision:** Separate priority queues prevent marketing traffic from delaying security messages. Recheck unsubscribe rules before dispatch. Queue acceptance is not evidence of delivery.

**Failure:** A provider timeout leaves status unknown. Query provider state or retry with provider-supported idempotency. Without that support, explain the remaining duplicate risk and reconcile callbacks.

**Follow-ups:**
- How do you prevent duplicate SMS charges?
- What if a provider is down for six hours?
- How do you handle an unsubscribe during a campaign?

### Social news feed

**Scope:** Publish posts, follow users and read a paginated feed. Start with chronological ordering; add ranking later. Define freshness, visibility changes and deletion semantics.

**Capacity assumptions:** 10M daily users × 20 feed reads = 200M reads/day. A producer with 10M followers makes naive fanout-on-write create 10M inbox updates per post.

**API:** POST /posts; PUT /follows/{user}; GET /feed?cursor=... . Use stable post IDs and cursor tie-breakers.

**Data:** posts(author_id, post_id, time, visibility, version); follows; inbox(user_id, sort_key, post_id). Store pointers rather than duplicating large post bodies.

1. Publish → authoritative post and outbox
2. Fanout workers → ordinary follower inboxes
3. Read → inbox plus high-fanout authors → merge/rank
4. Hydrate posts → enforce current visibility → return cursor

**Decision:** Use a measured hybrid fanout threshold. Precomputation reduces read cost but increases storage and write amplification; pull-based reads are cheaper for infrequent users and celebrity producers.

**Failure:** Fanout lag should degrade freshness, not lose the authoritative post. Deletions and blocks require query-time filtering plus asynchronous cleanup. Ranking changes complicate stable pagination.

**Follow-ups:**
- What if a celebrity posts during peak load?
- How do you handle new followers?
- Can a deleted post remain in a cached feed?

### Chat and group messaging

**Scope:** Support direct and group messages, durable history, reconnect and device sync. Guarantee ordering per conversation, not globally. Distinguish server acceptance, device delivery and user read receipts.

**Capacity assumptions:** 5M concurrent connections × an assumed 20 KB of gateway state is 100 GB across gateways, before buffers. Message and fanout rates need separate estimates.

**API:** POST /conversations/{id}/messages {client_message_id, body}; GET history?after_seq=...; WebSocket event stream with acknowledgments.

**Data:** messages(conversation_id, sequence, message_id, sender, body); membership; device cursors. Unique client_message_id per sender prevents repeated sends.

1. Client → authenticated gateway → conversation owner
2. Owner → durable ordered append → acknowledge
3. Delivery stream → member gateways
4. Reconnect → fetch messages after persisted device cursor

**Decision:** A conversation leader or partition orders messages. Presence is ephemeral and eventually consistent. Large groups need different fanout policies; one group can become a hot partition.

**Failure:** Gateway loss triggers reconnect and replay. Redelivery is safe via message IDs. Check membership on send and history access; a cached group list must not grant revoked access indefinitely.

**Follow-ups:**
- How do multiple devices synchronize?
- What is the ordering guarantee across regions?
- How does a million-member channel change fanout?

### File storage and synchronization

**Scope:** Upload, download, share and sync versioned files. Support interrupted uploads and conflicting offline edits. State whether automatic merge is supported for arbitrary binary files.

**Capacity assumptions:** 1M uploads/day × 5 MB is 5 TB/day raw ingress. Metadata is much smaller but more transactional; bandwidth and retained versions dominate cost.

**API:** POST /uploads; PUT signed part URL; POST /uploads/{id}/finalize; GET /changes?cursor=...; conditional update using base_version.

**Data:** files(file_id, owner, current_version, permissions); versions(file_id, version, manifest, checksum); chunk references; ordered user change log.

1. Client → create scoped upload session
2. Client → multipart object storage upload
3. Finalize → verify checksums → conditionally publish version
4. Change log → device sync cursor → fetch missing chunks

**Decision:** Chunk deduplication reduces repeated bytes but complicates reference counting and privacy. Concurrent binary edits can produce explicit conflict copies rather than silently overwriting one version.

**Failure:** Orphan uploads need garbage collection. Finalize retries must be idempotent. Permission revocation must cover download capabilities, cached metadata and shared links within defined bounds.

**Follow-ups:**
- What if two devices edit offline?
- How do you resume a 10 GB upload?
- How do you safely garbage-collect shared chunks?

### Video upload and streaming

**Scope:** Upload videos, transcode asynchronously and play adaptive bitrate streams. Separate on-demand video from live streaming. Define when a video becomes playable and how private content is protected.

**Capacity assumptions:** 100K uploads/day × 100 MB is 10 TB/day raw input. One million viewers at 3 Mbps consume about 3 Tbps aggregate delivery bandwidth; a CDN is a dominant component.

**API:** POST /videos/upload-session; POST /videos/{id}/finalize; GET /videos/{id}/playback. Return pending/processing/ready/failed states.

**Data:** asset(id, owner, source_ref, version, state); rendition(asset_id, bitrate, object_prefix, checksum); manifest; durable jobs.

1. Upload → verified source object → outbox
2. Transcode queue → workers → immutable segments
3. Validate renditions → publish manifest
4. Player → authorized manifest → CDN segments

**Decision:** Precompute popular renditions to reduce playback startup time. More renditions increase compute and storage. Shorter segments aid adaptation but increase request overhead.

**Failure:** Worker crashes retry a versioned job safely. Never publish an incomplete manifest. CDN cache misses can overwhelm origin; isolate private cache keys and revoke access deliberately.

**Follow-ups:**
- How does live video change latency?
- What if a transcode job is stuck?
- How do you delete all derived copies?

### Search autocomplete

**Scope:** Return top suggestions for a prefix with low latency. Define language support, personalization, moderation and freshness. Keep full document search outside the initial scope.

**Capacity assumptions:** 10M users × 20 searches × 5 keystroke requests yields 1B lookups/day before debouncing. At roughly 11.6K/s average, hot prefixes benefit greatly from caching.

**API:** GET /suggest?q=prefix&locale=... with length limits and top-k cap. Avoid leaking private user queries into shared suggestions.

**Data:** Versioned prefix index containing bounded ranked candidates; popularity aggregates; suppression list. Normalize text consistently at build and query time.

1. Sanitized events → aggregate popularity → build candidate index
2. Validate new index → atomic version switch
3. Query → prefix cache → index lookup → moderation filter

**Decision:** A trie offers prefix traversal; precomputed top-k per prefix trades memory for fast reads. Global popularity can refresh in batches while urgent moderation requires a fast override.

**Failure:** Retain a previous valid index for rollback. Prevent untrusted query floods from distorting rankings. Apply removal rules on the serving path so banned suggestions do not wait for a full rebuild.

**Follow-ups:**
- How do you support typos?
- How do non-Latin languages change normalization?
- How do you prevent cache leakage from personalization?

### Web crawler

**Scope:** Discover and fetch allowed public pages with per-host politeness, deduplication and recrawl scheduling. Respect access restrictions and robots policies; avoid private-network fetching.

**Capacity assumptions:** 100M pages/day is about 1,157 fetches/s. At 200 KB/page, raw ingress is about 20 TB/day, before parsing outputs and storage copies.

**API:** Internal enqueue(url, priority, next_fetch_at); claim(host); recordFetch(url, status, digest). Operator controls pause hosts and set budgets.

**Data:** URL frontier keyed by normalized URL; host schedules; fetched content hashes; robots/cache metadata; crawl history.

1. Seeds → URL normalization and policy checks
2. Host-aware scheduler → fetch workers
3. Content store → parser → discovered URLs
4. Dedup and priority → frontier for future work

**Decision:** Deduplicate both URLs and content. A Bloom filter can reduce lookups but false positives may skip unseen URLs unless verified. Avoid unbounded URL spaces such as calendar parameters and session IDs.

**Failure:** Retries preserve per-host budgets. Resolve and validate destination addresses to prevent SSRF and DNS rebinding into internal networks. Back off slow hosts and bound response sizes.

**Follow-ups:**
- How do you detect crawler traps?
- How do you prioritize recrawls?
- What if one host publishes a billion URLs?

### Metrics and monitoring platform

**Scope:** Ingest time-series samples, query aggregates and evaluate alerts. Specify retention, resolution, acceptable lag and cardinality limits. Separate high-cardinality logs from metric labels.

**Capacity assumptions:** 1M series sampled every 10 seconds produces 100K samples/s. At 16 bytes per raw sample, that is about 138 GB/day, excluding labels, indexes and replicas.

**API:** POST /samples with batch and size limits; GET /query?expression=...; POST /alert-rules. Authenticate tenant scope on ingest and query.

**Data:** series fingerprint from metric and normalized labels; time-partitioned sample blocks; label index; rule state and alert deduplication key.

1. Agent buffer → ingestion gateway → partitioned durable log
2. Compaction workers → time-series blocks
3. Query planner → shards → partial aggregation
4. Rule evaluator → deduplicated notification pipeline

**Decision:** Downsampling reduces long-term cost but loses detail. Bound label combinations, query range and fanout. Approximate or partial results must be explicitly marked.

**Failure:** Ingestion acknowledgment must match durability guarantees. A monitoring outage should not overload the monitored services; agents need bounded buffers and drop policies. Detect evaluator lag separately.

**Follow-ups:**
- How do you limit a cardinality explosion?
- How do you handle out-of-order samples?
- How do alerts avoid firing twice after failover?

### Distributed job scheduler

**Scope:** Schedule one-off and periodic jobs, retry failures and expose execution history. Define time-zone and daylight-saving semantics. Promise durable scheduling, not magically exactly-once external execution.

**Capacity assumptions:** 10M scheduled jobs/day is about 116/s average, but a common top-of-hour schedule can create a huge synchronized burst. Size for due-time skew and dispatch latency.

**API:** POST /jobs {schedule, timezone, payload, idempotency_key}; DELETE /jobs/{id}; GET /executions/{id}. Version edits and cancellations.

**Data:** job(id, schedule, next_due, version); execution(job_id, scheduled_time UNIQUE, state, lease_generation, attempt); due-time index.

1. Scheduler scans due buckets → atomically creates execution
2. Durable queue → worker claim
3. Worker runs with fenced ownership → records result
4. Rescheduler calculates next occurrence from policy

**Decision:** Separate scheduling from execution. A unique (job, scheduled_time) prevents duplicate execution records, but the task still needs idempotent external effects. Document missed-run and catch-up policy.

**Failure:** Leases recover crashed workers but cannot stop paused workers without fencing. Cancellation races with execution; define whether it prevents future starts or attempts interruption.

**Follow-ups:**
- What happens after one hour of downtime?
- How do you handle DST changes?
- How do you prevent duplicate external effects?

### Payments and ledger

**Scope:** Create payment intents, track provider outcomes and maintain auditable balances. Never treat a timeout as definitive failure. Preserve balanced ledger entries and stable operation identity.

**Capacity assumptions:** 10M transactions/day is about 116/s average. Peak rate matters, but correctness, provider limits, reconciliation and hot accounts usually drive architecture more than raw storage volume.

**API:** POST /payment-intents with idempotency key; POST /intents/{id}/confirm; GET status; signed provider webhook endpoint.

**Data:** intent(id, caller, payload_hash, state); provider_operation; immutable ledger entries grouped by transaction; unique external event IDs; outbox.

1. Request → durable intent claim
2. Provider request with stable key → pending/succeeded/failed state
3. Verified callback or polling → guarded transition
4. Balanced ledger transaction → outbox → downstream projections

**Decision:** Use a local transaction for ledger invariants. Separate authorization, capture and refund states where needed. Reconciliation compares internal intent/ledger records with provider statements.

**Failure:** Duplicate and out-of-order callbacks must not double-credit. Unknown outcomes remain pending for investigation. Do not delete financial history to simulate rollback; record compensating entries.

**Follow-ups:**
- A charge succeeded but your database write failed—now what?
- How do you prevent double refunds?
- Can a balance projection authorize spending?

### Ticket booking and inventory

**Scope:** Browse seats, hold temporarily, pay and confirm. Never confirm the same seat to two owners. Distinguish advisory availability from authoritative reservation status.

**Capacity assumptions:** A launch may receive 1M attempts/minute, roughly 16.7K/s, concentrated on one event. This is a contention problem; evenly distributed global QPS estimates are misleading.

**API:** POST /events/{id}/holds {seat_ids, request_id}; POST /holds/{id}/confirm; GET /holds/{id}. Return explicit expired, unavailable and pending-payment states.

**Data:** seat(event_id, seat_id, state, hold_id, expires_at, version); hold; payment_intent. Acquire multiple seats atomically or document partial acquisition behavior.

1. Waiting room and admission control → booking service
2. Conditional transaction claims seats → durable hold
3. Payment workflow → verified outcome
4. Confirm only the still-owned hold → emit ticket

**Decision:** A hold expiry timestamp is not sufficient by itself. Confirmation checks ownership and expiry at the authoritative transaction boundary. Search can cache availability while final allocation remains serialized per seat.

**Failure:** If payment succeeds after expiry, reconcile and refund or apply an explicit recovery policy; never silently steal a seat already sold. Cleanup is idempotent and cannot free a confirmed seat.

**Follow-ups:**
- How do you acquire four adjacent seats atomically?
- What if payment completes late?
- How do you stop bots exhausting holds?

### Ride matching and live locations

**Scope:** Ingest driver locations, find nearby available drivers and assign each driver to at most one active trip. Location freshness can be approximate; assignment ownership cannot.

**Capacity assumptions:** 1M online drivers updating every five seconds produce 200K location updates/s. Spatial density and hot city cells matter more than uniform global distribution.

**API:** PUT /drivers/{id}/location {seq, time, coordinates}; POST /rides; POST /offers/{id}/accept. Authenticate location ownership.

**Data:** ephemeral spatial cells with timestamped driver locations; authoritative driver availability/version; trip and offer state; location history with retention policy.

1. Location gateway → spatial index
2. Rider request → nearby-cell candidates → distance and freshness filter
3. Conditional driver reservation → timed offer
4. Acceptance → atomic assignment → notify both parties

**Decision:** Separate high-volume ephemeral location updates from durable trip state. Geohash or another spatial cell scheme narrows candidates; exact distance and routing quality require further work.

**Failure:** Stale locations are filtered by age. Duplicate accepts and expired offers cannot create two trips. Reconcile a driver reconnecting after losing the assignment response.

**Follow-ups:**
- How do you handle dense downtown cells?
- How do you prevent simultaneous assignments?
- What changes when a driver crosses a region?

### Collaborative document editor

**Scope:** Edit documents concurrently, reconnect after offline work and preserve convergence. Specify cursor presence, version history and access revocation. Choose conflict semantics before choosing a CRDT or OT implementation.

**Capacity assumptions:** 100K concurrent editors × 2 operations/s is 200K operations/s before fanout. A single huge shared document can dominate one partition and requires its own limits.

**API:** WebSocket submit(document_id, client_id, operation_id, base_version, op); GET snapshot plus operations after version.

**Data:** document snapshots; durable ordered or causally identified operations; per-client acknowledgment positions; membership/permission version.

1. Client applies optimistic local edit → document service
2. Validate operation and permission → durable operation history
3. OT transform or CRDT integration → broadcast
4. Reconnect → snapshot and missing operations → merge

**Decision:** OT transforms concurrent operations against an ordering model; CRDTs define merge rules with metadata costs. Use a proven algorithm. Text editing, rich structures and deletion require precise semantics, not a generic merge function.

**Failure:** Duplicate operations deduplicate by ID. Compact history only when needed causal or transformation context is preserved. Recheck permissions after offline reconnect rather than trusting old session state.

**Follow-ups:**
- How do offline edits merge after a week?
- What happens when access is revoked mid-session?
- How do you compact tombstones safely?

### E-commerce checkout

**Scope:** Convert a cart into an order with price validation, inventory reservation and payment. Define when an order is accepted versus confirmed. Avoid overselling and duplicate charges.

**Capacity assumptions:** 1M orders/day is about 11.6/s average; sale peaks can be hundreds of times higher for a small set of SKUs. Browse traffic should not contend with inventory authorization.

**API:** POST /checkout {cart_version, request_key}; GET /orders/{id}; POST /orders/{id}/cancel. Store a price and tax snapshot for the accepted order.

**Data:** order and line items; inventory reservation; payment intent; durable workflow state; outbox. Each domain owns its state and idempotency boundary.

1. Validate cart and price → create pending order
2. Reserve inventory → request payment
3. Confirm order → enqueue fulfillment
4. Failure → release reservation or refund with explicit compensation

**Decision:** A modular service with local transactions may be sufficient initially. If domains are separated, model a saga instead of pretending database and payment calls share a transaction.

**Failure:** An unknown payment response leaves the order pending reconciliation. Expired inventory and late success require a business policy. Fulfillment must not ship twice after event replay.

**Follow-ups:**
- What if prices change during checkout?
- How do you handle partial fulfillment?
- Which steps can be compensated after shipment?

### Webhook delivery service

**Scope:** Deliver signed events to customer endpoints with retries and visible history. Define per-endpoint ordering and retention. Customers must be able to detect duplicate delivery.

**Capacity assumptions:** 100M deliveries/day is about 1,157/s average. Slow endpoints can consume all connection slots unless tenant and destination concurrency are bounded.

**API:** POST /subscriptions; GET /deliveries/{id}; POST /deliveries/{id}/replay. Each delivery includes event ID, timestamp and signature.

**Data:** subscription(tenant, destination, secret_version); event; delivery(subscription_id, event_id UNIQUE, attempt, next_due, state).

1. Durable event → per-subscription delivery tasks
2. Scheduler → isolated sender pool
3. Signed HTTP request → classify response
4. Record result → backoff or dead-letter after policy limit

**Decision:** Strict endpoint order can block later events behind one poison event; document whether ordering is best effort, per key or strict. Replays preserve event identity but get distinct attempt records.

**Failure:** An HTTP timeout can follow successful processing; receivers need idempotency. Validate destinations against SSRF, re-check resolved addresses and rotate signing secrets with overlap.

**Follow-ups:**
- How do you stop one slow customer blocking others?
- How do retries interact with ordering?
- How do you prevent replay attacks?

### Feature flag platform

**Scope:** Manage targeting rules and serve low-latency evaluations. Define consistency for gradual rollout versus emergency shutoff. Evaluation should continue through a control-plane outage using a valid cached configuration.

**Capacity assumptions:** 100K application instances fetching every minute create about 1,667 fetches/s; pushing only changes reduces repeated bytes but needs connection and recovery handling.

**API:** Control API updates versioned flags; SDK evaluates(flag, context) locally; distribution API fetches snapshot or changes after version.

**Data:** flag rules and versions; environment scopes; audit history; rollout salt; SDK last-applied version and freshness metrics.

1. Admin → validate and authorize → publish version
2. Distribution stream/CDN → SDK snapshots
3. SDK → deterministic targeting and percentage bucket
4. Evaluation telemetry → aggregated impact and freshness

**Decision:** Stable hashing gives consistent rollout cohorts. Avoid sending sensitive targeting data to clients unnecessarily. Server and browser SDK exposure have different trust boundaries.

**Failure:** Retain a known-good config on update failure. Emergency revocation needs a maximum staleness policy and monitoring; indefinite offline evaluation cannot promise instant kill switches.

**Follow-ups:**
- How do you roll back a bad rule?
- How do you keep cohorts stable?
- What does an offline SDK do during an emergency shutdown?

### Clickstream analytics

**Scope:** Ingest events, deduplicate, aggregate by event time and support historical queries. Define acceptable lateness and whether counts are approximate or billing-grade.

**Capacity assumptions:** 1B events/day is about 11.6K/s average. At 500 bytes/event, raw storage is about 500 GB/day; 30 days is 15 TB before compression and replication.

**API:** POST /events batch with event_id, event_time, schema_version; GET aggregate query with bounded range and dimensions.

**Data:** Partitioned raw event log; object-store archive; window state; aggregate tables keyed by dimensions and window; schema registry.

1. Client batch → validated ingest → durable log
2. Stream processor → dedup and event-time windows
3. Aggregates → query store
4. Raw archive → replay/backfill and reconciliation

**Decision:** Exactly-once aggregation depends on atomic state/checkpoint behavior and deduplication scope. Late corrections and historical recomputation must not double-add old totals.

**Failure:** Malformed events go to a visible quarantine path. Watermarks need idle-partition handling. Replays use versioned output or overwrite-by-key semantics so recovery does not inflate results.

**Follow-ups:**
- How do you handle events arriving a day late?
- How do you fix a bad aggregation deployment?
- When is approximate distinct counting acceptable?

### Global leaderboard

**Scope:** Accept validated score updates and return top-k plus a user’s rank. Define tie-breaking, time windows and whether rank must be exact and immediately fresh.

**Capacity assumptions:** 10M players with 10 updates/day produce 100M updates/day, about 1,157/s average. Reading top 100 is cheap; exact arbitrary global rank across shards is the difficult operation.

**API:** POST /scores {match_id, player_id, score}; GET /leaderboard?season=...; GET /players/{id}/rank.

**Data:** Authoritative match outcomes with unique IDs; per-player season score; ordered score index with deterministic tie-breaker; historical season snapshots.

1. Trusted match result → idempotent score transaction
2. Event → ordered leaderboard projection
3. Top-k → cached snapshot
4. Rank → score index or explicitly approximate partition aggregate

**Decision:** A single ordered structure may fit the scale; do not shard prematurely. Sharded top-k can merge local candidates, but exact per-user rank requires more coordination or a specialized index.

**Failure:** Replay must not add a match twice. Late match results need a season closure policy. Anti-cheat validation happens before authoritative score acceptance, not only in the UI.

**Follow-ups:**
- How do you resolve equal scores?
- How do you compute exact global rank?
- How do you remove a fraudulent result?

### Log ingestion and search

**Scope:** Collect structured logs, retain them affordably and search by tenant, time and selected fields. Define durability, redaction and deletion requirements. Bound query cost.

**Capacity assumptions:** 100K events/s × 1 KB is 100 MB/s, about 8.64 TB/day raw. Indexing every field can cost far more than raw storage; hot and cold retention tiers matter.

**API:** POST /logs in compressed batches; POST /queries for asynchronous expensive searches; GET /queries/{id}/results.

**Data:** Tenant/time-partitioned immutable objects; selected field indexes; ingestion offsets; schema and redaction policy versions; query job state.

1. Agent bounded buffer → ingestion gateway
2. Durable log → storage/index workers
3. Hot index → recent queries
4. Cold objects → bounded distributed scan → results

**Decision:** Index frequently filtered fields and scan colder data when latency permits. Separate operational logs from metrics so high-cardinality values do not explode metric series.

**Failure:** Agents need a clear drop or disk-spool policy when ingestion fails. Redact secrets before durable storage. Tenant filters must apply to both the index and object-store access.

**Follow-ups:**
- How do you handle a noisy tenant?
- How do you delete sensitive logs across tiers?
- How do you query during an index outage?

### Nearby places and map tiles

**Scope:** Serve map tiles and search nearby places. Keep full turn-by-turn routing outside the first design. Specify map freshness, search radius and privacy for location queries.

**Capacity assumptions:** 10M sessions/day × 50 tile fetches is 500M requests/day; at 30 KB/tile, about 15 TB/day of delivered bytes before cache reuse. Nearby search has a separate compute profile.

**API:** GET /tiles/{version}/{z}/{x}/{y}; GET /places?lat=...&lon=...&radius=... with radius and result limits.

**Data:** Immutable tile objects keyed by version and coordinates; place records with geometry and version; spatial index by hierarchical cells.

1. Geodata updates → validated tile generation → immutable objects
2. Client → CDN tile fetch
3. Nearby query → intersecting cells → candidate lookup
4. Exact distance filter → rank and return bounded results

**Decision:** Hierarchical cells let dense areas subdivide while sparse areas stay coarse. Geospatial proximity is not road travel time; a river can make a nearby destination far away by road.

**Failure:** Roll out map versions atomically through manifests to avoid mixed data. Exclude stale or deleted places via versioned updates. Avoid retaining precise user location unnecessarily.

**Follow-ups:**
- How do you handle the date line?
- Why is straight-line distance insufficient for routing?
- How do you invalidate a changed tile?

### Distributed identifier generator

**Scope:** Generate unique IDs across many writers with a defined size and ordering property. Clarify whether IDs must be strictly globally increasing, roughly time-sortable, unguessable or simply unique. These are different contracts.

**Capacity assumptions:** An illustrative 64-bit layout can reserve one sign bit, 41 timestamp bits, 10 worker bits and 12 sequence bits. At millisecond resolution the timestamp range is about 69.7 years, with 1,024 worker slots and at most 4,096 IDs per worker per millisecond. These are layout limits, not measured throughput.

**API:** nextId() locally under a valid worker assignment; allocator API grants worker_id and generation. Optionally expose a batch API when clients cannot safely run a local generator.

**Data:** Durable worker assignment and fencing generation; last emitted timestamp and sequence per worker; chosen epoch and encoding specification. Consumers must preserve full integer precision, for example by using strings in JSON.

1. Allocator → unique worker slot and generation
2. Local monotonic policy → timestamp and sequence
3. Sequence exhaustion → wait for next valid tick or fail
4. Encoded ID → durable application record with uniqueness constraint

**Decision:** Time-sortable IDs reduce random index insertion but do not prove real-time global ordering. For opaque public identifiers, a suitably large random ID may be simpler. Strict global sequence allocation requires coordination and changes availability.

**Failure:** Clock rollback must trigger a documented wait, logical timestamp policy or rejection. Never reuse a worker slot while the previous generator can still emit colliding IDs. Process restarts must preserve enough state or wait out overlap safely.

**Follow-ups:**
- What happens if the clock moves backward?
- How do you safely reassign a worker slot?
- Why might clients corrupt a 64-bit ID stored as a JavaScript number?

### Recommendation serving platform

**Scope:** Retrieve and rank personalized items under a latency budget while enforcing current visibility. Include cold-start users, model rollout and feedback collection. Exclude training algorithm internals from the serving design.

**Capacity assumptions:** 20M daily users × 10 requests = 200M requests/day, about 2,315/s average. At 5× peak and 500 scored candidates/request, ranking handles roughly 5.8M candidate evaluations/s; batching and model cost dominate.

**API:** GET /recommendations?cursor=...; POST /exposures and /feedback with event IDs, request IDs and model versions. Do not accept client claims as trusted conversion outcomes without validation.

**Data:** Item catalog and eligibility state; versioned embeddings/indexes; online feature snapshots with timestamps; model registry; exposure/feedback log; experiment assignments.

1. Request → user/context features → candidate sources
2. Candidate merge → versioned ranking model
3. Current eligibility filter → response and exposure ID
4. Feedback log → offline/stream features → validated model/index rollout

**Decision:** Budget candidate retrieval, feature access and ranking separately. Fall back to a current-policy-filtered popular list when expensive personalization misses its deadline. Version features and models together to diagnose skew.

**Failure:** Stale candidates must not expose deleted or blocked content. A bad model rollout needs a pointer rollback and guardrail alerts. Feedback retries deduplicate so a client reconnect cannot inflate engagement.

**Follow-ups:**
- How do you handle a new user?
- What if online and training features differ?
- How do you roll back a bad model without rebuilding everything?

### Ad auction and budget platform

**Scope:** Select eligible ads, run an explicitly chosen auction, enforce spend and frequency limits, and record auditable billing events. Distinguish an auction win, an impression and a billable conversion.

**Capacity assumptions:** 100K auctions/s × 100 eligible candidates creates 10M scoring operations/s before filtering. If bids must return within 100 ms, all remote calls need smaller deadlines and bounded fanout.

**API:** POST /auctions with request ID and bounded context; POST /impressions and /conversions with verifiable event identities; campaign APIs update budgets and targeting.

**Data:** Versioned campaign rules; regional spend allocations and reservations; immutable auction outcomes; deduplicated impression/conversion events; ledger and correction records.

1. Request → eligibility and frequency checks
2. Candidate bids → deadline-bounded scoring/auction
3. Atomic budget reservation → winning response
4. Validated impression → commit spend → reconciliation and attribution

**Decision:** Use regional escrow allocations for bounded spend without global coordination on every auction. The auction pricing rule is a product assumption; the example uses first-price billing, not a claim about any particular platform.

**Failure:** A region cannot spend another region’s unused allocation during a partition without a safe transfer. Reservations expire only under a defined late-impression policy. Duplicate events must never double-bill.

**Follow-ups:**
- How do you bound overspend across regions?
- What if a winning impression arrives after reservation expiry?
- How do you attribute conversions days later?

### Distributed batch processing engine

**Scope:** Run DAG jobs over immutable input snapshots, retry failed tasks and publish one consistent output version. Support cancellation, skew handling and worker loss. Define supported task side effects.

**Capacity assumptions:** 10 TB / 256 MB is approximately 39,063 decimal input splits. At 100 MB/s per worker, the ideal read-only lower bound for 100 workers is about 1,000 seconds; shuffle, compute and skew add time.

**API:** POST /jobs {dag, input_manifest, output_target}; GET /jobs/{id}; POST /jobs/{id}/cancel. Workers claim task attempts with generation tokens.

**Data:** Job DAG and stage dependencies; immutable input manifest; task/attempt records; intermediate block locations; committed output manifest and garbage-collection metadata.

1. Coordinator → ready tasks → leased worker attempts
2. Map output → partitioned shuffle blocks
3. Reducers → attempt-specific immutable output
4. Conditional manifest commit → visible job result

**Decision:** Retry tasks rather than whole jobs when intermediate data is recoverable. Speculate stragglers only when extra work can help. Commit one winning attempt; tasks must avoid uncoordinated external side effects.

**Failure:** Worker loss invalidates its unavailable shuffle blocks and triggers recomputation. Coordinator failover recovers durable task state. Cancellation fences future commits and cleans orphan outputs after a safe interval.

**Follow-ups:**
- How do you handle a heavily skewed key?
- Can speculative attempts both publish results?
- How do you recover lost shuffle files?

### Distributed SQL database

**Scope:** Offer transactional indexed reads and writes across partitions with a stated isolation level and acknowledgment contract. Include shard movement and recovery. Begin with single-region durability, then explain the global extension.

**Capacity assumptions:** A 2 TB logical dataset with three full replicas uses at least 6 TB before indexes, WAL and snapshots. A cross-region write quorum can put network round trips on every commit; calculate from placement rather than node count alone.

**API:** SQL transaction API with retryable serialization errors; begin/commit/rollback; prepared statements; explicit limits on transaction duration and result size.

**Data:** Range/partition metadata; MVCC row and index versions; per-shard replicated logs; transaction coordinator records and participant intent state; backup manifests.

1. SQL gateway → plan and locate partitions
2. Participants → validate/prepare writes in replicated state
3. Coordinator → durable atomic decision
4. Apply commit → safe reads at appropriate versions

**Decision:** Consensus within a shard protects replicated state; a commit protocol across shards protects atomicity. Neither alone guarantees serializable query execution. Secondary indexes and predicate conflicts need explicit isolation support.

**Failure:** A prepared participant cannot independently abort after another committed. Recovery resolves the durable transaction decision. Shard movement requires ownership epochs, state transfer and protection against stale routers.

**Follow-ups:**
- How do cross-shard transactions recover?
- What makes a follower read safe?
- How do you move a shard with ongoing writes?

### Parking garage: low-level design

**Scope:** Allocate compatible spots, issue tickets, price stays and release spots after an explicit exit decision. Support multiple gates racing for the same capacity. Model failed and pending payments without losing occupancy state.

**Capacity assumptions:** A garage with 5,000 spots and 20 gates does not need a distributed database by default. At 2 entries/s per gate, 40 claims/s is modest; correctness under simultaneous claims is the central constraint.

**API:** enter(vehicle, requestKey) → Ticket or Full; quote(ticketId, exitTime) → Money; pay(ticketId, paymentKey) → PaymentState; exit(ticketId, expectedVersion) → Result.

**Data:** Spot(id, class, state, version); Ticket(id, spotId, entryTime, state); immutable Money; PricingPolicy and AllocationPolicy interfaces; injected Clock and PaymentGateway.

1. Gate → ParkingService → AllocationPolicy candidate
2. Repository transaction → claim spot and create ticket
3. Exit quote → PaymentGateway → durable payment state
4. Guarded exit transaction → close ticket and release spot

**Decision:** The policy chooses a candidate; only the repository transaction grants ownership. Keep pricing pure and testable. Composition supports hourly and flat-rate pricing without spreading conditional branches through Ticket.

**Failure:** A gate timeout retries the same entry key. A payment timeout leaves a pending outcome. Repeated exits cannot release a spot now occupied by a newer ticket: compare both spot owner and version.

**Follow-ups:**
- How do you prevent two gates allocating one spot?
- How do you test time-based pricing?
- What if an old exit request arrives after the spot is reused?

### Extended walkthrough: URL shortener

**Numerical deep dive.** At 11,570 peak redirects/s and an assumed 99% cache hit rate, the source sees about 116 reads/s. A cold cache exposes the full 11,570/s. Eight base62 characters provide 62^8 ≈ 2.18×10^14 possible codes; randomness still requires collision detection rather than assuming zero collisions.

**Alternatives:**
- A sequence allocator gives collision-free allocation but reveals order unless transformed and needs an availability plan.
- Random codes distribute allocation, but unique insertion and bounded collision retries are mandatory.

**Failure timeline:**
- T0: reader misses cache and reads version 1.
- T1: owner deletes the link and stores tombstone version 2.
- T2: delayed reader tries to fill version 1.
- T3: version-aware fill rejects it, or a documented TTL bounds staleness; strict revocation checks the authoritative deny state.

**Migration.** Move from one mapping table to partitions by backfilling code ranges, replaying changes with versions, comparing lookups, then switching routing by range. Keep the previous source readable during rollback; avoid unversioned dual writes.

**Hints:** Which operation dominates, and what is the freshness promise after deletion? / Trace a read racing with deletion before adding more storage nodes.

**How does a viral link change your bottleneck?**

A viral link is one hot key: serve from edge/local caches and coalesce misses. More hash shards alone do not split its owner.

**What if links must be unguessable?**

Use sufficient random entropy, rate-limit guessing and keep private-link authorization separate. An opaque code reduces guessing but does not authenticate a viewer.

**How do you invalidate a cached malicious destination?**

Publish a tombstone or deny rule to the serving path and invalidate caches. Browser-cached redirects impose a limit unless their original cache policy allowed prompt revocation.

**Weak reasoning.** Redis solves redirects and deletions.

**Stronger reasoning.** The database owns mapping state. A versioned cache handles common reads; TTL and revocation checks define stale-read behavior, and bounded fills protect a cold source.

### Extended walkthrough: Distributed rate limiter

**Numerical deep dive.** A bucket with capacity 100 and refill 10/s accepts an initial burst of 100, then about 10/s. If five regions each receive a nonoverlapping allocation of 20 tokens, aggregate immediate spending is bounded at 100; granting each region a full 100 instead permits 500.

**Alternatives:**
- A shared atomic store gives precise per-key decisions at the cost of a network hop and a hot-key ceiling.
- Local allocated budgets lower latency but can waste unused capacity and require safe renewal.

**Failure timeline:**
- T0: two callers read 1 remaining token.
- T1: both independently subtract one.
- T2: both accept, violating the limit.
- T3: replace the read/write pair with one atomic refill-and-spend operation; test simultaneous requests against one remaining token.

**Migration.** Version policies, shadow-evaluate the new algorithm, compare accept/reject differences and roll out by tenant. Policy reductions must account for tokens already leased to nodes; otherwise the new global bound is not immediate.

**Hints:** Does the contract require an exact global limit or bounded overshoot? / Decide the outage policy before choosing a shared store.

**How do you handle a hot tenant?**

Shard independent tenants, but a single hot tenant needs local allocation or dedicated capacity. Define fairness and maximum local budget.

**How much can two regions overshoot?**

Bound overshoot from outstanding allocations plus in-flight accepted work; do not multiply a global budget independently in each region.

**How do policy reductions affect already issued local tokens?**

Honor existing allocations until expiry or revoke through a coordinated generation protocol. Publish the effective-time semantics of a lower limit.

**Weak reasoning.** Use a counter with a TTL.

**Stronger reasoning.** I atomically refill and spend tokens, bound outstanding regional allocations, and define conservative behavior when the coordinator is unavailable.

### Extended walkthrough: Distributed cache

**Numerical deep dive.** 100 GB of values plus an assumed 50% metadata/allocator overhead is 150 GB; two copies make 300 GB. At a target 60% memory occupancy, provision about 500 GB before workload-specific fragmentation. These assumptions need measurement.

**Alternatives:**
- Client-side routing avoids a proxy hop but distributes membership logic to every client.
- A proxy simplifies routing changes but adds another capacity tier; replicated hot keys may require separate invalidation.

**Failure timeline:**
- T0: one node owns a popular partition.
- T1: it fails and clients reroute to empty replacements.
- T2: synchronized misses threaten source capacity.
- T3: singleflight, fill concurrency limits and staged warming preserve useful throughput while hit rate recovers.

**Migration.** Add virtual partitions gradually and move a bounded fraction at a time. Measure source misses and stop movement if fallback capacity saturates. Since values are disposable, a cold move may be simpler than copying, but its miss cost must be budgeted.

**Hints:** What is disposable, and where does a miss go? / Size memory overhead and the all-miss condition, not just stored values.

**How do you detect a hot key?**

Measure request rate and byte load by sampled key and owner; distinguish one hot object from an overloaded shard.

**What happens during rebalancing?**

Route with ownership epochs, limit simultaneous moves and tolerate misses. Cache movement must not become a source overload event.

**How do you prevent a cache stampede after restart?**

Coalesce fills, jitter TTLs and cap fallback concurrency; warm the most valuable keys from measured traffic.

**Weak reasoning.** Consistent hashing prevents hot spots.

**Stronger reasoning.** Consistent hashing limits remapping across node changes. A single hot key needs replication or local caching, and invalidation still needs a freshness contract.

### Extended walkthrough: Distributed key-value store

**Numerical deep dive.** At 50K writes/s with 1 KB values and three replicas, raw replicated payload is about 150 MB/s before WAL and compaction. If measured storage write amplification is 6, physical writes can approach 900 MB/s across the fleet; do not count amplification as extra logical traffic.

**Alternatives:**
- Leader-based quorum replication simplifies linearizable single-key writes but loses progress without quorum.
- Multi-leader merging can improve partition availability only for operations with acceptable conflict semantics.

**Failure timeline:**
- T0: leader records request r and replicates it to quorum.
- T1: commit occurs but the reply is lost.
- T2: a new leader receives retry r.
- T3: durable request identity returns the prior result; a new identifier would risk a second logical mutation.

**Migration.** Split partitions by snapshotting at an applied index, streaming subsequent log entries and switching an ownership epoch once caught up. Keep forwarding for stale routers; reclaim old copies only after the recovery window.

**Hints:** Choose the consistency contract before partition placement. / Separate durable, committed and applied positions in your diagram.

**How does membership change safely?**

Use the consensus implementation’s supported reconfiguration protocol, preserving required quorum overlap; do not edit node lists ad hoc.

**What is the write acknowledgment point?**

Acknowledge only after the documented durable commit condition, then distinguish commit from state-machine application.

**What changes for cross-key transactions?**

Add transaction coordination and isolation across owners, or restrict atomicity to one key/partition. Cross-key invariants cannot be assumed from single-key CAS.

**Weak reasoning.** Three replicas mean no data loss.

**Stronger reasoning.** The write acknowledgment policy determines durable recovery. A three-voter group needs two for progress, and stale leaders cannot independently commit.

### Extended walkthrough: Notification platform

**Numerical deep dive.** A burst of 1M messages with a provider cap of 1,000/s takes at least 1,000 seconds without new arrivals. If normal traffic consumes 600/s, only 400/s is spare and draining takes 2,500 seconds. Retry traffic consumes the same budget.

**Alternatives:**
- One shared queue is operationally simple but lets campaigns delay urgent messages.
- Separate priority/channel queues isolate urgency and provider limits, with explicit fairness to prevent starvation.

**Failure timeline:**
- T0: worker sends a provider request with operation ID n.
- T1: provider accepts it; the response is lost.
- T2: visibility timeout redelivers n.
- T3: provider idempotency or status reconciliation resolves n; without either, document the duplicate-delivery risk.

**Migration.** Introduce a new provider behind a channel adapter, test callbacks and error mappings, then route a bounded tenant cohort. Do not resend unknown outcomes through another provider until the original operation is resolved.

**Hints:** Does success mean queued, sent, delivered or read? / Identify the crash between provider effect and worker acknowledgment.

**How do you prevent duplicate SMS charges?**

Use a stable provider request key where supported and persist the attempt outcome. If unsupported, duplicates remain possible and require a stated policy.

**What if a provider is down for six hours?**

Retain durable work, expire messages whose usefulness has passed, protect urgent lanes and forecast drain time within provider quotas.

**How do you handle an unsubscribe during a campaign?**

Recheck current preferences at dispatch and enforce legally/product-required suppression immediately; queued work is not an irrevocable authorization to send.

**Weak reasoning.** Retries guarantee delivery once.

**Stronger reasoning.** Retries improve delivery probability but can duplicate effects. I separate acceptance and delivery SLIs and reconcile ambiguous provider outcomes.

### Extended walkthrough: Social news feed

**Numerical deep dive.** A post sent to 10M inboxes at an assumed 32-byte pointer costs 320 MB of logical writes before indexes and replicas. At 100K fanout writes/s, one such post occupies about 100 seconds of worker capacity.

**Alternatives:**
- Push to every inbox gives cheap reads but severe fanout amplification and cleanup work.
- Pull or hybrid feeds reduce celebrity write cost but spend more compute merging candidates on reads.

**Failure timeline:**
- T0: a post is committed and fanout begins.
- T1: some inbox writes succeed, then the worker crashes.
- T2: the post is deleted while fanout retries.
- T3: idempotent inbox keys prevent duplicates and current-visibility checks suppress deleted content even before cleanup finishes.

**Migration.** Build a hybrid read path in shadow mode, compare candidate coverage and latency, then switch users gradually. Keep post storage authoritative so inbox projections can be rebuilt without losing content.

**Hints:** Calculate write amplification for one celebrity before selecting fanout. / Decide which data is authoritative and which is a rebuildable inbox.

**What if a celebrity posts during peak load?**

Pull high-fanout producers at read time or cap fanout and use a hybrid. Isolate fanout capacity from post acceptance.

**How do you handle new followers?**

Backfill a bounded recent history or include followees at read time until the inbox catches up. State how quickly a new follow affects results.

**Can a deleted post remain in a cached feed?**

Yes unless visibility is rechecked or invalidation completes. Filter against current post/block state and asynchronously remove stale pointers.

**Weak reasoning.** Store every feed in Redis.

**Stronger reasoning.** I use durable posts, rebuildable inbox pointers and a hybrid fanout policy. Current authorization filters protect stale projections.

### Extended walkthrough: Chat and group messaging

**Numerical deep dive.** At 100K messages/s, an average of 20 recipients creates 2M delivery events/s before device fanout. Persisting one 1 KB message per send costs 100 MB/s logical storage, while delivery traffic is a separate larger budget.

**Alternatives:**
- A per-conversation owner gives a clear sequence but one huge room can be a hot partition.
- Independent regional acceptance lowers latency but requires weaker ordering or a merge protocol; do not promise both without coordination.

**Failure timeline:**
- T0: the sender submits client_message_id m.
- T1: storage commits sequence 121; gateway loses the response.
- T2: sender reconnects and repeats m.
- T3: server returns sequence 121, and receivers deduplicate replay by durable message identity.

**Migration.** Move a conversation owner by snapshot and ordered catch-up, then change its generation. Gateways refresh routing on stale-owner errors. Avoid simultaneous independent sequencers during handoff.

**Hints:** Scope ordering to one conversation. / Trace reconnect after commit but before the sender sees an acknowledgment.

**How do multiple devices synchronize?**

Maintain a durable per-device cursor and replay missing history. A receipt from one device does not imply all devices have received it.

**What is the ordering guarantee across regions?**

Route conversation writes through one ordering authority or explicitly weaken order. Cross-region latency is the cost of the stronger promise.

**How does a million-member channel change fanout?**

Store one message and fan out delivery pointers or subscriptions; use broadcast partitions, bounded history fetch and separate presence from message durability.

**Weak reasoning.** WebSockets make messages reliable.

**Stronger reasoning.** WebSockets transport live updates. Durable history, operation IDs and replay cursors preserve messages through reconnects.

### Extended walkthrough: File storage and synchronization

**Numerical deep dive.** A 10 GB file split into 10 MB chunks has about 1,000 chunks. If a user changes one chunk, uploading 10 MB instead of 10 GB can save three orders of magnitude of transfer, excluding metadata and boundary shifts.

**Alternatives:**
- Whole-file versions simplify metadata and garbage collection but repeat large uploads.
- Chunked content-addressed storage saves bytes for repeated content while adding reference tracking and privacy-sensitive deduplication.

**Failure timeline:**
- T0: devices A and B read base version 7.
- T1: A commits version 8.
- T2: B tries to publish against version 7.
- T3: CAS rejects the stale base; preserve B’s bytes as a conflict copy or invoke a supported merge rather than overwriting A.

**Migration.** Introduce manifests alongside old whole-file references, convert files lazily or by bounded backfill, validate checksums and retain the old reference until successful reads are verified.

**Hints:** Separate immutable bytes from the mutable current-version pointer. / What proves the client edited the latest version?

**What if two devices edit offline?**

Compare the submitted base version. Merge only formats with defined semantics; otherwise retain both versions and surface a conflict.

**How do you resume a 10 GB upload?**

Persist upload session and completed part checksums; resume only missing parts and finalize conditionally.

**How do you safely garbage-collect shared chunks?**

Track manifest reachability and reference generations, retain a grace period for active uploads/readers, then delete only unreferenced chunks after reconciliation.

**Weak reasoning.** Last-write-wins handles offline edits.

**Stronger reasoning.** Conditional publication detects stale bases. For binary files I preserve a conflict copy rather than silently discard a user’s work.

### Extended walkthrough: Video upload and streaming

**Numerical deep dive.** For 1M viewers at 3 Mbps, delivery is 3 Tbps. At a 95% byte hit rate, origin still serves about 150 Gbps. Four renditions totaling 8 Mbps for a ten-minute asset require about 600 MB, before replication and source retention.

**Alternatives:**
- Pretranscoding all renditions improves predictable playback but spends compute on unwatched videos.
- Just-in-time transcoding saves cold-content work but increases startup latency and requires burst protection.

**Failure timeline:**
- T0: worker creates two of four renditions.
- T1: it crashes before manifest publication.
- T2: retry uses the same asset version and verifies existing objects.
- T3: only a complete validated manifest becomes visible; orphan outputs are collected later.

**Migration.** Publish a new encoding version under immutable paths, compare playback failures and quality, then update manifests for a cohort. Keep old renditions available for already issued manifests during the rollout window.

**Hints:** Estimate delivery bandwidth before designing metadata tables. / What single action makes an asset visible to players?

**How does live video change latency?**

Live streaming continuously publishes small segments, so end-to-end delay includes capture, encode, segment duration, distribution and buffering. The latency/robustness tradeoff changes.

**What if a transcode job is stuck?**

Use heartbeats, attempt deadlines and retryable job states. Fence publication so an old attempt cannot replace newer outputs.

**How do you delete all derived copies?**

Enumerate source and derived versions, revoke playback authorization, invalidate mutable manifests and expire cached segments under the declared retention policy.

**Weak reasoning.** A queue ensures transcoding completes.

**Stronger reasoning.** A durable queue recovers attempts; versioned outputs and atomic manifest publication prevent partial assets becoming playable.

### Extended walkthrough: Search autocomplete

**Numerical deep dive.** If 1M prefixes each store 10 candidate IDs at 8 bytes, candidate pointers alone take 80 MB. Text, scores, indexes and allocator overhead add more. Debouncing five keystrokes to two requests reduces the earlier 1B/day estimate to 400M/day.

**Alternatives:**
- A trie with cached top-k is fast for known prefixes but consumes memory and needs careful updates.
- A search index with prefix/edge-ngram fields supports richer matching but adds index and query cost.

**Failure timeline:**
- T0: a new suggestion index is built.
- T1: a banned term is removed from policy but still exists in that build.
- T2: serving swaps to the new version.
- T3: a query-time suppression layer filters it independently of build age; a bad index can be rolled back by version.

**Migration.** Build a complete new index alongside the old one, compare coverage and latency, warm hot prefixes and atomically change the version pointer. Keep urgent suppression separate from batch release.

**Hints:** What is precomputed and what changes per request? / Separate popularity freshness from urgent moderation.

**How do you support typos?**

Use a bounded edit-distance candidate expansion or fuzzy index after exact-prefix lookup; limit work and rank exact matches appropriately.

**How do non-Latin languages change normalization?**

Normalize Unicode consistently, handle tokenization by locale and test grapheme/input-method behavior rather than assuming ASCII characters.

**How do you prevent cache leakage from personalization?**

Scope personalized caches by user/context or cache only shared candidates. Apply privacy filters before returning suggestions.

**Weak reasoning.** A trie answers every search problem.

**Stronger reasoning.** The trie serves bounded prefix suggestions; typo handling, locale normalization and live suppression are separate contracts.

### Extended walkthrough: Web crawler

**Numerical deep dive.** At 1,157 fetches/s with a mean two-second fetch duration, Little’s law suggests about 2,314 concurrent fetches in steady state, before retries. Per-host limits can keep effective concurrency lower despite global capacity.

**Alternatives:**
- A global FIFO maximizes simplicity but lets one host dominate and makes politeness awkward.
- Host-partitioned queues with due-time scheduling enforce per-host spacing and fair global resource use.

**Failure timeline:**
- T0: a URL is admitted after host validation.
- T1: DNS changes before connection.
- T2: the destination resolves to an internal address.
- T3: connection-time address validation rejects it; redirects receive the same policy checks rather than inheriting the original approval.

**Migration.** Change canonicalization rules with versioned keys and shadow dedup comparisons. Rewriting all identifiers without a migration map can refetch the web or lose frontier history.

**Hints:** Politeness is a scheduling constraint, not just a sleep call. / Validate every fetch destination, including redirects.

**How do you detect crawler traps?**

Bound URL depth, repeated parameter patterns, per-host budgets and content novelty. Detect calendars/session variants and stop explosive frontier growth.

**How do you prioritize recrawls?**

Use change history, importance, freshness requirements and host budgets; preserve a minimum crawl interval.

**What if one host publishes a billion URLs?**

Enforce host quotas and frontier caps, sample or prioritize useful paths and prevent one publisher from consuming global memory.

**Weak reasoning.** A large queue is enough for crawling.

**Stronger reasoning.** I use bounded host-aware scheduling, canonicalization, content deduplication and destination checks; workers cannot fetch arbitrary internal addresses.

### Extended walkthrough: Metrics and monitoring platform

**Numerical deep dive.** At 100K samples/s and 16 bytes/sample, daily raw samples are 138.24 GB. A label with 1M values multiplied by ten regions and ten status values can create 100M series; label combinations, not sample bytes alone, dominate the index.

**Alternatives:**
- Indexing every label makes queries flexible but permits cardinality explosions.
- Controlled label schemas and tiered retention limit cost while constraining ad hoc queries.

**Failure timeline:**
- T0: a deployment adds request_id as a metric label.
- T1: series creation spikes while sample rate looks normal.
- T2: the tenant exceeds a cardinality budget.
- T3: reject or quarantine new series, alert the owner and keep existing critical series flowing.

**Migration.** Introduce new metric schemas with dual emission for a short bounded period, compare dashboards and alert behavior, then retire old series. Keep rule changes versioned and replay historical windows before enabling alerts.

**Hints:** Estimate active series before estimating storage bytes. / The monitoring pipeline itself needs backpressure and failure visibility.

**How do you limit a cardinality explosion?**

Limit new-series rate and total active series per tenant, reject unbounded labels and expose the rejection metric outside the affected tenant pipeline.

**How do you handle out-of-order samples?**

Define a lateness bound; buffer/reorder within it or record corrections. Do not silently treat arrival time as event time.

**How do alerts avoid firing twice after failover?**

Persist evaluation state and a stable alert fingerprint/window identity; deduplicate notification delivery and distinguish firing from repeated reminders.

**Weak reasoning.** Store all metrics with any label.

**Stronger reasoning.** I budget label cardinality, query fanout and retention separately, and measure end-to-end evaluator lag.

### Extended walkthrough: Distributed job scheduler

**Numerical deep dive.** If 1M jobs are due at the hour and dispatch capacity is 10K/s, merely dispatching takes at least 100 seconds. A one-second start-time SLO is impossible without spreading schedules or substantially increasing capacity.

**Alternatives:**
- Polling an indexed due-time table is simple and durable but adds dispatch delay and scan load.
- Time buckets or a durable timing-wheel structure reduce scans while complicating recovery and clock semantics.

**Failure timeline:**
- T0: worker A claims execution with generation 7.
- T1: A pauses and its lease expires.
- T2: B claims generation 8 and commits the result.
- T3: A resumes; the result store rejects generation 7 so it cannot overwrite B.

**Migration.** Move scheduler ownership by time bucket with an epoch. Backfill future schedules, compare due sets and switch claims atomically. Keep the unique (job, scheduled_time) key across both implementations.

**Hints:** What identifies one scheduled occurrence? / A lease expiring does not stop a paused worker from resuming.

**What happens after one hour of downtime?**

Choose skip, coalesce or catch-up per job class. Bound catch-up traffic so recovery does not overwhelm current work.

**How do you handle DST changes?**

Store timezone and explicit ambiguous/nonexistent-time policy; compute occurrences from calendar rules rather than adding 24 hours blindly.

**How do you prevent duplicate external effects?**

Use stable execution IDs and destination idempotency or fencing. A unique scheduler record alone cannot make an arbitrary external effect exactly-once.

**Weak reasoning.** A distributed lock guarantees one execution.

**Stronger reasoning.** Leases recover ownership, fencing protects commits, and task-level idempotency handles ambiguous external effects.

### Extended walkthrough: Payments and ledger

**Numerical deep dive.** At 116 average transactions/s, a 5× peak is about 580/s. If each transaction creates four 200-byte ledger rows, logical ledger writes are roughly 464 KB/s at peak. This modest volume does not justify weakening financial invariants.

**Alternatives:**
- A strongly transactional ledger centralizes invariants and auditability while creating a deliberate coordination boundary.
- Derived balance caches make dashboards fast, but authorizing spending from them risks stale-state decisions unless backed by reserved rights.

**Failure timeline:**
- T0: persist intent P and provider key K.
- T1: provider charges K successfully; the caller times out before local status commits.
- T2: a recovery worker queries or retries K and receives the original result.
- T3: one guarded ledger transaction records the balanced entries; duplicate callbacks return the stored outcome.

**Migration.** Shadow-build a new ledger projection from immutable entries, compare per-account balances and transaction totals, then switch readers. Never dual-charge providers during migration; route each intent through one authoritative workflow.

**Hints:** Which states mean unknown rather than failed? / Trace the failure after the provider acts but before local acknowledgment.

**A charge succeeded but your database write failed—now what?**

Keep the intent pending and reconcile using the same provider identity. Reconstruct the local ledger exactly once from a verified result.

**How do you prevent double refunds?**

Give each refund a stable operation identity, validate remaining refundable amount transactionally and reconcile provider outcomes.

**Can a balance projection authorize spending?**

Only if its correctness contract is equivalent to the authoritative state or uses bounded reserved rights. A lagging dashboard balance cannot authorize new spending safely.

**Weak reasoning.** Wrap the provider call in a database transaction.

**Stronger reasoning.** The provider is outside my database transaction. I use a durable intent, stable provider key, atomic ledger transition and reconciliation for unknown outcomes.

### Extended walkthrough: Ticket booking and inventory

**Numerical deep dive.** At 16.7K hold attempts/s for one event, a single contested seat still permits only one winner. If each attempt holds a lock for 10 ms, that hot row cannot sustain 16.7K serialized successes/s; admission control and early sold-out responses matter.

**Alternatives:**
- Pessimistic locking simplifies small multi-seat allocations but increases contention and deadlock risk.
- Conditional updates with a transaction reduce lock duration while still requiring a consistent strategy for all-or-nothing multi-seat claims.

**Failure timeline:**
- T0: hold H owns seat S until deadline D.
- T1: expiry transaction releases H before payment is known.
- T2: another hold claims S.
- T3: late success for H triggers refund/reconciliation, never reassignment of S from its new owner.

**Migration.** Migrate one event at a time with a write ownership barrier, copy reservations and versions, validate sold/held counts and switch event routing. Avoid concurrent authoritative writers during the cutover.

**Hints:** Browsing availability may be stale; confirmation may not. / Draw the race between expiry and successful payment.

**How do you acquire four adjacent seats atomically?**

Claim all requested seats in one transaction using a stable lock order; rollback the entire allocation if any seat is unavailable.

**What if payment completes late?**

Verify current hold ownership before confirmation; if expired, follow the explicit refund or rebooking policy without violating a new owner’s claim.

**How do you stop bots exhausting holds?**

Bound holds per identity/device, use admission queues and expiry, monitor suspicious churn and keep final allocation authoritative.

**Weak reasoning.** Redis locks stop overselling.

**Stronger reasoning.** The authoritative transaction enforces one owner. Holds, expiry and confirmation share guarded state transitions, and late payment has a defined compensation path.

### Extended walkthrough: Ride matching and live locations

**Numerical deep dive.** At 200K updates/s and 100 bytes/update, location payload is about 20 MB/s before protocol and indexing overhead. A five-second freshness limit bounds how long a disconnected driver remains a candidate; cell density determines query fanout.

**Alternatives:**
- A uniform grid simplifies updates but overloads dense cells and wastes sparse space.
- Hierarchical cells adapt density at the cost of more complex neighbor lookup and repartitioning.

**Failure timeline:**
- T0: two riders both see driver D as available.
- T1: matcher A conditionally reserves D at version 9.
- T2: matcher B’s version-9 claim fails.
- T3: B chooses another candidate; a delayed accept for an expired offer cannot replace A’s active assignment.

**Migration.** Shadow-query a new spatial index and compare candidate recall before switching cities. Keep trip ownership in the same authority during index migration; the index is only a candidate projection.

**Hints:** Which data can be approximate: location, availability or ownership? / Candidate selection is not reservation.

**How do you handle dense downtown cells?**

Subdivide cells, cap query radius/results and distribute location ingestion separately from assignment state. Measure dense-cell load explicitly.

**How do you prevent simultaneous assignments?**

Use a conditional AVAILABLE→RESERVED transition tied to offer ID and generation, then a guarded acceptance.

**What changes when a driver crosses a region?**

Transfer authoritative ownership with an epoch or retain home-region trip ownership; location projection can move independently.

**Weak reasoning.** Pick the nearest online driver.

**Stronger reasoning.** I filter fresh candidates, then atomically reserve one. The spatial index cannot itself guarantee exclusive assignment.

### Extended walkthrough: Collaborative document editor

**Numerical deep dive.** 100K editors × 2 operations/s is 200K operations/s. At 100 bytes/op the raw append stream is 20 MB/s, but a document with 1,000 viewers can create 1,000 deliveries per accepted operation; per-document fanout needs its own limit.

**Alternatives:**
- A central ordering service with OT makes authority clear but offline integration needs transformation history.
- A CRDT supports defined concurrent merges but pays metadata and compaction complexity; select a proven algorithm for the actual document types.

**Failure timeline:**
- T0: A edits from document version 20 while offline.
- T1: B deletes overlapping text and the server advances.
- T2: A reconnects with operation identities and causal/base context.
- T3: the chosen OT/CRDT protocol integrates deterministically; naive character offsets would target the wrong content.

**Migration.** Do not switch merge algorithms on a live operation stream without a translation boundary. Freeze a version, produce a validated snapshot in the new format, coordinate client protocol versions and retain the old history for recovery.

**Hints:** Define what “merge” means for each operation type. / Offline operation identity and context must survive reconnect.

**How do offline edits merge after a week?**

Retain enough causal/transform context or provide a snapshot plus a defined rebase path; if the retention contract is exceeded, surface an explicit conflict/recovery flow.

**What happens when access is revoked mid-session?**

Stop accepting newly unauthorized operations and define the fate of unsynced edits. Old session authentication is not ongoing authorization.

**How do you compact tombstones safely?**

Use the algorithm’s causal stability and replica-retirement rules; dropping deletion metadata while old replicas can return risks resurrection.

**Weak reasoning.** Use CRDT and conflicts disappear.

**Stronger reasoning.** A chosen CRDT defines convergence for supported operations. Permission revocation, tombstone collection and application intent still require explicit policies.

### Extended walkthrough: E-commerce checkout

**Numerical deep dive.** A 100× burst on the 11.6 average orders/s is about 1,160 orders/s. If checkout waits two seconds on a provider, roughly 2,320 operations can be in flight; persist workflow state rather than keeping a database transaction open for that duration.

**Alternatives:**
- A modular monolith can keep order and inventory transitions in one local transaction.
- Separate services allow independent ownership but require a durable saga, reconciliation and more visible intermediate states.

**Failure timeline:**
- T0: reserve inventory and create pending order O.
- T1: payment succeeds but the workflow worker crashes.
- T2: retry resolves the same payment intent, not a new charge.
- T3: guarded confirmation emits one fulfillment event; a duplicate consumer event cannot create another shipment.

**Migration.** Extract one domain behind an interface, backfill its state and switch ownership for a bounded tenant cohort. Never let old and new checkout paths independently authorize the same order.

**Hints:** Name the local transaction boundary first. / What happens if the payment result is unknown?

**What if prices change during checkout?**

Quote and store an accepted price/version, define expiry and require explicit reacceptance when the quote changes.

**How do you handle partial fulfillment?**

Track fulfillment per line/item and allocate payment/refunds consistently; one order-level boolean cannot describe split shipments.

**Which steps can be compensated after shipment?**

Before shipment, release reservations or void/refund. After shipment, returns and refunds are new business processes, not a rollback of physical delivery.

**Weak reasoning.** Microservices make checkout scalable.

**Stronger reasoning.** I separate browse load from inventory decisions and introduce service boundaries only with durable workflow states and compensation semantics.

### Extended walkthrough: Webhook delivery service

**Numerical deep dive.** At 1,157 deliveries/s with a two-second mean response, about 2,314 sockets are in flight in steady state. A single endpoint that hangs for 30 seconds can consume its pool; enforce per-destination concurrency as well as global limits.

**Alternatives:**
- Strict per-endpoint ordering is simple for consumers but one poison event blocks everything behind it.
- Per-entity ordering or unordered delivery improves throughput if consumers use event versions and deduplication.

**Failure timeline:**
- T0: receiver commits event E and sends 200.
- T1: response is lost before sender records success.
- T2: sender retries the same event ID with a new attempt timestamp/signature.
- T3: receiver recognizes E and returns its stored result without repeating the effect.

**Migration.** Rotate signing keys with overlapping verification windows, advertise key IDs and test both versions before retiring the old key. Replays retain logical event identity even when transported by a new sender implementation.

**Hints:** An HTTP timeout does not prove the receiver did nothing. / Order and retry policy must be chosen together.

**How do you stop one slow customer blocking others?**

Partition worker pools and quotas by tenant/destination, bound connect/read timeouts and preserve a fair queue.

**How do retries interact with ordering?**

A retry can block a strict lane; otherwise versions and IDs let consumers reorder or detect gaps. State the promised scope.

**How do you prevent replay attacks?**

Sign timestamp and body, enforce a freshness window, compare signatures safely and deduplicate event IDs; rotate secrets without logging them.

**Weak reasoning.** Retry until the endpoint says 200.

**Stronger reasoning.** Retries are bounded and tenant-isolated. Stable event identity handles ambiguous completion, while signatures and timestamps protect authenticity and replay exposure.

### Extended walkthrough: Feature flag platform

**Numerical deep dive.** 100K instances polling every 60 seconds gives about 1,667 requests/s. A 100 KB full snapshot means about 167 MB/s before cache reuse; version checks and deltas reduce bytes, while SDK freshness remains measurable.

**Alternatives:**
- Local SDK evaluation minimizes latency and survives control-plane failure but can serve stale policy.
- Remote evaluation centralizes current decisions but puts a dependency on the request path and changes outage behavior.

**Failure timeline:**
- T0: SDK has validated configuration 40.
- T1: version 41 arrives with an invalid rule.
- T2: SDK rejects it and keeps 40, reporting an apply error.
- T3: operator rolls back or repairs 41; emergency flags with strict freshness may fail safely after their own expiry.

**Migration.** Shadow-evaluate rule versions, compare cohorts and validate schemas before publishing. Use a stable salt/algorithm version so an SDK upgrade does not reshuffle percentage cohorts unexpectedly.

**Hints:** Separate publishing configuration from evaluating a request. / What is the maximum allowed stale policy age?

**How do you roll back a bad rule?**

Publish the previous valid configuration as a new version and observe applied-version convergence; do not rely only on a successful admin API response.

**How do you keep cohorts stable?**

Hash stable subject ID plus flag salt under a versioned algorithm; changing the salt deliberately reassigns cohorts.

**What does an offline SDK do during an emergency shutdown?**

Use last-known-good within the declared freshness bound; safety-critical flags may require fail-safe expiry. Instant global revocation is incompatible with indefinite offline evaluation.

**Weak reasoning.** All flags work offline forever.

**Stronger reasoning.** Ordinary rollouts can tolerate stale snapshots, while emergency revocation requires a finite freshness policy and observable propagation.

### Extended walkthrough: Clickstream analytics

**Numerical deep dive.** 1B events/day × 500 bytes = 500 GB/day; 30 days is 15 TB raw. At 5× peak, ingestion is about 57.9K events/s. A one-hour outage at that peak creates roughly 208M queued events before replay catch-up.

**Alternatives:**
- Stream aggregation gives fresh answers but needs late-data corrections and durable checkpoints.
- Batch recomputation is simpler for finalized historical truth, but cannot alone meet a seconds-level freshness target.

**Failure timeline:**
- T0: processor increments a window count for E.
- T1: it crashes before checkpoint/offset commit.
- T2: E is replayed.
- T3: atomic state-and-position handling or durable event dedup prevents a second increment; a versioned rebuild avoids double-adding old aggregates.

**Migration.** Write repaired aggregates into a new versioned namespace, reconcile totals against raw input, then switch query routing. Never replay a corrected computation by incrementing the already populated old totals.

**Hints:** Decide whether a count is provisional or final. / Trace a crash between state mutation and offset commit.

**How do you handle events arriving a day late?**

Use an explicit lateness/correction policy; route beyond-window events to a reconciliation path instead of silently dropping billing-relevant facts.

**How do you fix a bad aggregation deployment?**

Replay immutable raw events into a separate output version, validate and atomically switch readers.

**When is approximate distinct counting acceptable?**

Use approximation for exploratory or product metrics with accepted error bounds; use exact deduplicated accounting where money or hard quotas depend on counts.

**Weak reasoning.** Exactly-once Kafka means exact analytics.

**Stronger reasoning.** The guarantee must include the processor state and output boundary. I specify late corrections, deduplication and safe versioned replay.

### Extended walkthrough: Global leaderboard

**Numerical deep dive.** At 1,157 score updates/s, one suitable ordered index may be sufficient before sharding. If each of 100 shards returns its local top 100, merging 10,000 candidates recovers a global top 100, but this does not cheaply answer every user’s exact rank.

**Alternatives:**
- A single ordered structure simplifies exact rank and ties while placing a capacity ceiling on the owner.
- Sharded top-k scales candidate retrieval, but exact arbitrary rank needs additional counts/indexing and coordination.

**Failure timeline:**
- T0: match M produces a score delta.
- T1: the authoritative result commits but projection acknowledgment is lost.
- T2: M replays to the score projection.
- T3: a unique match ID or versioned replacement prevents a second increment.

**Migration.** Rebuild a season index from validated match outcomes into a new version, compare player totals and top-k, then switch readers. Preserve immutable source outcomes so fraud corrections can be recomputed.

**Hints:** Top-k and arbitrary rank are different query problems. / Is a score update an absolute value or a delta?

**How do you resolve equal scores?**

Use a documented total order such as score descending, achieved time ascending, then player ID.

**How do you compute exact global rank?**

Use an ordered rank index or aggregate counts of higher scores with defined consistency; merging top-k alone is insufficient.

**How do you remove a fraudulent result?**

Record a correction/revocation against the authoritative match, recompute affected score and update the projection idempotently.

**Weak reasoning.** Shard the sorted set to scale everything.

**Stronger reasoning.** I measure whether one ordered owner fits first; sharding changes exact-rank cost and requires a separate plan for that query.

### Extended walkthrough: Log ingestion and search

**Numerical deep dive.** 100K × 1 KB/s = 100 MB/s, or 8.64 TB/day. Seven days is 60.48 TB raw. If compression is measured at 4:1, values use about 15.12 TB before indexes and replicas; do not assume the ratio for every log type.

**Alternatives:**
- Indexing all fields improves arbitrary queries but creates uncontrolled cost and schema/cardinality risk.
- Index selected hot fields and scan cold objects for infrequent queries, with quotas and asynchronous results.

**Failure timeline:**
- T0: ingestion acknowledges a durable batch.
- T1: index workers fail while raw objects continue accumulating.
- T2: recent searches become incomplete.
- T3: expose freshness/coverage, recover indexes from raw offsets and avoid claiming that successful ingestion proves searchable completeness.

**Migration.** Version parsing/redaction rules and build a replacement index from retained raw data where permitted. Compare query coverage, switch aliases and delete retired copies according to retention policy.

**Hints:** Separate durable ingestion from searchable availability. / Estimate index and retention costs, not only event throughput.

**How do you handle a noisy tenant?**

Enforce byte, event and query budgets per tenant with isolated capacity; preserve global control signals outside noisy data lanes.

**How do you delete sensitive logs across tiers?**

Propagate versioned deletion requests across indexes, object versions and backups under a declared retention schedule; verify completion rather than deleting only metadata.

**How do you query during an index outage?**

Use bounded object scans or clearly report unavailable/incomplete search; ingest can remain healthy while query freshness degrades.

**Weak reasoning.** Elasticsearch stores every field forever.

**Stronger reasoning.** I define indexed fields, retention tiers, tenant quotas and a replay path, then report search coverage separately from ingestion success.

### Extended walkthrough: Nearby places and map tiles

**Numerical deep dive.** 500M tile requests/day × 30 KB = 15 TB/day delivered. At a 98% byte cache hit rate, origin still serves about 300 GB/day. Nearby-place queries add a separate spatial-index workload that tile caching does not remove.

**Alternatives:**
- Raster tiles are easy to cache but styles/resolutions multiply artifacts.
- Vector tiles allow client styling and efficient reuse but move rendering complexity and some data exposure to clients.

**Failure timeline:**
- T0: a place is removed from the source catalog.
- T1: an old spatial projection and tile remain cached.
- T2: a query returns the stale candidate.
- T3: current-version filtering suppresses the result while background regeneration and TTL handle visual tile freshness.

**Migration.** Generate map version N+1 from a consistent input snapshot, validate boundaries and samples, and publish a new manifest. Retain N for active sessions to avoid mixing incompatible tiles.

**Hints:** Tiles and nearby search are distinct serving paths. / A geographic neighbor is not necessarily a short driving route.

**How do you handle the date line?**

Normalize longitude and query wrapped cell ranges; test polar areas and coordinate-system assumptions explicitly.

**Why is straight-line distance insufficient for routing?**

Roads, one-way rules, barriers and traffic determine travel cost; straight-line distance is only a candidate heuristic.

**How do you invalidate a changed tile?**

Publish immutable versioned tiles and update the manifest; urgent changes may require targeted invalidation with a defined cache propagation bound.

**Weak reasoning.** A geohash gives the driving distance.

**Stronger reasoning.** Spatial cells narrow candidates; exact geometry and a road graph answer different questions, with independent freshness and cost.

### Extended walkthrough: Distributed identifier generator

**Numerical deep dive.** The illustrative 12-bit sequence supports 4,096 IDs per millisecond per worker, or about 4.096M/s as a format ceiling. With 41 timestamp bits, 2^41 ms is about 69.7 years. JavaScript Number preserves integers only through 2^53−1, so a 64-bit ID travels as a string or BigInt-aware encoding.

**Alternatives:**
- Random sufficiently large IDs avoid worker assignment and clock rollback concerns but sacrifice compact time order.
- Timestamp-worker-sequence IDs are compact and roughly sortable but require worker uniqueness, rollover and restart protocols.

**Failure timeline:**
- T0: worker 3 emits IDs at time 1,000 and pauses.
- T1: its assignment expires and is incorrectly reused.
- T2: both workers emit the same timestamp/sequence range.
- T3: fencing assignment alone is insufficient unless emission/storage checks enforce it; quarantine reuse or persist generation in the ID space.

**Migration.** Introduce a versioned ID format, keep parsers accepting both and never reinterpret old IDs under a new epoch. Validate client precision and database index behavior before switching issuance.

**Hints:** List uniqueness, ordering and secrecy as separate requirements. / What survives a clock rollback and a process restart?

**What happens if the clock moves backward?**

Wait, advance a persisted logical timestamp or fail according to contract; never silently emit the same tuple again.

**How do you safely reassign a worker slot?**

Prevent overlapping emitters through a safe reuse delay and fencing/generation design, including paused processes and restarts.

**Why might clients corrupt a 64-bit ID stored as a JavaScript number?**

Values beyond the safe integer range are rounded; encode IDs as strings in JSON and preserve exact comparisons in clients.

**Weak reasoning.** Timestamp plus machine number is always unique.

**Stronger reasoning.** Uniqueness depends on sequence exhaustion, worker assignment and clock/restart policy. I document each assumption and preserve full integer precision.

### Extended walkthrough: Recommendation serving platform

**Numerical deep dive.** 11,575 peak requests/s × 500 candidates ≈ 5.79M evaluations/s. If an assumed measured batch of 500 candidates takes 5 ms of one worker’s compute, the ideal floor is about 58 busy workers; reserve headroom and account for network, model memory and batching efficiency.

**Alternatives:**
- Precomputed recommendations make reads cheap but lag changes and personalization context.
- Online ranking adapts to current features at a higher latency and availability cost; a hybrid uses offline candidates plus online reranking.

**Failure timeline:**
- T0: model version 12 starts receiving traffic.
- T1: its feature schema mismatches the online store.
- T2: timeout/fallback rate rises and relevance degrades.
- T3: pin compatible feature/model versions, roll back the serving pointer and inspect exposure logs rather than silently mixing versions.

**Migration.** Shadow-score requests without exposing results, validate latency and policy filtering, then use a stable small experiment cohort. Rollback selects the previous model/index bundle; do not overwrite it in place.

**Hints:** Split retrieval, ranking and policy filtering into separate budgets. / What can you return if personalization misses the deadline?

**How do you handle a new user?**

Use popularity, contextual and onboarding candidates, then update personalization as evidence arrives. Keep exploration and privacy rules explicit.

**What if online and training features differ?**

Version feature definitions, validate online/offline parity and track freshness; inspect leakage and missing-value behavior.

**How do you roll back a bad model without rebuilding everything?**

Keep immutable versioned model artifacts and compatible feature/index bundles, then switch the serving pointer and monitor guardrails.

**Weak reasoning.** Use a neural network for recommendations.

**Stronger reasoning.** I budget retrieval and ranking separately, version features with the model, enforce current eligibility and keep a safe fallback and rollback path.

### Extended walkthrough: Ad auction and budget platform

**Numerical deep dive.** If five regions each hold 20 units of nonoverlapping budget rights, total reserved spend cannot exceed 100 before rounding/in-flight rules. A design that gives each region the full 100 allows up to 500 and violates the intended cap.

**Alternatives:**
- Centralized budget reservation enforces a tight global cap but puts coordination on a latency-sensitive path.
- Regional escrow reduces request latency while temporarily stranding unused rights and requiring safe reallocation.

**Failure timeline:**
- T0: region reserves budget for auction A.
- T1: response is returned but the impression callback is delayed.
- T2: reservation reaches its deadline.
- T3: a declared late-impression rule resolves billing without both reallocating the same rights and charging an unbounded late event.

**Migration.** Shadow a new auction/scoring rule with no billing effects, compare outcomes and latency, then roll out by stable experiment cohort. Keep pricing and billing event versions so reconciliation can reproduce historical charges.

**Hints:** Distinguish winning, showing and billing. / Where are spend rights consumed during a partition?

**How do you bound overspend across regions?**

Allocate exclusive spend rights, enforce locally and bound outstanding reservations. Reassignment must prevent both old and new owners spending the same rights.

**What if a winning impression arrives after reservation expiry?**

Apply an explicit late-event policy: retain a grace reserve, reject late billing or fund it from a bounded reconciliation account. Do not pretend expiry erases a real impression.

**How do you attribute conversions days later?**

Store immutable event identities and attribution windows, then issue corrections separately from auction-time charging; delayed attribution is not a second charge by default.

**Weak reasoning.** Each region keeps a cached campaign balance.

**Stronger reasoning.** Regions spend exclusive allocated rights. Cached global balances alone permit simultaneous overspending, so reservation and reconciliation rules must be explicit.

### Extended walkthrough: Distributed batch processing engine

**Numerical deep dive.** 10 TB at 10 GB/s aggregate input bandwidth has a 1,000-second lower bound before compute/shuffle. If a 2 TB shuffle crosses a 2 GB/s bottleneck, that stage adds an ideal 1,000 seconds unless overlapped; a single hot reducer can dominate both estimates.

**Alternatives:**
- Recompute lost intermediate data from immutable input to simplify durability and reduce replication cost.
- Replicate costly shuffle output when recomputation is more expensive than storage/network overhead.

**Failure timeline:**
- T0: task attempt A writes a complete output file.
- T1: coordinator does not see its heartbeat and launches B.
- T2: both attempts finish.
- T3: one conditional manifest commit wins; readers never discover results by listing both attempt directories.

**Migration.** Version job plans and output schemas. Run the new engine against immutable input to a distinct output namespace, compare checksums/aggregates and switch the catalog pointer only after validation.

**Hints:** Separate an attempt finishing from its output becoming visible. / What algebra permits a partial aggregate?

**How do you handle a heavily skewed key?**

Use partial aggregation and salting for operations with valid merge semantics, or a specialized skew join. Measure the heavy-key distribution before choosing partition counts.

**Can speculative attempts both publish results?**

They may create files, but only one may publish the authoritative output pointer. Side effects outside that commit boundary need idempotency.

**How do you recover lost shuffle files?**

Mark affected blocks unavailable and reschedule their producing tasks, then retry dependent reads; preserve input snapshots for deterministic recovery.

**Weak reasoning.** Retry failed tasks and results are exactly once.

**Stronger reasoning.** Retries create multiple attempts. Immutable attempt output and a conditional manifest commit choose one visible result; arbitrary external effects remain outside that guarantee.

### Extended walkthrough: Distributed SQL database

**Numerical deep dive.** For three replicas in three regions, a leader must wait for at least one remote replica in a majority protocol. If the nearest required round trip is 40 ms, commit cannot be a 2 ms local operation under that placement. Cross-shard preparation/decision may add further rounds.

**Alternatives:**
- Single-shard transactions avoid cross-owner atomic commit and should be favored by partition-aware schemas.
- Cross-shard transactions support richer invariants but add coordination, intents and recovery state; expose retryable conflicts clearly.

**Failure timeline:**
- T0: shards A and B durably prepare transaction T.
- T1: coordinator durably records COMMIT.
- T2: A applies commit while B loses contact.
- T3: B resolves the durable decision on recovery; it cannot independently abort because a timeout elapsed.

**Migration.** Snapshot a shard at an applied log index, stream subsequent entries, validate indexes and switch ownership generation. Preserve transaction intents and coordinator references, not just user rows, through migration.

**Hints:** Replication, isolation and atomic commit are three separate responsibilities. / Which durable record resolves a half-notified commit?

**How do cross-shard transactions recover?**

Recover participant intents and the durable coordinator decision, then finish the same commit/abort outcome; an in-doubt transaction cannot choose arbitrarily.

**What makes a follower read safe?**

Establish a protocol-safe freshness point and wait until applied state reaches it; merely having recent bytes on disk is insufficient.

**How do you move a shard with ongoing writes?**

Transfer snapshot plus log tail and transactional metadata, then atomically change the routing epoch while rejecting stale-owner writes.

**Weak reasoning.** Raft makes all SQL transactions serializable.

**Stronger reasoning.** Raft orders one replicated log. Cross-shard commit and concurrency control still need explicit protocols and recovery semantics.

### Extended walkthrough: Parking garage: low-level design

**Numerical deep dive.** 20 gates × 2 requests/s is only 40 claims/s. A local transactional database may fit comfortably, but measure lock hold time and contention on the final compatible spot. Avoid a global distributed architecture without a demonstrated need.

**Alternatives:**
- A single Garage aggregate with coarse locking is simple but serializes unrelated spots.
- Repository-level conditional claims permit parallel work on different spots while enforcing one owner per spot.

**Failure timeline:**
- T0: ticket T exits spot S and releases it.
- T1: a new ticket U claims S at a newer version.
- T2: a delayed duplicate exit for T arrives.
- T3: owner/version checks reject releasing S because T is no longer its owner.

**Migration.** Add new pricing policies through a versioned interface and store the policy version used for each ticket/quote. Validate old-ticket behavior before switching; do not retroactively reinterpret an accepted charge without a business rule.

**Hints:** Which class selects a candidate, and which component grants ownership? / Keep time and payment side effects behind interfaces.

**How do you prevent two gates allocating one spot?**

Use one transaction for conditional spot claim and ticket creation, with a unique active-owner constraint and idempotent entry key.

**How do you test time-based pricing?**

Inject a fake Clock and a pure PricingPolicy; test rounding, midnight, grace periods, currency and maximum daily charges without sleeping.

**What if an old exit request arrives after the spot is reused?**

Check current ticket ownership and spot version in the exit transaction; a completed old ticket must not mutate a newer occupant.

**Weak reasoning.** The gate marks an available spot occupied.

**Stronger reasoning.** AllocationPolicy proposes a spot; a conditional repository transaction grants it and creates the ticket. Duplicate exit commands compare ownership before releasing anything.

## Runnable labs

Requires Node.js 22.13 or newer. Run npm run labs from the repository or node labs.cjs all with the downloaded runner.

### Race for the last unit

A conditional transaction grants at most one reservation for one available unit, even when independent processes contend.

Command: npm run lab:reservation

1. Predict the outcome of twelve readers all observing available=1 before any writes.
2. Run the broken read-then-write control and observe twelve reservations for one unit.
3. Run the transactional conditional decrement against the same contention barrier.
4. Replay the winning request key and verify that inventory is not decremented again.

**Expected:** brokenSold = 12; correctSold = 1; retryReturnedSameReservation = true.

**Extend:** Add hold expiry and confirmation with an injected clock. Race them and assert a confirmed hold cannot later expire. Add multi-item allocation in a stable locking order.

**Limits:** SQLite provides real local transactions and separate processes here. This does not simulate sharded inventory, network partitions or an external payment provider.

### Crash after the effect, before acknowledgment

At-least-once delivery can produce one intended sink effect when the deduplication marker and effect share a durable sink transaction.

Command: npm run lab:outbox

1. Commit an order and outbox event in the source database together.
2. Launch a child worker that applies the effect in a separate sink database, then exits with code 17 before source acknowledgment.
3. Verify the source event is still pending. Restart the worker and redeliver it.
4. Assert one inbox event, total amount 25, and a successful source acknowledgment.

**Expected:** crashExitCode = 17; deliveriesAttempted = 2; uniqueEffects = 1; total = 25.

**Extend:** Move the deduplication marker outside the sink transaction and inject a crash between marker and effect. Demonstrate either missing or duplicate effects. Then add a third redelivery.

**Limits:** The sink participates in a local SQLite transaction. An arbitrary email or payment endpoint is not protected unless it offers an equivalent idempotency contract. Process exit is tested; power-loss durability is not.

### LRU behavior and a cache stampede

Coalescing one hundred concurrent misses for the same key starts one origin load, and failed loads do not poison future retries.

Command: npm run lab:cache

1. Trace capacity-two LRU operations before running: put A, put B, get A, put C.
2. Compare one hundred independent origin calls with one hundred calls through the coalescer.
3. Inject an origin rejection, then retry the same key successfully.
4. Check overwrite behavior and capacity zero in the reference implementation.

**Expected:** uncoalescedOriginLoads = 100; coalescedOriginLoads = 1; lruChecks = passed; failureCanRetry = true.

**Extend:** Add per-key TTL and an injected clock, then test expiry races. Add a global concurrent-fill limit so many distinct missing keys cannot overload the origin.

**Limits:** This is an in-process concurrency experiment with asynchronous I/O simulation. It does not prove coordination across cache nodes or thread-safe access in another runtime.

### Burst load, queue bounds and latency

Bounding a queue limits retained work under a burst, but the latency improvement must be reported alongside rejected requests.

Command: npm run lab:overload

1. Offer the same instantaneous burst of 120 jobs to four workers with an 8 ms simulated service delay.
2. Measure the unbounded queue: all work completes, but later arrivals wait through many batches.
3. Repeat with eight waiting slots; report completed, rejected, maximum queue length, p50 and p99.
4. Explain why measuring only accepted-request p99 would hide the 90% rejection rate.

**Expected:** Unbounded: completed = 120, rejected = 0. Bounded: completed = 12, rejected = 108, maxQueued ≤ 8. Latency values vary by host.

**Extend:** Replace the burst with a fixed-rate arrival schedule, add warm-up and recovery windows, and model a slowdown. Report offered/admitted/completed rates and lateness relative to scheduled arrivals.

**Limits:** This is a local event-loop load experiment, not an HTTP benchmark or a fleet-capacity claim. It deliberately has deterministic admission counts and nondeterministic measured durations.

