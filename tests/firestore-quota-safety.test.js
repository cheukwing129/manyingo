const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('automatic catalog apply consumes no writes when reviewed content already matches',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/function dirtyTargets\(report\)/);
  assert.match(source,/new Set\(\[\.\.\.report\.create,\.\.\.report\.update\]\)/);
  assert.match(source,/const rows=dirtyTargets\(report\)/);
  assert.match(source,/const writeDrift=hasContentDrift\(before\.reports,false\)/);
  assert.match(source,/if\(!writeDrift&&!pruneDrift\)/);
  assert.match(source,/no write quota consumed/);
  const writeTargets=source.slice(source.indexOf('async function writeTargets'),source.indexOf('async function deleteStale'));
  assert.doesNotMatch(writeTargets,/report\.targets\.length/,'apply must not batch-write every reviewed document');
});

test('prune still removes stale question and KP docs even when there are no creates or updates',()=>{
  const source=read('scripts/import_to_firestore.js');
  assert.match(source,/function hasPrunableStale\(reports\)/);
  assert.match(source,/report\.collectionName!==\'texts\'&&report\.stale\.length/);
  assert.match(source,/pruneDrift=mode===\'prune\'&&hasPrunableStale\(before\.reports\)/);
  assert.match(source,/if\(mode===\'prune\'\)for\(const report of before\.reports\.filter\(report=>report\.collectionName!==\'texts\'\)\)await deleteStale\(report\)/);
});

test('smoke cleanup still attempts Auth deletion when Firestore cleanup is quota-blocked',()=>{
  const source=read('scripts/cleanup_smoke_user.cjs');
  const firestoreTry=source.indexOf("await db.recursiveDelete(db.collection('users').doc(uid))");
  const authTry=source.indexOf('await getAuth().deleteUser(uid)');
  const failureGate=source.indexOf('if (failures.length) throw new Error');
  assert.ok(firestoreTry>=0&&authTry>firestoreTry&&failureGate>authTry,'Auth cleanup must run independently before aggregate failure');
  assert.match(source,/cleanup manifest was retained/);
  assert.match(source,/if \(failures\.length\) throw new Error/);
  assert.ok(source.indexOf('fs.unlinkSync(stateFile)')>failureGate,'manifest must only be removed after both cleanup paths succeed');
});
