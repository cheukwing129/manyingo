const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const summary=require('../public/session-summary.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('daily session summary keeps initial mistakes in results instead of calling them confirmed weaknesses',()=>{
 const data=summary.model({page:'home',answered:10,correct:8,xp:64,masteryDelta:12,resolved:['kp_virtual_yi'],unlockedStages:[],persistentWeakness:false});
 assert.equal(data.wrong,2);
 assert.equal(data.action.href,'#masteryDashboard');
 assert.equal(data.action.label,'查看學習成果');
 const html=summary.markup({page:'home',answered:10,correct:8,xp:64,masteryDelta:12,resolved:['kp_virtual_yi'],unlockedStages:[],persistentWeakness:false});
 assert.match(html,/session-summary done/);
 assert.match(html,/8 \/ 10/);
 assert.match(html,/\+64/);
 assert.match(html,/掌握度淨變化/);
 assert.match(html,/已修正：kp_virtual_yi/);
});

test('persistent wrong evidence takes priority and routes to learning focus',()=>{
 const data=summary.model({page:'home',answered:10,correct:8,xp:64,masteryDelta:4,resolved:[],unlockedStages:['句式'],persistentWeakness:true});
 assert.equal(data.action.href,'#weaknessPanel');
 assert.equal(data.action.label,'查看學習重點');
});

test('perfect daily session prioritizes newly unlocked learning path content',()=>{
 const data=summary.model({page:'home',answered:10,correct:10,xp:80,masteryDelta:20,resolved:[],unlockedStages:['句式']});
 assert.equal(data.wrong,0);
 assert.equal(data.action.href,'#learningPath');
 assert.equal(data.action.label,'看看新解鎖內容');
 assert.match(summary.markup({page:'home',answered:10,correct:10,xp:80,masteryDelta:20,resolved:[],unlockedStages:['句式']}),/新解鎖：句式/);
});

test('persistent signal detector only escalates repeated evidence from wrong items',()=>{
 const previous=global.ManjingoLocalLearning;
 global.ManjingoLocalLearning={
  getKnowledge(id){return id==='early'?{attempts:1,wrongCount:1,misconceptions:{m:{count:1}}}:{attempts:3,wrongCount:2,misconceptions:{m:{count:2}}}},
  getRemediationStatus(){return{needsRemediation:false}}
 };
 assert.equal(summary.persistentWrongSignal(['early']),false);
 assert.equal(summary.persistentWrongSignal(['persistent']),true);
 global.ManjingoLocalLearning=previous;
});

test('home completion actions stay hash-only while lesson completion keeps an index route',()=>{
 const home=summary.model({page:'home',answered:10,correct:10,unlockedStages:[],persistentWeakness:false});
 assert.equal(home.action.href,'#masteryDashboard');
 const lesson=summary.model({page:'lesson',targeted:true,answered:5,correct:5,unlockedStages:[]});
 assert.equal(lesson.action.href,'./index.html#masteryDashboard');
});

test('targeted remedial and reteach lesson completion return to learning results',()=>{
 const targeted=summary.model({page:'lesson',targeted:true,remedial:false,reteach:false,kpId:'kp_virtual_yi',kpLabel:'以',answered:5,correct:4,xp:32,masteryDelta:9,unlockedStages:[]});
 assert.equal(targeted.title,'弱點補強完成');
 assert.equal(targeted.action.href,'./index.html#masteryDashboard');
 assert.match(summary.markup({page:'lesson',targeted:true,kpId:'kp_virtual_yi',kpLabel:'以',answered:5,correct:4,xp:32,masteryDelta:9,unlockedStages:[]}),/「以」掌握度提升 9/);
 const remedial=summary.model({page:'lesson',targeted:true,remedial:true,answered:2,correct:2,xp:16,masteryDelta:4,unlockedStages:[]});
 assert.equal(remedial.title,'補救驗證完成');
 assert.equal(remedial.action.label,'查看學習成果');
 const reteach=summary.model({page:'lesson',targeted:true,reteach:true,answered:3,correct:2,xp:16,masteryDelta:3,unlockedStages:[]});
 assert.equal(reteach.title,'概念重教完成');
 assert.equal(reteach.action.href,'./index.html#masteryDashboard');
});

test('session summary counts provisional XP once and accepts delayed confirmed XP without duplicating the answer',()=>{
 global.ManjingoContent={questions:[{q:'測試題',kpId:'kp_test',baseXp:8}],knowledgePoints:[]};
 const scope={querySelector:()=>({textContent:'測試題'})};
 const feedback={
  classList:{contains:name=>name==='correct'},
  dataset:{},
  textContent:'答對了！',
  closest:()=>scope,
  parentElement:scope
 };
 summary.reset({page:'home'});
 assert.equal(summary.countFeedback(feedback),true);
 let state=summary.snapshot();
 assert.equal(state.answered,1);
 assert.equal(state.correct,1);
 assert.equal(state.xp,8);
 feedback.textContent='答對了！ 本題獲得：10 XP';
 assert.equal(summary.countFeedback(feedback),true);
 state=summary.snapshot();
 assert.equal(state.answered,1);
 assert.equal(state.correct,1);
 assert.equal(state.xp,10);
 delete global.ManjingoContent;
});

test('session summary is loaded after answer feedback and preserves homepage completion status',()=>{
 const catalog=read('public/content-catalog.js'),runtime=read('public/session-summary.js'),css=read('public/app-ui.css');
 assert.match(catalog,/feedback-ui\.js.*session-summary\.js/);
 assert.match(runtime,/📱 今日學習完成/);
 assert.match(runtime,/class="session-summary done"/);
 assert.match(runtime,/自適應補救/);
 assert.match(runtime,/概念重教/);
 assert.match(runtime,/startConceptReteach/);
 assert.match(css,/Learning session completion/);
 assert.match(css,/\.session-summary-metrics/);
 assert.match(css,/\.session-summary-impact/);
});
