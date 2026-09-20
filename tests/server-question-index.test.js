const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog.js');
const {build}=require('../scripts/build_server_question_index.cjs');

const root=path.join(__dirname,'..');

test('generated server question index matches every reviewed question',()=>{
 const context={Map};vm.createContext(context);vm.runInContext(build(),context);
 const index=context.ManjingoServerQuestionIndex,catalog=loadReviewedCatalog(root);
 assert.equal(index.count,catalog.questions.length);
 for(const question of catalog.questions){
  const bundled=index.get(question.id);
  assert.ok(bundled,`missing ${question.id}`);
  assert.equal(bundled.data.kpId,question.kpId);
  assert.equal(bundled.data.answer,String(question.a==null?'':question.a));
  assert.deepEqual(Array.from(bundled.data.skillIds),Array.from(question.skillIds||[],String));
  assert.equal(bundled.data.sourceScope,question.sourceScope);
 }
});

test('adaptive comparison prompts cannot masquerade as single-source sentences',()=>{
 const catalog=loadReviewedCatalog(root),byId=new Map(catalog.questions.map(question=>[question.id,question]));
 const counts={};for(const question of catalog.questions)counts[question.sourceScope]=(counts[question.sourceScope]||0)+1;
 assert.deepEqual(counts,{sentence:499,passage:41,'cross-source':40,concept:27});
 for(const id of ['ad1q003','ad1q006','ad1q009','ad1q012','ad1q018','ad1q027','ad2q001','ad2q003','ad2q006','ad2q007','ad2q008','ad2q009','ad2q010','ad2q011','ad2q012','ad2q013','ad2q014','ad2q015','ad2q016','ad2q019','ad2q021','ad2q024','ad2q026','ad2q027','ad3q001','ad3q003','ad3q004','ad3q005','ad3q006']){const question=byId.get(id);assert.equal(question.sourceScope,'cross-source',id);assert.equal(question.sourceSentenceId,null,id);}
 const scenario=byId.get('ad2q025');assert.equal(scenario.sourceScope,'concept');assert.equal(scenario.sourceSentenceId,null);
 const quotation=byId.get('ad3q002');assert.equal(quotation.sourceTextId,'yueyanglou');assert.equal(quotation.sourceScope,'sentence');assert.equal(quotation.sourceSentenceId,'sentence:yueyanglou:xianyou-houle');
});

test('cross-sentence prompts retain passage-level provenance',()=>{
 const catalog=loadReviewedCatalog(root),byId=new Map(catalog.questions.map(question=>[question.id,question]));
 for(const id of ['p2q012','p2q023','p2q038','p2q044','p2q056','p2q091','lpq055','cap1q018']){
  const question=byId.get(id);
  assert.equal(question.sourceScope,'passage',id);
  assert.equal(question.sourceSentenceId,null,id);
 }
 assert.equal(byId.get('lpq055').sourceTextId,'shengyouhuan');
});

test('worker prefers bundled reviewed metadata and retains Firestore fallback',()=>{
 const worker=fs.readFileSync(path.join(root,'public','_worker.js'),'utf8');
 assert.match(worker,/import '\.\/server-question-index\.js'/);
 assert.match(worker,/SERVER_QUESTION_INDEX&&SERVER_QUESTION_INDEX\.get\(questionId\)/);
 assert.match(worker,/if\(bundled\)return bundled/);
 assert.match(worker,/getDocument\(env,token,`questions\/\$\{questionId\}`\)/);
});
