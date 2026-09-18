import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const baseUrl=String(process.env.MANJINGO_BASE_URL||'https://manyingo.pages.dev').replace(/\/$/,'');
const budgetMs=Math.max(1000,Number(process.env.MANJINGO_STUDY_START_BUDGET_MS)||6000);
const warnMs=Math.min(budgetMs,Math.max(500,Number(process.env.MANJINGO_STUDY_START_WARN_MS)||2500));

function check(value,message){if(!value)throw new Error(message)}
function chromePath(){
  if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
  for(const name of ['google-chrome','google-chrome-stable','chromium','chromium-browser']){
    try{return execFileSync('which',[name],{encoding:'utf8'}).trim()}catch(e){}
  }
  throw new Error('Chrome/Chromium executable not found on runner');
}
async function waitJson(path,timeoutMs=12000){
  const started=Date.now(),url='http://127.0.0.1:9222'+path;
  while(Date.now()-started<timeoutMs){
    try{const response=await fetch(url);if(response.ok)return await response.json()}catch(e){}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Chrome DevTools endpoint did not become ready');
}
class Cdp{
  constructor(url){
    check(typeof WebSocket==='function','Node WebSocket API unavailable');
    this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.waiters=new Map();
    this.ready=new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',()=>reject(new Error('CDP WebSocket failed to open')),{once:true})});
    this.ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id){const item=this.pending.get(msg.id);if(!item)return;this.pending.delete(msg.id);if(msg.error)item.reject(new Error(msg.error.message||'CDP error'));else item.resolve(msg.result);return}const list=this.waiters.get(msg.method);if(list&&list.length){this.waiters.delete(msg.method);for(const resolve of list)resolve(msg.params||{})}});
  }
  async call(method,params={}){await this.ready;const id=++this.id;const result=new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject}));this.ws.send(JSON.stringify({id,method,params}));return result}
  async once(method,timeoutMs=10000){
    await this.ready;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('Timed out waiting for '+method)),timeoutMs);
      const wrapped=value=>{clearTimeout(timer);resolve(value)};
      const list=this.waiters.get(method)||[];list.push(wrapped);this.waiters.set(method,list);
    });
  }
  close(){try{this.ws.close()}catch(e){}}
}
async function evaluate(cdp,expression){
  const result=await cdp.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if(result.exceptionDetails)throw new Error('Browser evaluation failed: '+(result.exceptionDetails.text||'unknown error'));
  return result.result&&result.result.value;
}
async function waitFor(cdp,expression,label,timeoutMs=12000){
  const started=Date.now();
  while(Date.now()-started<timeoutMs){
    const value=await evaluate(cdp,expression);
    if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Timed out waiting for '+label);
}

const profile=await mkdtemp(join(tmpdir(),'manyingo-mobile-smoke-'));
const chrome=spawn(chromePath(),[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update',
  '--disable-default-apps','--disable-sync','--metrics-recording-only','--no-first-run','--remote-debugging-port=9222',
  '--user-data-dir='+profile,'--window-size=390,844','about:blank'
],{stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',chunk=>{stderr+=String(chunk).slice(-4000)});

let cdp=null;
try{
  await waitJson('/json/version');
  const targets=await waitJson('/json/list');
  const page=targets.find(item=>item.type==='page');
  check(page&&page.webSocketDebuggerUrl,'Chrome page target unavailable');
  cdp=new Cdp(page.webSocketDebuggerUrl);
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Network.enable');
  await cdp.call('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.call('Network.clearBrowserCache');
  await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844});
  await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  const loaded=cdp.once('Page.loadEventFired',15000);
  await cdp.call('Page.navigate',{url:baseUrl+'/?perf=1&ci-mobile-smoke=1'});
  await loaded;
  const button=await waitFor(cdp,`(()=>{const b=document.getElementById('start');if(!b||b.disabled)return null;b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,label:b.textContent}})()`,'enabled Start button');
  check(Number.isFinite(button.x)&&Number.isFinite(button.y),'Start button coordinates unavailable');
  await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:button.x,y:button.y,radiusX:1,radiusY:1,force:1,id:1}]});
  await new Promise(resolve=>setTimeout(resolve,45));
  await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const metrics=await waitFor(cdp,'window.ManjingoStudyStartMetrics||null','study start metrics',15000);
  check(metrics.pointerDownState==='cold'||metrics.pointerDownState==='warming',`expected first-touch pointerdown state to be cold/warming, got ${metrics.pointerDownState}`);
  check(metrics.pointerDownState!=='ready','first touch unexpectedly found study-plan runtime already ready');
  check(Number.isFinite(metrics.pointerDownToFirstQuestionMs),'pointerdown-to-first-question metric missing');
  check(Number.isFinite(metrics.clickToFirstQuestionMs),'click-to-first-question metric missing');
  check(metrics.pointerDownToFirstQuestionMs<=budgetMs,`mobile cold study start ${metrics.pointerDownToFirstQuestionMs} ms exceeds ${budgetMs} ms budget`);
  const status=metrics.pointerDownToFirstQuestionMs>warnMs?'WARN':'OK';
  console.log('MOBILE_STUDY_START='+JSON.stringify({status,budgetMs,warnMs,...metrics}));
  console.log(`✓ mobile cold study start ${metrics.pointerDownToFirstQuestionMs} ms (click ${metrics.clickToFirstQuestionMs} ms, ${metrics.planSource} plan)`);
}finally{
  if(cdp)cdp.close();
  try{chrome.kill('SIGTERM')}catch(e){}
  await new Promise(resolve=>setTimeout(resolve,100));
  await rm(profile,{recursive:true,force:true});
}
