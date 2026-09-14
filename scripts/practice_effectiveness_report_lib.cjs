'use strict';

const DAY=86400000;
const HOUR=3600000;
const MINUTE=60000;
const Z95=1.959963984540054;
const DEFAULTS={days:60,lookbackDays:7,followupDays:14,minDelayMinutes:15,delayedHours:24,minFollowups:3,minDelayedFollowups:2,maxFollowups:6,successAccuracy:0.75,minEpisodes:20,minLearners:10};

function clean(value){return String(value==null?'':value).trim();}
function timeMs(value){
  if(value==null)return 0;
  if(value instanceof Date)return value.getTime();
  if(typeof value.toDate==='function')return value.toDate().getTime();
  if(typeof value==='object'&&Number.isFinite(Number(value.seconds??value._seconds)))return Number(value.seconds??value._seconds)*1000+Math.floor(Number(value.nanoseconds??value._nanoseconds??0)/1e6);
  const t=new Date(value).getTime();return Number.isFinite(t)?t:0;
}
function wilson(successes,total,z=Z95){const n=Number(total)||0,k=Math.max(0,Math.min(n,Number(successes)||0));if(!n)return{low:0,high:1};const p=k/n,z2=z*z,d=1+z2/n,c=p+z2/(2*n),m=z*Math.sqrt((p*(1-p)+z2/(4*n))/n);return{low:Math.max(0,(c-m)/d),high:Math.min(1,(c+m)/d)};}
function normalizePractice(row,index=0){const data=row&&row.data?row.data:row||{},learnerId=clean(row&&row.learnerId)||`anonymous-${index}`,practiceId=clean(data.practiceId),skillId=clean(data.skillId),strategy=['targeted','remedial','reteach'].includes(clean(data.strategy).toLowerCase())?clean(data.strategy).toLowerCase():null,completedAt=timeMs(data.completedAt);if(!practiceId||!skillId||!strategy||!completedAt)return null;return{learnerId,practiceId,skillId,strategy,completedAt,practiceAccuracy:Number(data.accuracy)||0,masteryDelta:Number(data.delta)||0};}
function normalizeAnswer(row,index=0){const data=row&&row.data?row.data:row||{},learnerId=clean(row&&row.learnerId)||`anonymous-${index}`,skillId=clean(data.skillId),questionId=clean(data.questionId),answeredAt=timeMs(data.answeredAt||data.lastAnsweredAt);if(!learnerId||!skillId||!questionId||!answeredAt)return null;return{learnerId,skillId,questionId,answeredAt,isCorrect:data.isCorrect===true};}
function uniqueByQuestion(rows){const seen=new Set(),out=[];for(const row of rows){if(seen.has(row.questionId))continue;seen.add(row.questionId);out.push(row);}return out;}
function accuracy(rows){return rows.length?rows.filter(x=>x.isCorrect).length/rows.length:0;}
function episodeKey(row){return `${row.learnerId}|${row.skillId}`;}
function buildEpisodes(practiceRows,answerRows,options={}){
  const o={...DEFAULTS,...options},now=Number(options.now)||Date.now(),since=now-o.days*DAY;
  const practices=(practiceRows||[]).map(normalizePractice).filter(Boolean).filter(x=>x.completedAt>=since&&x.completedAt<=now).sort((a,b)=>a.completedAt-b.completedAt);
  const answers=(answerRows||[]).map(normalizeAnswer).filter(Boolean).sort((a,b)=>a.answeredAt-b.answeredAt),byKey=new Map(),sessionsByKey=new Map();
  for(const a of answers){const k=episodeKey(a);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(a);}
  for(const p of practices){const k=episodeKey(p);if(!sessionsByKey.has(k))sessionsByKey.set(k,[]);sessionsByKey.get(k).push(p);}
  const episodes=[];
  for(const p of practices){
    const k=episodeKey(p),sameAnswers=byKey.get(k)||[],sameSessions=sessionsByKey.get(k)||[],idx=sameSessions.findIndex(x=>x.practiceId===p.practiceId),nextTime=idx>=0&&sameSessions[idx+1]?sameSessions[idx+1].completedAt:Infinity;
    const preStart=p.completedAt-o.lookbackDays*DAY,priorIds=new Set(sameAnswers.filter(a=>a.answeredAt>=preStart&&a.answeredAt<p.completedAt).map(a=>a.questionId));
    const windowStart=p.completedAt+o.minDelayMinutes*MINUTE,windowEnd=Math.min(p.completedAt+o.followupDays*DAY,nextTime-1,now);
    const fresh=uniqueByQuestion(sameAnswers.filter(a=>a.answeredAt>=windowStart&&a.answeredAt<=windowEnd&&!priorIds.has(a.questionId))).slice(0,o.maxFollowups);
    const delayed=fresh.filter(a=>a.answeredAt>=p.completedAt+o.delayedHours*HOUR);
    const followupAccuracy=accuracy(fresh),delayedAccuracy=accuracy(delayed),eligible=fresh.length>=o.minFollowups,delayedEligible=delayed.length>=o.minDelayedFollowups;
    episodes.push({learnerId:p.learnerId,practiceId:p.practiceId,skillId:p.skillId,strategy:p.strategy,completedAt:p.completedAt,practiceAccuracy:p.practiceAccuracy,masteryDelta:p.masteryDelta,freshQuestionCount:fresh.length,followupAccuracy,eligible,retained:eligible&&followupAccuracy>=o.successAccuracy,delayedQuestionCount:delayed.length,delayedAccuracy,delayedEligible,delayedRetained:delayedEligible&&delayedAccuracy>=o.successAccuracy});
  }
  return episodes;
}
function bucketBase(base){return{...base,sessions:0,eligibleEpisodes:0,retainedEpisodes:0,delayedEligibleEpisodes:0,delayedRetainedEpisodes:0,followupCorrect:0,followupTotal:0,learners:new Set()};}
function add(bucket,e){bucket.sessions++;if(e.eligible){bucket.eligibleEpisodes++;if(e.retained)bucket.retainedEpisodes++;bucket.followupTotal+=e.freshQuestionCount;bucket.followupCorrect+=Math.round(e.followupAccuracy*e.freshQuestionCount);bucket.learners.add(e.learnerId);}if(e.delayedEligible){bucket.delayedEligibleEpisodes++;if(e.delayedRetained)bucket.delayedRetainedEpisodes++;}}
function finalize(bucket,options){const o={...DEFAULTS,...options},n=bucket.eligibleEpisodes,k=bucket.retainedEpisodes,learners=bucket.learners.size,ci=wilson(k,n),eligible=n>=o.minEpisodes&&learners>=o.minLearners,rate=n?k/n:0,answerAccuracy=bucket.followupTotal?bucket.followupCorrect/bucket.followupTotal:0,delayedRate=bucket.delayedEligibleEpisodes?bucket.delayedRetainedEpisodes/bucket.delayedEligibleEpisodes:null;let status='insufficient-sample';if(eligible){if(ci.high<0.6)status='review-low-transfer';else if(ci.low>=0.6)status='strong-transfer';else status='mixed';}return Object.freeze({...Object.fromEntries(Object.entries(bucket).filter(([key])=>key!=='learners')),learnerCount:learners,retentionRate:Number(rate.toFixed(4)),followupAnswerAccuracy:Number(answerAccuracy.toFixed(4)),delayedRetentionRate:delayedRate==null?null:Number(delayedRate.toFixed(4)),wilson95:{low:Number(ci.low.toFixed(4)),high:Number(ci.high.toFixed(4))},eligible,status});}
function buildEffectivenessReport(practiceRows,answerRows,options={}){
  const o={...DEFAULTS,...options},episodes=buildEpisodes(practiceRows,answerRows,o),strategyBuckets=new Map(),skillBuckets=new Map();
  for(const e of episodes){
    if(!strategyBuckets.has(e.strategy))strategyBuckets.set(e.strategy,bucketBase({strategy:e.strategy}));add(strategyBuckets.get(e.strategy),e);
    const key=`${e.skillId}|${e.strategy}`;if(!skillBuckets.has(key))skillBuckets.set(key,bucketBase({key,skillId:e.skillId,strategy:e.strategy}));add(skillBuckets.get(key),e);
  }
  const strategies=[...strategyBuckets.values()].map(b=>finalize(b,o)).sort((a,b)=>a.strategy.localeCompare(b.strategy));
  const skillStrategies=[...skillBuckets.values()].map(b=>finalize(b,o)).sort((a,b)=>{const rank={'review-low-transfer':0,mixed:1,'strong-transfer':2,'insufficient-sample':3};return rank[a.status]-rank[b.status]||b.eligibleEpisodes-a.eligibleEpisodes||a.key.localeCompare(b.key);});
  const learnerCount=new Set(episodes.filter(e=>e.eligible).map(e=>e.learnerId)).size;
  return{generatedAt:new Date().toISOString(),method:'observational-post-practice-transfer-v1',thresholds:{days:o.days,lookbackDays:o.lookbackDays,followupDays:o.followupDays,minDelayMinutes:o.minDelayMinutes,delayedHours:o.delayedHours,minFollowups:o.minFollowups,minDelayedFollowups:o.minDelayedFollowups,maxFollowups:o.maxFollowups,successAccuracy:o.successAccuracy,minEpisodes:o.minEpisodes,minLearners:o.minLearners},totals:{practiceSessions:episodes.length,eligibleEpisodes:episodes.filter(e=>e.eligible).length,delayedEligibleEpisodes:episodes.filter(e=>e.delayedEligible).length,learners:learnerCount},statusCounts:skillStrategies.reduce((acc,row)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{}),strategies,skillStrategies};
}
function pct(v){return v==null?'—':`${(100*Number(v||0)).toFixed(1)}%`;}
function toMarkdown(report){const t=report.thresholds,lines=['# Practice Effectiveness Report','',`Generated: ${report.generatedAt}`,'',`Method: ${report.method}`,'',`Practice sessions observed: ${report.totals.practiceSessions} · Eligible transfer episodes: ${report.totals.eligibleEpisodes} · Learners: ${report.totals.learners}`,'',`Episode gate: at least ${t.minFollowups} distinct post-practice questions, excluding question IDs seen in the previous ${t.lookbackDays} days; follow-up window ${t.minDelayMinutes} minutes to ${t.followupDays} days, ending before the next practice session for the same skill.`,'',`Classification gate: at least ${t.minEpisodes} eligible episodes and ${t.minLearners} distinct learners. Success threshold: ${pct(t.successAccuracy)} post-practice accuracy. No intervention rule changes automatically.`,'','## Strategy summary','', '| Strategy | Sessions | Eligible | Learners | Retained | 95% CI | Delayed retention |','|---|---:|---:|---:|---:|---:|---:|'];for(const row of report.strategies)lines.push(`| ${row.strategy} | ${row.sessions} | ${row.eligibleEpisodes} | ${row.learnerCount} | ${pct(row.retentionRate)} | ${pct(row.wilson95.low)}–${pct(row.wilson95.high)} | ${pct(row.delayedRetentionRate)} |`);lines.push('','## Skill × strategy combinations to review','');const flagged=report.skillStrategies.filter(x=>x.status==='review-low-transfer');if(!flagged.length)lines.push('No combination currently meets the conservative low-transfer review threshold.');else{lines.push('| Skill | Strategy | Episodes | Learners | Retained | 95% CI |','|---|---|---:|---:|---:|---:|');for(const row of flagged)lines.push(`| ${row.skillId} | ${row.strategy} | ${row.eligibleEpisodes} | ${row.learnerCount} | ${pct(row.retentionRate)} | ${pct(row.wilson95.low)}–${pct(row.wilson95.high)} |`);}lines.push('','## All observed skill × strategy combinations','', '| Status | Skill | Strategy | Eligible | Learners | Retained | Delayed |','|---|---|---|---:|---:|---:|---:|');for(const row of report.skillStrategies)lines.push(`| ${row.status} | ${row.skillId} | ${row.strategy} | ${row.eligibleEpisodes} | ${row.learnerCount} | ${pct(row.retentionRate)} | ${pct(row.delayedRetentionRate)} |`);lines.push('','> This is observational transfer evidence, not a randomized causal estimate. It should flag where to investigate, not automatically change mastery, intervention thresholds, or pedagogy.');return lines.join('\n')+'\n';}

module.exports={DEFAULTS,timeMs,wilson,normalizePractice,normalizeAnswer,buildEpisodes,buildEffectivenessReport,toMarkdown};
