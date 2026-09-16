(function(){
'use strict';

if(typeof document!=='undefined'&&document.readyState==='loading'){
 // question-packs-core.js is generated from question-pack-02.js, question-pack-03.js,
 // question-pack-lesson.js, question-pack-capacity-01.js, question-pack-transfer-01.js,
 // question-pack-transfer-03.js, question-pack-transfer-04.js, question-pack-transfer-05.js,
 // question-pack-transfer-06.js, question-pack-transfer-07.js,
 // question-pack-settext-language-01.js, question-pack-settext-language-02.js,
 // and question-pack-reorder-01.js.
 if(!window.ManjingoQuestionPack02)document.write('<script src="./question-packs-core.js"><\/script>');
}

const baseKnowledgePoints=[
 {kpId:'kp_yueyang_001',textId:'yueyanglou',type:'實詞',content:'謫',difficulty:1,teachable:true},
 {kpId:'kp_yueyang_004',textId:'yueyanglou',type:'名句默寫',content:'先天下之憂而憂，後天下之樂而樂',difficulty:2,teachable:true},
 {kpId:'kp_virtual_zhi',textId:'CROSS',type:'虛詞用法',content:'之',difficulty:2,teachable:true},
 {kpId:'kp_virtual_er',textId:'CROSS',type:'虛詞用法',content:'而',difficulty:2,teachable:true},
 {kpId:'kp_virtual_yi',textId:'CROSS',type:'虛詞用法',content:'以',difficulty:2,teachable:true},
 {kpId:'kp_virtual_yu',textId:'CROSS',type:'虛詞用法',content:'於',difficulty:2,teachable:true},
 {kpId:'kp_virtual_qi',textId:'CROSS',type:'虛詞用法',content:'其',difficulty:2,teachable:true},
 {kpId:'kp_virtual_ze',textId:'CROSS',type:'虛詞用法',content:'則',difficulty:2,teachable:true},
 {kpId:'gj_004',textId:'chushibiao',type:'古今異義',content:'卑鄙',difficulty:2,teachable:true},
 {kpId:'gj_005',textId:'chushibiao',type:'古今異義',content:'感激',difficulty:2,teachable:true},
 {kpId:'cy_004',textId:'yueyanglou',type:'詞類活用',content:'先／後',difficulty:3,teachable:true},
 {kpId:'cy_006',textId:'CROSS',type:'詞類活用',content:'師',difficulty:3,teachable:true},
 {kpId:'sx_001',textId:'CROSS',type:'句式',content:'判斷句',difficulty:2,teachable:true},
 {kpId:'sx_003',textId:'CROSS',type:'句式',content:'見字表被動',difficulty:3,teachable:true},
 {kpId:'sx_004',textId:'CROSS',type:'句式',content:'於字表被動',difficulty:3,teachable:true},
 {kpId:'sx_005',textId:'CROSS',type:'句式',content:'省略句',difficulty:2,teachable:true},
 {kpId:'sx_006',textId:'CROSS',type:'句式',content:'倒裝句－賓語前置',difficulty:3,teachable:true},
 {kpId:'sx_008',textId:'CROSS',type:'句式',content:'倒裝句－狀語後置',difficulty:3,teachable:true},
 {kpId:'kp_translation_001',textId:'yueyanglou',type:'翻譯',content:'微斯人，吾誰與歸',difficulty:3,teachable:true},
 {kpId:'kp_theme_001',textId:'yueyanglou',type:'主旨',content:'不以物喜，不以己悲',difficulty:3,teachable:true},
 {kpId:'kp_argument_001',textId:'CROSS',type:'論證方法',content:'舉例論證',difficulty:2,teachable:true},
 {kpId:'kp_argument_002',textId:'CROSS',type:'論證方法',content:'對比論證',difficulty:2,teachable:true},
 {kpId:'kp_argument_003',textId:'CROSS',type:'論證方法',content:'比喻論證',difficulty:2,teachable:true}
];

const baseQuestions=[
 {id:'q001',kpId:'kp_yueyang_001',textId:'yueyanglou',type:'choice',q:'「謫守巴陵郡」中「謫」字的意思是？',o:['提拔','貶官','辭職','退休'],a:'貶官',explanation:'「謫」指官員因過失受到貶降或外放；「謫守巴陵郡」即被貶後出任巴陵郡太守。'},
 {id:'q004',kpId:'kp_virtual_zhi',textId:'CROSS',type:'choice',q:'「輟耕之壟上」中「之」字的用法是？',o:['代詞','結構助詞（的）','動詞（到／往）','語氣助詞'],a:'動詞（到／往）',explanation:'「之」後接地點「壟上」，整句表示到田壟上去，所以「之」作動詞，意思是「往／到」。'},
 {id:'q005',kpId:'sx_001',textId:'CROSS',type:'choice',q:'「廉頗者，趙之良將也」屬於哪種句式？',o:['判斷句','被動句','省略句','倒裝句'],a:'判斷句',explanation:'「者……也」在此判定廉頗的身分是趙國良將，屬於典型判斷句。'},
 {id:'q010',kpId:'kp_translation_001',textId:'yueyanglou',type:'choice',q:'「微斯人，吾誰與歸」的正確白話翻譯是？',o:['如果沒有這樣的人，我要跟從誰呢？','如果沒有這樣的人，誰會跟從我呢？','沒有這樣的人，我不知道去哪裡。','這個人不存在，我們一起回去。'],a:'如果沒有這樣的人，我要跟從誰呢？',explanation:'「微」是「如果沒有」；「吾誰與歸」是賓語前置，還原為「吾與誰歸」，即「我跟從／歸依誰呢」。'},
 {id:'q008',kpId:'kp_yueyang_004',textId:'yueyanglou',type:'fill',q:'先天下之憂而憂，____________。',a:'後天下之樂而樂',explanation:'《岳陽樓記》原句是「先天下之憂而憂，後天下之樂而樂」。'},
 {id:'q006',kpId:'kp_translation_001',textId:'yueyanglou',type:'choice',q:'「吾誰與歸」中「歸」最接近哪個意思？',o:['歸還','歸依／一道','回家','歸來'],a:'歸依／一道',explanation:'這裡「歸」不是回家的「歸」，而是「歸依、一道」的意思；整句問「我同誰一道呢」。'}
];

const pack02=window.ManjingoQuestionPack02||{knowledgePoints:[],questions:[]};
const pack03=window.ManjingoQuestionPack03||{knowledgePoints:[],questions:[]};
const lessonPack=window.ManjingoQuestionPackLesson||{questions:[]};
const capacityPack01=window.ManjingoQuestionPackCapacity01||{questions:[]};
const transferPack01=window.ManjingoQuestionPackTransfer01||{questions:[]};
const transferPack03=window.ManjingoQuestionPackTransfer03||{knowledgePoints:[],questions:[]};
const transferPack04=window.ManjingoQuestionPackTransfer04||{knowledgePoints:[],questions:[]};
const transferPack05=window.ManjingoQuestionPackTransfer05||{knowledgePoints:[],questions:[]};
const transferPack06=window.ManjingoQuestionPackTransfer06||{knowledgePoints:[],questions:[]};
const transferPack07=window.ManjingoQuestionPackTransfer07||{knowledgePoints:[],questions:[]};
const setTextLanguagePack01=window.ManjingoQuestionPackSetTextLanguage01||{questions:[]};
const setTextLanguagePack02=window.ManjingoQuestionPackSetTextLanguage02||{questions:[]};
const reorderPack01=window.ManjingoQuestionPackReorder01||{questions:[]};

const KP_REVISIONS={
 kp_p3_zhi:{content:'之：跨語境辨析',difficulty:3},kp_p3_er:{content:'而：跨語境辨析',difficulty:3},kp_p3_yi:{content:'以：跨語境辨析',difficulty:3},kp_p3_yu:{content:'於：跨語境辨析',difficulty:3},kp_p3_qi:{content:'其：跨語境辨析',difficulty:3},kp_p3_judgment:{content:'判斷句：跨句辨析',difficulty:3},kp_p3_passive:{content:'被動句：跨形式辨析',difficulty:3},kp_p3_fronting:{content:'賓語前置：跨句辨析',difficulty:3},kp_p3_adverbial:{content:'狀語後置：跨句辨析',difficulty:3},kp_p3_ellipsis:{content:'省略句：語境補足',difficulty:3},kp_p3_translation:{content:'文言翻譯：綜合策略',difficulty:3},kp_p3_argument:{content:'論證方法：綜合辨析',difficulty:3}
};
const QUESTION_REVISIONS={
 p2q044:{q:'曹劌先後否定「衣食所安」和祭祀之福，正確理由是哪一項？',o:['前者是小惠未遍，百姓不會跟從；後者是小信未孚，神不會賜福','兩者都因魯國物資不足','前者違反禮制，後者得罪百姓','兩者都因軍隊不願作戰'],a:'前者是小惠未遍，百姓不會跟從；後者是小信未孚，神不會賜福',explanation:'魯莊公先提出小惠與祭祀作為作戰憑藉，曹劌分別以「小惠未遍，民弗從也」和「小信未孚，神弗福也」否定；直到「小大之獄……必以情」才認為可以一戰。'},
 p3q018:{q:'「其真無馬邪？」中的「其」主要表示？',o:['反問語氣（難道）','推測語氣（大概／恐怕）','代詞（他的）','連詞（如果）'],a:'反問語氣（難道）',explanation:'第一個「其」配合「邪」形成反問，可理解為「難道真的沒有千里馬嗎？」。 '},
 p3q019:{q:'「其真不知馬也」中的「其」主要表示？',o:['推測語氣（大概／恐怕）','反問語氣（難道）','代詞（他的）','指示代詞（這）'],a:'推測語氣（大概／恐怕）',explanation:'前一句用「其」反問「難道真的沒有千里馬嗎」，後一句轉為推測判斷：大概是真的不懂得識別千里馬。'},
 tr5q010:{skillIds:['trans.function-word','syn.judgment']},
 tr5q017:{skillIds:['trans.supplement','syn.ellipsis-subject']},
 tr5q019:{skillIds:['trans.ancient-modern','lex.ancient-modern']},tr5q020:{skillIds:['trans.ancient-modern','lex.ancient-modern']},tr5q021:{skillIds:['trans.ancient-modern','lex.ancient-modern']},tr5q022:{skillIds:['trans.ancient-modern','lex.ancient-modern']},tr5q023:{skillIds:['trans.ancient-modern','lex.ancient-modern']},tr5q024:{skillIds:['trans.ancient-modern','lex.ancient-modern']}
};

const knowledgePoints=[...baseKnowledgePoints,...pack02.knowledgePoints,...pack03.knowledgePoints,...transferPack03.knowledgePoints,...transferPack04.knowledgePoints,...transferPack05.knowledgePoints,...transferPack06.knowledgePoints,...transferPack07.knowledgePoints].map(kp=>KP_REVISIONS[kp.kpId]?{...kp,...KP_REVISIONS[kp.kpId]}:{...kp});
const rawQuestions=[...baseQuestions,...pack02.questions,...pack03.questions,...lessonPack.questions,...capacityPack01.questions,...transferPack01.questions,...transferPack03.questions,...transferPack04.questions,...transferPack05.questions,...transferPack06.questions,...transferPack07.questions,...setTextLanguagePack01.questions,...setTextLanguagePack02.questions,...reorderPack01.questions].map(q=>QUESTION_REVISIONS[q.id]?{...q,...QUESTION_REVISIONS[q.id]}:{...q});

function misconceptionConcept(q){
 const kp=String(q&&q.kpId||''),answer=String(q&&q.a||''),text=String(q&&q.q||'');
 if(/(?:kp_virtual|kp_p3)_yi$/.test(kp)){if(/因為/.test(answer)||/表示原因/.test(text))return{key:'yi_reason_vs_tool',label:'「以」：原因義 vs 工具義'};if(/把|將/.test(answer)||/以.*為/.test(text))return{key:'yi_disposal_pattern',label:'「以 A 為 B」：處置義'};if(/來|用來/.test(answer)||/目的/.test(text))return{key:'yi_purpose_vs_reason',label:'「以」：目的義 vs 原因義'};return{key:'yi_function_choice',label:'「以」：依語境辨別功能'};}
 if(/(?:kp_virtual|kp_p3)_zhi$/.test(kp)){if(/動詞|往|到/.test(answer))return{key:'zhi_verb_vs_particle',label:'「之」：動詞「往／到」vs 助詞'};if(/結構助詞|的/.test(answer))return{key:'zhi_attributive_vs_pronoun',label:'「之」：結構助詞 vs 代詞'};if(/代詞|這件事/.test(answer))return{key:'zhi_pronoun_vs_particle',label:'「之」：代詞 vs 助詞'};}
 if(/(?:kp_virtual|kp_p3)_er$/.test(kp))return{key:'er_semantic_relation',label:'「而」：前後分句語意關係'};
 if(/(?:kp_virtual|kp_p3)_yu$/.test(kp)){if(/比/.test(answer))return{key:'yu_compare_vs_source',label:'「於」：比較義 vs 來源義'};if(/從/.test(answer))return{key:'yu_source_vs_compare',label:'「於」：來源義 vs 比較義'};return{key:'yu_context_role',label:'「於」：依語境辨別介詞功能'};}
 if(/(?:kp_virtual|kp_p3)_qi$/.test(kp))return{key:'qi_pronoun_vs_modal',label:'「其」：代詞 vs 語氣'};
 if(/(?:sx_001|kp_p3_judgment)$/.test(kp))return{key:'sentence_judgment_identity',label:'判斷句：身分／性質判定'};
 if(/(?:sx_003|sx_004|kp_p3_passive)$/.test(kp))return{key:'sentence_passive_receiver',label:'被動句：主語是動作承受者'};
 if(/(?:sx_006|kp_p3_fronting)$/.test(kp))return{key:'sentence_object_fronting',label:'賓語前置：還原正常語序'};
 if(/(?:sx_008|kp_p3_adverbial)$/.test(kp))return{key:'sentence_adverbial_postpose',label:'狀語後置：介詞結構還原'};
 return null;
}
const questions=rawQuestions.map(q=>{const concept=misconceptionConcept(q);return concept?{...q,misconceptionKey:concept.key,misconceptionLabel:concept.label}:{...q};});
function getKnowledgePointIds(options){const teachableOnly=!options||options.teachableOnly!==false;return knowledgePoints.filter(kp=>!teachableOnly||kp.teachable).map(kp=>kp.kpId);}
function selectQuestionsForPlan(plan,sourceQuestions,limit){
 const source=Array.isArray(sourceQuestions)?sourceQuestions:[],items=Array.isArray(plan&&plan.items)?plan.items:[],max=Math.max(0,Number(limit)||Number(plan&&plan.targetCount)||10),byKp=new Map(),rotation=window.ManjingoQuestionRotation,metadata=window.ManjingoQuestionMetadataV1,diversity=window.ManjingoQuestionDiversityV1;
 source.forEach(raw=>{if(!raw||!raw.id||!raw.kpId)return;const q=metadata&&typeof metadata.annotate==='function'?metadata.annotate(raw):raw;if(!byKp.has(q.kpId))byKp.set(q.kpId,[]);byKp.get(q.kpId).push(q)});
 const used=new Set(),queue=[],avoidSentenceIds=rotation&&typeof rotation.recentSentenceIds==='function'?rotation.recentSentenceIds():[];
 items.forEach(item=>{if(queue.length>=max)return;let available=(byKp.get(item.kpId)||[]).filter(q=>!used.has(q.id));const production=item.skillId==='trans.reorder'?available.filter(q=>q.type==='reorder'&&Array.isArray(q.skillIds)&&q.skillIds.includes('trans.reorder')):[];if(production.length)available=production;if(!available.length)return;const conceptPreferred=Array.isArray(item.conceptQuestionIds)?item.conceptQuestionIds.map(String):[],misconceptionPreferred=Array.isArray(item.misconceptionQuestionIds)?item.misconceptionQuestionIds.map(String):[],preferred=Array.from(new Set([...conceptPreferred,...misconceptionPreferred])),preferredSet=new Set(preferred),preferredPool=preferred.length?available.filter(q=>preferredSet.has(String(q.id))):[],pool=preferredPool.length?preferredPool:available;let ranked=rotation&&typeof rotation.rank==='function'?rotation.rank(pool):pool.slice(),candidate=diversity&&typeof diversity.choose==='function'?diversity.choose(ranked,queue,{avoidSentenceIds}):ranked[0]||null;if(!candidate&&preferredPool.length){ranked=rotation&&typeof rotation.rank==='function'?rotation.rank(available):available.slice();candidate=diversity&&typeof diversity.choose==='function'?diversity.choose(ranked,queue,{avoidSentenceIds}):ranked[0]||null;}if(!candidate)candidate=available[Math.floor(Math.random()*available.length)];used.add(candidate.id);queue.push({...candidate,skillId:item.skillId||candidate.skillId||null,category:item.category||'new',priority:item.priority??3,conceptReview:conceptPreferred.includes(String(candidate.id)),conceptKey:item.conceptKey||candidate.misconceptionKey||null,conceptLabel:item.conceptLabel||candidate.misconceptionLabel||null,conceptMastery:item.conceptMastery??null,misconceptionReview:misconceptionPreferred.includes(String(candidate.id))});});
 return queue;
}
window.ManjingoContent={catalogVersion:'reviewed-v1',knowledgePoints:knowledgePoints.map(x=>({...x})),questions:questions.map(x=>({...x})),getKnowledgePointIds,selectQuestionsForPlan,misconceptionConcept};
if(typeof document!=='undefined'&&document.readyState==='loading'){
 if(window.ManjingoUseAppRuntimeBundle)document.write('<script src="./app-runtime.js"><\/script>');
 else document.write('<script src="./reorder-question.js"><\/script><script src="./curriculum-v1.js"><\/script><script src="./question-metadata-v1.js"><\/script><script src="./question-diversity-v1.js"><\/script><script src="./question-rotation.js"><\/script><script src="./learning-path.js"><\/script><script src="./practice-effectiveness.js"><\/script><script src="./learning-path-ui.js"><\/script><script src="./weakness-panel.js"><\/script><script src="./mastery-dashboard.js"><\/script><script src="./feedback-ui.js"><\/script><script src="./session-summary.js"><\/script><script src="./account-sync.js"><\/script><script src="./account-ui.js"><\/script>');
}
})();
