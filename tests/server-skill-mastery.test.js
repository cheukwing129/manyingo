const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('answer transaction derives a trusted core skill from reviewed metadata and curriculum migration',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/import '\.\/curriculum-v1\.js'/);
 assert.match(worker,/import '\.\/question-skill-contract\.js'/);
 assert.match(worker,/function coreSkillId\(questionData,kpId,targetSkillId\)/);
 assert.match(worker,/resolveCoreSkill\(questionData,kpId,targetSkillId,CURRICULUM\)/);
 const answerValidation=worker.match(/function validateAnswer\(raw\) \{([\s\S]*?)\n\}\nfunction validatePracticeSession/);
 assert.ok(answerValidation);
 assert.doesNotMatch(answerValidation[1],/raw\.skillId/);
 assert.match(answerValidation[1],/raw\.targetSkillId/);
});

test('answer transaction accepts only a target skill validated against the reviewed question',()=>{
 const worker=read('public/_worker.js'),client=read('public/index.html');
 assert.match(client,/targetSkillId:q\.skillId\|\|null/);
 assert.match(worker,/coreSkillId\(question\.data, answer\.kpId, answer\.targetSkillId\)/);
 assert.match(worker,/targetSkillId requires a known questionId/);
 assert.match(worker,/requestedSkillId:answer\.targetSkillId/);
});

test('server commits skill mastery atomically with KP gamification and answer log',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/users\/\$\{uid\}\/skills\/\$\{skillId\}/);
 assert.match(worker,/const skillDoc=skillPath\?txDocs\[cursor\+\+\]:null/);
 assert.match(worker,/calculateLearningUpdate\(skillPrev,answer,baseXp,now\)/);
 assert.match(worker,/source:'server-native-v1'/);
 assert.match(worker,/if\(skillPath&&nativeSkill\)writes\.push\(updateWrite\(env,skillPath,nativeSkill\)\)/);
 assert.match(worker,/skillId, skillMastery/);
});

test('server records versioned evidence before granting verified mastery',()=>{
 const worker=read('public/_worker.js'),client=read('public/question-rotation.js');
 assert.match(worker,/import '\.\/skill-evidence-v1\.js'/);
 assert.match(worker,/SKILL_EVIDENCE\.update\(skillPrev\.evidence,answer,questionData,skillId,now\)/);
 assert.match(worker,/nativeSkill\.masteryVerified=verification\.verified/);
 assert.match(client,/skill-evidence-v1\.js[\s\S]*skill-mastery-v1\.js[\s\S]*skill-results-v1\.js/);
});

test('answer idempotency returns the originally committed skill result',()=>{
 const worker=read('public/_worker.js');
 assert.match(worker,/if \(logDoc\)/);
 assert.match(worker,/skillId: existing\.skillId \|\| skillId \|\| null/);
 assert.match(worker,/skillMastery: existing\.skillMastery \|\| null/);
 assert.match(worker,/duplicate: true/);
});

test('account sync downloads authoritative skill documents and feeds the local engine',()=>{
 const firebase=read('public/firebase-config.js');
 const sync=read('public/account-sync.js');
 assert.match(firebase,/export async function fetchUserSkillState\(userId\)/);
 assert.match(firebase,/collection\(db, "users", userId, "skills"\)/);
 assert.match(firebase,/source:data\.source\|\|'server-native-v1'/);
 assert.match(sync,/fb\.fetchUserSkillState\(uid\)/);
 assert.match(sync,/engine\.syncRemoteSkillState\(skillState\|\|\{\}\)/);
 assert.match(sync,/skillMastery:skillState\|\|\{\}/);
});

test('local learning preserves native skill mastery across later KP and gamification writes',()=>{
 const source=read('public/local-learning.js'),store=new Map();
 const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
 const window={ManjingoLearningPolicy:null,ManjingoContent:{questions:[]}};
 const context={window,localStorage,Date,Map,Set,Array,Object,String,Number,Math,JSON};
 vm.createContext(context);vm.runInContext(source,context);
 const engine=window.ManjingoLocalLearning;
 engine.syncRemoteSkillState({'fw.yi':{skillId:'fw.yi',mastery:52,attempts:4,lastAnsweredAt:'2026-09-12T04:00:00Z',kpIds:['kp_virtual_yi'],source:'server-native-v1'}});
 engine.syncRemoteResult('kp_virtual_yi',{mastery:40,attempts:2,lastAnsweredAt:'2026-09-12T04:01:00Z',totalXp:8,todayXp:8,streak:1});
 engine.syncGamification({totalXp:16,todayXp:16,streak:1});
 const state=JSON.parse(store.get('manjingo_progress_cache'));
 assert.equal(state.skillMastery['fw.yi'].mastery,52);
 assert.equal(state.skillMastery['fw.yi'].source,'server-native-v1');
 assert.deepEqual(Array.from(state.skillMastery['fw.yi'].kpIds),['kp_virtual_yi']);
});

test('stale skill snapshots cannot overwrite newer native progress',()=>{
 const source=read('public/local-learning.js'),store=new Map();
 const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
 const window={ManjingoLearningPolicy:null,ManjingoContent:{questions:[]}};
 const context={window,localStorage,Date,Map,Set,Array,Object,String,Number,Math,JSON};
 vm.createContext(context);vm.runInContext(source,context);
 const engine=window.ManjingoLocalLearning;
 engine.syncRemoteSkillState({'fw.yi':{skillId:'fw.yi',mastery:70,attempts:5,lastAnsweredAt:'2026-09-12T05:00:00Z',source:'server-native-v1'}});
 engine.syncRemoteSkillState({'fw.yi':{skillId:'fw.yi',mastery:30,attempts:4,lastAnsweredAt:'2026-09-12T06:00:00Z',source:'server-native-v1'}});
 const state=JSON.parse(store.get('manjingo_progress_cache'));
 assert.equal(state.skillMastery['fw.yi'].mastery,70);
 assert.equal(state.skillMastery['fw.yi'].attempts,5);
});

test('Firestore exposes skill mastery read-only to its owner',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/match \/skills\/\{skillId\}/);
 const block=rules.match(/match \/skills\/\{skillId\} \{([\s\S]*?)\n      \}/);
 assert.ok(block);
 assert.match(block[1],/allow read: if request\.auth != null && request\.auth\.uid == userId/);
 assert.match(block[1],/allow write: if false/);
});

test('server-native skill tie wins over an equally fresh projection during account merge',()=>{
 const sync=require('../public/account-sync.js');
 const time='2026-09-12T05:00:00Z';
 const merged=sync.mergeLearningState({skillMastery:{'fw.yi':{mastery:45,attempts:3,lastAnsweredAt:time,source:'legacy-projection'}}},{skillMastery:{'fw.yi':{mastery:61,attempts:3,lastAnsweredAt:time,source:'server-native-v1'}}});
 assert.equal(merged.skillMastery['fw.yi'].mastery,61);
 assert.equal(merged.skillMastery['fw.yi'].source,'server-native-v1');
});
