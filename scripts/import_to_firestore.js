/**
 * Synchronize the reviewed Manjingo catalog with Firestore.
 *
 * Source of truth:
 *   public/question-pack-02.js
 *   public/question-pack-03.js
 *   public/question-pack-lesson.js
 *   public/question-pack-capacity-01.js
 *   public/question-pack-transfer-01.js
 *   public/question-pack-transfer-03.js
 *   public/question-pack-transfer-04.js
 *   public/question-pack-transfer-05.js
 *   public/question-pack-transfer-06.js
 *   public/question-pack-transfer-07.js
 *   public/question-pack-settext-language-01.js
 *   public/question-pack-settext-language-02.js
 *   public/question-pack-fill-01.js
 *   public/question-pack-reorder-01.js
 *   public/question-pack-translation-order-01.js
 *   public/question-pack-passage-set-01.js
 *   public/content-catalog.js
 *   public/question-pack-adaptive-01.js
 *   public/question-pack-adaptive-02.js
 *   public/question-pack-adaptive-03.js
 *   public/question-difficulty.js
 *
 * Safe modes:
 *   node scripts/import_to_firestore.js --check   # default; report drift only
 *   node scripts/import_to_firestore.js --apply   # upsert reviewed docs, keep stale docs
 *   node scripts/import_to_firestore.js --prune   # upsert reviewed docs, delete stale managed catalog docs
 *   node scripts/import_to_firestore.js --verify  # fail when Firestore differs from reviewed catalog
 *
 * Authentication:
 *   - GitHub Actions / Google Cloud: Application Default Credentials (ADC)
 *   - Optional local fallback: FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json
 *
 * Never commit service-account credentials.
 */

const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const { loadReviewedCatalog } = require('./reviewed_catalog.js');

const root = path.join(__dirname, '..');
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'manjingo-95d9a';
const args = new Set(process.argv.slice(2));
const mode = args.has('--prune') ? 'prune' : args.has('--apply') ? 'apply' : args.has('--verify') ? 'verify' : 'check';
const functionsRequire = createRequire(path.join(root, 'functions', 'package.json'));

function requireFirebaseAdmin(moduleName) {
  try { return require(`firebase-admin/${moduleName}`); }
  catch (firstError) {
    try { return functionsRequire(`firebase-admin/${moduleName}`); }
    catch (fallbackError) { throw new Error(`firebase-admin is unavailable. Run npm install --prefix functions first. (${fallbackError.message || firstError.message})`); }
  }
}

const { initializeApp, cert, applicationDefault } = requireFirebaseAdmin('app');
const { getFirestore, FieldValue } = requireFirebaseAdmin('firestore');

function resolveCredential() {
  const explicit = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (explicit) {
    const absolute = path.resolve(explicit);
    if (!fs.existsSync(absolute)) throw new Error(`Missing Firebase service account: ${absolute}`);
    return cert(JSON.parse(fs.readFileSync(absolute, 'utf8')));
  }
  return applicationDefault();
}

initializeApp({ credential: resolveCredential(), projectId: PROJECT_ID });
const db = getFirestore();

function readSimpleCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.filter(Boolean).map((line, index) => {
    const values = line.split(',');
    if (values.length !== headers.length) throw new Error(`Unsupported quoted/comma CSV at ${path.basename(filePath)} line ${index + 2}`);
    return Object.fromEntries(headers.map((header, i) => [header, values[i]]));
  });
}

function textTargets() {
  return readSimpleCsv(path.join(root, 'data', 'texts_template.csv')).map(row => ({ id:String(row.textId), data:{title:row.title,author:row.author,dynasty:row.dynasty,genre:row.genre,summary:row.summary} }));
}

