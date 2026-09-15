import './learning-policy.js';
import './curriculum-v1.js';
import './question-skill-contract.js';
import './skill-evidence-v1.js';
import './answer-verification-v1.js';
import './server-skill-plan.js';
import './practice-effectiveness.js';
import './server-practice-state.js';
import './stage3-diagnostics.js';
import './stage3-calibration-server.js';
import './plan-state-v1.js';

const POLICY=globalThis.ManjingoLearningPolicy;
const CURRICULUM=globalThis.ManjingoCurriculumV1;
const QUESTION_SKILL_CONTRACT=globalThis.ManjingoQuestionSkillContract;
const SKILL_EVIDENCE=globalThis.ManjingoSkillEvidenceV1;
const ANSWER_VERIFICATION=globalThis.ManjingoAnswerVerificationV1;
const SERVER_SKILL_PLAN=globalThis.ManjingoServerSkillPlan;
const SERVER_PRACTICE=globalThis.ManjingoServerPracticeState;
const STAGE3_CALIBRATION=globalThis.ManjingoStage3CalibrationServer;
const PLAN_STATE=globalThis.ManjingoPlanStateV1;
const PROJECT_FALLBACK = 'manjingo-95d9a';
const TOKEN_SCOPE = 'https://www.googleapis.com/auth/datastore';
const FIRESTORE_ROOT = 'https://firestore.googleapis.com/v1';
const FIREBASE_JWKS = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const STATIC_CACHE_TTL_MS = 5 * 60 * 1000;
const QUESTION_CACHE_TTL_MS = 10 * 60 * 1000;
const QUESTION_CACHE_MAX = 400;
let serviceTokenCache = null;
let firebaseJwksCache = null;
let kpUniverseCache = null;
const questionMetadataCache = new Map();

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function traceNow(){return Date.now();}
function createTrace(){return{startedAt:traceNow(),marks:[]};}
async function timed(trace,name,work){const started=traceNow();try{return await work();}finally{if(trace)trace.marks.push([name,Math.max(0,traceNow()-started)]);}}
function withServerTiming(response,trace){
  if(!trace)return response;
  const headers=new Headers(response.headers),marks=[...trace.marks,['total',Math.max(0,traceNow()-trace.startedAt)]];
  headers.set('server-timing',marks.map(([name,duration])=>`${name};dur=${Number(duration).toFixed(1)}`).join(', '));
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function base64Url(bytes) {
  let binary = '';
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function decodeBase64Url(value) {
  const padded = String(value).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(value).length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function decodeJwtPart(value) { return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))); }
function pemToArrayBuffer(pem) {
  const base64 = String(pem).replace(/\\n/g, '\n').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0)).buffer;
}
function projectId(env) { return String(env.FIREBASE_PROJECT_ID || PROJECT_FALLBACK); }
function requireServerCredentials(env) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new Error('Cloud learning API is not configured');
}

async function getServiceAccessToken(env) {
  requireServerCredentials(env);
  const now = Math.floor(Date.now() / 1000);
  if (serviceTokenCache && serviceTokenCache.expiresAt > now + 60) return serviceTokenCache.token;
  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = base64Url(new TextEncoder().encode(JSON.stringify({
    iss: String(env.FIREBASE_CLIENT_EMAIL),
    scope: TOKEN_SCOPE,
    aud: GOOGLE_TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600
  })));
  const signingInput = `${header}.${claims}`;
  const key = await crypto.subtle.importKey('pkcs8', pemToArrayBuffer(env.FIREBASE_PRIVATE_KEY), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const assertion = `${signingInput}.${base64Url(signature)}`;
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion })
  });
  if (!response.ok) throw new Error(`Google OAuth failed (${response.status})`);
  const data = await response.json();
  serviceTokenCache = { token: data.access_token, expiresAt: now + Number(data.expires_in || 3600) };
  return serviceTokenCache.token;
}

async function getFirebaseJwks() {
  const now = Date.now();
  if (firebaseJwksCache && firebaseJwksCache.expiresAt > now) return firebaseJwksCache.keys;
  const response = await fetch(FIREBASE_JWKS, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`Firebase public keys unavailable (${response.status})`);
  const data = await response.json();
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  firebaseJwksCache = { keys: Array.isArray(data.keys) ? data.keys : [], expiresAt: now + (Number(match && match[1]) || 3600) * 1000 };
  return firebaseJwksCache.keys;
}
async function verifyFirebaseIdToken(request, env) {
  const auth = request.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) throw Object.assign(new Error('Missing Firebase ID token'), { status: 401 });
  const token = auth.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 3) throw Object.assign(new Error('Invalid Firebase ID token'), { status: 401 });
  let header, payload;
  try { header = decodeJwtPart(parts[0]); payload = decodeJwtPart(parts[1]); } catch (_) { throw Object.assign(new Error('Invalid Firebase ID token'), { status: 401 }); }
  const pid = projectId(env);
  const now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' || !header.kid || payload.aud !== pid || payload.iss !== `https://securetoken.google.com/${pid}` || !payload.sub || String(payload.sub).length > 128 || Number(payload.exp) <= now || Number(payload.iat) > now + 300) throw Object.assign(new Error('Firebase ID token claims rejected'), { status: 401 });
  const jwks = await getFirebaseJwks();
  const jwk = jwks.find(x => x.kid === header.kid);
  if (!jwk) throw Object.assign(new Error('Firebase signing key not found'), { status: 401 });
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid) throw Object.assign(new Error('Firebase ID token signature rejected'), { status: 401 });
  return String(payload.sub);
}

