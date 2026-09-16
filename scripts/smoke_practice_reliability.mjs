import vm from 'node:vm';

const baseUrl=String(process.env.MANJINGO_BASE_URL||'https://manjingo.pages.dev').replace(/\/$/,'');
function check(value,message){if(!value)throw new Error(message)}
async function read(path,label){const response=await fetch(`${baseUrl}${path}`,{headers:{accept:'text/javascript,*/*;q=0.8'}});if(!response.ok)throw new Error(`${label} unavailable (${response.status})`);const text=await response.text();check(text.length>100,`${label} returned an unexpectedly small payload`);return text}

console.log(`Smoke testing deployed practice reliability at ${baseUrl}`);
const [outboxSource,practiceApiSource,dailyRuntimeSource]=await Promise.all([
  read('/practice-outbox.js','practice outbox'),
  read('/practice-api.js','practice API'),
  read('/daily-plan-runtime.js','daily plan runtime')
]);
check(outboxSource.includes('manjingo_practice_outbox_item_v2:'),'deployed practice outbox is missing multi-tab journal storage');

const storageData=new Map();
const localStorage={get length(){return storageData.size},key:index=>Array.from(storageData.keys())[index]??null,getItem:key=>storageData.has(key)?storageData.get(key):null,setItem:(key,value)=>storageData.set(key,String(value)),removeItem:key=>storageData.delete(key)};
const outboxContext={localStorage,Date,Math,JSON,String,Number,Array,Object,Set,Map,CustomEvent:function(type,init){this.type=type;this.detail=init&&init.detail},dispatchEvent(){},window:null,module:{exports:{}},exports:{}};
outboxContext.window=outboxContext;
vm.createContext(outboxContext);
vm.runInContext(outboxSource,outboxContext,{filename:'production/practice-outbox.js'});
const outbox=outboxContext.module.exports;
check(outbox&&typeof outbox.enqueue==='function'&&typeof outbox.markFailure==='function'&&typeof outbox.bindUnowned==='function','deployed practice outbox API is missing');
const payload={practiceId:'practice_smoke_offline_01',skillId:'fw.zhi',kpId:'kp_virtual_zhi',routeKpId:'kp_virtual_zhi',completedAt:'2026-09-12T00:00:00.000Z'};
check(outbox.enqueue(payload,null)===true,'deployed practice outbox could not persist an offline session');
check(storageData.has(outbox.ITEM_PREFIX+payload.practiceId),'deployed practice outbox did not create a per-session journal');
outbox.markFailure(payload.practiceId,new Error('offline'),1700000000000);
check(outbox.list({dueOnly:true,now:1700000004999}).length===0,'deployed practice outbox ignored retry backoff');
check(outbox.list({dueOnly:true,now:1700000005000}).length===1,'deployed practice outbox did not release due retry work');
check(outbox.bindUnowned('smoke-user-a')===true,'deployed practice outbox could not bind offline work to an account');
check(outbox.list({uid:'smoke-user-a',includeUnowned:false}).length===1,'deployed practice outbox lost bound work');
check(outbox.list({uid:'smoke-user-b',includeUnowned:false}).length===0,'deployed practice outbox crossed account boundary');
check(practiceApiSource.includes("import './practice-outbox.js'"),'deployed practice API does not load durable practice outbox');
check(practiceApiSource.includes("box.enqueue(payload,getCurrentUserId())"),'deployed practice API does not queue before network submit');
check(practiceApiSource.includes("window.addEventListener('online',()=>void flushPracticeOutbox({force:true}))"),'deployed practice API does not retry on reconnect');
check(practiceApiSource.includes("visibilityState==='visible'"),'deployed practice API does not retry when the app becomes visible');
check(practiceApiSource.includes('manjingo:practice-sync-complete'),'deployed practice API does not publish background reconciliation');
console.log('✓ deployed practice outbox journals pending sessions, backs off, retries, and isolates accounts');

const dailyContext={window:{}};
vm.createContext(dailyContext);
vm.runInContext(dailyRuntimeSource,dailyContext,{filename:'production/daily-plan-runtime.js'});
const daily=dailyContext.window.ManjingoDailyPlanRuntime;
check(daily&&typeof daily.sessionReservation==='function'&&typeof daily.balanceChoiceQuestions==='function','deployed daily runtime API is missing');
const queue=Array.from({length:10},(_,i)=>({id:`q${i+1}`,category:'new'}));
const completed=queue.slice(0,9).map(q=>q.id),reservation=daily.sessionReservation(queue,9,completed,10),merged=daily.mergeReservation(reservation,[{id:'q11'},{id:'q12'}]);
check(reservation.remainingSlots===0,'deployed daily runtime does not calculate zero slots after the tenth pending question');
check(merged.questions.length===10&&merged.tail.length===0&&!merged.questions.some(q=>q.id==='q11'||q.id==='q12'),'deployed daily runtime can still append an eleventh question');
const allA=Array.from({length:10},(_,i)=>({id:`answer${i}`,type:'choice',o:['right','b','c','d'],a:'right'})),balanced=daily.balanceChoiceQuestions(allA,'production-smoke'),counts=[0,0,0,0];
for(const q of balanced){const slot=q.o.indexOf('right');check(slot>=0,'deployed answer balancing changed the correct answer');counts[slot]+=1;}
check(Math.max(...counts)-Math.min(...counts)<=1,`deployed correct-answer positions are imbalanced: ${counts.join('/')}`);
console.log(`✓ deployed daily cap holds at 10 and answer slots are balanced ${counts.join('/')}`);
