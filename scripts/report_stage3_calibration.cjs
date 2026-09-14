'use strict';

const fs=require('fs');
const path=require('path');
const {createRequire}=require('module');
const {buildCalibrationReport,toMarkdown}=require('./stage3_calibration_report_lib.cjs');

const root=path.join(__dirname,'..');
const functionsRequire=createRequire(path.join(root,'functions','package.json'));
const {initializeApp,applicationDefault,getApps}=functionsRequire('firebase-admin/app');
const {getFirestore}=functionsRequire('firebase-admin/firestore');

function parseArgs(argv){
  const args={jsonPath:null,markdownPath:null,minEvents:20,minLearners:10};
  for(let i=2;i<argv.length;i++){
    const token=argv[i];
    if(token==='--json')args.jsonPath=argv[++i];
    else if(token==='--markdown')args.markdownPath=argv[++i];
    else if(token==='--min-events')args.minEvents=Number(argv[++i]);
    else if(token==='--min-learners')args.minLearners=Number(argv[++i]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  if(!Number.isInteger(args.minEvents)||args.minEvents<1)throw new Error('--min-events must be a positive integer');
  if(!Number.isInteger(args.minLearners)||args.minLearners<1)throw new Error('--min-learners must be a positive integer');
  return args;
}
function ensureParent(file){if(file)fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});}
async function loadRows(){
  if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||'manjingo-95d9a'});
  const db=getFirestore();
  const snapshot=await db.collectionGroup('stage3Calibrations').get();
  return snapshot.docs.map(doc=>({learnerId:doc.ref.parent.parent?doc.ref.parent.parent.id:'unknown',data:doc.data()}));
}
async function main(){
  const args=parseArgs(process.argv),rows=await loadRows(),report=buildCalibrationReport(rows,args),markdown=toMarkdown(report);
  console.log(markdown.trimEnd());
  console.log(`\nMap versions: ${JSON.stringify(report.mapVersions)}`);
  if(args.jsonPath){ensureParent(args.jsonPath);fs.writeFileSync(args.jsonPath,JSON.stringify(report,null,2)+'\n');}
  if(args.markdownPath){ensureParent(args.markdownPath);fs.writeFileSync(args.markdownPath,markdown);}
}

main().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
