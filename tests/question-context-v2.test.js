'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {loadReviewedCatalog}=require('../scripts/reviewed_catalog');
const catalog=loadReviewedCatalog(),byId=new Map(catalog.questions.map(q=>[q.id,q]));
test('word meaning questions provide visible context and explanations identify the evidence',()=>{
 for(const [id,clue,answer] of [['p2q004','重修岳陽樓','規模'],['p2q008','洞庭一湖','雄偉壯麗的景象'],['p2q016','引喻＝','適宜、恰當'],['p2q018','作姦犯科','善惡功過'],['p2q060','林盡水源','走到盡頭'],['p2q085','執策＝拿着馬鞭','用馬鞭驅策'],['p2q095','寂寥無人','淒清冷清'],['cap1q007','臣本布衣','社會身分低微、見識淺陋'],['cap1q009','臣本布衣','不因我身分低微、見識淺陋而看輕我'],['cap1q016','三顧臣於草廬之中','感動奮發'],['cap1q017','遂許先帝以驅馳','忽略了古今詞義變化']]){
  const q=byId.get(id);assert.ok(q.q.includes(clue),id);assert.ok(q.q.includes('\n\n問題：'),id);assert.equal(q.a,answer,id);assert.equal(q.o.filter(x=>x===answer).length,1,id);assert.ok(q.explanation.length>35,id);
 }
});
test('standalone questions include the sentence or omitted comparison rather than relying on another question',()=>{
 assert.ok(byId.get('cap1q015').q.includes('微斯人，吾誰與歸'));
 assert.ok(byId.get('tr1q009').q.includes('青，取之於藍，而青於藍'));
 assert.ok(byId.get('tr2q004').q.includes('句讀之不知，惑之不解'));
 const risks=byId.get('tr4q017').q;assert.ok(risks.includes('秦城恐不可得'));assert.ok(risks.includes('即患秦兵之來'));
 assert.equal(catalog.questions.length,677);assert.equal(catalog.questions.some(q=>q.type==='fill'),false);
});

test('essential proper-name notes are visible before answering and do not reveal the tested grammar label',()=>{
 const notes={fq005:'弈秋是人名',fq002:'芷陽是地名',fq014:'瀘是水名',cap1q022:'都是人物稱呼',tr2q026:'郯子是人物稱呼',p3q007:'東坡是蘇軾的號',cap1q012:'東坡是蘇軾的號',cap1q010:'劉子驥是人名',ad1q019:'劉子驥是人名',p3q036:'齊國臣子莊暴',p3q034:'長勺是地名',lpq013:'長勺是地名',ad1q027:'長勺是地名',ad1q034:'長勺是地名',tr4q002:'章臺是秦國的宮殿名',tr4q003:'霸上是地名',tr5q013:'霸上是地名',tr4q011:'莊是項莊的簡稱',tr7q029:'項王指項羽',tr9q002:'良是張良的簡稱',tr9q025:'左司馬是官職',tr3q022:'南冥指傳說中的南海',tr1q017:'鯤是傳說中一種大魚的名稱',tr1q018:'是鳥指上文的大鵬鳥',tr2q025:'宋榮子是人物稱呼',tr9q004:'御史是掌管記錄的官員'};
 for(const[id,clue]of Object.entries(notes)){const q=byId.get(id),reading=q.q.split('\n\n問題：')[0];assert.ok(reading.includes(clue),id);assert.equal(reading.includes('賓語前置'),false,id);assert.equal(reading.includes('狀語後置'),false,id);assert.equal(reading.includes('判斷句'),false,id);assert.equal(q.type,'choice',id);assert.equal(q.o.filter(x=>x===q.a).length,1,id);}
 assert.ok(byId.get('fq005').q.includes('使弈秋誨二人弈'));
 assert.ok(byId.get('fq005').q.includes('其一人專心致志'));
});
