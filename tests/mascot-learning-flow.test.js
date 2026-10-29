const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const summary=require('../public/session-summary.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const exists=p=>fs.existsSync(path.join(__dirname,'..',p));

test('answer feedback maps Little Ink Spirit through the shared runtime',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(read('public/home-shell.js'),/mascot-runtime\.js[\s\S]*feedback-ui\.js/);
  assert.match(source,/function mascotFeedbackState\(isCorrect\)/);
  assert.match(source,/runtime\.asset\(state\)/);
  assert.match(source,/mascot-state-'\+state/);
  assert.match(source,/抓到重點了！/);
  assert.match(source,/一起看清這一步。/);
  assert.match(source,/moling-correct/);
  assert.match(source,/moling-encourage/);
  assert.doesNotMatch(source,/img\.src='\.\/mascot-moling\.svg'/);
  assert.match(source,/prefers-reduced-motion:reduce/);
});

test('completion summary maps results to canonical mascot states',()=>{
  assert.equal(summary.celebrationCopy({answered:10,wrong:0},100),'全對！太棒了！');
  assert.equal(summary.celebrationCopy({answered:10,wrong:1},90),'很穩，繼續保持！');
  assert.equal(summary.celebrationCopy({answered:10,wrong:3},70),'完成了，錯題也會變成下一步。');
  assert.equal(summary.mascotState({answered:0,unlockedStages:[]},0),'neutral');
  assert.equal(summary.mascotState({answered:10,unlockedStages:[]},90),'happy');
  assert.equal(summary.mascotState({answered:10,unlockedStages:[]},100),'celebrate');
  assert.equal(summary.mascotState({answered:10,unlockedStages:['第二階段']},80),'celebrate');
  assert.equal(summary.mascotAsset('happy'),'./mascot/moling-happy.svg');
  assert.equal(summary.mascotAsset('unknown'),'./mascot/moling-neutral.svg');
});

test('completion markup uses state-specific mascot asset instead of the legacy filename',()=>{
  const perfect=summary.markup({page:'home',answered:10,correct:10,xp:80,masteryDelta:12,resolved:[],unlockedStages:[]});
  assert.match(perfect,/mascot-state-celebrate/);
  assert.match(perfect,/\.\/mascot\/moling-celebrate\.svg/);
  assert.doesNotMatch(perfect,/src="\.\/mascot-moling\.svg"/);
  const good=summary.markup({page:'home',answered:10,correct:9,xp:70,masteryDelta:8,resolved:[],unlockedStages:[]});
  assert.match(good,/mascot-state-happy/);
  assert.match(good,/\.\/mascot\/moling-happy\.svg/);
});

test('all six v1 mascot state assets exist while candidate and production artwork can graduate from the baseline',()=>{
  const baselineDerived=new Set(['neutral']);
  ['neutral','happy','celebrate','encouraging','thinking','determined'].forEach(state=>{
    const file=`public/mascot/moling-${state}.svg`;
    assert.equal(exists(file),true,file+' should exist');
    const svg=read(file);
    assert.match(svg,/viewBox="0 0 215 320"/);
    if(baselineDerived.has(state))assert.match(svg,/\.\.\/mascot-moling\.svg/);
  });
  const celebrate=read('public/mascot/moling-celebrate.svg');
  assert.doesNotMatch(celebrate,/\.\.\/mascot-moling\.svg/);
  assert.match(celebrate,/<image\b/);
  assert.match(celebrate,/data:image\/webp;base64,/);
  assert.match(celebrate,/celebrate 狀態 P5 production artwork v4/);
  const happy=read('public/mascot/moling-happy.svg');
  assert.doesNotMatch(happy,/\.\.\/mascot-moling\.svg/);
  assert.match(happy,/<image\b/);
  assert.match(happy,/data:image\/webp;base64,/);
  assert.match(happy,/happy P1 production artwork v3/);
  const thinking=read('public/mascot/moling-thinking.svg');
  assert.doesNotMatch(thinking,/\.\.\/mascot-moling\.svg/);
  assert.match(thinking,/<image\b/);
  assert.match(thinking,/data:image\/webp;base64,/);
  assert.match(thinking,/thinking production artwork v2/);
  const determined=read('public/mascot/moling-determined.svg');
  assert.doesNotMatch(determined,/\.\.\/mascot-moling\.svg/);
  assert.match(determined,/<image\b/);
  assert.match(determined,/data:image\/webp;base64,/);
  assert.match(determined,/determined 狀態 P4 production artwork v2/);
  const encouraging=read('public/mascot/moling-encouraging.svg');
  assert.doesNotMatch(encouraging,/\.\.\/mascot-moling\.svg/);
  assert.match(encouraging,/<image\b/);
  assert.match(encouraging,/data:image\/webp;base64,/);
  assert.match(encouraging,/encouraging production artwork v4/);
});

test('thinking and determined states are connected to semantic learning UI',()=>{
  const css=read('public/app-ui.css');
  const runtime=read('public/mascot-runtime.js');
  assert.match(css,/body\.app-nav-ready>\.title[^}]*manyingo-logo-classic\.webp/);
  assert.match(css,/html\[data-ui-theme="ink"\] body\.app-nav-ready>\.title[^}]*manyingo-logo-ink\.webp/);
  assert.match(css,/\.player-status \.streak::before[^}]*moling-determined\.svg/);
  assert.match(css,/#lessonApp \.lesson-step>\.lesson-icon\.mascot-thinking[^}]*moling-thinking\.svg/);
  assert.match(runtime,/semanticThinkingIcon/);
  assert.match(runtime,/mascot-thinking/);
  assert.match(read('public/mascot/moling-thinking.svg'),/thinking production artwork v2/);
  assert.match(read('public/mascot/moling-determined.svg'),/determined 狀態/);
});

test('encouraging state avoids punitive reaction language and motion',()=>{
  const encouraging=read('public/mascot/moling-encouraging.svg');
  const feedback=read('public/feedback-ui.js');
  assert.match(encouraging,/陪伴與支持/);
  assert.match(encouraging,/不傳達責備或失望/);
  assert.doesNotMatch(encouraging,/(眼淚|紅叉|搖頭|皺眉)/);
  assert.doesNotMatch(feedback,/moling-think/);
  assert.doesNotMatch(feedback,/shake/i);
});

test('mascot reactions stay decorative and do not replace learning controls',()=>{
  const feedback=read('public/feedback-ui.js');
  const summarySource=read('public/session-summary.js');
  assert.match(feedback,/aria-hidden','true'/);
  assert.match(feedback,/feedback-next/);
  assert.match(summarySource,/session-summary-action/);
  assert.match(summarySource,/aria-label="小墨靈：/);
});
