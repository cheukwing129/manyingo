const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const firebase=fs.readFileSync(path.join(root,'public/firebase-config.js'),'utf8');
const homepage=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'public/_worker.js'),'utf8');

test('one successful answer defers expensive full daily-plan refreshes until page reload',()=>{
  assert.match(firebase,/const dailyPlanDeferredUsers = new Set\(\)/);
  assert.match(firebase,/if\(result&&result\.success\)markDailyPlanDeferred\(uid\)/);
  const planFunction=firebase.match(/export async function getDailyLearningPlan\(\) \{([\s\S]*?)\n\}/);
  assert.ok(planFunction,'getDailyLearningPlan must exist');
  assert.match(planFunction[1],/dailyPlanDeferredUsers\.has\(String\(uid\)\)/);
  assert.match(planFunction[1],/throw dailyPlanDeferredError\(\)/);
  assert.match(planFunction[1],/authorizedApi\('\/api\/daily-plan'\)/);
  assert.ok(planFunction[1].indexOf('dailyPlanDeferredUsers.has')<planFunction[1].indexOf("authorizedApi('/api/daily-plan')"),'deferred guard must run before any network request');
});

test('outbox reconciliation also defers redundant daily-plan refreshes',()=>{
  const apply=firebase.match(/function applyRetriedAnswer\(payload,result\)\{([\s\S]*?)\n\}/);
  assert.ok(apply,'applyRetriedAnswer must exist');
  assert.match(apply[1],/markDailyPlanDeferred\(currentUserId\)/);
});

test('homepage keeps local adaptive tail replanning as the no-read fallback',()=>{
  assert.match(homepage,/function refreshRemainingLocal\(\)/);
  assert.match(homepage,/scheduleRemainingPlanRefresh\(\)/);
  assert.match(homepage,/cloud replan unavailable; keeping local adaptive queue/);
  assert.match(homepage,/scheduleRemainingPlanRefresh\(\);void refreshCloudRemainingPlan\(\)/,'existing cloud refresh may request, but the API boundary must defer it after a confirmed answer');
});

test('server daily plan remains authoritative on initial load while read-heavy collections are visible to audits',()=>{
  assert.match(worker,/async function dailyPlan\(env, uid, trace, ctx, identity\)/);
  assert.match(worker,/knowledge_list/);
  assert.match(worker,/skills_list/);
  assert.match(worker,/concepts_list/);
  assert.match(worker,/interventions_list/);
  assert.equal((firebase.match(/authorizedApi\('\/api\/daily-plan'\)/g)||[]).length,1,'there must be one explicit daily-plan network boundary');
});

test('cold daily plan defers snapshot promotion through the execution context',()=>{
  assert.match(worker,/ctx&&typeof ctx\.waitUntil==='function'/);
  assert.match(worker,/ctx\.waitUntil\(task\)/);
  assert.match(worker,/planStatePromotions\.get\(uid\)/);
  assert.match(worker,/timed\(trace,'plan_state_wait'/);
});

test('fresh anonymous account returns an empty plan without a foreground Firestore call',()=>{
  const body=worker.match(/async function dailyPlan\(env, uid, trace, ctx, identity\) \{([\s\S]*?)\n\}/)[1];
  assert.match(worker,/provider==='anonymous'/);
  assert.match(worker,/now-authTime<=120/);
  assert.match(worker,/if\(identity&&identity\.freshAnonymous\)/);
  assert.match(worker,/knowledge=\[\];skills=\[\];concepts=\[\];interventions=\[\]/);
  assert.match(worker,/settleFreshPlanBootstrap\(env,uid,startedAt,ctx\)/);
  assert.ok(body.indexOf('if(identity&&identity.freshAnonymous)')<body.indexOf("timed(trace,'oauth'"));
});
