(function(){
'use strict';

const knowledgePoints=[
 {kpId:'kp_virtual_wei',textId:'CROSS',type:'虛詞用法',content:'為：跨語境辨析',difficulty:2,teachable:true},
 {kpId:'kp_virtual_zhe',textId:'CROSS',type:'虛詞用法',content:'者：跨語境辨析',difficulty:2,teachable:true},
 {kpId:'kp_virtual_suo',textId:'CROSS',type:'虛詞用法',content:'所：跨語境辨析',difficulty:2,teachable:true},
 {kpId:'kp_virtual_ye',textId:'CROSS',type:'虛詞用法',content:'也：跨語境辨析',difficulty:2,teachable:true}
];

const questions=[
 {id:'tr3q001',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'liuguolun',sourceSentenceId:'sentence:liuguolun:weiguozhe-wushi-wei-suojie',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《六國論》「為國者無使為積威之所劫哉」中，第一個「為」最接近？',o:['治理','被','替','成為'],a:'治理',explanation:'「為國者」指治理國家的人；第一個「為」作動詞，意思是治理，不能和後面的被動格式「為……所……」混為一談。'},
 {id:'tr3q002',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'hongmenyan',sourceSentenceId:'sentence:hongmenyan:shui-wei-dawang-wei-ciji',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《鴻門宴》「誰為大王為此計者」中，第一個「為」最接近？',o:['替／給','被','成為','因為'],a:'替／給',explanation:'第一個「為」引出受益對象「大王」，可譯作「替／給」；整句是在問「誰替大王出了這個計策」。'},
 {id:'tr3q003',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'hongmenyan',sourceSentenceId:'sentence:hongmenyan:wushu-jin-wei-zhi-lu',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《鴻門宴》「吾屬今為之虜矣」中的「為」表示？',o:['被','替','成為','治理'],a:'被',explanation:'「為之虜」是被動結構，意思是「被他俘虜」；「為」在此引出動作施事者，表示被動。'},
 {id:'tr3q004',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'lunyu',sourceSentenceId:'sentence:lunyu:wen-gu-zhi-xin',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《論語》「溫故而知新，可以為師矣」中，「為」最接近？',o:['成為／做','被','替','因為'],a:'成為／做',explanation:'「可以為師」即「可以成為老師」；這裡「為」作動詞，表示成為某種身分。'},
 {id:'tr3q005',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'xiaoyaoyou',sourceSentenceId:'sentence:zhuangzi-xiaoyaoyou:beiming-youyu-qiming-weikun',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《莊子・逍遙遊》「北冥有魚，其名為鯤」中的「為」最接近？',o:['叫作／是','被','替','治理'],a:'叫作／是',explanation:'「其名為鯤」是說它的名字叫作「鯤」；「為」在這裡用來連接名稱與所指。'},
 {id:'tr3q006',kpId:'kp_virtual_wei',textId:'CROSS',skillIds:['fw.wei'],sourceTextId:'mengzi-lianghuiwang-shang',sourceSentenceId:'sentence:mengzi-lianghuiwang-shang:shi-buwei-fei-buneng',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《孟子・梁惠王上》「是不為也，非不能也」中的「為」最接近？',o:['做／實行','成為','被','替／給'],a:'做／實行',explanation:'句子把「不去做」和「沒有能力做」對舉；「為」在此作動詞，表示做、實行，所以「不為」是不肯採取行動，而不是不能做到。'},

 {id:'tr3q007',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'chenshe-shijia',sourceSentenceId:'sentence:chenshe:chenshengzhe-yangchengrenye',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《陳涉世家》「陳勝者，陽城人也」中的「者」主要作用是？',o:['提示判斷句的主題／主語','表示被動','表示轉折','表示疑問'],a:'提示判斷句的主題／主語',explanation:'「者……也」是常見判斷格式；「者」先提出要判定的對象「陳勝」，後面再說明其身分。'},
 {id:'tr3q008',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'shishuo',sourceSentenceId:'sentence:shishuo:shizhe-suoyi-chuandao',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《師說》「師者，所以傳道受業解惑也」中的「者」主要作用是？',o:['提示判斷句的主題「師」','表示比較','表示被動','表示時間'],a:'提示判斷句的主題「師」',explanation:'「師者……也」屬判斷句，「者」把「師」提出作為判定對象，後文說明老師的職能。'},
 {id:'tr3q009',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'quanxue',sourceSentenceId:'sentence:quanxue:jia-zhouji-zhe',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《荀子・勸學》「假舟楫者，非能水也，而絕江河」中，「者」最接近哪種作用？',o:['把「借助舟船」名詞化，指這類人','表示被動','表示轉折','表示語氣停頓而無所指'],a:'把「借助舟船」名詞化，指這類人',explanation:'「假舟楫者」可理解為「借助舟船的人」；「者」把前面的動作或特徵名詞化，用來指稱一類人。'},
 {id:'tr3q010',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'liuguolun',sourceSentenceId:'sentence:liuguolun:bulu-zhe-yi-lu-zhe-sang',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《六國論》「不賂者以賂者喪」中的兩個「者」都主要是？',o:['把前面的描述名詞化，指相關諸侯國','判斷句句末語氣詞','被動標誌','連詞'],a:'把前面的描述名詞化，指相關諸侯國',explanation:'「不賂者」指不賄賂秦國的國家，「賂者」指賄賂秦國的國家；兩個「者」都把描述轉成名詞性成分。'},
 {id:'tr3q011',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'lunyu',sourceSentenceId:'sentence:lunyu:zhi-zhi-zhe-haozhi-zhe',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《論語》「知之者不如好之者，好之者不如樂之者」中，「者」主要表示？',o:['……的人','被……','……的時候','因為……'],a:'……的人',explanation:'「知之者」「好之者」「樂之者」分別指知道它、喜好它、以它為樂的人；「者」將前面的行為名詞化並指人。'},
 {id:'tr3q012',kpId:'kp_virtual_zhe',textId:'CROSS',skillIds:['fw.zhe'],sourceTextId:'lianpo',sourceSentenceId:'sentence:lianpo:qiuren-keshi-baoqin-zhe',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《廉頗藺相如列傳》「求人可使報秦者，未得」中的「者」主要標示甚麼？',o:['定語後置，指「可使報秦的人」','被動句','判斷句句末','因果關係'],a:'定語後置，指「可使報秦的人」',explanation:'「人可使報秦者」可整理為「可使報秦者之人」；「者」標示後置的修飾語，翻譯時要還原成現代漢語次序。'},

 {id:'tr3q013',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'shishuo',sourceSentenceId:'sentence:shishuo:dao-zhi-suocun',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《師說》「道之所存，師之所存也」中的「所」主要作用是？',o:['與後面的動詞構成「所字結構」','表示被動','表示轉折','表示疑問'],a:'與後面的動詞構成「所字結構」',explanation:'「所存」把動詞「存」轉成名詞性成分，可理解為「存在的地方／所在之處」；這是典型「所＋動詞」結構。'},
 {id:'tr3q014',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'liuguolun',sourceSentenceId:'sentence:liuguolun:weiguozhe-wushi-wei-suojie',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《六國論》「為國者無使為積威之所劫哉」中的「所」屬於哪種結構？',o:['「為……所……」被動格式','「所＋動詞」單純名詞化','判斷句','賓語前置'],a:'「為……所……」被動格式',explanation:'「為積威之所劫」表示被秦國長久累積的威勢脅迫；「為……所……」合起來標示被動。'},
 {id:'tr3q015',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'lunyu',sourceSentenceId:'sentence:lunyu:ji-suo-buyu-wushi-yuren',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《論語》「己所不欲，勿施於人」中的「所不欲」最接近？',o:['自己不想要的事物／事情','自己不願去的地方','別人不想要的東西','被自己厭惡'],a:'自己不想要的事物／事情',explanation:'「所＋不欲」形成名詞性結構，指「不想要的事情或待遇」；翻譯時不必逐字把「所」譯出。'},
 {id:'tr3q016',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'hongmenyan',sourceSentenceId:'sentence:hongmenyan:suoyi-qianjiang-shouguan',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《鴻門宴》「所以遣將守關者，備他盜之出入與非常也」中的「所以……者」主要表示？',o:['……的原因','……的方法／工具','被動','比較'],a:'……的原因',explanation:'整句是在解釋派遣將領把守關口的原因；「所以……者……也」在此可理解為「之所以……是因為……」。'},
 {id:'tr3q017',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'lianpo',sourceSentenceId:'sentence:lianpo:chen-suoyi-qu-qinqi',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《廉頗藺相如列傳》「臣所以去親戚而事君者，徒慕君之高義也」中的「所以」表示？',o:['……的原因','用來……的方法','被動標誌','假設關係'],a:'……的原因',explanation:'句子是在說明「我離開親人來侍奉您」的原因；後面的「徒慕君之高義」正是原因內容。'},
 {id:'tr3q018',kpId:'kp_virtual_suo',textId:'CROSS',skillIds:['fw.suo'],sourceTextId:'chibifu',sourceSentenceId:'sentence:chibifu:zong-yiwei-zhi-suoru',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《赤壁賦》「縱一葦之所如，凌萬頃之茫然」中的「所如」最接近？',o:['所往／要去的地方','被水推動','所以如此','所擁有的東西'],a:'所往／要去的地方',explanation:'「如」有往、到的意思；「所如」即所前往之處，屬「所＋動詞」形成的名詞性結構。'},

 {id:'tr3q019',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'lianpo',sourceSentenceId:'sentence:廉頗者趙之良將也',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《廉頗藺相如列傳》「廉頗者，趙之良將也」中的「也」主要作用是？',o:['句末表判斷語氣','表示疑問','表示轉折','表示被動'],a:'句末表判斷語氣',explanation:'「者……也」構成典型判斷句；句末「也」確認「廉頗是趙國良將」這一判斷。'},
 {id:'tr3q020',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'shishuo',sourceSentenceId:'sentence:shishuo:shizhe-suoyi-chuandao',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《師說》「師者，所以傳道受業解惑也」中的「也」主要表示？',o:['句末判斷語氣','反問','被動','假設'],a:'句末判斷語氣',explanation:'句子是在判定「老師」的職能，句末「也」與前面的「者」呼應，形成判斷語氣。'},
 {id:'tr3q021',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'quanxue',sourceSentenceId:'sentence:quanxue:junzi-sheng-feiyi',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《荀子・勸學》「君子生非異也，善假於物也」中的兩個「也」主要有甚麼作用？',o:['在句末作陳述／判斷語氣標誌','都表示疑問','都表示被動','都表示轉折'],a:'在句末作陳述／判斷語氣標誌',explanation:'兩個「也」都位於分句末，分別確認「本性沒有不同」和「善於借助外物」兩項陳述。'},
 {id:'tr3q022',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'xiaoyaoyou',sourceSentenceId:'sentence:xiaoyaoyou:nanming-zhe-tianchi-ye',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《莊子・逍遙遊》「南冥者，天池也」中的「也」主要表示？',o:['判斷：南海是天然的大水池','疑問','感嘆','被動'],a:'判斷：南海是天然的大水池',explanation:'「南冥者，天池也」是「者……也」判斷格式，句末「也」確認前後兩者的判定關係。'},
 {id:'tr3q023',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'shishuo',sourceSentenceId:'sentence:shishuo:shidao-buchuan-ye-jiuyi',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《師說》「師道之不傳也久矣」中的「也」最接近哪種作用？',o:['用在句中停頓，提示前面整體作主語／話題','句末疑問','表示被動','表示因果'],a:'用在句中停頓，提示前面整體作主語／話題',explanation:'「師道之不傳也」是整體話題，後面「久矣」作說明；此處「也」位於句中，主要起停頓與提示結構的作用。'},
 {id:'tr3q024',kpId:'kp_virtual_ye',textId:'CROSS',skillIds:['fw.ye'],sourceTextId:'jian-taizong-shisi-shu',sourceSentenceId:'sentence:jian-taizong:fa-gen-qiumumao-zheye',sourceKind:'classical-canon',transferLevel:2,type:'choice',q:'《諫太宗十思疏》「斯亦伐根以求木茂，塞源而欲流長者也」中的「也」主要表示？',o:['句末作判斷／確認語氣','表示疑問','表示被動','表示時間'],a:'句末作判斷／確認語氣',explanation:'作者把前述做法判定為「砍根卻求樹茂、堵源卻求水長」一類矛盾行為；句末「也」用來確認這一判斷。'}
];

window.ManjingoQuestionPackTransfer03={
 version:'transfer-03-stage1-function-words',
 kind:'transfer-core',
 knowledgePoints,
 questions
};
})();
