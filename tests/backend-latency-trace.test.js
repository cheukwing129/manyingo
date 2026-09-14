const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('worker exposes only fixed safe latency stages through Server-Timing',()=>{
  const source=read('public/_worker.js');
  assert.match(source,/function withServerTiming\(response,trace\)/);
  assert.match(source,/headers\.set\('server-timing'/);
  assert.match(source,/timed\(trace,'auth'/);
  assert.match(source,/timed\(trace,'oauth'/);
  assert.match(source,/timed\(trace,'knowledge_list'/);
  assert.match(source,/timed\(trace,'concepts_list'/);
  assert.match(source,/timed\(trace,'interventions_list'/);
  assert.match(source,/timed\(trace,'kp_list'/);
  assert.match(source,/timed\(trace,'plan_state_read'/);
  assert.match(source,/timed\(trace,'question_read'/);
  assert.match(source,/timed\(trace,'tx_begin'/);
  assert.match(source,/timed\(trace,'tx_reads'/);
  assert.match(source,/timed\(trace,'commit'/);
  assert.match(source,/timed\(trace,'practice_tx_begin'/);
  assert.match(source,/timed\(trace,'practice_tx_reads'/);
  assert.match(source,/timed\(trace,'practice_commit'/);
  assert.match(source,/timed\(trace,'practice_tx_rollback'/);
  assert.doesNotMatch(source,/server-timing[^\n]*(uid|token|email|answerId|practiceId)/i);
});

test('health response carries total Server-Timing without exposing credentials',async()=>{
  const worker=(await import(`${pathToFileURL(path.join(root,'public/_worker.js')).href}?latency=${Date.now()}`)).default;
  const response=await worker.fetch(new Request('https://example.test/api/health'),{
    FIREBASE_PROJECT_ID:'manjingo-95d9a',
    FIREBASE_CLIENT_EMAIL:'configured@example.test',
    FIREBASE_PRIVATE_KEY:'secret',
    ASSETS:{fetch:()=>new Response('asset')}
  });
  assert.equal(response.status,200);
  const timing=response.headers.get('server-timing')||'';
  assert.match(timing,/total;dur=\d+(?:\.\d+)?/);
  assert.doesNotMatch(timing,/configured@example|secret|manjingo-95d9a/);
});

test('production smoke requires and prints latency breakdowns before accepting backend E2E',()=>{
  const source=read('scripts/smoke_pages_api.mjs');
  assert.match(source,/function reportTiming\(response, label, required = \[\]\)/);
  assert.match(source,/console\.log\(`⏱ \$\{label\}: \$\{value\}`\)/);
  assert.match(source,/reportTiming\(planResponse, 'daily-plan', \['auth','oauth','plan_state_read','kp_list','total'\]\)/);
  assert.match(source,/reportTiming\(practiceResponse, 'practice-session', \['auth','oauth','kp_list','practice_tx_begin','practice_tx_reads','practice_commit','total'\]\)/);
  assert.match(source,/reportTiming\(practiceStateResponse, 'practice-state', \['auth','oauth','interventions_list','total'\]\)/);
  assert.match(source,/reportTiming\(duplicatePracticeResponse, 'practice-duplicate', \['auth','oauth','kp_list','practice_tx_begin','practice_tx_reads','practice_tx_rollback','total'\]\)/);
  assert.match(source,/reportTiming\(submitResponse, 'submit-answer', \['auth','oauth','question_read','tx_begin','tx_reads','commit','total'\]\)/);
});
