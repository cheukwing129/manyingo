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
 }
});

test('worker prefers bundled reviewed metadata and retains Firestore fallback',()=>{
 const worker=fs.readFileSync(path.join(root,'public','_worker.js'),'utf8');
 assert.match(worker,/import '\.\/server-question-index\.js'/);
 assert.match(worker,/SERVER_QUESTION_INDEX&&SERVER_QUESTION_INDEX\.get\(questionId\)/);
 assert.match(worker,/if\(bundled\)return bundled/);
 assert.match(worker,/getDocument\(env,token,`questions\/\$\{questionId\}`\)/);
});
