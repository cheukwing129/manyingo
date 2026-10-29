const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('Firebase auth upgrades anonymous learners to Google without discarding the current account when possible',()=>{
 const source=read('public/firebase-config.js');
 assert.match(source,/new authModule\.GoogleAuthProvider\(\)/);
 assert.match(source,/linkWithPopup\(current, provider\)/);
 assert.match(source,/linkWithRedirect\(current, provider\)/);
 assert.match(source,/GoogleAuthProvider\.credentialFromError/);
 assert.match(source,/signInWithCredential\(auth, credential\)/);
 assert.match(source,/getRedirectResult\(auth\)/);
 assert.match(source,/prompt:'select_account'/);
});

test('Google account flow exposes private client synchronization storage',()=>{
 const firebase=read('public/firebase-config.js'),catalog=read('public/home-shell.js'),ui=read('public/account-ui.js');
 assert.match(firebase,/fetchClientSyncState/);
 assert.match(firebase,/saveClientSyncState/);
 assert.match(firebase,/clientSync', 'state'/);
 assert.match(catalog,/account-sync\.js/);
 assert.match(catalog,/account-ui\.js/);
 assert.match(ui,/使用 Google 同步/);
 assert.match(ui,/Google 登入尚未在 Firebase 啟用/);
 assert.match(ui,/目前網域尚未加入 Firebase 授權/);
 assert.match(ui,/body\.study-focus #accountBar/);
});

test('Firestore rules keep authoritative learning data server-only while allowing only the owner sync snapshot',()=>{
 const rules=read('firestore.rules');
 assert.match(rules,/match \/clientSync\/\{document\} \{\s*allow read, write: if request\.auth != null && request\.auth\.uid == userId;/s);
 for(const collection of ['gamification','knowledge','concepts','answerLogs']){
   const re=new RegExp('match \\/'+collection+'\\/\\{[^}]+\\} \\{[\\s\\S]*?allow write: if false;[\\s\\S]*?\\}');
   assert.match(rules,re,collection+' must remain server-authoritative');
 }
});


test('account UI handles an unavailable Firebase account subscription without an unhandled rejection',async()=>{
 const vm=require('node:vm');
 const button={};
 const bar={innerHTML:'',querySelector(){return button}};
 const document={readyState:'loading',addEventListener(){},getElementById(id){return id==='accountUiStyle'?{}:id==='accountBar'?bar:null}};
 const context={document,window:{},fakeFirebase:{async getAccountState(){return{google:false}},async onAccountChanged(){throw new Error('SDK unavailable')}}};
 context.window=context;
 vm.createContext(context);
 // Inject only the remote adapter; run the real install/render/error boundary.
 const source=read('public/account-ui.js').replace("import('./firebase-config.js')",'Promise.resolve(fakeFirebase)');
 vm.runInContext(source,context);
 assert.equal(await context.ManjingoAccountUI.install(),true);
 assert.match(bar.innerHTML,/目前使用本機模式/);
 assert.match(bar.innerHTML,/使用 Google 同步/);
 assert.doesNotMatch(bar.innerHTML,/ disabled/);
});
