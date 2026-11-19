const test=require('node:test');
const assert=require('node:assert/strict');
const sync=require('../public/account-sync.js');

test('cross-device merge keeps the newer knowledge record on each KP',()=>{
 const local={totalXp:80,todayXp:10,todayDate:'2026-09-10',streak:4,knowledge:{a:{attempts:5,mastery:60,lastAnsweredAt:'2026-09-10T10:00:00Z'},b:{attempts:2,mastery:30,lastAnsweredAt:'2026-09-09T10:00:00Z'}},conceptMastery:{},practiceHistory:[]};
 const remote={totalXp:100,todayXp:16,todayDate:'2026-09-10',streak:3,knowledge:{a:{attempts:4,mastery:55,lastAnsweredAt:'2026-09-10T11:00:00Z'},b:{attempts:3,mastery:45,lastAnsweredAt:'2026-09-10T09:00:00Z'}},conceptMastery:{},practiceHistory:[]};
 const merged=sync.mergeLearningState(local,remote);
 assert.equal(merged.totalXp,100);
 assert.equal(merged.todayXp,16);
 assert.equal(merged.streak,4);
 assert.equal(merged.knowledge.a.mastery,60);
 assert.equal(merged.knowledge.b.mastery,45);
});

test('equal-attempt records use the most recent answer timestamp',()=>{
 const local={knowledge:{a:{attempts:3,mastery:40,lastAnsweredAt:'2026-09-10T09:00:00Z'}}};
 const remote={knowledge:{a:{attempts:3,mastery:52,lastAnsweredAt:'2026-09-10T10:00:00Z'}}};
 assert.equal(sync.mergeLearningState(local,remote).knowledge.a.mastery,52);
});

test('practice history is unioned, deduplicated, ordered and assigned stable practice ids',()=>{
 const first={skillId:'fw.zhi',kpId:'a',routeKpId:'a',completedAt:'2026-09-10T10:00:00Z',strategy:'targeted',beforeMastery:40,afterMastery:50};
 const second={skillId:'fw.zhi',kpId:'a',routeKpId:'a',completedAt:'2026-09-10T11:00:00Z',strategy:'remedial',beforeMastery:50,afterMastery:58};
 const merged=sync.mergePracticeHistory([first],[first,second]);
 assert.equal(merged.length,2);
 assert.equal(merged[0].strategy,'remedial');
 assert.equal(merged[1].strategy,'targeted');
 assert.match(merged[0].practiceId,/^pr_[a-z0-9]+$/);
 assert.equal(sync.ensurePracticeIdentity(first).practiceId,sync.ensurePracticeIdentity(first).practiceId);
});

test('different skills on one shared route keep distinct deterministic practice ids',()=>{
 const base={kpId:'shared',routeKpId:'shared',completedAt:'2026-09-10T10:00:00Z',strategy:'targeted',beforeMastery:40,afterMastery:42};
 const a=sync.ensurePracticeIdentity({...base,skillId:'fw.nai'}),b=sync.ensurePracticeIdentity({...base,skillId:'fw.ze'}),merged=sync.mergePracticeHistory([a],[b]);
 assert.notEqual(a.practiceId,b.practiceId);
 assert.equal(merged.length,2);
});

test('server-native intervention state wins an equal-time local projection',()=>{
 const local={skill:{skillId:'skill',key:'remedial',updatedAt:'2026-09-10T10:00:00Z',source:'local-projection'}};
 const remote={skill:{skillId:'skill',key:'reteach',updatedAt:'2026-09-10T10:00:00Z',source:'server-native-v1'}};
 assert.equal(sync.mergeInterventionState(local,remote).skill.key,'reteach');
});

