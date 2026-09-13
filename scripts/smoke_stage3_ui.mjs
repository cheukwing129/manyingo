import vm from 'node:vm';

const baseUrl = String(process.env.MANJINGO_BASE_URL || 'https://manyingo.pages.dev').replace(/\/$/, '');

function check(value, message) {
  if (!value) throw new Error(message);
}

async function readTextAsset(pathname, label) {
  const response = await fetch(`${baseUrl}${pathname}`, { headers: { accept: 'text/javascript,text/html,*/*;q=0.8' } });
  if (!response.ok) throw new Error(`${label} unavailable (${response.status})`);
  const text = await response.text();
  check(text.length > 100, `${label} returned an unexpectedly small payload`);
  return text;
}

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); }
  };
}

console.log(`Smoke testing Stage 3 UI at ${baseUrl}`);

const [homepageSource, homeShellSource, themeSource, curriculumSource, diagnosticsSource, stage3Source, packSource] = await Promise.all([
  readTextAsset('/', 'homepage'),
  readTextAsset('/home-shell.js', 'home shell asset'),
  readTextAsset('/theme-runtime.js', 'theme runtime asset'),
  readTextAsset('/curriculum-v1.js', 'curriculum asset'),
  readTextAsset('/stage3-diagnostics.js', 'Stage 3 diagnostics asset'),
  readTextAsset('/stage3-reading.js', 'Stage 3 reading asset'),
  readTextAsset('/question-pack-transfer-07.js', 'Stage 3 question pack')
]);

check(homepageSource.includes('./home-shell.js'), 'deployed homepage does not load the home shell');
check(homepageSource.includes('./theme-runtime.js'), 'deployed homepage does not load the theme runtime');
check(homeShellSource.includes("script.src='./stage3-reading.js'"), 'deployed home shell does not load the Stage 3 reading runtime');
check(homeShellSource.includes('loadStage3Reading();'), 'deployed home shell does not install the Stage 3 reading runtime');
check(themeSource.includes("script.src='./stage3-diagnostics.js'"), 'deployed homepage runtime does not load Stage 3 diagnostics');

const context = { console, window: {}, Array, Object, Number, String, Math, Set, Map, Date, localStorage: memoryStorage() };
vm.createContext(context);
vm.runInContext(curriculumSource, context, { filename: 'production/curriculum-v1.js' });
vm.runInContext(diagnosticsSource, context, { filename: 'production/stage3-diagnostics.js' });
vm.runInContext(stage3Source, context, { filename: 'production/stage3-reading.js' });
vm.runInContext(packSource, context, { filename: 'production/question-pack-transfer-07.js' });
const diagnostics = context.ManjingoStage3Diagnostics;
const stage3 = context.ManjingoStage3Reading;
const pack = context.window.ManjingoQuestionPackTransfer07;
check(diagnostics && typeof diagnostics.recordAttempt === 'function', 'deployed Stage 3 diagnostics runtime is missing recordAttempt()');
check(typeof diagnostics.recordVerification === 'function', 'deployed Stage 3 diagnostics runtime is missing recordVerification()');
check(typeof diagnostics.diagnosticSelection === 'function', 'deployed Stage 3 diagnostics runtime is missing option selection diagnosis');
check(Object.keys(diagnostics.DIAGNOSTIC_MAP || {}).length === 36, 'deployed Stage 3 diagnostic map does not cover all 36 questions');
check(Object.keys(diagnostics.CHOICE_DIAGNOSTIC_MAP || {}).length === 36, 'deployed Stage 3 choice diagnostic map does not cover all 36 questions');
check(stage3 && typeof stage3.buildChallenge === 'function', 'deployed Stage 3 runtime is missing buildChallenge()');
check(typeof stage3.summarizeResults === 'function', 'deployed Stage 3 runtime is missing summarizeResults()');
check(typeof stage3.isStage3Question === 'function', 'deployed Stage 3 runtime is missing Stage 3 filtering');
check(pack && Array.isArray(pack.questions), 'deployed Stage 3 question pack is missing');
check(pack.questions.length === 36, `deployed Stage 3 pack contains ${pack.questions.length} questions instead of 36`);

