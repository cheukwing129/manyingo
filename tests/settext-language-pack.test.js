const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const childProcess=require('node:child_process');

const root=path.join(__dirname,'..');
const curriculum=require('../public/curriculum-v1.js');
const metadata=require('../public/question-metadata-v1.js');
const read=file=>fs.readFileSync(path.join(root,'public',file),'utf8');

function loadPacks(){
 const context={window:{},Array,Object,Number,String,Math,Set,Map};vm.createContext(context);
 for(const file of ['question-pack-settext-language-01.js','question-pack-settext-language-02.js'])vm.runInContext(read(file),context,{filename:file});
 return [context.window.ManjingoQuestionPackSetTextLanguage01,context.window.ManjingoQuestionPackSetTextLanguage02];
}
function loadCatalog(){
 const context={window:{},Array,Object,Number,String,Math,Set,Map};vm.createContext(context);
 for(const file of ['question-pack-02.js','question-pack-03.js','question-pack-lesson.js','question-pack-capacity-01.js','question-pack-transfer-01.js','question-pack-transfer-03.js','question-pack-transfer-04.js','question-pack-transfer-05.js','question-pack-transfer-06.js','question-pack-transfer-07.js','question-pack-settext-language-01.js','question-pack-settext-language-02.js','content-catalog.js'])vm.runInContext(read(file),context,{filename:file});
 return context.window.ManjingoContent;
}

const DSE_GROUPS=[
 'lunyu','yuwosuoyu','xiaoyaoyou','quanxue','lianpo-linxiangru','chushibiao',
 'shishuo','shidexishan','yueyanglou','liuguolun','tangshi-sanshou','songci-sanshou'
];
const TARGETED_02_INITIAL=[
 'fw.er','fw.qi','fw.wei','fw.zhe','lex.causative','lex.intentional','lex.semantic-role','lex.tongjia',
 'read.actor-tracking','read.context-clues','read.referent-tracking','read.sentence-core',
 'syn.ellipsis-object','syn.ellipsis-subject','syn.negative-patterns',
 'trans.ancient-modern','trans.integrated','trans.supplement'
];
const CLOSING_02=['fw.nai','fw.qie','fw.ye','fw.yan','fw.ze','syn.fixed-patterns'].sort();
const TARGETED_02=[...TARGETED_02_INITIAL,...CLOSING_02].sort();
const INTENTIONALLY_UNFAMILIAR=['transfer.micro-passage','transfer.sentence-pair','transfer.single-sentence'].sort();

test('current DSE prescribed-text registry contains the twelve canonical groups',()=>{
 assert.deepEqual([...metadata.DSE_SET_TEXT_IDS],DSE_GROUPS);
 assert.equal(metadata.isDseSetTextId('lianpo'),true);
 assert.equal(metadata.canonicalDseSetTextId('lianpo'),'lianpo-linxiangru');
 assert.equal(metadata.isDseSetTextId('xunzi-quanxue-stage3'),true);
 assert.equal(metadata.isDseSetTextId('taohuayuan'),false);
});

test('first language pack keeps three questions at three tiers for every prescribed group',()=>{
 const [pack]=loadPacks();
 assert.equal(pack.kind,'set-text-language');
 assert.equal(pack.questions.length,36);
 assert.equal(new Set(pack.questions.map(q=>q.id)).size,36);
 assert.equal(pack.questions.every(q=>/^stl1q\d{3}$/.test(q.id)),true);
 const bySource=new Map(DSE_GROUPS.map(id=>[id,[]]));
 for(const q of pack.questions){assert.ok(bySource.has(q.sourceTextId),`unexpected prescribed group ${q.sourceTextId}`);bySource.get(q.sourceTextId).push(q);}
 for(const [sourceId,rows] of bySource){
  assert.equal(rows.length,3,`${sourceId} should contribute three language questions`);
  assert.deepEqual([...new Set(rows.map(q=>q.difficultyTier))].sort(),['application','foundation','transfer']);
 }
 assert.equal(new Set(pack.questions.filter(q=>q.sourceTextId==='tangshi-sanshou').map(q=>q.sourceWorkId)).size,3);
 assert.equal(new Set(pack.questions.filter(q=>q.sourceTextId==='songci-sanshou').map(q=>q.sourceWorkId)).size,3);
});

test('second language pack closes all twenty-four natural prescribed-text skill gaps',()=>{
 const [,pack]=loadPacks();
 assert.equal(pack.kind,'set-text-language');
 assert.equal(pack.questions.length,24);
 assert.equal(new Set(pack.questions.map(q=>q.id)).size,24);
 assert.equal(pack.questions.every(q=>/^stl2q\d{3}$/.test(q.id)),true);
 const primary=Array.from(pack.questions,q=>String(q.skillIds[0])).sort();
 assert.deepEqual(primary,TARGETED_02);
 assert.deepEqual([...new Set(pack.questions.map(q=>q.difficultyTier))].sort(),['application','foundation','transfer']);
 assert.ok(new Set(pack.questions.map(q=>q.sourceTextId)).size>=9,'targeted pack should still draw from at least nine prescribed groups');
 assert.equal(new Set(pack.questions.map(q=>q.sourceSentenceId)).size,24,'each targeted question should add distinct sentence evidence');
});

