(function(){
'use strict';
if(typeof document!=='undefined'&&document.readyState==='loading'&&!window.ManjingoMascotRuntime){document.write('<script src="./mascot-runtime.js"><\/script>')}
function clean(v){return String(v||'').replace(/\s+/g,' ').trim()}
function answerKey(v){return String(v||'').replace(/[，。、；：！？\s]/g,'')}
function unique(items){return Array.from(new Set((items||[]).map(clean).filter(Boolean)))}
function installMascotStyle(){
 if(typeof document==='undefined'||document.getElementById('mascotFeedbackStyle'))return false;
 const style=document.createElement('style');style.id='mascotFeedbackStyle';style.textContent='.feedback-result{grid-template-columns:36px minmax(0,1fr) auto!important}.feedback-mascot{display:flex;align-items:center;gap:7px;margin-left:4px;max-width:138px}.feedback-mascot img{display:block;width:42px;height:62px;object-fit:contain;flex:0 0 auto;transform-origin:50% 88%}.feedback-mascot span{font-size:10px;line-height:1.3;font-weight:900;color:var(--ui-muted,#8e948b)}.feedback-ui.correct .feedback-mascot img{animation:moling-correct .48s cubic-bezier(.2,.8,.3,1)}.feedback-ui.wrong .feedback-mascot img{animation:moling-encourage .5s ease-out}.session-summary-icon.mascot-celebrate{width:auto;height:auto;border-radius:0;background:transparent;display:flex;flex-direction:column;gap:4px}.session-summary-icon.mascot-celebrate img{width:76px;height:104px;object-fit:contain;animation:moling-celebrate .72s cubic-bezier(.2,.8,.3,1)}.session-summary-icon.mascot-celebrate span{color:var(--ui-green-dark,#398500);font-size:11px;font-weight:900}@keyframes moling-correct{0%{transform:translateY(5px) scale(.94)}55%{transform:translateY(-6px) scale(1.04)}100%{transform:translateY(0) scale(1)}}@keyframes moling-encourage{0%{transform:translateY(4px) scale(.97)}55%{transform:translateY(-2px) scale(1.01)}100%{transform:translateY(0) scale(1)}}@keyframes moling-celebrate{0%{transform:translateY(8px) scale(.92)}45%{transform:translateY(-10px) rotate(-3deg) scale(1.04)}72%{transform:translateY(-3px) rotate(3deg)}100%{transform:translateY(0) rotate(0) scale(1)}}@media(max-width:430px){.feedback-mascot{max-width:92px;gap:4px}.feedback-mascot img{width:34px;height:50px}.feedback-mascot span{font-size:9px}.session-summary-icon.mascot-celebrate img{width:68px;height:94px}}@media(max-width:370px){.feedback-result{grid-template-columns:32px minmax(0,1fr)!important}.feedback-mascot{grid-column:2;justify-self:start;margin:2px 0 0}.feedback-mascot span{max-width:none}}@media(prefers-reduced-motion:reduce){.feedback-mascot img,.session-summary-icon.mascot-celebrate img{animation:none!important}}';document.head.appendChild(style);return true
}
function installFastNextStyle(){
 if(typeof document==='undefined'||document.getElementById('instantNextStyle'))return false;
 const style=document.createElement('style');style.id='instantNextStyle';style.textContent='body.study-focus #quiz[data-answered="1"]{padding-bottom:90px!important}body.study-focus #quiz[data-answered="1"]>#next{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom,14px));transform:translateX(-50%);z-index:70;width:min(calc(100% - 28px),600px);margin:0!important;box-shadow:0 8px 24px rgba(0,4,55,.18)}body.study-focus #quiz[data-answered="1"]>#next:disabled{display:none}@media(min-width:700px){body.study-focus #quiz[data-answered="1"]>#next{bottom:18px}}';document.head.appendChild(style);return true
}
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
function mascotFeedbackAsset(state){const runtime=mascotRuntime();if(runtime&&typeof runtime.asset==='function')return runtime.asset(state);return state==='happy'?'./mascot/moling-happy.svg':'./mascot/moling-encouraging.svg'}
function mascotFeedback(isCorrect){
 const state=mascotFeedbackState(isCorrect),wrap=build('div','feedback-mascot mascot-state-'+state),img=document.createElement('img'),message=build('span','',isCorrect?'抓到重點了！':'一起看清這一步。');
 img.src=mascotFeedbackAsset(state);img.alt='';img.setAttribute('aria-hidden','true');wrap.setAttribute('aria-label',isCorrect?'小墨靈：抓到重點了！':'小墨靈：一起看清這一步。');wrap.appendChild(img);wrap.appendChild(message);return wrap
}
function enhance(feedback){
 if(!feedback||!feedback.classList||!feedback.classList.contains('feedback'))return false;
 const raw=clean(feedback.textContent);if(!raw)return false;
 if(feedback.dataset.feedbackUi==='1'&&feedback.dataset.feedbackRendered===raw)return false;
 const isCorrect=feedback.classList.contains('correct'),question=questionFor(feedback),answer=question?clean(question.a):parseCorrectAnswer(raw),why=explanation(feedback,question,raw,isCorrect),notes=supportingLines(feedback,question,raw),metrics=metricLines(raw);
 feedback.dataset.feedbackUi='1';feedback.classList.add('feedback-ui');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.innerHTML='';
 installMascotStyle();
 const result=build('div','feedback-result'),icon=build('span','feedback-result-icon',isCorrect?'✓':'×'),copy=build('div','feedback-result-copy'),title=build('strong','feedback-result-title',isCorrect?'答對了':'這題答錯了');
 copy.appendChild(title);if(!isCorrect&&answer)copy.appendChild(build('span','feedback-answer','正確答案：'+answer));result.appendChild(icon);result.appendChild(copy);result.appendChild(mascotFeedback(isCorrect));feedback.appendChild(result);
 if(why||notes.length){const teaching=build('div','feedback-teaching');if(why){teaching.appendChild(build('strong','feedback-section-title','為甚麼？'));teaching.appendChild(build('p','feedback-explanation',why))}notes.forEach(line=>teaching.appendChild(build('p','feedback-note',line)));feedback.appendChild(teaching)}
 if(metrics.length){const details=build('details','feedback-progress'),summary=build('summary','', '查看學習進度');details.appendChild(summary);const rows=build('div','feedback-progress-rows');metrics.forEach(line=>rows.appendChild(build('span','',line)));details.appendChild(rows);feedback.appendChild(details)}
 const nextText=isCorrect?'下一步：繼續下一題':raw.includes('優先安排複習')?'下一步：這個知識點會優先安排複習':'下一步：系統會提高這個知識點的複習優先度';feedback.appendChild(build('div','feedback-next',nextText));
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
