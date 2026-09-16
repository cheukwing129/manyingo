const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('homepage keeps the blocking boot until the final shell can be prepared',()=>{
  const html=read('public/index.html'),theme=read('public/theme-runtime.js');
  const themeTag='<script src="./theme-runtime.js"></script>';
  const homeShellTag='<script src="./home-shell.js"></script>';
  const catalogTag='<script src="./catalog-runtime.js" data-includes="./content-catalog.js"></script>';
  assert.ok(html.indexOf(themeTag)>=0&&html.indexOf(themeTag)<html.indexOf('<body>'));
  assert.ok(html.indexOf(homeShellTag)>html.indexOf('<body>'),'home shell runs after homepage markup exists');
  assert.ok(html.indexOf(homeShellTag)<html.indexOf(catalogTag),'home shell prepares first paint before the large catalog runtime');
  assert.match(theme,/PROGRESSIVE_BOOT_VERSION='v1'/);
  assert.match(theme,/function revealProgressiveShell\(\)/);
  assert.match(theme,/document\.documentElement\.classList\.remove\('app-booting'\)/);
  assert.match(theme,/document\.documentElement\.setAttribute\('data-progressive-boot',PROGRESSIVE_BOOT_VERSION\)/);
});

test('progressive boot shows honest pending UI instead of fake hydrated values',()=>{
  const theme=read('public/theme-runtime.js');
  assert.match(theme,/正在準備今日學習…/);
  assert.match(theme,/準備中…/);
  assert.match(theme,/#reviewCount/);
  assert.match(theme,/#weakCount/);
  assert.match(theme,/#newCount/);
  assert.match(theme,/#start\{pointer-events:none;opacity:\.55;font-size:0\}/);
});

test('progressive boot does not expose raw markup before shell preparation and has a DOMContentLoaded fallback',()=>{
  const source=read('public/theme-runtime.js'),attrs={},removed=[],listeners={};
  const headChildren=[];
  const documentElement={
    classList:{remove:value=>removed.push(value)},
    setAttribute:(key,value)=>{attrs[key]=String(value)},
    getAttribute:key=>attrs[key]||null
  };
  const document={
    documentElement,
    head:{appendChild:node=>headChildren.push(node)},
    body:null,
    readyState:'loading',
    querySelectorAll:()=>[],
    getElementById:id=>headChildren.find(node=>node.id===id)||null,
    createElement:tag=>({tagName:String(tag).toUpperCase(),id:'',className:'',style:{},setAttribute(){},addEventListener(){},appendChild(){}}),
    addEventListener:(name,fn)=>{(listeners[name]||(listeners[name]=[])).push(fn)},
    dispatchEvent(){}
  };
  const context={document,location:{pathname:'/'},console};
  context.globalThis=context;
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'theme-runtime.js'});
  assert.deepEqual(removed,[],'raw homepage must stay hidden while body markup is still being parsed');
  assert.equal(attrs['data-progressive-boot'],'v1');
  assert.notEqual(attrs['data-progressive-ready'],'true');
  assert.ok(headChildren.some(node=>node.id==='progressiveBootStyle'));
  assert.ok(Array.isArray(listeners.DOMContentLoaded)&&listeners.DOMContentLoaded.length>=1);
  listeners.DOMContentLoaded[0]();
  assert.equal(attrs['data-progressive-ready'],'true');
  assert.equal(attrs['data-shell-ready'],'true');
  assert.deepEqual(removed,['app-booting'],'DOMContentLoaded remains a safety fallback if shell preparation did not reveal earlier');
});

test('home shell prepares fixed first-paint UI and reveals before deferred feature work',()=>{
  const shell=read('public/home-shell.js');
  assert.match(shell,/ensureStatusShell\(\);ensureAccountBarShell\(\);prepareThemeSwitcher\(\)/);
  assert.match(shell,/enhancePlayerStatus\(\);enhanceAppNav\(\)/);
  assert.match(shell,/revealHomepageShell\(\);loadStage3Reading\(\)/);
  assert.match(shell,/window\.ManjingoHomeShell=/);
  assert.match(shell,/\ninstall\(\);\n\}\)\(\);/);
});

test('production smoke verifies the progressive boot contract before API writes',()=>{
  const smoke=read('scripts/smoke_sync_guard.mjs');
  assert.match(smoke,/theme-runtime\.js/);
  assert.match(smoke,/PROGRESSIVE_BOOT_VERSION='v1'/);
  assert.match(smoke,/progressive homepage boot/);
});