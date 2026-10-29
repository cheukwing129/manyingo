'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog');
const contracts=require('./fixtures/context-question-contract.json');
const questions=loadReviewedCatalog().questions;
const byId=id=>questions.find(q=>q.id===id);
test('context repairs retain answer, curriculum and evidence identity for existing learners',()=>{
 for(const original of contracts){
  const q=byId(original.id);
  for(const [key,value] of Object.entries(original))assert.deepEqual(JSON.parse(JSON.stringify(q[key])),value,original.id+': '+key);
 }
});
test('previously missing antecedents are visible before the question is answered',()=>{
 const evidence={cap1q026:'重修岳陽樓',cap1q018:'三顧臣於草廬',p2q031:'舍生而取義',lpq006:'齊師伐我',lpq043:'當地村人',tr1q010:'木直中繩',tr2q024:'相如度',tr5q015:'當地村人',tr8q003:'和氏璧',tr9q003:'鄭伯請燭之武',stl2q009:'臣卑鄙',stl2q016:'臣本布衣',ad1q029:'咸來問訊',tr5q016:'相如引車避匿',stl2q024:'獨畏廉將軍哉'};
 for(const [id,clue] of Object.entries(evidence)){
  const q=byId(id),parts=q.q.split('\n\n問題：');
  assert.equal(parts.length,2,id);
  assert.ok(parts[0].includes(clue),id+' must present its evidence before asking');
  assert.equal(q.o.filter(o=>o===q.a).length,1,id);
 }
 assert.doesNotMatch(byId('p2q043').q,/魯莊公所說/);
});
