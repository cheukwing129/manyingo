(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.ManjingoQuestionPresentation=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 function escape(value){return String(value==null?'':value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
 // Keep the exact question text: feedback, history and summaries can still
 // identify it. Only unambiguous reading/prompt boundaries are separated.
 function parts(value){
  const text=String(value||''),marker='\n\n問題：',boundary=text.indexOf(marker);
  if(text.startsWith('【閱讀材料】')&&boundary>=0)return {reading:text.slice(0,boundary),prompt:text.slice(boundary)};
  const start=text.indexOf('「'),end=text.indexOf('」',start+1);
  if(start<0||start>40||end<0)return {reading:'',prompt:text};
  const prefix=text.slice(0,start),quote=text.slice(start+1,end),tail=text.slice(end+1);
  // Multiple-quote comparisons and quotations embedded in instructions stay
  // intact. A short quoted word alone is not a reading passage.
  if(!/^(?:《[^》]+》)?$/.test(prefix)||quote.length<5||!/[，。；、：]/.test(quote)||!tail||/^(?:與|和|、|及|或)/.test(tail))return {reading:'',prompt:text};
  return {reading:text.slice(0,end+1),prompt:tail};
 }
 function markup(question){
  const text=typeof question==='string'?question:question&&question.q,part=parts(text);
  // Emphasise only the quoted target in the question, never a guessed answer
  // or every occurrence of a polysemous word in the reading passage.
  const prompt=escape(part.prompt).replace(/「([^「」\n]{1,16})」/g,'<strong class="question-target">「$1」</strong>');
  return (part.reading?'<span class="question-reading">'+escape(part.reading)+'</span>':'')+'<span class="question-task">'+prompt+'</span>';
 }
 return {escape,parts,markup};
});
