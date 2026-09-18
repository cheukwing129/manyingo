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
  for(const file of ['learning-path.js','skill-results-v1.js'])assert.doesNotMatch(deferred[1],new RegExp(file.replaceAll('.','\\.')));
  assert.match(common[1],/\.\/skill-results-v1\.js/);
  assert.match(study[1],/\.\/learning-path\.js/);
  assert.match(source,/path:\[\.\.\.VIEW_RUNTIME_COMMON,'\.\/learning-path\.js','\.\/learning-path-ui\.js'\]/);
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
  const start=home.match(/document\.getElementById\('start'\)\.onclick=async function\(\)\{[\s\S]*?\};/)[0];
  assert.match(start,/await shell\.ensureStudyRuntime\(\)\.catch\(\(\)=>false\)/);
  assert.ok(start.indexOf('await shell.ensureStudyRuntime()')<start.indexOf('renderQuestion()'),'study runtime must be ready before the first question renders');
  assert.ok(start.indexOf('renderQuestion()')<start.indexOf('shell.focusQuiz()'),'first question should render before study focus begins');
});

test('start intent prewarms study runtime without starting a session',()=>{
  const installStart=source.indexOf('function installStudyRuntimePrewarm()');
  const styleStart=source.indexOf('function installStudyStyle()');
  assert.ok(installStart>=0&&styleStart>installStart,'study prewarm installer should exist before study styling');
  const install=source.slice(installStart,styleStart);
  assert.match(install,/addEventListener\('pointerenter',prewarm/);
  assert.match(install,/addEventListener\('focus',prewarm\)/);
  assert.match(install,/addEventListener\('pointerdown',prewarm/);
  assert.match(install,/prewarmStudyRuntime\(\)\.catch/);
  assert.doesNotMatch(install,/ensureStudyRuntime\(/);
  assert.doesNotMatch(install,/resetStudySessionSummary/);
  assert.match(source,/enhanceTodayPlan\(\);installStudyRuntimePrewarm\(\);/);
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