const coreSkillIds = new Set(context.ManjingoCurriculumV1.coreSkills().map(skill => skill.id));
for (const [questionId, mappedSkillIds] of Object.entries(diagnostics.DIAGNOSTIC_MAP)) {
  check(mappedSkillIds.length > 0, `${questionId} has no diagnostic skill`);
  check(mappedSkillIds.every(skillId => coreSkillIds.has(skillId)), `${questionId} maps outside the 49 core skills`);
}
for (const [questionId, choiceMap] of Object.entries(diagnostics.CHOICE_DIAGNOSTIC_MAP)) {
  check([1, 2, 3].every(index => Array.isArray(choiceMap[index]) && choiceMap[index].length > 0), `${questionId} does not review all three distractors`);
  check(Object.values(choiceMap).flat().every(skillId => coreSkillIds.has(skillId)), `${questionId} distractor maps outside the 49 core skills`);
}

const contextQuestion = pack.questions.find(question => question.id === 'tr10q012');
check(contextQuestion && contextQuestion.o.length === 4, 'deployed diagnostic probe question is missing');
const actorSelection = diagnostics.diagnosticSelection('tr10q012', contextQuestion.o[1], false);
const lexicalSelection = diagnostics.diagnosticSelection('tr10q012', contextQuestion.o[2], false);
const syntaxSelection = diagnostics.diagnosticSelection('tr10q012', contextQuestion.o[3], false);
check(actorSelection.mode === 'choice' && actorSelection.skillIds[0] === 'read.actor-tracking', 'actor distractor did not resolve to actor tracking');
check(lexicalSelection.mode === 'choice' && lexicalSelection.skillIds[0] === 'lex.context-inference', 'lexical distractor did not resolve to context inference');
check(syntaxSelection.mode === 'choice' && syntaxSelection.skillIds[0] === 'syn.interrogative-patterns', 'syntax distractor did not resolve to interrogative patterns');

diagnostics.clear();
diagnostics.recordAttempt('tr10q012', false, '2026-09-12T09:59:00Z', contextQuestion.o[1]);
const choiceEvent = diagnostics.readState().skills['read.actor-tracking'].events[0];
check(choiceEvent.choiceIndex === 1 && choiceEvent.diagnosticMode === 'choice', 'deployed option-level diagnostic provenance was not persisted');
diagnostics.clear();
diagnostics.recordAttempt('tr10q001', false, '2026-09-12T10:00:00Z');
check(diagnostics.signals().length === 0, 'one Stage 3 miss incorrectly became a core weakness signal');
diagnostics.recordAttempt('tr10q002', false, '2026-09-12T10:01:00Z');
check(diagnostics.signals().some(signal => signal.skillId === 'read.logical-relation'), 'repeated cross-question Stage 3 evidence did not request verification');
const verification = diagnostics.recordVerification('read.logical-relation', { correctCount: 2, total: 2, at: '2026-09-12T10:05:00Z' });
check(verification && verification.passed, 'two-question core verification did not pass');
check(diagnostics.signals().length === 0, 'passed verification did not retire Stage 3 soft evidence');

const skillIds = ['read.argumentation', 'transfer.short-passage', 'transfer.mixed'];
for (const skillId of skillIds) {
  const questions = pack.questions.filter(question => Array.isArray(question.skillIds) && question.skillIds.includes(skillId));
  check(questions.length === 12, `${skillId} contains ${questions.length} questions instead of 12`);
  check(new Set(questions.map(question => question.sourceTextId)).size >= 5, `${skillId} does not span at least five source texts`);
}

let cursors = {};
const seen = new Set();
for (let run = 0; run < 6; run += 1) {
  const built = stage3.buildChallenge(pack.questions, cursors, 2);
  check(built.questions.length === 6, `deployed Stage 3 runtime produced ${built.questions.length} questions instead of 6`);
  const counts = Object.fromEntries(skillIds.map(id => [id, 0]));
  for (const question of built.questions) {
    const skillId = question.skillIds.find(id => skillIds.includes(id));
    counts[skillId] += 1;
    seen.add(question.id);
  }
  check(skillIds.every(id => counts[id] === 2), `deployed Stage 3 runtime is not balanced across advanced skills: ${JSON.stringify(counts)}`);
  cursors = built.nextCursors;
}
check(seen.size === 36, `six deployed Stage 3 rotations covered ${seen.size} questions instead of 36`);

const summary = stage3.summarizeResults([
  { skillId: 'read.argumentation', correct: true },
  { skillId: 'read.argumentation', correct: false },
  { skillId: 'transfer.short-passage', correct: true },
  { skillId: 'transfer.short-passage', correct: true },
  { skillId: 'transfer.mixed', correct: false },
  { skillId: 'transfer.mixed', correct: true }
]);
check(summary.total === 6 && summary.correct === 4 && summary.rows.length === 3, 'deployed Stage 3 result summary is invalid');

console.log('✓ deployed Stage 3 loader, 36-question bank, choice-aware soft diagnostics, verification reset, rotation, and summary are healthy');