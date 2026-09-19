const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

function load(){
  const context={window:{},Set,Array,Object,String,Number,Math,RegExp};
  vm.createContext(context);
  vm.runInContext(read('public/feedback-ui.js'),context);
  return context.window.ManjingoFeedbackUI;
}

test('feedback UI parses teaching content into answer explanation and progress layers',()=>{
  const ui=load();
  const raw='正確答案：因為 為甚麼？「以」在此表示原因。你可能混淆了：把它當成工具義。概念掌握度：42% 掌握度：61% 本題獲得：8 XP 下一步：優先安排複習。';
  assert.equal(ui.parseCorrectAnswer(raw),'因為');
  assert.equal(ui.explanationFromText(raw),'「以」在此表示原因。');
  assert.deepEqual(Array.from(ui.metricLines(raw)),['概念掌握度 42%','掌握度 61%','本題 +8 XP']);
});

test('feedback enhancement is shared, accessible and reacts to answer DOM changes',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(source,/question\.explanation/);
  assert.match(source,/question\.misconception/);
  assert.match(source,/question\.example/);
  assert.match(source,/feedback-result-title/);
  assert.match(source,/feedback-teaching/);
  assert.match(source,/查看學習進度/);
  assert.match(source,/feedback-next/);
  assert.match(source,/aria-live','polite'/);
  assert.match(source,/new MutationObserver/);
});

test('correct answers collapse teaching detail while wrong answers stay expanded',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(source,/isCorrect\?build\('details','feedback-teaching feedback-teaching-collapsed'\):build\('div','feedback-teaching'\)/);
  assert.match(source,/if\(isCorrect\)teaching\.appendChild\(build\('summary','', '查看解說'\)\)/);
  const css=read('public/app-ui.css');
  assert.match(css,/\.feedback-teaching>summary/);
  assert.match(css,/\.feedback-teaching\[open\]>summary:after/);
});

test('learner-facing answer feedback uses skill language instead of internal knowledge-point wording',()=>{
  const source=read('public/feedback-ui.js');
  const home=read('public/index.html');
  assert.match(source,/這項技能會優先安排複習/);
  assert.match(source,/提高這項技能的複習優先度/);
  assert.match(home,/這項技能會優先複習/);
  assert.doesNotMatch(source,/這個知識點/);
  assert.doesNotMatch(home,/這個知識點/);
});

test('homepage answer feedback and local progress complete before cloud persistence starts',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(source,/function instantAnswer\(event\)/);
  assert.match(source,/target\.closest&&target\.closest\('#quiz'\)/);
  assert.match(source,/document\.addEventListener\('click',instantAnswer,true\)/);
  assert.match(source,/feedback\.textContent=correct\?'答對了！':'正確答案：'/);
  assert.match(source,/answerKey\(button\.textContent\)===answerKey\(question\.a\)/);
  const home=read('public/index.html');
  const answer=home.match(/function answer\(box,q,value\)[\s\S]*?\nwindow\.addEventListener/)[0];
  assert.match(answer,/learning\(\)\?learning\(\)\.submit/);
  assert.match(answer,/showLearningFeedback\(box,q,correct,localResult\)/);
  assert.match(answer,/queueCloudAnswer\(q,answerId,value\)/);
  assert.ok(answer.indexOf('showLearningFeedback(box,q,correct,localResult)')<answer.indexOf('queueCloudAnswer(q,answerId,value)'));
  assert.doesNotMatch(answer,/await cloudSubmit/);
});

test('next question becomes actionable synchronously at answer click',()=>{
  const ui=load(),next={disabled:true};
  const scope={querySelector:selector=>selector==='#next'?next:null};
  assert.equal(ui.unlockNextNow(scope),true);
  assert.equal(next.disabled,false,'next question must unlock in the same task as the answer click');
  const source=read('public/feedback-ui.js');
  assert.match(source,/feedback\.textContent=correct\?'答對了！':'正確答案：'\+clean\(question\.a\);\s*unlockNextNow\(scope\)/);
  assert.doesNotMatch(source,/feedback\.textContent=correct\?'答對了！':'正確答案：'\+clean\(question\.a\);\s*unlockNextSoon\(scope\)/);
});

