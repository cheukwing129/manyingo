import vm from 'node:vm';

const baseUrl=String(process.env.MANJINGO_BASE_URL||'https://manjingo.pages.dev').replace(/\/$/,'');
async function read(path,label){const response=await fetch(baseUrl+path,{headers:{accept:'text/javascript,text/html,*/*;q=0.8'}});if(!response.ok)throw new Error(`${label} unavailable (${response.status})`);const text=await response.text();if(text.length<100)throw new Error(`${label} returned an unexpectedly small payload`);return text}
function check(value,message){if(!value)throw new Error(message)}

const[guardSource,rotationSource,firebaseSource,themeSource,uxSource,launchSource,accountSource,homeSource]=await Promise.all([
  read('/remote-sync-guard.js','remote sync guard asset'),
  read('/question-rotation.js','question rotation asset'),
  read('/firebase-config.js','firebase client asset'),
  read('/theme-runtime.js','theme runtime asset'),
  read('/ux-runtime.js','shared UX runtime asset'),
  read('/launch-state-runtime.js','launch state runtime asset'),
  read('/account-ui.js','account UI asset'),
  read('/','homepage')
]);
check(rotationSource.includes('remote-sync-guard.js'),'deployed adaptive loader does not load the remote sync guard');
check(firebaseSource.includes('dailyPlanDeferredUsers'),'deployed firebase client is missing the daily-plan read guard');
check(firebaseSource.includes('Daily plan refresh deferred to the local adaptive queue until the next page load'),'deployed firebase client is missing the local adaptive daily-plan deferral contract');
check(firebaseSource.includes('if(result&&result.success)markDailyPlanDeferred(uid)'),'deployed answer path does not defer redundant daily-plan reads after server confirmation');
check(themeSource.includes("PROGRESSIVE_BOOT_VERSION='v1'"),'deployed theme runtime is missing progressive boot version');
check(themeSource.includes("classList.remove('app-booting')"),'deployed theme runtime does not release the blocking homepage boot');
check(themeSource.includes('正在準備今日學習…')&&themeSource.includes('準備中…'),'deployed progressive boot is missing honest pending UI');
check(themeSource.includes('./ux-runtime.js')&&themeSource.includes('./launch-state-runtime.js'),'deployed theme runtime does not load the beta UX coordination runtimes');
check(uxSource.includes('enhanceEmptyLearningStates')&&uxSource.includes('enhanceStage3Recovery'),'deployed shared UX runtime is missing first-use or Stage 3 recovery states');
check(uxSource.includes("if(input)input.disabled=true")&&uxSource.includes('lesson-ux-ready'),'deployed shared UX runtime is missing answered-input locking or lesson mobile continuity');
check(launchSource.includes('ManjingoLaunchState')&&launchSource.includes('restoreTodayPlanFromCompletion'),'deployed launch state runtime cannot restore the today plan after completion');
check(launchSource.includes('manjingo:account-sync-state')&&launchSource.includes('manjingo:answer-sync-complete'),'deployed launch state runtime does not refresh learning views after cloud reconciliation');
check(accountSource.includes("result&&result.ok===true"),'deployed account UI can report sync success without explicit confirmation');
check(accountSource.includes("lastSync==='local-only'")&&accountSource.includes('雲端暫未更新，資料仍保存在本機'),'deployed account UI does not distinguish local-only sync from cloud success');
check(accountSource.includes('重試同步'),'deployed account UI is missing sync recovery action');
check(homeSource.indexOf('<script src="./theme-runtime.js"></script>')>=0&&homeSource.indexOf('<script src="./theme-runtime.js"></script>')<homeSource.indexOf('<body>'),'homepage does not run the progressive boot runtime before body parsing');
check(homeSource.includes('function schedulePreparedQuestion(targetIndex)'),'deployed homepage is missing next-question prewarming');
check(homeSource.includes("requestIdleCallback(run,{timeout:180})"),'deployed homepage does not prewarm the next question during idle time');
check(homeSource.includes('takePreparedQuestion(index)||buildQuestionFragment(q,index,questions.length)'),'deployed next button cannot consume prepared question DOM');
check(homeSource.includes('invalidatePreparedQuestion();showPlan(merged.remaining,currentPlanSource,true)'),'deployed adaptive replan does not invalidate stale prepared question DOM');
const captured=[];
const learning={
  getKnowledge:()=>({attempts:3,mastery:64,lastAnsweredAt:'2026-09-11T01:10:00.000Z'}),
  getProgress:()=>({totalXp:24,todayXp:16,streak:2,lastGoalDate:'2026-09-11'}),
  syncRemoteResult:(kpId,result)=>{captured.push({...result});return result},
  syncGamification:game=>game
};
const context={window:{ManjingoLocalLearning:learning},ManjingoLocalLearning:learning,console,Date,Number,Object,Array,String,setTimeout:fn=>{fn();return 1}};
vm.createContext(context);
vm.runInContext(guardSource,context,{filename:'production/remote-sync-guard.js'});
check(context.ManjingoRemoteSyncGuard&&typeof context.ManjingoRemoteSyncGuard.remoteKnowledgeIsNewer==='function','deployed remote sync guard API is missing');
learning.syncRemoteResult('kp1',{attempts:2,mastery:30,lastAnsweredAt:'2026-09-11T01:05:00.000Z',totalXp:8,todayXp:8,streak:1});
const stale=captured.at(-1)||{};
check(stale.mastery===undefined&&stale.attempts===undefined,'deployed sync guard allows stale knowledge rollback');
check(stale.totalXp===24&&stale.todayXp===16&&stale.streak===2,'deployed sync guard allows stale gamification rollback');
learning.syncRemoteResult('kp1',{attempts:4,mastery:55,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:12:00.000Z',totalXp:24,todayXp:16,streak:2});
const newer=captured.at(-1)||{};
check(newer.mastery===55&&newer.lastCorrect===false,'deployed sync guard blocks a genuinely newer wrong-answer update');
console.log('✓ deployed progressive boot, launch-state UX, sync recovery, next-question prewarm, nonblocking sync guard, and daily-plan read budget are healthy');
