(function(){
'use strict';
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function answerKey(v){return String(v||'').replace(/[，。、；：！？\s]/g,'')}
function unique(items){return Array.from(new Set((items||[]).map(clean).filter(Boolean)))}
function installMascotStyle(){
 if(typeof document==='undefined'||document.getElementById('mascotFeedbackStyle'))return false;
 const style=document.createElement('style');style.id='mascotFeedbackStyle';style.textContent='.feedback-ui.correct .feedback-mascot img{animation:moling-correct .3s ease-out}.feedback-ui.wrong .feedback-mascot img{animation:moling-encourage .3s ease-out}.mascot-state-celebrate img{animation:moling-celebrate .5s ease-out}@keyframes moling-correct{from{transform:translateY(3px)}to{transform:translateY(0)}}@keyframes moling-encourage{from{opacity:.6}to{opacity:1}}@keyframes moling-celebrate{0%{transform:translateY(4px)}50%{transform:translateY(-4px)}100%{transform:translateY(0)}}@media(prefers-reduced-motion:reduce){.feedback-mascot img,.session-summary-icon img{animation:none!important}}';document.head.appendChild(style);return true
}
function installFastNextStyle(){return false}
function questionForScope(scope){
 const content=window.ManjingoContent;if(!content||!Array.isArray(content.questions)||!scope||!scope.querySelector)return null;
 const node=scope.querySelector('.question,.lesson-question'),text=clean(node&&node.textContent);if(!text)return null;
 return content.questions.find(q=>clean(q&&q.q)===text)||null;
}
function questionFor(feedback){
 const scope=feedback.closest&&((feedback.closest('#quiz'))||(feedback.closest('.lesson-content'))||(feedback.parentElement));
 return questionForScope(scope);
}
function selectedAnswer(feedback){
 const scope=feedback.closest&&((feedback.closest('#quiz'))||(feedback.closest('.lesson-content'))||(feedback.parentElement));
 if(!scope||!scope.querySelector)return'';
 const wrong=scope.querySelector('.option.wrong');if(wrong)return clean(wrong.textContent);
 const input=scope.querySelector('.input,.fill-input');return input?clean(input.value):'';
}
function sliceLabel(text,label,nextLabels){
 const source=clean(text),start=source.indexOf(label);if(start<0)return'';
 const from=start+label.length;let end=source.length;
 (nextLabels||[]).forEach(next=>{const i=source.indexOf(next,from);if(i>=0&&i<end)end=i});
 return clean(source.slice(from,end));
}
function explanationFromText(text){return sliceLabel(text,'為甚麼？',['你可能混淆了：','判斷提示：','相似例子：','概念掌握度：','下一步：'])}
function parseCorrectAnswer(text){return sliceLabel(text,'正確答案：',['為甚麼？','你可能混淆了：','判斷提示：','相似例子：','概念掌握度：','下一步：'])}
function metricLines(text){
 const raw=clean(text),lines=[];
 const concept=raw.match(/概念(?:掌握度)?[： ]+([0-9]{1,3}%)/);if(concept)lines.push('概念掌握度 '+concept[1]);
 const masterySource=raw.replace(/概念(?:掌握度)?[： ]+[0-9]{1,3}%/g,'');
 const mastery=masterySource.match(/(?:🧠\s*)?掌握度[： ]+([0-9]{1,3}%)/);if(mastery)lines.push('掌握度 '+mastery[1]);
 const xp=raw.match(/(?:本題獲得[： ]*)?\+?([0-9]+)\s*XP/);if(xp)lines.push('本題 +'+xp[1]+' XP');
 const review=raw.match(/建議下次複習[： ]+([^📅⭐]+?)(?=本題|$)/);if(review)lines.push('下次複習 '+clean(review[1]));
 return unique(lines);
}
function supportingLines(feedback,question,raw){
 const lines=[];
 feedback.querySelectorAll&&feedback.querySelectorAll('.mastery').forEach(node=>{const text=clean(node.textContent);if(/^✅|^🔁/.test(text))lines.push(text.replace(/^[✅🔁]\s*/,''))});
 const selected=selectedAnswer(feedback);
 if(question&&question.misconception){lines.push('常見混淆：'+clean(String(question.misconception).replace('{answer}',selected||'這個答案')))}
 else {const mixed=sliceLabel(raw,'你可能混淆了：',['判斷提示：','相似例子：','概念掌握度：','下一步：']);if(mixed)lines.push('常見混淆：'+mixed)}
 if(question&&question.example)lines.push('對照例子：'+clean(question.example));
 else {const example=sliceLabel(raw,'相似例子：',['概念掌握度：','下一步：']);if(example)lines.push('對照例子：'+example)}
 return unique(lines);
}
function explanation(feedback,question,raw,isCorrect){
 if(question&&question.explanation)return clean(question.explanation);
 const parsed=explanationFromText(raw);if(parsed)return parsed;
 if(!isCorrect&&question&&question.misconceptionLabel)return '這題考的是「'+clean(question.misconceptionLabel)+'」，先比較各選項在語境中的功能。';
 if(!isCorrect)return '先對照正確答案，再回到題目的語境與判斷規則。';
 return'';
}
function build(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node}
function mascotRuntime(){return window.ManjingoMascotRuntime||null}
function mascotFeedbackState(isCorrect){return isCorrect?'happy':'encouraging'}
function mascotFeedbackAsset(state){const runtime=mascotRuntime();if(runtime&&typeof runtime.asset==='function')return runtime.asset(state);return state==='happy'?'./mascot/v2/happy.svg':'./mascot/v2/sad.svg'}
function mascotFeedback(isCorrect){
 const state=mascotFeedbackState(isCorrect),wrap=build('div','feedback-mascot mascot-state-'+state),img=document.createElement('img');
 img.src=mascotFeedbackAsset(state);img.alt='';img.width=48;img.height=48;img.setAttribute('aria-hidden','true');wrap.setAttribute('aria-label',isCorrect?'小墨靈：開心':'小墨靈：難過');wrap.appendChild(img);return wrap
}
function enhance(feedback){
 if(!feedback||!feedback.classList||!feedback.classList.contains('feedback'))return false;
 const raw=clean(feedback.textContent);if(!raw)return false;
 if(feedback.dataset.feedbackUi==='1'&&feedback.dataset.feedbackRendered===raw)return false;
 const isCorrect=feedback.classList.contains('correct'),question=questionFor(feedback),answer=question?clean(question.a):parseCorrectAnswer(raw),why=explanation(feedback,question,raw,isCorrect),notes=supportingLines(feedback,question,raw),metrics=metricLines(raw);
 feedback.dataset.feedbackUi='1';feedback.classList.add('feedback-ui');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.innerHTML='';
 installMascotStyle();
 const result=build('div','feedback-result'),icon=build('span','feedback-result-icon',isCorrect?'✓':'×'),copy=build('div','feedback-result-copy'),title=build('strong','feedback-result-title',isCorrect?'答對了':'這題答錯了');
 copy.appendChild(title);copy.appendChild(build('span','feedback-mascot-message',isCorrect?'抓到重點了！':'別灰心，一起看清這一步。'));const xp=metrics.find(line=>line.startsWith('本題 +'));if(xp)copy.appendChild(build('span','feedback-xp',xp.replace('本題 ','')));result.appendChild(mascotFeedback(isCorrect));result.appendChild(copy);result.appendChild(icon);feedback.appendChild(result);
 if(!isCorrect&&answer)feedback.appendChild(build('div','feedback-answer feedback-answer-row','正確答案：'+answer));
 if(why||notes.length){const teaching=isCorrect?build('details','feedback-teaching feedback-teaching-collapsed'):build('div','feedback-teaching');if(isCorrect)teaching.appendChild(build('summary','', '查看解說'));if(why){teaching.appendChild(build('strong','feedback-section-title','為甚麼？'));teaching.appendChild(build('p','feedback-explanation',why))}notes.forEach(line=>teaching.appendChild(build('p','feedback-note',line)));feedback.appendChild(teaching)}
 if(metrics.length){const details=build('details','feedback-progress'),summary=build('summary','', '查看學習進度');details.appendChild(summary);const rows=build('div','feedback-progress-rows');metrics.forEach(line=>rows.appendChild(build('span','',line)));details.appendChild(rows);feedback.appendChild(details)}
 const nextText=isCorrect?'下一步：繼續下一題':raw.includes('優先安排複習')?'下一步：這項技能會優先安排複習':'下一步：系統會提高這項技能的複習優先度';feedback.appendChild(build('div','feedback-next',nextText));
 feedback.dataset.feedbackRendered=clean(feedback.textContent);
 return true;
}
function unlockNextNow(scope){
 if(!scope||!scope.querySelector)return false;const next=scope.querySelector('#next');if(!next)return false;next.disabled=false;return true
}
function unlockNextSoon(scope){
 const run=()=>{if(!scope||!scope.dataset||!scope.dataset.answered)return;unlockNextNow(scope)};
 if(typeof queueMicrotask==='function')queueMicrotask(run);else Promise.resolve().then(run);
}
function instantAnswer(event){
 const target=event&&event.target&&event.target.closest?event.target.closest('.option,#check'):null;if(!target)return false;
 const scope=target.closest&&target.closest('#quiz');if(!scope||scope.dataset.answered)return false;
 const feedback=scope.querySelector('#feedback'),question=questionForScope(scope);if(!feedback||!question)return false;
 const input=scope.querySelector('.input'),value=target.classList&&target.classList.contains('option')?clean(target.textContent):clean(input&&input.value),correct=answerKey(value)===answerKey(question.a);
 if(target.classList&&target.classList.contains('option'))scope.querySelectorAll('.option').forEach(button=>{if(button===target)button.classList.add(correct?'correct':'wrong');if(!correct&&answerKey(button.textContent)===answerKey(question.a))button.classList.add('correct')});
 delete feedback.dataset.feedbackUi;delete feedback.dataset.feedbackRendered;feedback.className='feedback '+(correct?'correct':'wrong');feedback.textContent=correct?'答對了！':'正確答案：'+clean(question.a);
 unlockNextNow(scope);
 return true;
}
function scan(root){if(!root)return;if(root.matches&&root.matches('.feedback'))enhance(root);if(root.querySelectorAll)root.querySelectorAll('.feedback').forEach(enhance)}
function install(){
 installMascotStyle();installFastNextStyle();document.addEventListener('click',instantAnswer,true);
 scan(document);if(typeof MutationObserver!=='function'||!document.body)return;
 const observer=new MutationObserver(records=>records.forEach(record=>{if(record.target&&record.target.classList&&record.target.classList.contains('feedback'))enhance(record.target);record.addedNodes&&record.addedNodes.forEach(scan)}));observer.observe(document.body,{childList:true,subtree:true});window.ManjingoFeedbackUI.observer=observer
}
window.ManjingoFeedbackUI={enhance,scan,install,instantAnswer,unlockNextNow,unlockNextSoon,questionFor,questionForScope,answerKey,explanationFromText,parseCorrectAnswer,metricLines,supportingLines,clean,installMascotStyle,installFastNextStyle,mascotFeedback,mascotFeedbackState,mascotFeedbackAsset,mascotRuntime,observer:null};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install()}
})();
