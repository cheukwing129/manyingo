(function(root,factory){
'use strict';
const api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root){root.ManjingoStage3Reading=api;if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',api.install);else api.install();}}
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const STORAGE_KEY='manyingo_stage3_ui_v1';
const SKILLS=[
 {id:'read.argumentation',label:'論證閱讀',description:'辨析跨句說理關係與論證作用'},
 {id:'transfer.short-passage',label:'短篇整合',description:'整合短篇人物、因果與上下文線索'},
 {id:'transfer.mixed',label:'綜合遷移',description:'綜合字詞、句式與翻譯處理陌生篇章'}
];
const SKILL_IDS=new Set(SKILLS.map(x=>x.id));
let session=null;
let questionStartedAt=0;

function skillId(question){
 const ids=Array.isArray(question&&question.skillIds)?question.skillIds.map(String):[];
 return ids.find(id=>SKILL_IDS.has(id))||null;
}
function isStage3Question(question){return !!(question&&Number(question.transferLevel)===3&&skillId(question));}
function challengeQuestions(source){return(Array.isArray(source)?source:[]).filter(isStage3Question);}
function normalizeCursor(value,length){const n=Math.max(0,Number(value)||0);return length?n%length:0;}
function buildChallenge(source,cursors,countPerSkill){
 const questions=challengeQuestions(source),perSkill=Math.max(1,Number(countPerSkill)||2),cursorState=cursors&&typeof cursors==='object'?cursors:{},groups=new Map(SKILLS.map(skill=>[skill.id,[]]));
 questions.forEach(q=>groups.get(skillId(q)).push(q));
 const selectedBySkill=new Map(),nextCursors={};
 for(const skill of SKILLS){
  const group=groups.get(skill.id)||[],start=normalizeCursor(cursorState[skill.id],group.length),picked=[];
  for(let i=0;i<Math.min(perSkill,group.length);i++)picked.push(group[(start+i)%group.length]);
  selectedBySkill.set(skill.id,picked);
  nextCursors[skill.id]=group.length?(start+picked.length)%group.length:0;
 }
 const selected=[];
 for(let round=0;round<perSkill;round++)for(const skill of SKILLS){const q=(selectedBySkill.get(skill.id)||[])[round];if(q)selected.push(q);}
 return{questions:selected,nextCursors};
}
function validPassageSet(set,questions){
 const ids=Array.isArray(set&&set.questionIds)?set.questionIds.map(String):[],byId=new Map((Array.isArray(questions)?questions:[]).map(question=>[String(question&&question.id||''),question]));
 return !!(set&&set.id&&set.title&&set.source&&String(set.passageText||'').length>=50&&ids.length>=2&&ids.every(id=>byId.has(id)&&String(byId.get(id).passageSetId||'')===String(set.id)));
}
function buildPassageSet(sourceSets,sourceQuestions,cursor){
 const sets=(Array.isArray(sourceSets)?sourceSets:[]).filter(set=>validPassageSet(set,sourceQuestions)),byId=new Map((Array.isArray(sourceQuestions)?sourceQuestions:[]).map(question=>[String(question&&question.id||''),question]));
 if(!sets.length)return{passageSet:null,questions:[],nextCursor:0};const index=normalizeCursor(cursor,sets.length),passageSet=sets[index],questions=passageSet.questionIds.map(id=>byId.get(String(id))).filter(Boolean);
 return{passageSet,questions,nextCursor:(index+1)%sets.length};
}
function summarizeResults(attempts){
 const rows=SKILLS.map(skill=>({skillId:skill.id,label:skill.label,correct:0,total:0,accuracy:0})),lookup=new Map(rows.map(row=>[row.skillId,row]));
 for(const attempt of Array.isArray(attempts)?attempts:[]){const row=lookup.get(String(attempt&&attempt.skillId||''));if(!row)continue;row.total+=1;if(attempt.correct)row.correct+=1;}
 rows.forEach(row=>{row.accuracy=row.total?Math.round(row.correct/row.total*100):0;});
 const total=rows.reduce((n,row)=>n+row.total,0),correct=rows.reduce((n,row)=>n+row.correct,0);
 return{rows,total,correct,accuracy:total?Math.round(correct/total*100):0};
}
function readState(){
 try{const parsed=JSON.parse(root.localStorage&&root.localStorage.getItem(STORAGE_KEY)||'{}');return{cursors:parsed.cursors&&typeof parsed.cursors==='object'?parsed.cursors:{},runs:Math.max(0,Number(parsed.runs)||0),bestScore:Math.max(0,Number(parsed.bestScore)||0),setCursor:Math.max(0,Number(parsed.setCursor)||0),setRuns:Math.max(0,Number(parsed.setRuns)||0),bestSetScore:Math.max(0,Number(parsed.bestSetScore)||0)};}catch(e){return{cursors:{},runs:0,bestScore:0,setCursor:0,setRuns:0,bestSetScore:0};}
}
function writeState(state){try{if(root.localStorage)root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(e){return false;}}
function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function highlightedPassage(value,target){const text=String(value||''),needle=String(target||'');if(!needle||!text.includes(needle))return esc(text);const index=text.indexOf(needle);return esc(text.slice(0,index))+'<mark class="stage3-target">'+esc(needle)+'</mark>'+esc(text.slice(index+needle.length));}
function skillMeta(id){return SKILLS.find(x=>x.id===String(id))||SKILLS[0];}
function localDate(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function createAnswerId(){try{if(root.crypto&&typeof root.crypto.randomUUID==='function')return root.crypto.randomUUID().replace(/-/g,'');}catch(e){}return 'stage3_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);}
function refreshPlayerStatus(){
 const learning=root.ManjingoLocalLearning;if(!learning||typeof learning.getProgress!=='function'||!root.document)return;
 const state=learning.getProgress(),xp=root.document.getElementById('xp'),daily=root.document.getElementById('daily'),dailyFill=root.document.getElementById('dailyFill'),streak=root.document.getElementById('streak'),level=root.document.getElementById('level'),levelText=root.document.getElementById('levelText'),levelFill=root.document.getElementById('levelFill');
 if(xp)xp.textContent='共 '+state.totalXp+' XP';if(daily)daily.textContent=state.todayXp+' / 20 XP';if(dailyFill)dailyFill.style.width=Math.min(100,state.todayXp/20*100)+'%';if(streak)streak.textContent=state.streak;
 let lv=1,current=Number(state.totalXp)||0,need=50;while(current>=need&&lv<99){current-=need;lv++;need=50+(lv-2)*30;}if(level)level.textContent=lv;if(levelText)levelText.textContent=current+' / '+need+' XP';if(levelFill)levelFill.style.width=Math.min(100,current/need*100)+'%';
}
function answerModel(question){const reorder=root.ManjingoReorderQuestionV1;return question&&question.type==='reorder'&&reorder&&typeof reorder.modelAnswer==='function'?reorder.modelAnswer(question):String(question&&question.a||'');}
function answerCorrect(question,selected){const reorder=root.ManjingoReorderQuestionV1;return question&&question.type==='reorder'&&reorder&&typeof reorder.isCorrect==='function'?reorder.isCorrect(question,selected):String(selected)===String(question&&question.a);}
function recordLocal(question,correct,selected){
 const learning=root.ManjingoLocalLearning;if(!learning||typeof learning.submit!=='function')return null;
 try{return learning.submit(question.kpId,correct,{questionId:question.id,selectedAnswer:selected,correctAnswer:answerModel(question),attemptCount:1,responseTimeMs:Math.max(0,Date.now()-questionStartedAt),usedHint:false,skillIds:question.skillIds});}catch(e){return null;}
}
function recordCloud(question,correct,selected){
 if(typeof root.document==='undefined')return Promise.resolve(null);
 return import('./firebase-config.js').then(module=>module.ensureLogin().then(uid=>uid?module.submitAnswer({answerId:createAnswerId(),questionId:question.id,kpId:question.kpId,isCorrect:correct,attemptCount:1,responseTimeMs:Math.max(0,Date.now()-questionStartedAt),usedHint:false,localDate:localDate(),selectedAnswer:selected,correctAnswer:answerModel(question)}):null)).catch(()=>null);
}
function installStyle(){
 if(!root.document||root.document.getElementById('stage3ReadingStyle'))return;
 const style=root.document.createElement('style');style.id='stage3ReadingStyle';style.textContent='.stage3-card{border-color:#dfe7da!important;box-shadow:0 8px 28px rgba(0,4,55,.06)}.stage3-kicker{font-size:11px;font-weight:900;letter-spacing:.08em;color:#398500;margin-bottom:7px}.stage3-title{font-size:24px;line-height:1.2;font-weight:950;color:var(--ink,#000437);margin:0 0 8px}.stage3-lead{font-size:13px;line-height:1.65;color:var(--text,#4b4b4b);margin:0 0 14px}.stage3-skill-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}.stage3-skill{padding:11px 8px;border-radius:14px;background:#f6f8f4;text-align:center}.stage3-skill strong{display:block;color:var(--ink,#000437);font-size:12px;margin-bottom:4px}.stage3-skill span{display:block;color:var(--gray,#888);font-size:10px;line-height:1.4}.stage3-meta{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px}.stage3-pill{padding:5px 9px;border-radius:999px;background:#eef8e8;color:#398500;font-size:11px;font-weight:850}.stage3-note{font-size:11px;color:var(--gray,#888);line-height:1.5;margin-top:9px}.stage3-progress{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.stage3-progress strong{font-size:12px;color:var(--ink,#000437)}.stage3-track{height:8px;flex:1;background:#e8e8e8;border-radius:99px;overflow:hidden}.stage3-track i{display:block;height:100%;background:var(--green,#58cc02);border-radius:99px}.stage3-passage{margin:12px 0 14px;border:1px solid #dfe4dc;border-radius:14px;background:#fbfcfa;overflow:hidden}.stage3-passage summary{cursor:pointer;padding:11px 13px;font-size:12px;font-weight:900;color:var(--ink,#000437);background:#f4f7f2}.stage3-passage div{padding:13px 14px;font-family:"Noto Serif TC","PMingLiU",serif;font-size:16px;line-height:1.9;color:#30362f}.stage3-source{display:block;margin-top:4px;color:var(--gray,#888);font-family:"Noto Sans TC",system-ui,sans-serif;font-size:11px}.stage3-target{background:#fff1a8;color:inherit;border-radius:4px;padding:1px 2px}.stage3-prompt{font-size:18px;font-weight:900;line-height:1.55;color:var(--ink,#000437);margin:8px 0 12px}.stage3-option{width:100%;padding:12px 13px;margin:7px 0 0;border:2px solid #d7d7d7;border-radius:13px;background:#fff;color:var(--text,#4b4b4b);text-align:left;font-weight:800;line-height:1.45;cursor:pointer}.stage3-option:hover{border-color:#9fcf7c}.stage3-option.correct{background:var(--light-green,#d7ffb8);border-color:var(--green,#58cc02)}.stage3-option.wrong{background:var(--light-red,#ffdfe0);border-color:var(--red,#ff4b4b)}.stage3-option:disabled{cursor:default;opacity:1}.stage3-feedback{margin-top:12px;padding:12px 13px;border-radius:13px;font-size:13px;font-weight:800;line-height:1.55}.stage3-feedback.correct{background:var(--light-green,#d7ffb8);color:#287400}.stage3-feedback.wrong{background:var(--light-red,#ffdfe0);color:#a40000}.stage3-next{margin-top:12px}.stage3-summary-score{text-align:center;font-size:36px;font-weight:950;color:var(--ink,#000437);margin:7px 0 3px}.stage3-summary-sub{text-align:center;color:var(--gray,#888);font-size:12px;font-weight:800;margin-bottom:14px}.stage3-result{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;padding:11px 0;border-top:1px solid #eee}.stage3-result strong{color:var(--ink,#000437);font-size:13px}.stage3-result span{color:#398500;font-size:13px;font-weight:900}.stage3-result small{grid-column:1/-1;color:var(--gray,#888);font-size:10px}.stage3-review{padding:11px 0;border-top:1px solid #eee}.stage3-review strong{display:block;color:#a40000;font-size:12px;margin-bottom:4px}.stage3-review span{display:block;color:var(--text,#4b4b4b);font-size:12px;line-height:1.55}.stage3-secondary{margin-top:8px;background:#fff!important;color:var(--ink,#000437)!important;border-color:#cfd8ca!important}@media(max-width:430px){.stage3-skill-grid{grid-template-columns:1fr}.stage3-skill{text-align:left}.stage3-skill span{font-size:11px}.stage3-passage div{font-size:15px}.stage3-prompt{font-size:17px}}';root.document.head.appendChild(style);
}
function ensureHost(){
 if(!root.document)return null;let host=root.document.getElementById('stage3Reading');if(host)return host;
 const path=root.document.getElementById('homePath');if(!path)return null;host=root.document.createElement('div');host.className='card stage3-card';host.id='stage3Reading';host.setAttribute('aria-label','進階篇章挑戰');path.appendChild(host);return host;
}
function renderLanding(){
 const host=ensureHost(),state=readState();if(!host)return false;
 const setCount=Array.isArray(root.ManjingoContent&&root.ManjingoContent.passageSets)?root.ManjingoContent.passageSets.length:0;
 host.innerHTML='<div class="stage3-kicker">STAGE 3 · 進階閱讀</div><h2 class="stage3-title">陌生短篇組合題</h2><p class="stage3-lead">先讀同一篇文章，再連續完成文意、推論和翻譯三題。答題期間可隨時返回原文核對。</p><div class="stage3-skill-grid">'+SKILLS.map(skill=>'<div class="stage3-skill"><strong>'+esc(skill.label)+'</strong><span>'+esc(skill.description)+'</span></div>').join('')+'</div><div class="stage3-meta"><span class="stage3-pill">每組 3 題</span><span class="stage3-pill">約 6 分鐘</span><span class="stage3-pill">'+setCount+' 篇輪換</span>'+(state.bestSetScore?'<span class="stage3-pill">最佳 '+state.bestSetScore+' / 3</span>':'')+'</div><button class="action" id="passageSetStart" type="button">開始一組短篇題</button><button class="stage3-option stage3-secondary" id="stage3Start" type="button">原有 6 題混合挑戰</button><div class="stage3-note">題組練習與原有挑戰均會沿用現有掌握度和雲端學習紀錄。</div>';
 const setButton=root.document.getElementById('passageSetStart'),legacyButton=root.document.getElementById('stage3Start');if(setButton)setButton.addEventListener('click',startPassageSet);if(legacyButton)legacyButton.addEventListener('click',startChallenge);return true;
}
function scrollHost(host){try{host.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){try{host.scrollIntoView();}catch(ignore){}}}
function startPassageSet(){
 const content=root.ManjingoContent,state=readState(),built=buildPassageSet(content&&content.passageSets,content&&content.questions,state.setCursor),host=ensureHost();if(!host)return false;
 if(!built.passageSet||!built.questions.length){host.innerHTML='<div class="stage3-kicker">STAGE 3 · 進階閱讀</div><h2 class="stage3-title">陌生短篇組合題</h2><p class="stage3-lead">題組資料尚未載入，請重新整理頁面後再試。</p>';return false;}
 writeState({...state,setCursor:built.nextCursor,setRuns:state.setRuns+1});session={mode:'passage-set',passageSet:built.passageSet,questions:built.questions,index:0,attempts:[],answered:false};renderQuestion();scrollHost(host);return true;
}
function startChallenge(){
 const content=root.ManjingoContent,state=readState(),built=buildChallenge(content&&content.questions,state.cursors,2),host=ensureHost();if(!host)return false;
 if(!built.questions.length){host.innerHTML='<div class="stage3-kicker">STAGE 3 · 進階閱讀</div><h2 class="stage3-title">篇章挑戰</h2><p class="stage3-lead">進階題庫尚未載入，請重新整理頁面後再試。</p>';return false;}
 writeState({...state,cursors:built.nextCursors,runs:state.runs+1});session={mode:'mixed',passageSet:null,questions:built.questions,index:0,attempts:[],answered:false};renderQuestion();scrollHost(host);return true;
}
function renderQuestion(){
 const host=ensureHost();if(!host||!session)return false;if(session.index>=session.questions.length){renderSummary();return true;}
 const question=session.questions[session.index],meta=skillMeta(skillId(question)),position=session.index+1,total=session.questions.length,percent=Math.round(position/total*100),set=session.passageSet,passage=set&&set.passageText||question.passageText||'',title=set&&set.title||'閱讀材料',source=set&&set.source||'',prompt=question.prompt||String(question.q||'').replace(/^【閱讀材料】[\s\S]*?\n\n問題：/,'');session.answered=false;questionStartedAt=Date.now();
 host.innerHTML='<div class="stage3-progress"><strong>'+position+' / '+total+' · '+esc(meta.label)+'</strong><div class="stage3-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><i style="width:'+percent+'%"></i></div></div><details class="stage3-passage" open><summary>'+esc(title)+(source?'<span class="stage3-source">'+esc(source)+'</span>':'')+'</summary><div>'+highlightedPassage(passage,question.targetText)+'</div></details><div class="stage3-prompt">'+esc(prompt)+'</div><div id="stage3Options">'+(question.type==='choice'&&Array.isArray(question.o)?question.o:[]).map((option,index)=>'<button class="stage3-option" type="button" data-stage3-option="'+index+'">'+esc(option)+'</button>').join('')+'</div><div id="stage3Feedback" aria-live="polite"></div>';
 if(question.type==='reorder'){const reorder=root.ManjingoReorderQuestionV1,options=root.document.getElementById('stage3Options');if(!reorder||typeof reorder.mount!=='function'||!reorder.mount(options,{...question,passageText:null},answerValue)){if(options)options.innerHTML='<div class="stage3-feedback wrong">排序翻譯元件尚未載入，請重新整理後再試。</div>';return false;}}
 else host.querySelectorAll('[data-stage3-option]').forEach(button=>button.addEventListener('click',()=>answerQuestion(Number(button.getAttribute('data-stage3-option')))));return true;
}
function answerQuestion(optionIndex){
 if(!session||session.answered)return false;const question=session.questions[session.index],options=Array.isArray(question.o)?question.o:[],selected=options[optionIndex];if(selected==null)return false;return answerValue(selected,optionIndex);
}
function answerValue(selected,optionIndex){
 if(!session||session.answered)return false;const question=session.questions[session.index];session.answered=true;const correct=answerCorrect(question,selected),options=Array.isArray(question.o)?question.o:[],buttons=Array.from(ensureHost().querySelectorAll('[data-stage3-option]'));
 buttons.forEach((button,index)=>{button.disabled=true;const value=options[index];if(String(value)===String(question.a))button.classList.add('correct');else if(index===optionIndex&&!correct)button.classList.add('wrong');});
 session.attempts.push({questionId:String(question.id),skillId:skillId(question),correct,prompt:String(question.q||''),modelAnswer:answerModel(question),explanation:String(question.explanation||'')});recordLocal(question,correct,selected);refreshPlayerStatus();void recordCloud(question,correct,selected);
 const feedback=root.document.getElementById('stage3Feedback'),answerNote=!correct&&question.type==='reorder'?'<br>參考譯文：'+esc(answerModel(question)):'';if(feedback)feedback.innerHTML='<div class="stage3-feedback '+(correct?'correct':'wrong')+'">'+(correct?'答對了。':'這題未答對。')+answerNote+' '+esc(question.explanation||'')+'</div><button class="action stage3-next" id="stage3Next" type="button">'+(session.index+1>=session.questions.length?'查看能力表現':'下一題')+'</button>';
 const next=root.document.getElementById('stage3Next');if(next)next.addEventListener('click',()=>{session.index+=1;renderQuestion();});return correct;
}
function renderSummary(){
 const host=ensureHost();if(!host||!session)return false;const completed=session,summary=summarizeResults(completed.attempts),state=readState(),setMode=completed.mode==='passage-set',nextState=setMode?{...state,bestSetScore:Math.max(state.bestSetScore,summary.correct)}:{...state,bestScore:Math.max(state.bestScore,summary.correct)},wrong=completed.attempts.filter(attempt=>!attempt.correct);writeState(nextState);
 host.innerHTML='<div class="stage3-kicker">STAGE 3 · 本輪完成</div><h2 class="stage3-title">'+(setMode?esc(completed.passageSet.title)+' · 題組結果':'篇章挑戰結果')+'</h2><div class="stage3-summary-score">'+summary.correct+' / '+summary.total+'</div><div class="stage3-summary-sub">整體正確率 '+summary.accuracy+'%</div>'+summary.rows.filter(row=>row.total>0).map(row=>{const meta=skillMeta(row.skillId);return'<div class="stage3-result"><strong>'+esc(row.label)+'</strong><span>'+row.correct+' / '+row.total+'</span><small>'+esc(meta.description)+' · '+row.accuracy+'%</small></div>';}).join('')+(wrong.length?'<div class="stage3-kicker" style="margin-top:14px">需要重看</div>'+wrong.map(attempt=>'<div class="stage3-review"><strong>'+esc(attempt.prompt)+'</strong><span>'+esc(attempt.modelAnswer?('參考答案：'+attempt.modelAnswer+'。 '):'')+esc(attempt.explanation)+'</span></div>').join(''):'<div class="stage3-feedback correct">三項能力全部答對，可以進入下一篇。</div>')+'<button class="action" id="stage3Retry" type="button">'+(setMode?'挑戰下一篇':'再挑戰一次')+'</button><button class="stage3-option" id="stage3Back" type="button">返回學習路徑</button>';
 const retry=root.document.getElementById('stage3Retry'),back=root.document.getElementById('stage3Back');if(retry)retry.addEventListener('click',setMode?startPassageSet:startChallenge);if(back)back.addEventListener('click',()=>{session=null;renderLanding();const target=root.document.getElementById('learningPath');if(target)try{target.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){target.scrollIntoView();}});return true;
}
function install(){installStyle();return renderLanding();}

return{STORAGE_KEY,SKILLS,skillId,isStage3Question,challengeQuestions,buildChallenge,validPassageSet,buildPassageSet,highlightedPassage,answerCorrect,summarizeResults,install,renderLanding,startPassageSet,startChallenge};
});
