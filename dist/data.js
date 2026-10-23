window.COURSE={
  "refs": {
    "http": [
      "HTTP overview · MDN",
      "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview"
    ],
    "sre": [
      "Site Reliability Engineering · Google",
      "https://sre.google/sre-book/table-of-contents/"
    ],
    "aws": [
      "Builders’ Library · AWS",
      "https://aws.amazon.com/builders-library/"
    ],
    "retry": [
      "Timeouts, retries and jitter · AWS",
      "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/"
    ],
    "pg": [
      "Transaction isolation · PostgreSQL",
      "https://www.postgresql.org/docs/current/transaction-iso.html"
    ],
    "raft": [
      "Raft paper and visualization",
      "https://raft.github.io/"
    ],
    "patterns": [
      "Distributed systems pattern catalog",
      "https://martinfowler.com/articles/patterns-of-distributed-systems/"
    ],
    "kafka": [
      "Apache Kafka documentation",
      "https://kafka.apache.org/documentation/"
    ],
    "stripe": [
      "Idempotent requests · Stripe",
      "https://docs.stripe.com/api/idempotent_requests"
    ],
    "outbox": [
      "Transactional outbox · Chris Richardson",
      "https://microservices.io/patterns/data/transactional-outbox.html"
    ],
    "otel": [
      "Signals · OpenTelemetry",
      "https://opentelemetry.io/docs/concepts/signals/"
    ],
    "security": [
      "API Security · OWASP",
      "https://owasp.org/API-Security/"
    ],
    "spanner": [
      "Spanner · Google research",
      "https://research.google/pubs/spanner-googles-globally-distributed-database/"
    ],
    "gfs": [
      "Google File System paper",
      "https://research.google/pubs/the-google-file-system/"
    ],
    "bigtable": [
      "Bigtable paper",
      "https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/"
    ]
  },
  "phases": [
    {
      "id": 1,
      "title": "Frame the problem",
      "goal": "Turn an ambiguous prompt into measurable requirements and a defensible plan."
    },
    {
      "id": 2,
      "title": "Requests and networks",
      "goal": "Follow a request from a client to the service and back."
    },
    {
      "id": 3,
      "title": "Data foundations",
      "goal": "Choose models, indexes and transaction boundaries from access patterns."
    },
    {
      "id": 4,
      "title": "Scale reads and writes",
      "goal": "Cache, replicate and partition without hiding correctness problems."
    },
    {
      "id": 5,
      "title": "Distributed correctness",
      "goal": "Reason about failure, ordering, consensus and coordination."
    },
    {
      "id": 6,
      "title": "Asynchronous systems",
      "goal": "Design reliable workflows, queues and streaming pipelines."
    },
    {
      "id": 7,
      "title": "Reliability under pressure",
      "goal": "Keep useful work flowing during overload and dependency failures."
    },
    {
      "id": 8,
      "title": "Specialized building blocks",
      "goal": "Search, media, realtime connections and spatial workloads."
    },
    {
      "id": 9,
      "title": "Security and operations",
      "goal": "Make the system observable, recoverable and safe to change."
    },
    {
      "id": 10,
      "title": "Architecture and interview mastery",
      "goal": "Choose boundaries, evolve systems and defend decisions under follow-ups."
    }
  ],
  "lessons": [
    {
      "phase": 1,
      "id": "requirements",
      "title": "Requirements, invariants and scope",
      "model": "A design starts with user actions and promises. Separate functional requirements (send a message, reserve a seat) from quality targets (latency, availability, durability, freshness). An invariant is a statement that must remain true through concurrent requests and failures: a seat has at most one confirmed owner. Ask about geographic scope, peak traffic, retention and what can be excluded. Record assumptions explicitly; revisit them when a constraint changes.",
      "worked": "For ticket booking, agree on browsing events, temporarily holding seats and paying. Search may be seconds stale; confirmation cannot sell the same seat twice. A plausible exercise target is 99.9% successful booking requests over a month and p99 under 500 ms for the reservation step, excluding the payment provider. Define how timeout and sold-out responses count in the SLI before choosing infrastructure.",
      "tradeoff": "Do not spend the interview designing every feature. A single hard invariant usually drives more architecture than ten boxes. An availability target alone does not tell you how much acknowledged data may be lost; define durability and recovery objectives separately.",
      "exercise": "Write three invariants for a wallet and identify one screen that can tolerate stale data.",
      "answer": "Transfers balance across ledger accounts, a request key creates at most one transfer, and an account cannot exceed its agreed credit limit. A spending chart can lag; authorization must use authoritative balances or an equivalent reservation protocol.",
      "refs": [
        "sre"
      ]
    },
    {
      "phase": 1,
      "id": "estimation",
      "title": "Capacity, units and bottleneck estimates",
      "model": "Estimate the resources that influence a decision. Average QPS = daily operations / 86,400. Peak QPS is an explicit multiplier, not a universal constant. Retained bytes = writes per second × bytes per record × retention seconds; then account separately for replicas, indexes, compression and overhead. Bandwidth is bytes per response × responses per second. Distinguish decimal GB from binary GiB.",
      "worked": "10 million daily users × 20 reads gives 200 million reads/day, about 2,315 average QPS. At an assumed 5× peak, plan for 11,575 reads/s. Two writes per user per day at 1 KB each produce about 20 GB/day raw, or 600 GB over 30 days. Three full replicas require about 1.8 TB before indexes and safety margin. A 100 KB response at peak is roughly 1.16 GB/s.",
      "tradeoff": "An estimate is not a benchmark. CPU, skew, network saturation and storage latency can invalidate a count of machines. State assumptions, show the order of magnitude, then explain what you would measure. Never size a system only from average load.",
      "exercise": "A queue receives 3,000 jobs/s but workers finish 2,500/s for ten minutes. How much backlog forms, and how long to drain it at 4,000/s with unchanged arrivals?",
      "answer": "Backlog is (3,000 − 2,500) × 600 = 300,000 jobs. Spare drain capacity is 4,000 − 3,000 = 1,000/s, so recovery takes 300 seconds. This ignores retries and service-time variance.",
      "refs": [
        "sre"
      ]
    },
    {
      "phase": 1,
      "id": "interview",
      "title": "A 45-minute design conversation",
      "model": "Use time boxes as a guide: 0–5 minutes requirements; 5–10 scale and APIs; 10–20 core architecture and data flows; 20–35 two deep dives; 35–42 failure, security and operations; 42–45 recap and tradeoffs. Ask the interviewer where to go deeper. Explain one complete write and read before adding extra components.",
      "worked": "For a URL shortener, start with POST /links and GET /{code}. Draw client → service → mapping store. Then add a cache because reads dominate, and discuss ID collision handling and cache invalidation after deletion. Every new component addresses a named bottleneck or failure mode. End with the remaining limit, such as a viral key or abuse detection.",
      "tradeoff": "A familiar company name is a product prompt, not permission to recite a memorized diagram. If the interviewer changes the workload to strict privacy or instant deletion, the design must change too. Discuss alternatives in terms of costs, failure behavior and user impact.",
      "exercise": "Explain why you chose a relational database without naming a vendor or saying it is scalable.",
      "answer": "The workload needs uniqueness, atomic multi-row updates and indexed lookups at a manageable write rate. Start with one transactional boundary and add read replicas or partitioning only when measurements justify them.",
      "refs": [
        "aws"
      ]
    },
    {
      "phase": 2,
      "id": "network",
      "title": "DNS, TCP, TLS and request latency",
      "model": "DNS maps names to endpoints with cached answers. Connections then incur transport and security negotiation costs before application work. Connection pooling and reuse amortize these costs. A proxy or load balancer can terminate TLS and forward traffic, but downstream hops still need identity, timeouts and capacity limits. HTTP/3 uses QUIC rather than TCP; do not assume every HTTP request follows an identical transport path.",
      "worked": "A mobile client reusing a connection avoids repeating all setup work. If a service issues ten serial 20 ms calls, it spends about 200 ms just waiting on those calls; independent parallel calls reduce the critical path but increase concurrent load. DNS TTL expiration does not instantly move established connections during failover.",
      "tradeoff": "Connection count, packet loss and geography often dominate a supposedly fast service. A DNS change is not an instantaneous global switch. Aggressive health checks can also cause unstable routing when an overloaded service briefly pauses.",
      "exercise": "A service has low CPU but high p99 latency. Name four things to inspect before adding instances.",
      "answer": "Connection-pool waits, slow downstream calls, network retransmission or cross-region round trips, and queued requests. Trace phases of the request rather than treating low CPU as proof of spare useful capacity.",
      "refs": [
        "http"
      ]
    },
    {
      "phase": 2,
      "id": "apis",
      "title": "API contracts, pagination and versioning",
      "model": "An API is a contract for inputs, outputs, failures and retries. Choose resource identifiers, authentication, validation and error semantics explicitly. Cursor pagination resumes after a stable ordering key; offset pagination can skip or duplicate items when concurrent writes move boundaries. Use a unique tie-breaker such as (created_at, id), and sign or validate opaque cursors.",
      "worked": "GET /messages?conversation_id=c&after_seq=120 returns messages ordered by conversation sequence and a next cursor. POST /messages includes client_message_id for safe retries. If a bulk export takes minutes, POST /exports returns a job ID and GET /exports/{id} reports status instead of holding an unbounded request open.",
      "tradeoff": "REST is convenient for public resources, RPC for typed internal commands, and GraphQL for flexible projections; none solves correctness automatically. Additive schema evolution is easier than renaming fields. Set page-size and query-complexity limits to prevent expensive requests.",
      "exercise": "Two records have the same timestamp. Why is a timestamp-only cursor unsafe?",
      "answer": "The next page may exclude unseen rows with the same timestamp or include the last row again. Use a total order such as timestamp plus unique ID and a matching composite index. Define the snapshot semantics if the sort key can change.",
      "refs": [
        "http",
        "security"
      ]
    },
    {
      "phase": 2,
      "id": "load-balancing",
      "title": "Load balancing and stateless services",
      "model": "Distribute requests across healthy capacity. Layer 4 balancing operates on transport connections; Layer 7 routing can inspect application properties. Round robin is simple, while least-connections or load-aware policies help uneven work. Stateless request handlers put durable state in shared storage so any instance can serve a request. They can still have local caches and active connections.",
      "worked": "A chat gateway holds WebSockets in memory, while durable messages live in storage. A gateway registry maps users to current connections. During deployment, stop accepting new connections, drain existing ones within a deadline and let clients reconnect with their last acknowledged sequence.",
      "tradeoff": "Sticky routing can reduce cache misses but creates uneven load and makes failures more visible. Health should distinguish readiness to accept work from process liveness. Autoscaling on CPU alone misses a blocked connection pool or an overloaded database.",
      "exercise": "Why can doubling API servers make an outage worse?",
      "answer": "Each instance may open more database connections and create more simultaneous downstream work. Bound global or downstream concurrency, add admission control and scale the actual bottleneck.",
      "refs": [
        "sre"
      ]
    },
    {
      "phase": 3,
      "id": "models",
      "title": "Data models and access patterns",
      "model": "List your reads and writes before choosing storage. Relational models suit constraints and joins; document models colocate aggregates; key-value models suit predictable key access; wide-column models support designed partition and sort keys. A logical schema and a physical layout are different decisions. Denormalization makes specific reads cheaper by adding write and repair work.",
      "worked": "For chat, conversations(conversation_id, membership_version) and messages(conversation_id, sequence, sender_id, body_ref) support ordered history. Very long conversations may need time buckets to bound partitions. A user_conversations projection supports an inbox without scanning message history. The message store remains authoritative if projections lag.",
      "tradeoff": "Do not choose a database by the claim that SQL cannot scale or NoSQL has no schema. Both have constraints. For each derived view, specify who updates it, how stale it can be, and how it is rebuilt after bugs.",
      "exercise": "Design keys for a tenant-scoped audit log queried by tenant and time.",
      "answer": "Partition by tenant plus time bucket; order within the bucket by event time and event ID. Large tenants may need subpartitions. Cross-tenant analytics belongs in a separate projection rather than an unbounded operational scan.",
      "refs": [
        "bigtable"
      ]
    },
    {
      "phase": 3,
      "id": "indexes",
      "title": "Indexes, storage engines and query cost",
      "model": "An index trades extra storage and write work for cheaper lookup. B-tree families support ordered ranges; log-structured merge designs buffer writes and merge immutable runs, moving cost into compaction and read amplification. Bloom filters can rule out absent keys with no false negatives under correct construction, but a positive result still requires verification. A covering index can avoid extra row reads.",
      "worked": "For SELECT messages WHERE conversation_id=? AND sequence>? ORDER BY sequence LIMIT 50, an index beginning with (conversation_id, sequence) matches the access path. An index on sequence alone may inspect irrelevant conversations. Every additional index adds updates to the write path and can increase tail latency during maintenance.",
      "tradeoff": "Big-O is not enough: disk seeks, cache locality, page size, compression and compaction matter. Benchmark representative distributions, including hot and cold data. A full scan can be appropriate for analytics even when it is unacceptable for a per-request API.",
      "exercise": "Why might a new index improve reads but hurt message-send p99?",
      "answer": "Writes now maintain another structure and consume more I/O and memory. Background compaction or page splits can increase contention. Measure both read benefit and write amplification before retaining it.",
      "refs": [
        "bigtable",
        "pg"
      ]
    },
    {
      "phase": 3,
      "id": "transactions",
      "title": "Transactions, isolation and concurrency",
      "model": "Atomicity means a transaction commits as a unit; isolation controls which concurrent effects it can observe. A read followed by a write is not automatically safe. Encode invariants with unique constraints, conditional writes, row locks or serializable transactions as appropriate. Serializability describes an equivalent serial execution; it is distinct from real-time ordering across independent operations.",
      "worked": "Reserve inventory with UPDATE inventory SET available=available-1 WHERE sku=? AND available>0, and inspect the affected row count. Create the reservation in the same transaction. Two callers reading available=1 and then each writing available=0 can both believe they succeeded unless the mutation is guarded.",
      "tradeoff": "Higher isolation can cause retries or lock contention. Keep transactions short, acquire locks consistently and retry the entire transaction when required. A transaction in one database does not atomically commit a payment provider call.",
      "exercise": "Two doctors each see the other on call, then remove themselves. Why can snapshot isolation still violate the rule that someone remains on call?",
      "answer": "They update different rows, so neither necessarily conflicts at the row-write level. This is write skew. Serialize the decision with a shared lock or invariant row, or use a serializable transaction and handle aborts.",
      "refs": [
        "pg"
      ]
    },
    {
      "phase": 4,
      "id": "caching",
      "title": "Caching, freshness and invalidation",
      "model": "A cache is a disposable projection with a freshness contract. Cache-aside reads the cache, falls back to the source and fills on a miss. Write-through updates through a coordinated path; write-behind acknowledges before durable storage and changes the loss model. Specify keys, TTL, eviction, invalidation and behavior when the cache fails. Separate authentication-sensitive data across users and tenants.",
      "worked": "For product descriptions, a 60-second TTL may be acceptable. On update, commit the database and invalidate the key. A concurrent old read can refill stale data after invalidation; versioned values, bounded TTLs or carefully ordered invalidation can mitigate this. For stock confirmation, check the authoritative write path rather than trusting cached availability.",
      "tradeoff": "A 99% hit ratio can hide a catastrophic miss storm. Coalesce concurrent fills per key, jitter expirations and limit fallback load. Stale-while-revalidate is useful only when serving stale data meets the product contract.",
      "exercise": "At 10,000 reads/s and 95% hits, what source read rate must you support? What happens if the cache restarts?",
      "answer": "Steady-state misses are 500/s. A cold cache can send close to 10,000/s to the source, before retries. Warm key subsets, bound fills and degrade gracefully rather than assuming the normal hit ratio.",
      "refs": [
        "aws"
      ]
    },
    {
      "phase": 4,
      "id": "replication",
      "title": "Replication, failover and lag",
      "model": "Replication copies data for durability, availability and read capacity. Synchronous acknowledgment waits for selected replicas; asynchronous replication can lag or lose recent acknowledged writes on failover. State what acknowledgment means. Replica reads can be stale; read-your-writes may require a leader read, a replication-position token or session routing.",
      "worked": "A user changes their display name on the leader and immediately loads a profile from a follower 400 ms behind. The old name is expected under asynchronous replication. Route the session to a replica that has applied the write position or to the leader until it is safe. Do not solve this by sleeping an arbitrary interval.",
      "tradeoff": "More replicas do not automatically increase write throughput. A failover mechanism must prevent two writable leaders or use a deliberate conflict-resolution model. Backups protect against logical deletion and corruption that replicas faithfully copy.",
      "exercise": "A leader acknowledges a write before any follower receives it and then dies. Can failover promise zero data loss?",
      "answer": "No. That acknowledgment policy permits loss of the write if the old leader cannot be recovered. A stricter durable replication acknowledgment changes latency and availability, but is necessary for the stronger promise.",
      "refs": [
        "patterns",
        "sre"
      ]
    },
    {
      "phase": 4,
      "id": "partitioning",
      "title": "Sharding, consistent hashing and hot keys",
      "model": "Partitioning spreads data and work across owners. Hash partitioning balances many independent keys; range partitioning supports locality and range scans but can create hot ranges. Consistent hashing reduces key movement as owners change, often with virtual nodes. It does not make a single hot key distributed. Partition keys determine transaction and query boundaries.",
      "worked": "Partition orders by customer_id for customer history. Merchant analytics then needs a projection or scatter-gather query. A celebrity feed or giant tenant can overwhelm one owner even if the overall hash distribution is uniform. Split that workload, cache it, or assign dedicated capacity based on its semantics.",
      "tradeoff": "Resharding needs a migration protocol: copy a snapshot, replay changes, validate, switch ownership and retire the old copy. Dual writes without versioning can reorder updates. Cross-shard transactions and joins add coordination cost.",
      "exercise": "Why can hash(user_id) mod N be expensive when N changes?",
      "answer": "Changing N remaps a large fraction of keys. A stable partition map or consistent hashing limits movement. You still need transfer bandwidth, ownership epochs and a plan for requests during migration.",
      "refs": [
        "patterns",
        "bigtable"
      ]
    },
    {
      "phase": 5,
      "id": "consistency",
      "title": "Consistency models, CAP and quorums",
      "model": "Linearizability makes operations appear atomic in a real-time order. Eventual consistency promises convergence under suitable conditions, not a maximum lag by itself. Causal consistency preserves cause-before-effect dependencies. CAP concerns the inability to provide both linearizable consistency and availability for every request during a partition under its formal model; it is not a menu to pick any two features during normal operation.",
      "worked": "A globally available like counter may accept regional increments and merge later. A unique seat assignment should reject or delay requests on a side that cannot establish ownership. With N=3, W=2 and R=2, read/write sets intersect, but intersection alone does not prove linearizability: version selection, concurrent writes, failed operations and membership changes matter.",
      "tradeoff": "Choose guarantees per operation. A product can have strongly consistent purchases and eventually consistent recommendations. Measure staleness and define user-visible fallback instead of calling the entire database simply CP or AP.",
      "exercise": "Can a system guarantee every partitioned client a successful write and also guarantee a single real-time value for all reads?",
      "answer": "Not under the CAP partition scenario. Some requests must wait or fail to preserve the strong guarantee, or the system must accept weaker consistency and reconcile later.",
      "refs": [
        "spanner",
        "patterns"
      ]
    },
    {
      "phase": 5,
      "id": "consensus",
      "title": "Consensus, logs and leader election",
      "model": "Consensus lets a group agree on an ordered sequence despite failures within its assumed model. A replicated state machine applies the same committed commands in the same order. Raft separates leader election, log replication and safety rules; terms distinguish leadership generations. Elections alone do not guarantee safe writes: log matching, commitment and membership rules matter.",
      "worked": "A five-voter group normally requires three voters for progress and can tolerate two unavailable voters. During a 3/2 partition, the majority side can elect a leader; the minority cannot commit new entries. The old leader may still be running, so downstream systems must reject stale authority when it attempts external effects.",
      "tradeoff": "Consensus pays coordination latency and does not tolerate arbitrary Byzantine behavior by default. Use established implementations for production. A consensus log does not automatically make a nontransactional external email or payment exactly-once.",
      "exercise": "Why does increasing a three-node quorum group to four not increase the number of failures tolerated for majority progress?",
      "answer": "Both require a majority: two of three or three of four. Both can lose only one member and still form a majority. Five members can tolerate two failures, with extra replication overhead.",
      "refs": [
        "raft"
      ]
    },
    {
      "phase": 5,
      "id": "coordination",
      "title": "Clocks, leases, fencing and identifiers",
      "model": "Wall clocks drift and can jump. Use monotonic time for local elapsed durations, and explicit logical ordering where necessary. A lease grants time-limited ownership, but a paused holder may resume after expiry. Fencing tokens are monotonically increasing ownership generations checked by the resource receiving writes. The check must happen at the protected resource, not only in the lock service.",
      "worked": "Worker A has token 41 and pauses. Worker B acquires token 42 and writes. When A resumes, the storage service rejects token 41. Without this check, the expired worker can overwrite newer output. Time-based ID generators also need policies for clock rollback, worker-ID uniqueness and per-tick exhaustion.",
      "tradeoff": "Globally increasing identifiers require coordination or careful assumptions. Random identifiers avoid a central allocator but need sufficient entropy and collision handling. Sequential IDs reveal ordering and sometimes volume; they are not authorization controls.",
      "exercise": "Is checking a lease once before a long file upload sufficient?",
      "answer": "No. The lease can expire during the upload. Commit must be conditional on a valid generation at the authoritative destination, or the upload must produce an immutable object whose reference is conditionally published.",
      "refs": [
        "patterns"
      ]
    },
    {
      "phase": 6,
      "id": "queues",
      "title": "Queues, logs and delivery semantics",
      "model": "A work queue distributes tasks; a retained log supports replay and independent consumer positions. Partitioning usually scopes ordering. At-most-once can lose work; at-least-once can repeat work. Exactly-once claims need a precise boundary: a broker transaction may coordinate records and offsets inside that platform without covering an external side effect.",
      "worked": "A thumbnail worker reads an event, writes an immutable output keyed by image/version, records completion and acknowledges. If it crashes after writing but before acknowledging, delivery repeats; deterministic output keys and guarded completion make replay harmless. Poison messages need bounded retries, a dead-letter path and an operator replay procedure.",
      "tradeoff": "Adding partitions increases parallelism but can change ordering assumptions and rebalance work. A queue absorbs bursts only until retention, disk or latency budgets are exhausted. Monitor oldest-message age, not just count.",
      "exercise": "Should a consumer acknowledge before or after writing the database result?",
      "answer": "Acknowledging first risks losing work if it crashes before the write. Acknowledging after allows duplicates if it crashes between write and acknowledgment. Make the effect and deduplication record atomic, then acknowledge.",
      "refs": [
        "kafka"
      ]
    },
    {
      "phase": 6,
      "id": "workflows",
      "title": "Idempotency, outbox and sagas",
      "model": "Idempotency means repeating an operation has the same intended effect as performing it once. Scope a request key to the caller and operation, bind it to a payload fingerprint, and store the outcome durably. An outbox writes business state and an event record in one local transaction; a relay publishes later. A saga coordinates local transactions with business compensations rather than pretending to provide a global rollback.",
      "worked": "An order transaction inserts the order and outbox event. A relay may publish twice, so inventory consumes with a unique event ID. The workflow reserves inventory, requests payment and confirms shipment. If payment fails, release the reservation. If payment status is unknown, reconcile with the provider instead of creating another charge.",
      "tradeoff": "Compensation can fail and may not undo reality: a refund is a new transaction, not erased history. Use explicit states, retries, operator escalation and reconciliation. Define how long deduplication records live relative to retry windows.",
      "exercise": "The server completes a charge but the response is lost. What should the client send next?",
      "answer": "Retry with the same request key and identical parameters or query status by a stable operation ID. A new key may create another charge. The server must resolve the existing durable operation rather than treating the timeout as proof of failure.",
      "refs": [
        "stripe",
        "outbox"
      ]
    },
    {
      "phase": 6,
      "id": "streaming",
      "title": "Stream processing, windows and late data",
      "model": "Event time describes when something happened; processing time describes when the system saw it. Out-of-order arrival makes time windows nontrivial. A watermark is a progress estimate used to decide when windows can be finalized; it is not proof that no late event exists. Define allowed lateness, update or correction policy and state retention.",
      "worked": "For clicks per minute, partition by campaign, deduplicate event IDs and aggregate event-time windows. Publish provisional counts, then finalize after the chosen lateness allowance. A mobile client reconnecting hours later may require a correction stream or batch reconciliation rather than silently discarding revenue-relevant data.",
      "tradeoff": "A hot campaign can overload one partition. Partial aggregates spread computation and merge later, but exact distinct counts require more state than sums. Approximate sketches trade bounded error for memory; explain whether approximation is acceptable.",
      "exercise": "If a watermark has passed 12:01 and an event timestamped 12:00:30 arrives, what happens?",
      "answer": "That is a product and pipeline policy decision: update within allowed lateness, emit a correction, route to a late-data stream or discard with a metric. Never claim the watermark prevents late arrival.",
      "refs": [
        "kafka"
      ]
    },
    {
      "phase": 7,
      "id": "timeouts",
      "title": "Deadlines, retries and circuit breakers",
      "model": "A deadline bounds total operation time; per-hop timeouts consume that budget. Retry only errors for which repetition is safe and likely useful. Use capped backoff with jitter, a retry budget and a single deliberate retry layer. A circuit breaker temporarily stops calls to a failing dependency and probes recovery; it is distinct from a concurrency limiter.",
      "worked": "A 300 ms request budget might reserve 30 ms for parsing and response work and allow at most 270 ms for dependencies. Three layers each performing three attempts can create 27 downstream attempts. A slow dependency can hold sockets and workers even while CPU remains low.",
      "tradeoff": "Timeout does not mean an operation failed; it means the caller does not know the outcome. Retries require idempotency or reconciliation. Avoid automatic retries of validation failures and avoid synchronized retries that create another spike.",
      "exercise": "Why can a retry improve individual success probability but reduce overall availability?",
      "answer": "During overload it consumes scarce capacity, delays original traffic and causes more timeouts. Bound attempts and concurrency, add jitter, and stop retrying when the deadline or retry budget is exhausted.",
      "refs": [
        "retry"
      ]
    },
    {
      "phase": 7,
      "id": "overload",
      "title": "Rate limiting, backpressure and load shedding",
      "model": "Rate limits restrict arrivals over time; concurrency limits bound in-flight work. A token bucket allows bursts up to capacity and replenishes at a fixed rate. Backpressure asks upstream producers to slow down. Load shedding rejects selected work to preserve essential capacity. Fairness and tenant isolation prevent one customer from exhausting the system.",
      "worked": "With a bucket capacity of 100 and refill of 10 tokens/s, an idle client can burst 100 requests, then sustain about 10/s. A distributed limiter must atomically update state or tolerate bounded overshoot. Local allocations reduce shared-store load but weaken exact global limits unless coordinated.",
      "tradeoff": "Queues cannot solve permanent overload. If arrivals exceed service rate, latency grows without bound until a limit is reached. Choose fail-open or fail-closed deliberately for limiter outages; authentication abuse and low-risk reads have different consequences.",
      "exercise": "A service can process 1,000 requests/s but receives 2,000/s indefinitely. What is the stable solution?",
      "answer": "Reduce admitted traffic, add effective processing capacity or reduce work per request. Buffering merely postpones failure. Preserve high-priority work, communicate retry timing and monitor rejected requests.",
      "refs": [
        "sre"
      ]
    },
    {
      "phase": 7,
      "id": "availability",
      "title": "SLOs, tail latency and disaster recovery",
      "model": "An SLI measures a user-visible outcome; an SLO sets its target over a window. An error budget is the allowed unsuccessful fraction. p99 describes the slowest one percent boundary, not an average. RPO is the acceptable amount of data loss; RTO is the target restoration time. Failover, backups and restore testing address different failure modes.",
      "worked": "At 99.9% over a 30-day time-based window, the unavailability budget is about 43.2 minutes. For a request-based SLO, use failed eligible requests instead of converting directly to minutes. If 100 independent subcalls each meet a latency threshold 99% of the time, all finish under it only about 0.99^100 = 36.6% of the time.",
      "tradeoff": "Correlated failures make independence assumptions optimistic. Synchronous cross-region durability increases latency, while asynchronous replication changes RPO. A backup that has never been restored is unverified recovery capability.",
      "exercise": "Does a replica in another zone protect against an accidental DELETE replicated to every node?",
      "answer": "No. Use retained backups or point-in-time recovery, protect credentials and test restoration. Recovery also needs application configuration, keys and a way to validate data integrity.",
      "refs": [
        "sre"
      ]
    },
    {
      "phase": 8,
      "id": "search",
      "title": "Search indexes and autocomplete",
      "model": "An inverted index maps terms to document postings; retrieval combines postings and ranking signals. Autocomplete needs prefix lookup and top suggestions, often via tries, finite-state structures or precomputed prefix tables. The search index is typically a derived view of authoritative content. Track update lag, deletion propagation and index version.",
      "worked": "A product update commits to storage and emits an indexing event. The indexer applies a document version so an older event cannot overwrite a newer one. Build a fresh index in parallel, validate results and switch an alias. Query-time filters must enforce access controls even when cached rankings are reused.",
      "tradeoff": "Freshness, ranking quality and latency compete. Prefix explosion and high-cardinality filters consume memory. Do not send every keystroke through an expensive full search without debouncing, caching and query limits.",
      "exercise": "How do you delete a private document from search safely?",
      "answer": "Revoke authoritative access immediately, propagate a versioned tombstone to the index and invalidate caches. Query-time authorization protects the gap before indexing catches up. Track deletion lag and audit retained copies.",
      "refs": [
        "security",
        "bigtable"
      ]
    },
    {
      "phase": 8,
      "id": "media",
      "title": "Object storage, CDNs and media pipelines",
      "model": "Store large immutable blobs separately from transactional metadata. Upload directly using short-lived scoped authorization, then finalize metadata after verifying the object. A CDN caches near users; cache keys, TTL and invalidation determine freshness. Media pipelines transform source files asynchronously into multiple sizes or bitrates.",
      "worked": "A video upload creates a pending asset and a multipart upload session. After checksum verification, an event triggers transcoding. Outputs use immutable versioned paths; a manifest becomes visible only when required renditions exist. A player fetches short segments through a CDN and adjusts bitrate to available bandwidth.",
      "tradeoff": "Replication costs storage; erasure coding can reduce overhead while increasing repair work and read complexity. CDN savings depend on cacheability, egress and audience geography. Deleting metadata alone does not delete blobs, cached segments or derived outputs.",
      "exercise": "A client uploads all bytes but never calls finalize. What must the service do?",
      "answer": "Keep the asset uncommitted, expire abandoned multipart sessions, and garbage-collect orphaned objects after a safe grace period. Reconciliation should recover a lost finalize response without publishing incomplete media.",
      "refs": [
        "gfs",
        "aws"
      ]
    },
    {
      "phase": 8,
      "id": "realtime",
      "title": "Realtime, presence and geospatial systems",
      "model": "WebSockets provide bidirectional connections; server-sent events fit server-to-client streams; polling is simpler when updates are infrequent. Durable events and ephemeral presence have different guarantees. Heartbeats with expiry estimate presence but cannot distinguish every network partition from a disconnected user. Geospatial cells narrow candidate search; exact distance filtering completes it.",
      "worked": "A ride service stores recent driver locations in spatial buckets with freshness timestamps. Query neighboring cells, filter by distance and availability, then use a conditional reservation to assign a driver once. A WebSocket informs the selected driver; it is not the authoritative assignment record.",
      "tradeoff": "Small cells improve precision but increase cross-cell work and update churn. Hot downtown cells need subdivision. Presence can be approximate; financial or ownership decisions cannot rely on a green online dot.",
      "exercise": "Two riders choose the same nearby driver. How do you prevent two active assignments?",
      "answer": "Use an authoritative conditional state transition from AVAILABLE to RESERVED with a reservation ID and expiry, or a transaction. Notify only after winning ownership; release or reconcile expired reservations.",
      "refs": [
        "patterns"
      ]
    },
    {
      "phase": 9,
      "id": "security",
      "title": "Authentication, authorization and tenant isolation",
      "model": "Authentication establishes identity; authorization checks permission for this action on this object. Check both at every trust boundary. Scope data access by tenant, validate object ownership and avoid trusting client-supplied roles. Encrypt transport, manage keys separately from data and minimize sensitive fields in logs. Rate limits and quotas also protect expensive business flows.",
      "worked": "GET /files/{id} first loads or queries metadata under the authenticated tenant, checks current sharing permissions and issues a short-lived download capability. A random file ID is not an authorization mechanism. Revocation semantics depend on already issued capabilities and cached content.",
      "tradeoff": "Fine-grained checks cost work but cannot be replaced by hiding buttons. Shared databases require reliable tenant predicates and tests; dedicated storage increases isolation at operational cost. Treat external webhook payloads and URLs as untrusted input.",
      "exercise": "Why is a cache keyed only by report_id dangerous in a multi-tenant service?",
      "answer": "Two tenants can collide or receive a response generated under different permissions. Include tenant and relevant authorization scope, and invalidate on permission changes. The source query must also enforce access.",
      "refs": [
        "security"
      ]
    },
    {
      "phase": 9,
      "id": "observability",
      "title": "Metrics, logs, traces and incident response",
      "model": "Metrics show aggregate behavior; logs capture events; traces connect work across services. Instrument request rate, errors, latency and saturation, plus domain signals such as duplicate charges or stale projections. Propagate correlation context across queues. Keep metric labels bounded: raw user IDs can create unmanageable cardinality.",
      "worked": "For a message pipeline, monitor send success, durable-commit latency, queue age, delivery latency and replay rate. A trace links API acceptance, broker publication and consumer processing. When delivery slows, queue age distinguishes an accumulating backlog from an isolated slow request.",
      "tradeoff": "Sampling reduces cost but can hide rare failures; retain targeted error traces and aggregate counters. Alert on actionable user impact with ownership and a runbook. CPU thresholds alone often wake someone without explaining what users are losing.",
      "exercise": "The API returns 202 successfully while notifications are delayed for hours. Is the system healthy?",
      "answer": "Acceptance alone is an incomplete SLI. Measure end-to-end delivery within the promised deadline, oldest pending age and failure outcomes. The API can look healthy while the user journey violates its SLO.",
      "refs": [
        "otel",
        "sre"
      ]
    },
    {
      "phase": 9,
      "id": "evolution",
      "title": "Deployments, schema changes and recovery drills",
      "model": "Changes must tolerate mixed versions during rollout. Expand-contract migrations add compatible fields, backfill, switch readers and writers, then remove old fields after the compatibility window. Canary deployments expose a small cohort and compare user-facing signals before expansion. Rollback requires data compatibility, not only the previous binary.",
      "worked": "To rename a database column, add the new column, write compatible values, backfill with checkpoints, verify equality, switch reads and later remove the old one. Rate-limit the backfill so it does not steal production I/O. For a derived index, build a new version and switch a pointer after validation.",
      "tradeoff": "Dual writes can diverge; instrument discrepancies and define the source of truth. A destructive migration may make binary rollback unsafe. Run recovery drills with realistic credentials, data sizes and dependencies to establish an actual restoration time.",
      "exercise": "Why should a backfill be resumable and idempotent?",
      "answer": "It can be interrupted or retried during deployment and failures. Checkpoints bound repeated work; version checks prevent old backfill data from overwriting newer writes; idempotency prevents duplicate effects.",
      "refs": [
        "aws",
        "sre"
      ]
    },
    {
      "phase": 10,
      "id": "boundaries",
      "title": "Monoliths, microservices and ownership",
      "model": "Choose service boundaries around cohesive responsibilities and data ownership. A modular monolith can provide clear boundaries with simple deployment and transactions. Microservices allow independent release and scaling but introduce network failure, schema compatibility and distributed workflows. Each service should own its invariants rather than share writable tables casually.",
      "worked": "Start a small commerce product with catalog, orders and billing modules in one deployable service. Extract transcoding or search indexing when asynchronous scale and ownership justify it. Extract billing only with explicit contracts for payment states, idempotency and reconciliation.",
      "tradeoff": "A service per database table creates chatty requests and weak ownership. Separate control-plane configuration from data-plane serving when configuration outages should not stop existing traffic. Architecture should reflect team and operational constraints as well as QPS.",
      "exercise": "What evidence would justify extracting a service?",
      "answer": "A clear ownership boundary plus independent scaling, deployment or isolation requirements that outweigh operational costs. Demonstrate the contract, failure behavior and data migration path before splitting.",
      "refs": [
        "aws"
      ]
    },
    {
      "phase": 10,
      "id": "global",
      "title": "Multi-region design and conflict resolution",
      "model": "Global placement trades proximity, fault isolation and coordination cost. Active-passive simplifies write ownership but needs failover and capacity readiness. Active-active allows regional writes but requires partition ownership or a merge model. Last-write-wins is simple but may lose updates and depends on an ordering policy; CRDTs support specific convergent operations, not arbitrary business invariants.",
      "worked": "A shopping cart can merge add/remove operations with carefully chosen set semantics, while seat inventory needs authoritative ownership or escrowed regional allocations. Route each account to a home region for writes and replicate read projections. During failover, fence the old writer and state the possible loss window.",
      "tradeoff": "Data residency limits placement and backup choices. Cross-region quorums add network latency; local writes with asynchronous replication change conflict and recovery semantics. A global design should name exactly which operations continue during a regional outage.",
      "exercise": "Two regions each see one remaining item and sell it. Can merging counters afterward preserve the no-oversell invariant?",
      "answer": "No. Reconciliation detects the violation after it happened. Coordinate allocation before sale, use a single owner, or preallocate nonoverlapping inventory rights to regions.",
      "refs": [
        "spanner",
        "patterns"
      ]
    },
    {
      "phase": 10,
      "id": "mastery",
      "title": "From worked designs to independent performance",
      "model": "Use a repeated loop: predict a design, write assumptions, draw a request flow, calculate the dominant load, identify the hardest invariant, then stress it with failures. Compare to the worked blueprint only after committing to your own answer. Redesign with a changed constraint to test transfer rather than recall.",
      "worked": "Build a tiny URL service, add a bounded cache, then drive concurrent traffic. Build an outbox worker that crashes after publishing and demonstrate safe replay. Build a reservation endpoint and run two concurrent requests against the last unit. Keep measurements and counterexamples; they reveal more than a polished diagram.",
      "tradeoff": "A content checklist is not interview readiness. Practice unfamiliar prompts, explain uncertainty and defend one rejected alternative. Senior interviews often probe migration, cost, operations and organizational boundaries; role-specific expectations vary.",
      "exercise": "Score an unseen 45-minute design from 0–2 in requirements, sizing, data/API, correctness, tradeoffs and operations. What should a zero imply?",
      "answer": "Treat a zero as a gap to remediate, not something hidden by the total. Repeat a different prompt after targeted study. This rubric is a practice aid, not a validated predictor of a hiring decision.",
      "refs": [
        "sre",
        "aws"
      ]
    }
  ],
  "patterns": [
    {
      "id": "cache-aside",
      "title": "Cache-aside",
      "category": "Read scaling",
      "signal": "Repeated reads with tolerable bounded staleness.",
      "mechanism": "Read cache → on miss read source → populate with TTL. Commit writes to the source, then invalidate or update the projection. Coalesce concurrent fills and version values when old fills can race with new writes.",
      "failure": "A cache outage floods storage. Bound fallback concurrency and use stale data only where allowed.",
      "avoid": "Do not use cached stock to authorize a sale.",
      "lesson": "caching",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "write-through",
      "title": "Write-through and write-behind",
      "category": "Read scaling",
      "signal": "A common access layer must keep frequently read values warm.",
      "mechanism": "Write-through persists through the caching layer before acknowledging under a defined durability contract. Write-behind batches persistence later, reducing write latency while exposing a loss window.",
      "failure": "A successful cache write may not mean durable storage. Specify ordering and crash recovery.",
      "avoid": "Avoid write-behind for an authoritative ledger unless a durable log protects acknowledged data.",
      "lesson": "caching",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "cdn",
      "title": "CDN and immutable assets",
      "category": "Read scaling",
      "signal": "Geographically distributed reads of cacheable content.",
      "mechanism": "Publish versioned object paths and serve through edge caches. Cache a small mutable manifest separately. Control origin access and signed URL expiry for private content.",
      "failure": "A bad cache key can leak private responses; an origin outage appears when caches miss.",
      "avoid": "Low-reuse personalized content may not benefit enough to justify caching.",
      "lesson": "media",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "singleflight",
      "title": "Request coalescing and stale revalidation",
      "category": "Read scaling",
      "signal": "A popular key expires and many callers request it together.",
      "mechanism": "Allow one in-flight fill per key; let peers wait within a deadline or receive an allowed stale value. Jitter expiration and cap concurrent refreshes across keys.",
      "failure": "A hung fill can block every waiter. Time out ownership and avoid recursively retrying fills.",
      "avoid": "Stale authorization or financial decisions are not safe fallback values.",
      "lesson": "caching",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "replicas",
      "title": "Read replicas and session consistency",
      "category": "Data distribution",
      "signal": "Read volume exceeds one primary and some reads tolerate lag.",
      "mechanism": "Send eligible reads to replicas; carry a write-position token or use primary reads when a session needs its own latest update. Monitor lag and remove unhealthy replicas from routing.",
      "failure": "Failover can lose writes if replication acknowledgments were asynchronous.",
      "avoid": "Replicas do not remove a primary write bottleneck.",
      "lesson": "replication",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "hash-shards",
      "title": "Hash partitioning and virtual nodes",
      "category": "Data distribution",
      "signal": "Many independent keys need balanced ownership.",
      "mechanism": "Map keys to stable partitions or a consistent-hash ring, then map partitions to nodes. Use virtual nodes to smooth placement and ownership epochs during movement.",
      "failure": "A single viral key remains hot; movement competes with normal traffic.",
      "avoid": "Range scans spanning many hash partitions may be expensive.",
      "lesson": "partitioning",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "range-shards",
      "title": "Range partitioning and splitting",
      "category": "Data distribution",
      "signal": "Queries need ordered scans within a key range.",
      "mechanism": "Assign contiguous key ranges to owners. Split growing or hot ranges and maintain a routing directory. Choose composite keys that avoid one sequential write hotspot.",
      "failure": "A monotonically increasing leading key can send all new writes to one shard.",
      "avoid": "Uniform random lookups may be simpler with hash partitioning.",
      "lesson": "partitioning",
      "refs": [
        "bigtable"
      ]
    },
    {
      "id": "scatter-gather",
      "title": "Scatter-gather and partial aggregation",
      "category": "Data distribution",
      "signal": "A query genuinely needs results from several partitions.",
      "mechanism": "Fan out with a shared deadline, compute local top-k or partial aggregates, then merge. Define whether missing shards yield partial results or an error.",
      "failure": "Fanout amplifies tail latency and load; retries can multiply the work.",
      "avoid": "Prefer a purpose-built projection for a frequent expensive global query.",
      "lesson": "availability",
      "refs": [
        "sre"
      ]
    },
    {
      "id": "cqrs",
      "title": "CQRS and materialized views",
      "category": "Data distribution",
      "signal": "Read shapes differ substantially from write invariants.",
      "mechanism": "Keep commands in an authoritative model and asynchronously build read-specific projections. Version events, expose freshness when useful and support replay into a new view.",
      "failure": "Projection drift or lag creates stale reads; rebuild must coexist with live updates.",
      "avoid": "A small CRUD service usually does not need separate models and pipelines.",
      "lesson": "models",
      "refs": [
        "outbox"
      ]
    },
    {
      "id": "event-sourcing",
      "title": "Event sourcing",
      "category": "Correctness",
      "signal": "Historical state transitions and replay are first-class requirements.",
      "mechanism": "Store accepted domain events as the authority and derive current state. Use optimistic stream versions, deterministic reducers and snapshots to bound replay time.",
      "failure": "Bad event schemas persist; replay can accidentally repeat external effects unless isolated.",
      "avoid": "An audit table alone does not require turning all business state into events.",
      "lesson": "workflows",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "idempotency",
      "title": "Idempotent commands and consumers",
      "category": "Correctness",
      "signal": "Requests or messages can be repeated after ambiguous failures.",
      "mechanism": "Use a stable scoped operation ID. Atomically claim the ID with the business effect or store a durable state machine. Return the stored outcome; reject reuse with a different payload.",
      "failure": "An in-memory dedup set disappears on restart. Expiring keys before the retry horizon allows duplicates.",
      "avoid": "Idempotency does not imply ordered delivery.",
      "lesson": "workflows",
      "refs": [
        "stripe"
      ]
    },
    {
      "id": "outbox",
      "title": "Transactional outbox and CDC",
      "category": "Correctness",
      "signal": "A database update must reliably cause an asynchronous event.",
      "mechanism": "Commit business state and an outbox row together; relay by polling or change-data capture. Record event IDs and apply idempotent consumption. Preserve required ordering per aggregate.",
      "failure": "Relay crash after publish causes duplicates. Monitor unpublished age and cleanup safely.",
      "avoid": "Do not claim atomicity with arbitrary external side effects merely because an outbox exists.",
      "lesson": "workflows",
      "refs": [
        "outbox"
      ]
    },
    {
      "id": "saga",
      "title": "Saga and compensation",
      "category": "Correctness",
      "signal": "A business workflow crosses separately owned transaction boundaries.",
      "mechanism": "Use explicit durable states. Each step commits locally; failures trigger retries or business compensation. Orchestration centralizes workflow visibility; choreography reduces a central coordinator but obscures flow.",
      "failure": "Compensation can also fail. Keep reconciliation and an operator intervention path.",
      "avoid": "If one local transaction naturally fits, a saga adds unnecessary complexity.",
      "lesson": "workflows",
      "refs": [
        "outbox"
      ]
    },
    {
      "id": "conditional-write",
      "title": "Compare-and-set and optimistic concurrency",
      "category": "Correctness",
      "signal": "Concurrent updates must detect stale assumptions.",
      "mechanism": "Read a version, then update only if that version or expected state still matches. On conflict, re-read and re-evaluate. Unique constraints defend invariants at the storage boundary.",
      "failure": "Unbounded conflict retries create livelock under contention.",
      "avoid": "Long multi-entity workflows need more than an isolated version check.",
      "lesson": "transactions",
      "refs": [
        "pg"
      ]
    },
    {
      "id": "leases",
      "title": "Leases with fencing tokens",
      "category": "Correctness",
      "signal": "A resource needs temporary ownership despite pauses and failover.",
      "mechanism": "Grant a monotonically increasing generation with ownership. Require the protected resource to reject writes with a generation older than the latest accepted one.",
      "failure": "Lease expiry alone cannot stop a paused worker from resuming and writing.",
      "avoid": "If the resource cannot enforce fencing, do not promise exclusive effects from the lock alone.",
      "lesson": "coordination",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "quorum",
      "title": "Quorum replication and consensus",
      "category": "Correctness",
      "signal": "Authoritative state needs agreed ordering across failed nodes.",
      "mechanism": "Use a proven protocol with leader generations, replicated logs and membership rules. A majority can maintain progress when enough voters communicate. Separate commit from application of effects.",
      "failure": "Losing quorum stops writes. External side effects still need their own safe protocol.",
      "avoid": "A counter with a valid merge rule may not need global consensus for every increment.",
      "lesson": "consensus",
      "refs": [
        "raft"
      ]
    },
    {
      "id": "queue",
      "title": "Durable queue and competing consumers",
      "category": "Asynchronous work",
      "signal": "Bursty work can finish outside the request deadline.",
      "mechanism": "Durably accept a job, let workers claim it, renew visibility while processing and acknowledge after its effect is safe. Use bounded retries and a dead-letter path.",
      "failure": "Worker crashes can cause redelivery; a queue grows forever under sustained overload.",
      "avoid": "Immediate strict request-response work cannot simply be hidden behind a queue.",
      "lesson": "queues",
      "refs": [
        "kafka"
      ]
    },
    {
      "id": "partitioned-log",
      "title": "Partitioned log and replay",
      "category": "Asynchronous work",
      "signal": "Multiple consumers need independent ordered history.",
      "mechanism": "Choose a partition key that matches the ordering scope. Retain events and track offsets per consumer group. Rebuild projections by replaying without invoking unsafe side effects.",
      "failure": "Hot partitions limit throughput; changing partition count can affect key ordering.",
      "avoid": "A log does not provide global order across all partitions.",
      "lesson": "queues",
      "refs": [
        "kafka"
      ]
    },
    {
      "id": "fanout",
      "title": "Fanout-on-write, fanout-on-read and hybrid",
      "category": "Asynchronous work",
      "signal": "A feed distributes producer content to followers.",
      "mechanism": "Push pointers into ordinary followers’ inboxes on write; pull high-fanout producers on read. Merge by a stable ranking key and enforce visibility at delivery time.",
      "failure": "Celebrity writes create enormous amplification; precomputed feeds can contain revoked content.",
      "avoid": "Choose the threshold from measured activity and cost, not a memorized follower number.",
      "lesson": "models",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "windowing",
      "title": "Event-time windows and correction streams",
      "category": "Asynchronous work",
      "signal": "Aggregates depend on when an event occurred.",
      "mechanism": "Group by event time, use watermarks as progress estimates and retain state for an explicit lateness window. Emit revisions or corrections for late events when the domain requires accuracy.",
      "failure": "Idle partitions can stall progress; late data can alter previously published totals.",
      "avoid": "Processing-time windows are simpler when event-time correctness is unnecessary.",
      "lesson": "streaming",
      "refs": [
        "kafka"
      ]
    },
    {
      "id": "retry-budget",
      "title": "Deadlines and retry budgets",
      "category": "Resilience",
      "signal": "Transient failures occur but downstream capacity is finite.",
      "mechanism": "Propagate an end-to-end deadline, retry safe operations with bounded jittered backoff and cap aggregate retries. Prefer one intentional retry layer.",
      "failure": "Layered retries multiply requests and can turn a slowdown into a cascading failure.",
      "avoid": "Validation errors and unsafe non-idempotent commands should not be blindly retried.",
      "lesson": "timeouts",
      "refs": [
        "retry"
      ]
    },
    {
      "id": "circuit-breaker",
      "title": "Circuit breaker and bulkhead",
      "category": "Resilience",
      "signal": "One failing dependency must not exhaust all resources.",
      "mechanism": "Open a breaker after meaningful failures; probe recovery with limited traffic. Use separate bounded pools for different dependencies or tenant classes.",
      "failure": "A badly tuned breaker can flap or reject useful work. Half-open probes need limits too.",
      "avoid": "A breaker is not a replacement for timeouts, capacity limits or fallback semantics.",
      "lesson": "timeouts",
      "refs": [
        "sre"
      ]
    },
    {
      "id": "token-bucket",
      "title": "Token bucket and distributed quotas",
      "category": "Resilience",
      "signal": "Clients need a sustained quota with controlled bursts.",
      "mechanism": "Refill tokens at rate r up to capacity b, atomically spend on acceptance and return retry guidance when empty. Shard by tenant or allocate local token budgets.",
      "failure": "Concurrent nonatomic reads overspend. Regional allocations can create bounded global overshoot.",
      "avoid": "Use a concurrency limit as well when requests have variable duration.",
      "lesson": "overload",
      "refs": [
        "sre"
      ]
    },
    {
      "id": "backpressure",
      "title": "Backpressure and admission control",
      "category": "Resilience",
      "signal": "Downstream work capacity is lower than incoming demand.",
      "mechanism": "Bound queues and in-flight work; reject or delay before expensive processing. Propagate pressure upstream and prioritize essential operations. Monitor queue age and rejection rates.",
      "failure": "Unbounded buffers hide overload until timeouts and memory exhaustion happen together.",
      "avoid": "Only slow producers that can actually respond; otherwise shed load explicitly.",
      "lesson": "overload",
      "refs": [
        "sre"
      ]
    },
    {
      "id": "multi-region",
      "title": "Home-region ownership and active-active merge",
      "category": "Global systems",
      "signal": "Users are global and regional failure matters.",
      "mechanism": "Assign authoritative write ownership per entity, or choose operations with a valid merge model. Replicate projections close to users. Fence ownership transfer and define recovery point objectives.",
      "failure": "Two writable owners can violate invariants during a partition. Clock-based last-write-wins may discard valid changes.",
      "avoid": "Arbitrary financial or inventory invariants do not become safe by selecting a CRDT.",
      "lesson": "global",
      "refs": [
        "spanner"
      ]
    },
    {
      "id": "anti-entropy",
      "title": "Anti-entropy and reconciliation",
      "category": "Global systems",
      "signal": "Replicas or derived views can diverge over time.",
      "mechanism": "Compare versioned ranges, checksums or trees to locate differences, then repair from authoritative history or a domain merge rule. Keep tombstones long enough to prevent resurrection.",
      "failure": "Repair traffic can overload nodes; deleting tombstones too early revives old data.",
      "avoid": "Reconciliation detects some violations after the fact and cannot replace precondition enforcement.",
      "lesson": "replication",
      "refs": [
        "patterns"
      ]
    },
    {
      "id": "strangler",
      "title": "Strangler migration and expand-contract",
      "category": "Evolution",
      "signal": "A live system must change without a flag-day replacement.",
      "mechanism": "Move one route or capability at a time behind an abstraction. Add compatible schemas, backfill with versions, compare outputs and switch reads before removing old paths.",
      "failure": "Mixed versions and dual writes can diverge. Define a rollback boundary before destructive changes.",
      "avoid": "A full distributed migration is excessive for a small offline transformation.",
      "lesson": "evolution",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "control-plane",
      "title": "Control plane and data plane",
      "category": "Evolution",
      "signal": "Configuration management should not be on every serving request.",
      "mechanism": "Validate and distribute versioned configurations through a control plane. Serving nodes retain a known-good configuration and report applied versions. Specify how revocations propagate.",
      "failure": "Stale configuration may be unsafe for access revocation even if serving remains available.",
      "avoid": "Do not place a remote control-plane lookup in every latency-sensitive request by default.",
      "lesson": "boundaries",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "cell",
      "title": "Cells and shuffle sharding",
      "category": "Resilience",
      "signal": "A large tenant or failure should affect a bounded subset of customers.",
      "mechanism": "Assign tenants to independently capacity-limited cells, each with its own serving resources. Use placement and spare capacity to avoid correlated overload; rehearse tenant movement.",
      "failure": "Shared global dependencies can defeat cell isolation. Moving tenants needs consistent routing.",
      "avoid": "Small services may get enough isolation from simpler bounded pools.",
      "lesson": "overload",
      "refs": [
        "aws"
      ]
    },
    {
      "id": "crdt",
      "title": "CRDTs and convergent operations",
      "category": "Global systems",
      "signal": "Offline or regional updates must merge without coordination for selected operations.",
      "mechanism": "Choose a mathematically defined state or operation merge, such as per-replica grow-only counters merged by componentwise maximum. Specify deletion, identity and garbage-collection semantics.",
      "failure": "A naive sum of repeated states double-counts. Tombstone and replica lifecycle rules matter.",
      "avoid": "Convergence alone cannot preserve arbitrary constraints such as no overdraft.",
      "lesson": "global",
      "refs": [
        "patterns"
      ]
    }
  ],
  "designs": [
    {
      "id": "shortener",
      "title": "URL shortener",
      "level": "Foundation",
      "requirements": "Create links, redirect by code and expire or delete links. Exclude custom analytics initially. Redirects dominate; deleted or malicious links must stop resolving within a stated freshness bound.",
      "scale": "Assume 100M redirects/day: about 1,157/s average and 11,570/s at 10× peak. At 1M new links/day and 500 bytes of metadata, raw growth is about 500 MB/day before indexes and replication.",
      "api": "POST /links {url, expiry, request_id}; GET /{code}; DELETE /links/{id}. Authenticate creation and deletion; validate schemes and prevent unsafe redirects.",
      "data": "links(code UNIQUE, owner_id, destination, expires_at, status, version). Generate a sufficiently large random code with a unique insert-and-retry or allocate unique IDs and encode them.",
      "flow": [
        "Client → redirect edge/service → cache",
        "Cache miss → mapping store → cache fill with TTL",
        "Create → validate → unique insert → return code",
        "Click events → bounded asynchronous analytics pipeline"
      ],
      "decision": "Choose redirect status and cache headers to match edit/delete semantics. Very long browser caching undermines immediate revocation. A cache protects hot links; partitioning the store does not split one hot key.",
      "failure": "If storage is unavailable, serve an allowed cached mapping or fail explicitly. Tombstones and bounded TTL prevent deleted links from resurfacing; abuse rules must also cover cached redirects.",
      "followup": [
        "How does a viral link change your bottleneck?",
        "What if links must be unguessable?",
        "How do you invalidate a cached malicious destination?"
      ],
      "patterns": [
        "cache-aside",
        "singleflight",
        "hash-shards"
      ]
    },
    {
      "id": "limiter",
      "title": "Distributed rate limiter",
      "level": "Foundation",
      "requirements": "Enforce per-tenant API budgets with bursts and return retry guidance. Define whether limits must be exact globally or can have bounded overshoot. Protect both rate and expensive concurrent work.",
      "scale": "At 100K decisions/s, one remote store call per request also means 100K store operations/s. Local token allocations reduce coordination but require an explicit overshoot bound.",
      "api": "check(tenant, route, cost) → allowed, remaining, retry_after. Management API changes versioned policies separately from the request path.",
      "data": "bucket(tenant, route, tokens, last_refill, policy_version). Update refill and spending atomically; choose a trusted time source and clamp backward elapsed time.",
      "flow": [
        "Request → authenticated tenant → local policy",
        "Atomic bucket decision → accept or reject",
        "Accepted request → concurrency gate → service",
        "Policy service → versioned configuration distribution"
      ],
      "decision": "Token buckets support bursts; a sliding log is more exact for rolling windows but costs more memory. Per-region quotas bound coordination but can leave unused capacity in one region.",
      "failure": "State-store outage needs a documented fail-open, fail-closed or conservative local allowance policy. Bound the fallback per tenant so a partition cannot unlock unlimited traffic.",
      "followup": [
        "How do you handle a hot tenant?",
        "How much can two regions overshoot?",
        "How do policy reductions affect already issued local tokens?"
      ],
      "patterns": [
        "token-bucket",
        "control-plane",
        "backpressure"
      ]
    },
    {
      "id": "cache",
      "title": "Distributed cache",
      "level": "Foundation",
      "requirements": "Provide get/set/delete with TTL for disposable values. Define maximum object size, eviction behavior and acceptable miss handling. Durability is not required unless the contract explicitly says so.",
      "scale": "100M entries × 1 KB is 100 GB of values, before keys, allocator overhead, metadata and replication. Reserve memory headroom rather than filling RAM to the last byte.",
      "api": "GET key; SET key value ttl version; DELETE key. Optional compare-and-set prevents older fills replacing newer versions.",
      "data": "Key ownership map with epochs; per-node hash table plus expiration and eviction structures. Stable virtual partitions allow gradual movement.",
      "flow": [
        "Client → routing layer → partition owner",
        "Miss → caller fetches authoritative source",
        "Membership change → warm or migrate partitions",
        "Hot key → read replicas or local bounded cache"
      ],
      "decision": "Client routing saves a proxy hop but complicates membership updates. A proxy centralizes routing but adds capacity and failure concerns. Eviction policy should reflect workload and object sizes.",
      "failure": "Node loss creates correlated misses. Rate-limit refills, coalesce per-key requests and keep spare source capacity. Do not turn cache replication into a false promise of database durability.",
      "followup": [
        "How do you detect a hot key?",
        "What happens during rebalancing?",
        "How do you prevent a cache stampede after restart?"
      ],
      "patterns": [
        "hash-shards",
        "singleflight",
        "cache-aside"
      ]
    },
    {
      "id": "kv",
      "title": "Distributed key-value store",
      "level": "Advanced",
      "requirements": "Support key lookup and conditional writes with a precise consistency contract. Decide whether ranges and multi-key transactions are in scope. Acknowledged durability and behavior during partitions are central.",
      "scale": "1B records × 1 KB is 1 TB raw. Three replicas require about 3 TB before indexes, logs and compaction. Benchmark peak write throughput and skew per partition.",
      "api": "GET key; PUT key value expected_version; DELETE key expected_version. Return an explicit conflict when the version precondition fails.",
      "data": "Partition map; versioned records and tombstones; durable write-ahead log; replica membership and committed positions.",
      "flow": [
        "Client → partition router → leader",
        "Leader → durable quorum log → commit → apply",
        "Read → leader or protocol-safe read path",
        "Snapshot and log catch-up → replacement replicas"
      ],
      "decision": "Start with linearizable single-key operations via a proven consensus group per partition. Read replicas need a safe read protocol or an explicitly weaker consistency mode. Avoid claiming R+W>N alone proves correctness.",
      "failure": "A minority partition rejects writes. Ownership changes require epochs and log catch-up. Compaction must preserve needed tombstones; backup restoration must not resurrect deleted values.",
      "followup": [
        "How does membership change safely?",
        "What is the write acknowledgment point?",
        "What changes for cross-key transactions?"
      ],
      "patterns": [
        "quorum",
        "hash-shards",
        "conditional-write",
        "anti-entropy"
      ]
    },
    {
      "id": "notifications",
      "title": "Notification platform",
      "level": "Intermediate",
      "requirements": "Send email, push and SMS from durable business events. Support preferences, priority and retry limits. Distinguish accepted, dispatched and provider-confirmed delivery.",
      "scale": "50M notifications/day is about 579/s average; a campaign can produce a much higher burst. Provider rate limits and fanout, not just daily average, determine drain time.",
      "api": "POST /notifications {event_id, recipient, template, channel}; GET /notifications/{id}. Management endpoints update preferences and templates.",
      "data": "notification(id, event_id, recipient, channel, state, attempt, next_attempt_at); unique dedup key; versioned templates and preference snapshots where appropriate.",
      "flow": [
        "Business transaction → outbox → notification queue",
        "Dispatcher → preference and quota checks",
        "Channel worker → provider with stable request key",
        "Provider callback → validated status transition"
      ],
      "decision": "Separate priority queues prevent marketing traffic from delaying security messages. Recheck unsubscribe rules before dispatch. Queue acceptance is not evidence of delivery.",
      "failure": "A provider timeout leaves status unknown. Query provider state or retry with provider-supported idempotency. Without that support, explain the remaining duplicate risk and reconcile callbacks.",
      "followup": [
        "How do you prevent duplicate SMS charges?",
        "What if a provider is down for six hours?",
        "How do you handle an unsubscribe during a campaign?"
      ],
      "patterns": [
        "outbox",
        "queue",
        "idempotency",
        "retry-budget"
      ]
    },
    {
      "id": "feed",
      "title": "Social news feed",
      "level": "Intermediate",
      "requirements": "Publish posts, follow users and read a paginated feed. Start with chronological ordering; add ranking later. Define freshness, visibility changes and deletion semantics.",
      "scale": "10M daily users × 20 feed reads = 200M reads/day. A producer with 10M followers makes naive fanout-on-write create 10M inbox updates per post.",
      "api": "POST /posts; PUT /follows/{user}; GET /feed?cursor=... . Use stable post IDs and cursor tie-breakers.",
      "data": "posts(author_id, post_id, time, visibility, version); follows; inbox(user_id, sort_key, post_id). Store pointers rather than duplicating large post bodies.",
      "flow": [
        "Publish → authoritative post and outbox",
        "Fanout workers → ordinary follower inboxes",
        "Read → inbox plus high-fanout authors → merge/rank",
        "Hydrate posts → enforce current visibility → return cursor"
      ],
      "decision": "Use a measured hybrid fanout threshold. Precomputation reduces read cost but increases storage and write amplification; pull-based reads are cheaper for infrequent users and celebrity producers.",
      "failure": "Fanout lag should degrade freshness, not lose the authoritative post. Deletions and blocks require query-time filtering plus asynchronous cleanup. Ranking changes complicate stable pagination.",
      "followup": [
        "What if a celebrity posts during peak load?",
        "How do you handle new followers?",
        "Can a deleted post remain in a cached feed?"
      ],
      "patterns": [
        "fanout",
        "cqrs",
        "cache-aside",
        "partitioned-log"
      ]
    },
    {
      "id": "chat",
      "title": "Chat and group messaging",
      "level": "Intermediate",
      "requirements": "Support direct and group messages, durable history, reconnect and device sync. Guarantee ordering per conversation, not globally. Distinguish server acceptance, device delivery and user read receipts.",
      "scale": "5M concurrent connections × an assumed 20 KB of gateway state is 100 GB across gateways, before buffers. Message and fanout rates need separate estimates.",
      "api": "POST /conversations/{id}/messages {client_message_id, body}; GET history?after_seq=...; WebSocket event stream with acknowledgments.",
      "data": "messages(conversation_id, sequence, message_id, sender, body); membership; device cursors. Unique client_message_id per sender prevents repeated sends.",
      "flow": [
        "Client → authenticated gateway → conversation owner",
        "Owner → durable ordered append → acknowledge",
        "Delivery stream → member gateways",
        "Reconnect → fetch messages after persisted device cursor"
      ],
      "decision": "A conversation leader or partition orders messages. Presence is ephemeral and eventually consistent. Large groups need different fanout policies; one group can become a hot partition.",
      "failure": "Gateway loss triggers reconnect and replay. Redelivery is safe via message IDs. Check membership on send and history access; a cached group list must not grant revoked access indefinitely.",
      "followup": [
        "How do multiple devices synchronize?",
        "What is the ordering guarantee across regions?",
        "How does a million-member channel change fanout?"
      ],
      "patterns": [
        "partitioned-log",
        "idempotency",
        "multi-region",
        "fanout"
      ]
    },
    {
      "id": "files",
      "title": "File storage and synchronization",
      "level": "Intermediate",
      "requirements": "Upload, download, share and sync versioned files. Support interrupted uploads and conflicting offline edits. State whether automatic merge is supported for arbitrary binary files.",
      "scale": "1M uploads/day × 5 MB is 5 TB/day raw ingress. Metadata is much smaller but more transactional; bandwidth and retained versions dominate cost.",
      "api": "POST /uploads; PUT signed part URL; POST /uploads/{id}/finalize; GET /changes?cursor=...; conditional update using base_version.",
      "data": "files(file_id, owner, current_version, permissions); versions(file_id, version, manifest, checksum); chunk references; ordered user change log.",
      "flow": [
        "Client → create scoped upload session",
        "Client → multipart object storage upload",
        "Finalize → verify checksums → conditionally publish version",
        "Change log → device sync cursor → fetch missing chunks"
      ],
      "decision": "Chunk deduplication reduces repeated bytes but complicates reference counting and privacy. Concurrent binary edits can produce explicit conflict copies rather than silently overwriting one version.",
      "failure": "Orphan uploads need garbage collection. Finalize retries must be idempotent. Permission revocation must cover download capabilities, cached metadata and shared links within defined bounds.",
      "followup": [
        "What if two devices edit offline?",
        "How do you resume a 10 GB upload?",
        "How do you safely garbage-collect shared chunks?"
      ],
      "patterns": [
        "cdn",
        "conditional-write",
        "partitioned-log",
        "idempotency"
      ]
    },
    {
      "id": "video",
      "title": "Video upload and streaming",
      "level": "Intermediate",
      "requirements": "Upload videos, transcode asynchronously and play adaptive bitrate streams. Separate on-demand video from live streaming. Define when a video becomes playable and how private content is protected.",
      "scale": "100K uploads/day × 100 MB is 10 TB/day raw input. One million viewers at 3 Mbps consume about 3 Tbps aggregate delivery bandwidth; a CDN is a dominant component.",
      "api": "POST /videos/upload-session; POST /videos/{id}/finalize; GET /videos/{id}/playback. Return pending/processing/ready/failed states.",
      "data": "asset(id, owner, source_ref, version, state); rendition(asset_id, bitrate, object_prefix, checksum); manifest; durable jobs.",
      "flow": [
        "Upload → verified source object → outbox",
        "Transcode queue → workers → immutable segments",
        "Validate renditions → publish manifest",
        "Player → authorized manifest → CDN segments"
      ],
      "decision": "Precompute popular renditions to reduce playback startup time. More renditions increase compute and storage. Shorter segments aid adaptation but increase request overhead.",
      "failure": "Worker crashes retry a versioned job safely. Never publish an incomplete manifest. CDN cache misses can overwhelm origin; isolate private cache keys and revoke access deliberately.",
      "followup": [
        "How does live video change latency?",
        "What if a transcode job is stuck?",
        "How do you delete all derived copies?"
      ],
      "patterns": [
        "queue",
        "cdn",
        "idempotency",
        "backpressure"
      ]
    },
    {
      "id": "autocomplete",
      "title": "Search autocomplete",
      "level": "Foundation",
      "requirements": "Return top suggestions for a prefix with low latency. Define language support, personalization, moderation and freshness. Keep full document search outside the initial scope.",
      "scale": "10M users × 20 searches × 5 keystroke requests yields 1B lookups/day before debouncing. At roughly 11.6K/s average, hot prefixes benefit greatly from caching.",
      "api": "GET /suggest?q=prefix&locale=... with length limits and top-k cap. Avoid leaking private user queries into shared suggestions.",
      "data": "Versioned prefix index containing bounded ranked candidates; popularity aggregates; suppression list. Normalize text consistently at build and query time.",
      "flow": [
        "Sanitized events → aggregate popularity → build candidate index",
        "Validate new index → atomic version switch",
        "Query → prefix cache → index lookup → moderation filter"
      ],
      "decision": "A trie offers prefix traversal; precomputed top-k per prefix trades memory for fast reads. Global popularity can refresh in batches while urgent moderation requires a fast override.",
      "failure": "Retain a previous valid index for rollback. Prevent untrusted query floods from distorting rankings. Apply removal rules on the serving path so banned suggestions do not wait for a full rebuild.",
      "followup": [
        "How do you support typos?",
        "How do non-Latin languages change normalization?",
        "How do you prevent cache leakage from personalization?"
      ],
      "patterns": [
        "cqrs",
        "cache-aside",
        "control-plane"
      ]
    },
    {
      "id": "crawler",
      "title": "Web crawler",
      "level": "Intermediate",
      "requirements": "Discover and fetch allowed public pages with per-host politeness, deduplication and recrawl scheduling. Respect access restrictions and robots policies; avoid private-network fetching.",
      "scale": "100M pages/day is about 1,157 fetches/s. At 200 KB/page, raw ingress is about 20 TB/day, before parsing outputs and storage copies.",
      "api": "Internal enqueue(url, priority, next_fetch_at); claim(host); recordFetch(url, status, digest). Operator controls pause hosts and set budgets.",
      "data": "URL frontier keyed by normalized URL; host schedules; fetched content hashes; robots/cache metadata; crawl history.",
      "flow": [
        "Seeds → URL normalization and policy checks",
        "Host-aware scheduler → fetch workers",
        "Content store → parser → discovered URLs",
        "Dedup and priority → frontier for future work"
      ],
      "decision": "Deduplicate both URLs and content. A Bloom filter can reduce lookups but false positives may skip unseen URLs unless verified. Avoid unbounded URL spaces such as calendar parameters and session IDs.",
      "failure": "Retries preserve per-host budgets. Resolve and validate destination addresses to prevent SSRF and DNS rebinding into internal networks. Back off slow hosts and bound response sizes.",
      "followup": [
        "How do you detect crawler traps?",
        "How do you prioritize recrawls?",
        "What if one host publishes a billion URLs?"
      ],
      "patterns": [
        "queue",
        "token-bucket",
        "hash-shards",
        "backpressure"
      ]
    },
    {
      "id": "metrics",
      "title": "Metrics and monitoring platform",
      "level": "Advanced",
      "requirements": "Ingest time-series samples, query aggregates and evaluate alerts. Specify retention, resolution, acceptable lag and cardinality limits. Separate high-cardinality logs from metric labels.",
      "scale": "1M series sampled every 10 seconds produces 100K samples/s. At 16 bytes per raw sample, that is about 138 GB/day, excluding labels, indexes and replicas.",
      "api": "POST /samples with batch and size limits; GET /query?expression=...; POST /alert-rules. Authenticate tenant scope on ingest and query.",
      "data": "series fingerprint from metric and normalized labels; time-partitioned sample blocks; label index; rule state and alert deduplication key.",
      "flow": [
        "Agent buffer → ingestion gateway → partitioned durable log",
        "Compaction workers → time-series blocks",
        "Query planner → shards → partial aggregation",
        "Rule evaluator → deduplicated notification pipeline"
      ],
      "decision": "Downsampling reduces long-term cost but loses detail. Bound label combinations, query range and fanout. Approximate or partial results must be explicitly marked.",
      "failure": "Ingestion acknowledgment must match durability guarantees. A monitoring outage should not overload the monitored services; agents need bounded buffers and drop policies. Detect evaluator lag separately.",
      "followup": [
        "How do you limit a cardinality explosion?",
        "How do you handle out-of-order samples?",
        "How do alerts avoid firing twice after failover?"
      ],
      "patterns": [
        "partitioned-log",
        "windowing",
        "scatter-gather",
        "token-bucket"
      ]
    },
    {
      "id": "scheduler",
      "title": "Distributed job scheduler",
      "level": "Advanced",
      "requirements": "Schedule one-off and periodic jobs, retry failures and expose execution history. Define time-zone and daylight-saving semantics. Promise durable scheduling, not magically exactly-once external execution.",
      "scale": "10M scheduled jobs/day is about 116/s average, but a common top-of-hour schedule can create a huge synchronized burst. Size for due-time skew and dispatch latency.",
      "api": "POST /jobs {schedule, timezone, payload, idempotency_key}; DELETE /jobs/{id}; GET /executions/{id}. Version edits and cancellations.",
      "data": "job(id, schedule, next_due, version); execution(job_id, scheduled_time UNIQUE, state, lease_generation, attempt); due-time index.",
      "flow": [
        "Scheduler scans due buckets → atomically creates execution",
        "Durable queue → worker claim",
        "Worker runs with fenced ownership → records result",
        "Rescheduler calculates next occurrence from policy"
      ],
      "decision": "Separate scheduling from execution. A unique (job, scheduled_time) prevents duplicate execution records, but the task still needs idempotent external effects. Document missed-run and catch-up policy.",
      "failure": "Leases recover crashed workers but cannot stop paused workers without fencing. Cancellation races with execution; define whether it prevents future starts or attempts interruption.",
      "followup": [
        "What happens after one hour of downtime?",
        "How do you handle DST changes?",
        "How do you prevent duplicate external effects?"
      ],
      "patterns": [
        "leases",
        "queue",
        "idempotency",
        "conditional-write"
      ]
    },
    {
      "id": "payments",
      "title": "Payments and ledger",
      "level": "Advanced",
      "requirements": "Create payment intents, track provider outcomes and maintain auditable balances. Never treat a timeout as definitive failure. Preserve balanced ledger entries and stable operation identity.",
      "scale": "10M transactions/day is about 116/s average. Peak rate matters, but correctness, provider limits, reconciliation and hot accounts usually drive architecture more than raw storage volume.",
      "api": "POST /payment-intents with idempotency key; POST /intents/{id}/confirm; GET status; signed provider webhook endpoint.",
      "data": "intent(id, caller, payload_hash, state); provider_operation; immutable ledger entries grouped by transaction; unique external event IDs; outbox.",
      "flow": [
        "Request → durable intent claim",
        "Provider request with stable key → pending/succeeded/failed state",
        "Verified callback or polling → guarded transition",
        "Balanced ledger transaction → outbox → downstream projections"
      ],
      "decision": "Use a local transaction for ledger invariants. Separate authorization, capture and refund states where needed. Reconciliation compares internal intent/ledger records with provider statements.",
      "failure": "Duplicate and out-of-order callbacks must not double-credit. Unknown outcomes remain pending for investigation. Do not delete financial history to simulate rollback; record compensating entries.",
      "followup": [
        "A charge succeeded but your database write failed—now what?",
        "How do you prevent double refunds?",
        "Can a balance projection authorize spending?"
      ],
      "patterns": [
        "idempotency",
        "outbox",
        "conditional-write",
        "saga"
      ]
    },
    {
      "id": "tickets",
      "title": "Ticket booking and inventory",
      "level": "Advanced",
      "requirements": "Browse seats, hold temporarily, pay and confirm. Never confirm the same seat to two owners. Distinguish advisory availability from authoritative reservation status.",
      "scale": "A launch may receive 1M attempts/minute, roughly 16.7K/s, concentrated on one event. This is a contention problem; evenly distributed global QPS estimates are misleading.",
      "api": "POST /events/{id}/holds {seat_ids, request_id}; POST /holds/{id}/confirm; GET /holds/{id}. Return explicit expired, unavailable and pending-payment states.",
      "data": "seat(event_id, seat_id, state, hold_id, expires_at, version); hold; payment_intent. Acquire multiple seats atomically or document partial acquisition behavior.",
      "flow": [
        "Waiting room and admission control → booking service",
        "Conditional transaction claims seats → durable hold",
        "Payment workflow → verified outcome",
        "Confirm only the still-owned hold → emit ticket"
      ],
      "decision": "A hold expiry timestamp is not sufficient by itself. Confirmation checks ownership and expiry at the authoritative transaction boundary. Search can cache availability while final allocation remains serialized per seat.",
      "failure": "If payment succeeds after expiry, reconcile and refund or apply an explicit recovery policy; never silently steal a seat already sold. Cleanup is idempotent and cannot free a confirmed seat.",
      "followup": [
        "How do you acquire four adjacent seats atomically?",
        "What if payment completes late?",
        "How do you stop bots exhausting holds?"
      ],
      "patterns": [
        "conditional-write",
        "saga",
        "idempotency",
        "backpressure"
      ]
    },
    {
      "id": "rides",
      "title": "Ride matching and live locations",
      "level": "Advanced",
      "requirements": "Ingest driver locations, find nearby available drivers and assign each driver to at most one active trip. Location freshness can be approximate; assignment ownership cannot.",
      "scale": "1M online drivers updating every five seconds produce 200K location updates/s. Spatial density and hot city cells matter more than uniform global distribution.",
      "api": "PUT /drivers/{id}/location {seq, time, coordinates}; POST /rides; POST /offers/{id}/accept. Authenticate location ownership.",
      "data": "ephemeral spatial cells with timestamped driver locations; authoritative driver availability/version; trip and offer state; location history with retention policy.",
      "flow": [
        "Location gateway → spatial index",
        "Rider request → nearby-cell candidates → distance and freshness filter",
        "Conditional driver reservation → timed offer",
        "Acceptance → atomic assignment → notify both parties"
      ],
      "decision": "Separate high-volume ephemeral location updates from durable trip state. Geohash or another spatial cell scheme narrows candidates; exact distance and routing quality require further work.",
      "failure": "Stale locations are filtered by age. Duplicate accepts and expired offers cannot create two trips. Reconcile a driver reconnecting after losing the assignment response.",
      "followup": [
        "How do you handle dense downtown cells?",
        "How do you prevent simultaneous assignments?",
        "What changes when a driver crosses a region?"
      ],
      "patterns": [
        "conditional-write",
        "hash-shards",
        "multi-region",
        "queue"
      ]
    },
    {
      "id": "collaboration",
      "title": "Collaborative document editor",
      "level": "Advanced",
      "requirements": "Edit documents concurrently, reconnect after offline work and preserve convergence. Specify cursor presence, version history and access revocation. Choose conflict semantics before choosing a CRDT or OT implementation.",
      "scale": "100K concurrent editors × 2 operations/s is 200K operations/s before fanout. A single huge shared document can dominate one partition and requires its own limits.",
      "api": "WebSocket submit(document_id, client_id, operation_id, base_version, op); GET snapshot plus operations after version.",
      "data": "document snapshots; durable ordered or causally identified operations; per-client acknowledgment positions; membership/permission version.",
      "flow": [
        "Client applies optimistic local edit → document service",
        "Validate operation and permission → durable operation history",
        "OT transform or CRDT integration → broadcast",
        "Reconnect → snapshot and missing operations → merge"
      ],
      "decision": "OT transforms concurrent operations against an ordering model; CRDTs define merge rules with metadata costs. Use a proven algorithm. Text editing, rich structures and deletion require precise semantics, not a generic merge function.",
      "failure": "Duplicate operations deduplicate by ID. Compact history only when needed causal or transformation context is preserved. Recheck permissions after offline reconnect rather than trusting old session state.",
      "followup": [
        "How do offline edits merge after a week?",
        "What happens when access is revoked mid-session?",
        "How do you compact tombstones safely?"
      ],
      "patterns": [
        "crdt",
        "partitioned-log",
        "idempotency",
        "multi-region"
      ]
    },
    {
      "id": "commerce",
      "title": "E-commerce checkout",
      "level": "Advanced",
      "requirements": "Convert a cart into an order with price validation, inventory reservation and payment. Define when an order is accepted versus confirmed. Avoid overselling and duplicate charges.",
      "scale": "1M orders/day is about 11.6/s average; sale peaks can be hundreds of times higher for a small set of SKUs. Browse traffic should not contend with inventory authorization.",
      "api": "POST /checkout {cart_version, request_key}; GET /orders/{id}; POST /orders/{id}/cancel. Store a price and tax snapshot for the accepted order.",
      "data": "order and line items; inventory reservation; payment intent; durable workflow state; outbox. Each domain owns its state and idempotency boundary.",
      "flow": [
        "Validate cart and price → create pending order",
        "Reserve inventory → request payment",
        "Confirm order → enqueue fulfillment",
        "Failure → release reservation or refund with explicit compensation"
      ],
      "decision": "A modular service with local transactions may be sufficient initially. If domains are separated, model a saga instead of pretending database and payment calls share a transaction.",
      "failure": "An unknown payment response leaves the order pending reconciliation. Expired inventory and late success require a business policy. Fulfillment must not ship twice after event replay.",
      "followup": [
        "What if prices change during checkout?",
        "How do you handle partial fulfillment?",
        "Which steps can be compensated after shipment?"
      ],
      "patterns": [
        "saga",
        "outbox",
        "idempotency",
        "conditional-write"
      ]
    },
    {
      "id": "webhooks",
      "title": "Webhook delivery service",
      "level": "Intermediate",
      "requirements": "Deliver signed events to customer endpoints with retries and visible history. Define per-endpoint ordering and retention. Customers must be able to detect duplicate delivery.",
      "scale": "100M deliveries/day is about 1,157/s average. Slow endpoints can consume all connection slots unless tenant and destination concurrency are bounded.",
      "api": "POST /subscriptions; GET /deliveries/{id}; POST /deliveries/{id}/replay. Each delivery includes event ID, timestamp and signature.",
      "data": "subscription(tenant, destination, secret_version); event; delivery(subscription_id, event_id UNIQUE, attempt, next_due, state).",
      "flow": [
        "Durable event → per-subscription delivery tasks",
        "Scheduler → isolated sender pool",
        "Signed HTTP request → classify response",
        "Record result → backoff or dead-letter after policy limit"
      ],
      "decision": "Strict endpoint order can block later events behind one poison event; document whether ordering is best effort, per key or strict. Replays preserve event identity but get distinct attempt records.",
      "failure": "An HTTP timeout can follow successful processing; receivers need idempotency. Validate destinations against SSRF, re-check resolved addresses and rotate signing secrets with overlap.",
      "followup": [
        "How do you stop one slow customer blocking others?",
        "How do retries interact with ordering?",
        "How do you prevent replay attacks?"
      ],
      "patterns": [
        "queue",
        "retry-budget",
        "idempotency",
        "circuit-breaker"
      ]
    },
    {
      "id": "flags",
      "title": "Feature flag platform",
      "level": "Intermediate",
      "requirements": "Manage targeting rules and serve low-latency evaluations. Define consistency for gradual rollout versus emergency shutoff. Evaluation should continue through a control-plane outage using a valid cached configuration.",
      "scale": "100K application instances fetching every minute create about 1,667 fetches/s; pushing only changes reduces repeated bytes but needs connection and recovery handling.",
      "api": "Control API updates versioned flags; SDK evaluates(flag, context) locally; distribution API fetches snapshot or changes after version.",
      "data": "flag rules and versions; environment scopes; audit history; rollout salt; SDK last-applied version and freshness metrics.",
      "flow": [
        "Admin → validate and authorize → publish version",
        "Distribution stream/CDN → SDK snapshots",
        "SDK → deterministic targeting and percentage bucket",
        "Evaluation telemetry → aggregated impact and freshness"
      ],
      "decision": "Stable hashing gives consistent rollout cohorts. Avoid sending sensitive targeting data to clients unnecessarily. Server and browser SDK exposure have different trust boundaries.",
      "failure": "Retain a known-good config on update failure. Emergency revocation needs a maximum staleness policy and monitoring; indefinite offline evaluation cannot promise instant kill switches.",
      "followup": [
        "How do you roll back a bad rule?",
        "How do you keep cohorts stable?",
        "What does an offline SDK do during an emergency shutdown?"
      ],
      "patterns": [
        "control-plane",
        "cdn",
        "strangler"
      ]
    },
    {
      "id": "analytics",
      "title": "Clickstream analytics",
      "level": "Advanced",
      "requirements": "Ingest events, deduplicate, aggregate by event time and support historical queries. Define acceptable lateness and whether counts are approximate or billing-grade.",
      "scale": "1B events/day is about 11.6K/s average. At 500 bytes/event, raw storage is about 500 GB/day; 30 days is 15 TB before compression and replication.",
      "api": "POST /events batch with event_id, event_time, schema_version; GET aggregate query with bounded range and dimensions.",
      "data": "Partitioned raw event log; object-store archive; window state; aggregate tables keyed by dimensions and window; schema registry.",
      "flow": [
        "Client batch → validated ingest → durable log",
        "Stream processor → dedup and event-time windows",
        "Aggregates → query store",
        "Raw archive → replay/backfill and reconciliation"
      ],
      "decision": "Exactly-once aggregation depends on atomic state/checkpoint behavior and deduplication scope. Late corrections and historical recomputation must not double-add old totals.",
      "failure": "Malformed events go to a visible quarantine path. Watermarks need idle-partition handling. Replays use versioned output or overwrite-by-key semantics so recovery does not inflate results.",
      "followup": [
        "How do you handle events arriving a day late?",
        "How do you fix a bad aggregation deployment?",
        "When is approximate distinct counting acceptable?"
      ],
      "patterns": [
        "partitioned-log",
        "windowing",
        "cqrs",
        "idempotency"
      ]
    },
    {
      "id": "leaderboard",
      "title": "Global leaderboard",
      "level": "Intermediate",
      "requirements": "Accept validated score updates and return top-k plus a user’s rank. Define tie-breaking, time windows and whether rank must be exact and immediately fresh.",
      "scale": "10M players with 10 updates/day produce 100M updates/day, about 1,157/s average. Reading top 100 is cheap; exact arbitrary global rank across shards is the difficult operation.",
      "api": "POST /scores {match_id, player_id, score}; GET /leaderboard?season=...; GET /players/{id}/rank.",
      "data": "Authoritative match outcomes with unique IDs; per-player season score; ordered score index with deterministic tie-breaker; historical season snapshots.",
      "flow": [
        "Trusted match result → idempotent score transaction",
        "Event → ordered leaderboard projection",
        "Top-k → cached snapshot",
        "Rank → score index or explicitly approximate partition aggregate"
      ],
      "decision": "A single ordered structure may fit the scale; do not shard prematurely. Sharded top-k can merge local candidates, but exact per-user rank requires more coordination or a specialized index.",
      "failure": "Replay must not add a match twice. Late match results need a season closure policy. Anti-cheat validation happens before authoritative score acceptance, not only in the UI.",
      "followup": [
        "How do you resolve equal scores?",
        "How do you compute exact global rank?",
        "How do you remove a fraudulent result?"
      ],
      "patterns": [
        "idempotency",
        "cqrs",
        "scatter-gather",
        "cache-aside"
      ]
    },
    {
      "id": "logs",
      "title": "Log ingestion and search",
      "level": "Advanced",
      "requirements": "Collect structured logs, retain them affordably and search by tenant, time and selected fields. Define durability, redaction and deletion requirements. Bound query cost.",
      "scale": "100K events/s × 1 KB is 100 MB/s, about 8.64 TB/day raw. Indexing every field can cost far more than raw storage; hot and cold retention tiers matter.",
      "api": "POST /logs in compressed batches; POST /queries for asynchronous expensive searches; GET /queries/{id}/results.",
      "data": "Tenant/time-partitioned immutable objects; selected field indexes; ingestion offsets; schema and redaction policy versions; query job state.",
      "flow": [
        "Agent bounded buffer → ingestion gateway",
        "Durable log → storage/index workers",
        "Hot index → recent queries",
        "Cold objects → bounded distributed scan → results"
      ],
      "decision": "Index frequently filtered fields and scan colder data when latency permits. Separate operational logs from metrics so high-cardinality values do not explode metric series.",
      "failure": "Agents need a clear drop or disk-spool policy when ingestion fails. Redact secrets before durable storage. Tenant filters must apply to both the index and object-store access.",
      "followup": [
        "How do you handle a noisy tenant?",
        "How do you delete sensitive logs across tiers?",
        "How do you query during an index outage?"
      ],
      "patterns": [
        "partitioned-log",
        "scatter-gather",
        "cell",
        "backpressure"
      ]
    },
    {
      "id": "maps",
      "title": "Nearby places and map tiles",
      "level": "Intermediate",
      "requirements": "Serve map tiles and search nearby places. Keep full turn-by-turn routing outside the first design. Specify map freshness, search radius and privacy for location queries.",
      "scale": "10M sessions/day × 50 tile fetches is 500M requests/day; at 30 KB/tile, about 15 TB/day of delivered bytes before cache reuse. Nearby search has a separate compute profile.",
      "api": "GET /tiles/{version}/{z}/{x}/{y}; GET /places?lat=...&lon=...&radius=... with radius and result limits.",
      "data": "Immutable tile objects keyed by version and coordinates; place records with geometry and version; spatial index by hierarchical cells.",
      "flow": [
        "Geodata updates → validated tile generation → immutable objects",
        "Client → CDN tile fetch",
        "Nearby query → intersecting cells → candidate lookup",
        "Exact distance filter → rank and return bounded results"
      ],
      "decision": "Hierarchical cells let dense areas subdivide while sparse areas stay coarse. Geospatial proximity is not road travel time; a river can make a nearby destination far away by road.",
      "failure": "Roll out map versions atomically through manifests to avoid mixed data. Exclude stale or deleted places via versioned updates. Avoid retaining precise user location unnecessarily.",
      "followup": [
        "How do you handle the date line?",
        "Why is straight-line distance insufficient for routing?",
        "How do you invalidate a changed tile?"
      ],
      "patterns": [
        "cdn",
        "range-shards",
        "cqrs"
      ]
    },
    {
      "id": "identifiers",
      "title": "Distributed identifier generator",
      "level": "Foundation",
      "requirements": "Generate unique IDs across many writers with a defined size and ordering property. Clarify whether IDs must be strictly globally increasing, roughly time-sortable, unguessable or simply unique. These are different contracts.",
      "scale": "An illustrative 64-bit layout can reserve one sign bit, 41 timestamp bits, 10 worker bits and 12 sequence bits. At millisecond resolution the timestamp range is about 69.7 years, with 1,024 worker slots and at most 4,096 IDs per worker per millisecond. These are layout limits, not measured throughput.",
      "api": "nextId() locally under a valid worker assignment; allocator API grants worker_id and generation. Optionally expose a batch API when clients cannot safely run a local generator.",
      "data": "Durable worker assignment and fencing generation; last emitted timestamp and sequence per worker; chosen epoch and encoding specification. Consumers must preserve full integer precision, for example by using strings in JSON.",
      "flow": [
        "Allocator → unique worker slot and generation",
        "Local monotonic policy → timestamp and sequence",
        "Sequence exhaustion → wait for next valid tick or fail",
        "Encoded ID → durable application record with uniqueness constraint"
      ],
      "decision": "Time-sortable IDs reduce random index insertion but do not prove real-time global ordering. For opaque public identifiers, a suitably large random ID may be simpler. Strict global sequence allocation requires coordination and changes availability.",
      "failure": "Clock rollback must trigger a documented wait, logical timestamp policy or rejection. Never reuse a worker slot while the previous generator can still emit colliding IDs. Process restarts must preserve enough state or wait out overlap safely.",
      "followup": [
        "What happens if the clock moves backward?",
        "How do you safely reassign a worker slot?",
        "Why might clients corrupt a 64-bit ID stored as a JavaScript number?"
      ],
      "patterns": [
        "leases",
        "conditional-write",
        "control-plane"
      ]
    }
  ]
};
