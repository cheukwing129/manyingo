const test=require('node:test');
const assert=require('node:assert/strict');

const ux=require('../public/ux-runtime.js');
const theme=require('../public/theme-runtime.js');

test('UX status text maps to clear presentation states',()=>{
  assert.equal(ux.classifyStatus('☁️ 已同步學習進度'),'cloud');
  assert.equal(ux.classifyStatus('📱 本機學習模式'),'local');
  assert.equal(ux.classifyStatus('📱 今日學習完成'),'complete');
});

test('daily XP parser supports homepage progress text',()=>{
  assert.deepEqual(ux.parseDaily('12 / 20 XP'),{current:12,target:20});
  assert.deepEqual(ux.parseDaily('0 / 20 XP'),{current:0,target:20});
  assert.deepEqual(ux.parseDaily('準備中'),{current:0,target:0});
});

test('question progress parser recognizes current and total counts',()=>{
  const quiz={querySelector(selector){
    if(selector!=='.category')return null;
    return{textContent:'複習 · 3 / 10'};
  }};
  assert.deepEqual(ux.questionProgress(quiz),{current:3,total:10});
  assert.equal(ux.questionProgress({querySelector(){return null}}),null);
});

test('theme runtime exposes the homepage UX loader',()=>{
  assert.equal(typeof theme.loadUxRuntime,'function');
  assert.equal(theme.loadUxRuntime(),false);
});
