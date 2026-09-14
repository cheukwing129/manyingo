const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Cloudflare answer API persists concept mastery transactionally',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/beginTransaction/);
 assert.match(worker,/users\/\$\{uid\}\/concepts\/\$\{conceptKey\}/);
 assert.match(worker,/selectedAnswer: answer\.selectedAnswer/);
 assert.match(worker,/correctAnswer: answer\.correctAnswer/);
 assert.match(worker,/conceptMastery: conceptResult/);
 assert.match(worker,/if \(logDoc\)/);
 assert.match(worker,/duplicate: true/);
});

test('Cloudflare daily plan maps weak concepts into skill-first question targeting metadata',()=>{
 const worker=read('public/_worker.js'),planner=read('public/server-skill-plan.js');
 assert.match(worker,/users\/\$\{uid\}\/concepts/);
 assert.match(worker,/SERVER_SKILL_PLAN\.buildPlan/);
 assert.match(planner,/conceptReview:true/);
 assert.match(planner,/conceptQuestionIds:Array\.isArray\(data\.questionIds\)/);
 assert.match(planner,/conceptMastery:Number\(data\.mastery\|\|0\)/);
 assert.match(planner,/conceptReview:items\.filter/);
 assert.match(planner,/skillId:x\.skillId,kpId:x\.kpId,conceptKey:x\.conceptKey/);
});

test('firebase client downloads concept state and sends learning writes to same-origin Pages API',()=>{
 const firebase=read('public/firebase-config.js');
 assert.match(firebase,/fetchUserConceptState/);
 assert.match(firebase,/collection\(db, "users", userId, "concepts"\)/);
 assert.doesNotMatch(firebase,/function enrichConcept\(answer\)/);
 assert.match(firebase,/function authorizedApi\(path, options = \{\}\)/);
 assert.match(firebase,/auth\.currentUser\.getIdToken\(\)/);
 assert.match(firebase,/authorizedApi\('\/api\/submit-answer'/);
 assert.match(firebase,/authorizedApi\('\/api\/daily-plan'/);
 assert.doesNotMatch(firebase,/httpsCallable\(functions/);
});

test('homepage reuses concepts returned by daily plan and avoids a duplicate collection read',()=>{
 const html=read('public/index.html');
 assert.match(html,/remotePlan&&remotePlan\.conceptState\|\|\{\}/);
 assert.doesNotMatch(html,/fetchUserConceptState\(uid\)/);
 assert.match(html,/syncRemoteConceptState\(remoteConcepts\)/);
 assert.match(html,/selectedAnswer:value/);
 assert.match(html,/correctAnswer:displayAnswer\(q\)/);
 const cloud=html.match(/function cloudSubmit\([\s\S]*?\nfunction createAnswerId/);
 assert.ok(cloud);
 assert.doesNotMatch(cloud[0],/conceptKey:/);
 assert.doesNotMatch(cloud[0],/conceptLabel:/);
 assert.match(html,/resolveQuestionMisconceptions\(q\.kpId,q\.id,\{skipConcept:true\}\)/);
});

test('daily plan returns the already-read private concept projection',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/const conceptState=Object\.fromEntries\(concepts\.map/);
 assert.match(worker,/return json\(\{\.\.\.plan,conceptState\}\)/);
});

test('local engine merges returned cloud concept mastery without overwriting newer offline progress',()=>{
 const local=read('public/local-learning.js');
 assert.match(local,/function mergeRemoteConcept\(data,key,remote\)/);
 assert.match(local,/remoteAttempts>localAttempts/);
 assert.match(local,/function syncRemoteConceptState\(remote\)/);
 assert.match(local,/result\.conceptMastery&&result\.conceptMastery\.conceptKey/);
 assert.match(local,/options&&options\.skipConcept\?null:updateConceptMastery/);
});

test('firestore rules let authenticated users read only their own concept mastery',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/match \/concepts\/\{conceptKey\}/);
 assert.match(rules,/allow read: if request\.auth != null && request\.auth\.uid == userId/);
 assert.match(rules,/allow write: if false/);
});
