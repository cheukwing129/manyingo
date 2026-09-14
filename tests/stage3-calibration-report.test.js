const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildCalibrationReport,wilsonInterval,toMarkdown}=require('../scripts/stage3_calibration_report_lib.cjs');

function event({learnerId,skillId='lex.context-inference',questionId='tr10q013',choiceIndex=0,supported=true,mapVersion='stage3-choice-diagnostics-v1'}){
  return{learnerId,data:{skillId,mapVersion,supported,diagnosticEvidence:[{questionId,diagnosticMode:'choice',choiceIndex}],completedAt:'2026-09-14T00:00:00.000Z'}};
}

test('Wilson interval is conservative for small samples',()=>{
  const one=wilsonInterval(1,1),half=wilsonInterval(10,20);
  assert.ok(one.low<0.5&&one.high===1);
  assert.ok(half.low<0.5&&half.high>0.5);
});

test('report keeps low-volume mappings insufficient even with extreme outcomes',()=>{
  const rows=Array.from({length:19},(_,i)=>event({learnerId:`u${i}`,supported:false}));
  const report=buildCalibrationReport(rows,{minEvents:20,minLearners:10});
  assert.equal(report.mappings[0].status,'insufficient-sample');
  assert.equal(report.mappings[0].eligible,false);
  assert.equal(report.mappings[0].verificationSupportRate,0);
});

test('report flags mature low-support mappings only after event and learner gates',()=>{
  const rows=Array.from({length:24},(_,i)=>event({learnerId:`u${i%12}`,supported:i<3}));
  const report=buildCalibrationReport(rows,{minEvents:20,minLearners:10});
  const row=report.mappings[0];
  assert.equal(row.events,24);
  assert.equal(row.learnerCount,12);
  assert.equal(row.status,'review-low-support');
  assert.ok(row.wilson95.high<0.5);
});

test('report can identify strong-support mappings without mutating diagnostic rules',()=>{
  const rows=Array.from({length:30},(_,i)=>event({learnerId:`u${i%15}`,supported:i<25}));
  const report=buildCalibrationReport(rows,{minEvents:20,minLearners:10});
  assert.equal(report.mappings[0].status,'strong-support');
  assert.ok(report.mappings[0].wilson95.low>=0.5);
  assert.equal(report.mappings[0].verificationSupportRate,0.8333);
});

test('mapping groups separate distractors and preserve anonymous aggregate output',()=>{
  const rows=[];
  for(let i=0;i<10;i++)rows.push(event({learnerId:`private-user-${i}`,choiceIndex:0,supported:true}));
  for(let i=0;i<10;i++)rows.push(event({learnerId:`other-user-${i}`,choiceIndex:2,supported:false}));
  const report=buildCalibrationReport(rows,{minEvents:1,minLearners:1});
  assert.equal(report.mappings.length,2);
  assert.notEqual(report.mappings[0].key,report.mappings[1].key);
  const serialized=JSON.stringify(report);
  assert.doesNotMatch(serialized,/private-user|other-user/);
});

test('markdown states calibration evidence is not direct precision and never auto-changes mappings',()=>{
  const report=buildCalibrationReport([event({learnerId:'u1'})],{minEvents:20,minLearners:10});
  const md=toMarkdown(report);
  assert.match(md,/No mapping is changed automatically/);
  assert.match(md,/not a direct estimate of diagnostic precision/);
  assert.doesNotMatch(md,/u1/);
});

test('manual report workflow is read-only and not scheduled',()=>{
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','stage3-calibration-report.yml'),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/\nschedule:/);
  assert.match(workflow,/report_stage3_calibration\.cjs/);
  assert.match(workflow,/actions\/upload-artifact@v4/);
  assert.doesNotMatch(workflow,/import_to_firestore\.js|--apply|--prune/);
});