test('server practice state restores history and intervention after local practice data is absent',()=>{
 const merged=sync.mergeServerPractice({knowledge:{},practiceHistory:[],interventionState:{}},{practiceHistory:[{practiceId:'practice_001',skillId:'fw.zhi',kpId:'kp_virtual_zhi',routeKpId:'kp_virtual_zhi',completedAt:'2026-09-10T10:00:00Z'}],interventionState:{'fw.zhi':{skillId:'fw.zhi',key:'remedial',updatedAt:'2026-09-10T10:01:00Z',source:'server-native-v1'}}});
 assert.equal(merged.practiceHistory.length,1);
 assert.equal(merged.practiceHistory[0].practiceId,'practice_001');
 assert.equal(merged.interventionState['fw.zhi'].key,'remedial');
});

test('client sync snapshot strips practice history and intervention state once server persistence owns them',()=>{
 const snapshot=sync.snapshotLearningState({totalXp:20,knowledge:{a:{}},practiceHistory:[{practiceId:'p'}],interventionState:{x:{key:'remedial'}}});
 assert.equal(snapshot.totalXp,20);
 assert.deepEqual(snapshot.knowledge,{a:{}});
 assert.equal('practiceHistory' in snapshot,false);
 assert.equal('interventionState' in snapshot,false);
});

test('question rotation merge keeps local recency then appends remote unique ids',()=>{
 const merged=sync.mergeRotation({kp:['q5','q4','q3']},{kp:['q4','q2','q1']});
 assert.deepEqual(Array.from(merged.kp),['q5','q4','q3','q2','q1']);
});

test('ordinary per-KP rotation remains capped at eight across devices',()=>{
 const local={kp:Array.from({length:7},(_,i)=>'l'+i)};
 const remote={kp:Array.from({length:7},(_,i)=>'r'+i)};
 const merged=sync.mergeRotation(local,remote);
 assert.equal(merged.kp.length,sync.MAX_ROTATION_PER_KP);
 assert.equal(sync.MAX_ROTATION_PER_KP,8);
});

test('source sentence cooldown keeps up to 24 entries across devices',()=>{
 const local={__sourceSentences:Array.from({length:16},(_,i)=>'local:'+i)};
 const remote={__sourceSentences:Array.from({length:16},(_,i)=>'remote:'+i)};
 const merged=sync.mergeRotation(local,remote);
 assert.equal(sync.SENTENCE_HISTORY_KEY,'__sourceSentences');
 assert.equal(sync.MAX_SENTENCE_HISTORY,24);
 assert.equal(merged.__sourceSentences.length,24);
 assert.deepEqual(merged.__sourceSentences.slice(0,3),['local:0','local:1','local:2']);
});

test('gamification merge never moves total XP or streak backwards',()=>{
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 const merged=sync.mergeGame({totalXp:120,todayXp:12,todayDate:today,streak:6},{totalXp:100,todayXp:20,todayXpDate:today,streak:5});
 assert.equal(merged.totalXp,120);
 assert.equal(merged.todayXp,20);
 assert.equal(merged.streak,6);
});


test('streak sync preserves collections while accepting a newer restarted streak',()=>{
 const merged=sync.mergeLearningState({streak:15,longestStreak:20,lastGoalDate:'2026-09-01',streakCelebratedThrough:15},{streak:2,longestStreak:5,lastGoalDate:'2026-09-10',streakCelebratedThrough:5});
 assert.equal(merged.streak,2);assert.equal(merged.longestStreak,20);assert.equal(merged.streakCelebratedThrough,15);
 assert.equal(sync.mergeLearningState({streak:2,lastGoalDate:'2026-09-10'},{streak:15,lastGoalDate:'2026-09-01'}).streak,2);
});
test('remote game uses lastActiveDate to avoid reviving an obsolete longer streak',()=>{
 const merged=sync.mergeGame({streak:20,lastGoalDate:'2026-09-01'},{streak:1,lastActiveDate:'2026-09-10'});
 assert.equal(merged.streak,1);assert.equal(merged.longestStreak,20);assert.equal(merged.lastGoalDate,'2026-09-10');
});
test('old daily XP does not count toward today after account sync',()=>{
 const merged=sync.mergeGame({todayXp:18,todayDate:'2000-01-01'},{todayXp:20,todayXpDate:'2000-01-02'});
 assert.equal(merged.todayXp,0);
});
