const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('generated browser bundle stays identical to the reviewed question packs', () => {
  const result = spawnSync(process.execPath, ['scripts/build_question_pack_bundle.cjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('content catalog replaces thirteen parser-blocking pack requests with one bundle', () => {
  const catalog = read('public/content-catalog.js');
  assert.match(catalog, /document\.write\('<script src="\.\/question-packs-core\.js/);
  assert.equal((catalog.match(/document\.write\('/g) || []).filter(Boolean).length >= 1, true);
  for (const file of ['question-pack-02.js', 'question-pack-transfer-07.js', 'question-pack-reorder-01.js']) {
    assert.doesNotMatch(catalog, new RegExp(`document\\.write\\([^\\n]+${file.replaceAll('.', '\\.')}`));
  }
});

test('browser bundle exposes every reviewed pack before the catalog assembles questions', () => {
  const context = { window: {}, Map, Set, Array, Object, Number, String, Math, RegExp };
  vm.createContext(context);
  vm.runInContext(read('public/question-packs-core.js'), context);
  vm.runInContext(read('public/content-catalog.js'), context);
  assert.equal(context.window.ManjingoContent.questions.length, 537);
  assert.ok(context.window.ManjingoContent.questions.some(question => question.id === 'rq007'));
});
