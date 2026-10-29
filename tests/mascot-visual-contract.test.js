const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const runtime=require('../public/mascot-runtime.js');

const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const exists=file=>fs.existsSync(path.join(root,file));
const manifest=JSON.parse(read('public/mascot/manifest.json'));

const stateIds=['neutral','happy','celebrate','encouraging','thinking','determined'];
const sizes=[32,48,64,96,160];
const productionPriority=['happy','encouraging','thinking','determined','celebrate'];
const pendingPriority=[];

test('mascot manifest preserves six state identities using the approved v2 artwork',()=>{
  assert.equal(manifest.version,2);
  assert.deepEqual(manifest.recommendedSizes,sizes);
  assert.deepEqual(manifest.states.map(state=>state.id),stateIds);
  assert.equal(manifest.compactAsset,'./mascot/v2/compact.svg');
  manifest.states.forEach(state=>{
    assert.ok(state.label);
    assert.ok(state.intent);
    assert.ok(state.artStatus);
    assert.equal(Number.isFinite(state.productionPriority),true);
    assert.match(state.asset,/^\.\/mascot\/v2\/[a-z]+\.svg$/);
  });
});

test('runtime and manifest stay in exact parity including artwork readiness',()=>{
  assert.deepEqual(runtime.recommendedSizes,manifest.recommendedSizes);
  assert.equal(runtime.compactAsset,manifest.compactAsset);
  manifest.states.forEach(state=>{
    const descriptor=runtime.descriptor(state.id);
    ['id','label','asset','intent','motion','artStatus','productionPriority'].forEach(key=>assert.equal(descriptor[key],state[key],state.id+' '+key));
  });
  assert.equal(runtime.isProductionArt('neutral'),true);
  assert.equal(runtime.isProductionArt('happy'),true);
  assert.equal(runtime.isProductionArt('encouraging'),true);
  assert.equal(runtime.descriptor('happy').artStatus,'production');
  assert.equal(runtime.descriptor('encouraging').artStatus,'production');
  assert.equal(runtime.isProductionArt('thinking'),true);
  assert.equal(runtime.descriptor('thinking').artStatus,'production');
  assert.equal(runtime.isProductionArt('celebrate'),true);
  assert.equal(runtime.descriptor('celebrate').artStatus,'production');
  assert.deepEqual(runtime.productionQueue().map(state=>state.id),pendingPriority);
});

test('all live assets use the supplied v2 artwork and retain transparent embedded images',()=>{
 for(const asset of new Set([...manifest.states.map(s=>s.asset),manifest.compactAsset,manifest.completionAsset])){
  const svg=read('public/'+asset.slice(2));assert.match(svg,/viewBox="0 0 1024 1024"/);assert.match(svg,/data:image\/webp;base64,/);assert.match(svg,/libfile_/);assert.match(svg,/feFuncA/);assert.doesNotMatch(svg,/mascot-moling\.svg/);
 }
 assert.equal(runtime.descriptor('encouraging').asset,'./mascot/v2/sad.svg');
 assert.equal(runtime.completionAsset,manifest.completionAsset);
});

test('archived v1: happy production v3 keeps all-ink identity and restrained success cues',()=>{
  const happy=read('public/mascot/moling-happy.svg');
  assert.match(happy,/全墨炭灰至深墨藍漸變/);
  assert.match(happy,/純黑豆豆眼/);
  assert.match(happy,/閉口上揚小笑容/);
  assert.match(happy,/單節圓頭墨臂/);
  assert.match(happy,/data:image\/webp;base64,/);
  assert.match(happy,/不設獨立手掌、手腕、手指、星點、勾號、勝利道具或狂躁訊號/);
});

test('archived v1: encouraging P2 production art encodes supportive cues without blame cues',()=>{
  const encouraging=read('public/mascot/moling-encouraging.svg');
  assert.match(encouraging,/微歪小笑容/);
  assert.match(encouraging,/陪伴與支持/);
  assert.match(encouraging,/全墨色/);
  assert.match(encouraging,/金色雲紋/);
  assert.match(encouraging,/笨拙圓潤開掌/);
  assert.match(encouraging,/data:image\/webp;base64,/);
  assert.doesNotMatch(encouraging,/mascot-moling\.svg/);
  assert.doesNotMatch(encouraging,/(眼淚|紅叉|搖頭|皺眉|shame|punish)/i);
});

test('archived v1: thinking P3 production art encodes curious focus without confused cues',()=>{
  const thinking=read('public/mascot/moling-thinking.svg');
  assert.match(thinking,/thinking production artwork v2/);
  assert.match(thinking,/共同向上側望/);
  assert.match(thinking,/低飽和腮紅/);
  assert.match(thinking,/與臉保留負空間/);
  assert.match(thinking,/順視線彎曲/);
  assert.match(thinking,/好奇專注/);
  assert.match(thinking,/data:image\/webp;base64,/);
  assert.doesNotMatch(thinking,/mascot-moling\.svg/);
  const p3Gate=read('scripts/check_mascot_thinking_p3.cjs');
  assert.match(p3Gate,/Buffer\.from\(embeddedWebp\[1\],'base64'\)/);
  assert.match(p3Gate,/0x10/);
  assert.match(p3Gate,/ALPH/);
  assert.match(p3Gate,/real alpha channel/);
});

