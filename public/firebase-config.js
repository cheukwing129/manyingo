// firebase-config.js
// Firebase client initialization for authentication + Firestore reads.
// Server-authoritative learning writes continue to go through same-origin Cloudflare Pages API.
import './answer-outbox.js';

const firebaseConfig = {
  apiKey: "AIzaSyCGhpSFHy3MDf75fhAJtrHTQJoa18SjqAM",
  authDomain: "manjingo-95d9a.firebaseapp.com",
  projectId: "manjingo-95d9a",
  storageBucket: "manjingo-95d9a.firebasestorage.app",
  messagingSenderId: "653860419855",
  appId: "1:653860419855:web:bd584b431a71a0ca70267a"
};

let db = null;
let auth = null;
let firebaseReadyPromise = null;
let currentUserId = null;
let redirectChecked = false;
let redirectCheckPromise = null;
let outboxFlushPromise = null;
let outboxRetryTimer = null;
const answerInFlight = new Map();

async function getFirebase() {
  if (firebaseReadyPromise) return firebaseReadyPromise;
  firebaseReadyPromise = (async () => {
    const [appModule, firestoreModule, authModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js")
    ]);
    const app = appModule.initializeApp(firebaseConfig);
    db = firestoreModule.getFirestore(app);
    auth = authModule.getAuth(app);
    return { firestoreModule, authModule };
  })().catch(error => { firebaseReadyPromise = null; throw error; });
  return firebaseReadyPromise;
}

export { getFirebase };
export { db, auth };

function withTimeout(promise, ms, label) {
  return Promise.race([promise,new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), ms))]);
}
function isoTimestamp(value) {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (typeof value === 'string') return value;
    if (Number.isFinite(Number(value._seconds))) return new Date(Number(value._seconds) * 1000).toISOString();
    if (Number.isFinite(Number(value.seconds))) return new Date(Number(value.seconds) * 1000).toISOString();
    const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toISOString();
  } catch (_) { return null; }
}
function accountSnapshot(user) {
  if (!user) return { uid:null, anonymous:true, google:false, displayName:null, email:null, photoURL:null };
  const google = Array.isArray(user.providerData) && user.providerData.some(p => p && p.providerId === 'google.com');
  return { uid:user.uid, anonymous:!!user.isAnonymous, google, displayName:user.displayName||null, email:user.email||null, photoURL:user.photoURL||null };
}
function credentialFromGoogleError(authModule, error) {
  try { return authModule.GoogleAuthProvider.credentialFromError(error) || error.credential || null; }
  catch (_) { return error && error.credential || null; }
}
function isCredentialConflict(error) {
  return ['auth/credential-already-in-use','auth/email-already-in-use','auth/account-exists-with-different-credential'].includes(String(error&&error.code||''));
}
function preferRedirectFlow() {
  try { return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && window.innerWidth < 820; }
  catch (_) { return false; }
}

export async function completeGoogleRedirect() {
  if (redirectChecked) return auth ? accountSnapshot(auth.currentUser) : accountSnapshot(null);
  if (redirectCheckPromise) return redirectCheckPromise;
  redirectCheckPromise = (async () => {
    const { authModule } = await getFirebase();
    try {
      const result = await authModule.getRedirectResult(auth);
      redirectChecked = true;
      if (result && result.user) currentUserId = result.user.uid;
      else if (auth.currentUser) currentUserId = auth.currentUser.uid;
      return accountSnapshot(auth.currentUser);
    } catch (error) {
      if (isCredentialConflict(error)) {
        const credential = credentialFromGoogleError(authModule, error);
        if (credential) {
          const result = await authModule.signInWithCredential(auth, credential);
          currentUserId = result.user.uid;
          redirectChecked = true;
          return accountSnapshot(result.user);
        }
      }
      redirectChecked = true;
      throw error;
    }
  })().finally(() => { redirectCheckPromise = null; });
  return redirectCheckPromise;
}

