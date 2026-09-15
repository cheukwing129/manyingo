const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const{pathToFileURL}=require('node:url');
const workerPath=path.join(__dirname,'..','public','_worker.js');
const source=fs.readFileSync(workerPath,'utf8');
let modulePromise=null;
function loadWorker(){
 if(!modulePromise)modulePromise=import(pathToFileURL(workerPath).href);
 return modulePromise;
}

test('advanced-mode worker parses as an ES module and preserves static asset delivery',async()=>{
 const mod=await loadWorker();
 assert.equal(typeof mod.default.fetch,'function');
 let forwarded=null;
 const response=await mod.default.fetch(new Request('https://manjingo.pages.dev/lesson.html'),{ASSETS:{fetch(request){forwarded=new URL(request.url).pathname;return new Response('asset')}}});
 assert.equal(forwarded,'/lesson.html');
 assert.equal(await response.text(),'asset');
});

test('learning API rejects unauthenticated requests before Firestore access',async()=>{
 const mod=await loadWorker();
 const response=await mod.default.fetch(new Request('https://manjingo.pages.dev/api/daily-plan'),{});
 assert.equal(response.status,401);
 const body=await response.json();
 assert.match(body.error,/Firebase ID token/);
});

test('health endpoint reports learning and practice policy without exposing credentials',async()=>{
 const mod=await loadWorker();
 const response=await mod.default.fetch(new Request('https://manjingo.pages.dev/api/health'),{FIREBASE_PROJECT_ID:'manjingo-95d9a'});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.equal(body.ok,true);
 assert.equal(body.configured,false);
 assert.equal(body.firestoreProject,'manjingo-95d9a');
 assert.equal(body.learningPolicy,'shared-v1');
 assert.equal(body.practicePolicy,'server-practice-v1');
 assert.equal(body.questionIndexPolicy,'reviewed-v4');
 assert.ok(body.questionIndexCount>=450);
 assert.equal(JSON.stringify(body).includes('PRIVATE KEY'),false);
});

test('worker verifies Firebase token audience issuer expiry and RS256 signature',()=>{
 assert.match(source,/payload\.aud !== pid/);
 assert.match(source,/payload\.iss !== `https:\/\/securetoken\.google\.com\/\$\{pid\}`/);
 assert.match(source,/Number\(payload\.exp\) <= now/);
 assert.match(source,/header\.alg !== 'RS256'/);
 assert.match(source,/crypto\.subtle\.verify/);
 assert.match(source,/FIREBASE_JWKS/);
});

test('worker uses encrypted service credentials to obtain datastore OAuth and writes in a Firestore transaction',()=>{
 assert.match(source,/FIREBASE_CLIENT_EMAIL/);
 assert.match(source,/FIREBASE_PRIVATE_KEY/);
 assert.match(source,/https:\/\/www\.googleapis\.com\/auth\/datastore/);
 assert.match(source,/documents:beginTransaction/);
 assert.match(source,/documents:commit/);
 assert.match(source,/documents:rollback/);
 assert.match(source,/answerLogs\/\$\{answer\.answerId\}/);
});

test('practice API persists idempotent sessions and server-computed intervention state',()=>{
 const client=fs.readFileSync(path.join(__dirname,'..','public','practice-api.js'),'utf8');
 assert.match(source,/import '\.\/server-practice-state\.js'/);
 assert.match(source,/url\.pathname === '\/api\/practice-session'/);
 assert.match(source,/url\.pathname === '\/api\/practice-state'/);
 assert.match(source,/practiceSessions\/\$\{session\.practiceId\}/);
 assert.match(source,/interventions\/\$\{session\.skillId\}/);
 assert.match(source,/SERVER_PRACTICE\.buildIntervention/);
 assert.match(source,/allowed\.includes\(session\.skillId\)/);
 assert.match(source,/duplicate:true/);
 assert.match(client,/authorized\('\/api\/practice-session'/);
 assert.match(client,/authorized\('\/api\/practice-state'/);
});

test('daily plan reads authoritative interventions alongside native skill mastery',()=>{
 assert.match(source,/timed\(trace,'interventions_list'/);
 assert.match(source,/users\/\$\{uid\}\/interventions/);
 assert.match(source,/buildPlan\(\{knowledge,skills,concepts,interventions,kpUniverse:kpUniverseDocs/);
});

test('Pages config exposes only project id as a non-secret binding',()=>{
 const wrangler=fs.readFileSync(path.join(__dirname,'..','wrangler.toml'),'utf8');
 const ignore=fs.readFileSync(path.join(__dirname,'..','.gitignore'),'utf8');
 assert.match(wrangler,/FIREBASE_PROJECT_ID = "manjingo-95d9a"/);
 assert.doesNotMatch(wrangler,/PRIVATE_KEY|CLIENT_EMAIL/);
 assert.match(ignore,/\.dev\.vars\*/);
 assert.match(ignore,/\.env\*/);
});
