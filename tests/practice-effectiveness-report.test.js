'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildEpisodes,buildEffectivenessReport,toMarkdown}=require('../scripts/practice_effectiveness_report_lib.cjs');

const H=3600000,D=24*H;
function practice(learnerId,practiceId,skillId,strategy,completedAt){return{learnerId,data:{practiceId,skillId,strategy,completedAt:new Date(completedAt),accuracy:80,delta:6}};}
function answer(learnerId,skillId,questionId,answeredAt,isCorrect){return{learnerId,data:{skillId,questionId,answeredAt:new Date(answeredAt),isCorrect}};}

test('post-practice transfer excludes recently seen questions and immediate answers',()=>{
  const t=Date.UTC(2026,8,1,12),p=[practice('u1','p1','lex.context-inference','remedial',t)],a=[
    answer('u1','lex.context-inference','seen',t-H,false),
    answer('u1','lex.context-inference','seen',t+2*H,true),
    answer('u1','lex.context-inference','too-soon',t+5*60000,true),
    answer('u1','lex.context-inference','fresh1',t+H,true),
    answer('u1','lex.context-inference','fresh2',t+2*H,true),
    answer('u1','lex.context-inference','fresh3',t+3*H,false)
  ];
  const [episode]=buildEpisodes(p,a,{now:t+4*H,days:60,minDelayMinutes:15,minFollowups:3});
  assert.equal(episode.freshQuestionCount,3);
  assert.equal(episode.eligible,true);
  assert.equal(episode.followupAccuracy,2/3);
});

test('a later practice session closes attribution window for the earlier episode',()=>{
  const t=Date.UTC(2026,8,1,12),p=[practice('u1','p1','fw.er','targeted',t),practice('u1','p2','fw.er','remedial',t+2*D)],a=[
    answer('u1','fw.er','a',t+D,true),answer('u1','fw.er','b',t+D+H,true),answer('u1','fw.er','c',t+D+2*H,true),
    answer('u1','fw.er','after-next',t+3*D,false)
  ];
  const episodes=buildEpisodes(p,a,{now:t+4*D,days:60,minFollowups:3});
  assert.equal(episodes[0].freshQuestionCount,3);
  assert.equal(episodes[0].retained,true);
});

test('delayed retention requires evidence at least 24 hours later',()=>{
  const t=Date.UTC(2026,8,1,12),p=[practice('u1','p1','syn.ellipsis-subject','reteach',t)],a=[
    answer('u1','syn.ellipsis-subject','q1',t+H,true),
    answer('u1','syn.ellipsis-subject','q2',t+25*H,true),
    answer('u1','syn.ellipsis-subject','q3',t+26*H,false),
    answer('u1','syn.ellipsis-subject','q4',t+27*H,true)
  ];
  const [episode]=buildEpisodes(p,a,{now:t+3*D,days:60,minFollowups:3,minDelayedFollowups:2});
  assert.equal(episode.delayedQuestionCount,3);
  assert.equal(episode.delayedEligible,true);
  assert.equal(episode.delayedRetained,false);
});

test('aggregate classification stays insufficient until both episode and learner gates are met',()=>{
  const t=Date.UTC(2026,8,1,12),practices=[],answers=[];
  for(let i=0;i<19;i++){
    const uid=`learner-${i}`,base=t+i*1000;
    practices.push(practice(uid,`practice-${i}`,'read.logical-relation','remedial',base));
    answers.push(answer(uid,'read.logical-relation',`q${i}a`,base+H,true),answer(uid,'read.logical-relation',`q${i}b`,base+2*H,true),answer(uid,'read.logical-relation',`q${i}c`,base+3*H,true));
  }
  const report=buildEffectivenessReport(practices,answers,{now:t+D,days:60,minEpisodes:20,minLearners:10});
  assert.equal(report.skillStrategies[0].status,'insufficient-sample');
});

test('mature consistently weak transfer is flagged conservatively',()=>{
  const t=Date.UTC(2026,8,1,12),practices=[],answers=[];
  for(let i=0;i<40;i++){
    const uid=`learner-${i}`,base=t+i*1000;
    practices.push(practice(uid,`practice-${i}`,'read.actor-tracking','reteach',base));
    answers.push(answer(uid,'read.actor-tracking',`q${i}a`,base+H,false),answer(uid,'read.actor-tracking',`q${i}b`,base+2*H,false),answer(uid,'read.actor-tracking',`q${i}c`,base+3*H,true));
  }
  const report=buildEffectivenessReport(practices,answers,{now:t+D,days:60,minEpisodes:20,minLearners:10});
  assert.equal(report.skillStrategies[0].status,'review-low-transfer');
  assert.equal(report.skillStrategies[0].learnerCount,40);
});

test('serialized reports never expose learner or practice identifiers',()=>{
  const t=Date.UTC(2026,8,1,12),uid='SECRET-LEARNER-ID',pid='SECRET-PRACTICE-ID';
  const report=buildEffectivenessReport([practice(uid,pid,'trans.integrated','targeted',t)],[answer(uid,'trans.integrated','q1',t+H,true),answer(uid,'trans.integrated','q2',t+2*H,true),answer(uid,'trans.integrated','q3',t+3*H,true)],{now:t+D,days:60,minEpisodes:1,minLearners:1});
  const json=JSON.stringify(report),md=toMarkdown(report);
  assert.doesNotMatch(json,/SECRET-LEARNER-ID|SECRET-PRACTICE-ID/);
  assert.doesNotMatch(md,/SECRET-LEARNER-ID|SECRET-PRACTICE-ID/);
});

test('manual effectiveness workflow is read-only and never scheduled',()=>{
  const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','practice-effectiveness-report.yml'),'utf8');
  const cli=fs.readFileSync(path.join(__dirname,'..','scripts','report_practice_effectiveness.cjs'),'utf8');
  assert.match(workflow,/workflow_dispatch:/);
  assert.doesNotMatch(workflow,/schedule:/);
  assert.match(cli,/collectionGroup\('practiceSessions'\)/);
  assert.match(cli,/collectionGroup\('answerLogs'\)/);
  assert.match(cli,/row\.data\.practiceSession/);
  assert.doesNotMatch(cli,/\.set\(|\.update\(|\.delete\(|\.add\(|batch\.commit/);
});
