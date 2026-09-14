const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('homepage releases the old blocking boot before body parsing',()=>{
  const html=read('public/index.html'),theme=read('public/theme-runtime.js');
  const themeTag='<script src="./theme-runtime.js"></script>';
  assert.ok(html.indexOf(themeTag)>=0&&html.indexOf(themeTag)<html.indexOf('<body>'));
  assert.match(theme,/PROGRESSIVE_BOOT_VERSION='v1'/);
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

test('progressive boot becomes ready after parser-blocking local runtime finishes',()=>{
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
  assert.deepEqual(removed,['app-booting']);
  assert.equal(attrs['data-progressive-boot'],'v1');
  assert.notEqual(attrs['data-progressive-ready'],'true');
  assert.ok(headChildren.some(node=>node.id==='progressiveBootStyle'));
  assert.ok(Array.isArray(listeners.DOMContentLoaded)&&listeners.DOMContentLoaded.length>=1);
  listeners.DOMContentLoaded[0]();
  assert.equal(attrs['data-progressive-ready'],'true');
});

test('production smoke verifies the progressive boot contract before API writes',()=>{
  const smoke=read('scripts/smoke_sync_guard.mjs');
  assert.match(smoke,/theme-runtime\.js/);
  assert.match(smoke,/PROGRESSIVE_BOOT_VERSION='v1'/);
  assert.match(smoke,/progressive homepage boot/);
});