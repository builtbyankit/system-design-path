# System Design Path

An independent course and interview workbook. Examples and capacity numbers are teaching assumptions, not descriptions of company production systems.

Study loop: predict → learn → design → break → explain. Complete the exercises before revealing answers. This guide covers high-level system design; role-specific low-level design and coding need separate practice.

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

