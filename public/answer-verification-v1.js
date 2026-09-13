(function(root,factory){
'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
root.ManjingoAnswerVerificationV1=api;
if(root.window&&root.window!==root)root.window.ManjingoAnswerVerificationV1=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';

const VERSION='server-answer-verification-v1';
function normalize(value){let text=String(value==null?'':value);try{text=text.normalize('NFKC')}catch(_){}return text.replace(/[，。、；：！？,.!?;:\s]/g,'')}
function acceptedAnswers(question){const primary=question&&question.answer!=null?question.answer:question&&question.a;const aliases=Array.isArray(question&&question.acceptedAnswers)?question.acceptedAnswers:[];return Array.from(new Set([primary,...aliases].filter(value=>value!=null&&normalize(value)).map(String)))}
function reorderDefinition(question){
 const fragments=(Array.isArray(question&&question.fragments)?question.fragments:[]).map(item=>item&&typeof item==='object'?{id:String(item.id||''),text:String(item.text||'')}:{id:'',text:''}),ids=fragments.map(item=>item.id),answerOrder=(Array.isArray(question&&question.answerOrder)?question.answerOrder:[]).map(String);
 if(fragments.length<2||fragments.some(item=>!item.id||!item.text)||new Set(ids).size!==ids.length||answerOrder.length!==ids.length||new Set(answerOrder).size!==answerOrder.length||answerOrder.some(id=>!ids.includes(id)))throw Object.assign(new Error('Question has invalid reorder metadata'),{status:500});
 return{fragments,ids,answerOrder};
}
function verify(question,selectedAnswer){
 if(!question||!question.id)throw Object.assign(new Error('Verified question metadata required'),{status:400});
 if(String(question.type||'').toLowerCase()==='reorder'){
  const definition=reorderDefinition(question),selected=String(selectedAnswer==null?'':selectedAnswer),selectedOrder=selected.split('|').map(value=>value.trim()).filter(Boolean);
  if(selectedOrder.length!==definition.ids.length||new Set(selectedOrder).size!==selectedOrder.length||selectedOrder.some(id=>!definition.ids.includes(id)))throw Object.assign(new Error('Reorder answer must use every question fragment exactly once'),{status:400});
  const byId=new Map(definition.fragments.map(item=>[item.id,item.text])),correctAnswer=String(question.modelAnswer||definition.answerOrder.map(id=>byId.get(id)||'').join(''));
  return{version:VERSION,isCorrect:selectedOrder.every((id,index)=>id===definition.answerOrder[index]),correctAnswer,selectedAnswer:selected};
 }
 const accepted=acceptedAnswers(question);if(!accepted.length)throw Object.assign(new Error('Question has no authoritative answer'),{status:500});
 const selected=String(selectedAnswer==null?'':selectedAnswer);if(!normalize(selected))throw Object.assign(new Error('Selected answer required'),{status:400});
 const options=Array.isArray(question.options)?question.options:Array.isArray(question.o)?question.o:[],normalizedSelected=normalize(selected),normalizedOptions=options.map(normalize);
 if(options.length&& !normalizedOptions.includes(normalizedSelected))throw Object.assign(new Error('Selected answer is not a question option'),{status:400});
 return{version:VERSION,isCorrect:accepted.some(answer=>normalize(answer)===normalizedSelected),correctAnswer:accepted[0],selectedAnswer:selected};
}
return{VERSION,normalize,acceptedAnswers,reorderDefinition,verify};
});