test('final six natural gaps use direct language evidence and existing practice routes',()=>{
 const [,pack]=loadPacks(),closing=pack.questions.filter(q=>/^stl2q0(?:19|2[0-4])$/.test(q.id));
 assert.equal(closing.length,6);
 assert.deepEqual(Array.from(closing,q=>String(q.skillIds[0])).sort(),CLOSING_02);
 assert.equal(new Set(closing.map(q=>q.sourceSentenceId)).size,6);
 assert.ok(new Set(closing.map(q=>q.sourceTextId)).size>=5,'closing questions should not concentrate on one prescribed text');
 assert.deepEqual(Array.from(closing,q=>q.kpId),['kp_virtual_ze','kp_virtual_qie','kp_virtual_ye','kp_virtual_yan','kp_virtual_ze','kp_syn_fixed_patterns']);
});

test('prescribed texts remain language material and never substitute for unfamiliar-context transfer',()=>{
 const packs=loadPacks(),questions=packs.flatMap(pack=>pack.questions),validSkills=new Map(curriculum.skills.map(skill=>[skill.id,skill]));
 for(const q of questions){
  assert.equal(q.textId,'CROSS');
  assert.equal(q.sourceKind,'set-text');
  assert.equal(q.setTextLanguage,true);
  assert.equal(q.transferLevel,2);
  assert.ok(String(q.sourceSentenceId||'').startsWith('sentence:'),`${q.id}: stable source sentence required`);
  assert.ok(Array.isArray(q.skillIds)&&q.skillIds.length>0,`${q.id}: skill provenance required`);
  for(const skillId of q.skillIds){const skill=validSkills.get(skillId);assert.ok(skill,`${q.id}: unknown skill ${skillId}`);assert.ok(skill.stage<=2,`${q.id}: language pack should remain in the core skill tree`);assert.equal(skill.domain==='transfer',false,`${q.id}: prescribed text must not masquerade as unfamiliar-context transfer`);}
  assert.ok(Array.isArray(q.o)&&q.o.length===4&&q.o.includes(q.a),`${q.id}: valid four-option answer required`);
  assert.ok(String(q.explanation||'').length>=12,`${q.id}: teaching explanation required`);
  assert.doesNotMatch(q.q,/(主旨|中心思想|寫作手法|修辭手法|人物形象|象徵|寄託)/,`${q.id}: content-recall framing leaked into language pack`);
  const classified=metadata.classify(q);
  assert.equal(classified.curriculumMode,'core',`${q.id}: prescribed source must not force set-text review mode`);
  assert.equal(classified.normalCore,true);
  assert.equal(classified.sourceKind,'set-text');
 }
});

test('coverage audit reaches forty-six core skills and leaves only unfamiliar transfer uncovered',()=>{
 const output=childProcess.execFileSync(process.execPath,[path.join(root,'scripts','audit_settext_skill_coverage.cjs')],{encoding:'utf8'});
 const marker=output.split(/\r?\n/).find(line=>line.startsWith('SETTEXT_SKILL_COVERAGE_AUDIT='));
 assert.ok(marker,'coverage audit marker missing');
 const report=JSON.parse(marker.slice('SETTEXT_SKILL_COVERAGE_AUDIT='.length));
 assert.equal(report.questionCount,60);
 assert.equal(report.coreSkills,49);
 assert.equal(report.coveredSkills,46);
 assert.equal(report.uncoveredSkills,3);
 assert.equal(report.targetableGapCount,0);
 assert.deepEqual(report.targetableGaps,[]);
 assert.deepEqual(report.intentionalUncovered.sort(),INTENTIONALLY_UNFAMILIAR);
 assert.equal(report.sourceGroups,12);
});

test('reviewed browser catalog includes all 60 prescribed-text language questions without new knowledge points',()=>{
 const catalog=loadCatalog(),setRows=catalog.questions.filter(q=>/^stl[12]q/.test(String(q.id)));
 assert.equal(catalog.questions.length,529);
 assert.equal(catalog.knowledgePoints.filter(kp=>kp.teachable!==false).length,89);
 assert.equal(setRows.length,60);
 assert.equal(new Set(setRows.map(q=>q.id)).size,60);
});

test('browser catalog and Firestore importer keep the two prescribed-text language packs wired',()=>{
 const catalog=fs.readFileSync(path.join(root,'public','content-catalog.js'),'utf8');
 const importer=fs.readFileSync(path.join(root,'scripts','import_to_firestore.js'),'utf8');
 const workflow=fs.readFileSync(path.join(root,'.github','workflows','pages-production-smoke.yml'),'utf8');
 for(const suffix of ['01','02']){
  assert.match(fs.readFileSync(path.join(root,'scripts','build_question_pack_bundle.cjs'),'utf8'),new RegExp(`question-pack-settext-language-${suffix}\\.js`));
  assert.match(catalog,new RegExp(`ManjingoQuestionPackSetTextLanguage${suffix}`));
  assert.match(importer,new RegExp(`question-pack-settext-language-${suffix}\\.js`));
 }
 assert.match(catalog,/setTextLanguagePack01\.questions/);
 assert.match(catalog,/setTextLanguagePack02\.questions/);
 assert.match(importer,/sourceWorkId:question\.sourceWorkId/);
 assert.match(importer,/setTextLanguage:question\.setTextLanguage===true\?true:null/);
 assert.match(workflow,/question-pack-settext-language-02\.js/);
 assert.match(workflow,/stl2q024/);
});