const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sync=require('../public/stage3-diagnostic-sync.js');

const root=path.join(__dirname,'..');

function event(questionId,at,choiceIndex=1){return{questionId,correct:false,at,choiceIndex,diagnosticMode:'choice'};}
function state(skillId,events,extra={}){return{version:2,skills:{[skillId]:{events,verifiedAt:null,lastVerification:null,...extra}}};}

test('cross-device merge unions independent Stage 3 evidence without duplication',()=>{
 const local=state('read.logical-relation',[event('tr10q001','2026-09-14T01:00:00Z')]);
 const remote=state('read.logical-relation',[event('tr10q002','2026-09-14T01:01:00Z',2)]);
 const merged=sync.mergeStates(local,remote);
 assert.deepEqual(merged.skills['read.logical-relation'].events.map(item=>item.questionId),['tr10q001','tr10q002']);
 const again=sync.mergeStates(merged,remote);
 assert.equal(again.skills['read.logical-relation'].events.length,2,'repeated sync must stay idempotent');
});

test('newer successful verification suppresses stale mistakes from another device',()=>{
 const local=state('read.logical-relation',[],{verifiedAt:'2026-09-14T01:05:00Z',lastVerification:{correctCount:2,total:2,at:'2026-09-14T01:05:00Z'}});
 const remote=state('read.logical-relation',[event('tr10q001','2026-09-14T01:00:00Z'),event('tr10q002','2026-09-14T01:01:00Z')]);
 const merged=sync.mergeStates(local,remote).skills['read.logical-relation'];
 assert.equal(merged.verifiedAt,'2026-09-14T01:05:00.000Z');
 assert.deepEqual(merged.events,[],'pre-verification mistakes must not re-open a retired signal');
 assert.equal(merged.lastVerification.correctCount,2);
});

test('a genuinely new Stage 3 mistake after verification can re-open evidence across devices',()=>{
 const local=state('read.logical-relation',[],{verifiedAt:'2026-09-14T01:05:00Z',lastVerification:{correctCount:2,total:2,at:'2026-09-14T01:05:00Z'}});
 const remote=state('read.logical-relation',[event('tr10q003','2026-09-14T01:06:00Z',3)]);
 const merged=sync.mergeStates(local,remote).skills['read.logical-relation'];
 assert.equal(merged.events.length,1);
 assert.equal(merged.events[0].questionId,'tr10q003');
 assert.equal(merged.verifiedAt,'2026-09-14T01:05:00.000Z');
});

test('cross-device diagnostic state stays bounded to the existing 24-event safety cap',()=>{
 const events=Array.from({length:30},(_,index)=>event(`tr10q${String((index%36)+1).padStart(3,'0')}`,new Date(Date.UTC(2026,8,14,1,index)).toISOString(),index%4));
 const merged=sync.mergeStates(state('read.context-clues',events),{});
 assert.equal(merged.skills['read.context-clues'].events.length,sync.MAX_EVENTS_PER_SKILL);
 assert.equal(sync.MAX_EVENTS_PER_SKILL,24);
});

test('cloud sync is isolated to clientSync soft state and requires a linked Google account',()=>{
 const source=fs.readFileSync(path.join(root,'public/stage3-diagnostic-sync.js'),'utf8');
 assert.match(source,/['"]clientSync['"],['"]state['"]/);
 assert.match(source,/account\.google/);
 assert.match(source,/runTransaction/,'cross-device merge should use a Firestore transaction');
 assert.doesNotMatch(source,/['"]skills['"]/,'soft diagnostic sync must never write authoritative skill mastery');
 assert.doesNotMatch(source,/['"]knowledge['"]/,'soft diagnostic sync must never write KP mastery');
 assert.doesNotMatch(source,/practiceSessions|interventionState/,'soft diagnostic sync must stay outside remediation authority');
});

test('homepage and verification lesson load diagnostic sync only after Stage 3 diagnostics',()=>{
 const theme=fs.readFileSync(path.join(root,'public/theme-runtime.js'),'utf8');
 const lesson=fs.readFileSync(path.join(root,'public/lesson.html'),'utf8');
 assert.match(theme,/stage3-diagnostic-sync\.js/);
 assert.match(theme,/script\.addEventListener\('load',loadStage3DiagnosticSync/);
 const diagnostics=lesson.indexOf('<script src="./stage3-diagnostics.js"></script>');
 const diagnosticSync=lesson.indexOf('<script src="./stage3-diagnostic-sync.js"></script>');
 const open=lesson.indexOf('window.ManjingoLocalLesson.open');
 assert.ok(diagnostics>=0&&diagnosticSync>diagnostics&&open>diagnosticSync,'verification lesson must install sync after diagnostics and before opening the lesson');
});
