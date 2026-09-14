(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoPlanStateV1=api;
if(root.window&&root.window!==root)root.window.ManjingoPlanStateV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION='plan-state-v1';
const FIELDS={
  knowledge:['mastery','repetition','easeFactor','interval','nextReviewAt','attempts','correctCount','wrongCount','hintCount','lastCorrect','lastAnsweredAt','updatedAt'],
  skills:['skillId','mastery','repetition','easeFactor','interval','nextReviewAt','attempts','correctCount','wrongCount','hintCount','lastCorrect','lastAnsweredAt','updatedAt','kpIds','source','masteryVerified'],
  concepts:['conceptKey','conceptLabel','mastery','attempts','correctCount','wrongCount','lastCorrect','lastAnsweredAt','updatedAt','kpIds','questionIds'],
  interventions:['learningState','routeKpId','kpIds','updatedAt','source']
};
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{}}
function project(kind,value){const data=object(value),out={};for(const key of FIELDS[kind]||[])if(data[key]!==undefined)out[key]=data[key];return out}
function mapName(kind){return`${kind}ById`}
function base(value){const data=object(value);return{version:VERSION,complete:data.version===VERSION&&data.complete===true,knowledgeById:{...object(data.knowledgeById)},skillsById:{...object(data.skillsById)},conceptsById:{...object(data.conceptsById)},interventionsById:{...object(data.interventionsById)},updatedAt:data.updatedAt||null}}
function apply(value,changes,now){const next=base(value);for(const kind of Object.keys(FIELDS)){const change=changes&&changes[kind];if(!change||change.id==null)continue;next[mapName(kind)][String(change.id)]=project(kind,change.data)}next.updatedAt=now instanceof Date?now.toISOString():String(now||new Date().toISOString());return next}
function fieldSegment(value){const text=String(value);return/^[A-Za-z_][A-Za-z0-9_]*$/.test(text)?text:'`'+text.replace(/\\/g,'\\\\').replace(/`/g,'\\`')+'`'}
function delta(changes,now){const data={version:VERSION,updatedAt:now instanceof Date?now.toISOString():String(now||new Date().toISOString())},fieldPaths=['version','updatedAt'];for(const kind of Object.keys(FIELDS)){const change=changes&&changes[kind];if(!change||change.id==null)continue;const name=mapName(kind),id=String(change.id);if(!data[name])data[name]={};data[name][id]=project(kind,change.data);fieldPaths.push(`${name}.${fieldSegment(id)}`)}return{data,fieldPaths}}
function full(collections,now){const next=base({complete:true});next.complete=true;for(const kind of Object.keys(FIELDS)){const rows=Array.isArray(collections&&collections[kind])?collections[kind]:[];next[mapName(kind)]={};for(const row of rows)if(row&&row.id!=null)next[mapName(kind)][String(row.id)]=project(kind,row.data)}next.updatedAt=now instanceof Date?now.toISOString():String(now||new Date().toISOString());return next}
function usable(value){return !!(value&&value.version===VERSION&&value.complete===true)}
function rows(value,kind){const map=object(value&&value[mapName(kind)]);return Object.entries(map).map(([id,data])=>({id,data:object(data)}))}
function changedAfter(value,startedAt){const changed=new Date(value&&value.updatedAt||0).getTime(),started=startedAt instanceof Date?startedAt.getTime():new Date(startedAt||0).getTime();return Number.isFinite(changed)&&Number.isFinite(started)&&changed>started}
return{VERSION,FIELDS,project,base,apply,delta,full,usable,rows,changedAfter};
});
