(function(){
'use strict';
const questions=[
 {id:'ad1q001',kpId:'kp_virtual_zhi',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「水陸草木之花」中的「之」是甚麼用法？',o:['結構助詞，相當於「的」','代詞，指花','動詞，往／到','賓語前置標誌'],a:'結構助詞，相當於「的」',explanation:'「水陸草木」修飾「花」，「之」連接修飾語和中心語，相當於現代漢語的「的」。'},
 {id:'ad1q002',kpId:'kp_virtual_zhi',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「又間令吳廣之次所旁叢祠中」中的「之」最接近甚麼意思？',o:['往／到','的','他','這件事'],a:'往／到',explanation:'「之」後接地點「次所旁叢祠中」，表示前往該處，因此作動詞，意思是「往／到」。'},
 {id:'ad1q003',kpId:'kp_virtual_zhi',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'依次判斷「何陋之有」「輟耕之壟上」「公與之乘」三句中的「之」，哪項正確？',o:['賓語前置標誌／動詞／代詞','結構助詞／代詞／動詞','代詞／結構助詞／語氣詞','動詞／賓語前置標誌／結構助詞'],a:'賓語前置標誌／動詞／代詞',explanation:'「何陋之有」的「之」協助形成賓語前置；「之壟上」是「到田壟上」；「公與之乘」的「之」指代人物。'},

 {id:'ad1q004',kpId:'kp_virtual_er',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「人不知而不慍」中的「而」表示甚麼關係？',o:['轉折','因果','假設','目的'],a:'轉折',explanation:'別人不了解自己，本可引起不滿，後句卻說「不慍」，前後語意相反，因此「而」表轉折。'},
 {id:'ad1q005',kpId:'kp_virtual_er',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「溪深而魚肥」中的「而」較接近甚麼關係？',o:['並列','轉折','假設','因果'],a:'並列',explanation:'「溪深」與「魚肥」並列描述景物狀態，兩者不是相反或條件關係，所以「而」表並列。'},
 {id:'ad1q006',kpId:'kp_virtual_er',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'比較「泉香而酒洌」與「人不知而不慍」，兩個「而」的關係依次是？',o:['並列／轉折','轉折／並列','因果／順承','順承／因果'],a:'並列／轉折',explanation:'「泉香」「酒洌」是並列特點；「人不知」與「不慍」之間有逆轉意味，所以後者表轉折。'},

 {id:'ad1q007',kpId:'kp_virtual_yi',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「以刀劈狼首」中的「以」最接近？',o:['用／拿','因為','把／將','來／用來'],a:'用／拿',explanation:'「以」引出工具「刀」，表示「用刀劈狼頭」，屬介詞的工具義。'},
 {id:'ad1q008',kpId:'kp_virtual_yi',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「以其境過清，不可久居」中的「以」表示？',o:['因為','用','把','來'],a:'因為',explanation:'後面的「其境過清」是不能久留的原因，因此「以」可譯作「因為」。'},
 {id:'ad1q009',kpId:'kp_virtual_yi',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'依次判斷「不以物喜」「以叢草為林」「屬予作文以記之」中的「以」，哪項正確？',o:['原因／把／目的','工具／原因／比較','目的／把／原因','原因／工具／轉折'],a:'原因／把／目的',explanation:'「不以物喜」是「不因外物而喜」；「以A為B」是把A當作B；「作文以記之」中的「以」表目的，可譯為「來」。'},

 {id:'ad1q010',kpId:'kp_virtual_yu',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「皆以美於徐公」中的「於」表示？',o:['比','從','向','在'],a:'比',explanation:'「美於徐公」是在比較美貌程度，「於」連接比較對象，相當於「比」。'},
 {id:'ad1q011',kpId:'kp_virtual_yu',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「舜發於畎畝之中」中的「於」較接近？',o:['從','比','向','被'],a:'從',explanation:'句子說舜從田野之中被起用，「於畎畝之中」交代出身或來源，可理解為「從」。'},
 {id:'ad1q012',kpId:'kp_virtual_yu',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'比較「告之於帝」與「苛政猛於虎也」，兩個「於」依次最接近？',o:['向／比','比／向','從／在','被／從'],a:'向／比',explanation:'「告之於帝」是向天帝稟告；「猛於虎」則把苛政和老虎作比較，「於」相當於「比」。'},

 {id:'ad1q013',kpId:'kp_virtual_qi',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「其鄉人曰」中的「其」表示？',o:['他的','難道','大概','這'],a:'他的',explanation:'「其」修飾名詞「鄉人」，在句中作代詞性定語，可譯作「他的」。'},
 {id:'ad1q014',kpId:'kp_virtual_qi',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「其真無馬邪？」中的「其」主要表達甚麼語氣？',o:['反問，可譯作「難道」','肯定，可譯作「一定」','祈使，可譯作「請」','所有，可譯作「他的」'],a:'反問，可譯作「難道」',explanation:'「其……邪」在此形成反問，意思是「難道真的沒有千里馬嗎？」。'},
 {id:'ad1q015',kpId:'kp_virtual_qi',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'「其真無馬邪？其真不知馬也。」前後兩個「其」的作用依次是？',o:['反問／推測','代詞／代詞','推測／反問','所有／假設'],a:'反問／推測',explanation:'第一個「其」配合「邪」表示反問「難道」；第二個轉入作者判斷，表示推測「大概／恐怕」。'},

 {id:'ad1q016',kpId:'kp_virtual_ze',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「學而不思則罔」中的「則」最接近？',o:['就／便','但是','因為','即使'],a:'就／便',explanation:'前項「只學而不思」引出後項結果「就會迷惘」，「則」承接條件或情況並引出結果。'},
 {id:'ad1q017',kpId:'kp_virtual_ze',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「居廟堂之高則憂其民」中的「則」主要作用是？',o:['由前項情況引出後項結果','表示轉折','表示比較','表示被動'],a:'由前項情況引出後項結果',explanation:'處在朝廷高位這一情況下，便憂念百姓；「則」連接前項情況與後項反應。'},
 {id:'ad1q018',kpId:'kp_virtual_ze',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'比較「學而不思則罔」與「此則岳陽樓之大觀也」，兩個「則」的功能有何不同？',o:['前者引出結果，後者用於判定／強調「就是」','前者表轉折，後者表比較','兩者都只表示「如果」','兩者都表示被動'],a:'前者引出結果，後者用於判定／強調「就是」',explanation:'第一句的「則」相當於「就」，引出結果；第二句的「則」接近「就是」，強調眼前景象就是岳陽樓的雄偉景觀。'},

 {id:'ad1q019',kpId:'sx_001',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「南陽劉子驥，高尚士也」屬於哪種句式？',o:['判斷句','被動句','省略句','賓語前置'],a:'判斷句',explanation:'句子是在判定劉子驥的身分和性質，即「劉子驥是高尚之士」，所以是判斷句。'},
 {id:'ad1q020',kpId:'sx_001',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「此則岳陽樓之大觀也」的核心句式是？',o:['判斷句','被動句','疑問句','省略句'],a:'判斷句',explanation:'全句建立「此＝岳陽樓之大觀」的判定關係，句末「也」亦有助表明判斷語氣。'},
 {id:'ad1q021',kpId:'sx_001',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'下列哪一句同樣以判定主語身分或性質為核心，而不是靠固定「者……也」格式？',o:['此誠危急存亡之秋也','吾誰與歸','戰於長勺','徒見欺'],a:'此誠危急存亡之秋也',explanation:'「此誠危急存亡之秋也」判定當前正是危急存亡的時刻；判斷句的核心是語義上的判定，不只限於「者……也」。'},

 {id:'ad1q022',kpId:'sx_003',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「徒見欺」中的「見」在句式上表示？',o:['被動','看見','拜見','出現'],a:'被動',explanation:'主語是承受「欺」這個動作的一方，「見＋動詞」在這裡表示被動，可理解為「被欺騙」。'},
 {id:'ad1q023',kpId:'sx_003',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「臣誠恐見欺於王而負趙」主要包含哪種句式？',o:['被動句','判斷句','賓語前置','省略句'],a:'被動句',explanation:'「見欺於王」即「被王欺騙」，「見」標示主語承受「欺」的動作，屬被動句。'},
 {id:'ad1q024',kpId:'sx_003',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'比較「見漁人，乃大驚」與「徒見欺」，兩個「見」依次是？',o:['看見／表被動','表被動／看見','兩者都表被動','兩者都表示拜見'],a:'看見／表被動',explanation:'「見漁人」中的「見」是實義動詞「看見」；「見欺」則是「被欺騙」，要依後接成分與主語角色判斷。'},

 {id:'ad1q025',kpId:'sx_004',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「而智勇多困於所溺」主要屬於哪種句式？',o:['被動句','判斷句','賓語前置','省略句'],a:'被動句',explanation:'「智勇」之人是承受「困」的對象，「於所溺」引出造成困厄的來源，整體可譯作「多被所溺愛的事物困住」。'},
 {id:'ad1q026',kpId:'sx_004',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「受制於人」中的「於」在被動結構中主要作用是？',o:['引出施事者','引出比較對象','表示目的','表示所有'],a:'引出施事者',explanation:'「受制於人」即「被別人控制」，主語承受動作，而「於人」交代施加控制的一方。'},
 {id:'ad1q027',kpId:'sx_004',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'比較「戰於長勺」與「困於所溺」，兩句中的「於」依次較適合判作？',o:['處所狀語／被動標誌','被動標誌／處所狀語','比較／來源','兩者都表被動'],a:'處所狀語／被動標誌',explanation:'「戰於長勺」交代作戰地點；「困於所溺」則是主語被所溺愛之物困住。相同「於」字必須配合句意判斷。'},

 {id:'ad1q028',kpId:'sx_005',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「一鼓作氣，再而衰，三而竭」中，「再」「三」之後省略了甚麼？',o:['鼓','氣','戰','人'],a:'鼓',explanation:'「再而衰，三而竭」承接前文「一鼓作氣」，完整理解是第二次擊鼓士氣衰、第三次擊鼓士氣竭。'},
 {id:'ad1q029',sourceSentenceId:"sentence:問今是何世乃不知有漢",kpId:'sx_005',textId:'CROSS',type:'choice',difficultyTier:'application',q:'【閱讀材料】人物註：「此人」指來到桃花源的漁人。\n「村中聞有此人，咸來問訊。自云：先世避秦時亂，率妻子邑人來此絕境，不復出焉，遂與外人間隔。問今是何世，乃不知有漢，無論魏、晉。」\n\n問題：「問今是何世，乃不知有漢」主要省略了哪個主語？',o:['桃花源中人／村中人','漁人','秦人','太守'],a:'桃花源中人／村中人',explanation:'「村中……咸來問訊」先交代村人發問；「自云」述說村人的來歷，「與外人間隔」解釋他們不知道外界朝代。因此「問」「不知」都承接村中人，不是外來的漁人。'},
 {id:'ad1q030',kpId:'sx_005',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'下列哪一句主要要靠補出省略的主語，才能完整理解語意？',o:['便舍船，從口入','何陋之有','戰於長勺','徒見欺'],a:'便舍船，從口入',explanation:'《桃花源記》承接前文可補出「漁人便舍船，從口入」；其餘三句主要分別涉及賓語前置、狀語後置和被動。'},

 {id:'ad1q031',kpId:'sx_006',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「何陋之有」還原為較接近現代漢語的語序是？',o:['有何陋','何有陋','陋有何','有陋之何'],a:'有何陋',explanation:'疑問代詞「何」作「有」的賓語而前置，「之」是賓語前置的標誌，還原後是「有何陋」。'},
 {id:'ad1q032',kpId:'sx_006',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「忌不自信」中的「自」為甚麼放在「信」之前？',o:['否定句中代詞作賓語前置','因為「自」是主語','因為這是被動句','因為省略了謂語'],a:'否定句中代詞作賓語前置',explanation:'「自」是「信」的賓語，在否定句中代詞賓語常前置；句意是「鄒忌不相信自己」。'},
 {id:'ad1q033',kpId:'sx_006',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'「何以戰？」若按正常語序理解，最接近哪一句？',o:['以何戰','何戰以','戰以何','以戰何'],a:'以何戰',explanation:'疑問代詞「何」作介詞「以」的賓語而前置，因此「何以戰」可還原為「以何戰」，即「憑甚麼作戰」。'},

 {id:'ad1q034',kpId:'sx_008',textId:'CROSS',type:'choice',difficultyTier:'foundation',q:'「戰於長勺」若把介詞結構移回現代漢語常見位置，應理解為？',o:['於長勺戰','長勺於戰','戰長勺於','於戰長勺'],a:'於長勺戰',explanation:'「於長勺」是交代地點的介詞結構，文言放在動詞「戰」後；理解時可移到動詞前。'},
 {id:'ad1q035',kpId:'sx_008',textId:'CROSS',type:'choice',difficultyTier:'application',q:'「刻唐賢今人詩賦於其上」還原語序最接近？',o:['於其上刻唐賢今人詩賦','唐賢於其上刻今人詩賦','刻於唐賢今人其上詩賦','其上於刻唐賢今人詩賦'],a:'於其上刻唐賢今人詩賦',explanation:'「於其上」是地點狀語，修飾「刻」；文言把介詞結構置於動詞後，翻譯時通常移到前面。'},
 {id:'ad1q036',kpId:'sx_008',textId:'CROSS',type:'choice',difficultyTier:'transfer',q:'「咨臣以當世之事」若還原介詞結構的位置，最接近？',o:['以當世之事咨臣','咨以臣當世之事','臣以當世之事咨','以臣咨當世之事'],a:'以當世之事咨臣',explanation:'「以當世之事」交代詢問的內容，介詞結構後置於動詞「咨」之後；還原後即「以當世之事咨臣」。'}
];
window.ManjingoQuestionPackAdaptive01={kind:'adaptive-tiered',questions};
})();
