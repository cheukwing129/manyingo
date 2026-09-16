(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoPracticeOutbox=api;
if(root.window&&root.window!==root)root.window.ManjingoPracticeOutbox=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const KEY='manjingo_practice_outbox_v1';
const ITEM_PREFIX='manjingo_practice_outbox_item_v2:';
const VERSION=2;
const BASE_RETRY_MS=5000;
const MAX_RETRY_MS=300000;
function storage(){return root.localStorage||(root.window&&root.window.localStorage)||null}
function normalizePracticeId(value){const id=String(value||'');return /^[A-Za-z0-9_-]{8,128}$/.test(id)?id:''}
function normalizeItem(value){const raw=value&&typeof value==='object'?value:{},payload=raw.payload&&typeof raw.payload==='object'?{...raw.payload}:null,practiceId=normalizePracticeId(payload&&payload.practiceId||raw.practiceId);if(!payload||!practiceId)return null;payload.practiceId=practiceId;return{practiceId,uid:raw.uid?String(raw.uid):null,payload,queuedAt:raw.queuedAt||new Date().toISOString(),attempts:Math.max(0,Number(raw.attempts)||0),nextAttemptAt:Math.max(0,Number(raw.nextAttemptAt)||0),lastError:raw.lastError?String(raw.lastError).slice(0,240):null}}
function itemKey(practiceId){return ITEM_PREFIX+String(practiceId||'')}
function journalKeys(s){const keys=[];if(!s||typeof s.length!=='number'||typeof s.key!=='function')return keys;for(let i=0;i<s.length;i++){const key=s.key(i);if(typeof key==='string'&&key.startsWith(ITEM_PREFIX))keys.push(key)}return keys}
function readLegacy(s){try{const value=JSON.parse(s.getItem(KEY)||'null'),source=Array.isArray(value)?value:Array.isArray(value&&value.items)?value.items:[];return source.map(normalizeItem).filter(Boolean)}catch(_){return[]}}
function writeItem(item){const s=storage(),value=normalizeItem(item);if(!s||!value)return false;try{s.setItem(itemKey(value.practiceId),JSON.stringify(value));return true}catch(_){return false}}
function removeLegacy(practiceId){const s=storage(),id=normalizePracticeId(practiceId);if(!s||!id)return;try{const value=JSON.parse(s.getItem(KEY)||'null');if(!value)return;const source=Array.isArray(value)?value:Array.isArray(value.items)?value.items:[],items=source.map(normalizeItem).filter(item=>item&&item.practiceId!==id);if(!items.length)s.removeItem(KEY);else s.setItem(KEY,JSON.stringify({version:1,items}))}catch(_){}}
function read(){const s=storage();if(!s)return{version:VERSION,items:[]};const seen=new Set(),items=[];for(const key of journalKeys(s)){try{const item=normalizeItem(JSON.parse(s.getItem(key)||'null'));if(!item||seen.has(item.practiceId))continue;seen.add(item.practiceId);items.push(item)}catch(_){}}for(const item of readLegacy(s)){if(seen.has(item.practiceId))continue;seen.add(item.practiceId);items.push(item);writeItem(item)}return{version:VERSION,items}}
function emit(detail){const target=root.window||root,EventCtor=root.CustomEvent||(root.window&&root.window.CustomEvent);if(target&&typeof target.dispatchEvent==='function'&&typeof EventCtor==='function')try{target.dispatchEvent(new EventCtor('manjingo:practice-outbox-changed',{detail}))}catch(_){}}
function enqueue(payload,uid){if(!payload||typeof payload!=='object')return false;const practiceId=normalizePracticeId(payload.practiceId);if(!practiceId)return false;const data=read(),existing=data.items.find(item=>String(item&&item.practiceId)===practiceId)||null,item={practiceId,uid:existing&&existing.uid?String(existing.uid):uid?String(uid):null,payload:{...payload,practiceId},queuedAt:existing&&existing.queuedAt||new Date().toISOString(),attempts:Number(existing&&existing.attempts)||0,nextAttemptAt:Number(existing&&existing.nextAttemptAt)||0,lastError:existing&&existing.lastError||null},saved=writeItem(item);if(saved)emit({pending:read().items.length});return saved}
function remove(practiceId){const id=normalizePracticeId(practiceId),s=storage();if(!id||!s)return false;try{s.removeItem(itemKey(id));removeLegacy(id);emit({pending:read().items.length});return true}catch(_){return false}}
function retryDelay(attempts){const count=Math.max(1,Number(attempts)||1);return Math.min(MAX_RETRY_MS,BASE_RETRY_MS*Math.pow(2,Math.min(10,count-1)))}
function markFailure(practiceId,error,now){const id=normalizePracticeId(practiceId);if(!id)return false;const item=read().items.find(value=>value&&value.practiceId===id);if(!item)return false;const attempts=(Number(item.attempts)||0)+1,base=Number(now)||Date.now(),next={...item,attempts,nextAttemptAt:base+retryDelay(attempts),lastError:String(error&&error.message||error||'unknown error').slice(0,240)},saved=writeItem(next);if(saved)emit({pending:read().items.length});return saved}
function bindUnowned(uid){const id=String(uid||'');if(!id)return false;const data=read();let changed=false;for(const item of data.items){if(item&&item.uid)continue;changed=true;writeItem({...item,uid:id})}if(changed)emit({pending:read().items.length});return changed}
function list(options){const opts=options||{},uid=opts.uid==null?null:String(opts.uid),includeUnowned=opts.includeUnowned!==false,dueOnly=!!opts.dueOnly,now=Number(opts.now)||Date.now();return read().items.filter(item=>{if(!item||!item.practiceId)return false;const owner=item.uid==null?null:String(item.uid);if(uid!=null&&owner!==uid&&!(includeUnowned&&owner==null))return false;if(uid==null&&!includeUnowned&&owner==null)return false;if(dueOnly&&Number(item.nextAttemptAt||0)>now)return false;return true}).map(item=>({...item,payload:{...(item.payload||{})}}))}
function pendingCount(uid){return list(uid==null?{}:{uid,includeUnowned:false}).length}
function nextDueAt(uid){const items=list(uid==null?{}:{uid,includeUnowned:false});if(!items.length)return null;return Math.min(...items.map(item=>Math.max(0,Number(item.nextAttemptAt)||0)))}
function clear(){const s=storage();if(!s)return false;try{journalKeys(s).forEach(key=>s.removeItem(key));s.removeItem(KEY);emit({pending:0});return true}catch(_){return false}}
return{KEY,ITEM_PREFIX,VERSION,BASE_RETRY_MS,MAX_RETRY_MS,enqueue,remove,retryDelay,markFailure,bindUnowned,list,pendingCount,nextDueAt,clear};
});