test('deferred unlock remains a safe fallback after the answer handler marks the quiz answered',async()=>{
  const ui=load(),next={disabled:true};
  const scope={dataset:{answered:'1'},querySelector:selector=>selector==='#next'?next:null};
  ui.unlockNextSoon(scope);
  assert.equal(next.disabled,true);
  await Promise.resolve();
  assert.equal(next.disabled,false);
});

test('answered study session keeps next CTA visible independently of cloud progress details',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(source,/instantNextStyle/);
  assert.match(source,/body\.study-focus #quiz\[data-answered="1"\]>#next\{position:fixed/);
  assert.match(source,/bottom:max\(14px,env\(safe-area-inset-bottom,14px\)\)/);
  assert.match(source,/#quiz\[data-answered="1"\]\{padding-bottom:90px!important\}/);
  assert.match(source,/#lessonApp\[data-answered="1"\] #lessonNext\{position:fixed/);
  assert.match(source,/#lessonApp\[data-answered="1"\] \.lesson-content\{padding-bottom:90px!important\}/);
  const progressPos=source.indexOf("summary=build('summary','', '查看學習進度')");
  const unlockPos=source.indexOf('unlockNextNow(scope)');
  assert.ok(unlockPos>=0&&progressPos>=0,'both immediate next and optional progress UI should exist');
});

test('today task owns a synchronous next button and deferred cloud results do not repaint questions',()=>{
  const home=read('public/index.html');
  assert.match(home,/function answerIsCurrent\(box,answerId\)/);
  assert.match(home,/if\(nextButton\)nextButton\.disabled=false;const localResult=/);
  assert.doesNotMatch(home,/nextButton\.disabled=true/);
  assert.match(home,/if\(answerIsCurrent\(box,answerId\)\)showLearningFeedback\(box,q,correct,localResult\)/);
  assert.match(home,/if\(!correct&&isAnswer\)b\.classList\.add\('correct'\)/);
  const flush=home.match(/function scheduleCloudAnswerFlush\(\)[\s\S]*?\nfunction createAnswerId/)[0];
  assert.doesNotMatch(flush,/showLearningFeedback/);
  assert.match(home,/window\.addEventListener\('manjingo:study-mode-exit',scheduleCloudAnswerFlush\)/);
});

test('instant feedback can be enhanced again when cloud progress replaces it',()=>{
  const source=read('public/feedback-ui.js');
  assert.match(source,/feedback\.dataset\.feedbackRendered===raw/);
  assert.match(source,/feedback\.dataset\.feedbackRendered=clean\(feedback\.textContent\)/);
  assert.match(source,/delete feedback\.dataset\.feedbackUi/);
  assert.match(source,/delete feedback\.dataset\.feedbackRendered/);
});

test('catalog loads layered feedback UI on both homepage and lesson flows',()=>{
  const catalog=read('public/content-catalog.js');
  assert.match(catalog,/feedback-ui\.js/);
  const lesson=read('public/lesson.html');
  const home=read('public/index.html');
  assert.match(lesson,/content-catalog\.js/);
  assert.match(home,/content-catalog\.js/);
});

test('shared UI foundation styles result teaching progress and next-step hierarchy',()=>{
  const css=read('public/app-ui.css');
  assert.match(css,/\.feedback-result/);
  assert.match(css,/\.feedback-teaching/);
  assert.match(css,/\.feedback-progress/);
  assert.match(css,/\.feedback-next/);
  assert.match(css,/\.feedback-ui\.correct/);
  assert.match(css,/\.feedback-ui\.wrong/);
});