function fsValue(value) {
  if (value === undefined) return { nullValue: null };
  if (value === null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(fsValue) } };
  if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fsValue(v)])) } };
  return { stringValue: String(value) };
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
function fromFields(fields) { return Object.fromEntries(Object.entries(fields || {}).map(([k, v]) => [k, fromFsValue(v)])); }
function docObject(name, data) { return { name, fields: Object.fromEntries(Object.entries(data || {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, fsValue(v)])) }; }
function databaseRoot(env) { return `${FIRESTORE_ROOT}/projects/${encodeURIComponent(projectId(env))}/databases/(default)`; }
function documentName(env, path) { return `projects/${projectId(env)}/databases/(default)/documents/${path.split('/').map(encodeURIComponent).join('/')}`; }
function documentUrl(env, path) { return `${databaseRoot(env)}/documents/${path.split('/').map(encodeURIComponent).join('/')}`; }
async function googleFetch(url, token, init = {}) {
  return fetch(url, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${token}` } });
}
async function getDocument(env, token, path, transaction) {
  const suffix = transaction ? `?transaction=${encodeURIComponent(transaction)}` : '';
  const response = await googleFetch(documentUrl(env, path) + suffix, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  const doc = await response.json();
  return { name: doc.name, data: fromFields(doc.fields || {}) };
}
async function listDocuments(env, token, path, pageSize = 500) {
  let pageToken = null;
  const all = [];
  do {
    const params = new URLSearchParams({ pageSize: String(pageSize) });
    if (pageToken) params.set('pageToken', pageToken);
    const response = await googleFetch(`${databaseRoot(env)}/documents/${path.split('/').map(encodeURIComponent).join('/')}?${params}`, token);
    if (response.status === 404) return [];
    if (!response.ok) throw new Error(`Firestore list failed (${response.status})`);
    const body = await response.json();
    for (const doc of body.documents || []) all.push({ id: doc.name.split('/').pop(), data: fromFields(doc.fields || {}) });
    pageToken = body.nextPageToken || null;
  } while (pageToken && all.length < 2000);
  return all;
}
function parseBatchGetStream(text) {
  const trimmed=String(text||'').trim();
  if(!trimmed)return[];
  try{const parsed=JSON.parse(trimmed);return Array.isArray(parsed)?parsed:[parsed];}catch(_){}
  return trimmed.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
}
async function batchGetDocuments(env, token, paths, transaction) {
  const names=paths.map(path=>documentName(env,path));
  const response=await googleFetch(`${databaseRoot(env)}/documents:batchGet`,token,{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({documents:names,...(transaction?{transaction}:{})})
  });
  if(!response.ok)throw new Error(`Firestore batch read failed (${response.status})`);
  const rows=parseBatchGetStream(await response.text());
  const byName=new Map();
  for(const row of rows){
    if(row&&row.found&&row.found.name)byName.set(row.found.name,{name:row.found.name,data:fromFields(row.found.fields||{})});
    else if(row&&row.missing)byName.set(row.missing,null);
  }
  return names.map(name=>byName.has(name)?byName.get(name):null);
}
async function beginTransaction(env, token) {
  const response = await googleFetch(`${databaseRoot(env)}/documents:beginTransaction`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  if (!response.ok) throw new Error(`Firestore transaction start failed (${response.status})`);
  return (await response.json()).transaction;
}
async function rollback(env, token, transaction) {
  try { await googleFetch(`${databaseRoot(env)}/documents:rollback`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transaction }) }); } catch (_) {}
}
async function commit(env, token, transaction, writes) {
  const response = await googleFetch(`${databaseRoot(env)}/documents:commit`, token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transaction, writes }) });
  if (!response.ok) throw new Error(`Firestore commit failed (${response.status})`);
  return response.json();
}
function cacheKey(env,id){return `${projectId(env)}:${id}`;}
async function getQuestionMetadata(env, token, questionId) {
  const key=cacheKey(env,questionId),now=Date.now(),cached=questionMetadataCache.get(key);
  if(cached&&cached.expiresAt>now)return cached.value;
  if(cached)questionMetadataCache.delete(key);
  const value=await getDocument(env,token,`questions/${questionId}`);
  if(value){
    questionMetadataCache.set(key,{value,expiresAt:now+QUESTION_CACHE_TTL_MS});
    while(questionMetadataCache.size>QUESTION_CACHE_MAX)questionMetadataCache.delete(questionMetadataCache.keys().next().value);
  }
  return value;
}
async function getKnowledgePointUniverse(env, token) {
  const now=Date.now(),pid=projectId(env);
  if(kpUniverseCache&&kpUniverseCache.projectId===pid&&kpUniverseCache.expiresAt>now)return kpUniverseCache.value;
  const value=await listDocuments(env,token,'knowledgePoints');
  kpUniverseCache={projectId:pid,value,expiresAt:now+STATIC_CACHE_TTL_MS};
  return value;
}
function updateWrite(env, path, data) { return { update: docObject(documentName(env, path), data) }; }
function maskedUpdateWrite(env,path,data,fieldPaths){return{update:docObject(documentName(env,path),data),updateMask:{fieldPaths}}}
function planStatePath(uid){return `users/${uid}/planState/current-v2`;}
function planStateDeltaWrite(env,uid,changes,now){const delta=PLAN_STATE.delta(changes,now);return maskedUpdateWrite(env,planStatePath(uid),delta.data,delta.fieldPaths)}
function masteryStatus(mastery) { return POLICY.masteryStatus(mastery); }
function calculateLearningUpdate(prev, answer, baseXp, now) { return POLICY.calculateLearningUpdate({ prev, isCorrect: answer.isCorrect, usedHint: answer.usedHint, attemptCount: answer.attemptCount, baseXp, now }); }
function calculateConceptUpdate(prev, answer, conceptKey, conceptLabel, now) { return POLICY.calculateConceptMasteryUpdate({ prev, conceptKey, conceptLabel, kpId: answer.kpId, questionId: answer.questionId, selectedAnswer: answer.selectedAnswer, correctAnswer: answer.correctAnswer, isCorrect: answer.isCorrect, usedHint: answer.usedHint, attemptCount: answer.attemptCount, now }); }
function coreSkillId(questionData,kpId,targetSkillId){return QUESTION_SKILL_CONTRACT.resolveCoreSkill(questionData,kpId,targetSkillId,CURRICULUM)}
function skillResult(skillId,record){if(!skillId||!record)return null;const verification=SKILL_EVIDENCE.assess(record);return{skillId,mastery:Number(record.mastery||0),status:record.status||masteryStatus(record.mastery),nextReviewAt:record.nextReviewAt instanceof Date?record.nextReviewAt.toISOString():record.nextReviewAt||null,interval:Number(record.interval||0),easeFactor:Number(record.easeFactor||2.5),repetition:Number(record.repetition||0),attempts:Number(record.attempts||0),correctCount:Number(record.correctCount||0),wrongCount:Number(record.wrongCount||0),hintCount:Number(record.hintCount||0),lastCorrect:record.lastCorrect??null,lastAnsweredAt:record.lastAnsweredAt instanceof Date?record.lastAnsweredAt.toISOString():record.lastAnsweredAt||null,kpIds:Array.isArray(record.kpIds)?record.kpIds.map(String):[],source:String(record.source||'server-native-v1'),evidence:verification.evidence,verificationVersion:verification.version,masteryVerified:verification.verified};}
function calculateLevel(totalXp) {
  let level = 1, cumulative = 0;
  while (level < 99) { const needed = level === 1 ? 50 : 50 + (level - 1) * 30; if (cumulative + needed > totalXp) break; cumulative += needed; level += 1; }
  return level;
}
function optionalText(value, max) { if (value == null || value === '') return null; const text = String(value); if (text.length > max) throw Object.assign(new Error('Input too long'), { status: 400 }); return text; }
function reviewedConcept(questionData) {
  const rawKey=questionData&&(questionData.misconceptionKey??questionData.conceptKey);
  if(rawKey==null||rawKey==='')return{conceptKey:null,conceptLabel:null};
  const conceptKey=String(rawKey),rawLabel=questionData.misconceptionLabel??questionData.conceptLabel??conceptKey,conceptLabel=String(rawLabel);
  if(!/^[A-Za-z0-9:._-]+$/.test(conceptKey)||conceptKey.length>128||conceptLabel.length>160)throw new Error('Invalid reviewed question concept metadata');
  return{conceptKey,conceptLabel};
}
function validateAnswer(raw) {
  if (!raw || !raw.kpId || !raw.questionId || raw.selectedAnswer == null) throw Object.assign(new Error('Invalid answer payload'), { status: 400 });
  const attemptCount = Number(raw.attemptCount ?? 1);
  const responseTimeMs = raw.responseTimeMs == null ? null : Number(raw.responseTimeMs);
  const localDate = raw.localDate ? String(raw.localDate) : new Date().toISOString().slice(0, 10);
  const answerId = raw.answerId ? String(raw.answerId) : crypto.randomUUID().replace(/-/g, '');
  const clientClaimedConceptKey = optionalText(raw.conceptKey, 128);
  const clientClaimedConceptLabel = optionalText(raw.conceptLabel, 160);
  const targetSkillId = optionalText(raw.targetSkillId, 128);
  if (!Number.isInteger(attemptCount) || attemptCount < 1 || attemptCount > 10 || (responseTimeMs != null && (!Number.isFinite(responseTimeMs) || responseTimeMs < 0 || responseTimeMs > 600000)) || !/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^[A-Za-z0-9_-]{8,128}$/.test(answerId) || (clientClaimedConceptKey && !/^[A-Za-z0-9:._-]+$/.test(clientClaimedConceptKey)) || (targetSkillId && !/^[A-Za-z0-9._-]{2,128}$/.test(targetSkillId))) throw Object.assign(new Error('Invalid answer payload'), { status: 400 });
  return {
    answerId, kpId: String(raw.kpId), questionId: raw.questionId ? String(raw.questionId) : null, textId: raw.textId ? String(raw.textId) : null,
    conceptKey:null, conceptLabel:null, clientClaimedConceptKey, clientClaimedConceptLabel, selectedAnswer: optionalText(raw.selectedAnswer, 500), correctAnswer: null, targetSkillId,
    isCorrect: false, clientClaimedCorrect:typeof raw.isCorrect==='boolean'?raw.isCorrect:null, usedHint: Boolean(raw.usedHint), attemptCount, responseTimeMs, localDate
  };
}
function validatePracticeSession(raw){
  if(!raw||!raw.skillId||!(raw.routeKpId||raw.kpId))throw Object.assign(new Error('Invalid practice session payload'),{status:400});
  const practiceId=String(raw.practiceId||''),skillId=String(raw.skillId),routeKpId=String(raw.routeKpId||raw.kpId),kpId=String(raw.kpId||routeKpId),strategy=String(raw.strategy||'targeted').toLowerCase(),beforeMastery=Number(raw.beforeMastery),afterMastery=Number(raw.afterMastery),questionCount=Number(raw.questionCount),correctCount=Number(raw.correctCount),completedAt=new Date(raw.completedAt||Date.now()),conceptKey=optionalText(raw.conceptKey,128),conceptLabel=optionalText(raw.conceptLabel,160),conceptBefore=raw.conceptBeforeMastery==null?null:Number(raw.conceptBeforeMastery),conceptAfter=raw.conceptAfterMastery==null?null:Number(raw.conceptAfterMastery),conceptDelta=raw.conceptDelta==null?null:Number(raw.conceptDelta);
  const masteryOk=[beforeMastery,afterMastery].every(value=>Number.isFinite(value)&&value>=0&&value<=100),conceptOk=[conceptBefore,conceptAfter].every(value=>value==null||(Number.isFinite(value)&&value>=0&&value<=100))&&(conceptDelta==null||Number.isFinite(conceptDelta)),time=completedAt.getTime(),now=Date.now();
  if(!/^[A-Za-z0-9_-]{8,128}$/.test(practiceId)||!/^[A-Za-z0-9._-]{2,128}$/.test(skillId)||!/^[A-Za-z0-9._-]{1,128}$/.test(routeKpId)||kpId!==routeKpId||!['targeted','remedial','reteach'].includes(strategy)||!masteryOk||!Number.isInteger(questionCount)||questionCount<1||questionCount>20||!Number.isInteger(correctCount)||correctCount<0||correctCount>questionCount||!Number.isFinite(time)||time<now-366*86400000||time>now+10*60000||!conceptOk||(conceptKey&&!/^[A-Za-z0-9:._-]+$/.test(conceptKey)))throw Object.assign(new Error('Invalid practice session payload'),{status:400});
  return SERVER_PRACTICE.normalizeSession({practiceId,skillId,routeKpId,kpId,beforeMastery,afterMastery,delta:afterMastery-beforeMastery,correctCount,questionCount,accuracy:Math.round(correctCount/questionCount*100),strategy,conceptKey,conceptLabel,conceptBeforeMastery:conceptBefore,conceptAfterMastery:conceptAfter,conceptDelta,completedAt:completedAt.toISOString()});
}

async function submitAnswer(request, env, uid, trace) {
  let raw;
  try { raw = await request.json(); } catch (_) { throw Object.assign(new Error('JSON body required'), { status: 400 }); }
  const answer = validateAnswer(raw);
  const token = await timed(trace,'oauth',()=>getServiceAccessToken(env));
  let baseXp = 8, conceptKey = null, conceptLabel = null, skillId = null, questionData = null;
  if (answer.questionId) {
    const question = await timed(trace,'question_read',()=>getQuestionMetadata(env, token, answer.questionId));
    if (question) {
      questionData={id:answer.questionId,...question.data};
      const questionKpId = question.data.kpId ? String(question.data.kpId) : null;
      if (questionKpId && questionKpId !== answer.kpId) throw Object.assign(new Error('questionId does not belong to kpId'), { status: 400 });
      const xp = Number(question.data.baseXp ?? question.data.xp);
      if (Number.isFinite(xp)) baseXp = clamp(xp, 1, 50);
      ({conceptKey,conceptLabel}=reviewedConcept(question.data));
      skillId = coreSkillId(question.data, answer.kpId, answer.targetSkillId);
      const verified=ANSWER_VERIFICATION.verify(questionData,answer.selectedAnswer);
      answer.isCorrect=verified.isCorrect;
      answer.correctAnswer=verified.correctAnswer;
    }
    else throw Object.assign(new Error('Verified question metadata required'),{status:400});
  }
  const tx = await timed(trace,'tx_begin',()=>beginTransaction(env, token));
  try {
    const kpPath = `users/${uid}/knowledge/${answer.kpId}`;
    const skillPath = skillId ? `users/${uid}/skills/${skillId}` : null;
    const gamePath = `users/${uid}/gamification/state`;
    const logPath = `users/${uid}/answerLogs/${answer.answerId}`;
    const conceptPath = conceptKey ? `users/${uid}/concepts/${conceptKey}` : null;
    const txPaths=[kpPath,...(skillPath?[skillPath]:[]),gamePath,logPath,...(conceptPath?[conceptPath]:[])];
    const txDocs=await timed(trace,'tx_reads',()=>batchGetDocuments(env,token,txPaths,tx));
    let cursor=0;
    const kpDoc=txDocs[cursor++];
    const skillDoc=skillPath?txDocs[cursor++]:null;
    const gameDoc=txDocs[cursor++];
    const logDoc=txDocs[cursor++];
    const conceptDoc=conceptPath?txDocs[cursor++]:null;
    const gameExisting = gameDoc ? gameDoc.data : {};
    if (logDoc) {
      await timed(trace,'tx_rollback',()=>rollback(env, token, tx));
      const existing = logDoc.data;
      return json({ success: true, isCorrect:existing.isCorrect===true, quality: existing.quality, xpEarned: Number(existing.xpEarned || 0), mastery: Number(existing.mastery || 0), status: existing.status || null, nextReviewAt: existing.nextReviewAt || null, attempts: Number(existing.attempts || 0), correctCount: Number(existing.correctCount || 0), wrongCount: Number(existing.wrongCount || 0), hintCount: Number(existing.hintCount || 0), lastCorrect: existing.lastCorrect ?? null, lastAnsweredAt: existing.lastAnsweredAt || existing.answeredAt || null, totalXp: Number(existing.totalXp ?? gameExisting.totalXp ?? 0), todayXp: Number(existing.todayXp ?? gameExisting.todayXp ?? 0), streak: Number(existing.streak ?? gameExisting.streak ?? 0), streakFreezes: Number(existing.streakFreezes ?? gameExisting.streakFreezes ?? 0), streakIncreased: Boolean(existing.streakIncreased), level: Number(existing.level ?? gameExisting.level ?? 1), skillId: existing.skillId || skillId || null, skillMastery: existing.skillMastery || null, conceptMastery: existing.conceptMastery || null, duplicate: true });
    }
    const now = new Date();
    const prev = kpDoc ? kpDoc.data : {};
    const rawGame = gameExisting;
    const game = (rawGame.todayXpDate || answer.localDate) === answer.localDate ? rawGame : { ...rawGame, todayXp: 0, todayXpDate: answer.localDate };
    const update = calculateLearningUpdate(prev, answer, baseXp, now);
    let nativeSkill=null,skillMastery=null;
    if(skillPath){
      const skillPrev=skillDoc?skillDoc.data:{};
      const skillLearning=calculateLearningUpdate(skillPrev,answer,baseXp,now);
      const evidence=SKILL_EVIDENCE.update(skillPrev.evidence,answer,questionData,skillId,now);
      nativeSkill={...skillPrev,...skillLearning,skillId,kpIds:Array.from(new Set([...(Array.isArray(skillPrev.kpIds)?skillPrev.kpIds:[]),answer.kpId].map(String))),source:'server-native-v1',evidence,nextReviewAt:skillLearning.nextReviewAt,lastAnsweredAt:skillLearning.lastAnsweredAt,updatedAt:now};
      const verification=SKILL_EVIDENCE.assess(nativeSkill);
      nativeSkill.verificationVersion=verification.version;
      nativeSkill.masteryVerified=verification.verified;
      skillMastery=skillResult(skillId,nativeSkill);
    }
    const totalXp = Number(game.totalXp || 0) + update.xpEarned;
    const todayXp = Number(game.todayXp || 0) + update.xpEarned;
    const dailyGoalXp = Number(game.dailyGoalXp || 20);
    const previousActiveDate = game.lastActiveDate || null;
    let streak = Number(game.streak || 0), streakFreezes = Number(game.streakFreezes ?? 2), streakIncreased = false;
    if (todayXp >= dailyGoalXp && previousActiveDate !== answer.localDate) {
      const previousDate = previousActiveDate ? new Date(`${previousActiveDate}T00:00:00Z`) : null;
      const currentDate = new Date(`${answer.localDate}T00:00:00Z`);
      const gap = previousDate ? Math.round((currentDate - previousDate) / 86400000) : null;
      if (gap === 1) streak += 1;
      else if (gap == null || gap > 1) {
        const missedDays = gap == null ? 0 : gap - 1;
        if (missedDays > 0 && streakFreezes >= missedDays) { streakFreezes -= missedDays; streak += 1; }
        else { streak = 1; if (missedDays > 0) streakFreezes = 0; }
      }
      streakIncreased = true;
    }
    const level = calculateLevel(totalXp);
    let conceptResult = null, conceptUpdate = null;
    if (conceptKey) {
      conceptUpdate = calculateConceptUpdate(conceptDoc ? conceptDoc.data : {}, answer, conceptKey, conceptLabel, now);
      conceptResult = { ...conceptUpdate, status: masteryStatus(conceptUpdate.mastery), lastAnsweredAt: now.toISOString() };
    }
    const kpUpdate = { ...prev, ...update, nextReviewAt: update.nextReviewAt, lastAnsweredAt: update.lastAnsweredAt, updatedAt: now };
    const gameUpdate = { ...game, totalXp, todayXp, todayXpDate: answer.localDate, dailyGoalXp, streak, streakFreezes, lastActiveDate: todayXp >= dailyGoalXp ? answer.localDate : previousActiveDate, level, updatedAt: now };
    const log = {
      answerId: answer.answerId, questionId: answer.questionId, kpIds: [answer.kpId], requestedSkillId:answer.targetSkillId, skillId, skillMastery, textId: answer.textId, conceptKey, conceptLabel, clientClaimedConceptKey:answer.clientClaimedConceptKey, clientClaimedConceptLabel:answer.clientClaimedConceptLabel, conceptAttributionMismatch:answer.clientClaimedConceptKey!=null&&answer.clientClaimedConceptKey!==conceptKey,
      selectedAnswer: answer.selectedAnswer, correctAnswer: answer.correctAnswer, conceptMastery: conceptResult, isCorrect: answer.isCorrect, verificationVersion:ANSWER_VERIFICATION.VERSION, clientClaimedCorrect:answer.clientClaimedCorrect, correctnessMismatch:answer.clientClaimedCorrect!=null&&answer.clientClaimedCorrect!==answer.isCorrect,
      usedHint: answer.usedHint, attemptCount: answer.attemptCount, responseTimeMs: answer.responseTimeMs, localDate: answer.localDate,
      quality: update.quality, xpEarned: update.xpEarned, mastery: update.mastery, status: update.status, nextReviewAt: update.nextReviewAt,
      interval: update.interval, easeFactor: update.easeFactor, repetition: update.repetition, attempts: update.attempts, correctCount: update.correctCount, wrongCount: update.wrongCount, hintCount: update.hintCount, lastCorrect: update.lastCorrect, lastAnsweredAt: update.lastAnsweredAt,
      totalXp, todayXp, streak, streakFreezes, streakIncreased, level, answeredAt: now
    };
    const writes = [updateWrite(env, kpPath, kpUpdate)];
    if(skillPath&&nativeSkill)writes.push(updateWrite(env,skillPath,nativeSkill));
    writes.push(updateWrite(env, gamePath, gameUpdate));
    if (conceptPath && conceptUpdate) writes.push(updateWrite(env, conceptPath, { ...conceptUpdate, lastAnsweredAt: conceptUpdate.lastAnsweredAt, updatedAt: now }));
    const plannerChanges={knowledge:{id:answer.kpId,data:kpUpdate}};
    if(skillPath&&nativeSkill)plannerChanges.skills={id:skillId,data:nativeSkill};
    if(conceptPath&&conceptUpdate)plannerChanges.concepts={id:conceptKey,data:{...conceptUpdate,lastAnsweredAt:conceptUpdate.lastAnsweredAt,updatedAt:now}};
    writes.push(planStateDeltaWrite(env,uid,plannerChanges,now));
    writes.push(updateWrite(env, logPath, log));
    await timed(trace,'commit',()=>commit(env, token, tx, writes));
    return json({ success: true, isCorrect:answer.isCorrect, verificationVersion:ANSWER_VERIFICATION.VERSION, quality: update.quality, xpEarned: update.xpEarned, mastery: update.mastery, status: update.status, nextReviewAt: update.nextReviewAt.toISOString(), interval: update.interval, easeFactor: update.easeFactor, repetition: update.repetition, attempts: update.attempts, correctCount: update.correctCount, wrongCount: update.wrongCount, hintCount: update.hintCount, lastCorrect: update.lastCorrect, lastAnsweredAt: update.lastAnsweredAt.toISOString(), totalXp, todayXp, streak, streakFreezes, streakIncreased, level, skillId, skillMastery, conceptMastery: conceptResult, duplicate: false });
  } catch (error) {
    await timed(trace,'tx_rollback',()=>rollback(env, token, tx));
    throw error;
  }
}

async function submitStage3Calibration(request,env,uid,trace){
  let raw;try{raw=await request.json()}catch(_){throw Object.assign(new Error('JSON body required'),{status:400})}
  const event=STAGE3_CALIBRATION.validate(raw),token=await timed(trace,'calibration_oauth',()=>getServiceAccessToken(env)),tx=await timed(trace,'calibration_tx_begin',()=>beginTransaction(env,token));
  try{
    const calibrationPath=`users/${uid}/stage3Calibrations/${event.calibrationId}`,answerPaths=event.verificationAnswers.map(item=>`users/${uid}/answerLogs/${item.answerId}`),docs=await timed(trace,'calibration_tx_reads',()=>batchGetDocuments(env,token,[calibrationPath,...answerPaths],tx)),existing=docs[0];
    if(existing){await timed(trace,'calibration_tx_rollback',()=>rollback(env,token,tx));return json({success:true,...existing.data,duplicate:true})}
    const outcome=STAGE3_CALIBRATION.derive(event,docs.slice(1)),now=new Date(),stored=STAGE3_CALIBRATION.stored(event,outcome,now);
    await timed(trace,'calibration_commit',()=>commit(env,token,tx,[updateWrite(env,calibrationPath,{...stored,receivedAt:now})]));
    return json({success:true,...stored,duplicate:false});
  }catch(error){await timed(trace,'calibration_tx_rollback',()=>rollback(env,token,tx));throw error}
}

async function submitPracticeSession(request,env,uid,trace){
  let raw;try{raw=await request.json()}catch(_){throw Object.assign(new Error('JSON body required'),{status:400})}
  const session=validatePracticeSession(raw),token=await timed(trace,'oauth',()=>getServiceAccessToken(env)),kpUniverse=await timed(trace,'kp_list',()=>getKnowledgePointUniverse(env,token)),route=kpUniverse.find(row=>String(row&&row.id)===session.routeKpId),allowed=route?SERVER_SKILL_PLAN.skillIdsForKp(session.routeKpId,route.data||{}):[];
  if(!route||!allowed.includes(session.skillId))throw Object.assign(new Error('practice skill does not match route knowledge point'),{status:400});
  const tx=await timed(trace,'practice_tx_begin',()=>beginTransaction(env,token));
  try{
    const sessionPath=`users/${uid}/practiceSessions/${session.practiceId}`,interventionPath=`users/${uid}/interventions/${session.skillId}`,[sessionDoc,interventionDoc]=await timed(trace,'practice_tx_reads',()=>batchGetDocuments(env,token,[sessionPath,interventionPath],tx));
    if(sessionDoc){await timed(trace,'practice_tx_rollback',()=>rollback(env,token,tx));const current=interventionDoc&&interventionDoc.data||{};return json({success:true,practiceSession:sessionDoc.data,interventionState:{...(current.learningState||{}),skillId:session.skillId,kpIds:current.kpIds||[],routeKpId:current.routeKpId||session.routeKpId,updatedAt:current.updatedAt||null,source:current.source||'server-native-v1'},duplicate:true})}
    const now=new Date(),next=SERVER_PRACTICE.buildIntervention(interventionDoc&&interventionDoc.data,session,now),storedSession={...session,source:'server-native-v1',receivedAt:now};
    await timed(trace,'practice_commit',()=>commit(env,token,tx,[updateWrite(env,sessionPath,storedSession),updateWrite(env,interventionPath,next),planStateDeltaWrite(env,uid,{interventions:{id:session.skillId,data:next}},now)]));
    return json({success:true,practiceSession:{...session,source:'server-native-v1',receivedAt:now.toISOString()},interventionState:{...next.learningState,skillId:session.skillId,kpIds:next.kpIds,routeKpId:next.routeKpId,updatedAt:now.toISOString(),source:'server-native-v1'},duplicate:false});
  }catch(error){await timed(trace,'practice_tx_rollback',()=>rollback(env,token,tx));throw error}
}
async function practiceState(env,uid,trace){const token=await timed(trace,'oauth',()=>getServiceAccessToken(env)),rows=await timed(trace,'interventions_list',()=>listDocuments(env,token,`users/${uid}/interventions`)),state=SERVER_PRACTICE.flattenInterventions(rows);return json({...state,serverTime:new Date().toISOString()})}

function isDue(data, now) { const value = data && data.nextReviewAt; return !value || new Date(value).getTime() <= now.getTime(); }
async function promotePlanState(env,token,uid,collections,startedAt,trace){
  const path=planStatePath(uid),tx=await timed(trace,'plan_state_tx_begin',()=>beginTransaction(env,token));
  try{
    const current=await timed(trace,'plan_state_tx_read',()=>getDocument(env,token,path,tx));
    if(PLAN_STATE.changedAfter(current&&current.data,startedAt)){await timed(trace,'plan_state_tx_rollback',()=>rollback(env,token,tx));return false}
    const snapshot=PLAN_STATE.full(collections,new Date());
    await timed(trace,'plan_state_commit',()=>commit(env,token,tx,[updateWrite(env,path,snapshot)]));
    return true;
  }catch(error){await timed(trace,'plan_state_tx_rollback',()=>rollback(env,token,tx));throw error}
}
async function dailyPlan(env, uid, trace) {
  const token = await timed(trace,'oauth',()=>getServiceAccessToken(env));
  const startedAt=new Date();
  const [plannerDoc,kpUniverseDocs] = await Promise.all([
    timed(trace,'plan_state_read',()=>getDocument(env,token,planStatePath(uid))),
    timed(trace,'kp_list',()=>getKnowledgePointUniverse(env, token))
  ]);
  let knowledge,skills,concepts,interventions;
  if(PLAN_STATE.usable(plannerDoc&&plannerDoc.data)){
    knowledge=PLAN_STATE.rows(plannerDoc.data,'knowledge');skills=PLAN_STATE.rows(plannerDoc.data,'skills');concepts=PLAN_STATE.rows(plannerDoc.data,'concepts');interventions=PLAN_STATE.rows(plannerDoc.data,'interventions');
  }else{
    [knowledge, skills, concepts, interventions] = await Promise.all([
      timed(trace,'knowledge_list',()=>listDocuments(env, token, `users/${uid}/knowledge`)),
      timed(trace,'skills_list',()=>listDocuments(env, token, `users/${uid}/skills`)),
      timed(trace,'concepts_list',()=>listDocuments(env, token, `users/${uid}/concepts`)),
      timed(trace,'interventions_list',()=>listDocuments(env, token, `users/${uid}/interventions`))
    ]);
    try{await promotePlanState(env,token,uid,{knowledge,skills,concepts,interventions},startedAt,trace)}catch(error){console.warn('plan state promotion deferred',error)}
  }
  const plan=SERVER_SKILL_PLAN.buildPlan({knowledge,skills,concepts,interventions,kpUniverse:kpUniverseDocs,targetCount:Number(CURRICULUM&&CURRICULUM.dailyPolicy&&CURRICULUM.dailyPolicy.sessionSize)||10,now:new Date()});
  const conceptState=Object.fromEntries(concepts.map(row=>[row.id,{...row.data,conceptKey:row.id}]));
  return json({...plan,conceptState});
}
async function accountState(env,uid,trace){
  const token=await timed(trace,'oauth',()=>getServiceAccessToken(env)),startedAt=new Date();
  const plannerDoc=await timed(trace,'account_state_read',()=>getDocument(env,token,planStatePath(uid)));
  let knowledge,skills,concepts;
  if(PLAN_STATE.usable(plannerDoc&&plannerDoc.data)){
    knowledge=PLAN_STATE.rows(plannerDoc.data,'knowledge');
    skills=PLAN_STATE.rows(plannerDoc.data,'skills');
    concepts=PLAN_STATE.rows(plannerDoc.data,'concepts');
  }else{
    let interventions;
    [knowledge,skills,concepts,interventions]=await Promise.all([
      timed(trace,'knowledge_list',()=>listDocuments(env,token,`users/${uid}/knowledge`)),
      timed(trace,'skills_list',()=>listDocuments(env,token,`users/${uid}/skills`)),
      timed(trace,'concepts_list',()=>listDocuments(env,token,`users/${uid}/concepts`)),
      timed(trace,'interventions_list',()=>listDocuments(env,token,`users/${uid}/interventions`))
    ]);
    try{await promotePlanState(env,token,uid,{knowledge,skills,concepts,interventions},startedAt,trace)}catch(error){console.warn('account state promotion deferred',error)}
  }
  return json({
    version:PLAN_STATE.VERSION,
    knowledgeState:Object.fromEntries(knowledge.map(row=>[row.id,row.data])),
    skillState:Object.fromEntries(skills.map(row=>[row.id,{...row.data,skillId:row.id,source:row.data.source||'server-native-v1'}])),
    conceptState:Object.fromEntries(concepts.map(row=>[row.id,{...row.data,conceptKey:row.id}]))
  });
}
async function dueKnowledge(env, uid, trace) {
  const token = await timed(trace,'oauth',()=>getServiceAccessToken(env));
  const knowledge = await timed(trace,'knowledge_list',()=>listDocuments(env, token, `users/${uid}/knowledge`));
  const now = new Date();
  const due = knowledge.filter(x => isDue(x.data, now)).sort((a, b) => new Date(a.data.nextReviewAt || 0) - new Date(b.data.nextReviewAt || 0)).slice(0, 50).map(x => x.id);
  return json({ dueKpIds: due, count: due.length });
}

async function api(request, env, trace) {
  const url = new URL(request.url);
  if (url.pathname === '/api/health') return json({ ok: true, service: 'manjingo-learning', firestoreProject: projectId(env), configured: Boolean(env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY), learningPolicy: 'shared-v1', practicePolicy:SERVER_PRACTICE.VERSION, stage3CalibrationPolicy:STAGE3_CALIBRATION.VERSION });
  const uid = await timed(trace,'auth',()=>verifyFirebaseIdToken(request, env));
  if (url.pathname === '/api/submit-answer' && request.method === 'POST') return submitAnswer(request, env, uid, trace);
  if (url.pathname === '/api/stage3-calibration' && request.method === 'POST') return submitStage3Calibration(request,env,uid,trace);
  if (url.pathname === '/api/practice-session' && request.method === 'POST') return submitPracticeSession(request, env, uid, trace);
  if (url.pathname === '/api/practice-state' && request.method === 'GET') return practiceState(env, uid, trace);
  if (url.pathname === '/api/account-state' && request.method === 'GET') return accountState(env, uid, trace);
  if (url.pathname === '/api/daily-plan' && (request.method === 'GET' || request.method === 'POST')) return dailyPlan(env, uid, trace);
  if (url.pathname === '/api/due-knowledge-points' && (request.method === 'GET' || request.method === 'POST')) return dueKnowledge(env, uid, trace);
  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    const trace=createTrace();
    try { return withServerTiming(await api(request, env, trace),trace); }
    catch (error) { console.error('learning api error', error); return withServerTiming(json({ error: error && error.message ? error.message : 'Internal server error' }, Number(error && error.status) || 500),trace); }
  }
};
