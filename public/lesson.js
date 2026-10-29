// Manjingo lesson flow: explanation → examples → practice → mastery feedback.
import { fetchAllKnowledgePoints, fetchAllQuestions, fetchUserKnowledge, ensureLogin, getCurrentUserId, submitAnswer } from './firebase-config.js';

const state = { kp: null, questions: [], index: 0, startedAt: 0, answered: false };

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function normaliseQuestions(kp, allQuestions = []) {
  const raw = kp.questions || kp.questionIds || [];
  if (!Array.isArray(raw)) return [];
  return raw.map(q => {
    if (typeof q === 'object' && q) return q;
    return allQuestions.find(item => item.id === q) || null;
  }).filter(Boolean);
}

function masteryStatus(value) {
  const n = Number(value || 0);
  if (n >= 90) return '精通';
  if (n >= 70) return '熟悉';
  if (n > 0) return '學習中';
  return '未開始';
}

export async function openLesson(kpId, container, options = {}) {
  if (!container || !kpId) return;
  container.innerHTML = '<div class="lesson-loading">正在載入課堂……</div>';
  try {
    await ensureLogin();
    const [points, allQuestions] = await Promise.all([fetchAllKnowledgePoints(), fetchAllQuestions()]);
    const kp = points.find(x => x.id === kpId);
    if (!kp) throw new Error('找不到知識點');
    const uid = getCurrentUserId();
    const progress = uid ? await fetchUserKnowledge(uid, kpId) : null;
    state.kp = { ...kp, progress: progress || {} };
    state.questions = normaliseQuestions(kp, allQuestions);
    state.index = 0;
    state.startedAt = Date.now();
    state.answered = false;
    renderLesson(container, options);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<div class="lesson-error">課堂載入失敗，請稍後再試。</div>';
  }
}

function renderLesson(container, options) {
  const kp = state.kp;
  const p = kp.progress || {};
  const mastery = Number(p.mastery || 0);
  const prerequisites = Array.isArray(kp.prerequisiteIds) ? kp.prerequisiteIds : [];
  container.innerHTML = `
    <section class="lesson-head">
      <button class="lesson-back" id="lessonBack">← 返回學習地圖</button>
      <div class="lesson-category">${esc(kp.category || kp.unit || '文言文基礎')}</div>
      <h2>${esc(kp.title || kp.name || kp.label || kp.id)}</h2>
      <div class="lesson-status">${masteryStatus(mastery)} · 掌握度 ${mastery}%</div>
      <div class="lesson-progress"><div style="width:${Math.min(100, mastery)}%"></div></div>
      ${prerequisites.length ? `<div class="lesson-prereq">前置知識：${prerequisites.map(esc).join('、')}</div>` : ''}
    </section>
    <section class="lesson-content">
      <div class="lesson-step active" id="lessonIntro">
        <div class="lesson-icon">📖</div>
        <h3>先理解，再練習</h3>
        <p>${esc(kp.explanation || kp.description || kp.content || '這個知識點是文言文閱讀的重要基礎。先掌握核心概念，再透過例句和練習鞏固。')}</p>
        ${renderExamples(kp.examples)}
        <button class="action" id="lessonStart">開始練習</button>
      </div>
      <div id="lessonPractice" style="display:none"></div>
    </section>`;
  container.querySelector('#lessonBack').onclick = () => options.onBack ? options.onBack() : window.history.back();
  container.querySelector('#lessonStart').onclick = () => startPractice(container);
}

function renderExamples(examples) {
  if (!Array.isArray(examples) || !examples.length) return '';
  return `<div class="lesson-examples"><h4>例句</h4>${examples.slice(0,3).map(ex => `<div class="lesson-example"><strong>${esc(ex.sentence || ex.text || '')}</strong>${ex.explanation ? `<p>${esc(ex.explanation)}</p>` : ''}</div>`).join('')}</div>`;
}

function startPractice(container) {
  const area = container.querySelector('#lessonPractice');
  container.querySelector('#lessonIntro').style.display = 'none';
  area.style.display = 'block';
  renderPracticeQuestion(area);
}

function renderPracticeQuestion(area) {
  const kp = state.kp;
  const q = state.questions[state.index];
  state.answered = false;
  state.startedAt = Date.now();
  if (!q) {
    area.innerHTML = `<div class="lesson-complete"><div class="lesson-icon">🎉</div><h3>本課完成！</h3><p>你已完成這個知識點的練習。</p><button class="action" id="lessonFinish">返回學習地圖</button></div>`;
    area.querySelector('#lessonFinish').onclick = () => window.location.href = './knowledge-map.html';
    return;
  }
  const options = Array.isArray(q.options) ? q.options : [];
  area.innerHTML = `<div class="lesson-question-count">練習 ${state.index + 1} / ${state.questions.length}</div><h3 class="lesson-question">${esc(q.question || q.prompt || '請回答問題')}</h3><div id="lessonOptions"></div><div id="lessonFeedback"></div><div class="question-footer"><div class="question-actions"><button class="action" id="lessonNext" type="button" disabled>下一題</button></div></div>`;
  const opts = area.querySelector('#lessonOptions');
  if (q.type === 'fill') {
    opts.innerHTML = `<input class="fill-input" id="lessonInput" placeholder="輸入答案"><button class="action" id="lessonCheck">提交答案</button>`;
    area.querySelector('#lessonCheck').onclick = () => answerQuestion(q, area, area.querySelector('#lessonInput').value);
  } else if (q.type === 'choice') {
    options.forEach(option => {
      const value = typeof option === 'object' ? option.text ?? option.value ?? '' : option;
      const b = document.createElement('button');
      b.className = 'option'; b.textContent = value;
      b.onclick = () => answerQuestion(q, area, value);
      opts.appendChild(b);
    });
  } else {
    opts.innerHTML = `<p class="lesson-note">此題型將在後續版本加入互動支援。</p><button class="action" id="lessonSkip">跳過</button>`;
    area.querySelector('#lessonSkip').onclick = () => { state.index += 1; renderPracticeQuestion(area); };
  }
  area.querySelector('#lessonNext').onclick = () => { state.index += 1; renderPracticeQuestion(area); };
}

async function answerQuestion(q, area, answer) {
  if (state.answered) return;
  state.answered = true;
  const expected = Array.isArray(q.answer) ? q.answer.join('') : String(q.answer ?? '');
  const clean = value => String(value ?? '').replace(/[，。、；：！？\s]/g, '');
  const correct = clean(answer) === clean(expected);
  area.querySelectorAll('button.option').forEach(b => { b.disabled = true; if (b.textContent === String(answer)) b.classList.add(correct ? 'correct' : 'wrong'); });
  try {
    const result = await submitAnswer({ questionId: q.id || null, kpId: state.kp.id, isCorrect: correct, attemptCount: 1, responseTimeMs: Date.now() - state.startedAt, usedHint: false, localDate: new Date().toLocaleDateString('en-CA') });
    const feedback = area.querySelector('#lessonFeedback');
    feedback.className = `feedback ${correct ? 'correct' : 'wrong'}`;
    feedback.textContent = correct ? `答對了！+${result.xpEarned || 0} XP · 掌握度 ${result.mastery}%` : `再想一想。正確答案：${expected}`;
  } catch (error) {
    console.error(error);
    area.querySelector('#lessonFeedback').textContent = correct ? '答對了！' : `正確答案：${expected}`;
  }
  area.querySelector('#lessonNext').disabled = false;
}
