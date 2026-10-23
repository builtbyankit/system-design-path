/* Self-contained educational labs. Node.js >=22.13. No npm dependencies. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {fork,spawnSync}=require('node:child_process');
const {performance}=require('node:perf_hooks');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function database(file){const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=15000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');return db;}
function temporary(){return fs.mkdtempSync(path.join(os.tmpdir(),'system-design-lab-'));}
function cleanup(dir){const resolved=path.resolve(dir);assert.equal(path.dirname(resolved),path.resolve(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('system-design-lab-'));for(const file of fs.readdirSync(resolved)){const target=path.join(resolved,file);assert.ok(fs.lstatSync(target).isFile(),'Unexpected non-file in owned lab directory');fs.unlinkSync(target);}fs.rmdirSync(resolved);}
function reserve(db,key){
 db.exec('BEGIN IMMEDIATE');
 try{
  const previous=db.prepare('SELECT id FROM reservations WHERE request_key=?').get(key);
  if(previous){db.exec('COMMIT');return previous.id;}
  const changed=db.prepare('UPDATE inventory SET available=available-1 WHERE sku=1 AND available>0').run();
  if(changed.changes!==1){db.exec('ROLLBACK');return null;}
  const result=db.prepare('INSERT INTO reservations(request_key) VALUES (?)').run(key);
  db.exec('COMMIT');return Number(result.lastInsertRowid);
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}
}
// Child-process entry points deliberately bypass the normal command dispatcher.
if(process.argv[2]==='--reservation-worker'){
 const [file,key,mode]=process.argv.slice(3),db=database(file);
 const observed=mode==='broken'?db.prepare('SELECT available FROM inventory WHERE sku=1').get().available:null;
 process.on('message',()=>{try{let result;if(mode==='broken'){
   if(observed>0){db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE inventory SET available=? WHERE sku=1').run(observed-1);const r=db.prepare('INSERT INTO reservations(request_key) VALUES (?)').run(key);db.exec('COMMIT');result=Number(r.lastInsertRowid);}else result=null;
  }else result=reserve(db,key);
  db.close();process.send({result},()=>process.exit(0));
 }catch(e){console.error(e.message);db.close();process.exit(1);}});
 process.send({ready:true});
}else if(process.argv[2]==='--outbox-worker'){
 const [source,sink,crash]=process.argv.slice(3),db=database(source),target=database(sink);
 const event=db.prepare('SELECT id,amount FROM outbox WHERE sent=0 ORDER BY id LIMIT 1').get();
 if(event){target.exec('BEGIN IMMEDIATE');const first=target.prepare('INSERT OR IGNORE INTO inbox(event_id) VALUES (?)').run(event.id);if(first.changes)target.prepare('UPDATE total SET amount=amount+? WHERE id=1').run(event.amount);target.exec('COMMIT');
  if(crash==='crash')process.exit(17); // Real process exit after durable effect, before source acknowledgment.
  db.prepare('UPDATE outbox SET sent=1 WHERE id=?').run(event.id);
 }
 target.close();db.close();
}else{
 const labs={reservation, outbox, cache, overload};
 async function main(){const name=process.argv[2]||'all';if(name!=='all'&&!labs[name])throw Error('Use: node run.cjs [all|reservation|outbox|cache|overload]');const results=[];for(const [id,run]of Object.entries(labs)){if(name==='all'||name===id){const result=await run();results.push({lab:id,...result});console.log(JSON.stringify(results.at(-1),null,2));}}console.log(`PASS: ${results.length} lab(s). Results describe this local experiment, not a production throughput guarantee.`);}
 main().catch(e=>{console.error(e);process.exitCode=1;});
}
async function contenders(file,mode,count){
 const children=[];let released=false;let ready=0;
 try{return await Promise.all(Array.from({length:count},(_,i)=>new Promise((resolve,reject)=>{
  const child=fork(__filename,['--reservation-worker',file,'request-'+i,mode],{silent:true});children.push(child);let result,stderr='';
  child.stderr.on('data',b=>stderr+=b.toString());const timeout=setTimeout(()=>{child.kill();reject(Error('Worker timeout'));},30000);
  child.on('error',reject);child.on('message',m=>{if(m.ready){ready++;if(ready===count&&!released){released=true;children.forEach(c=>c.send({go:true}));}}else result=m.result;});
  child.on('exit',code=>{clearTimeout(timeout);code===0?resolve(result):reject(Error(`Worker ${code}: ${stderr}`));});
 })));}finally{for(const child of children)if(child.exitCode===null)child.kill();}
}
async function reservation(){const dir=temporary();try{
 const output={contenders:12};
 for(const mode of ['broken','correct']){const file=path.join(dir,mode+'.sqlite'),db=database(file);db.exec('CREATE TABLE inventory(sku INTEGER PRIMARY KEY,available INTEGER NOT NULL); INSERT INTO inventory VALUES(1,1); CREATE TABLE reservations(id INTEGER PRIMARY KEY,request_key TEXT UNIQUE);');db.close();
  const results=await contenders(file,mode,12),check=database(file);const sold=check.prepare('SELECT count(*) AS n FROM reservations').get().n;
  if(mode==='broken'){assert.equal(sold,12,'The barrier should reproduce lost-update overselling');output.brokenSold=sold;}else{
   assert.equal(sold,1);assert.equal(check.prepare('SELECT available FROM inventory').get().available,0);
   const winner=results.findIndex(x=>x!==null);assert.equal(reserve(check,'request-'+winner),results[winner]);assert.equal(check.prepare('SELECT count(*) AS n FROM reservations').get().n,1);output.correctSold=sold;output.retryReturnedSameReservation=true;
  }check.close();
 }
 return output;
 }finally{cleanup(dir);}}
async function outbox(){const dir=temporary();try{
 const source=path.join(dir,'source.sqlite'),sink=path.join(dir,'sink.sqlite');let db=database(source);db.exec('CREATE TABLE orders(id INTEGER PRIMARY KEY,amount INTEGER); CREATE TABLE outbox(id INTEGER PRIMARY KEY,amount INTEGER,sent INTEGER DEFAULT 0); BEGIN IMMEDIATE; INSERT INTO orders VALUES(1,25); INSERT INTO outbox(id,amount) VALUES(1,25); COMMIT;');db.close();
 db=database(sink);db.exec('CREATE TABLE inbox(event_id INTEGER PRIMARY KEY); CREATE TABLE total(id INTEGER PRIMARY KEY,amount INTEGER); INSERT INTO total VALUES(1,0);');db.close();
 const crashed=spawnSync(process.execPath,[__filename,'--outbox-worker',source,sink,'crash'],{encoding:'utf8',timeout:15000});assert.equal(crashed.status,17,crashed.stderr);
 db=database(source);assert.equal(db.prepare('SELECT sent FROM outbox').get().sent,0);db.close();
 const replay=spawnSync(process.execPath,[__filename,'--outbox-worker',source,sink,'ok'],{encoding:'utf8',timeout:15000});assert.equal(replay.status,0,replay.stderr);
 db=database(sink);const amount=db.prepare('SELECT amount FROM total').get().amount,events=db.prepare('SELECT count(*) AS n FROM inbox').get().n;assert.equal(amount,25);assert.equal(events,1);db.close();
 db=database(source);assert.equal(db.prepare('SELECT sent FROM outbox').get().sent,1);db.close();
 return {crashExitCode:17,deliveriesAttempted:2,uniqueEffects:events,total:amount,sourceAcknowledged:true};
 }finally{cleanup(dir);}}
class LRU{
 constructor(capacity){assert.ok(Number.isInteger(capacity)&&capacity>=0);this.capacity=capacity;this.values=new Map();}
 get(key){if(!this.values.has(key))return undefined;const value=this.values.get(key);this.values.delete(key);this.values.set(key,value);return value;}
 put(key,value){if(this.capacity===0)return;this.values.delete(key);this.values.set(key,value);if(this.values.size>this.capacity)this.values.delete(this.values.keys().next().value);}
}
function coalescer(){const inFlight=new Map();return async function get(key,load){if(inFlight.has(key))return inFlight.get(key);const p=Promise.resolve().then(load);inFlight.set(key,p);try{return await p;}finally{if(inFlight.get(key)===p)inFlight.delete(key);}};}
async function cache(){
 const lru=new LRU(2);lru.put('a',1);lru.put('b',2);assert.equal(lru.get('a'),1);lru.put('c',3);assert.equal(lru.get('b'),undefined);lru.put('a',4);assert.equal(lru.get('a'),4);const zero=new LRU(0);zero.put('a',1);assert.equal(zero.get('a'),undefined);
 let baseline=0;await Promise.all(Array.from({length:100},async()=>{baseline++;await delay(5);return 7;}));
 let loads=0;const get=coalescer(),result=await Promise.all(Array.from({length:100},()=>get('hot',async()=>{loads++;await delay(5);return 7;})));assert.equal(loads,1);assert.ok(result.every(x=>x===7));
 let attempts=0;await assert.rejects(get('failure',async()=>{attempts++;throw Error('origin unavailable');}));assert.equal(await get('failure',async()=>{attempts++;return 9;}),9);assert.equal(attempts,2);
 return {concurrentClients:100,uncoalescedOriginLoads:baseline,coalescedOriginLoads:loads,lruChecks:'passed',failureCanRetry:true};
}
async function workload(limit){
 const concurrency=4,serviceMs=8,total=120,queue=[],latencies=[];let active=0,rejected=0,maxQueued=0,completed=0;const start=performance.now();
 return await new Promise(resolve=>{function pump(){while(active<concurrency&&queue.length){const arrival=queue.shift();active++;setTimeout(()=>{latencies.push(performance.now()-arrival);completed++;active--;pump();if(completed+rejected===total){latencies.sort((a,b)=>a-b);resolve({offered:total,completed,rejected,maxQueued,p50Ms:+latencies[Math.floor((latencies.length-1)*.5)].toFixed(2),p99Ms:+latencies[Math.ceil((latencies.length-1)*.99)].toFixed(2),elapsedMs:+(performance.now()-start).toFixed(2)});}},serviceMs);}}
  // The same instantaneous open-loop burst is offered to both configurations.
  for(let i=0;i<total;i++){if(active>=concurrency&&queue.length>=limit)rejected++;else{queue.push(performance.now());maxQueued=Math.max(maxQueued,queue.length);pump();}}
 });
}
async function overload(){const unbounded=await workload(Infinity),bounded=await workload(8);assert.equal(unbounded.completed,120);assert.equal(unbounded.rejected,0);assert.equal(bounded.completed,12);assert.equal(bounded.rejected,108);assert.ok(bounded.maxQueued<=8);return {workers:4,serviceDelayMs:8,burst:120,unbounded,bounded,interpretation:'Latency is measured for admitted work. Compare rejection rate too; timing varies by host.'};}
