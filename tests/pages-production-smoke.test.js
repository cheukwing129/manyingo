const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Pages smoke verifies deployed learner difficulty guidance instant feedback and nonblocking next before exercising the learning API',()=>{
  const source=read('scripts/smoke_pages_api.mjs');
  assert.match(source,/from 'node:vm'/);
  assert.match(source,/readTextAsset\('\/difficulty-calibration\.js'/);
  assert.match(source,/readTextAsset\('\/question-rotation\.js'/);
  assert.match(source,/readTextAsset\('\/question-difficulty\.js'/);
  assert.match(source,/readTextAsset\('\/difficulty-observability\.js'/);
  assert.match(source,/readTextAsset\('\/feedback-ui\.js'/);
  assert.match(source,/readTextAsset\('\/', 'homepage'\)/);
  assert.match(source,/calibration\.tierForMastery\(68/);
  assert.match(source,/=== 'transfer'/);
  assert.match(source,/calibration\.tierForMastery\(82/);
  assert.match(source,/=== 'application'/);
  assert.match(source,/observability\.reasonLabel\('application-ready'\)/);
  assert.match(source,/observability\.selectionLabel\('misconception-target'\)/);
  assert.match(source,/observability\.studentSummary/);
  assert.match(source,/learnerGuidance\.tier === '跨篇遷移'/);
  assert.match(source,/近期同層 4 題 100%/);
  assert.match(source,/為甚麼系統安排這個難度？/);
  assert.match(source,/feedbackSource\.includes\('function instantAnswer\(event\)'\)/);
  assert.match(source,/feedbackSource\.includes\("document\.addEventListener\('click',instantAnswer,true\)"\)/);
  assert.match(source,/feedbackSource\.includes\('function unlockNextSoon\(scope\)'\)/);
  assert.match(source,/feedbackSource\.includes\('next\.disabled=false'\)/);
  assert.match(source,/homepageSource\.includes\('function answerIsCurrent\(box,answerId\)'\)/);
  assert.match(source,/homepageSource\.includes\('if\(nextButton\)nextButton\.disabled=false;showLearningFeedback/);
  assert.match(source,/!homepageSource\.includes\('nextButton\.disabled=true'\)/);
  assert.match(source,/homepageSource\.includes\('if\(answerIsCurrent\(box,answerId\)\)showLearningFeedback/);
  assert.match(source,/indexOf\('difficulty-calibration\.js'\) < rotationSource\.indexOf\('question-difficulty\.js'\)/);
  assert.match(source,/indexOf\('question-difficulty\.js'\) < rotationSource\.indexOf\('difficulty-observability\.js'\)/);
  const calibrationCheck=source.indexOf("readTextAsset('/difficulty-calibration.js'");
  const observabilityCheck=source.indexOf("readTextAsset('/difficulty-observability.js'");
  const feedbackCheck=source.indexOf("readTextAsset('/feedback-ui.js'");
  const homepageCheck=source.indexOf("readTextAsset('/', 'homepage')");
  const healthCheck=source.indexOf("api('/api/health'");
  assert.ok(calibrationCheck>=0 && observabilityCheck>=0 && feedbackCheck>=0 && homepageCheck>=0 && healthCheck>homepageCheck,'production browser policies and homepage flow must be checked before backend smoke');
});

test('production smoke verifies stale background responses cannot roll learning state backwards',()=>{
  const source=read('scripts/smoke_sync_guard.mjs');
  assert.match(source,/read\('\/remote-sync-guard\.js'/);
  assert.match(source,/read\('\/question-rotation\.js'/);
  assert.match(source,/remote-sync-guard\.js/);
  assert.match(source,/attempts:2,mastery:30/);
  assert.match(source,/stale\.mastery===undefined/);
  assert.match(source,/stale\.totalXp===24/);
  assert.match(source,/attempts:4,mastery:55/);
  assert.match(source,/newer\.mastery===55/);
});

test('production smoke verifies deployed answer outbox persistence retry and account isolation',()=>{
  const source=read('scripts/smoke_answer_outbox.mjs');
  assert.match(source,/read\('\/answer-outbox\.js'/);
  assert.match(source,/read\('\/firebase-config\.js'/);
  assert.match(source,/box\.enqueue|outbox\.enqueue/);
  assert.match(source,/outbox\.markFailure/);
  assert.match(source,/outbox\.bindUnowned/);
  assert.match(source,/includeUnowned:false/);
  assert.match(source,/window\.addEventListener\('online'/);
  assert.match(source,/learning\.syncRemoteResult/);
  assert.match(source,/production outbox crossed account boundary/);
});

test('production smoke verifies deployed practice outbox plus ten-question and answer-position safety',()=>{
  const source=read('scripts/smoke_practice_reliability.mjs');
  assert.match(source,/read\('\/practice-outbox\.js'/);
  assert.match(source,/read\('\/practice-api\.js'/);
  assert.match(source,/read\('\/daily-plan-runtime\.js'/);
  assert.match(source,/outbox\.enqueue/);
  assert.match(source,/outbox\.markFailure/);
  assert.match(source,/outbox\.bindUnowned/);
  assert.match(source,/deployed practice outbox crossed account boundary/);
  assert.match(source,/practiceApiSource\.includes\("import '\.\/practice-outbox\.js'"\)/);
  assert.match(source,/flushPracticeOutbox\(\{force:true\}\)/);
  assert.match(source,/daily\.sessionReservation\(queue,9,completed,10\)/);
  assert.match(source,/reservation\.remainingSlots===0/);
  assert.match(source,/merged\.questions\.length===10&&merged\.tail\.length===0/);
  assert.match(source,/daily\.balanceChoiceQuestions\(allA,'production-smoke'\)/);
  assert.match(source,/Math\.max\(\.\.\.counts\)-Math\.min\(\.\.\.counts\)<=1/);
});

test('Pages smoke performs one real reviewed answer and verifies all learning writes',()=>{
  const source=read('scripts/smoke_pages_api.mjs');
  assert.match(source,/accounts:signUp/);
  assert.match(source,/\/api\/health/);
  assert.match(source,/\/api\/daily-plan/);
  assert.match(source,/\/api\/due-knowledge-points/);
  assert.match(source,/\/api\/submit-answer/);
  assert.match(source,/questionId:\s*'q004'/);
  assert.match(source,/kpId:\s*'kp_virtual_zhi'/);
  assert.match(source,/isCorrect:\s*false/);
  assert.match(source,/server trusted the false client correctness claim/);
  assert.match(source,/answerLog\.correctAnswer === '動詞（到／往）'/);
  assert.match(source,/answerLog\.correctnessMismatch === true/);
  assert.match(source,/forgedConcept == null/);
  assert.match(source,/answerLog\.conceptAttributionMismatch === true/);
  assert.match(source,/expected 8 XP/);
  assert.match(source,/knowledge\/\$\{validPayload\.kpId\}/);
  assert.match(source,/gamification\/state/);
  assert.match(source,/concepts\/\$\{authoritativeConceptKey\}/);
  assert.match(source,/concepts\/\$\{clientClaimedConceptKey\}/);
  assert.match(source,/answerLogs\/\$\{answerId\}/);
  assert.match(source,/body: '\{\}'/);
  assert.match(source,/expected HTTP 400/);
});

test('Pages smoke persists restores and deduplicates one real server practice session',()=>{
  const source=read('scripts/smoke_pages_api.mjs');
  assert.match(source,/health\.practicePolicy === 'server-practice-v1'/);
  assert.match(source,/const practiceRoute = plan\.items\.find\(item => item && item\.skillId && item\.kpId\)/);
  assert.match(source,/api\('\/api\/practice-session'/);
  assert.match(source,/api\('\/api\/practice-state'/);
  assert.match(source,/practiceState\.practiceIds\.includes\(practiceId\)/);
  assert.match(source,/practiceState\.interventionState\[practicePayload\.skillId\]/);
  assert.match(source,/duplicatePractice\.duplicate === true/);
  assert.match(source,/reportTiming\(practiceResponse, 'practice-session', \['auth','oauth','practice_tx_begin','practice_tx_reads','practice_commit','total'\]\)/);
  assert.match(source,/reportTiming\(practiceStateResponse, 'practice-state', \['auth','oauth','interventions_list','total'\]\)/);
  assert.match(source,/reportTiming\(duplicatePracticeResponse, 'practice-duplicate', \['auth','oauth','practice_tx_begin','practice_tx_reads','practice_tx_rollback','total'\]\)/);
});

test('production smoke writes cleanup manifest immediately after creating temporary uid',()=>{
  const source=read('scripts/smoke_pages_api.mjs');
  const signup=source.indexOf("const signup = await firebaseIdentity('accounts:signUp'");
  const manifest=source.indexOf('fs.writeFileSync(stateFile');
  const plan=source.indexOf("api('/api/daily-plan'");
  assert.ok(signup>=0 && manifest>signup && plan>manifest);
  assert.doesNotMatch(source,/accounts:delete/);
});

test('cleanup recursively removes temporary Firestore data and Firebase Auth user',()=>{
  const source=read('scripts/cleanup_smoke_user.cjs');
  assert.match(source,/recursiveDelete\(db\.collection\('users'\)\.doc\(uid\)\)/);
  assert.match(source,/deleteUser\(uid\)/);
  assert.match(source,/Invalid smoke cleanup uid/);
  assert.match(source,/FIREBASE_SERVICE_ACCOUNT_MANJINGO cleanup credential/);
  assert.match(source,/unlinkSync\(stateFile\)/);
});

test('production smoke runs after content synchronization, skips irrelevant commits, and always cleans up',()=>{
  const workflow=read('.github/workflows/pages-production-smoke.yml');
  assert.match(workflow,/workflow_dispatch/);
  assert.match(workflow,/schedule:/);
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/workflows: \['Firebase Content Sync'\]/);
  assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/);
  assert.match(workflow,/ENABLE_PAGES_SMOKE == 'true'/);
  assert.match(workflow,/practice-outbox\.js/);
  assert.match(workflow,/seq 1 18/);
  assert.match(workflow,/npm run smoke:pages/);
  assert.match(workflow,/MANJINGO_BASE_URL/);
  assert.match(workflow,/Install Firebase Admin cleanup runtime/);
  assert.match(workflow,/FIREBASE_SERVICE_ACCOUNT_MANJINGO/);
  assert.match(workflow,/group: pages-production-smoke/);
  assert.match(workflow,/Detect production surface changes/);
  assert.match(workflow,/No production runtime or smoke contract changed; Firestore quota untouched/);
  assert.match(workflow,/if: always\(\) && steps\.production_scope\.outputs\.needs_smoke == 'true'/);
  assert.match(workflow,/cleanup_smoke_user\.cjs/);
  const smokeStep=workflow.slice(workflow.indexOf('Smoke test production Pages learning API with a real write'),workflow.indexOf('Cleanup temporary smoke user and learning data'));
  assert.doesNotMatch(smokeStep,/FIREBASE_SERVICE_ACCOUNT/);
});

test('package exposes the production smoke command',()=>{
  const pkg=JSON.parse(read('package.json'));
  assert.equal(pkg.scripts['smoke:pages'],'node scripts/smoke_sync_guard.mjs && node scripts/smoke_answer_outbox.mjs && node scripts/smoke_practice_reliability.mjs && node scripts/smoke_pages_api.mjs');
});
