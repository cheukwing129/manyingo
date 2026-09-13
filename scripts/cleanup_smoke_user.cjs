const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');

const root = path.join(__dirname, '..');
const stateFile = process.env.MANJINGO_SMOKE_STATE_FILE || path.join(root, '.manjingo-smoke-user.json');

if (!fs.existsSync(stateFile)) {
  console.log('✓ no temporary smoke user manifest; nothing to clean');
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const uid = String(state.uid || '');
if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) throw new Error('Invalid smoke cleanup uid');

const rawCredential = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!rawCredential) throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_MANJINGO cleanup credential');
let serviceAccount;
try { serviceAccount = JSON.parse(rawCredential); }
catch (_) { throw new Error('Invalid Firebase service-account JSON for smoke cleanup'); }

const functionsRequire = createRequire(path.join(root, 'functions', 'package.json'));
const { initializeApp, cert } = functionsRequire('firebase-admin/app');
const { getAuth } = functionsRequire('firebase-admin/auth');
const { getFirestore } = functionsRequire('firebase-admin/firestore');

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id || 'manjingo-95d9a' });

(async () => {
  const failures = [];
  const db = getFirestore();
  try {
    await db.recursiveDelete(db.collection('users').doc(uid));
    console.log('✓ temporary smoke Firestore learning data deleted');
  } catch (error) {
    failures.push(`Firestore cleanup: ${error.message || error}`);
    console.error(`⚠ temporary smoke Firestore cleanup deferred for uid ${uid}: ${error.message || error}`);
  }
  try {
    await getAuth().deleteUser(uid);
    console.log('✓ temporary anonymous Firebase user deleted');
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') console.log('✓ temporary Firebase Auth user already absent');
    else failures.push(`Auth cleanup: ${error.message || error}`);
  }
  if (failures.length) throw new Error(failures.join('; '));
  fs.unlinkSync(stateFile);
})().catch(error => {
  console.error(`❌ smoke cleanup incomplete for uid ${uid}: ${error.message || error}`);
  console.error('The cleanup manifest was retained so Firestore cleanup can be retried safely.');
  process.exitCode = 1;
});
