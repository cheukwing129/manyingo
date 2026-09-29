const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const stage3=require('../public/stage3-reading.js');
const packSource=fs.readFileSync(path.join(__dirname,'..','public','question-pack-transfer-07.js'),'utf8');
function loadPack(){const context={window:{},Array,Object,Number,String,Math,Set,Map};vm.createContext(context);vm.runInContext(packSource,context);return context.window.ManjingoQuestionPackTransfer07;}

test('Stage 3 challenge recognises the three advanced passage skills only',()=>{
 const pack=loadPack();
 assert.equal(pack.questions.length,36);
 assert.equal(pack.questions.every(stage3.isStage3Question),true);
 assert.equal(stage3.isStage3Question({transferLevel:2,skillIds:['read.argumentation']}),false);
 assert.equal(stage3.isStage3Question({transferLevel:3,skillIds:['read.context-clues']}),false);
});

test('each Stage 3 skill has twelve questions across at least five source texts',()=>{
 const pack=loadPack();
 for(const skill of stage3.SKILLS){
  const questions=pack.questions.filter(q=>stage3.skillId(q)===skill.id);
  assert.equal(questions.length,12,skill.id+' should have twelve questions');
  assert.ok(new Set(questions.map(q=>q.sourceTextId)).size>=5,skill.id+' should use at least five source texts');
  const sourceCounts=new Map();
  questions.forEach(q=>sourceCounts.set(q.sourceTextId,(sourceCounts.get(q.sourceTextId)||0)+1));
  assert.ok(Math.max(...sourceCounts.values())<=3,skill.id+' should cap one source at 25% of the pool');
 }
});

test('each challenge draws two questions from each Stage 3 skill and rotates the 36-question pool',()=>{
 const pack=loadPack(),runs=[];let cursors={};
 for(let i=0;i<6;i+=1){const built=stage3.buildChallenge(pack.questions,cursors,2);runs.push(built);cursors=built.nextCursors;}
 for(const run of runs){
  assert.equal(run.questions.length,6);
  const counts=new Map(stage3.SKILLS.map(skill=>[skill.id,0]));
  run.questions.forEach(q=>counts.set(stage3.skillId(q),counts.get(stage3.skillId(q))+1));
  for(const skill of stage3.SKILLS)assert.equal(counts.get(skill.id),2,skill.id+' should contribute two questions');
 }
 const ids=runs.flatMap(run=>run.questions).map(q=>q.id);
 assert.equal(new Set(ids).size,36,'six consecutive runs should cover all thirty-six Stage 3 questions before repeating');
});

test('Stage 3 summary reports overall and per-skill performance',()=>{
 const attempts=[
  {skillId:'read.argumentation',correct:true},{skillId:'read.argumentation',correct:false},
  {skillId:'transfer.short-passage',correct:true},{skillId:'transfer.short-passage',correct:true},
  {skillId:'transfer.mixed',correct:false},{skillId:'transfer.mixed',correct:false}
 ],summary=stage3.summarizeResults(attempts),bySkill=new Map(summary.rows.map(row=>[row.skillId,row]));
 assert.equal(summary.correct,3);assert.equal(summary.total,6);assert.equal(summary.accuracy,50);
 assert.deepEqual({correct:bySkill.get('read.argumentation').correct,total:bySkill.get('read.argumentation').total,accuracy:bySkill.get('read.argumentation').accuracy},{correct:1,total:2,accuracy:50});
 assert.equal(bySkill.get('transfer.short-passage').accuracy,100);
 assert.equal(bySkill.get('transfer.mixed').accuracy,0);
});

test('Stage 3 motion gives brief feedback and respects reduced-motion preference',()=>{
 const css=stage3.MOTION_CSS,source=fs.readFileSync(path.join(__dirname,'..','public','stage3-reading.js'),'utf8');
 assert.match(css,/stage3-question-enter 180ms/);
 assert.match(css,/stage3-feedback-in 160ms/);
 assert.match(css,/stage3-score-in 200ms/);
 assert.match(css,/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
 assert.match(css,/animation:none!important/);
 assert.match(source,/class="stage3-question-motion"/);
});

test('home shell is wired to load the Stage 3 module without adding a fifth primary tab',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','public','home-shell.js'),'utf8'),html=fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
 assert.match(source,/stage3-reading\.js/);
 assert.match(source,/loadStage3Reading/);
 assert.equal((html.match(/data-home-tab=/g)||[]).length,4);
});