export async function ensureLogin() {
  try {
    const { authModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    try { await withTimeout(completeGoogleRedirect(), 8000, 'Google redirect'); } catch (error) { console.warn('Google redirect completion unavailable:', error); }
    return await withTimeout(new Promise((resolve) => {
      let settled = false;
      let unsubscribe = null;
      const finish = (value) => { if (settled) return; settled = true; try { unsubscribe?.(); } catch (_) {} resolve(value); };
      unsubscribe = authModule.onAuthStateChanged(auth, (user) => {
        if (user) { currentUserId = user.uid; finish(user.uid); return; }
        authModule.signInAnonymously(auth).then(credential => { currentUserId = credential.user.uid; finish(credential.user.uid); }).catch((e) => { console.warn("匿名登入失敗，將使用離線模式", e); finish(null); });
      });
    }), 8000, 'Firebase authentication');
  } catch (error) {
    console.warn('Firebase authentication unavailable:', error);
    return null;
  }
}

export function getCurrentUserId() { return currentUserId; }
export async function getAccountState() { await ensureLogin(); return accountSnapshot(auth && auth.currentUser); }
export async function onAccountChanged(callback) {
  const { authModule } = await getFirebase();
  return authModule.onAuthStateChanged(auth, user => { currentUserId = user ? user.uid : null; if(user)void flushAnswerOutbox({force:true,uid:user.uid}); callback(accountSnapshot(user)); });
}

export async function signInWithGoogle(options = {}) {
  const { authModule } = await getFirebase();
  await ensureLogin();
  const current = auth.currentUser;
  if (!current) throw new Error('Firebase authentication unavailable');
  if (accountSnapshot(current).google) return { ...accountSnapshot(current), linked:true, redirecting:false };
  const provider = new authModule.GoogleAuthProvider();
  provider.setCustomParameters({ prompt:'select_account' });
  const useRedirect = options.redirect === true || (options.redirect !== false && preferRedirectFlow());
  if (useRedirect) {
    if (current.isAnonymous) await authModule.linkWithRedirect(current, provider);
    else await authModule.signInWithRedirect(auth, provider);
    return { ...accountSnapshot(current), linked:false, redirecting:true };
  }
  try {
    const result = current.isAnonymous ? await authModule.linkWithPopup(current, provider) : await authModule.signInWithPopup(auth, provider);
    currentUserId = result.user.uid;
    void flushAnswerOutbox({force:true,uid:currentUserId});
    return { ...accountSnapshot(result.user), linked:current.isAnonymous, redirecting:false };
  } catch (error) {
    if (isCredentialConflict(error)) {
      const credential = credentialFromGoogleError(authModule, error);
      const result = credential ? await authModule.signInWithCredential(auth, credential) : await authModule.signInWithPopup(auth, provider);
      currentUserId = result.user.uid;
      void flushAnswerOutbox({force:true,uid:currentUserId});
      return { ...accountSnapshot(result.user), linked:false, mergedExisting:true, redirecting:false };
    }
    if (String(error&&error.code||'') === 'auth/popup-blocked') {
      if (current.isAnonymous) await authModule.linkWithRedirect(current, provider);
      else await authModule.signInWithRedirect(auth, provider);
      return { ...accountSnapshot(current), linked:false, redirecting:true };
    }
    throw error;
  }
}

export async function signOutAccount() {
  const { authModule } = await getFirebase();
  await authModule.signOut(auth);
  currentUserId = null;
  const credential = await authModule.signInAnonymously(auth);
  currentUserId = credential.user.uid;
  void flushAnswerOutbox({force:true,uid:currentUserId});
  return accountSnapshot(credential.user);
}

async function authorizedApi(path, options = {}) {
  const uid = await ensureLogin();
  if (!uid || !auth || !auth.currentUser) throw new Error('Firebase authentication unavailable');
  const idToken = await withTimeout(auth.currentUser.getIdToken(), 8000, 'Firebase ID token');
  const response = await withTimeout(fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.headers || {}),
      authorization: `Bearer ${idToken}`
    }
  }), 12000, 'learning API');
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) { const error=new Error(data && data.error ? data.error : `learning API ${response.status}`); error.status=response.status; throw error; }
  return data;
}

