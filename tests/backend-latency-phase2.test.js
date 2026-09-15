const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const worker=fs.readFileSync(path.join(__dirname,'..','public','_worker.js'),'utf8');

test('answer transaction batches KP skill and user-state reads into one Firestore batchGet',()=>{
  assert.match(worker,/documents:batchGet/);
  assert.match(worker,/function batchGetDocuments\(env, token, paths, transaction\)/);
  assert.match(worker,/body:JSON\.stringify\(\{documents:names,\.\.\.\(transaction\?\{transaction\}:\{\}\)\}\)/);
  assert.match(worker,/timed\(trace,'tx_reads',\(\)=>batchGetDocuments\(env,token,txPaths,tx\)\)/);
  assert.match(worker,/const txPaths=\[kpPath,\.\.\.\(skillPath\?\[skillPath\]:\[\]\),gamePath,logPath,\.\.\.\(conceptPath\?\[conceptPath\]:\[\]\)\]/);
  assert.doesNotMatch(worker,/timed\(trace,'tx_reads',\(\)=>Promise\.all/);
});

test('reviewed KP routing is bundled and the remaining question cache stays bounded',()=>{
  assert.match(worker,/const QUESTION_CACHE_TTL_MS = 10 \* 60 \* 1000/);
  assert.match(worker,/const QUESTION_CACHE_MAX = 400/);
  assert.match(worker,/const questionMetadataCache = new Map\(\)/);
  assert.match(worker,/import '\.\/server-kp-universe\.js'/);
  assert.match(worker,/const SERVER_KP_UNIVERSE=globalThis\.ManjingoServerKpUniverse/);
  assert.match(worker,/while\(questionMetadataCache\.size>QUESTION_CACHE_MAX\)/);
  assert.match(worker,/getQuestionMetadata\(env, token, questionId\)/);
  assert.doesNotMatch(worker,/getKnowledgePointUniverse|kpUniverseCache|STATIC_CACHE_TTL_MS/);
  assert.doesNotMatch(worker,/knowledgeCache|conceptCache|gamificationCache|answerLogCache|skillCache/);
});

test('latency optimization preserves authoritative question validation and OAuth exchange',()=>{
  assert.match(worker,/grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer'/);
  assert.match(worker,/const questionKpId = question\.data\.kpId/);
  assert.match(worker,/questionKpId && questionKpId !== answer\.kpId/);
  assert.match(worker,/getQuestionMetadata\(env, token, answer\.questionId\)/);
  assert.match(worker,/\(\{conceptKey,conceptLabel\}=reviewedConcept\(question\.data\)\)/);
});

test('daily plan prefers the private materialized state and safely falls back for migration',()=>{
  assert.match(worker,/timed\(trace,'plan_state_read'/);
  assert.match(worker,/PLAN_STATE\.usable/);
  assert.match(worker,/PLAN_STATE\.rows/);
  assert.match(worker,/timed\(trace,'knowledge_list',\(\)=>listDocuments\(env, token, `users\/\$\{uid\}\/knowledge`\)\)/);
  assert.match(worker,/timed\(trace,'skills_list',\(\)=>listDocuments\(env, token, `users\/\$\{uid\}\/skills`\)\)/);
  assert.match(worker,/timed\(trace,'concepts_list',\(\)=>listDocuments\(env, token, `users\/\$\{uid\}\/concepts`\)\)/);
  assert.match(worker,/const kpUniverseDocs=SERVER_KP_UNIVERSE\.rows/);
  assert.doesNotMatch(worker,/timed\(trace,'kp_list'/);
  assert.match(worker,/SERVER_SKILL_PLAN\.buildPlan/);
});
