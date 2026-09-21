const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const childProcess=require('node:child_process');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Firestore content sync runtime parses before production use',()=>{
  childProcess.execFileSync(process.execPath,['--check',path.join(__dirname,'..','scripts','import_to_firestore.js')]);
});

test('Firestore content sync defaults to read-only review and supports ADC',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/applicationDefault/);
  assert.match(source,/FIREBASE_SERVICE_ACCOUNT_PATH/);
  assert.match(source,/args\.has\('--verify'\) \? 'verify' : 'check'/);
  assert.match(source,/Reviewed catalog:/);
  assert.match(source,/contentMeta/);
  assert.match(source,/catalogVersion/);
  assert.doesNotMatch(source,/questions_v2_template\.csv/);
  assert.doesNotMatch(source,/csv-parser/);
});

test('Firestore importer loads stage 3 and both prescribed-text language packs with metadata',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/question-pack-transfer-07\.js/);
  assert.match(source,/passageId:question\.passageId\|\|null/);
  assert.match(source,/passageText:question\.passageText\|\|null/);
  assert.match(source,/question-pack-settext-language-01\.js/);
  assert.match(source,/question-pack-settext-language-02\.js/);
  assert.match(source,/sourceWorkId:question\.sourceWorkId\|\|null/);
  assert.match(source,/setTextLanguage:question\.setTextLanguage===true\?true:null/);
});

test('Firestore importer resolves Firebase Admin through the Functions package boundary',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/createRequire/);
  assert.match(source,/functionsRequire = createRequire\(path\.join\(root, 'functions', 'package\.json'\)\)/);
  assert.match(source,/functionsRequire\(`firebase-admin\/\$\{moduleName\}`\)/);
  assert.doesNotMatch(source,/node_modules', 'firebase-admin'/);
});

test('prune only removes stale question and knowledge-point documents',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/mode\s*===\s*'prune'/);
  assert.match(source,/report\.collectionName\s*!==\s*'texts'/);
  assert.match(source,/deleteStale/);
  assert.match(source,/Firestore catalog still differs after synchronization/);
});

test('successful main tests trigger only non-destructive automatic catalog upsert',()=>{
  const workflow=read('.github/workflows/firebase-content-sync.yml');
  assert.match(workflow,/workflow_dispatch:/);
  assert.match(workflow,/workflow_run:/);
  assert.match(workflow,/workflows: \['Tests'\]/);
  assert.match(workflow,/workflow_run\.conclusion == 'success'/);
  assert.match(workflow,/workflow_run\.head_branch == 'main'/);
  assert.doesNotMatch(workflow,/\npush:/);
  assert.match(workflow,/group: firebase-content-production-/);
  assert.match(workflow,/cancel-in-progress: \$\{\{ github\.event_name != 'workflow_dispatch' \}\}/);
  const autoStep=workflow.indexOf('Safely upsert reviewed catalog after successful main tests');
  const applyIndex=workflow.indexOf('import_to_firestore.js --apply',autoStep);
  assert.ok(autoStep>=0&&applyIndex>autoStep);
  const autoBlock=workflow.slice(autoStep,workflow.indexOf('- name: Safely upsert reviewed catalog\n',autoStep));
  assert.doesNotMatch(autoBlock,/--prune|--verify/);
});

test('Tests workflow has a manual main recovery trigger for missed push events',()=>{
  const workflow=read('.github/workflows/test.yml');
  assert.match(workflow,/on:\s*\n\s*workflow_dispatch:/);
  assert.match(workflow,/push:\s*\n\s*branches: \[main\]/);
  assert.match(workflow,/pull_request:/);
  assert.match(workflow,/run: npm test/);
});

test('automatic content sync touches Firestore only when reviewed catalog inputs changed',()=>{
  const workflow=read('.github/workflows/firebase-content-sync.yml');
  assert.match(workflow,/Detect reviewed catalog changes/);
  assert.match(workflow,/fetch-depth: 2/);
  assert.match(workflow,/git diff-tree --no-commit-id --name-only -r "\$HEAD_SHA\^" "\$HEAD_SHA"/);
  assert.match(workflow,/data\/texts_template\.csv/);
  assert.match(workflow,/scripts\/reviewed_catalog\.js/);
  assert.match(workflow,/public\/content-catalog\.js/);
  assert.match(workflow,/public\/curriculum-v1\.js/);
  assert.match(workflow,/public\/question-metadata-v1\.js/);
  assert.match(workflow,/public\/question-pack-\*\.js/);
  assert.match(workflow,/No reviewed catalog inputs changed; skipping all Firestore access/);
  assert.match(workflow,/Firestore quota untouched/);
  for(const step of ['Require Firebase ADC credential','Authenticate to Google Cloud','Install Firebase Admin runtime','Preview Firestore catalog drift']){
    const start=workflow.indexOf(`- name: ${step}`);
    assert.ok(start>=0,`missing ${step}`);
    const block=workflow.slice(start,workflow.indexOf('\n      - name:',start+1));
    assert.match(block,/steps\.content_scope\.outputs\.needs_sync == 'true'/,`${step} must be path-gated`);
  }
});

test('manual content operations always bypass the automatic path gate',()=>{
  const workflow=read('.github/workflows/firebase-content-sync.yml');
  const detect=workflow.slice(workflow.indexOf('- name: Detect reviewed catalog changes'),workflow.indexOf('- name: Skip unchanged reviewed catalog'));
  assert.match(detect,/if \[ "\$EVENT_NAME" = "workflow_dispatch" \]/);
  assert.match(detect,/echo "needs_sync=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(detect,/Manual content operation requested; Firestore access enabled/);
});

test('manual prune still requires preview explicit confirmation and final exact verification',()=>{
  const workflow=read('.github/workflows/firebase-content-sync.yml');
  assert.match(workflow,/sync-and-prune/);
  assert.match(workflow,/PRUNE_REVIEWED_CONTENT/);
  assert.match(workflow,/FIREBASE_SERVICE_ACCOUNT_MANJINGO/);
  assert.match(workflow,/google-github-actions\/auth@v3/);
  const testIndex=workflow.indexOf('npm test');
  const checkIndex=workflow.indexOf('import_to_firestore.js --check');
  const pruneIndex=workflow.indexOf('import_to_firestore.js --prune');
  const verifyIndex=workflow.indexOf('import_to_firestore.js --verify');
  assert.ok(testIndex>=0 && checkIndex>testIndex);
  assert.ok(pruneIndex>checkIndex);
  assert.ok(verifyIndex>pruneIndex);
});
