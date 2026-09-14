'use strict';

const DEFAULT_MIN_EVENTS=20;
const DEFAULT_MIN_LEARNERS=10;
const Z95=1.959963984540054;

function asBool(value){return value===true;}
function cleanString(value){return String(value==null?'':value).trim();}
function diagnosticKey(skillId,item){
  const mode=item&&item.diagnosticMode==='choice'?'choice':'question';
  const choice=mode==='choice'&&Number.isInteger(item.choiceIndex)?String(item.choiceIndex):'*';
  return `${skillId}|${cleanString(item&&item.questionId)}|${mode}|${choice}`;
}
function wilsonInterval(successes,total,z=Z95){
  const n=Number(total)||0,k=Math.max(0,Math.min(n,Number(successes)||0));
  if(!n)return{low:0,high:1};
  const p=k/n,z2=z*z,denom=1+z2/n,centre=p+z2/(2*n),margin=z*Math.sqrt((p*(1-p)+z2/(4*n))/n);
  return{low:Math.max(0,(centre-margin)/denom),high:Math.min(1,(centre+margin)/denom)};
}
function createBucket(base){return{...base,events:0,supportedEvents:0,learners:new Set(),learnerSupport:new Map()};}
function addObservation(bucket,learnerId,supported){
  bucket.events+=1;
  if(supported)bucket.supportedEvents+=1;
  const learner=cleanString(learnerId)||'unknown';
  bucket.learners.add(learner);
  const row=bucket.learnerSupport.get(learner)||{events:0,supportedEvents:0};
  row.events+=1;if(supported)row.supportedEvents+=1;
  bucket.learnerSupport.set(learner,row);
}
function finalizeBucket(bucket,options={}){
  const minEvents=Number(options.minEvents)||DEFAULT_MIN_EVENTS,minLearners=Number(options.minLearners)||DEFAULT_MIN_LEARNERS;
  const events=bucket.events,supportedEvents=bucket.supportedEvents,learnerCount=bucket.learners.size;
  const rate=events?supportedEvents/events:0,ci=wilsonInterval(supportedEvents,events),eligible=events>=minEvents&&learnerCount>=minLearners;
  let status='insufficient-sample';
  if(eligible){
    if(ci.high<0.5)status='review-low-support';
    else if(ci.low>=0.5)status='strong-support';
    else status='mixed';
  }
  return Object.freeze({
    ...Object.fromEntries(Object.entries(bucket).filter(([key])=>!['learners','learnerSupport'].includes(key))),
    learnerCount,
    verificationSupportRate:Number(rate.toFixed(4)),
    wilson95:{low:Number(ci.low.toFixed(4)),high:Number(ci.high.toFixed(4))},
    eligible,
    status
  });
}
function normalizeCalibration(raw,index=0){
  const doc=raw&&raw.data?raw.data:raw||{};
  const learnerId=cleanString(raw&&raw.learnerId)||cleanString(raw&&raw.uid)||`anonymous-${index}`;
  const skillId=cleanString(doc.skillId),mapVersion=cleanString(doc.mapVersion),supported=asBool(doc.supported);
  const evidence=Array.isArray(doc.diagnosticEvidence)?doc.diagnosticEvidence.filter(item=>item&&item.questionId):[];
  if(!skillId||!mapVersion||!evidence.length)return null;
  return{learnerId,skillId,mapVersion,supported,evidence,completedAt:cleanString(doc.completedAt)};
}
function buildCalibrationReport(rows,options={}){
  const normalized=(Array.isArray(rows)?rows:[]).map(normalizeCalibration).filter(Boolean);
  const skillBuckets=new Map(),mappingBuckets=new Map(),versions=new Map();
  for(const event of normalized){
    versions.set(event.mapVersion,(versions.get(event.mapVersion)||0)+1);
    if(!skillBuckets.has(event.skillId))skillBuckets.set(event.skillId,createBucket({skillId:event.skillId}));
    addObservation(skillBuckets.get(event.skillId),event.learnerId,event.supported);
    for(const item of event.evidence){
      const key=diagnosticKey(event.skillId,item);
      if(!mappingBuckets.has(key))mappingBuckets.set(key,createBucket({
        key,skillId:event.skillId,questionId:cleanString(item.questionId),diagnosticMode:item.diagnosticMode==='choice'?'choice':'question',choiceIndex:item.diagnosticMode==='choice'&&Number.isInteger(item.choiceIndex)?item.choiceIndex:null
      }));
      addObservation(mappingBuckets.get(key),event.learnerId,event.supported);
    }
  }
  const finalize=bucket=>finalizeBucket(bucket,options);
  const mappings=[...mappingBuckets.values()].map(finalize).sort((a,b)=>{
    const rank={'review-low-support':0,'mixed':1,'strong-support':2,'insufficient-sample':3};
    return (rank[a.status]-rank[b.status])||(b.events-a.events)||a.key.localeCompare(b.key);
  });
  const skills=[...skillBuckets.values()].map(finalize).sort((a,b)=>b.events-a.events||a.skillId.localeCompare(b.skillId));
  const learnerIds=new Set(normalized.map(event=>event.learnerId));
  return{
    generatedAt:new Date().toISOString(),
    thresholds:{minEvents:Number(options.minEvents)||DEFAULT_MIN_EVENTS,minLearners:Number(options.minLearners)||DEFAULT_MIN_LEARNERS},
    totals:{events:normalized.length,learners:learnerIds.size,mappings:mappings.length,skills:skills.length},
    mapVersions:Object.fromEntries([...versions.entries()].sort()),
    statusCounts:mappings.reduce((acc,row)=>{acc[row.status]=(acc[row.status]||0)+1;return acc;},{}),
    mappings,
    skills
  };
}
function pct(value){return `${(100*(Number(value)||0)).toFixed(1)}%`;}
function toMarkdown(report){
  const lines=['# Stage 3 Diagnostic Calibration Report','',`Generated: ${report.generatedAt}`,'',`Events: ${report.totals.events} · Learners: ${report.totals.learners} · Diagnostic mappings observed: ${report.totals.mappings}`,'',`Decision gate: at least ${report.thresholds.minEvents} events and ${report.thresholds.minLearners} distinct learners. No mapping is changed automatically.`,'','## Mappings to review',''];
  const flagged=report.mappings.filter(row=>row.status==='review-low-support');
  if(!flagged.length)lines.push('No mapping currently meets the conservative low-support review threshold.');
  else{
    lines.push('| Skill | Stage 3 evidence | N | Learners | Support | 95% CI |','|---|---|---:|---:|---:|---:|');
    for(const row of flagged)lines.push(`| ${row.skillId} | ${row.questionId}${row.diagnosticMode==='choice'?` choice ${row.choiceIndex}`:' question-level'} | ${row.events} | ${row.learnerCount} | ${pct(row.verificationSupportRate)} | ${pct(row.wilson95.low)}–${pct(row.wilson95.high)} |`);
  }
  lines.push('','## All observed mappings','', '| Status | Skill | Evidence | N | Learners | Support |','|---|---|---|---:|---:|---:|');
  for(const row of report.mappings)lines.push(`| ${row.status} | ${row.skillId} | ${row.questionId}${row.diagnosticMode==='choice'?` / ${row.choiceIndex}`:''} | ${row.events} | ${row.learnerCount} | ${pct(row.verificationSupportRate)} |`);
  lines.push('','> `verificationSupportRate` means the later two-question core verification contained at least one incorrect answer. It is calibration evidence, not a direct estimate of diagnostic precision.');
  return lines.join('\n')+'\n';
}

module.exports={DEFAULT_MIN_EVENTS,DEFAULT_MIN_LEARNERS,diagnosticKey,wilsonInterval,normalizeCalibration,buildCalibrationReport,toMarkdown};