function outbox(){return typeof globalThis!=='undefined'?globalThis.ManjingoAnswerOutbox:null}
function retryableAnswerError(error){const status=Number(error&&error.status)||0;return !status||status===408||status===409||status===425||status===429||status>=500}
function scheduleAnswerOutboxRetry(uid){
  if(typeof window==='undefined')return;
  if(outboxRetryTimer){clearTimeout(outboxRetryTimer);outboxRetryTimer=null;}
  const box=outbox(),next=box&&box.nextDueAt(uid||currentUserId||null);if(next==null)return;
  const delay=Math.max(1000,Math.min(300000,(next||Date.now())-Date.now()));
  outboxRetryTimer=setTimeout(()=>{outboxRetryTimer=null;void flushAnswerOutbox();},delay);
}
async function sendAnswerPayload(payload){return authorizedApi('/api/submit-answer',{method:'POST',body:JSON.stringify(payload)})}
function sendAnswerOnce(payload){
  const id=String(payload&&payload.answerId||'');
  if(id&&answerInFlight.has(id))return answerInFlight.get(id);
  const promise=sendAnswerPayload(payload).finally(()=>{if(id)answerInFlight.delete(id)});
  if(id)answerInFlight.set(id,promise);return promise;
}
function applyRetriedAnswer(payload,result){
  if(!result||!result.success||typeof window==='undefined')return;
  try{const learning=window.ManjingoLocalLearning;if(learning&&typeof learning.syncRemoteResult==='function')learning.syncRemoteResult(payload.kpId,result)}catch(error){console.warn('retried answer local reconciliation unavailable:',error)}
  try{window.dispatchEvent(new CustomEvent('manjingo:answer-sync-complete',{detail:{answerId:payload.answerId,kpId:payload.kpId,duplicate:!!result.duplicate}}))}catch(_){}
}

export async function flushAnswerOutbox(options={}) {
  if(outboxFlushPromise)return outboxFlushPromise;
  outboxFlushPromise=(async()=>{
    const box=outbox();if(!box)return{synced:0,pending:0};
    const uid=options.uid||currentUserId||await ensureLogin();
    if(!uid){scheduleAnswerOutboxRetry(null);return{synced:0,pending:box.pendingCount()};}
    box.bindUnowned(uid);
    const items=box.list({uid,includeUnowned:false,dueOnly:!options.force}),synced=[];
    for(const item of items){
      try{
        const result=await sendAnswerOnce(item.payload);
        if(result&&result.success){box.remove(item.answerId);applyRetriedAnswer(item.payload,result);synced.push(item.answerId);continue;}
        throw new Error('learning API did not confirm answer');
      }catch(error){
        if(retryableAnswerError(error)){box.markFailure(item.answerId,error);break;}
        box.remove(item.answerId);console.warn('discarding permanently rejected queued answer',item.answerId,error);
      }
    }
    scheduleAnswerOutboxRetry(uid);
    return{synced:synced.length,pending:box.pendingCount(uid)};
  })().finally(()=>{outboxFlushPromise=null;});
  return outboxFlushPromise;
}

function installAnswerOutboxRetry(){
  if(typeof window==='undefined')return;
  window.addEventListener('online',()=>void flushAnswerOutbox({force:true}));
  if(typeof document!=='undefined')document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void flushAnswerOutbox();});
  setTimeout(()=>void flushAnswerOutbox({force:true}),0);
}

export async function fetchAllQuestions() {
  const content = typeof window !== 'undefined' ? window.ManjingoContent : null;
  if (content && Array.isArray(content.questions) && content.questions.length) {
    return content.questions.map(question => ({ ...question }));
  }
  console.warn('Reviewed local question catalog unavailable; refusing to fall back to legacy Firestore questions.');
  return [];
}

export async function fetchAllKnowledgePoints() {
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    return await withTimeout(firestoreModule.getDocs(firestoreModule.collection(db, "knowledgePoints")).then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }))),8000,'knowledge points read');
  } catch (error) { console.warn('knowledge points read unavailable:', error); return []; }
}

export async function fetchUserKnowledgeState(userId) {
  if (!userId) return {};
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    return await withTimeout(firestoreModule.getDocs(firestoreModule.collection(db, "users", userId, "knowledge")).then((snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))),8000,'user knowledge read');
  } catch (error) { console.warn('user knowledge read unavailable:', error); return {}; }
}

export async function fetchUserSkillState(userId) {
  if (!userId) return {};
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    return await withTimeout(firestoreModule.getDocs(firestoreModule.collection(db, "users", userId, "skills")).then((snap) => Object.fromEntries(snap.docs.map((d) => {
      const data=d.data();
      return [d.id,{...data,skillId:d.id,lastAnsweredAt:isoTimestamp(data.lastAnsweredAt),updatedAt:isoTimestamp(data.updatedAt),source:data.source||'server-native-v1'}];
    }))),8000,'skill mastery read');
  } catch (error) { console.warn('skill mastery read unavailable:', error); return {}; }
}