function catalogTargets(catalog) {
  const version = String(catalog.catalogVersion || 'reviewed');
  const skillIdsByKp = new Map();
  for (const question of catalog.questions) {
    const kpId=String(question&&question.kpId||'');
    if(!kpId)continue;
    const current=skillIdsByKp.get(kpId)||new Set();
    for(const skillId of Array.isArray(question.skillIds)?question.skillIds:[])if(skillId)current.add(String(skillId));
    skillIdsByKp.set(kpId,current);
  }
  const knowledgePoints = catalog.knowledgePoints.map(kp => ({
    id:String(kp.kpId), data:{textId:kp.textId==='CROSS'?null:(kp.textId||null),type:kp.type||null,content:kp.content||kp.kpId,difficulty:Number(kp.difficulty||1),teachable:kp.teachable!==false,skillIds:Array.from(skillIdsByKp.get(String(kp.kpId))||[]),catalogVersion:version}
  }));
  const questions = catalog.questions.map(question => ({
    id:String(question.id), data:{
      type:question.type,kpId:question.kpId,textId:question.textId==='CROSS'?null:(question.textId||null),question:question.q,
      options:Array.isArray(question.o)?Array.from(question.o,String):[],answer:question.a==null?'':String(question.a),acceptedAnswers:Array.isArray(question.acceptedAnswers)?Array.from(question.acceptedAnswers,String):[],explanation:question.explanation||'',
      fragments:Array.isArray(question.fragments)?question.fragments.map(item=>({id:String(item.id),text:String(item.text)})):[],answerOrder:Array.isArray(question.answerOrder)?question.answerOrder.map(String):[],modelAnswer:question.modelAnswer||null,
      reorderMode:question.reorderMode||null,requiredCount:Number.isInteger(question.requiredCount)?question.requiredCount:null,targetText:question.targetText||null,
      misconceptionKey:question.misconceptionKey||null,misconceptionLabel:question.misconceptionLabel||null,difficultyTier:question.difficultyTier||null,
      skillIds:Array.isArray(question.skillIds)?Array.from(question.skillIds,String):[],skillContractVersion:question.skillContractVersion||null,sourceTextId:question.sourceTextId||null,sourceSentenceId:question.sourceSentenceId||null,
      sourceWorkId:question.sourceWorkId||null,setTextLanguage:question.setTextLanguage===true?true:null,
      passageId:question.passageId||null,passageSetId:question.passageSetId||null,passageText:question.passageText||null,
      sourceKind:question.sourceKind||null,transferLevel:Number.isInteger(question.transferLevel)?question.transferLevel:null,baseXp:Number(question.baseXp||question.xp||8),catalogVersion:version
    }
  }));
  const passageSets = (Array.isArray(catalog.passageSets)?catalog.passageSets:[]).map(set=>({
    id:String(set.id),data:{title:set.title||'',source:set.source||'',sourceTextId:set.sourceTextId||null,sourceKind:set.sourceKind||null,difficultyTier:set.difficultyTier||null,passageText:set.passageText||'',questionIds:Array.isArray(set.questionIds)?set.questionIds.map(String):[],catalogVersion:version}
  }));
  return {version,knowledgePoints,questions,passageSets};
}

