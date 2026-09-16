const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','public','local-learning.js'),'utf8');

function harness(initial){
  const store=new Map(Object.entries(initial||{}));
  let gets=0,sets=0,parses=0,stringifies=0;
  const json={...JSON,parse(value){parses+=1;return JSON.parse(value)},stringify(value){stringifies+=1;return JSON.stringify(value)}};
  const context={window:{ManjingoContent:{questions:[]}},localStorage:{getItem:key=>{gets+=1;return store.has(key)?store.get(key):null},setItem:(key,value)=>{sets+=1;store.set(key,String(value))},removeItem:key=>store.delete(key)},Date,console,JSON:json,Math,Number,String,Object,Array,Map,Set};
  vm.createContext(context);vm.runInContext(source,context);
  return{engine:context.window.ManjingoLocalLearning,store,counts:()=>({gets,sets,parses,stringifies})};
}

test('unchanged learning state reuses parsed cache and read-only progress does not rewrite storage',()=>{
  const state={totalXp:16,todayXp:8,streak:2,todayDate:new Date().toISOString().slice(0,10),knowledge:{kp_a:{mastery:42,misconceptions:{}}},skillMastery:{},conceptMastery:{},practiceHistory:[]};
  const h=harness({manjingo_progress_cache:JSON.stringify(state)});
  h.engine.getProgress();
  const first=h.counts();
  h.engine.getProgress();h.engine.getKnowledge('kp_a');h.engine.getProgress();
  const after=h.counts();
  assert.equal(after.parses,first.parses,'unchanged raw state should not be reparsed');
  assert.equal(after.sets,first.sets,'read-only calls should not rewrite the full learning payload');
  assert.equal(after.stringifies,first.stringifies,'read-only calls should not stringify the full learning payload');
});

test('same-tab external storage writes invalidate the parsed cache',()=>{
  const today=new Date().toISOString().slice(0,10),initial={totalXp:8,todayXp:8,streak:1,todayDate:today,knowledge:{kp_a:{mastery:22,misconceptions:{}}},skillMastery:{},conceptMastery:{},practiceHistory:[]};
  const h=harness({manjingo_progress_cache:JSON.stringify(initial)});
  assert.equal(h.engine.getKnowledge('kp_a').mastery,22);
  const external={...initial,totalXp:99,knowledge:{kp_a:{mastery:77,misconceptions:{}}}};
  h.store.set('manjingo_progress_cache',JSON.stringify(external));
  assert.equal(h.engine.getKnowledge('kp_a').mastery,77);
  assert.equal(h.engine.getProgress().totalXp,99);
});
