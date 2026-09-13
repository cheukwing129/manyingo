(function(root,factory){
'use strict';
const api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.ManjingoStage3CalibrationServer=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION='stage3-calibration-v1';
const VERIFIED_BY='server-answer-logs-v1';
const MAP_VERSION='stage3-choice-diagnostics-v1';

function bad(message,status){throw Object.assign(new Error(message),{status:status||400});}
function iso(value){const date=new Date(value||Date.now());if(!Number.isFinite(date.getTime()))bad('Invalid calibration timestamp');return date.toISOString();}
function diagnostics(){return root.ManjingoStage3Diagnostics||{};}
function coreSkillSet(){const curriculum=root.ManjingoCurriculumV1;return new Set(curriculum&&typeof curriculum.coreSkills==='function'?curriculum.coreSkills().map(item=>String(item.id)):[]);}
function validateEvidenceItem(raw,skillId){
  if(!raw||!raw.questionId)bad('Invalid Stage 3 diagnostic evidence');
  const questionId=String(raw.questionId),mode=raw.diagnosticMode==='choice'?'choice':'question',choiceIndex=Number.isInteger(raw.choiceIndex)?raw.choiceIndex:null,map=diagnostics();
  let mapped=[];
  if(mode==='choice'){
    if(!Number.isInteger(choiceIndex))bad('Choice diagnostic evidence requires a reviewed option index');
    const questionMap=map.CHOICE_DIAGNOSTIC_MAP&&map.CHOICE_DIAGNOSTIC_MAP[questionId];
    mapped=questionMap&&Array.isArray(questionMap[choiceIndex])?questionMap[choiceIndex]:[];
  }else mapped=map.DIAGNOSTIC_MAP&&Array.isArray(map.DIAGNOSTIC_MAP[questionId])?map.DIAGNOSTIC_MAP[questionId]:[];
  if(!mapped.map(String).includes(skillId))bad('Stage 3 diagnostic evidence does not support requested skill');
  return{questionId,choiceIndex:mode==='choice'?choiceIndex:null,diagnosticMode:mode};
}
function validate(raw){
  if(!raw||typeof raw!=='object')bad('Invalid Stage 3 calibration payload');
  const calibrationId=String(raw.calibrationId||''),mapVersion=String(raw.mapVersion||''),skillId=String(raw.skillId||''),completedAt=iso(raw.completedAt),now=Date.now(),time=new Date(completedAt).getTime();
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(calibrationId))bad('Invalid calibration id');
  if(mapVersion!==MAP_VERSION)bad('Unsupported Stage 3 diagnostic map version');
  if(!/^[A-Za-z0-9._-]{2,128}$/.test(skillId)||!coreSkillSet().has(skillId))bad('Calibration skill must be a reviewed core skill');
  if(time<now-366*86400000||time>now+10*60000)bad('Calibration timestamp outside accepted window');
  const evidenceRaw=Array.isArray(raw.diagnosticEvidence)?raw.diagnosticEvidence:[];
  if(evidenceRaw.length<2||evidenceRaw.length>12)bad('Calibration requires two to twelve Stage 3 evidence items');
  const diagnosticEvidence=evidenceRaw.map(item=>validateEvidenceItem(item,skillId));
  if(new Set(diagnosticEvidence.map(item=>item.questionId)).size!==diagnosticEvidence.length)bad('Calibration Stage 3 evidence must use distinct questions');
  const answersRaw=Array.isArray(raw.verificationAnswers)?raw.verificationAnswers:[];
  if(answersRaw.length!==2)bad('Calibration requires exactly two verification answers');
  const verificationAnswers=answersRaw.map(item=>({answerId:String(item&&item.answerId||''),questionId:String(item&&item.questionId||'')}));
  for(const item of verificationAnswers)if(!/^[A-Za-z0-9_-]{8,128}$/.test(item.answerId)||!/^[A-Za-z0-9._-]{2,128}$/.test(item.questionId))bad('Invalid verification answer reference');
  if(new Set(verificationAnswers.map(item=>item.answerId)).size!==2||new Set(verificationAnswers.map(item=>item.questionId)).size!==2)bad('Verification answers must be two distinct questions and answer ids');
  return{calibrationId,mapVersion,skillId,diagnosticEvidence,verificationAnswers,completedAt};
}
function derive(event,answerDocs){
  if(!event||!Array.isArray(answerDocs)||answerDocs.length!==2)bad('Verification answer logs pending',409);
  const logs=answerDocs.map((doc,index)=>{
    if(!doc||!doc.data)bad('Verification answer logs pending',409);
    const ref=event.verificationAnswers[index],data=doc.data;
    if(String(data.questionId||'')!==ref.questionId)bad('Verification answer question mismatch');
    if(String(data.skillId||'')!==event.skillId)bad('Verification answer skill mismatch');
    return{answerId:ref.answerId,questionId:ref.questionId,isCorrect:data.isCorrect===true};
  });
  const correctCount=logs.filter(log=>log.isCorrect).length;
  return{correctCount,questionCount:logs.length,supported:correctCount<logs.length,verificationAnswers:logs.map(({answerId,questionId})=>({answerId,questionId})),choiceSpecificCount:event.diagnosticEvidence.filter(item=>item.diagnosticMode==='choice').length};
}
function stored(event,outcome,receivedAt){return{calibrationId:event.calibrationId,mapVersion:event.mapVersion,skillId:event.skillId,diagnosticEvidence:event.diagnosticEvidence,verificationAnswers:outcome.verificationAnswers,correctCount:outcome.correctCount,questionCount:outcome.questionCount,supported:outcome.supported,choiceSpecificCount:outcome.choiceSpecificCount,completedAt:event.completedAt,receivedAt:iso(receivedAt),source:VERSION,verifiedBy:VERIFIED_BY};}

return{VERSION,VERIFIED_BY,MAP_VERSION,validate,derive,stored};
});
