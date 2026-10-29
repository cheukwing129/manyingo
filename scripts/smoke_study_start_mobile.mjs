import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,rm,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';

const localAcceptance=process.argv.includes('--local-acceptance');
let baseUrl=String(process.env.MANJINGO_BASE_URL||'https://manyingo.pages.dev').replace(/\/$/,'');
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
    this.ws=new WebSocket(url);this.id=0;this.pending=new Map();this.waiters=new Map();this.events=[];
    this.ready=new Promise((resolve,reject)=>{this.ws.addEventListener('open',resolve,{once:true});this.ws.addEventListener('error',()=>reject(new Error('CDP WebSocket failed to open')),{once:true})});
    this.ws.addEventListener('message',event=>{const msg=JSON.parse(String(event.data));if(msg.id){const item=this.pending.get(msg.id);if(!item)return;this.pending.delete(msg.id);if(msg.error)item.reject(new Error(msg.error.message||'CDP error'));else item.resolve(msg.result);return}this.events.push(msg);const list=this.waiters.get(msg.method);if(list&&list.length){this.waiters.delete(msg.method);for(const resolve of list)resolve(msg.params||{})}});
  }
  async call(method,params={}){await this.ready;const id=++this.id;let timer;const result=new Promise((resolve,reject)=>{timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('CDP call timed out: '+method))},12000);this.pending.set(id,{resolve,reject})});this.ws.send(JSON.stringify({id,method,params}));try{return await result}finally{clearTimeout(timer)}}
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
  if(result.exceptionDetails)throw new Error('Browser evaluation failed: '+(result.exceptionDetails.exception?.description||result.exceptionDetails.text||'unknown error'));
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

