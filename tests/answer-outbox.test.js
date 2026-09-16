const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','public','answer-outbox.js'),'utf8'),context,{filename:'answer-outbox.js'});
  return{api:context.module.exports,localStorage,data};
}

test('answer outbox persists one copy per answerId and preserves original payload for retry',()=>{
  const{api}=loadOutbox();
  const first={answerId:'answer_12345678',kpId:'kp_one',questionId:'q1',isCorrect:true};
  assert.equal(api.enqueue(first,'user-a'),true);
  assert.equal(api.enqueue({...first,isCorrect:false},'user-a'),true);
  const items=api.list({uid:'user-a'});
  assert.equal(items.length,1);
  assert.equal(items[0].answerId,'answer_12345678');
  assert.equal(items[0].payload.answerId,'answer_12345678');
  assert.equal(items[0].payload.isCorrect,false);
  assert.equal(api.pendingCount('user-a'),1);
  assert.equal(api.remove('answer_12345678'),true);
  assert.equal(api.pendingCount('user-a'),0);
});

test('answer outbox applies bounded exponential backoff and only returns due work',()=>{
  const{api}=loadOutbox();
  const now=1700000000000;
  api.enqueue({answerId:'answer_abcdefgh',kpId:'kp_one'},'user-a');
  api.markFailure('answer_abcdefgh',new Error('offline'),now);
  let item=api.list({uid:'user-a'})[0];
  assert.equal(item.attempts,1);
  assert.equal(item.nextAttemptAt,now+5000);
  assert.equal(api.list({uid:'user-a',dueOnly:true,now:now+4999}).length,0);
  assert.equal(api.list({uid:'user-a',dueOnly:true,now:now+5000}).length,1);
  for(let i=0;i<10;i++)api.markFailure('answer_abcdefgh',new Error('offline'),now);
  item=api.list({uid:'user-a'})[0];
  assert.ok(item.nextAttemptAt-now<=api.MAX_RETRY_MS);
  assert.equal(api.retryDelay(99),api.MAX_RETRY_MS);
});

test('unowned offline answers bind once and never cross into a different signed-in account',()=>{
  const{api}=loadOutbox();
  api.enqueue({answerId:'answer_offline01',kpId:'kp_one'},null);
  assert.equal(api.bindUnowned('user-a'),true);
  assert.equal(api.list({uid:'user-a',includeUnowned:false}).length,1);
  assert.equal(api.list({uid:'user-b',includeUnowned:false}).length,0);
  api.bindUnowned('user-b');
  assert.equal(api.list({uid:'user-b',includeUnowned:false}).length,0);
});

test('multi-tab answer journals survive a stale shared-list overwrite',()=>{
  const data=new Map(),localStorage=makeStorage(data),shared={data,localStorage};
  const tabA=loadOutbox(shared).api,tabB=loadOutbox(shared).api;
  assert.equal(tabA.enqueue({answerId:'answer_multitabA1',kpId:'kp_one'},'user-a'),true);
  assert.equal(tabB.enqueue({answerId:'answer_multitabB1',kpId:'kp_two'},'user-a'),true);
  assert.ok(data.has(tabA.ITEM_PREFIX+'answer_multitabA1'));
  assert.ok(data.has(tabB.ITEM_PREFIX+'answer_multitabB1'));
  data.set(tabA.KEY,JSON.stringify({version:1,items:[{answerId:'answer_multitabB1',uid:'user-a',payload:{answerId:'answer_multitabB1',kpId:'kp_two'},queuedAt:Date.now()}]}));
  assert.deepEqual(Array.from(tabA.list({uid:'user-a'}),item=>item.answerId).sort(),['answer_multitabA1','answer_multitabB1']);
});

test('firebase client queues before submit, retries on reconnect, and reconciles successful background results',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','public','firebase-config.js'),'utf8');
  assert.match(source,/import '\.\/answer-outbox\.js'/);
  const submitStart=source.indexOf('export async function submitAnswer');
  const enqueue=source.indexOf('box.enqueue(payload,currentUserId)',submitStart);
  const send=source.indexOf('sendAnswerOnce(payload)',submitStart);
  assert.ok(enqueue>submitStart&&send>enqueue,'answer must be durable before the first network attempt');
  assert.match(source,/window\.addEventListener\('online',\(\)=>void flushAnswerOutbox\(\{force:true\}\)\)/);
  assert.match(source,/visibilityState==='visible'/);
  assert.match(source,/setTimeout\(\(\)=>void flushAnswerOutbox\(\{force:true\}\),0\)/);
  assert.match(source,/box\.bindUnowned\(uid\)/);
  assert.match(source,/box\.markFailure\(item\.answerId,error\)/);
  assert.match(source,/learning\.syncRemoteResult\(payload\.kpId,result\)/);
  assert.match(source,/error\.queued=!!\(queued&&retryable\)/);
});

test('server answerId idempotency makes retry-after-commit safe',()=>{
  const worker=fs.readFileSync(path.join(__dirname,'..','public','_worker.js'),'utf8');
  assert.match(worker,/answerLogs\/\$\{answer\.answerId\}/);
  assert.match(worker,/if \(logDoc\)/);
  assert.match(worker,/duplicate: true/);
});
