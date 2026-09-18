'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'public/home-shell.js'),'utf8');
const CORE=['reorder-question.js','question-metadata-v1.js','question-diversity-v1.js','question-rotation.js','answer-outbox.js'];

function loadDeferralShell(){
  const writes=[],listeners={};
  const document={
    readyState:'loading',
    body:{classList:{contains(){return false}}},
    head:{appendChild(){}},
    write(value){writes.push(String(value))},
    addEventListener(name,fn){(listeners[name]||(listeners[name]=[])).push(fn)}
  };
  const window={document,addEventListener(){},dispatchEvent(){}};
  const context={window,document,location:{hash:'',pathname:'/',search:''},console,Promise,Date,setTimeout,clearTimeout,CustomEvent:function(){}};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'home-shell.js'});
  return{shell:window.ManjingoHomeShell,window,document,writes,listeners};
}

function startHandlerSource(home){
  const start=home.indexOf("document.getElementById('start').onclick=async function()");
  const end=home.indexOf('function revealApp()',start);
  assert.ok(start>=0&&end>start,'start handler missing');
  return home.slice(start,end);
}

function loadStudyPlanShell(options={}){
  const appended=[],scripts=[],failed=new Set(),failOnceSrc=options.failOnceSrc||null;
  const document={
    readyState:'complete',
    scripts,
    body:{classList:{contains(){return false}}},
    head:{appendChild(script){
      appended.push(script.src);scripts.push(script);
      setTimeout(()=>{
        if(failOnceSrc===script.src&&!failed.has(script.src)){failed.add(script.src);if(script._listeners.error)script._listeners.error();return}
        if(script._listeners.load)script._listeners.load();
      },0);
    }},
    createElement(tag){
      if(tag!=='script')return{};
      return{src:'',async:true,_listeners:{},setAttribute(){},getAttribute(name){return name==='src'?this.src:null},addEventListener(name,fn){this._listeners[name]=fn},remove(){const index=scripts.indexOf(this);if(index>=0)scripts.splice(index,1)}};
    },
    addEventListener(){}
  };
  const window={document,addEventListener(){},dispatchEvent(){}};
  const context={window,document,location:{hash:'',pathname:'/',search:''},console,Promise,Date,setTimeout,clearTimeout,CustomEvent:function(){}};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'home-shell.js'});
  return{shell:window.ManjingoHomeShell,window,document,appended};
}

test('homepage replaces parser-blocking app runtime with a small reviewed core',()=>{
  const{shell,window,document,writes}=loadDeferralShell();
  assert.equal(shell.installStartupRuntimeDeferral(),true);
  document.write('<script src="./app-runtime.js"></script>');
  assert.equal(writes.length,1);
  assert.doesNotMatch(writes[0],/app-runtime\.js/);
  for(const file of CORE)assert.match(writes[0],new RegExp(file.replaceAll('.','\\.')));
  assert.match(writes[0],/<\/script>/);
  assert.equal(window.ManjingoStartupRuntimeBundled,true);
  assert.equal(window.ManjingoHomeRuntimeDeferral.core.length,CORE.length);
  assert.equal(typeof window.ManjingoEnsureAppRuntime,'function');
});

test('homepage parser core is much smaller than the legacy app runtime',()=>{
  const coreBytes=CORE.reduce((sum,file)=>sum+fs.statSync(path.join(root,'public',file)).size,0);
  const fullBytes=fs.statSync(path.join(root,'public','app-runtime.js')).size;
  assert.ok(coreBytes<40000,`critical core unexpectedly grew to ${coreBytes} bytes`);
  assert.ok(coreBytes<fullBytes*.2,`critical core ${coreBytes} is not materially smaller than ${fullBytes}`);
});