// Local acceptance serves this checkout only. CSP blocks all remote connections,
// including Firebase, while the real DOM, script loaders and storage remain intact.
async function localServer(){
  const root=fileURLToPath(new URL('../public/',import.meta.url));
  const apiRequests=[];
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(url.pathname.startsWith('/api/')){apiRequests.push(req.url);res.writeHead(503);res.end('Backend disabled in acceptance');return}
      const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
      if(!path.startsWith(resolve(root)+sep)||req.method!=='GET'){res.writeHead(403);res.end();return}
      const body=await readFile(path);
      res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream','cache-control':'no-store',
        'content-security-policy':"default-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'"});
      res.end(body);
    }catch(error){res.writeHead(error.code==='ENOENT'?404:500);res.end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  baseUrl='http://127.0.0.1:'+server.address().port;
  return{server,apiRequests};
}
const artifactDir=resolve(process.env.MANJINGO_BROWSER_ARTIFACTS||'artifacts/browser-acceptance');
const acceptanceReport={mode:'local checkout; remote services blocked',devices:[],googleLogin:'not exercised; offline error recovery only'};
let currentDevice='mobile';
async function screenshot(cdp,name){
  await mkdir(artifactDir,{recursive:true});
  const shot=await cdp.call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  await writeFile(join(artifactDir,currentDevice+'-'+name+'.png'),Buffer.from(shot.data,'base64'));
}
async function navigate(cdp,path){
  const loaded=cdp.once('Page.loadEventFired',15000);
  await cdp.call('Page.navigate',{url:baseUrl+path});
  await loaded;
}
async function press(cdp,selector){
  const point=await waitFor(cdp,`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return null;e.scrollIntoView({block:'center',behavior:'instant'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const b=e.getBoundingClientRect(),x=b.left+b.width/2,y=b.top+b.height/2,hit=document.elementFromPoint(x,y);return b.width&&b.height&&(hit===e||e.contains(hit))?{x,y}:null})()`,'unobscured '+selector);
  if(currentDevice==='mobile'){
    await cdp.call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...point,radiusX:1,radiusY:1,force:1,id:1}]});
    await new Promise(resolve=>setTimeout(resolve,45));
    await cdp.call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }else{
    await cdp.call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await cdp.call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  }
  await evaluate(cdp,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
}
async function noHorizontalOverflow(cdp,label){
  const size=await evaluate(cdp,'({width:innerWidth,scroll:document.documentElement.scrollWidth})');
  check(size.scroll<=size.width+1,`${label}: horizontal overflow ${JSON.stringify(size)}`);
}
async function answerVisible(cdp,mode,wrong){
  const lesson=mode==='lesson',stage3=mode==='stage3';
  const host=lesson?'#lessonOptions':stage3?'#stage3Options':'#answers',questionSelector=lesson?'.lesson-question':stage3?'#stage3Reading .stage3-prompt':'#quiz .question';
  const q=await evaluate(cdp,`(()=>{const text=document.querySelector(${JSON.stringify(questionSelector)})?.textContent;return window.ManjingoContent.questions.find(q=>q.q===text||q.prompt===text)})()`);
  check(q,'visible question could not be matched to catalog');
  if(q.type==='reorder'){
    const fragments=q.fragments.map((part,i)=>typeof part==='object'?part:{id:'p'+(i+1),text:part});
    const order=q.answerOrder.slice();
    if(wrong)[order[0],order[1]]=[order[1],order[0]];
    for(const id of order){
      const text=fragments.find(p=>String(p.id)===String(id)).text;
      const index=await evaluate(cdp,`Array.from(document.querySelectorAll(${JSON.stringify(host+' .reorder-piece')})).findIndex(b=>b.textContent===${JSON.stringify(text)})`);
      check(index>=0,'reorder fragment missing');
      const piece=host+' .reorder-piece:nth-child('+(index+1)+')';
      await press(cdp,piece);
      await waitFor(cdp,`document.querySelector(${JSON.stringify(piece)})?.disabled===true`,'selected reorder fragment');
    }
    await press(cdp,host+' .reorder-controls .action');
  }else if(q.type==='fill'){
    await evaluate(cdp,`document.querySelector(${JSON.stringify(lesson?'#lessonInput':'#input')}).value=${JSON.stringify(wrong?'__wrong__':q.a)}`);
    await press(cdp,lesson?'#lessonCheck':'#check');
  }else{
    const index=await evaluate(cdp,`Array.from(document.querySelectorAll(${JSON.stringify(host+' .option')})).findIndex(b=>${wrong?'b.textContent!==':'b.textContent==='}${JSON.stringify(String(q.a))})`);
    check(index>=0,'answer option missing');
    await press(cdp,host+' .option:nth-child('+(index+1)+')');
  }
  const feedback=lesson?'#lessonFeedback':stage3?'#stage3Feedback .stage3-feedback':'#feedback',next=lesson?'#lessonNext':stage3?'#stage3Next':'#next';
  await waitFor(cdp,`document.querySelector(${JSON.stringify(feedback)})?.classList.contains(${JSON.stringify(wrong?'wrong':'correct')})&&document.querySelector(${JSON.stringify(next)})?.disabled===false`,'answer feedback and enabled Next');
  return q;
}
// Measure the control without scrolling it into view: feedback must not move it.
async function actionGeometry(cdp,selector){
  return evaluate(cdp,`(()=>{const button=document.querySelector(${JSON.stringify(selector)}),bar=button?.closest('.question-actions');if(!button||!bar)return null;const b=button.getBoundingClientRect(),a=bar.getBoundingClientRect(),hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return {top:b.top,bottom:b.bottom,left:b.left,width:b.width,height:b.height,barTop:a.top,barBottom:a.bottom,fixed:getComputedStyle(bar).position==='fixed',visible:b.top>=0&&b.bottom<=innerHeight&&b.left>=0&&b.right<=innerWidth&&hit===button,disabled:button.disabled}})()`);
}
async function stableAction(cdp,selector,before,label){
  const after=await actionGeometry(cdp,selector);
  check(before?.fixed&&before.visible&&after?.fixed&&after.visible,label+': action is not fixed and visible');
  for(const key of ['top','bottom','left','width','height'])check(Math.abs(before[key]-after[key])<=1,label+': action moved after feedback: '+JSON.stringify({before,after}));
  check(before.disabled&&!after.disabled,label+': action must enable only after answering');
}
async function expandedFeedback(cdp,host,next){
  const details=await evaluate(cdp,`Array.from(document.querySelectorAll(${JSON.stringify(host+' details')})).map((e,index)=>({index,open:e.open}))`);
  for(const item of details)if(!item.open)await press(cdp,host+' details:nth-of-type('+(item.index+1)+') > summary');
  await evaluate(cdp,"window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'});new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))");
  const geometry=await actionGeometry(cdp,next);
  const bottom=await evaluate(cdp,`document.querySelector(${JSON.stringify(host)}).getBoundingClientRect().bottom`);
  check(bottom<=geometry.barTop+1,'feedback is obscured by the fixed action: '+JSON.stringify({bottom,geometry}));
  return geometry;
}
async function responsiveAction(cdp){
  for(const [width,height] of [[320,740],[768,1024],[1024,768],[1440,900]]){
    await cdp.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    await evaluate(cdp,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const action=await expandedFeedback(cdp,'#feedback','#next');
    const available=await evaluate(cdp,'Math.min(600,document.documentElement.clientWidth-32)');
    check(action.visible&&action.width>=available-1&&action.height>=48,'action inaccessible at '+width+'px: '+JSON.stringify(action));
    await noHorizontalOverflow(cdp,'feedback at '+width+'px');
    await screenshot(cdp,'fixed-action-'+width);
  }
  await cdp.call('Emulation.setDeviceMetricsOverride',currentDevice==='mobile'?{width:390,height:844,deviceScaleFactor:3,mobile:true,screenWidth:390,screenHeight:844}:{width:1280,height:900,deviceScaleFactor:1,mobile:false});
}
async function acceptDevice(cdp,metrics){
  const report={device:currentDevice,metrics,homeAnswers:0,lessonAnswers:0};
  acceptanceReport.devices.push(report);
  await evaluate(cdp,`window.__acceptanceLearning={sources:[],methods:Object.fromEntries(['submit','syncRemoteResult','syncGamification','syncRemoteSkillState','syncRemoteConceptState','resolveQuestionMisconceptions'].map(name=>[name,window.ManjingoLocalLearning[name]]))};window.addEventListener('manjingo:learning-state-changed',event=>window.__acceptanceLearning.sources.push(event.detail.source));true`);
  await screenshot(cdp,'first-question');
  await noHorizontalOverflow(cdp,'home quiz');
  for(let i=0;i<24;i++){
    if(await evaluate(cdp,"!!document.querySelector('#quiz .done')"))break;
    const actionBefore=await actionGeometry(cdp,'#next');
    await answerVisible(cdp,'home',i%3===0);
    await stableAction(cdp,'#next',actionBefore,'home question '+i);
    report.homeAnswers++;
    if(i===0){await expandedFeedback(cdp,'#feedback','#next');await screenshot(cdp,'answer-feedback');await responsiveAction(cdp);}
    await press(cdp,'#next');
  }
  await waitFor(cdp,"!!document.querySelector('#quiz .done')&&!document.body.classList.contains('study-focus')",'home completion');
  check(report.homeAnswers>0,'home session contained no answers');
  check(await evaluate(cdp,"!document.querySelector('#quiz .question-footer')"),'completed home retained fixed action');
  report.fixedHomeAction=true;report.responsiveActionWidths=[320,768,1024,1440];
  const homeSources=await evaluate(cdp,'window.__acceptanceLearning.sources');
  check(homeSources.length===report.homeAnswers&&homeSources.every(source=>source==='submit'),'home must notify once per answer: '+JSON.stringify(homeSources));
  report.homeNotifications=homeSources.length;
  let xp=await evaluate(cdp,'window.ManjingoLocalLearning.getProgress().totalXp');
  check(xp>0,'home answers did not persist XP');
  await screenshot(cdp,'completed');
  for(const view of ['results','weakness','path','results','weakness']){
    await press(cdp,'[data-home-tab="'+view+'"]');
    const selector={results:'#masteryDashboard .dashboard-hero',weakness:'#weaknessPanel .weak-head',path:'#learningPath'}[view];
    await waitFor(cdp,`document.querySelector('[data-home-tab="${view}"]')?.getAttribute('aria-selected')==='true'&&!document.querySelector('[data-home-view="${view}"]').hidden&&!!document.querySelector(${JSON.stringify(selector)})&&!document.querySelector('[data-home-view="${view}"] .home-view-loading')`,view+' rendered');
    if(view==='results')check(await evaluate(cdp,'window.ManjingoMasteryDashboard.build().attempted>0'),'results lost answer evidence');
    await noHorizontalOverflow(cdp,view);
    await screenshot(cdp,view);
  }
  check(await evaluate(cdp,'Object.entries(window.__acceptanceLearning.methods).every(([name,method])=>window.ManjingoLocalLearning[name]===method)'),'opening path UI replaced an engine mutation method');
  report.engineMethodsStable=true;
  await press(cdp,'[data-home-tab="path"]');
  await waitFor(cdp,"!!document.querySelector('#passageSetStart')",'reading challenge');
  await press(cdp,'#passageSetStart');
  report.stage3Answers=0;
  while(report.stage3Answers<3){
    const actionBefore=await actionGeometry(cdp,'#stage3Next');
    await answerVisible(cdp,'stage3',report.stage3Answers===0);
    await stableAction(cdp,'#stage3Next',actionBefore,'reading challenge');
    await expandedFeedback(cdp,'#stage3Feedback','#stage3Next');
    const clearNav=await evaluate(cdp,"document.querySelector('#stage3Next').closest('.question-actions').getBoundingClientRect().bottom<=document.querySelector('.home-tabs').getBoundingClientRect().top");
    check(clearNav,'reading action overlaps primary navigation');
    if(report.stage3Answers===0)await screenshot(cdp,'reading-feedback');
    await press(cdp,'#stage3Next');report.stage3Answers++;
  }
  await waitFor(cdp,"!!document.querySelector('.stage3-summary-score')",'reading completion');
  check(await evaluate(cdp,"!document.querySelector('#stage3Reading .question-footer')"),'completed reading retained fixed action');
  report.fixedReadingAction=true;
  // A real reload must retain progress; no engine or DOM is replaced by a stub.
  xp=await evaluate(cdp,'window.ManjingoLocalLearning.getProgress().totalXp');
  await navigate(cdp,'/');
  await waitFor(cdp,'!!window.ManjingoLocalLearning','reloaded engine');
  check(await evaluate(cdp,'window.ManjingoLocalLearning.getProgress().totalXp')===xp,'reload lost local progress');
  await waitFor(cdp,"!!document.querySelector('#accountBar button')",'account controls');
  await press(cdp,'#accountBar button');
  await waitFor(cdp,"document.querySelector('#accountBar')?.textContent.includes('Google 登入失敗')&&!document.querySelector('#accountBar button').disabled",'offline Google error recovery');
  check(await evaluate(cdp,'window.ManjingoLocalLearning.getProgress().totalXp')===xp,'login failure changed progress');
  await screenshot(cdp,'offline-account');
  await navigate(cdp,'/lesson.html?kpId=kp_p3_yi');
  await waitFor(cdp,"!!document.querySelector('#startPractice')",'lesson intro');
  await screenshot(cdp,'lesson-intro');
  check(await evaluate(cdp,'!window.ManjingoLearningEvents&&!window.ManjingoDifficultyCalibration'),'ordinary lesson unexpectedly loaded home notification helpers');
  await evaluate(cdp,`window.__lessonLearningSources=[];window.addEventListener('manjingo:learning-state-changed',event=>window.__lessonLearningSources.push(event.detail.source));true`);
  const before=await evaluate(cdp,"window.ManjingoLocalLearning.getKnowledge('kp_p3_yi').attempts");
  await press(cdp,'#startPractice');
  for(let i=0;i<6;i++){
    if(await evaluate(cdp,"!!document.querySelector('#lessonApp .lesson-complete, #lessonApp .session-summary.done')"))break;
    const actionBefore=await actionGeometry(cdp,'#lessonNext');
    await answerVisible(cdp,'lesson',i===0);
    await stableAction(cdp,'#lessonNext',actionBefore,'lesson question '+i);
    report.lessonAnswers++;
    if(i===0){await expandedFeedback(cdp,'#lessonFeedback','#lessonNext');await screenshot(cdp,'lesson-feedback');}
    await press(cdp,'#lessonNext');
  }
  await waitFor(cdp,"!!document.querySelector('#lessonApp .lesson-complete, #lessonApp .session-summary.done')",'lesson completion');
  check(await evaluate(cdp,"window.ManjingoLocalLearning.getKnowledge('kp_p3_yi').attempts")===before+report.lessonAnswers,'lesson answer persistence mismatch');
  const lessonSources=await evaluate(cdp,'window.__lessonLearningSources');
  check(lessonSources.length===report.lessonAnswers&&lessonSources.every(source=>source==='submit'),'lesson must notify once per answer without path UI: '+JSON.stringify(lessonSources));
  report.lessonNotifications=lessonSources.length;
  check(await evaluate(cdp,"!document.querySelector('#lessonApp .question-footer')"),'completed lesson retained fixed action');
  report.fixedLessonAction=true;
  await noHorizontalOverflow(cdp,'lesson completion');
  await screenshot(cdp,'lesson-completed');
  report.progressPersisted=true;report.views=['results','weakness','path'];report.offlineAccountRecovery=true;
  console.log('BROWSER_ACCEPTANCE='+JSON.stringify(report));
}

const executable=chromePath();
const local=localAcceptance?await localServer():null;
const profile=await mkdtemp(join(tmpdir(),'manyingo-mobile-smoke-'));
const chrome=spawn(executable,[
  '--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking','--disable-component-update',
  '--disable-default-apps','--disable-sync','--metrics-recording-only','--no-first-run','--remote-debugging-port=9222',
  '--user-data-dir='+profile,'--window-size=390,844','about:blank'
],{stdio:['ignore','ignore','pipe']});
let stderr='';chrome.stderr.on('data',chunk=>{stderr+=String(chunk).slice(-4000)});

let cdp=null;
const deadline=setTimeout(()=>{console.error('Browser smoke exceeded 120 seconds');chrome.kill('SIGKILL');process.exit(1)},120000);deadline.unref();
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
  await cdp.call('Page.navigate',{url:baseUrl+(localAcceptance?'/?ci-mobile-smoke=1':'/?perf=1&ci-mobile-smoke=1')});
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
  if(localAcceptance){
    await acceptDevice(cdp,metrics);
    currentDevice='desktop';
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false});
    await cdp.call('Emulation.setTouchEmulationEnabled',{enabled:false});
    await cdp.call('Storage.clearDataForOrigin',{origin:baseUrl,storageTypes:'all'});
    await navigate(cdp,'/');
    await press(cdp,'#start');
    const desktopMetrics=await waitFor(cdp,'window.ManjingoStudyStartMetrics||null','desktop study start');
    await acceptDevice(cdp,desktopMetrics);
    const errors=cdp.events.filter(e=>e.method==='Runtime.exceptionThrown').map(e=>e.params.exceptionDetails.exception?.description||e.params.exceptionDetails.text);
    const failedAssets=cdp.events.filter(e=>e.method==='Network.responseReceived'&&e.params.response.url.startsWith(baseUrl)&&e.params.response.status>=400).map(e=>e.params.response.url);
    check(!errors.length,'uncaught browser exceptions: '+JSON.stringify(errors));
    check(!failedAssets.length,'local assets failed: '+JSON.stringify(failedAssets));
    check(!local.apiRequests.length,'acceptance unexpectedly called backend: '+JSON.stringify(local.apiRequests));
    acceptanceReport.uncaughtExceptions=errors;acceptanceReport.failedAssets=failedAssets;acceptanceReport.apiRequests=local.apiRequests;
    acceptanceReport.passed=true;
  }
}catch(error){
  if(localAcceptance&&cdp){try{await screenshot(cdp,'failure');acceptanceReport.failureDom=await evaluate(cdp,`({url:location.pathname,question:document.querySelector('#quiz .question, .lesson-question')?.textContent,html:document.querySelector('#answers, #lessonApp')?.innerHTML,errors:[]})`)}catch(_){}acceptanceReport.error=String(error.stack||error)}
  throw error;
}finally{
  clearTimeout(deadline);
  if(localAcceptance){await mkdir(artifactDir,{recursive:true});await writeFile(join(artifactDir,'report.json'),JSON.stringify(acceptanceReport,null,2))}
  if(cdp)cdp.close();
  try{chrome.kill('SIGTERM')}catch(e){}
  await new Promise(resolve=>setTimeout(resolve,100));
  await rm(profile,{recursive:true,force:true});
  if(local){local.server.closeAllConnections();await new Promise(resolve=>local.server.close(resolve))}
}
