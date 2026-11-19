(function(root,factory){
'use strict';
const api=factory(root);
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoStreakMilestones=api;
if(root.document)api.install();
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const names={5:'初露墨光',10:'積墨成章',15:'筆耕不輟',20:'文言同行'};
function dateKey(now=Date.now(),offset=0){return new Date(Number(now)+8*3600000+offset*86400000).toISOString().slice(0,10)}
function model(progress={},now=Date.now()){
 const today=dateKey(now),yesterday=dateKey(now,-1),last=progress.lastGoalDate||null;
 const stored=Math.max(0,Math.floor(Number(progress.streak)||0));
 const current=last&&last>=yesterday&&last<=today?stored:0;
 const best=Math.max(current,stored,Math.floor(Number(progress.longestStreak)||0));
 const complete=last===today;
 const milestone=current>0&&current%5===0?current:0;
 const next=(Math.floor(current/5)+1)*5;
 return{today,current,best,complete,next,remaining:next-current,filled:current%5,
 earned:Math.floor(best/5),celebrate:complete&&milestone>(Number(progress.streakCelebratedThrough)||0)?milestone:0,
 message:complete?'今日已完成 ✓':current?'完成今日 20 XP，延續紀錄':best?'今天重新出發，已獲得的紀念章會保留':'完成今日 20 XP，開始第一天'};
}
function badgeName(days){return names[days]||'持之以恆'}
let installed=false,rendering=false,signature='',celebration=0,collectionLimit=20;
function install(){
 const doc=root.document,engine=()=>root.ManjingoLocalLearning;
 if(installed||!doc||!doc.getElementById('plan')||!engine())return false;
 installed=true;
 const card=doc.createElement('section');card.id='streakMilestones';card.className='card streak-card';card.setAttribute('aria-labelledby','streakTitle');
 card.innerHTML='<div class="streak-heading"><div><span class="streak-eyebrow" id="streakTitle">每天一點，累積成章</span><div class="streak-number"><strong id="streakDays">0</strong><span>天連續學習</span></div></div><img class="streak-mascot" src="./mascot/v2/complete.svg" alt="" width="72" height="80"></div><p class="streak-today" id="streakToday" aria-live="polite"></p><div class="streak-celebration" id="streakCelebration" hidden><span aria-hidden="true">✦</span><div><strong id="streakCelebrationTitle"></strong><span id="streakCelebrationText"></span></div><button type="button" aria-label="收起達標慶祝">收下</button></div><div class="streak-next"><span id="streakNext"></span><strong id="streakRemaining"></strong></div><div class="streak-steps" id="streakSteps" role="progressbar" aria-label="前往下一個五天里程碑" aria-valuemin="0" aria-valuemax="5"><i></i><i></i><i></i><i></i><i></i></div><div class="streak-foot"><span id="streakBest"></span><span>每日 20 XP · 香港時間換日</span></div><details class="streak-collection"><summary id="streakCollectionTitle">紀念章收藏</summary><div class="streak-badges" id="streakBadges"></div><button class="streak-more" type="button" hidden>顯示更多</button><p>每連續學習 5 天，解鎖一枚紀念章。中斷後仍保留收藏與最長紀錄。</p></details>';
 doc.getElementById('plan').insertAdjacentElement('afterend',card);
 const el=id=>doc.getElementById(id);
 function render(){
  if(rendering)return;rendering=true;
  try{
   const state=model(engine().getProgress()),active=doc.body.classList.contains('study-focus');
   const key=JSON.stringify([state,active,collectionLimit,celebration]);if(key===signature)return;signature=key;
   el('streakDays').textContent=state.current;el('streakToday').textContent=state.message;
   el('streakNext').textContent='下一枚紀念章 · '+state.next+' 天';el('streakRemaining').textContent='還差 '+state.remaining+' 天';
   el('streakBest').textContent='最長紀錄 '+state.best+' 天';
   el('streakSteps').setAttribute('aria-valuenow',String(state.filled));
   el('streakSteps').setAttribute('aria-valuetext',state.current+' 天連續學習，距離 '+state.next+' 天里程碑還差 '+state.remaining+' 天');
   Array.from(el('streakSteps').children).forEach((step,index)=>step.classList.toggle('filled',index<state.filled));
   el('streakCollectionTitle').textContent='紀念章收藏 · 已解鎖 '+state.earned+' 枚';
   const badges=el('streakBadges');badges.replaceChildren();
   const total=Math.max(4,state.earned+1),limit=Math.min(total,collectionLimit);
   for(let i=1;i<=limit;i++){
    const days=i*5,earned=i<=state.earned,badge=doc.createElement('div');badge.className='streak-badge'+(earned?' earned':'');
    const seal=doc.createElement('span'),title=doc.createElement('strong'),label=doc.createElement('small');
    seal.className='streak-seal';seal.textContent=days;seal.setAttribute('aria-hidden','true');
    title.textContent=badgeName(days);label.textContent=days+' 天 · '+(earned?'已解鎖':'待解鎖');badge.append(seal,title,label);badges.appendChild(badge);
   }
   card.querySelector('.streak-more').hidden=limit>=total;
   if(!active&&state.celebrate){
    celebration=state.celebrate;
    el('streakCelebrationTitle').textContent='連續 '+celebration+' 天，紀念章解鎖！';
    el('streakCelebrationText').textContent='「'+badgeName(celebration)+'」已加入收藏';
    engine().acknowledgeStreakMilestone(celebration);
   }
   el('streakCelebration').hidden=!celebration;
   card.classList.toggle('celebrating',!!celebration);
   card.querySelector('.streak-mascot').src=celebration?'./mascot/v2/celebrate.svg':'./mascot/v2/complete.svg';
  }finally{rendering=false}
 }
 el('streakCelebration').querySelector('button').onclick=()=>{celebration=0;signature='';render()};
 card.querySelector('.streak-more').onclick=()=>{collectionLimit+=20;render()};
 ['manjingo:learning-state-changed','manjingo:account-sync-state','manjingo:study-mode-exit','manjingo:study-mode-enter','storage','pageshow'].forEach(event=>root.addEventListener(event,render));
 doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)render()});
 // Refresh across Hong Kong midnight without issuing network requests.
 root.setInterval(()=>{if(!doc.hidden)render()},60000);
 render();return true;
}
return{dateKey,model,badgeName,install};
});
