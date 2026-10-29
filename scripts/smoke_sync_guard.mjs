import vm from 'node:vm';

const baseUrl=String(process.env.MANJINGO_BASE_URL||'https://manyingo.pages.dev').replace(/\/$/,'');
async function read(path,label){const response=await fetch(baseUrl+path,{headers:{accept:'text/javascript,text/html,*/*;q=0.8'}});if(!response.ok)throw new Error(`${label} unavailable (${response.status})`);const text=await response.text();if(text.length<100)throw new Error(`${label} returned an unexpectedly small payload`);return text}
function check(value,message){if(!value)throw new Error(message)}

const[learningSource,lessonSource,firebaseSource,themeSource,uxSource,launchSource,accountSource,homeSource]=await Promise.all([
  read('/local-learning.js','local learning engine'),
  read('/lesson.html','lesson entry'),
  read('/firebase-config.js','firebase client asset'),
  read('/theme-runtime.js','theme runtime asset'),
  read('/ux-runtime.js','shared UX runtime asset'),
  read('/launch-state-runtime.js','launch state runtime asset'),
  read('/account-ui.js','account UI asset'),
  read('/','homepage')
]);
check(homeSource.includes('./local-learning.js')&&lessonSource.includes('./local-learning.js'),'deployed page entry is missing the local learning engine');
check(firebaseSource.includes('dailyPlanDeferredUsers'),'deployed firebase client is missing the daily-plan read guard');
check(firebaseSource.includes('Daily plan refresh deferred to the local adaptive queue until the next page load'),'deployed firebase client is missing the local adaptive daily-plan deferral contract');
check(firebaseSource.includes('if(result&&result.success)markDailyPlanDeferred(uid)'),'deployed answer path does not defer redundant daily-plan reads after server confirmation');
check(themeSource.includes("PROGRESSIVE_BOOT_VERSION='v1'"),'deployed theme runtime is missing progressive boot version');
check(themeSource.includes("classList.remove('app-booting')"),'deployed theme runtime does not release the blocking homepage boot');
check(themeSource.includes('正在準備今日學習…')&&themeSource.includes('準備中…'),'deployed progressive boot is missing honest pending UI');
check(themeSource.includes('./ux-runtime.js')&&themeSource.includes('./launch-state-runtime.js'),'deployed theme runtime does not load the beta UX coordination runtimes');
check(uxSource.includes('enhanceEmptyLearningStates')&&uxSource.includes('enhanceStage3Recovery'),'deployed shared UX runtime is missing first-use or Stage 3 recovery states');
check(uxSource.includes('setDisabledIfChanged(input,true)')&&uxSource.includes("classList.add('lesson-ux-ready')"),'deployed shared UX runtime is missing answered-input locking or lesson mobile continuity');
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
// Exercise the deployed persistence boundary directly, before account loaders.
const values=new Map([['manjingo_progress_cache',JSON.stringify({totalXp:24,todayXp:16,streak:2,lastGoalDate:'2026-09-11',todayDate:'2026-09-11',knowledge:{kp1:{attempts:3,mastery:64,lastCorrect:true,lastAnsweredAt:'2026-09-11T01:10:00.000Z'}},conceptMastery:{},skillMastery:{},practiceHistory:[]})]]);
const RealDate=Date,fixed=Date.parse('2026-09-11T02:00:00.000Z');
class FakeDate extends RealDate{constructor(...args){super(...(args.length?args:[fixed]))}static now(){return fixed}}
const context={console,Date:FakeDate,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value))}};
context.window=context;
vm.createContext(context);
vm.runInContext(learningSource,context,{filename:'production/local-learning.js'});
const learning=context.ManjingoLocalLearning;
check(learning&&typeof learning.syncRemoteResult==='function','deployed reconciliation API is missing');
const stale=learning.syncRemoteResult('kp1',{attempts:2,mastery:30,lastAnsweredAt:'2026-09-11T01:05:00.000Z',totalXp:8,todayXp:8,streak:1});
check(stale.mastery===64&&stale.attempts===3,'deployed sync boundary allows stale knowledge rollback');
check(stale.totalXp===24&&stale.todayXp===16&&stale.streak===2,'deployed sync boundary allows stale gamification rollback');
const newer=learning.syncRemoteResult('kp1',{attempts:4,mastery:55,lastCorrect:false,lastAnsweredAt:'2026-09-11T01:12:00.000Z',totalXp:24,todayXp:16,streak:2});
check(newer.mastery===55&&newer.lastCorrect===false,'deployed sync boundary blocks a genuinely newer wrong-answer update');
check(learning.getKnowledge('kp1').mastery===55,'deployed sync boundary did not persist the newer record');
console.log('✓ deployed progressive homepage boot, launch-state UX, sync recovery, next-question prewarm, nonblocking sync guard, and daily-plan read budget are healthy');
