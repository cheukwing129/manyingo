(function(){
'use strict';
const content=window.ManjingoContent,path=window.ManjingoLearningPath,results=window.ManjingoSkillResultsV1,metadata=window.ManjingoQuestionMetadataV1;
if(!content||!path||!results)return;
const EVENT_NAME='manjingo:learning-state-changed';
const MUTATING_METHODS=['submit','syncRemoteResult','syncGamification','syncRemoteConceptState','resolveQuestionMisconceptions','recordPracticeSession'];
let refreshPending=false;
const originalGetIds=content.getKnowledgePointIds.bind(content);
const originalSelect=content.selectQuestionsForPlan.bind(content);
function engine(){return window.ManjingoLocalLearning}
function resultItems(){return results.allItems()}
function stages(){const items=resultItems(),byId=new Map(items.map(item=>[String(item.skillId),item]));return path.buildStages(results.coreSkills(),skillId=>byId.get(String(skillId))||{mastery:0})}
function allowedSkillIds(){return new Set(path.availableSkillIds(stages()).map(String))}
function allowedIds(){const ids=new Set();for(const skillId of allowedSkillIds())for(const kpId of results.kpIdsForSkill(skillId))ids.add(String(kpId));return ids}
function questionSkills(question){const annotated=metadata&&typeof metadata.annotate==='function'?metadata.annotate(question):question;return Array.isArray(annotated&&annotated.skillIds)?annotated.skillIds.map(String).filter(Boolean):[]}
function questionAllowed(question,skills){const ids=questionSkills(question);return ids.length>0&&ids.every(id=>skills.has(id))}
content.getKnowledgePointIds=function(options){if(options&&options.learningPath===false)return originalGetIds(options);const allowed=allowedIds();return originalGetIds(options).filter(id=>allowed.has(String(id)))};
content.selectQuestionsForPlan=function(plan,sourceQuestions,limit){const skills=allowedSkillIds(),allowed=allowedIds(),items=Array.isArray(plan&&plan.items)?plan.items.filter(item=>item&&item.skillId?skills.has(String(item.skillId)):allowed.has(String(item&&item.kpId||''))):[],source=(Array.isArray(sourceQuestions)?sourceQuestions:[]).filter(q=>questionAllowed(q,skills));return originalSelect({...plan,items},source,limit)};
function itemMap(){return new Map(resultItems().map(item=>[String(item.skillId),item]))}
function nextLesson(stage){if(!stage||!stage.unlocked)return null;const byId=itemMap();return(stage.skillIds||[]).map((skillId,index)=>{const item=byId.get(String(skillId));return item&&item.actionKpId?{skillId:String(skillId),label:item.label,kpId:item.actionKpId,mastery:Number(item.mastery)||0,priority:Number(item.practiceState&&item.practiceState.priority)||0,weak:!!item.weak,index}:null}).filter(Boolean).sort((a,b)=>b.priority-a.priority||(a.weak===b.weak?0:a.weak?-1:1)||a.mastery-b.mastery||a.index-b.index)[0]||null}
function stageLabels(stage){return(stage&&stage.skillIds||[]).map(id=>results.skill(id)).filter(Boolean).map(skill=>skill.label||skill.id)}
function stageState(stage,current,index,currentIndex){if(stage.complete)return'complete';if(current&&stage.id===current.id)return'current';if(currentIndex>=0&&index===currentIndex+1)return'next';return stage.unlocked?'current':'locked'}
function stateCopy(state,stage){if(state==='complete')return{label:'已完成',hint:'可隨時回來複習',badge:'✓'};if(state==='current')return{label:'目前關卡',hint:'核心技能平均達 70% 後解鎖下一關',badge:stage.mastery+'%'};if(state==='next')return{label:'下一關',hint:'目前關卡達 70% 後解鎖',badge:'下一關'};return{label:'未解鎖',hint:'完成前面的技能階段後開放',badge:'🔒'}}
function render(){
 const host=document.getElementById('learningPath');if(!host)return;
 const list=stages(),current=path.currentStage(list),currentIndex=current?list.findIndex(stage=>stage.id===current.id):-1,completeCount=list.filter(stage=>stage.complete).length;
 const headline=current?'第 '+(current.index+1)+' / '+list.length+' 關 · '+current.icon+' '+current.title:'全部 '+list.length+' 關已完成';
 const sub=current?'技能平均掌握度 '+current.mastery+'% · 達 70% 解鎖下一關':'你已完成 49 項核心技能路徑，可自由回顧各階段。';
 host.innerHTML='<div class="lp-head"><div><div class="lp-eyebrow">核心技能路徑 · 已完成 '+completeCount+' / '+list.length+'</div><div class="lp-title">'+headline+'</div><div class="lp-sub">'+sub+'</div></div></div><div class="lp-route">'+list.map((stage,index)=>{const state=stageState(stage,current,index,currentIndex),copy=stateCopy(state,stage),lesson=(state==='complete'||state==='current')?nextLesson(stage):null,tag=lesson?'a':'div',attrs=lesson?' href="./lesson.html?kpId='+encodeURIComponent(lesson.kpId)+'" title="'+(state==='complete'?'複習 ':'繼續 ')+(lesson.label||stage.title)+'"':'',labels=stageLabels(stage),preview=labels.slice(0,4).join(' · ')+(labels.length>4?' · …':'');return '<div class="lp-stop '+state+'"><div class="lp-rail" aria-hidden="true"><div class="lp-orb">'+(state==='complete'?'✓':stage.icon)+'</div></div><'+tag+' class="lp-stage-card'+(lesson?' clickable':'')+'"'+attrs+'><div class="lp-stage-top"><span class="lp-status">'+copy.label+'</span><span class="lp-badge">'+copy.badge+'</span></div><strong class="lp-stage-title">'+stage.title+'</strong><span class="lp-stage-desc">'+stage.description+'</span><span class="lp-stage-meta">'+stage.count+' 項核心技能 · '+copy.hint+'</span><span class="lp-skill-preview">'+preview+'</span><div class="lp-bar" aria-label="'+stage.title+' 技能掌握度 '+stage.mastery+'%"><i style="width:'+stage.mastery+'%"></i></div>'+(lesson?'<span class="lp-cta">'+(state==='complete'?'複習 '+lesson.label:'繼續 '+lesson.label)+' →</span>':'')+'</'+tag+'></div>';}).join('')+'</div>';
}
function emitLearningChanged(source,result){
 const detail={source:String(source||'unknown'),kpId:result&&result.kpId?String(result.kpId):null};
 let event;
 try{event=new CustomEvent(EVENT_NAME,{detail})}catch(e){event={type:EVENT_NAME,detail}}
 window.dispatchEvent(event);
}
function installEvents(){
 const learning=engine();if(!learning||learning.__learningEventsWrapped)return false;
 MUTATING_METHODS.forEach(name=>{const original=learning[name];if(typeof original!=='function')return;learning[name]=function(){const result=original.apply(this,arguments);emitLearningChanged(name,result);return result}});
 learning.__learningEventsWrapped=true;
 return true;
}
function studyActive(){return !!(document.body&&document.body.classList&&document.body.classList.contains('study-focus'))}
function refreshLearningViews(force){
 if(force!==true&&studyActive()){refreshPending=true;return false}
 refreshPending=false;
 render();
 const weakness=window.ManjingoWeaknessPanel;if(weakness&&typeof weakness.render==='function')weakness.render();
 const dashboard=window.ManjingoMasteryDashboard;if(dashboard&&typeof dashboard.mount==='function')dashboard.mount();
 return true;
}
function flushLearningViews(){if(refreshPending)refreshLearningViews(true)}
function install(){
 if(!document.getElementById('learningPath')){const plan=document.getElementById('plan');if(plan){const card=document.createElement('div');card.className='card';card.id='learningPath';plan.parentNode.insertBefore(card,plan)}}
 if(!document.getElementById('learningPathStyle')){const style=document.createElement('style');style.id='learningPathStyle';style.textContent='.lp-head{margin-bottom:18px}.lp-eyebrow{font-size:11px;color:var(--gray);font-weight:900;letter-spacing:.03em;margin-bottom:5px}.lp-title{font-size:22px;line-height:1.3;font-weight:950;color:var(--ink)}.lp-sub{font-size:12px;color:var(--gray);font-weight:750;margin-top:5px;line-height:1.45}.lp-route{display:grid;gap:0}.lp-stop{position:relative;display:grid;grid-template-columns:44px minmax(0,1fr);gap:10px;min-height:126px}.lp-rail{position:relative;display:flex;justify-content:center}.lp-rail:after{content:"";position:absolute;top:42px;bottom:0;width:4px;border-radius:99px;background:#e5e5e5}.lp-stop:last-child .lp-rail:after{display:none}.lp-orb{position:relative;z-index:1;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fff;border:3px solid #d8d8d8;font-size:20px;font-weight:950}.lp-stage-card{display:block;align-self:start;margin-bottom:14px;padding:13px 14px;border:2px solid #e5e5e5;border-radius:17px;text-decoration:none;color:inherit;background:#fff;transition:transform .15s ease,box-shadow .15s ease}.lp-stage-card.clickable{cursor:pointer}.lp-stage-card.clickable:active{transform:translateY(1px)}.lp-stage-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px}.lp-status{font-size:10px;font-weight:950;letter-spacing:.03em;color:var(--gray)}.lp-badge{font-size:11px;font-weight:950;color:var(--ink)}.lp-stage-title{display:block;color:var(--ink);font-size:16px;margin-bottom:3px}.lp-stage-desc,.lp-stage-meta,.lp-skill-preview{display:block;font-size:11px;line-height:1.45;color:var(--gray);font-weight:700}.lp-stage-desc{color:var(--text);margin-bottom:3px}.lp-skill-preview{margin-top:5px;color:#737373}.lp-bar{height:7px;background:#e8e8e8;border-radius:99px;overflow:hidden;margin-top:9px}.lp-bar i{display:block;height:100%;background:var(--green);border-radius:99px}.lp-cta{display:block;margin-top:9px;color:#398500;font-size:12px;font-weight:950}.lp-stop.complete .lp-orb{border-color:#9bd66e;background:#eefbe5;color:#398500}.lp-stop.complete .lp-rail:after{background:#b7e694}.lp-stop.complete .lp-stage-card{border-color:#d8ebca;background:#fbfff8}.lp-stop.current .lp-orb{border-color:var(--green);background:var(--green);color:#fff;box-shadow:0 0 0 5px #e9fbdc}.lp-stop.current .lp-stage-card{border-color:var(--green);background:#f8fff2;box-shadow:0 8px 24px rgba(70,163,2,.10)}.lp-stop.current .lp-status{color:#398500}.lp-stop.current .lp-badge{color:#398500}.lp-stop.next .lp-orb{border-color:#a9c994;background:#f6fbf2}.lp-stop.next .lp-stage-card{border-style:dashed;border-color:#b9d5a7}.lp-stop.next .lp-status{color:#5f8d42}.lp-stop.locked{min-height:110px}.lp-stop.locked .lp-orb{filter:grayscale(1);opacity:.55}.lp-stop.locked .lp-stage-card{opacity:.58;background:#fafafa}.lp-stop.locked .lp-bar i,.lp-stop.next .lp-bar i{background:#bdbdbd}@media(max-width:430px){.lp-stop{grid-template-columns:40px minmax(0,1fr);gap:8px}.lp-orb{width:38px;height:38px;font-size:18px}.lp-rail:after{top:38px}.lp-stage-card{padding:12px 13px}.lp-title{font-size:20px}}';document.head.appendChild(style)}
 installEvents();render();
}
window.addEventListener(EVENT_NAME,refreshLearningViews);
window.addEventListener('manjingo:study-mode-exit',flushLearningViews);
window.ManjingoLearningEvents={eventName:EVENT_NAME,emit:emitLearningChanged,install:installEvents,refresh:refreshLearningViews};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
