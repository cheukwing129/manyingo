import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const stateFile = process.env.MANJINGO_SMOKE_STATE_FILE || path.join(root, '.manjingo-smoke-user.json');
const baseUrl = String(process.env.MANJINGO_BASE_URL || 'https://manjingo.pages.dev').replace(/\/$/, '');
const firebaseSource = fs.readFileSync(path.join(root, 'public', 'firebase-config.js'), 'utf8');
const apiKeyMatch = firebaseSource.match(/apiKey:\s*["']([^"']+)["']/);
if (!apiKeyMatch) throw new Error('Firebase web apiKey not found in public/firebase-config.js');
const apiKey = apiKeyMatch[1];

function check(value, message) {
  if (!value) throw new Error(message);
}
function reportTiming(response, label, required = []) {
  const value = response.headers.get('server-timing') || '';
  check(value, `${label} did not return Server-Timing`);
  for (const name of required) check(new RegExp(`(?:^|,\\s*)${name};dur=\\d+(?:\\.\\d+)?(?:,|$)`).test(value), `${label} timing is missing ${name}: ${value}`);
  console.log(`⏱ ${label}: ${value}`);
  return value;
}
async function readJson(response, label) {
  let data;
  try { data = await response.json(); }
  catch (_) { throw new Error(`${label} returned non-JSON (${response.status})`); }
  return data;
}
async function readTextAsset(pathname, label) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers: { accept: 'text/javascript,*/*;q=0.8' } });
  if (!response.ok) throw new Error(`${label} unavailable (${response.status})`);
  const text = await response.text();
  check(text.length > 100, `${label} returned an unexpectedly small payload`);
  return text;
}
async function api(pathname, token, init = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
}
async function firebaseIdentity(endpoint, body) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await readJson(response, `Firebase ${endpoint}`);
  if (!response.ok) throw new Error(`Firebase ${endpoint} failed (${response.status}): ${data.error?.message || 'unknown error'}`);
  return data;
}
function fromFsValue(value) {
  if (!value) return null;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in value) return fromFields(value.mapValue.fields || {});
  return null;
}
function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields || {}).map(([key, value]) => [key, fromFsValue(value)]));
}
async function firestoreDocument(projectId, documentPath, token) {
  const encoded = documentPath.split('/').map(encodeURIComponent).join('/');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${encoded}`;
  const response = await fetch(url, { headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
  if (response.status === 404) return null;
  const data = await readJson(response, `Firestore ${documentPath}`);
  if (!response.ok) throw new Error(`Firestore ${documentPath} failed (${response.status}): ${data.error?.message || 'unknown error'}`);
  return fromFields(data.fields || {});
}

console.log(`Smoke testing ${baseUrl}`);

const [calibrationSource, rotationSource, difficultySource, observabilitySource, feedbackSource, homepageSource] = await Promise.all([
  readTextAsset('/difficulty-calibration.js', 'difficulty calibration asset'),
  readTextAsset('/question-rotation.js', 'question rotation asset'),
  readTextAsset('/question-difficulty.js', 'question difficulty asset'),
  readTextAsset('/difficulty-observability.js', 'difficulty observability asset'),
  readTextAsset('/feedback-ui.js', 'feedback UI asset'),
  readTextAsset('/', 'homepage')
]);
const calibrationContext = { console };
vm.createContext(calibrationContext);
vm.runInContext(calibrationSource, calibrationContext, { filename: 'production/difficulty-calibration.js' });
const calibration = calibrationContext.ManjingoDifficultyCalibration;
check(calibration && typeof calibration.recordTierOutcome === 'function' && typeof calibration.tierForMastery === 'function', 'deployed calibration API is missing');
let strongApplication = calibration.emptyTierStats();
for (let i = 0; i < 4; i += 1) strongApplication = calibration.recordTierOutcome(strongApplication, 'application', true, '2026-09-11T00:00:00.000Z');
check(calibration.tierForMastery(68, { tierStats: strongApplication }) === 'transfer', 'deployed calibration does not promote sustained application performance');
let weakTransfer = calibration.emptyTierStats();
for (const correct of [false, true, false, false]) weakTransfer = calibration.recordTierOutcome(weakTransfer, 'transfer', correct, '2026-09-11T00:00:00.000Z');
check(calibration.tierForMastery(82, { tierStats: weakTransfer }) === 'application', 'deployed calibration does not protect a struggling transfer learner');
check(rotationSource.includes('difficulty-calibration.js'), 'deployed question rotation does not load calibration');
check(rotationSource.indexOf('difficulty-calibration.js') < rotationSource.indexOf('question-difficulty.js'), 'deployed calibration loads after difficulty selection');
check(difficultySource.includes("ManjingoDifficultyCalibration"), 'deployed question difficulty does not consume calibration');
vm.runInContext(difficultySource, calibrationContext, { filename: 'production/question-difficulty.js' });
vm.runInContext(observabilitySource, calibrationContext, { filename: 'production/difficulty-observability.js' });
const observability = calibrationContext.ManjingoDifficultyObservability;
check(observability && typeof observability.decisionFor === 'function' && typeof observability.persistDecision === 'function' && typeof observability.studentSummary === 'function', 'deployed difficulty observability API is missing');
check(/挑戰跨篇遷移/.test(observability.reasonLabel('application-ready')), 'deployed observability does not explain promotion decisions in learner language');
check(/容易混淆/.test(observability.selectionLabel('misconception-target')), 'deployed observability does not explain misconception targeting in learner language');
const learnerGuidance = observability.studentSummary({ mastery: 68, baseTier: 'application', targetTier: 'transfer', selectedTier: 'transfer', reason: 'application-ready', selectionReason: 'target-tier', profile: { recentAttempts: 4, recentAccuracy: 100, recentCorrectStreak: 4 } });
check(learnerGuidance.tier === '跨篇遷移' && /近期同層 4 題 100%/.test(learnerGuidance.evidence), 'deployed observability does not expose useful learner evidence');
check(observabilitySource.includes('為甚麼系統安排這個難度？') && observabilitySource.includes("dashboard.querySelector&&dashboard.querySelector('.dashboard-hero')"), 'deployed observability is not integrated into learning results');
check(rotationSource.includes('difficulty-observability.js'), 'deployed question rotation does not load observability');
check(rotationSource.indexOf('question-difficulty.js') < rotationSource.indexOf('difficulty-observability.js'), 'deployed observability must wrap difficulty selection after calibration');
console.log('✓ deployed adaptive calibration and learner-facing difficulty guidance');
check(feedbackSource.includes('function instantAnswer(event)'), 'deployed feedback UI is missing instant answer handling');
check(feedbackSource.includes("document.addEventListener('click',instantAnswer,true)"), 'deployed feedback UI does not reveal answers before bubble-phase cloud submission');
check(feedbackSource.includes("feedback.textContent=correct?'答對了！':'正確答案：'"), 'deployed feedback UI does not render the answer immediately');
check(feedbackSource.includes('function unlockNextSoon(scope)'), 'deployed feedback UI is missing nonblocking next-question handling');
check(feedbackSource.includes('next.disabled=false'), 'deployed feedback UI still blocks the next question on cloud persistence');
check(homepageSource.includes('function answerIsCurrent(box,answerId)'), 'deployed today task is missing stale-answer race protection');
check(homepageSource.includes('if(nextButton)nextButton.disabled=false;showLearningFeedback(box,q,correct,null);try{const result=await cloudSubmit'), 'deployed today task still waits for cloud persistence before enabling next');
check(!homepageSource.includes('nextButton.disabled=true'), 'deployed today task re-locks next while cloud persistence is pending');
check(homepageSource.includes('if(answerIsCurrent(box,answerId))showLearningFeedback(box,q,correct,'), 'deployed today task can repaint a later question from a stale cloud response');
console.log('✓ deployed instant answer feedback and nonblocking next question in weakness and today flows');

const healthResponse = await api('/api/health');
const health = await readJson(healthResponse, 'health');
check(healthResponse.ok && health.ok === true, `health failed (${healthResponse.status})`);
check(health.configured === true, 'Pages Worker is deployed but Firebase server credentials are not configured');
check(health.service === 'manjingo-learning', 'unexpected health service');
check(health.practicePolicy === 'server-practice-v1', 'deployed practice policy is not server-authoritative v1');
reportTiming(healthResponse, 'health', ['total']);
console.log(`✓ health: ${health.service} / ${health.firestoreProject}`);

const signup = await firebaseIdentity('accounts:signUp', { returnSecureToken: true });
check(signup.idToken && signup.localId, 'anonymous Firebase sign-up did not return ID token and uid');
const idToken = signup.idToken;
const uid = String(signup.localId);
fs.writeFileSync(stateFile, JSON.stringify({ uid, createdAt: new Date().toISOString() }));

const planResponse = await api('/api/daily-plan', idToken);
const plan = await readJson(planResponse, 'daily plan');
check(planResponse.ok, `daily plan failed (${planResponse.status}): ${plan.error || 'unknown error'}`);
check(Array.isArray(plan.items), 'daily plan did not return items[]');
check(Number.isFinite(Number(plan.totalRecommended)), 'daily plan did not return totalRecommended');
reportTiming(planResponse, 'daily-plan', ['auth','oauth','knowledge_list','concepts_list','interventions_list','kp_list','total']);
console.log(`✓ authenticated Firestore daily plan: ${plan.items.length} item(s)`);

const practiceRoute = plan.items.find(item => item && item.skillId && item.kpId);
check(practiceRoute, 'daily plan did not provide a valid skill + KP practice route');
const practiceId = `smokepractice${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const practicePayload = {
  practiceId,
  skillId: String(practiceRoute.skillId),
  routeKpId: String(practiceRoute.kpId),
  kpId: String(practiceRoute.kpId),
  beforeMastery: 30,
  afterMastery: 32,
  correctCount: 1,
  questionCount: 2,
  strategy: 'targeted',
  completedAt: new Date().toISOString()
};
const practiceResponse = await api('/api/practice-session', idToken, { method: 'POST', body: JSON.stringify(practicePayload) });
const practice = await readJson(practiceResponse, 'practice session');
check(practiceResponse.ok && practice.success === true && practice.duplicate === false, `practice session failed (${practiceResponse.status}): ${practice.error || 'unknown error'}`);
check(practice.practiceSession && practice.practiceSession.practiceId === practiceId, 'practice session did not return the persisted practice identity');
check(practice.interventionState && practice.interventionState.skillId === practicePayload.skillId, 'practice session did not return server intervention state for the selected skill');
reportTiming(practiceResponse, 'practice-session', ['auth','oauth','kp_list','practice_tx_begin','practice_tx_reads','practice_commit','total']);

const practiceStateResponse = await api('/api/practice-state', idToken);
const practiceState = await readJson(practiceStateResponse, 'practice state');
check(practiceStateResponse.ok, `practice state failed (${practiceStateResponse.status}): ${practiceState.error || 'unknown error'}`);
check(Array.isArray(practiceState.practiceIds) && practiceState.practiceIds.includes(practiceId), 'authoritative practice state did not restore the persisted practice event');
check(practiceState.interventionState && practiceState.interventionState[practicePayload.skillId], 'authoritative practice state did not restore the skill intervention document');
reportTiming(practiceStateResponse, 'practice-state', ['auth','oauth','interventions_list','total']);

const duplicatePracticeResponse = await api('/api/practice-session', idToken, { method: 'POST', body: JSON.stringify(practicePayload) });
const duplicatePractice = await readJson(duplicatePracticeResponse, 'duplicate practice session');
check(duplicatePracticeResponse.ok && duplicatePractice.success === true && duplicatePractice.duplicate === true, 'practice retry was not idempotent');
reportTiming(duplicatePracticeResponse, 'practice-duplicate', ['auth','oauth','kp_list','practice_tx_begin','practice_tx_reads','practice_tx_rollback','total']);
console.log(`✓ server-authoritative practice persisted, restored, and deduplicated for ${practicePayload.skillId}`);

const dueResponse = await api('/api/due-knowledge-points', idToken);
const due = await readJson(dueResponse, 'due knowledge points');
check(dueResponse.ok, `due knowledge points failed (${dueResponse.status}): ${due.error || 'unknown error'}`);
check(Array.isArray(due.dueKpIds), 'due knowledge points did not return dueKpIds[]');
reportTiming(dueResponse, 'due-knowledge-points', ['auth','oauth','knowledge_list','total']);
console.log(`✓ authenticated Firestore due lookup: ${due.dueKpIds.length} due`);

const answerId = `smokee2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const conceptKey = 'smoke_e2e_concept';
const localDate = new Date().toISOString().slice(0, 10);
const validPayload = {
  answerId,
  kpId: 'kp_yueyang_001',
  questionId: 'q001',
  textId: 'yueyanglou',
  conceptKey,
  conceptLabel: 'Production smoke concept',
  selectedAnswer: '貶官',
  correctAnswer: '提拔',
  isCorrect: false,
  usedHint: false,
  attemptCount: 1,
  responseTimeMs: 250,
  localDate
};
const submitResponse = await api('/api/submit-answer', idToken, { method: 'POST', body: JSON.stringify(validPayload) });
const submit = await readJson(submitResponse, 'valid answer submit');
check(submitResponse.ok && submit.success === true, `valid answer submit failed (${submitResponse.status}): ${submit.error || 'unknown error'}`);
check(submit.isCorrect === true && submit.verificationVersion === 'server-answer-verification-v1', 'server trusted the false client correctness claim');
check(Number(submit.xpEarned) === 8, `expected 8 XP from first correct answer, got ${submit.xpEarned}`);
check(Number(submit.mastery) > 0, 'valid answer did not increase mastery');
check(Number(submit.totalXp) === 8, `expected total XP 8 for temporary user, got ${submit.totalXp}`);
reportTiming(submitResponse, 'submit-answer', ['auth','oauth','question_read','tx_begin','tx_reads','commit','total']);
console.log(`✓ real reviewed answer committed: +${submit.xpEarned} XP, mastery ${submit.mastery}%`);

const [knowledge, game, concept, answerLog] = await Promise.all([
  firestoreDocument(health.firestoreProject, `users/${uid}/knowledge/${validPayload.kpId}`, idToken),
  firestoreDocument(health.firestoreProject, `users/${uid}/gamification/state`, idToken),
  firestoreDocument(health.firestoreProject, `users/${uid}/concepts/${conceptKey}`, idToken),
  firestoreDocument(health.firestoreProject, `users/${uid}/answerLogs/${answerId}`, idToken)
]);
check(knowledge && Number(knowledge.mastery) === Number(submit.mastery), 'knowledge mastery was not persisted exactly');
check(Number(knowledge.attempts) === 1 && knowledge.lastCorrect === true, 'knowledge attempt state was not persisted');
check(game && Number(game.totalXp) === 8 && Number(game.todayXp) === 8, 'gamification XP was not persisted');
check(concept && Number(concept.attempts) === 1 && Number(concept.mastery) > 0, 'concept mastery was not persisted');
check(answerLog && answerLog.questionId === 'q001' && answerLog.isCorrect === true && answerLog.correctAnswer === '貶官' && answerLog.clientClaimedCorrect === false && answerLog.correctnessMismatch === true && Number(answerLog.xpEarned) === 8, 'answer log did not preserve authoritative correctness and mismatch audit');
console.log('✓ Firestore verified knowledge, XP, concept mastery, and answerLog writes');

const invalidSubmitResponse = await api('/api/submit-answer', idToken, { method: 'POST', body: '{}' });
const invalidSubmit = await readJson(invalidSubmitResponse, 'submit validation');
check(invalidSubmitResponse.status === 400, `submit validation expected HTTP 400, got ${invalidSubmitResponse.status}`);
check(/Invalid answer payload/i.test(String(invalidSubmit.error || '')), 'submit validation did not reject invalid payload');
reportTiming(invalidSubmitResponse, 'submit-validation', ['auth','total']);
console.log('✓ submit route still rejects invalid payload without an additional write');

console.log('Pages learning API write smoke passed; cleanup will run in the workflow finalizer');
