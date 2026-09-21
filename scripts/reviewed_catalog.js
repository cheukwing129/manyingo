const fs=require('fs');
const path=require('path');
const vm=require('vm');

const RUNTIME_FILES=[
 'question-pack-02.js','question-pack-03.js','question-pack-lesson.js','question-pack-capacity-01.js',
 'question-pack-transfer-01.js','question-pack-transfer-03.js','question-pack-transfer-04.js','question-pack-transfer-05.js','question-pack-transfer-06.js','question-pack-transfer-07.js','question-pack-settext-language-01.js','question-pack-settext-language-02.js','question-pack-fill-01.js','question-pack-reorder-01.js','question-pack-translation-order-01.js',
 'content-catalog.js','curriculum-v1.js','question-metadata-v1.js','question-pack-adaptive-01.js','question-pack-adaptive-02.js','question-pack-adaptive-03.js','difficulty-calibration.js','question-difficulty.js'
];

function loadReviewedCatalog(projectRoot=path.join(__dirname,'..')){
 const context={window:{},Map,Set,Array,Object,Number,String,Math,RegExp,Date,JSON};
 vm.createContext(context);
 for(const file of RUNTIME_FILES){
  const source=fs.readFileSync(path.join(projectRoot,'public',file),'utf8');
  vm.runInContext(source,context,{filename:file});
 }
 const catalog=context.ManjingoContent||context.window.ManjingoContent,metadata=context.ManjingoQuestionMetadataV1||context.window.ManjingoQuestionMetadataV1;
 if(!catalog||!Array.isArray(catalog.questions)||!Array.isArray(catalog.knowledgePoints))throw new Error('Reviewed content catalog failed to load');
 if(!metadata||typeof metadata.annotateAll!=='function')throw new Error('Reviewed question metadata failed to load');
 catalog.questions=metadata.annotateAll(catalog.questions).map(question=>({...question,skillContractVersion:'question-skill-contract-v1'}));
 return catalog;
}

module.exports={RUNTIME_FILES,loadReviewedCatalog};
