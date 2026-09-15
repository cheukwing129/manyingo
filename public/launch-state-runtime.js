(function(root,factory){
'use strict';
const api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.ManjingoLaunchState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
let installed=false,refreshQueued=false;
function doc(){return root.document||null}
function isHomepage(){const pathname=String(root.location&&root.location.pathname||''),page=pathname.split('/').pop();return !page||page==='index.html'}
function refreshLearningViews(){const events=root.ManjingoLearningEvents;if(events&&typeof events.refresh==='function')events.refresh();const ux=root.ManjingoUX;if(ux&&typeof ux.enhanceEmptyLearningStates==='function')ux.enhanceEmptyLearningStates();return true}
function scheduleLearningViewsRefresh(){if(refreshQueued)return false;refreshQueued=true;const run=()=>{refreshQueued=false;refreshLearningViews()};if(typeof root.queueMicrotask==='function')root.queueMicrotask(run);else Promise.resolve().then(run);return true}
function completionVisible(){const d=doc(),quiz=d&&d.getElementById('quiz');return !!(quiz&&quiz.querySelector('.session-summary.done,.done'))}
function restoreTodayPlanFromCompletion(){const d=doc(),plan=d&&d.getElementById('plan'),quiz=d&&d.getElementById('quiz');if(!plan||!quiz||!completionVisible())return false;plan.classList.remove('hidden');quiz.classList.add('hidden');const ux=root.ManjingoUX;if(ux&&typeof ux.updateDailyCta==='function')ux.updateDailyCta();const shell=root.ManjingoHomeShell;if(shell&&typeof shell.refreshTodayPlanHero==='function')shell.refreshTodayPlanHero();return true}
function onDocumentClick(event){const target=event&&event.target&&event.target.closest?event.target.closest('[data-home-tab="today"]'):null;if(target)restoreTodayPlanFromCompletion()}
function onHashChange(){if(String(root.location&&root.location.hash||'')==='#homeToday')restoreTodayPlanFromCompletion()}
function onAccountSync(event){const status=String(event&&event.detail&&event.detail.status||'');if(status&&status!=='syncing')scheduleLearningViewsRefresh()}
function install(){const d=doc();if(installed||!d||!isHomepage())return false;installed=true;d.addEventListener('click',onDocumentClick,true);if(typeof root.addEventListener==='function'){root.addEventListener('hashchange',onHashChange);root.addEventListener('manjingo:account-sync-state',onAccountSync);root.addEventListener('manjingo:answer-sync-complete',scheduleLearningViewsRefresh)}return true}
return{isHomepage,refreshLearningViews,scheduleLearningViewsRefresh,completionVisible,restoreTodayPlanFromCompletion,onAccountSync,install};
});