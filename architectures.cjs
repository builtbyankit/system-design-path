module.exports=course=>{
 const diagrams={
 payments:[['Client','Intent API','Intent + ledger DB','Provider','Recovery worker','Outbox / consumers'],[[0,1,'stable request key'],[1,2,'local transaction'],[1,3,'same provider key'],[3,4,'callback / query'],[4,2,'guarded result'],[2,5,'committed event']]],
 chat:[['Sender','Gateway','Conversation owner','Message log','Recipient gateways','History API'],[[0,1,'message ID'],[1,2,'route by conversation'],[2,3,'durable append'],[3,4,'delivery events'],[3,5,'replay by sequence']]],
 feed:[['Author','Post API','Post store + outbox','Fanout workers','Inbox projection','Feed reader'],[[0,1,'publish'],[1,2,'atomic commit'],[2,3,'event'],[3,4,'ordinary followers'],[4,5,'feed pointers'],[2,5,'hydrate + visibility']]],
 files:[['Device','Metadata API','Metadata / versions','Object storage','Change log','Other devices'],[[0,1,'begin / finalize'],[1,2,'conditional publish'],[0,3,'scoped chunk upload'],[2,4,'version event'],[4,5,'cursor replay'],[5,3,'fetch missing chunks']]],
 kv:[['Client','Partition router','Leader','Follower B','Follower C','Snapshot / backup'],[[0,1,'key + request ID'],[1,2,'owner epoch'],[2,3,'replicate log'],[2,4,'replicate log'],[2,5,'consistent recovery point']]],
 tickets:[['Buyer','Admission + API','Seat / hold DB','Payment provider','Reconciler','Ticket delivery'],[[0,1,'hold request'],[1,2,'conditional ownership'],[1,3,'payment intent'],[3,4,'verified outcome'],[4,2,'confirm or compensate'],[2,5,'outbox event']]],
 recommendations:[['Request','Candidate retrieval','Online features','Ranker','Eligibility filter','Exposure log'],[[0,1,'context'],[1,3,'candidate set'],[2,3,'versioned features'],[3,4,'ranked candidates'],[4,5,'visible results + version']]],
 'distributed-sql':[['SQL client','Gateway / planner','Txn coordinator','Shard A quorum','Shard B quorum','Snapshot store'],[[0,1,'transaction'],[1,2,'participant plan'],[2,3,'prepare / decision'],[2,4,'prepare / decision'],[3,5,'versioned backup'],[4,5,'versioned backup']]],
 ads:[['Auction request','Eligibility + bids','Regional budget','Auction result','Billing events','Ledger / reconciliation'],[[0,1,'bounded context'],[1,2,'reserve rights'],[2,3,'winning allocation'],[3,4,'impression identity'],[4,5,'dedup + accounting']]],
 batch:[['Job submission','Durable coordinator','Task workers','Shuffle blocks','Reduce attempts','Output manifest'],[[0,1,'DAG + input version'],[1,2,'leased attempt'],[2,3,'partition output'],[3,4,'grouped input'],[4,5,'conditional publish']]],
 parking:[['Entry / exit gate','ParkingService','Spot repository','AllocationPolicy','PricingPolicy','PaymentGateway'],[[0,1,'idempotent command'],[1,2,'transactional claim'],[1,3,'candidate selection'],[1,4,'pure quote'],[1,5,'payment intent']]]
 };
 for(const [id,[nodes,edges]]of Object.entries(diagrams))course.designs.find(d=>d.id===id).architecture={nodes,edges};
};
