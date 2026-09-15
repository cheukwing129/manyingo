const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const planState=require('../public/plan-state-v1.js');
const worker=fs.readFileSync(path.join(root,'public','_worker.js'),'utf8');
const rules=fs.readFileSync(path.join(root,'firestore.rules'),'utf8');

test('full plan state projects only bounded planner fields and round-trips rows',()=>{
  const state=planState.full({
    knowledge:[{id:'kp1',data:{mastery:42,attempts:3,selectedAnswer:'private-noise'}}],
    skills:[{id:'trans.reorder',data:{mastery:70,kpIds:['kp1'],evidence:{productionQuestionIds:['rq007'],productionTextIds:['text1']}}}],
    concepts:[{id:'c1',data:{mastery:25,kpIds:['kp1'],questionIds:['q1'],unbounded:'omitted'}}],
    interventions:[{id:'trans.reorder',data:{skillId:'trans.reorder',routeKpId:'kp1',latestPracticeId:'practice1',history:[{practiceId:'practice1',skillId:'trans.reorder',kpId:'kp1',completedAt:'2026-09-14T00:00:00.000Z'}],learningState:{key:'remedial'}}}]
  },'2026-09-14T00:00:00.000Z');
  assert.equal(planState.usable(state),true);
  assert.equal(state.knowledgeById.kp1.mastery,42);
  assert.equal(state.knowledgeById.kp1.selectedAnswer,undefined);
  assert.equal(planState.VERSION,'plan-state-v3');
  assert.deepEqual(state.skillsById['trans.reorder'].evidence,{productionQuestionIds:['rq007'],productionTextIds:['text1']});
  assert.deepEqual(planState.rows(state,'concepts'),[{id:'c1',data:{mastery:25,kpIds:['kp1'],questionIds:['q1']}}]);
  assert.equal(state.interventionsById['trans.reorder'].history[0].practiceId,'practice1');
});

test('incremental answer and practice updates preserve completeness',()=>{
  const initial=planState.full({knowledge:[],skills:[],concepts:[],interventions:[]},'2026-09-14T00:00:00.000Z');
  const answer=planState.apply(initial,{knowledge:{id:'kp1',data:{mastery:30,attempts:1}},skills:{id:'fw.zhi',data:{mastery:30,attempts:1}}},'2026-09-14T00:01:00.000Z');
  const practice=planState.apply(answer,{interventions:{id:'fw.zhi',data:{routeKpId:'kp1',learningState:{key:'targeted'}}}},'2026-09-14T00:02:00.000Z');
  assert.equal(planState.usable(practice),true);
  assert.equal(practice.knowledgeById.kp1.mastery,30);
  assert.equal(practice.interventionsById['fw.zhi'].routeKpId,'kp1');
});

test('masked deltas quote dotted ids and never overwrite completeness',()=>{
  const delta=planState.delta({skills:{id:'trans.reorder',data:{mastery:55,attempts:2}}},'2026-09-14T00:01:00.000Z');
  assert.deepEqual(delta.fieldPaths,['version','updatedAt','skillsById.`trans.reorder`']);
  assert.equal(delta.data.complete,undefined);
  assert.equal(delta.data.skillsById['trans.reorder'].mastery,55);
});

test('partial state cannot bypass migration and concurrent writes block stale promotion',()=>{
  const partial=planState.apply(null,{knowledge:{id:'kp1',data:{mastery:20}}},'2026-09-14T00:02:00.000Z');
  assert.equal(planState.usable(partial),false);
  assert.equal(planState.changedAfter(partial,'2026-09-14T00:01:00.000Z'),true);
  assert.equal(planState.changedAfter(partial,'2026-09-14T00:03:00.000Z'),false);
});

test('legacy snapshots cannot bypass evidence and practice history migrations',()=>{
  assert.equal(planState.usable({version:'plan-state-v1',complete:true}),false);
  assert.equal(planState.usable({version:'plan-state-v2',complete:true}),false);
  assert.match(worker,/planState\/current-v3/);
});

test('practice history remains bounded inside the shared account snapshot',()=>{
  const history=Array.from({length:30},(_,index)=>({practiceId:`p${index}`}));
  const projected=planState.project('interventions',{history});
  assert.equal(projected.history.length,planState.MAX_INTERVENTION_HISTORY);
});

test('worker maintains one private snapshot inside authoritative transactions',()=>{
  assert.match(worker,/import '\.\/plan-state-v1\.js'/);
  assert.match(worker,/planStateDeltaWrite\(env,uid,plannerChanges,now\)/);
  assert.match(worker,/planStateDeltaWrite\(env,uid,\{interventions:/);
  assert.match(worker,/updateMask:\{fieldPaths\}/);
  assert.match(worker,/PLAN_STATE\.changedAfter/);
  assert.match(worker,/PLAN_STATE\.full/);
  assert.match(worker,/catch\(error=>\{console\.warn\('plan state promotion deferred',error\)/);
  assert.match(rules,/match \/planState\/\{document\}/);
  const block=rules.match(/match \/planState\/\{document\} \{([\s\S]*?)\n      \}/);
  assert.match(block[1],/request\.auth\.uid == userId/);
  assert.match(block[1],/allow write: if false/);
});

test('steady-state daily plan replaces four collection lists with one document read',()=>{
  const body=worker.match(/async function dailyPlan\(env, uid, trace, ctx, identity\) \{([\s\S]*?)\n\}/)[1];
  const fast=body.slice(0,body.indexOf('}else{'));
  assert.equal((fast.match(/getDocument\(/g)||[]).length,1);
  assert.equal((fast.match(/listDocuments\(/g)||[]).length,0);
  assert.match(fast,/PLAN_STATE\.rows/);
});

test('steady-state account sync reads one private snapshot and preserves migration fallback',()=>{
  const body=worker.match(/async function accountState\(env,uid,trace\)\{([\s\S]*?)\n\}/)[1];
  const fast=body.slice(0,body.indexOf('}else{'));
  assert.equal((fast.match(/getDocument\(/g)||[]).length,1);
  assert.equal((fast.match(/listDocuments\(/g)||[]).length,0);
  assert.match(body,/knowledgeState:Object\.fromEntries/);
  assert.match(body,/skillState:Object\.fromEntries/);
  assert.match(body,/conceptState:Object\.fromEntries/);
  assert.match(body,/SERVER_PRACTICE\.flattenInterventions\(interventions\)/);
  assert.match(body,/promotePlanState/);
  assert.match(worker,/url\.pathname === '\/api\/account-state'/);
  assert.match(body,/planStatePromotions\.get\(uid\)/);
});

test('new anonymous bootstrap only applies when no plan state document exists',()=>{
  assert.match(worker,/!plannerDoc&&identity&&identity\.freshAnonymous/);
  assert.match(worker,/settlePlanStatePromotion\(env,token,uid,\{knowledge,skills,concepts,interventions\},startedAt,ctx\)/);
  assert.match(worker,/return\{uid:String\(payload\.sub\),freshAnonymous:provider==='anonymous'/);
});
