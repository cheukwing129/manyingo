const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const reorder=require('../public/reorder-question.js');
const verification=require('../public/answer-verification-v1.js');
const curriculum=require('../public/curriculum-v1.js');

const root=path.join(__dirname,'..');
function pack(){const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'public','question-pack-translation-order-01.js'),'utf8'),context);return context.window.ManjingoQuestionPackTranslationOrder01}
function normalize(value){return String(value||'').replace(/[\s，。！？；：「」『』、,.!?;:]/g,'')}

class FakeNode{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attributes={};this.className='';this.textContent='';this.disabled=false;this.ownerDocument=null}
 append(...nodes){for(const node of nodes)this.appendChild(node)}
 appendChild(node){this.children.push(node);return node}
 set innerHTML(value){if(value==='')this.children=[]}
 get innerHTML(){return''}
 setAttribute(name,value){this.attributes[name]=String(value)}
}
function fakeDocument(){const doc={head:new FakeNode('head'),createElement(tag){const node=new FakeNode(tag);node.ownerDocument=doc;return node},getElementById(){return null}};doc.head.ownerDocument=doc;return doc}

test('translation-order pack has twelve balanced source-aware production questions',()=>{
 const questions=pack().questions;
 assert.equal(questions.length,12);
 assert.equal(new Set(questions.map(q=>q.sourceTextId)).size,11);
 assert.equal(new Set(questions.map(q=>q.sourceSentenceId)).size,12);
 const tiers=questions.reduce((counts,q)=>(counts[q.difficultyTier]=(counts[q.difficultyTier]||0)+1,counts),{});
 assert.deepEqual(tiers,{foundation:4,application:4,transfer:4});
 for(const q of questions){
  assert.equal(q.type,'reorder',q.id);
  assert.equal(q.reorderMode,'select-and-order',q.id);
  assert.equal(reorder.valid(q),true,q.id);
  assert.equal(q.requiredCount,q.answerOrder.length,q.id);
  assert.ok(q.fragments.length>q.requiredCount,q.id);
  assert.ok(q.fragments.length-q.requiredCount>=2&&q.fragments.length-q.requiredCount<=4,`${q.id}: needs 2-4 distractors`);
  assert.equal(new Set(q.fragments.map(item=>item.id)).size,q.fragments.length,`${q.id}: fragment ids`);
  assert.equal(new Set(q.fragments.map(item=>item.text)).size,q.fragments.length,`${q.id}: fragment text`);
  assert.ok(normalize(q.passageText).includes(normalize(q.targetText)),`${q.id}: target must occur in passage`);
  assert.ok(normalize(q.q).includes(normalize(q.targetText)),`${q.id}: prompt must identify target`);
  assert.ok(q.explanation.length>=30,`${q.id}: explanation`);
  assert.ok(q.skillIds.includes('trans.reorder'),q.id);
  for(const skillId of q.skillIds)assert.ok(curriculum.skill(skillId),`${q.id}: ${skillId}`);
 }
});

test('client and server accept the ordered subset while rejecting distractors and malformed submissions',()=>{
 const q=pack().questions[0],correct=q.answerOrder.join('|'),wrong=[...q.answerOrder.slice(0,-1),'g'].join('|');
 assert.equal(reorder.requiredCount(q),4);
 assert.equal(reorder.isCorrect(q,correct),true);
 assert.equal(reorder.isCorrect(q,wrong),false);
 assert.equal(verification.verify(q,correct).isCorrect,true);
 assert.equal(verification.verify(q,wrong).isCorrect,false);
 assert.throws(()=>verification.verify(q,'a|b|c'),error=>error.status===400&&/required number/.test(error.message));
 assert.throws(()=>verification.verify(q,'a|b|c|c'),error=>error.status===400&&/unique/.test(error.message));
});

test('select-and-order UI exposes context, fixed selection count, removable chips and keyboard buttons',()=>{
 const q=pack().questions[0],doc=fakeDocument(),host=new FakeNode('div');host.ownerDocument=doc;let submitted=null;
 assert.equal(reorder.mount(host,q,value=>{submitted=value}),true);
 const source=host.children.find(node=>node.className==='translation-order-source'),answer=host.children.find(node=>node.className==='reorder-answer'),status=host.children.find(node=>node.className==='reorder-status'),bank=host.children.find(node=>node.className==='reorder-bank'),controls=host.children.find(node=>node.className==='reorder-controls');
 assert.ok(source.children.some(node=>node.textContent===q.passageText));
 assert.equal(answer.dataset.placeholder,'依次選出 4 個詞組組成譯句');
 assert.equal(status.textContent,'已選 0 / 4 個詞組');
 for(const id of q.answerOrder){const text=q.fragments.find(item=>item.id===id).text,button=bank.children.find(node=>node.textContent===text);assert.equal(button.tagName,'BUTTON');button.onclick()}
 assert.equal(status.textContent,'已選 4 / 4 個詞組');
 assert.equal(controls.children[1].disabled,false);
 assert.equal(bank.children.filter(node=>!q.answerOrder.includes(q.fragments.find(item=>item.text===node.textContent).id)).every(node=>node.disabled),true);
 controls.children[1].onclick();
 assert.equal(submitted,q.answerOrder.join('|'));
});

test('runtime and persistence paths retain translation-order metadata without exposing answer flags',()=>{
 const importer=fs.readFileSync(path.join(root,'scripts','import_to_firestore.js'),'utf8'),serverBuilder=fs.readFileSync(path.join(root,'scripts','build_server_question_index.cjs'),'utf8'),runtime=fs.readFileSync(path.join(root,'public','reorder-question.js'),'utf8');
 assert.match(importer,/reorderMode:question\.reorderMode/);
 assert.match(importer,/requiredCount:Number\.isInteger/);
 assert.match(importer,/targetText:question\.targetText/);
 assert.match(serverBuilder,/reorderMode:question\.reorderMode/);
 assert.match(runtime,/sourceText\.textContent=String\(question\.passageText\)/);
 assert.doesNotMatch(JSON.stringify(pack().questions),/isDistractor|distractorRationale/);
});
