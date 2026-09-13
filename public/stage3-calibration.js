(function(root,factory){
'use strict';
const api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.ManjingoStage3Calibration=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const OUTBOX_KEY='manyingo_stage3_calibration_outbox_v1';
const MAP_VERSION='stage3-choice-diagnostics-v1';
const MAX_ITEMS=80;
const BASE_RETRY_MS=2000;
const MAX_RETRY_MS=300000;
let flushPromise=null;
let retryTimer=null;

function nowIso(value){const date=value?new Date(value):new Date();return Number.isFinite(date.getTime())?date.toISOString():new Date().toISOString();}
function readRaw(){try{const value=JSON.parse(root.localStorage&&root.localStorage.getItem(OUTBOX_KEY)||'[]');return Array.isArray(value)?value:[];}catch(e){return[];}}
function normalizeEvidence(value){return(Array.isArray(value)?value:[]).filter(item=>item&&item.questionId).map(item=>({questionId:String(item.questionId),choiceIndex:Number.isInteger(item.choiceIndex)?item.choiceIndex:null,diagnosticMode:item.diagnosticMode==='choice'?'choice':'question'}));}
function normalizeVerification(value){return(Array.isArray(value)?value:[]).filter(item=>item&&item.answerId&&item.questionId).map(item=>({answerId:String(item.answerId),questionId:String(item.questionId)}));}
function normalizePayload(value){if(!value||typeof value!=='object')return null;const payload={calibrationId:String(value.calibrationId||''),mapVersion:String(value.mapVersion||MAP_VERSION),skillId:String(value.skillId||''),diagnosticEvidence:normalizeEvidence(value.diagnosticEvidence),verificationAnswers:normalizeVerification(value.verificationAnswers),completedAt:nowIso(value.completedAt)};return payload.calibrationId&&payload.skillId?payload:null;}
function normalizeItem(value){const payload=normalizePayload(value&&value.payload);if(!payload)return null;return{calibrationId:payload.calibrationId,ownerUid:value&&value.ownerUid?String(value.ownerUid):null,payload,attempts:Math.max(0,Number(value&&value.attempts)||0),nextRetryAt:Math.max(0,Number(value&&value.nextRetryAt)||0),lastError:value&&value.lastError?String(value.lastError).slice(0,240):null,queuedAt:nowIso(value&&value.queuedAt)};}
function read(){return readRaw().map(normalizeItem).filter(Boolean).slice(-MAX_ITEMS);}
function write(items){try{if(root.localStorage)root.localStorage.setItem(OUTBOX_KEY,JSON.stringify((Array.isArray(items)?items:[]).map(normalizeItem).filter(Boolean).slice(-MAX_ITEMS)));return true;}catch(e){return false;}}
function createId(){try{if(root.crypto&&typeof root.crypto.randomUUID==='function')return'cal_'+root.crypto.randomUUID().replace(/-/g,'');}catch(e){}return'cal_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,14);}
function uniqueByQuestion(items){const seen=new Set(),out=[];for(let i=items.length-1;i>=0;i-=1){const item=items[i],id=String(item.questionId||'');if(!id||seen.has(id))continue;seen.add(id);out.unshift(item);}return out;}
function buildEvent(input){const source=input&&typeof input==='object'?input:{},evidence=uniqueByQuestion(normalizeEvidence(source.diagnosticEvidence)),verification=normalizeVerification(source.verificationAnswers),skillId=String(source.skillId||'');if(!skillId||evidence.length<2||verification.length!==2||new Set(verification.map(x=>x.answerId)).size!==2||new Set(verification.map(x=>x.questionId)).size!==2)return null;return{calibrationId:String(source.calibrationId||createId()),mapVersion:MAP_VERSION,skillId,diagnosticEvidence:evidence.slice(-12),verificationAnswers:verification,completedAt:nowIso(source.completedAt)};}
function enqueue(payload,ownerUid){const clean=normalizePayload(payload);if(!clean)return false;const items=read(),index=items.findIndex(item=>item.calibrationId===clean.calibrationId),entry={calibrationId:clean.calibrationId,ownerUid:ownerUid?String(ownerUid):null,payload:clean,attempts:0,nextRetryAt:0,lastError:null,queuedAt:new Date().toISOString()};if(index>=0)items[index]={...items[index],payload:clean,ownerUid:items[index].ownerUid||entry.ownerUid};else items.push(entry);return write(items);}
function bindUnowned(uid){const id=String(uid||'');if(!id)return 0;let changed=0;const items=read().map(item=>{if(item.ownerUid)return item;changed+=1;return{...item,ownerUid:id};});if(changed)write(items);return changed;}
function list(options){const opts=options||{},uid=opts.uid?String(opts.uid):null,now=Date.now();return read().filter(item=>(!uid||item.ownerUid===uid||(opts.includeUnowned&&item.ownerUid==null))&&(!opts.dueOnly||!item.nextRetryAt||item.nextRetryAt<=now));}
function remove(calibrationId){const id=String(calibrationId||''),items=read(),next=items.filter(item=>item.calibrationId!==id);if(next.length===items.length)return false;write(next);return true;}
function markFailure(calibrationId,error){const id=String(calibrationId||''),items=read(),index=items.findIndex(item=>item.calibrationId===id);if(index<0)return false;const attempts=items[index].attempts+1,delay=Math.min(MAX_RETRY_MS,BASE_RETRY_MS*Math.pow(2,Math.min(7,attempts-1)));items[index]={...items[index],attempts,nextRetryAt:Date.now()+delay,lastError:String(error&&error.message||error||'calibration upload failed').slice(0,240)};write(items);return true;}
function nextDueAt(uid){const values=list({uid,includeUnowned:!uid}).map(item=>item.nextRetryAt||Date.now());return values.length?Math.min(...values):null;}
function retryable(error){const status=Number(error&&error.status)||0;return !status||status===408||status===409||status===425||status===429||status>=500;}
async function firebaseModule(){return import('./firebase-config.js');}
async function send(firebase,payload){const uid=await firebase.ensureLogin();if(!uid||!firebase.auth||!firebase.auth.currentUser)throw new Error('Firebase authentication unavailable');const token=await firebase.auth.currentUser.getIdToken();const response=await root.fetch('/api/stage3-calibration',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload)});let data=null;try{data=await response.json();}catch(e){}if(!response.ok){const error=new Error(data&&data.error?data.error:'stage3 calibration API '+response.status);error.status=response.status;throw error;}return{uid,data};}
function scheduleRetry(uid){if(!root.document||typeof root.setTimeout!=='function')return;if(retryTimer){root.clearTimeout(retryTimer);retryTimer=null;}const next=nextDueAt(uid);if(next==null)return;const delay=Math.max(1000,Math.min(MAX_RETRY_MS,next-Date.now()));retryTimer=root.setTimeout(()=>{retryTimer=null;void flush();},delay);}
async function flush(options){if(flushPromise)return flushPromise;flushPromise=(async()=>{let firebase;try{firebase=await firebaseModule();}catch(error){return{synced:0,pending:read().length};}const uid=(options&&options.uid)||firebase.getCurrentUserId&&firebase.getCurrentUserId()||await firebase.ensureLogin();if(!uid){scheduleRetry(null);return{synced:0,pending:read().length};}bindUnowned(uid);const items=list({uid,dueOnly:!(options&&options.force)}),synced=[];for(const item of items){try{const result=await send(firebase,item.payload);if(result.data&&result.data.success){remove(item.calibrationId);synced.push(item.calibrationId);continue;}throw new Error('calibration API did not confirm event');}catch(error){if(retryable(error)){markFailure(item.calibrationId,error);break;}remove(item.calibrationId);if(root.console&&root.console.warn)root.console.warn('discarding permanently rejected Stage 3 calibration',item.calibrationId,error);}}scheduleRetry(uid);return{synced:synced.length,pending:list({uid}).length};})().finally(()=>{flushPromise=null;});return flushPromise;}
function queue(input){const payload=buildEvent(input);if(!payload)return null;enqueue(payload,null);if(root.document)void flush({force:true});return payload;}
function clear(){try{if(root.localStorage)root.localStorage.removeItem(OUTBOX_KEY);return true;}catch(e){return false;}}
function installRetry(){if(!root.document||typeof root.addEventListener!=='function')return;root.addEventListener('online',()=>void flush({force:true}));if(root.document.addEventListener)root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='visible')void flush();});if(typeof root.setTimeout==='function')root.setTimeout(()=>void flush({force:true}),0);}

const api={OUTBOX_KEY,MAP_VERSION,MAX_ITEMS,buildEvent,enqueue,bindUnowned,list,remove,markFailure,nextDueAt,flush,queue,clear};
installRetry();
return api;
});
