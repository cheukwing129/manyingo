const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const reorder=require('../public/reorder-question.js');
const verification=require('../public/answer-verification-v1.js');
const stage3=require('../public/stage3-reading.js');
const curriculum=require('../public/curriculum-v1.js');

const root=path.join(__dirname,'..');
function pack(){const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'public','question-pack-passage-set-01.js'),'utf8'),context);return context.window.ManjingoQuestionPackPassageSet01;}
function normalize(value){return String(value||'').replace(/[\s，。！？；：「」『』、,.!?;:]/g,'');}

test('pilot contains six unseen passage sets with three linked questions each',()=>{
 const data=pack();assert.equal(data.passageSets.length,6);assert.equal(data.questions.length,18);
 assert.equal(new Set(data.passageSets.map(set=>set.sourceTextId)).size,6);
 assert.equal(new Set(data.questions.map(q=>q.id)).size,18);
 assert.equal(new Set(data.questions.map(q=>q.sourceSentenceId)).size,18);
 for(const set of data.passageSets){
  assert.equal(set.sourceKind,'classical-canon',set.id);assert.ok(set.passageText.length>=100,set.id);assert.equal(set.questionIds.length,3,set.id);
  const questions=Array.from(set.questionIds,id=>data.questions.find(q=>q.id===id));assert.equal(questions.every(Boolean),true,set.id);assert.deepEqual(Array.from(questions,q=>q.type),['choice','choice','reorder'],set.id);
  assert.equal(questions.every(q=>q.passageSetId===set.id&&q.sourceTextId===set.sourceTextId&&q.sourceScope==='passage'),true,set.id);
  assert.equal(stage3.validPassageSet(set,data.questions),true,set.id);
 }
});

test('each passage set measures integration, reasoning and productive translation',()=>{
 const data=pack();
 for(const set of data.passageSets){
  const questions=set.questionIds.map(id=>data.questions.find(q=>q.id===id));
  assert.ok(questions[0].skillIds.includes('transfer.short-passage'),set.id);
  assert.ok(questions[1].skillIds.includes('read.argumentation'),set.id);
  assert.ok(questions[2].skillIds.includes('transfer.mixed'),set.id);
  assert.ok(questions[2].skillIds.includes('trans.reorder'),set.id);
  for(const question of questions)for(const skillId of question.skillIds)assert.ok(curriculum.skill(skillId),`${question.id}: ${skillId}`);
 }
});

test('passage-set translation tasks are unambiguous ordered subsets with three distractors',()=>{
 const data=pack(),bySet=new Map(data.passageSets.map(set=>[set.id,set]));
 for(const question of data.questions.filter(q=>q.type==='reorder')){
  const set=bySet.get(question.passageSetId);assert.equal(reorder.valid(question),true,question.id);
  assert.equal(question.fragments.length-question.requiredCount,3,question.id);
  assert.ok(normalize(set.passageText).includes(normalize(question.targetText)),`${question.id}: target occurs in passage`);
  assert.ok(question.modelAnswer.length>=18,question.id);assert.ok(question.explanation.length>=28,question.id);
  assert.equal(reorder.isCorrect(question,question.answerOrder.join('|')),true,question.id);
  assert.equal(verification.verify(question,question.answerOrder.join('|')).isCorrect,true,`${question.id}: server verification`);
 }
});

test('passage-set rotation presents all six texts before repeating',()=>{
 const data=pack(),seen=[];let cursor=0;
 for(let i=0;i<6;i+=1){const built=stage3.buildPassageSet(data.passageSets,data.questions,cursor);seen.push(built.passageSet.id);assert.equal(built.questions.length,3);cursor=built.nextCursor;}
 assert.equal(new Set(seen).size,6);assert.equal(cursor,0);
});

test('target highlighting escapes source text and marks only the requested sentence',()=>{
 const html=stage3.highlightedPassage('甲<乙>丙，乙丙。','乙丙');
 assert.match(html,/甲&lt;乙&gt;丙，<mark class="stage3-target">乙丙<\/mark>。/);
 assert.equal((html.match(/stage3-target/g)||[]).length,1);
});
