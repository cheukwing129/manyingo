const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {spawnSync}=require('node:child_process');

const root=path.join(__dirname,'..');
const curriculum=require('../public/curriculum-v1.js');

function memoryStorage(){
  const data=new Map();
  return{
    getItem:key=>data.has(String(key))?data.get(String(key)):null,
    setItem:(key,value)=>data.set(String(key),String(value)),
    removeItem:key=>data.delete(String(key)),
    clear:()=>data.clear()
  };
}
function freshClient(){
  global.localStorage=memoryStorage();
  delete global.document;
  delete global.ManjingoStage3Calibration;
  const file=require.resolve('../public/stage3-calibration.js');
  delete require.cache[file];
  return require(file);
}
function freshServer(){
  global.ManjingoCurriculumV1=curriculum;
  const diagnosticsFile=require.resolve('../public/stage3-diagnostics.js');
  delete require.cache[diagnosticsFile];
  global.ManjingoStage3Diagnostics=require(diagnosticsFile);
  delete global.ManjingoStage3CalibrationServer;
  const file=require.resolve('../public/stage3-calibration-server.js');
  delete require.cache[file];
  return require(file);
}
function payload(){return{
  calibrationId:'cal_12345678',
  mapVersion:'stage3-choice-diagnostics-v1',
  skillId:'read.actor-tracking',
  diagnosticEvidence:[
    {questionId:'tr10q007',choiceIndex:2,diagnosticMode:'choice'},
    {questionId:'tr10q012',choiceIndex:1,diagnosticMode:'choice'}
  ],
  verificationAnswers:[
    {answerId:'vfy_answer_0001',questionId:'tr01q001'},
    {answerId:'vfy_answer_0002',questionId:'tr01q002'}
  ],
  completedAt:new Date().toISOString()
};}

test.afterEach(()=>{
  delete global.localStorage;
  delete global.ManjingoStage3Calibration;
  delete global.ManjingoStage3CalibrationServer;
  delete global.ManjingoStage3Diagnostics;
  delete global.ManjingoCurriculumV1;
});

test('client calibration event carries provenance and answer references but no correctness claim',()=>{
  const client=freshClient(),event=client.buildEvent(payload());
  assert.ok(event);
  assert.equal(event.mapVersion,client.MAP_VERSION);
  assert.equal(event.diagnosticEvidence.length,2);
  assert.equal(event.verificationAnswers.length,2);
  assert.equal('correctCount' in event,false);
  assert.equal('supported' in event,false);
  assert.equal(JSON.stringify(event).includes('selectedAnswer'),false);
  assert.equal(JSON.stringify(event).includes('correctAnswer'),false);
});

test('client requires two distinct Stage 3 contexts and two distinct verification answers',()=>{
  const client=freshClient(),base=payload();
  assert.equal(client.buildEvent({...base,diagnosticEvidence:[base.diagnosticEvidence[0]]}),null);
  assert.equal(client.buildEvent({...base,verificationAnswers:[base.verificationAnswers[0],base.verificationAnswers[0]]}),null);
  assert.equal(client.buildEvent({...base,verificationAnswers:[base.verificationAnswers[0],{answerId:'vfy_answer_0003',questionId:base.verificationAnswers[0].questionId}]}),null);
});

test('client outbox is idempotent by calibration id and never rebinds an owned event',()=>{
  const client=freshClient(),event=client.buildEvent(payload());
  assert.equal(client.enqueue(event,null),true);
  assert.equal(client.enqueue(event,null),true);
  assert.equal(client.list({includeUnowned:true}).length,1);
  assert.equal(client.bindUnowned('user-a'),1);
  assert.equal(client.bindUnowned('user-b'),0);
  assert.equal(client.list({uid:'user-a'}).length,1);
  assert.equal(client.list({uid:'user-b'}).length,0);
});

test('server revalidates reviewed distractor mapping and core skill before accepting calibration',()=>{
  const server=freshServer(),clean=server.validate(payload());
  assert.equal(clean.skillId,'read.actor-tracking');
  assert.equal(clean.diagnosticEvidence.length,2);
  assert.equal(clean.diagnosticEvidence[0].choiceIndex,2);
  assert.throws(()=>server.validate({...payload(),diagnosticEvidence:[{questionId:'tr10q007',choiceIndex:1,diagnosticMode:'choice'},payload().diagnosticEvidence[1]]}),/does not support requested skill/);
  assert.throws(()=>server.validate({...payload(),skillId:'read.argumentation'}),/reviewed core skill/);
});

test('server derives calibration support only from authoritative answer logs',()=>{
  const server=freshServer(),event=server.validate(payload());
  const supported=server.derive(event,[
    {data:{questionId:'tr01q001',skillId:'read.actor-tracking',isCorrect:true}},
    {data:{questionId:'tr01q002',skillId:'read.actor-tracking',isCorrect:false}}
  ]);
  assert.equal(supported.correctCount,1);
  assert.equal(supported.supported,true);
  const refuted=server.derive(event,[
    {data:{questionId:'tr01q001',skillId:'read.actor-tracking',isCorrect:true}},
    {data:{questionId:'tr01q002',skillId:'read.actor-tracking',isCorrect:true}}
  ]);
  assert.equal(refuted.correctCount,2);
  assert.equal(refuted.supported,false);
  assert.throws(()=>server.derive(event,[null,{data:{questionId:'tr01q002',skillId:'read.actor-tracking',isCorrect:true}}]),error=>error&&error.status===409);
});

