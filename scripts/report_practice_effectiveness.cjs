'use strict';

const fs=require('fs');
const path=require('path');
const {createRequire}=require('module');
const {buildEffectivenessReport,toMarkdown,DEFAULTS}=require('./practice_effectiveness_report_lib.cjs');

const root=path.join(__dirname,'..');
const functionsRequire=createRequire(path.join(root,'functions','package.json'));
const {initializeApp,applicationDefault,getApps}=functionsRequire('firebase-admin/app');
const {getFirestore,Timestamp}=functionsRequire('firebase-admin/firestore');

function parseArgs(argv){
  const args={jsonPath:null,markdownPath:null,days:DEFAULTS.days,minEpisodes:DEFAULTS.minEpisodes,minLearners:DEFAULTS.minLearners};
  for(let i=2;i<argv.length;i++){
    const token=argv[i];
    if(token==='--json')args.jsonPath=argv[++i];
    else if(token==='--markdown')args.markdownPath=argv[++i];
    else if(token==='--days')args.days=Number(argv[++i]);
    else if(token==='--min-episodes')args.minEpisodes=Number(argv[++i]);
    else if(token==='--min-learners')args.minLearners=Number(argv[++i]);
    else throw new Error(`Unknown argument: ${token}`);
  }
  for(const [key,value] of [['days',args.days],['minEpisodes',args.minEpisodes],['minLearners',args.minLearners]])if(!Number.isInteger(value)||value<1)throw new Error(`--${key.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())} must be a positive integer`);
  return args;
}
function ensureParent(file){if(file)fs.mkdirSync(path.dirname(path.resolve(file)),{recursive:true});}
function learnerIdFrom(doc){return doc&&doc.ref&&doc.ref.parent&&doc.ref.parent.parent?doc.ref.parent.parent.id:'unknown';}
function practiceKey(row){return `${row.learnerId}|${String(row.data&&row.data.practiceId||'')}`;}
async function loadRows(days){
  if(!getApps().length)initializeApp({credential:applicationDefault(),projectId:process.env.FIREBASE_PROJECT_ID||'manjingo-95d9a'});
  const db=getFirestore(),now=Date.now(),answerSince=Timestamp.fromMillis(now-(days+DEFAULTS.lookbackDays)*86400000),practiceSince=Timestamp.fromMillis(now-days*86400000);
  const [practiceSnap,answerSnap]=await Promise.all([
    db.collectionGroup('practiceSessions').where('completedAt','>=',practiceSince).get(),
    db.collectionGroup('answerLogs').where('answeredAt','>=',answerSince).get()
  ]);
  const answers=answerSnap.docs.map(doc=>({learnerId:learnerIdFrom(doc),data:doc.data()}));
  const practices=[],seen=[];
  for(const row of [...practiceSnap.docs.map(doc=>({learnerId:learnerIdFrom(doc),data:doc.data()})),...answers.filter(row=>row.data&&row.data.practiceSession).map(row=>({learnerId:row.learnerId,data:row.data.practiceSession}))]){
    const key=practiceKey(row);if(!row.data||!row.data.practiceId||seen.includes(key))continue;seen.push(key);practices.push(row);
  }
  return{practices,answers};
}
async function main(){
  const args=parseArgs(process.argv),rows=await loadRows(args.days),report=buildEffectivenessReport(rows.practices,rows.answers,{days:args.days,minEpisodes:args.minEpisodes,minLearners:args.minLearners}),markdown=toMarkdown(report);
  console.log(markdown.trimEnd());
  if(args.jsonPath){ensureParent(args.jsonPath);fs.writeFileSync(args.jsonPath,JSON.stringify(report,null,2)+'\n');}
  if(args.markdownPath){ensureParent(args.markdownPath);fs.writeFileSync(args.markdownPath,markdown);}
}
main().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
