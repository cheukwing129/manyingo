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
 assert.deepEqual(counts,{sentence:497,passage:41,'cross-source':40,concept:29});
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
  assert.notEqual(question.sourceTextId,'CROSS',id);
 }
 assert.equal(byId.get('lpq055').sourceTextId,'shengyouhuan');
});

test('legacy single-source prompts do not retain CROSS provenance',()=>{
 const catalog=loadReviewedCatalog(root),byId=new Map(catalog.questions.map(question=>[question.id,question]));
 const expectedSources={lpq059:'shengyouhuan',lpq063:'yuwosuoyu',cap1q010:'taohuayuan',cap1q012:'hezhouji',cap1q022:'shishuo',cap1q023:'shishuo'};
 for(const[id,sourceTextId]of Object.entries(expectedSources)){
  const question=byId.get(id);
  assert.equal(question.sourceTextId,sourceTextId,id);
  assert.equal(question.sourceScope,'sentence',id);
  assert.ok(question.sourceSentenceId,id);
 }
 for(const id of ['lpq038','lpq057']){
  const question=byId.get(id);
  assert.equal(question.sourceScope,'concept',id);
  assert.equal(question.sourceSentenceId,null,id);
 }
 const unresolved=catalog.questions.filter(question=>question.sourceScope==='sentence'&&question.sourceTextId==='CROSS'&&!question.id.startsWith('ad')).map(question=>question.id);
 assert.deepEqual(Array.from(unresolved),['p3q002','p3q017','p3q033','lpq018','lpq046']);
});

test('adaptive function-word prompts retain their identifiable source texts',()=>{
 const catalog=loadReviewedCatalog(root),byId=new Map(catalog.questions.map(question=>[question.id,question]));
 const expectedSources={ad1q001:'ailianshuo',ad1q002:'chenshe-shijia',ad1q004:'lunyu',ad1q005:'zuiwengtingji',ad1q007:'lang',ad1q008:'xiaoshitan',ad1q010:'zouji',ad1q011:'shengyouhuan',ad1q014:'maqianlishuo',ad1q015:'maqianlishuo',ad1q016:'lunyu',ad1q017:'yueyanglou'};
 for(const[id,sourceTextId]of Object.entries(expectedSources)){
  const question=byId.get(id);
  assert.equal(question.sourceTextId,sourceTextId,id);
  assert.equal(question.sourceScope,'sentence',id);
  assert.ok(question.sourceSentenceId,id);
 }
});

test('adaptive sentence-pattern prompts retain their identifiable source texts',()=>{
 const catalog=loadReviewedCatalog(root),byId=new Map(catalog.questions.map(question=>[question.id,question]));
 const expectedSources={ad1q019:'taohuayuan',ad1q020:'yueyanglou',ad1q023:'lianpo-linxiangru',ad1q025:'lingguanzhuanxu',ad1q028:'caogui',ad1q029:'taohuayuan',ad1q031:'loushiming',ad1q032:'zouji',ad1q034:'caogui',ad1q035:'yueyanglou',ad1q036:'chushibiao',ad2q022:'ailianshuo'};
 for(const[id,sourceTextId]of Object.entries(expectedSources)){
  const question=byId.get(id);
  assert.equal(question.sourceTextId,sourceTextId,id);
  assert.equal(question.sourceScope,'sentence',id);
  assert.ok(question.sourceSentenceId,id);
 }
 assert.equal(byId.get('ad1q031').sourceSentenceId,'sentence:loushiming:helouzhiyou');
 const unresolved=catalog.questions.filter(question=>question.sourceScope==='sentence'&&question.sourceTextId==='CROSS'&&question.id.startsWith('ad')).map(question=>question.id);
 assert.deepEqual(Array.from(unresolved),['ad1q013','ad1q026','ad3q007']);
});

test('worker prefers bundled reviewed metadata and retains Firestore fallback',()=>{
 const worker=fs.readFileSync(path.join(root,'public','_worker.js'),'utf8');
 assert.match(worker,/import '\.\/server-question-index\.js'/);
 assert.match(worker,/SERVER_QUESTION_INDEX&&SERVER_QUESTION_INDEX\.get\(questionId\)/);
 assert.match(worker,/if\(bundled\)return bundled/);
 assert.match(worker,/getDocument\(env,token,`questions\/\$\{questionId\}`\)/);
});
