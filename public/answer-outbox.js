(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoAnswerOutbox=api;
if(root.window&&root.window!==root)root.window.ManjingoAnswerOutbox=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const KEY='manjingo_answer_outbox_v1';
const ITEM_PREFIX='manjingo_answer_outbox_item_v2:';
const VERSION=2;
const BASE_RETRY_MS=5000;
const MAX_RETRY_MS=300000;
function storage(){return root.localStorage||(root.window&&root.window.localStorage)||null}
function nowValue(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:Date.now()}
function answerIdOf(value){return value&&value.answerId!=null?String(value.answerId):''}
function normalizeItem(value){
 const raw=value&&typeof value==='object'?value:{};
 const payload=raw.payload&&typeof raw.payload==='object'?{...raw.payload}:null;
 const answerId=answerIdOf(payload)||String(raw.answerId||'');
 if(!payload||!answerId)return null;
 payload.answerId=answerId;
 return{answerId,uid:raw.uid?String(raw.uid):null,payload,queuedAt:nowValue(raw.queuedAt),attempts:Math.max(0,Number(raw.attempts)||0),nextAttemptAt:Math.max(0,Number(raw.nextAttemptAt)||0),lastError:raw.lastError?String(raw.lastError).slice(0,160):null};
}
function itemKey(answerId){return ITEM_PREFIX+String(answerId||'')}
function journalKeys(s){const keys=[];if(!s||typeof s.length!=='number'||typeof s.key!=='function')return keys;for(let i=0;i<s.length;i++){const key=s.key(i);if(typeof key==='string'&&key.startsWith(ITEM_PREFIX))keys.push(key)}return keys}
function readLegacy(s){try{const raw=JSON.parse(s.getItem(KEY)||'{}'),source=Array.isArray(raw)?raw:Array.isArray(raw.items)?raw.items:[];return source.map(normalizeItem).filter(Boolean)}catch(_){return[]}}
function writeItem(item){const s=storage(),value=normalizeItem(item);if(!s||!value)return false;try{s.setItem(itemKey(value.answerId),JSON.stringify(value));return true}catch(_){return false}}
function removeLegacy(answerId){const s=storage(),id=String(answerId||'');if(!s||!id)return;try{const raw=JSON.parse(s.getItem(KEY)||'null');if(!raw)return;const source=Array.isArray(raw)?raw:Array.isArray(raw.items)?raw.items:[],items=source.map(normalizeItem).filter(item=>item&&item.answerId!==id);if(!items.length)s.removeItem(KEY);else s.setItem(KEY,JSON.stringify({version:1,items}))}catch(_){}}
function read(){
 const s=storage();if(!s)return[];
 const seen=new Set(),items=[];
 for(const key of journalKeys(s)){try{const item=normalizeItem(JSON.parse(s.getItem(key)||'null'));if(!item||seen.has(item.answerId))continue;seen.add(item.answerId);items.push(item)}catch(_){}}
 for(const item of readLegacy(s)){if(seen.has(item.answerId))continue;seen.add(item.answerId);items.push(item);writeItem(item)}
 return items.sort((a,b)=>a.queuedAt-b.queuedAt);
}
function emit(){const target=root.window||root,EventCtor=root.CustomEvent||(root.window&&root.window.CustomEvent);if(target&&typeof target.dispatchEvent==='function'&&typeof EventCtor==='function'){try{target.dispatchEvent(new EventCtor('manjingo:answer-outbox-changed',{detail:{pending:read().length}}))}catch(e){}}}
function enqueue(payload,uid){
 const answerId=answerIdOf(payload);if(!answerId||!payload||typeof payload!=='object')return false;
 const items=read(),existing=items.find(item=>item.answerId===answerId)||null,next={answerId,uid:uid?String(uid):existing&&existing.uid||null,payload:{...payload,answerId},queuedAt:existing?existing.queuedAt:Date.now(),attempts:existing?existing.attempts:0,nextAttemptAt:existing?existing.nextAttemptAt:0,lastError:existing?existing.lastError:null};
 const saved=writeItem(next);if(saved)emit();return saved;
}
function remove(answerId){const id=String(answerId||'');if(!id)return false;const s=storage();if(!s)return false;try{s.removeItem(itemKey(id));removeLegacy(id);emit();return true}catch(_){return false}}
function retryDelay(attempts){const n=Math.max(1,Number(attempts)||1);return Math.min(MAX_RETRY_MS,BASE_RETRY_MS*Math.pow(2,Math.min(6,n-1)))}
function markFailure(answerId,error,at){const id=String(answerId||''),item=read().find(value=>value.answerId===id);if(!item)return false;const attempts=item.attempts+1,when=nowValue(at),next={...item,attempts,nextAttemptAt:when+retryDelay(attempts),lastError:String(error&&error.message||error||'sync failed').slice(0,160)},saved=writeItem(next);if(saved)emit();return saved}
function bindUnowned(uid){const id=String(uid||'');if(!id)return false;const items=read();let changed=false;for(const item of items){if(item.uid)continue;changed=true;writeItem({...item,uid:id})}if(changed)emit();return true}
function list(options){const opts=options||{},uid=opts.uid?String(opts.uid):null,includeUnowned=opts.includeUnowned!==false,dueOnly=!!opts.dueOnly,at=nowValue(opts.now);return read().filter(item=>(!uid||item.uid===uid||(includeUnowned&&!item.uid))&&(!dueOnly||!item.nextAttemptAt||item.nextAttemptAt<=at)).map(item=>({...item,payload:{...item.payload}}))}
function pendingCount(uid){return list(uid?{uid,includeUnowned:true}:{}).length}
function nextDueAt(uid){const items=list(uid?{uid,includeUnowned:true}:{});if(!items.length)return null;return Math.min(...items.map(item=>item.nextAttemptAt||0))}
function clear(){const s=storage();if(!s)return false;try{journalKeys(s).forEach(key=>s.removeItem(key));s.removeItem(KEY);emit();return true}catch(e){return false}}
return{KEY,ITEM_PREFIX,VERSION,BASE_RETRY_MS,MAX_RETRY_MS,enqueue,remove,markFailure,bindUnowned,list,pendingCount,nextDueAt,retryDelay,clear};
});
