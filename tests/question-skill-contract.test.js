const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const curriculum=require('../public/curriculum-v1.js');
const metadata=require('../public/question-metadata-v1.js');
const contract=require('../public/question-skill-contract.js');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog.js');

test('compiled Firestore catalog preserves the same skill contract used by the planner',()=>{
 const catalog=loadReviewedCatalog(),core=metadata.normalCoreQuestions(catalog.questions);
 let assignments=0;
 for(const question of core){
  assert.equal(question.skillContractVersion,contract.VERSION,`${question.id} missing skill contract version`);
  assert.ok(question.skillIds.length,`${question.id} missing compiled skillIds`);
  for(const skillId of question.skillIds){
   const item=curriculum.skill(skillId);
   if(!item||Number(item.stage)>2)continue;
   assignments+=1;
   assert.equal(contract.resolveCoreSkill(question,question.kpId,skillId,curriculum),skillId,`${question.id} cannot be credited to planned ${skillId}`);
  }
 }
 assert.equal(core.length,470);
 assert.equal(assignments,535);
});

test('versioned question metadata rejects an unrelated client-selected skill',()=>{
 const catalog=loadReviewedCatalog(),question=catalog.questions.find(item=>item.id==='p2q001');
 assert.deepEqual(Array.from(question.skillIds),['lex.context-inference']);
 assert.throws(()=>contract.resolveCoreSkill(question,question.kpId,'fw.zhi',curriculum),error=>error&&error.status===400&&/not valid/.test(error.message));
});

test('legacy unversioned metadata keeps migration fallback during catalog rollout',()=>{
 const question={kpId:'kp_virtual_zhi',skillIds:[]};
 assert.equal(contract.resolveCoreSkill(question,question.kpId,null,curriculum),'fw.zhi');
});

test('Firestore importer writes compiled skill metadata instead of raw pack tags',()=>{
 const importer=fs.readFileSync(path.join(__dirname,'..','scripts','import_to_firestore.js'),'utf8');
 assert.match(importer,/require\('\.\/reviewed_catalog\.js'\)/);
 assert.match(importer,/skillContractVersion:question\.skillContractVersion\|\|null/);
});