function normalized(value){if(Array.isArray(value))return value.map(normalized);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalized(value[key])]));return value===undefined?null:value;}
function sameTargetFields(actual,desired){const subset=Object.fromEntries(Object.keys(desired).map(key=>[key,actual&&Object.prototype.hasOwnProperty.call(actual,key)?actual[key]:null]));return JSON.stringify(normalized(subset))===JSON.stringify(normalized(desired));}
async function inspectCollection(collectionName,targets){const desired=new Map(targets.map(item=>[item.id,item.data])),snap=await db.collection(collectionName).get(),existing=new Map(snap.docs.map(doc=>[doc.id,doc.data()])),create=[],update=[],unchanged=[];for(const[id,data]of desired){if(!existing.has(id))create.push(id);else if(!sameTargetFields(existing.get(id),data))update.push(id);else unchanged.push(id);}const stale=Array.from(existing.keys()).filter(id=>!desired.has(id));return{collectionName,targets,create,update,unchanged,stale};}
function summarize(report){const sample=ids=>ids.length?` [${ids.slice(0,12).join(', ')}${ids.length>12?', …':''}]`:'';console.log(`\n${report.collectionName}`);console.log(`  create:    ${report.create.length}${sample(report.create)}`);console.log(`  update:    ${report.update.length}${sample(report.update)}`);console.log(`  unchanged: ${report.unchanged.length}`);console.log(`  stale:     ${report.stale.length}${sample(report.stale)}`);}
function dirtyTargets(report){const dirty=new Set([...report.create,...report.update]);return report.targets.filter(row=>dirty.has(row.id));}
async function writeTargets(report){const rows=dirtyTargets(report);for(let start=0;start<rows.length;start+=400){const batch=db.batch();for(const row of rows.slice(start,start+400))batch.set(db.collection(report.collectionName).doc(row.id),row.data);await batch.commit();}}
async function deleteStale(report){for(let start=0;start<report.stale.length;start+=400){const batch=db.batch();for(const id of report.stale.slice(start,start+400))batch.delete(db.collection(report.collectionName).doc(id));await batch.commit();}}
function hasContentDrift(reports,includeStale=true){return reports.some(report=>report.create.length||report.update.length||(includeStale&&report.stale.length));}
function hasPrunableStale(reports){return reports.some(report=>report.collectionName!=='texts'&&report.stale.length);}
async function inspectAll(){const catalog=loadReviewedCatalog(),targets=catalogTargets(catalog),reports=await Promise.all([inspectCollection('texts',textTargets()),inspectCollection('knowledgePoints',targets.knowledgePoints),inspectCollection('questions',targets.questions),inspectCollection('passageSets',targets.passageSets)]);return{catalog,targets,reports};}

(async()=>{
 try{
  console.log(`Manjingo Firestore catalog sync: ${mode}`);console.log(`Project: ${PROJECT_ID}`);
  const before=await inspectAll();console.log(`Reviewed catalog: ${before.targets.version} · ${before.targets.knowledgePoints.length} KP · ${before.targets.questions.length} questions · ${before.targets.passageSets.length} passage sets`);before.reports.forEach(summarize);
  if(mode==='check'){console.log(hasContentDrift(before.reports)?'\nℹ️ Firestore differs from the reviewed catalog. No changes were made.':'\n✅ Firestore already matches the reviewed catalog.');return;}
  if(mode==='verify'){if(hasContentDrift(before.reports))throw new Error('Firestore catalog verification failed: drift remains');console.log('\n✅ Firestore exactly matches the reviewed catalog.');return;}
  const writeDrift=hasContentDrift(before.reports,false),pruneDrift=mode==='prune'&&hasPrunableStale(before.reports);
  if(!writeDrift&&!pruneDrift){console.log(mode==='prune'?'\n✅ Reviewed catalog already synchronized; nothing to write or prune.':'\n✅ Reviewed catalog already synchronized; no write quota consumed.');return;}
  for(const report of before.reports)await writeTargets(report);
  if(mode==='prune')for(const report of before.reports.filter(report=>report.collectionName!=='texts'))await deleteStale(report);
  await db.collection('contentMeta').doc('catalog').set({catalogVersion:before.targets.version,questionCount:before.targets.questions.length,knowledgePointCount:before.targets.knowledgePoints.length,passageSetCount:before.targets.passageSets.length,syncMode:mode,syncedAt:FieldValue.serverTimestamp()},{merge:true});
  const after=await inspectAll();after.reports.forEach(summarize);const remainingWriteDrift=hasContentDrift(after.reports,mode==='prune');if(remainingWriteDrift)throw new Error('Firestore catalog still differs after synchronization');
  console.log(mode==='prune'?'\n✅ Reviewed catalog synchronized and stale managed catalog documents pruned.':'\n✅ Reviewed catalog synchronized; stale documents intentionally preserved.');
 }catch(error){console.error(`\n❌ ${error.message||error}`);process.exitCode=1;}
})();
