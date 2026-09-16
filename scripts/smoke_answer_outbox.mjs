import vm from 'node:vm';

const base=(process.env.MANJINGO_BASE_URL||'https://manjingo.pages.dev').replace(/\/$/,'');
async function read(path){const response=await fetch(base+path,{headers:{'cache-control':'no-cache'}});if(!response.ok)throw new Error(`${path} HTTP ${response.status}`);return response.text();}
function expect(value,message){if(!value)throw new Error(message)}

const [outboxSource,firebaseSource]=await Promise.all([read('/answer-outbox.js'),read('/firebase-config.js')]);
expect(outboxSource.includes("manjingo_answer_outbox_v1"),'deployed answer outbox asset missing');
expect(outboxSource.includes("manjingo_answer_outbox_item_v2:"),'deployed answer outbox is missing multi-tab journal storage');
expect(firebaseSource.includes("import './answer-outbox.js'"),'firebase client does not load answer outbox');
expect(firebaseSource.includes("box.enqueue(payload,currentUserId)"),'firebase client does not persist before submit');
expect(firebaseSource.includes("window.addEventListener('online',()=>void flushAnswerOutbox({force:true}))"),'firebase client does not retry on reconnect');
expect(firebaseSource.includes("document.visibilityState==='visible'"),'firebase client does not retry when app returns to foreground');
expect(firebaseSource.includes("learning.syncRemoteResult(payload.kpId,result)"),'retried answer does not reconcile authoritative progress');

const memory=new Map();
const localStorage={get length(){return memory.size},key:index=>Array.from(memory.keys())[index]??null,getItem:key=>memory.has(key)?memory.get(key):null,setItem:(key,value)=>memory.set(key,String(value)),removeItem:key=>memory.delete(key)};
const context={localStorage,Date,Math,JSON,String,Number,Array,Object,Set,Map,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail},dispatchEvent(){},window:null,module:{exports:{}},exports:{}};
context.window=context;
vm.createContext(context);
vm.runInContext(outboxSource,context,{filename:'production-answer-outbox.js'});
const outbox=context.module.exports;
const payload={answerId:'smoke_outbox_12345678',questionId:'q001',kpId:'kp_yueyang_001',isCorrect:true,attemptCount:1,usedHint:false,responseTimeMs:0,localDate:'2026-09-11'};
expect(outbox.enqueue(payload,null),'production outbox could not persist an answer');
expect(memory.has(outbox.ITEM_PREFIX+payload.answerId),'production outbox did not create a per-answer journal');
expect(outbox.pendingCount()===1,'production outbox pending count is wrong');
outbox.markFailure(payload.answerId,new Error('offline'),1700000000000);
let item=outbox.list()[0];
expect(item.attempts===1,'production outbox did not record retry attempt');
expect(item.nextAttemptAt===1700000005000,'production outbox retry backoff is not conservative');
outbox.bindUnowned('smoke-user-a');
expect(outbox.list({uid:'smoke-user-a',includeUnowned:false}).length===1,'production outbox did not bind offline answer to authenticated user');
expect(outbox.list({uid:'smoke-user-b',includeUnowned:false}).length===0,'production outbox crossed account boundary');
expect(outbox.remove(payload.answerId),'production outbox could not remove acknowledged answer');
expect(outbox.pendingCount()===0,'production outbox retained acknowledged answer');

console.log('✓ deployed answer outbox journals failed answers, retries safely, and preserves account boundaries');