test('secondary UI and account work stays off parser startup and yields to study input',()=>{
  for(const file of ['learning-path-ui.js','weakness-panel.js','mastery-dashboard.js','practice-effectiveness.js','account-sync.js','account-ui.js'])assert.match(source,new RegExp("'\\./"+file.replaceAll('.','\\.')+"'"));
  assert.match(source,/function whenDomReady\(\)\{if\(document\.readyState!=='loading'\)return Promise\.resolve\(true\)/);
  assert.match(source,/deferredRuntimePromise=whenDomReady\(\)\.then\(\(\)=>loadRuntimeSequence\(DEFERRED_APP_RUNTIME\)\)/);
  assert.match(source,/runtimeStudyActive\(\)\|\|Date\.now\(\)-lastInteractionAt<900/);
  assert.match(source,/requestIdleCallback\(run,\{timeout:3500\}\)/);
  assert.match(source,/if\(view!=='today'\)void requestViewRuntime\(view\)\.catch/);
  assert.match(source,/window\.ManjingoStartupRuntimeBundled=true/);
});

test('secondary home views lazy-load only their required runtime groups',()=>{
  assert.match(source,/const VIEW_RUNTIME_COMMON=\['\.\/curriculum-v1\.js','\.\/skill-evidence-v1\.js','\.\/skill-mastery-v1\.js','\.\/skill-first-plan\.js','\.\/skill-results-v1\.js','\.\/practice-effectiveness\.js'\]/);
  assert.match(source,/path:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/learning-path\.js','\.\/learning-path-ui\.js'\]/);
  assert.match(source,/weakness:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/weakness-panel\.js'\]/);
  assert.match(source,/results:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/mastery-dashboard\.js'\]/);
  assert.match(source,/function ensureViewRuntime\(view\)/);
  assert.match(source,/window\.ManjingoEnsureViewRuntime=ensureViewRuntime/);
});

test('secondary views install skill-first selection before practice effectiveness',()=>{
  const common=source.match(/const VIEW_RUNTIME_COMMON=\[(.*?)\];/s);
  assert.ok(common,'view runtime common list missing');
  const skillFirst=common[1].indexOf('./skill-first-plan.js');
  const practice=common[1].indexOf('./practice-effectiveness.js');
  assert.ok(skillFirst>=0&&practice>skillFirst,'skill-first-plan must load before practice-effectiveness in every secondary view');
});

test('secondary view UI stays out of automatic background runtime',()=>{
  const match=source.match(/const DEFERRED_APP_RUNTIME=\[(.*?)\];/s);
  assert.ok(match,'deferred runtime list missing');
  for(const file of ['learning-path-ui.js','weakness-panel.js','mastery-dashboard.js'])assert.doesNotMatch(match[1],new RegExp(file.replaceAll('.','\\.')));
  assert.match(source,/path:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/learning-path\.js','\.\/learning-path-ui\.js'\]/);
  assert.match(source,/weakness:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/weakness-panel\.js'\]/);
  assert.match(source,/results:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/mastery-dashboard\.js'\]/);
});

test('runtime already covered by view or study loaders stays out of automatic background',()=>{
  const deferred=source.match(/const DEFERRED_APP_RUNTIME=\[(.*?)\];/s);
  const common=source.match(/const VIEW_RUNTIME_COMMON=\[(.*?)\];/s);
  const study=source.match(/const STUDY_RUNTIME=\[(.*?)\];/s);
  assert.ok(deferred&&common&&study,'runtime groups missing');
  for(const file of ['learning-path.js','skill-results-v1.js','skill-evidence-v1.js'])assert.doesNotMatch(deferred[1],new RegExp(file.replaceAll('.','\\.')));
  assert.match(common[1],/\.\/skill-results-v1\.js/);
  assert.match(common[1],/\.\/skill-evidence-v1\.js/);
  assert.match(study[1],/\.\/learning-path\.js/);
  assert.match(source,/path:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/learning-path\.js','\.\/learning-path-ui\.js'\]/);
});

test('adaptive study-plan dependencies stay out of automatic background runtime',()=>{
  assert.match(source,/const STUDY_PLAN_RUNTIME_STAGES=\[\s*\['\.\/curriculum-v1\.js','\.\/skill-mastery-v1\.js','\.\/question-pack-adaptive-01\.js','\.\/question-pack-adaptive-02\.js','\.\/question-pack-adaptive-03\.js','\.\/difficulty-calibration\.js'\],\s*\['\.\/skill-first-plan\.js','\.\/question-difficulty\.js'\],\s*\['\.\/practice-effectiveness\.js','\.\/difficulty-observability\.js'\]\s*\];/s);
  const deferred=source.match(/const DEFERRED_APP_RUNTIME=\[(.*?)\];/s);
  assert.ok(deferred,'deferred runtime list missing');
  for(const file of ['curriculum-v1.js','skill-mastery-v1.js','skill-first-plan.js','question-pack-adaptive-01.js','question-pack-adaptive-02.js','question-pack-adaptive-03.js','difficulty-calibration.js','question-difficulty.js','difficulty-observability.js','practice-effectiveness.js'])assert.doesNotMatch(deferred[1],new RegExp(file.replaceAll('.','\\.')));
  for(const file of ['remote-sync-guard.js','account-sync.js','account-ui.js'])assert.match(deferred[1],new RegExp(file.replaceAll('.','\\.')));
  const stages=source.slice(source.indexOf('const STUDY_PLAN_RUNTIME_STAGES='),source.indexOf('const DEFERRED_APP_RUNTIME='));
  assert.doesNotMatch(stages,/skill-evidence-v1\.js/,'skill evidence must stay view-only and outside study-plan runtime');
  assert.match(source,/function loadRuntimeStage\(files\)\{return Promise\.all\(\(files\|\|\[\]\)\.map\(src=>loadDeferredScript\(src\)\)\)\}/);
  assert.match(source,/function loadRuntimeStages\(stages\)\{return \(stages\|\|\[\]\)\.reduce\(\(promise,files\)=>promise\.then\(\(\)=>loadRuntimeStage\(files\)\),Promise\.resolve\(\)\)\}/);
});

test('study plan runtime deduplicates concurrent prewarm and preserves stage order',async()=>{
  const{shell,appended}=loadStudyPlanShell();
  const first=shell.prewarmStudyPlanRuntime(),second=shell.prewarmStudyPlanRuntime();
  assert.equal(first,second,'concurrent prewarm must reuse one promise');
  await first;
  const stage1=['./curriculum-v1.js','./skill-mastery-v1.js','./question-pack-adaptive-01.js','./question-pack-adaptive-02.js','./question-pack-adaptive-03.js','./difficulty-calibration.js'];
  const stage2=['./skill-first-plan.js','./question-difficulty.js'];
  const stage3=['./practice-effectiveness.js','./difficulty-observability.js'];
  assert.deepEqual(appended,[...stage1,...stage2,...stage3]);
  await shell.ensureStudyPlanRuntime();
  assert.deepEqual(appended,[...stage1,...stage2,...stage3],'ensure must reuse the completed prewarm');
});

test('study plan runtime retries a failed script instead of accepting its stale node',async()=>{
  const failedSrc='./difficulty-calibration.js',{shell,appended}=loadStudyPlanShell({failOnceSrc:failedSrc});
  await assert.rejects(shell.prewarmStudyPlanRuntime(),/Unable to load \.\/difficulty-calibration\.js/);
  await shell.prewarmStudyPlanRuntime();
  assert.equal(appended.filter(src=>src===failedSrc).length,2,'failed script must be requested again');
  assert.equal(appended.filter(src=>src==='./curriculum-v1.js').length,1,'successful stage peers should stay deduplicated');
  assert.equal(appended.filter(src=>src==='./skill-first-plan.js').length,1,'later stages should run once after retry succeeds');
  assert.match(source,/typeof script\.remove==='function'\)script\.remove\(\)/);
  assert.match(source,/studyPlanRuntimePromise=null;studyPlanRuntimeReadyAt=0;console\.warn\('study plan runtime unavailable'/);
});

test('study feedback runtime stays lazy and resets summary before the first question',()=>{
  const study=source.match(/const STUDY_RUNTIME=\[(.*?)\];/s);
  const deferred=source.match(/const DEFERRED_APP_RUNTIME=\[(.*?)\];/s);
  assert.ok(study,'study runtime list missing');
  assert.ok(deferred,'deferred runtime list missing');
  assert.match(study[1],/\.\/learning-path\.js/);
  for(const file of ['mascot-runtime.js','feedback-ui.js','session-summary.js']){
    assert.match(study[1],new RegExp(file.replaceAll('.','\\.')));
    assert.doesNotMatch(deferred[1],new RegExp(file.replaceAll('.','\\.')));
  }
  assert.match(source,/function prewarmStudyRuntime\(\)/);
  assert.match(source,/loadRuntimeSequence\(STUDY_RUNTIME\)/);
  assert.match(source,/function ensureStudyRuntime\(\)\{return prewarmStudyRuntime\(\)\.then\(\(\)=>\{resetStudySessionSummary\(\);return true\}\)\}/);
  assert.match(source,/window\.ManjingoPrewarmStudyRuntime=prewarmStudyRuntime/);
  assert.match(source,/window\.ManjingoEnsureStudyRuntime=ensureStudyRuntime/);
  const prewarmStart=source.indexOf('function prewarmStudyRuntime()');
  const ensureStart=source.indexOf('function ensureStudyRuntime()');
  assert.ok(prewarmStart>=0&&ensureStart>prewarmStart,'prewarm and ensure study functions should be ordered');
  assert.doesNotMatch(source.slice(prewarmStart,ensureStart),/resetStudySessionSummary/,'intent prewarm must not snapshot the session early');
  const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const start=startHandlerSource(home);
  assert.match(start,/shell\.prewarmStudyRuntime\(\)\.catch\(\(\)=>false\)/);
  assert.match(start,/shell\.ensureStudyPlanRuntime\(\)\.catch\(\(\)=>false\)/);
  assert.doesNotMatch(start,/shell\.ensureStudyRuntime\(/,'Start must reset the summary only after the final plan is rebuilt');
  assert.ok(start.indexOf('await Promise.all([studyRuntime,studyPlanRuntime])')<start.indexOf('rebuildStartPlan()'),'both study runtimes must be ready before plan rebuild');
  assert.ok(start.indexOf('rebuildStartPlan()')<start.indexOf('shell.resetStudySessionSummary()'),'final plan must be chosen before the session snapshot resets');
  assert.ok(start.indexOf('shell.resetStudySessionSummary()')<start.indexOf('renderQuestion()'),'session snapshot must reset before the first question renders');
  assert.ok(start.indexOf('renderQuestion()')<start.indexOf('shell.focusQuiz()'),'first question should render before study focus begins');
});

test('start intent prewarms study runtime without starting a session',()=>{
  const installStart=source.indexOf('function installStudyRuntimePrewarm()');
  const styleStart=source.indexOf('function installStudyStyle()');
  assert.ok(installStart>=0&&styleStart>installStart,'study prewarm installer should exist before study styling');
  const install=source.slice(installStart,styleStart);
  assert.match(install,/addEventListener\('pointerenter',prewarm/);
  assert.match(install,/addEventListener\('focus',prewarm\)/);
  assert.match(install,/addEventListener\('pointerdown',pointerdown/);
  assert.match(install,/lastStudyPointerDownAt=perfNow\(\);lastStudyPointerDownState=studyPlanRuntimeState\(\);prewarm\(\)/);
  assert.match(install,/Promise\.all\(\[prewarmStudyRuntime\(\),prewarmStudyPlanRuntime\(\)\]\)\.catch/);
  assert.doesNotMatch(install,/ensureStudyRuntime\(/);
  assert.doesNotMatch(install,/resetStudySessionSummary/);
  assert.match(source,/enhanceTodayPlan\(\);installStudyRuntimePrewarm\(\);/);
});

test('study plan timing state distinguishes cold warming and ready without network telemetry',async()=>{
  const{shell}=loadStudyPlanShell();
  assert.equal(shell.studyPlanRuntimeState(),'cold');
  const promise=shell.prewarmStudyPlanRuntime();
  assert.equal(shell.studyPlanRuntimeState(),'warming');
  await promise;
  assert.equal(shell.studyPlanRuntimeState(),'ready');
  const timing=shell.studyStartTimingSnapshot();
  assert.equal(timing.runtimeState,'ready');
  assert.ok(Number(timing.studyPlanReadyAt)>0);
  const timingSlice=source.slice(source.indexOf('function perfNow()'),source.indexOf('function whenDomReady()'));
  assert.doesNotMatch(timingSlice,/fetch\(|sendBeacon|localStorage|sessionStorage|cloudModule|import\(/);
});

test('study start metrics stay local and record touch and render milestones',()=>{
  const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const helper=home.match(/function publishStudyStartMetrics\([\s\S]*?\nfunction localDate/);
  assert.ok(helper,'study start metrics helper missing');
  for(const field of ['prewarmStateAtClick','pointerDownState','pointerDownToStudyPlanReadyMs','pointerDownToFirstQuestionMs','clickToStudyPlanReadyMs','clickToAllRuntimeReadyMs','clickToFirstQuestionMs','clickToFocusMs','planSource'])assert.match(helper[0],new RegExp(field));
  assert.match(helper[0],/window\.ManjingoStudyStartMetrics=metrics/);
  assert.match(helper[0],/manjingo:study-start-metrics/);
  assert.doesNotMatch(helper[0],/fetch\(|sendBeacon|localStorage|sessionStorage|cloudModule|import\(/);
  const start=startHandlerSource(home);
  assert.match(start,/clickAt=perfNow\(\)/);
  assert.match(start,/studyStartTimingSnapshot\(\)/);
  assert.ok(start.indexOf('await Promise.all([studyRuntime,studyPlanRuntime])')<start.indexOf('const allRuntimeReadyAt=perfNow()'));
  assert.ok(start.indexOf('renderQuestion()')<start.indexOf('const firstQuestionRenderedAt=perfNow()'));
  assert.ok(start.indexOf('shell.focusQuiz()')<start.indexOf('const focusCompletedAt=perfNow()'));
  assert.ok(start.indexOf('const focusCompletedAt=perfNow()')<start.indexOf('publishStudyStartMetrics('));
});

test('start plan rebuild refreshes adaptive local questions without downgrading a cached cloud plan',()=>{
  const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  assert.match(home,/let localQuestions=content\?content\.questions\.slice\(\):\[\]/);
  assert.match(home,/latestRemotePlan=null/);
  assert.match(home,/latestRemotePlan=remotePlan\|\|null/);
  const rebuild=home.match(/function rebuildStartPlan\(\)\{[\s\S]*?\nfunction applyLocalPlan/);
  assert.ok(rebuild,'start-plan rebuild helper missing');
  assert.match(rebuild[0],/refreshLocalQuestionPool\(\)/);
  assert.match(rebuild[0],/currentPlanSource==='cloud'&&latestRemotePlan&&cloudQuestionPool\.length/);
  assert.match(rebuild[0],/content\.selectQuestionsForPlan\(latestRemotePlan,cloudQuestionPool,SESSION_TARGET\)/);
  assert.match(rebuild[0],/if\(selected\.length\)questions=selected;return'cloud'/,'an existing cloud plan must return before local fallback even if reselection is empty');
  assert.ok(rebuild[0].indexOf("return'cloud'")<rebuild[0].indexOf('buildLocalPlan(SESSION_TARGET)'),'cloud preservation must precede local fallback');
  assert.doesNotMatch(rebuild[0],/cloudModule|getDailyLearningPlan|fetchAllQuestions|ensureLogin/,'Start rebuild must never issue a cloud request');
});

test('start intent prewarm is an optimization while click awaits cold study-plan loading',()=>{
  const home=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
  const start=startHandlerSource(home);
  assert.match(start,/startButton\.textContent='正在準備…'/,'touch click should paint immediate preparation feedback');
  assert.match(start,/shell\.ensureStudyPlanRuntime\(\)\.catch\(\(\)=>false\)/,'cold touch must await study-plan runtime even without hover');
  assert.match(start,/await Promise\.all\(\[studyRuntime,studyPlanRuntime\]\)/);
  assert.doesNotMatch(start,/cloudModule|getDailyLearningPlan|fetchAllQuestions|ensureLogin/);
});

test('view lazy loading deduplicates scripts before the full idle runtime completes',()=>{
  assert.match(source,/const deferredScriptPromises=new Map\(\),viewRuntimePromises=new Map\(\)/);
  assert.match(source,/function deferredScriptPresent\(src\)/);
  assert.match(source,/if\(deferredScriptPromises\.has\(src\)\)return deferredScriptPromises\.get\(src\)/);
  assert.match(source,/if\(deferredScriptPresent\(src\)\)/);
  assert.match(source,/function loadRuntimeSequence\(files\)/);
});


test('first lazy home view shows a temporary accessible loading state',()=>{
  assert.match(source,/function viewHost\(view\)/);
  assert.match(source,/function showViewLoading\(view\)/);
  assert.match(source,/home-view-loading/);
  assert.match(source,/role="status" aria-live="polite">正在載入…/);
  assert.match(source,/function clearViewLoading\(view\)/);
  assert.match(source,/function requestViewRuntime\(view\)/);
  assert.match(source,/showViewLoading\(key\);return window\.ManjingoEnsureViewRuntime\(key\)\.then\(result=>\{clearViewLoading\(key\)/);
  assert.match(source,/if\(view!=='today'\)void requestViewRuntime\(view\)\.catch/);
});
