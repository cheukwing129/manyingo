const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const runtime=require('../public/mascot-runtime.js');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('mascot runtime stays in parity with the machine-readable manifest',()=>{
  const manifest=JSON.parse(read('public/mascot/manifest.json'));
  assert.equal(runtime.version,manifest.version);
  assert.equal(runtime.name,manifest.name);
  assert.deepEqual(runtime.recommendedSizes,manifest.recommendedSizes);
  assert.equal(runtime.compactAsset,manifest.compactAsset);
  const runtimeStates=runtime.list().map(({id,label,asset,intent,motion,artStatus,productionPriority})=>({id,label,asset,intent,motion,artStatus,productionPriority}));
  assert.deepEqual(runtimeStates,manifest.states);
});

test('mascot runtime normalizes unknown states and owns compact-size selection',()=>{
  assert.equal(runtime.normalizeState('happy'),'happy');
  assert.equal(runtime.normalizeState('unknown'),'neutral');
  assert.equal(runtime.asset('happy'),'./mascot/v2/happy.svg');
  assert.equal(runtime.asset('unknown'),'./mascot/v2/neutral.svg');
  assert.equal(runtime.asset('celebrate',{size:32}),'./mascot/v2/compact.svg');
  assert.equal(runtime.asset('thinking',{compact:true}),'./mascot/v2/thinking.svg');
  assert.equal(runtime.stateClass('determined'),'mascot-state-determined');
  assert.equal(runtime.stateClass('nonsense'),'mascot-state-neutral');
});

test('mascot runtime exposes production artwork readiness in priority order',()=>{
  assert.equal(runtime.isProductionArt('neutral'),true);
  assert.equal(runtime.isProductionArt('happy'),true);
  assert.equal(runtime.isProductionArt('encouraging'),true);
  assert.equal(runtime.descriptor('happy').artStatus,'production');
  assert.equal(runtime.descriptor('encouraging').artStatus,'production');
  assert.equal(runtime.descriptor('determined').artStatus,'production');
  assert.equal(runtime.descriptor('celebrate').artStatus,'production');
  assert.equal(runtime.isProductionArt('celebrate'),true);
  assert.deepEqual(runtime.productionQueue().map(state=>state.id),[]);
});

test('semantic lesson icon tagging is explicit rather than styling every lesson icon',()=>{
  const classes=[];
  const thinking={textContent:'🧠',dataset:{},classList:{add:value=>classes.push(value)}};
  const unrelated={textContent:'✅',dataset:{},classList:{add:value=>classes.push(value)}};
  assert.equal(runtime.semanticThinkingIcon(thinking),true);
  assert.equal(thinking.dataset.mascotState,'thinking');
  assert.ok(classes.includes('mascot-thinking'));
  const before=classes.length;
  assert.equal(runtime.semanticThinkingIcon(unrelated),false);
  assert.equal(classes.length,before);
  const css=read('public/app-ui.css');
  assert.match(css,/\.lesson-icon\.mascot-thinking/);
  assert.doesNotMatch(css,/#lessonApp \.lesson-step>\.lesson-icon\{/);
});

test('product JS and HTML no longer depend directly on the legacy mascot filename',()=>{
  const publicDir=path.join(root,'public');
  const offenders=[];
  function walk(dir){
    fs.readdirSync(dir,{withFileTypes:true}).forEach(entry=>{
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())return walk(full);
      if(!/\.(?:js|html|css)$/.test(entry.name))return;
      const source=fs.readFileSync(full,'utf8');
      if(source.includes('mascot-moling.svg'))offenders.push(path.relative(root,full));
    });
  }
  walk(publicDir);
  assert.deepEqual(offenders,[]);
});

test('feedback and completion layers resolve state assets through the shared runtime',()=>{
  const feedback=read('public/feedback-ui.js');
  const summary=read('public/session-summary.js');
  assert.match(feedback,/ManjingoMascotRuntime/);
  assert.match(feedback,/runtime\.asset\(state\)/);
  assert.match(summary,/function mascotRuntime\(\)/);
  assert.match(summary,/runtime\.asset\(name\)/);
});