test('stored calibration is observational only and excludes answer text mastery and intervention fields',()=>{
  const server=freshServer(),event=server.validate(payload()),outcome=server.derive(event,[
    {data:{questionId:'tr01q001',skillId:'read.actor-tracking',isCorrect:false}},
    {data:{questionId:'tr01q002',skillId:'read.actor-tracking',isCorrect:true}}
  ]),stored=server.stored(event,outcome,new Date());
  assert.equal(stored.source,'stage3-calibration-v1');
  assert.equal(stored.verifiedBy,'server-answer-logs-v1');
  assert.equal(stored.supported,true);
  for(const forbidden of ['selectedAnswer','correctAnswer','mastery','intervention','learningState'])assert.equal(JSON.stringify(stored).includes(forbidden),false);
});

test('diagnostic verification snapshots Stage 3 evidence before a passing verification clears it',()=>{
  global.localStorage=memoryStorage();
  global.ManjingoCurriculumV1=curriculum;
  const diagnosticsFile=require.resolve('../public/stage3-diagnostics.js');
  delete require.cache[diagnosticsFile];
  const diagnostics=require(diagnosticsFile);
  diagnostics.recordAttempt('tr10q007',false,'2026-09-12T10:00:00Z',2);
  diagnostics.recordAttempt('tr10q012',false,'2026-09-12T10:01:00Z',1);
  const verdict=diagnostics.recordVerification('read.actor-tracking',{correctCount:2,total:2,at:'2026-09-12T10:05:00Z'});
  assert.equal(verdict.passed,true);
  assert.deepEqual(verdict.diagnosticEvidence,[
    {questionId:'tr10q007',choiceIndex:2,diagnosticMode:'choice'},
    {questionId:'tr10q012',choiceIndex:1,diagnosticMode:'choice'}
  ]);
  assert.equal(diagnostics.signalForSkill('read.actor-tracking').wrongCount,0);
});

test('browser verification sends normal server-authoritative answers and queues calibration separately',()=>{
  const diagnostics=fs.readFileSync(path.join(root,'public/stage3-diagnostics.js'),'utf8');
  const worker=fs.readFileSync(path.join(root,'public/_worker.js'),'utf8');
  assert.match(diagnostics,/firebase\.submitAnswer\(\{answerId,questionId:String\(q\.id\),kpId:String\(q\.kpId\),targetSkillId:String\(skillId\)/);
  assert.match(diagnostics,/verificationAnswers\.push\(\{answerId,questionId:String\(q\.id\)\}\)/);
  assert.match(diagnostics,/queueCalibration\(\{skillId,diagnosticEvidence:verdict\.diagnosticEvidence,verificationAnswers:state\.verificationAnswers/);
  assert.doesNotMatch(diagnostics,/submitVerificationCloud[\s\S]{0,500}isCorrect:/);
  assert.match(worker,/url\.pathname === '\/api\/stage3-calibration'/);
  assert.match(worker,/stage3Calibrations\/\$\{event\.calibrationId\}/);
  const handler=worker.slice(worker.indexOf('async function submitStage3Calibration'),worker.indexOf('async function submitPracticeSession'));
  assert.doesNotMatch(handler,/interventions|knowledge\/|skills\/|gamification/,'calibration route must not mutate teaching state');
  assert.match(handler,/answerLogs\/\$\{item\.answerId\}/);
});

test('production calibration smoke has a real reviewed two-question fixture and parses cleanly',()=>{
  const context={window:{}};
  vm.createContext(context);
  for(const filename of ['question-pack-settext-language-01.js','question-pack-settext-language-02.js'])vm.runInContext(fs.readFileSync(path.join(root,'public',filename),'utf8'),context,{filename});
  const questions=Object.values(context.window).flatMap(pack=>Array.isArray(pack&&pack.questions)?pack.questions:[]);
  const diagnostics=freshServer()&&global.ManjingoStage3Diagnostics;
  const evidenceBySkill=new Map();
  for(const [questionId,choices] of Object.entries(diagnostics.CHOICE_DIAGNOSTIC_MAP))for(const [choiceIndex,skills] of Object.entries(choices))for(const skillId of skills){const list=evidenceBySkill.get(skillId)||[];if(!list.some(item=>item.questionId===questionId))list.push({questionId,choiceIndex:Number(choiceIndex)});evidenceBySkill.set(skillId,list);}
  const bySkill=new Map();
  for(const question of questions)for(const skillId of question.skillIds||[]){const list=bySkill.get(skillId)||[];if(!list.some(item=>item.id===question.id))list.push(question);bySkill.set(skillId,list);}
  assert.ok([...bySkill].some(([skillId,list])=>list.length>=2&&(evidenceBySkill.get(skillId)||[]).length>=2),'smoke needs two reviewed core questions and two Stage 3 contexts for one skill');
  const syntax=spawnSync(process.execPath,['--check',path.join(root,'scripts','smoke_pages_api.mjs')],{encoding:'utf8'});
  assert.equal(syntax.status,0,syntax.stderr||syntax.stdout);
});

test('production wait and API smoke require the deployed calibration asset and isolated idempotent route',()=>{
  const workflow=fs.readFileSync(path.join(root,'.github/workflows/pages-production-smoke.yml'),'utf8');
  const smoke=fs.readFileSync(path.join(root,'scripts/smoke_pages_api.mjs'),'utf8');
  assert.match(workflow,/stage3-calibration\.js/);
  assert.match(workflow,/stage3-choice-diagnostics-v1/);
  assert.match(smoke,/stage3CalibrationPolicy === 'stage3-calibration-v1'/);
  assert.match(smoke,/server-verified Stage 3 calibration persisted idempotently/);
  assert.match(smoke,/JSON\.stringify\(afterCalibration\.interventionState \|\| \{\}\) === JSON\.stringify\(beforeCalibration\.interventionState \|\| \{\}\)/);
  assert.match(smoke,/stage3-calibration-duplicate/);
});
