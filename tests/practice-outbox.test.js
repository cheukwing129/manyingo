const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function makeStorage(data=new Map()){
  return{
    get length(){return data.size},
    key(index){return Array.from(data.keys())[index]??null},
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value)),
    removeItem:key=>data.delete(key)
  };
}
function loadOutbox(shared){
  const data=shared&&shared.data||new Map();
  const localStorage=shared&&shared.localStorage||makeStorage(data);
  const context={localStorage,Date,Math,JSON,String,Number,Array,Object,Set,Map,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail},dispatchEvent(){},window:null,module:{exports:{}},exports:{}};
  context.window=context;
  vm.runInNewContext(read('public/practice-outbox.js'),context,{filename:'practice-outbox.js'});
  return{api:context.module.exports,localStorage,data};
}

test('practice outbox persists one copy per practiceId and preserves the latest durable payload',()=>{
  const{api}=loadOutbox();
  const first={practiceId:'practice_12345678',skillId:'fw.zhi',kpId:'kp_virtual_zhi',routeKpId:'kp_virtual_zhi',correctCount:1};
  assert.equal(api.enqueue(first,'user-a'),true);
  assert.equal(api.enqueue({...first,correctCount:2},'user-a'),true);
  const items=api.list({uid:'user-a'});
  assert.equal(items.length,1);
  assert.equal(items[0].practiceId,'practice_12345678');
  assert.equal(items[0].payload.correctCount,2);
  assert.equal(api.pendingCount('user-a'),1);
  assert.equal(api.remove('practice_12345678'),true);
  assert.equal(api.pendingCount('user-a'),0);
});

test('practice outbox applies bounded exponential backoff and exposes only due work',()=>{
  const{api}=loadOutbox(),now=1700000000000;
  api.enqueue({practiceId:'practice_abcdefgh',skillId:'fw.zhi',kpId:'kp'},'user-a');
  api.markFailure('practice_abcdefgh',new Error('offline'),now);
  let item=api.list({uid:'user-a'})[0];
  assert.equal(item.attempts,1);
  assert.equal(item.nextAttemptAt,now+5000);
  assert.equal(api.list({uid:'user-a',dueOnly:true,now:now+4999}).length,0);
  assert.equal(api.list({uid:'user-a',dueOnly:true,now:now+5000}).length,1);
  for(let i=0;i<10;i++)api.markFailure('practice_abcdefgh',new Error('offline'),now);
  item=api.list({uid:'user-a'})[0];
  assert.ok(item.nextAttemptAt-now<=api.MAX_RETRY_MS);
  assert.equal(api.retryDelay(99),api.MAX_RETRY_MS);
});

test('unowned offline practice binds once and cannot cross into a different account',()=>{
  const{api}=loadOutbox();
  api.enqueue({practiceId:'practice_offline01',skillId:'fw.zhi',kpId:'kp'},null);
  assert.equal(api.bindUnowned('user-a'),true);
  assert.equal(api.list({uid:'user-a',includeUnowned:false}).length,1);
  assert.equal(api.list({uid:'user-b',includeUnowned:false}).length,0);
  api.bindUnowned('user-b');
  assert.equal(api.list({uid:'user-b',includeUnowned:false}).length,0);
});

test('multi-tab practice journals survive a stale shared-list overwrite',()=>{
  const data=new Map(),localStorage=makeStorage(data),shared={data,localStorage};
  const tabA=loadOutbox(shared).api,tabB=loadOutbox(shared).api;
  assert.equal(tabA.enqueue({practiceId:'practice_multitabA1',skillId:'fw.zhi',kpId:'kp_one'},'user-a'),true);
  assert.equal(tabB.enqueue({practiceId:'practice_multitabB1',skillId:'fw.zhi',kpId:'kp_two'},'user-a'),true);
  assert.ok(data.has(tabA.ITEM_PREFIX+'practice_multitabA1'));
  assert.ok(data.has(tabB.ITEM_PREFIX+'practice_multitabB1'));
  data.set(tabA.KEY,JSON.stringify({version:1,items:[{practiceId:'practice_multitabB1',uid:'user-a',payload:{practiceId:'practice_multitabB1',skillId:'fw.zhi',kpId:'kp_two'},queuedAt:new Date().toISOString()}]}));
  assert.deepEqual(Array.from(tabA.list({uid:'user-a'}),item=>item.practiceId).sort(),['practice_multitabA1','practice_multitabB1']);
});

test('practice API queues before network submit and retries on reconnect visibility and startup',()=>{
  const source=read('public/practice-api.js');
  assert.match(source,/import '\.\/practice-outbox\.js'/);
  const start=source.indexOf('export async function submitPracticeSession');
  const enqueue=source.indexOf('box.enqueue(payload,getCurrentUserId())',start);
  const send=source.indexOf('sendOnce(payload)',start);
  assert.ok(enqueue>start&&send>enqueue,'practice session must be durable before the first network attempt');
  assert.match(source,/box\.bindUnowned\(uid\)/);
  assert.match(source,/box\.markFailure\(item\.practiceId,error\)/);
  assert.match(source,/error\.queued=!!\(queued&&canRetry\)/);
  assert.match(source,/window\.addEventListener\('online',\(\)=>void flushPracticeOutbox\(\{force:true\}\)\)/);
  assert.match(source,/visibilityState==='visible'/);
  assert.match(source,/setTimeout\(\(\)=>void flushPracticeOutbox\(\{force:true\}\),0\)/);
  assert.match(source,/manjingo:practice-sync-complete/);
});

test('account sync flushes durable practice before restoring snapshot practice state',()=>{
  const source=read('public/account-sync.js');
  const flush=source.indexOf("practice.flushPracticeOutbox({force:true,uid})");
  const snapshot=source.indexOf('remotePractice=accountState&&accountState.practiceState||null');
  const fetch=source.indexOf('remotePractice=await practice.fetchPracticeState()');
  assert.ok(flush>0&&snapshot>flush,'pending practice must reach the server before authoritative state is restored');
  assert.ok(fetch>snapshot,'the separate practice endpoint must only remain as a snapshot fallback');
  assert.match(source,/manjingo:practice-sync-complete/);
  assert.match(source,/applyPracticeResult\(detail\.payload,detail\.result\)/);
});

test('background practice reconciliation merges server session and intervention state into local learning state',()=>{
  const sync=require('../public/account-sync.js');
  const store=new Map();
  global.localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  try{
    store.set(sync.LEARNING_KEY,JSON.stringify({practiceHistory:[],interventionState:{}}));
    const entry={practiceId:'practice_merge01',skillId:'fw.zhi',kpId:'kp_virtual_zhi',routeKpId:'kp_virtual_zhi',completedAt:'2026-09-12T07:00:00Z'};
    const result={success:true,practiceSession:entry,interventionState:{skillId:'fw.zhi',key:'remedial',updatedAt:'2026-09-12T07:01:00Z',source:'server-native-v1'}};
    sync.applyPracticeResult(entry,result);
    const state=JSON.parse(store.get(sync.LEARNING_KEY));
    assert.equal(state.practiceHistory.length,1);
    assert.equal(state.practiceHistory[0].practiceId,'practice_merge01');
    assert.equal(state.interventionState['fw.zhi'].key,'remedial');
  }finally{delete global.localStorage}
});

test('server practiceId idempotency remains the retry-after-commit safety boundary',()=>{
  const worker=read('public/_worker.js');
  assert.match(worker,/practiceSessions\/\$\{session\.practiceId\}/);
  assert.match(worker,/duplicate: true/);
});
