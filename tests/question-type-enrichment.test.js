const test=require('node:test');
const assert=require('node:assert/strict');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog.js');
const verification=require('../public/answer-verification-v1.js');
const reorder=require('../public/reorder-question.js');
const curriculum=require('../public/curriculum-v1.js');

const catalog=()=>loadReviewedCatalog(require('node:path').join(__dirname,'..'));
const normalize=value=>String(value||'').replace(/[\s\u3000，。！？；：、,.!?;:“”"'（）()《》〈〉【】\[\]—…_]/g,'').toLowerCase();
const sourceQuotation=text=>Array.from(String(text||'').matchAll(/「([^」]+)」/g),match=>normalize(match[1])).filter(Boolean).sort((a,b)=>b.length-a.length)[0]||'';

test('reviewed catalog has the intended response-type balance',()=>{
 const questions=catalog().questions,counts={};
 for(const question of questions)counts[question.type]=(counts[question.type]||0)+1;
 assert.equal(questions.length,677);
 assert.deepEqual(counts,{choice:609,fill:24,reorder:44});
});

test('new fill questions accept reviewed aliases and reject unrelated text',()=>{
 const questions=catalog().questions.filter(question=>/^fq\d{3}$/.test(question.id));
 assert.equal(questions.length,22);
 assert.deepEqual(Array.from(new Set(questions.map(q=>q.difficultyTier))).sort(),['application','foundation','transfer']);
 for(const question of questions){
  assert.equal(question.type,'fill');
  assert.ok(question.explanation.length>=20,`${question.id}: explanation`);
  assert.ok(question.sourceSentenceId,`${question.id}: source sentence`);
  assert.ok(question.skillIds.length>=1,`${question.id}: skill`);
  for(const skillId of question.skillIds)assert.ok(curriculum.skill(skillId),`${question.id}: ${skillId}`);
  assert.equal(verification.verify(question,question.a).isCorrect,true,`${question.id}: primary answer`);
  for(const alias of question.acceptedAnswers||[])assert.equal(verification.verify(question,alias).isCorrect,true,`${question.id}: ${alias}`);
  assert.equal(verification.verify(question,'完全無關的答案').isCorrect,false,`${question.id}: wrong answer`);
  const accepted=[question.a,...(question.acceptedAnswers||[])].map(normalize);
  assert.equal(new Set(accepted).size,accepted.length,`${question.id}: duplicate accepted answer`);
 }
});

test('second fill batch adds ten fresh source-diverse productive questions',()=>{
 const questions=catalog().questions.filter(question=>/^fq0(?:1[3-9]|2[0-2])$/.test(question.id));
 assert.equal(questions.length,10);
 assert.equal(new Set(questions.map(q=>q.sourceTextId)).size,10);
 assert.equal(new Set(questions.map(q=>q.sourceSentenceId)).size,10);
 assert.deepEqual(questions.reduce((counts,q)=>(counts[q.difficultyTier]=(counts[q.difficultyTier]||0)+1,counts),{}),{foundation:4,application:4,transfer:2});
});

test('new reorder questions have valid exact-use contracts and broad source coverage',()=>{
 const questions=catalog().questions.filter(question=>/^rq0(09|1[0-6])$/.test(question.id));
 assert.equal(questions.length,8);
 assert.equal(new Set(questions.map(q=>q.sourceTextId)).size,8);
 assert.equal(new Set(questions.map(q=>q.sourceSentenceId)).size,8);
 for(const question of questions){
  assert.equal(reorder.valid(question),true,question.id);
  assert.ok(question.skillIds.includes('trans.reorder'),question.id);
  assert.ok(question.modelAnswer.length>=6,question.id);
  assert.ok(question.explanation.length>=20,question.id);
 }
});

test('new questions introduce neither duplicate stems nor reused quoted prompts',()=>{
 const questions=catalog().questions,newIds=new Set(questions.filter(q=>/^(?:fq|toq|psq|rq0(?:09|1[0-6]))/.test(q.id)).map(q=>q.id));
 const stems=new Map(),sourceQuotations=new Map(),sentenceIds=new Map();
 for(const question of questions){
  const stem=normalize(question.q);if(stem){if(!stems.has(stem))stems.set(stem,[]);stems.get(stem).push(question.id)}
  const quotation=sourceQuotation(question.q);if(quotation){if(!sourceQuotations.has(quotation))sourceQuotations.set(quotation,[]);sourceQuotations.get(quotation).push(question.id)}
  if(question.sourceSentenceId){if(!sentenceIds.has(question.sourceSentenceId))sentenceIds.set(question.sourceSentenceId,[]);sentenceIds.get(question.sourceSentenceId).push(question.id)}
 }
 for(const id of newIds){
  const question=questions.find(q=>q.id===id),stemPeers=stems.get(normalize(question.q))||[];
  assert.deepEqual(stemPeers,[id],`${id}: duplicate stem with ${stemPeers.join(', ')}`);
  const quotation=sourceQuotation(question.q),quotationPeers=sourceQuotations.get(quotation)||[];if(quotation)assert.deepEqual(quotationPeers,[id],`${id}: reused source quotation with ${quotationPeers.join(', ')}`);
  const sentencePeers=sentenceIds.get(question.sourceSentenceId)||[];assert.deepEqual(sentencePeers,[id],`${id}: reused source sentence with ${sentencePeers.join(', ')}`);
 }
});
