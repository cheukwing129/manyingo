(function(root,factory){
'use strict';
let curriculum=root&&root.ManjingoCurriculumV1;
if(typeof module==='object'&&module.exports){
  curriculum=require('./curriculum-v1.js');
  module.exports=factory(curriculum);
  return;
}
root.ManjingoQuestionMetadataV1=factory(curriculum);
})(typeof globalThis!=='undefined'?globalThis:this,function(curriculum){
'use strict';

const VERSION='question-metadata-v1';

const QUESTION_OVERRIDES={
 p2q001:{mode:'core',skillIds:['lex.context-inference']},
 p2q002:{mode:'core',skillIds:['trans.integrated']},
 p2q003:{mode:'core',skillIds:['lex.polysemy']},
 p2q004:{mode:'core',skillIds:['lex.polysemy']},
 p2q008:{mode:'core',skillIds:['lex.context-inference']},
 p2q009:{mode:'core',skillIds:['lex.polysemy']},
 p2q013:{mode:'core',skillIds:['lex.polysemy']},
 p2q015:{mode:'core',skillIds:['lex.context-inference']},
 p2q016:{mode:'core',skillIds:['lex.polysemy']},
 p2q018:{mode:'core',skillIds:['lex.context-inference']},
 p2q027:{mode:'core',skillIds:['lex.context-inference']},
 p2q029:{mode:'core',skillIds:['fw.yu']},
 p2q031:{mode:'core',skillIds:['read.referent-tracking']},
 p2q034:{mode:'core',skillIds:['lex.causative']},
 p2q041:{mode:'core',skillIds:['lex.ancient-modern']},
 p2q043:{mode:'core',skillIds:['lex.context-inference']},
 p2q057:{mode:'core',skillIds:['lex.context-inference']},
 p2q058:{mode:'core',skillIds:['lex.ancient-modern']},
 p2q060:{mode:'core',skillIds:['lex.polysemy']},
 p2q065:{mode:'core',skillIds:['lex.polysemy']},
 p2q071:{mode:'core',skillIds:['syn.object-fronting']},
 p2q072:{mode:'core',skillIds:['syn.object-fronting']},
 p2q085:{mode:'core',skillIds:['lex.word-class-shift']},
 p2q089:{mode:'core',skillIds:['lex.polysemy']},
 p2q095:{mode:'core',skillIds:['lex.polysemy']},
 cap1q018:{mode:'core',skillIds:['read.referent-tracking']},
 cap1q025:{mode:'core',skillIds:['fw.nai']},
 cap1q026:{mode:'core',skillIds:['fw.qi','read.referent-tracking']},
 cap1q027:{mode:'core',skillIds:['lex.polysemy']},
 cap1q028:{mode:'core',skillIds:['lex.polysemy']}
};

const SOURCE_TEXT_OVERRIDES={
 q004:'chenshe-shijia',
 q005:'lianpo-linxiangru',
 p3q001:'chenshe-shijia',
 p3q003:'caogui',
 p3q005:'lunyu',
 p3q006:'yuwosuoyu',
 p3q007:'hezhouji',
 p3q009:'yueyanglou',
 p3q010:'tongqu',
 p3q011:'yueyanglou',
 p3q013:'quanxue',
 p3q014:'quanxue',
 p3q015:'shengyouhuan',
 p3q018:'maqianlishuo',
 p3q019:'maqianlishuo',
 p3q021:'lianpo-linxiangru',
 p3q022:'chenshe-shijia',
 p3q025:'lianpo-linxiangru',
 p3q026:'liuguolun',
 p3q027:'lingguanzhuanxu',
 p3q029:'yueyanglou',
 p3q030:'loushiming',
 p3q032:'loushiming',
 p3q034:'caogui',
 p3q038:'caogui',
 p3q041:'yueyanglou',
 lpq005:'ailianshuo',
 lpq006:'caogui',
 lpq007:'zuiwengtingji',
 lpq008:'lunyu',
 lpq009:'caogui',
 lpq010:'lang',
 lpq011:'xiaoshitan',
 lpq012:'chushibiao',
 lpq013:'caogui',
 lpq014:'liji-tangong',
 lpq015:'yugong-yishan',
 lpq016:'yugong-yishan',
 lpq017:'maqianlishuo',
 lpq020:'lunyu',
 lpq021:'yueyanglou',
 lpq066:'shengyouhuan',
 lpq036:'lianpo-linxiangru',
 lpq037:'quyuan-liezhuan',
 lpq039:'lingguanzhuanxu',
 lpq040:'shishuo',
 lpq042:'caogui',
 lpq043:'taohuayuan',
 lpq045:'loushiming',
 lpq059:'shengyouhuan',
 lpq063:'yuwosuoyu',
 lpq064:'longzhongdui',
 lpq065:'shizhongshanji',
 lpq047:'hongmenyan',
 p3q045:'shengyouhuan',
 p3q046:'yuwosuoyu',
 lpq061:'yuwosuoyu',
 lpq055:'shengyouhuan',
 cap1q010:'taohuayuan',
 cap1q012:'hezhouji',
 cap1q022:'shishuo',
 cap1q023:'shishuo',
 ad1q001:'ailianshuo',
 ad1q002:'chenshe-shijia',
 ad1q004:'lunyu',
 ad1q005:'zuiwengtingji',
 ad1q007:'lang',
 ad1q008:'xiaoshitan',
 ad1q010:'zouji',
 ad1q011:'shengyouhuan',
 ad1q014:'maqianlishuo',
 ad1q015:'maqianlishuo',
 ad1q016:'lunyu',
 ad1q017:'yueyanglou',
 ad1q022:'lianpo-linxiangru',
 ad1q033:'caogui',
 ad3q002:'yueyanglou'
};

const SOURCE_SENTENCE_GROUPS={
 q001:'sentence:yueyanglou:tengzijing-zhe-shou-baling',
 cap1q001:'sentence:yueyanglou:tengzijing-zhe-shou-baling',
 cap1q002:'sentence:yueyanglou:tengzijing-zhe-shou-baling',
 cap1q003:'sentence:yueyanglou:tengzijing-zhe-shou-baling',
 q008:'sentence:yueyanglou:xianyou-houle',
 cap1q004:'sentence:yueyanglou:xianyou-houle',
 cap1q005:'sentence:yueyanglou:xianyou-houle',
 cap1q006:'sentence:yueyanglou:xianyou-houle',
 lpq053:'sentence:yueyanglou:xianyou-houle',
 ad3q002:'sentence:yueyanglou:xianyou-houle',
 q006:'sentence:yueyanglou:wei-siren-wushuiyugui',
 q010:'sentence:yueyanglou:wei-siren-wushuiyugui',
 cap1q013:'sentence:yueyanglou:wei-siren-wushuiyugui',
 cap1q014:'sentence:yueyanglou:wei-siren-wushuiyugui',
 cap1q015:'sentence:yueyanglou:wei-siren-wushuiyugui',
 p3q029:'sentence:yueyanglou:wei-siren-wushuiyugui',
 p3q041:'sentence:yueyanglou:wei-siren-wushuiyugui',
 p3q009:'sentence:yueyanglou:buyi-wuxi-jibei',
 lpq052:'sentence:yueyanglou:buyi-wuxi-jibei',
 p2q071:'sentence:loushiming:helouzhiyou',
 p2q072:'sentence:loushiming:helouzhiyou',
 lpq045:'sentence:loushiming:helouzhiyou',
 p3q030:'sentence:loushiming:helouzhiyou',
 p3q025:'sentence:lianpo-linxiangru:tu-jian-qi',
 lpq036:'sentence:lianpo-linxiangru:tu-jian-qi',
 ad1q022:'sentence:lianpo-linxiangru:tu-jian-qi',
 ad1q033:'sentence:caogui:heyi-zhan'
};

const DSE_SET_TEXT_IDS=new Set([
 'lunyu','yuwosuoyu','xiaoyaoyou','quanxue','lianpo-linxiangru','chushibiao',
 'shishuo','shidexishan','yueyanglou','liuguolun','tangshi-sanshou','songci-sanshou'
]);
const DSE_SET_TEXT_ALIASES=new Map([
 ['lianpo','lianpo-linxiangru'],
 ['xunzi-quanxue-stage3','quanxue']
]);
const LEGACY_SET_TEXT_IDS=new Set([
 'yueyanglou','chushibiao','yuwosuoyu','shengyouhuan','caogui','zouji',
 'taohuayuan','loushiming','ailianshuo','maqianlishuo','xiaoshitan'
]);
const SET_TEXT_IDS=new Set([...DSE_SET_TEXT_IDS,...LEGACY_SET_TEXT_IDS,...DSE_SET_TEXT_ALIASES.keys()]);
const CORE_ACTIONS=new Set(['retain','refactor','merge']);
const SOURCE_KINDS=new Set(['set-text','classical-canon','historical','constructed','mixed']);
const DIFFICULTY_TIERS=new Set(['foundation','application','transfer']);
const SOURCE_SCOPES=new Set(['sentence','passage','concept','cross-source']);
const SOURCE_SCOPE_OVERRIDES={
 p2q012:'passage',
 p2q023:'passage',
 p2q038:'passage',
 p2q044:'passage',
 p2q056:'passage',
 p2q091:'passage',
 p3q004:'cross-source',
 p3q012:'cross-source',
 lpq038:'concept',
 lpq041:'cross-source',
 lpq055:'passage',
 lpq057:'concept',
 cap1q011:'cross-source',
 cap1q018:'passage',
 ad1q003:'cross-source',
 ad1q006:'cross-source',
 ad1q009:'cross-source',
 ad1q012:'cross-source',
 ad1q018:'cross-source',
 ad1q021:'cross-source',
 ad1q024:'cross-source',
 ad1q027:'cross-source',
 ad1q030:'cross-source',
 ad2q001:'cross-source',
 ad2q002:'cross-source',
 ad2q003:'cross-source',
 ad2q004:'cross-source',
 ad2q006:'cross-source',
 ad2q007:'cross-source',
 ad2q008:'cross-source',
 ad2q009:'cross-source',
 ad2q010:'cross-source',
 ad2q011:'cross-source',
 ad2q012:'cross-source',
 ad2q013:'cross-source',
 ad2q014:'cross-source',
 ad2q015:'cross-source',
 ad2q016:'cross-source',
 ad2q019:'cross-source',
 ad2q020:'cross-source',
 ad2q021:'cross-source',
 ad2q023:'cross-source',
 ad2q024:'cross-source',
 ad2q025:'concept',
 ad2q026:'cross-source',
 ad2q027:'cross-source',
 ad3q001:'cross-source',
 ad3q003:'cross-source',
 ad3q004:'cross-source',
 ad3q005:'cross-source',
 ad3q006:'cross-source'
};

function canonicalDseSetTextId(value){const id=String(value||'');return DSE_SET_TEXT_ALIASES.get(id)||id;}
function isDseSetTextId(value){return DSE_SET_TEXT_IDS.has(canonicalDseSetTextId(value));}
function migrationFor(kpId){
  if(!curriculum)return null;
  if(typeof curriculum.migrationFor==='function')return curriculum.migrationFor(kpId);
  return curriculum.migration&&curriculum.migration[String(kpId)]||null;
}
function skillStage(skillId){
  if(!curriculum)return 0;
  const definition=typeof curriculum.skill==='function'?curriculum.skill(skillId):Array.isArray(curriculum.skills)?curriculum.skills.find(x=>String(x.id)===String(skillId)):null;
  return Number(definition&&definition.stage)||0;
}

function normalizeSentence(value){
  return String(value||'').replace(/[\s\u3000，。！？；：、,.!?;:“”"'（）()《》〈〉【】\[\]—…]/g,'').toLowerCase();
}

function quotedSegments(text){
  const source=String(text||''),out=[];
  const re=/「([^」]+)」/g;
  let match;
  while((match=re.exec(source)))if(match[1])out.push(match[1]);
  return out;
}

function inferSourceSentenceId(question){
  const explicit=String(question&&question.sourceSentenceId||'');
  if(explicit)return explicit;
  const id=String(question&&question.id||'');
  if(SOURCE_SENTENCE_GROUPS[id])return SOURCE_SENTENCE_GROUPS[id];
  if(SOURCE_SCOPE_OVERRIDES[id]&&SOURCE_SCOPE_OVERRIDES[id]!=='sentence')return null;
  const segments=quotedSegments(question&&question.q);
  if(!segments.length)return null;
  const longest=segments.slice().sort((a,b)=>normalizeSentence(b).length-normalizeSentence(a).length)[0];
  const normalized=normalizeSentence(longest);
  return normalized.length>=4?'sentence:'+normalized:null;
}

function resolvedSourceTextId(question){
  const explicit=String(question&&question.sourceTextId||'');
  if(explicit)return explicit;
  const id=String(question&&question.id||'');
  return SOURCE_TEXT_OVERRIDES[id]||String(question&&question.textId||'')||null;
}

function resolvedSourceScope(question){
  const explicit=String(question&&question.sourceScope||'');
  if(SOURCE_SCOPES.has(explicit))return explicit;
  const id=String(question&&question.id||'');
  if(SOURCE_SCOPE_OVERRIDES[id])return SOURCE_SCOPE_OVERRIDES[id];
  if(inferSourceSentenceId(question))return'sentence';
  const sourceTextId=resolvedSourceTextId(question);
  if((question&&(question.passageId||question.passageText))||(sourceTextId&&sourceTextId!=='CROSS'))return'passage';
  return'concept';
}

function inferSourceKind(question){
  const explicit=String(question&&question.sourceKind||'');
  if(SOURCE_KINDS.has(explicit))return explicit;
  const sourceTextId=resolvedSourceTextId(question);
  if(!sourceTextId||sourceTextId==='CROSS')return'mixed';
  return isDseSetTextId(sourceTextId)||LEGACY_SET_TEXT_IDS.has(sourceTextId)?'set-text':'classical-canon';
}

function resolvedDifficultyTier(question){
  const explicit=String(question&&question.difficultyTier||'');
  return DIFFICULTY_TIERS.has(explicit)?explicit:'application';
}

function defaultTransferLevel(question,mode){
  const explicit=Number(question&&question.transferLevel);
  if(Number.isInteger(explicit)&&explicit>=0)return explicit;
  if(mode!=='core')return 0;
  return String(question&&question.textId||'')==='CROSS'?1:0;
}

function classify(question){
  const id=String(question&&question.id||'');
  const kpId=String(question&&question.kpId||'');
  const override=QUESTION_OVERRIDES[id]||null;
  const migration=migrationFor(kpId);
  const explicitSkills=Array.isArray(question&&question.skillIds)?question.skillIds.map(String).filter(Boolean):[];
  let mode='unmapped',skillIds=[];
  if(override){
    mode=override.mode;
    skillIds=override.skillIds.slice();
  }else if(migration){
    skillIds=explicitSkills.length?explicitSkills:(Array.isArray(migration.targetSkillIds)?migration.targetSkillIds.slice():[]);
    if(CORE_ACTIONS.has(migration.action))mode='core';
    else if(migration.action==='advanced-reading')mode='advanced';
    else if(migration.action==='optional-set-text')mode='set-text';
  }else if(explicitSkills.length){
    mode=explicitSkills.some(skillId=>skillStage(skillId)>=3)?'advanced':'core';
    skillIds=explicitSkills;
  }
  return{
    curriculumMode:mode,
    skillIds,
    normalCore:mode==='core',
    sourceTextId:resolvedSourceTextId(question),
    legacyTextId:String(question&&question.textId||'')||null,
    sourceSentenceId:inferSourceSentenceId(question),
    sourceScope:resolvedSourceScope(question),
    sourceKind:inferSourceKind(question),
    transferLevel:defaultTransferLevel(question,mode),
    difficultyTier:resolvedDifficultyTier(question)
  };
}

function annotate(question){return{...question,...classify(question)}}
function annotateAll(questions){return(Array.isArray(questions)?questions:[]).map(annotate)}
function normalCoreQuestions(questions){return annotateAll(questions).filter(q=>q.normalCore)}

function audit(questions){
  const annotated=annotateAll(questions),byMode={},bySkill={},bySourceText={},bySourceScope={};
  for(const q of annotated){
    byMode[q.curriculumMode]=(byMode[q.curriculumMode]||0)+1;
    const source=q.sourceTextId||'UNKNOWN';
    bySourceText[source]=(bySourceText[source]||0)+1;
    bySourceScope[q.sourceScope]=(bySourceScope[q.sourceScope]||0)+1;
    for(const skillId of q.skillIds)bySkill[skillId]=(bySkill[skillId]||0)+1;
  }
  return{total:annotated.length,byMode,bySkill,bySourceText,bySourceScope};
}

return{
  VERSION,
  QUESTION_OVERRIDES,
  SOURCE_TEXT_OVERRIDES,
  SOURCE_SENTENCE_GROUPS,
  DSE_SET_TEXT_IDS,
  DSE_SET_TEXT_ALIASES,
  LEGACY_SET_TEXT_IDS,
  SET_TEXT_IDS,
  SOURCE_KINDS,
  DIFFICULTY_TIERS,
  SOURCE_SCOPES,
  SOURCE_SCOPE_OVERRIDES,
  canonicalDseSetTextId,
  isDseSetTextId,
  normalizeSentence,
  quotedSegments,
  inferSourceSentenceId,
  resolvedSourceTextId,
  resolvedSourceScope,
  resolvedDifficultyTier,
  classify,
  annotate,
  annotateAll,
  normalCoreQuestions,
  audit
};
});
