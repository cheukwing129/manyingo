(function(){
'use strict';
const DEFERRED_RUNTIME=['./remote-sync-guard.js','./account-sync.js'];
let runtimePromise=null,scheduled=false,lastInteractionAt=0;
window.ManjingoLessonRuntimeBundled=true;
function scriptPresent(src){return Array.from(document.scripts||[]).some(script=>{const raw=String(script.getAttribute&&script.getAttribute('src')||script.src||'');return raw===src||raw.endsWith('/'+String(src).replace(/^\.\//,''))})}
function loadScript(src){if(scriptPresent(src))return Promise.resolve(src);return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.async=false;script.setAttribute('data-lesson-runtime','deferred');script.addEventListener('load',()=>resolve(src),{once:true});script.addEventListener('error',()=>reject(new Error('Unable to load '+src)),{once:true});document.head.appendChild(script)})}
function ensureDeferredRuntime(){if(runtimePromise)return runtimePromise;runtimePromise=DEFERRED_RUNTIME.reduce((promise,src)=>promise.then(()=>loadScript(src)),Promise.resolve()).then(()=>true).catch(error=>{runtimePromise=null;console.warn('lesson deferred runtime unavailable',error);throw error});return runtimePromise}
function scheduleDeferredRuntime(){if(scheduled||typeof document==='undefined')return false;scheduled=true;const queue=()=>{const run=()=>{if(Date.now()-lastInteractionAt<900){setTimeout(queue,1000);return}void ensureDeferredRuntime().catch(()=>{})};if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(run,{timeout:3500});else setTimeout(run,1200)};const afterDom=()=>queue();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterDom,{once:true});else afterDom();return true}
if(typeof document!=='undefined'){const note=()=>{lastInteractionAt=Date.now()};document.addEventListener('pointerdown',note,true);document.addEventListener('keydown',note,true);scheduleDeferredRuntime()}
window.ManjingoLessonRuntimeLoader={deferred:DEFERRED_RUNTIME.slice(),ensure:ensureDeferredRuntime,schedule:scheduleDeferredRuntime};
})();
