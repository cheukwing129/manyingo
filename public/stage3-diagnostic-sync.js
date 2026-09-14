(function(root,factory){
'use strict';
const api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.ManjingoStage3DiagnosticSync=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const STORAGE_KEY='manyingo_stage3_diagnostics_v1';
const CLOUD_FIELD='stage3Diagnostics';
const MAX_EVENTS_PER_SKILL=24;
const SYNC_DELAY_MS=700;
let syncPromise=null;
let syncTimer=null;
let installed=false;
let lastSyncedSignature=null;

function storage(){try{return root.localStorage||(root.window&&root.window.localStorage)||null;}catch(_){return null;}}
function timeValue(value){if(!value)return 0;try{if(typeof value.toDate==='function')return value.toDate().getTime();if(Number.isFinite(Number(value._seconds)))return Number(value._seconds)*1000;if(Number.isFinite(Number(value.seconds)))return Number(value.seconds)*1000;const time=new Date(value).getTime();return Number.isFinite(time)?time:0;}catch(_){return 0;}}
function iso(value){const time=timeValue(value);return time?new Date(time).toISOString():null;}
function normalizeEvent(value){if(!value||!value.questionId||typeof value.correct!=='boolean')return null;const at=iso(value.at);if(!at)return null;return{questionId:String(value.questionId),correct:!!value.correct,at,choiceIndex:Number.isInteger(value.choiceIndex)?value.choiceIndex:null,diagnosticMode:value.diagnosticMode==='choice'?'choice':'question'};}
function normalizeVerification(value){if(!value||typeof value!=='object')return null;const at=iso(value.at);if(!at)return null;return{correctCount:Math.max(0,Number(value.correctCount)||0),total:Math.max(0,Number(value.total)||0),at};}
function normalizeState(raw){const source=raw&&typeof raw==='object'?raw:{},skills={};for(const [skillId,value] of Object.entries(source.skills&&typeof source.skills==='object'?source.skills:{})){const record=value&&typeof value==='object'?value:{},events=(Array.isArray(record.events)?record.events:[]).map(normalizeEvent).filter(Boolean).sort((a,b)=>timeValue(a.at)-timeValue(b.at)).slice(-MAX_EVENTS_PER_SKILL),verifiedAt=iso(record.verifiedAt),lastVerification=normalizeVerification(record.lastVerification);if(events.length||verifiedAt||lastVerification)skills[String(skillId)]={events,verifiedAt,lastVerification};}return{version:2,skills};}
function readLocal(){const store=storage();try{return normalizeState(JSON.parse(store&&store.getItem(STORAGE_KEY)||'{}'));}catch(_){return normalizeState({});}}
function writeLocal(state){const clean=normalizeState(state),store=storage();try{if(store)store.setItem(STORAGE_KEY,JSON.stringify(clean));return clean;}catch(_){return clean;}}
function eventKey(event){return[String(event.questionId),event.correct?'1':'0',String(event.at),Number.isInteger(event.choiceIndex)?String(event.choiceIndex):'',event.diagnosticMode==='choice'?'choice':'question'].join('|');}
function newerVerification(left,right){const a=normalizeVerification(left),b=normalizeVerification(right);if(!a)return b;if(!b)return a;return timeValue(b.at)>timeValue(a.at)?b:a;}
function mergeRecord(left,right){const a=left&&typeof left==='object'?left:{},b=right&&typeof right==='object'?right:{},verifiedTime=Math.max(timeValue(a.verifiedAt),timeValue(b.verifiedAt)),verifiedAt=verifiedTime?new Date(verifiedTime).toISOString():null,lastVerification=newerVerification(a.lastVerification,b.lastVerification),seen=new Map();for(const raw of [...(Array.isArray(a.events)?a.events:[]),...(Array.isArray(b.events)?b.events:[])]){const event=normalizeEvent(raw);if(!event||timeValue(event.at)<=verifiedTime)continue;seen.set(eventKey(event),event);}const events=Array.from(seen.values()).sort((x,y)=>timeValue(x.at)-timeValue(y.at)).slice(-MAX_EVENTS_PER_SKILL);return{events,verifiedAt,lastVerification};}
function mergeStates(local,remote){const a=normalizeState(local),b=normalizeState(remote),skills={},ids=new Set([...Object.keys(a.skills),...Object.keys(b.skills)]);for(const skillId of ids){const merged=mergeRecord(a.skills[skillId],b.skills[skillId]);if(merged.events.length||merged.verifiedAt||merged.lastVerification)skills[skillId]=merged;}return{version:2,skills};}
function signature(state){return JSON.stringify(normalizeState(state));}
function isDirty(){return lastSyncedSignature==null||signature(readLocal())!==lastSyncedSignature;}
function diagnosticsApi(){return root.ManjingoStage3Diagnostics||(root.window&&root.window.ManjingoStage3Diagnostics)||null;}
function refreshUi(){try{const api=diagnosticsApi();if(api&&typeof api.decorateWeaknessPanel==='function')api.decorateWeaknessPanel();}catch(_){}}
function emit(detail){try{const target=root.window||root,EventCtor=root.CustomEvent||(root.window&&root.window.CustomEvent);if(target&&typeof target.dispatchEvent==='function'&&typeof EventCtor==='function')target.dispatchEvent(new EventCtor('manjingo:stage3-diagnostic-sync',{detail}));}catch(_){}}
async function firebase(){return import('./firebase-config.js');}

async function syncNow(){
 if(syncPromise)return syncPromise;
 syncPromise=(async()=>{
  const fb=await firebase();
  const account=await fb.getAccountState();
  if(!account||!account.uid||!account.google)return{ok:false,reason:'not-linked'};
  const {firestoreModule}=await fb.getFirebase(),database=fb.db;
  if(!database)throw new Error('Firestore unavailable');
  const ref=firestoreModule.doc(database,'users',account.uid,'clientSync','state');
  const localAtStart=readLocal();
  let cloudMerged=localAtStart;
  await firestoreModule.runTransaction(database,async transaction=>{
   const snap=await transaction.get(ref),data=snap.exists()?snap.data()||{}:{},remote=normalizeState(data[CLOUD_FIELD]);
   cloudMerged=mergeStates(localAtStart,remote);
   if(signature(cloudMerged)!==signature(remote))transaction.set(ref,{[CLOUD_FIELD]:cloudMerged,stage3DiagnosticsUpdatedAt:firestoreModule.serverTimestamp()},{merge:true});
  });
  const latestLocal=readLocal(),finalState=mergeStates(cloudMerged,latestLocal);
  writeLocal(finalState);
  lastSyncedSignature=signature(cloudMerged);
  refreshUi();
  emit({status:'synced',uid:account.uid});
  if(signature(finalState)!==lastSyncedSignature)schedule(0);
  return{ok:true,uid:account.uid,state:finalState};
 })().catch(error=>{emit({status:'error',error:String(error&&error.message||error)});return{ok:false,error};}).finally(()=>{syncPromise=null;});
 return syncPromise;
}
function schedule(delay){if(syncTimer)clearTimeout(syncTimer);const wait=Number.isFinite(Number(delay))?Math.max(0,Number(delay)):SYNC_DELAY_MS;syncTimer=setTimeout(()=>{syncTimer=null;if(isDirty())void syncNow();},wait);}
function mergeRemote(remote){const remoteClean=normalizeState(remote),merged=mergeStates(readLocal(),remoteClean);writeLocal(merged);lastSyncedSignature=signature(remoteClean);refreshUi();if(signature(merged)!==lastSyncedSignature)schedule(0);return merged;}
function install(){if(installed)return true;installed=true;const target=root.window||root;if(target&&typeof target.addEventListener==='function'){target.addEventListener('manjingo:learning-state-changed',()=>schedule());target.addEventListener('manjingo:account-sync-state',()=>schedule());target.addEventListener('online',()=>schedule(0));target.addEventListener('storage',event=>{if(event&&event.key===STORAGE_KEY)schedule(0);});}const doc=root.document||(root.window&&root.window.document);if(doc&&typeof doc.addEventListener==='function')doc.addEventListener('visibilitychange',()=>{if(doc.visibilityState==='visible')schedule(0);});setTimeout(()=>void syncNow(),0);return true;}

const api={STORAGE_KEY,CLOUD_FIELD,MAX_EVENTS_PER_SKILL,SYNC_DELAY_MS,timeValue,normalizeState,mergeRecord,mergeStates,readLocal,writeLocal,isDirty,syncNow,schedule,mergeRemote,install};
if(root.document||(root.window&&root.window.document))install();
return api;
});