test('archived v1: celebrate P5 QA covers happy comparison and completion layouts',()=>{
  const qa=read('public/mascot-celebrate-p5-qa.html');
  assert.match(qa,/Celebrate P5 Visual QA/);
  assert.match(qa,/P5 · production v4/);
  assert.match(qa,/Gate A · same-character identity/);
  assert.match(qa,/moling-neutral-all-ink-candidate\.svg/);
  assert.match(qa,/identityGrid/);
  assert.match(qa,/const sizes=\[34,42,48,64,96,160\]/);
  assert.match(qa,/runtime\.asset\('happy'\)/);
  assert.match(qa,/runtime\.asset\('celebrate'\)/);
  assert.match(qa,/這一步值得好好慶祝！/);
  assert.match(qa,/Desktop · 42×62px/);
  assert.match(qa,/Narrow mobile · 34×50px/);
  assert.match(qa,/不必每次滿分/);
  assert.match(qa,/prefers-reduced-motion:reduce/);
});

test('small artwork keeps the supplied compact crop without substituting a happy face for a wrong answer',()=>{
 const svg=read('public/'+manifest.compactAsset.slice(2));assert.match(svg,/viewBox="0 0 1024 1024"/);assert.match(svg,/小尺寸開心上半身/);
 assert.equal(runtime.asset('encouraging',{size:32}),'./mascot/v2/sad.svg');
 assert.equal(runtime.asset('thinking',{size:32}),'./mascot/v2/thinking.svg');
});

test('archived v1: visual QA character sheet retains happy production regression surfaces',()=>{
  const sheet=read('public/mascot-sheet.html');
  assert.match(sheet,/script src="\.\/mascot-runtime\.js"/);
  assert.match(sheet,/runtime\.recommendedSizes/);
  assert.match(sheet,/runtime\.productionQueue/);
  assert.match(sheet,/id="happyABGrid"/);
  assert.match(sheet,/neutral \/ production A\/B/);
  assert.match(sheet,/Desktop · 42×62px mascot/);
  assert.match(sheet,/Narrow mobile · 34×50px mascot/);
  assert.match(sheet,/prefers-reduced-motion:reduce/);
});

test('archived v1: encouraging P2 QA page covers all-ink identity A/B and real wrong-answer sizes',()=>{
  const qa=read('public/mascot-encouraging-p2-qa.html');
  assert.match(qa,/Encouraging P2 Visual QA/);
  assert.match(qa,/const sizes=\[34,42,48,64,96,160\]/);
  assert.match(qa,/moling-neutral-all-ink-candidate\.svg/);
  assert.doesNotMatch(qa,/previous cream-face direction/);
  assert.match(qa,/runtime\.asset\('encouraging'\)/);
  assert.match(qa,/這題答錯了/);
  assert.match(qa,/一起看清這一步。/);
  assert.match(qa,/Desktop · 42×62px/);
  assert.match(qa,/Narrow mobile · 34×50px/);
  assert.match(qa,/不低頭、不皺眉/);
  assert.match(qa,/prefers-reduced-motion:reduce/);
  const neutralCandidate='public/mascot/moling-neutral-all-ink-candidate.svg';
  assert.equal(exists(neutralCandidate),true);
  const neutral=read(neutralCandidate);
  assert.match(neutral,/viewBox="0 0 215 320"/);
  assert.match(neutral,/neutral 全墨角色基準 candidate/);
  assert.match(neutral,/data:image\/webp;base64,/);
  assert.doesNotMatch(neutral,/mascot-moling\.svg/);
});

test('archived v1: thinking P3 QA covers all-ink identity A/B and hint layouts',()=>{
  const qa=read('public/mascot-thinking-p3-qa.html');
  assert.match(qa,/Thinking P3 Visual QA/);
  assert.match(qa,/const sizes=\[34,42,48,64,96,160\]/);
  assert.match(qa,/moling-neutral-all-ink-candidate\.svg/);
  assert.match(qa,/runtime\.asset\('thinking'\)/);
  assert.match(qa,/讓我陪你想一想。/);
  assert.match(qa,/Desktop · 42×62px/);
  assert.match(qa,/Narrow mobile · 34×50px/);
  assert.match(qa,/不遮眼、不穿過嘴形/);
  assert.match(qa,/prefers-reduced-motion:reduce/);
});

test('production placements use canonical state assets instead of the legacy baseline directly',()=>{
  const css=read('public/app-ui.css');
  assert.match(css,/brand\/manyingo-logo-classic\.webp/);
  assert.match(css,/brand\/manyingo-logo-ink\.webp/);
  assert.match(css,/mascot\/v2\/complete\.svg/);
  assert.match(css,/mascot\/v2\/thinking\.svg/);
  assert.doesNotMatch(css,/background:url\('\.\/mascot-moling\.svg'\)/);
});

test('production art brief protects character DNA and defines the state priority order',()=>{
  const brief=read('docs/mascot-production-art-brief.md');
  assert.match(brief,/不可改動的角色 DNA/);
  productionPriority.slice(0,4).forEach(state=>assert.match(brief,new RegExp('`'+state+'`')));
  assert.match(brief,/不再只是 baseline artwork 加外掛符號/);
  assert.match(brief,/48 \/ 64 \/ 96 \/ 160px/);
  assert.match(brief,/Definition of Done/);
});

test('visual QA documentation records current limitations and production art priorities',()=>{
  const docs=read('docs/mascot-visual-qa.md');
  assert.match(docs,/mascot-sheet\.html/);
  assert.match(docs,/manifest\.json/);
  assert.match(docs,/v1 已知限制/);
  assert.match(docs,/happy/);
  assert.match(docs,/encouraging/);
});
