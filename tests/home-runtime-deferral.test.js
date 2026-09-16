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
  assert.match(source,/runtimeStudyActive\(\)\|\|Date\.now\(\)-lastInteractionAt<900/);
  assert.match(source,/requestIdleCallback\(run,\{timeout:3500\}\)/);
  assert.match(source,/view!=='today'&&window\.ManjingoEnsureAppRuntime/);
  assert.match(source,/window\.ManjingoStartupRuntimeBundled=true/);
});