export async function fetchUserConceptState(userId) {
  if (!userId) return {};
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    return await withTimeout(
      firestoreModule.getDocs(firestoreModule.collection(db, "users", userId, "concepts")).then((snap) => Object.fromEntries(snap.docs.map((d) => {
        const data = d.data();
        return [d.id, { ...data, conceptKey: d.id, lastAnsweredAt: isoTimestamp(data.lastAnsweredAt), updatedAt: isoTimestamp(data.updatedAt) }];
      }))),
      8000,
      'concept mastery read'
    );
  } catch (error) { console.warn('concept mastery read unavailable:', error); return {}; }
}

export async function fetchClientSyncState(userId) {
  if (!userId) return null;
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    const snap = await withTimeout(firestoreModule.getDoc(firestoreModule.doc(db, 'users', userId, 'clientSync', 'state')),8000,'client sync read');
    if (!snap.exists()) return null;
    const data = snap.data() || {};
    return { learningState:data.learningState||null, questionRotation:data.questionRotation||null, schemaVersion:Number(data.schemaVersion)||1, updatedAt:isoTimestamp(data.updatedAt) };
  } catch (error) { console.warn('client sync read unavailable:', error); return null; }
}

export async function saveClientSyncState(userId, payload) {
  if (!userId || !payload) return false;
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    await withTimeout(firestoreModule.setDoc(firestoreModule.doc(db, 'users', userId, 'clientSync', 'state'), {
      schemaVersion:1,
      learningState:payload.learningState||{},
      questionRotation:payload.questionRotation||{},
      updatedAt:firestoreModule.serverTimestamp()
    }, { merge:true }),8000,'client sync write');
    return true;
  } catch (error) { console.warn('client sync write unavailable:', error); return false; }
}

function enrichConcept(answer) {
  if (!answer || answer.conceptKey) return answer;
  try {
    const content = window.ManjingoContent;
    const q = content && Array.isArray(content.questions) ? content.questions.find((x) => String(x.id) === String(answer.questionId) && String(x.kpId) === String(answer.kpId)) : null;
    const concept = q && q.misconceptionKey ? { key: q.misconceptionKey, label: q.misconceptionLabel } : content && typeof content.misconceptionConcept === 'function' ? content.misconceptionConcept(q || answer) : null;
    return concept ? { ...answer, conceptKey: String(concept.key), conceptLabel: String(concept.label || concept.key) } : answer;
  } catch (_) { return answer; }
}

function recordDifficultyOutcome(answer, result) {
  if (!result || !result.success || result.duplicate || typeof window === 'undefined') return null;
  const calibration = window.ManjingoDifficultyCalibration;
  if (!calibration || typeof calibration.recordAnswer !== 'function') return null;
  try { return calibration.recordAnswer({ ...answer, isCorrect:result.isCorrect===true }); }
  catch (error) { console.warn('difficulty calibration record unavailable:', error); return null; }
}

export async function submitAnswer(answer) {
  const payload = enrichConcept(answer),box=outbox(),queued=box?box.enqueue(payload,currentUserId):false;
  try {
    const uid=currentUserId||await ensureLogin();if(box&&uid)box.bindUnowned(uid);
    const result = await sendAnswerOnce(payload);
    if(box)box.remove(payload.answerId);
    recordDifficultyOutcome(payload, result);
    void flushAnswerOutbox();
    return result;
  } catch(error) {
    const retryable=retryableAnswerError(error);
    if(box&&queued){if(retryable)box.markFailure(payload.answerId,error);else box.remove(payload.answerId);}
    error.queued=!!(queued&&retryable);
    scheduleAnswerOutboxRetry(currentUserId);
    throw error;
  }
}

export async function getDueKnowledgePoints() {
  return authorizedApi('/api/due-knowledge-points');
}

export async function getDailyLearningPlan() {
  return authorizedApi('/api/daily-plan');
}

export async function fetchUserGamification(userId) {
  if (!userId) return null;
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    const snap = await withTimeout(firestoreModule.getDoc(firestoreModule.doc(db, "users", userId, "gamification", "state")),8000,'gamification read');
    return snap.exists() ? snap.data() : null;
  } catch (error) { console.warn('gamification read unavailable:', error); return null; }
}

export async function fetchUserKnowledge(userId, kpId) {
  if (!userId || !kpId) return null;
  try {
    const { firestoreModule } = await withTimeout(getFirebase(), 8000, 'Firebase SDK');
    const snap = await withTimeout(firestoreModule.getDoc(firestoreModule.doc(db, "users", userId, "knowledge", kpId)),8000,'knowledge read');
    return snap.exists() ? snap.data() : null;
  } catch (error) { console.warn('knowledge read unavailable:', error); return null; }
}

installAnswerOutboxRetry();
