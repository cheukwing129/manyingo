const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Google redirect attempts carry a short-lived per-tab pending marker',()=>{
  const source=read('public/firebase-config.js');
  assert.match(source,/manyingo_google_redirect_pending_v1/);
  assert.match(source,/GOOGLE_REDIRECT_PENDING_TTL_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(source,/sessionStorage/);
  assert.match(source,/markGoogleRedirectPending\(\)/);
  assert.match(source,/clearGoogleRedirectPending\(\)/);
});

test('silent null redirect completion becomes an explicit retryable issue',()=>{
  const source=read('public/firebase-config.js');
  assert.match(source,/const pending=hasFreshGoogleRedirectPending\(\)/);
  assert.match(source,/if\(pending&&!snapshot\.google\)/);
  assert.match(source,/auth\/redirect-result-missing/);
  assert.match(source,/Google 登入未完成，請重試/);
  assert.match(source,/export function getGoogleRedirectIssue\(\)/);
});

test('account UI surfaces redirect failure while the user remains a guest',()=>{
  const source=read('public/account-ui.js');
  assert.match(source,/function redirectMessage\(fb,state\)/);
  assert.match(source,/getGoogleRedirectIssue/);
  assert.match(source,/render\(state,redirectMessage\(fb,state\)\)/);
  assert.match(source,/onAccountChanged\(next=>render\(next,redirectMessage\(fb,next\)\)\)/);
});


test('Firebase Auth uses the app origin after the reverse proxy is available',()=>{
  const source=read('public/firebase-config.js');
  assert.match(source,/authDomain:\s*"manyingo\.pages\.dev"/);
  assert.doesNotMatch(source,/authDomain:\s*"manjingo-95d9a\.firebaseapp\.com"/);
});


test('pending Google redirect bypasses the normal 4 second account UI delay',()=>{
  const source=read('public/account-ui.js');
  assert.match(source,/function hasPendingGoogleRedirect\(\)/);
  assert.match(source,/manyingo_google_redirect_pending_v1/);
  assert.match(source,/const pendingRedirect=hasPendingGoogleRedirect\(\)/);
  assert.match(source,/setTimeout\(ready,pendingRedirect\?0:4000\)/);
  assert.match(source,/if\(pendingRedirect\)\{setTimeout\(run,0\);return\}/);
});
