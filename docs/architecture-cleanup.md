# 架構整理進度

日期：2026-10-29
起點：`25915e0926a0f5b243d299ddc97951eba62ae273`（main）

## 已完成：明確載入入口

- 題庫組合器 `content-catalog.js` 只組合內容，不再插入其他程式。
- 移除題庫、題目輪替及答題回饋中的 `document.write`，以及首頁攔截 `document.write` 的機制。
- 首頁順序：`home-shell.js` → `catalog-runtime.js` → `home-runtime.js` → 共用學習規則 → 本機學習引擎 → 每日計劃。
- 課堂順序：`lesson-shell.js` → `catalog-runtime.js` → `lesson-runtime.js` → 共用學習規則 → 本機學習引擎 → 課堂內容及操作程式。
- 首頁核心組合清單只在 `scripts/build_startup_bundles.cjs` 定義，產物為 `public/home-runtime.js`（39,160 bytes，未壓縮）。
- 原有分頁、學習意圖預熱、觸控啟動等待及閒置時同步安排保留。
- 已變更的既有入口使用 `?v=entry-v1`，避免瀏覽器在轉換時沿用會注入舊 runtime 的快取版本。
- 已移除沒有正式入口使用的 `public/app-runtime.js` 及其組合清單、快取設定；原有完整組合測試由實際首頁及課堂入口執行測試接替。
- 載入重構先獨立驗證及保存，再整理無用產物與測試指令。

## 驗證與日常工作方式

| 改動範圍 | 指令 |
| --- | --- |
| 首頁、課堂、載入、登入及同步入口 | `npm run test:runtime` |
| 學習規則、每日計劃、掌握度及難度 | `npm run test:learning` |
| 題庫、題型及課堂內容 | `npm run test:content` |
| 吉祥物素材 | `npm run test:art` |
| 重建載入產物 | `npm run build:startup` |
| 核對所有產物是否與來源一致 | `npm run check:generated` |
| 發布前完整檢查（CI 沿用） | `npm test` |

這些分組是日常相關檢查的入口，並不代表各組完全互斥或覆蓋所有跨模組影響。共用邊界、部署或跨範圍改動，應執行完整檢查。CI 的 `Tests` workflow 仍執行完整 `npm test`，未放寬合併檢查。

新增執行驗證直接讀取 HTML 的 script 清單，在同一 VM 中執行真實模組，覆蓋冷啟動、自適應選題、答題寫入、成果與弱點並行載入、共用模組去重及既有學習資料保留。兩項原有測試的預設日期補上 UTC 時區，修正於非 UTC 環境出現的誤報。

第一步在本機未取得 Chromium，當時只有 VM 測試；後續已於第五步使用 CI Chrome 實測。仍未完成實體手機及真實 Google 登入，未宣稱載入時間提升幅度。

最終本機驗證：`npm test` 共 689 項測試全部通過，測試執行約 4.4 秒；`npm run test:runtime` 共 103 項通過。完整產物核對及吉祥物檢查通過。兩項只檢查舊載入程式字串的重複檢查，已由實際並行載入的行為測試接替。

## 已完成：同步防回退直接整合（第二步）

- 本機學習引擎的 `syncRemoteResult` 在寫入前直接執行原有回退保護；`syncGamification` 沿用同一入口。
- 移除 `remote-sync-guard.js`、啟動重試、函數包裝及首頁／課堂延後載入清單中的依賴。
- 比較規則保留：先比較答題次數，再比較答題時間；較新的錯答可降低掌握度；舊回應不覆蓋較新的知識點資料，也不降低累積 XP。技能與概念仍用各自的合併規則。
- 保護從本機引擎載入後的第一次同步即生效，無須等待帳戶模組。未變更計分或學習演算法、資料格式及儲存鍵。
- 修正正式環境檢查腳本仍假設 `question-rotation.js` 注入同步保護的舊檢查，改為執行實際的學習引擎並檢查持久化結果。
- 更新入口快取版本，避免新頁面沿用舊的帳戶載入清單。
- 驗證：相關測試 40 項、完整 `npm test` 691 項全部通過；Node 完整測試約 4.6 秒。以本機 HTTP 提供實際 public 檔案，執行 `smoke_sync_guard.mjs` 通過。這是對候選檔案的驗證，並非正式網站或瀏覽器實測。

## 已完成：每日計劃與補強直接整合（第三步）

- 補強政策不再於載入時替換 `buildDailyPlan`、狀態查詢、練習紀錄或題庫選題函數；刪除 property setter、auto-install 及課堂手動安裝入口。
- 本機引擎在建立每日計劃及查詢知識點／技能補強狀態時，直接呼叫補強政策。政策於呼叫時取得，兼容首頁延後載入及課堂預先載入兩種順序。
- 首頁所有本機／雲端計劃選題共用 `ManjingoDailyPlanRuntime.selectQuestionsForPlan`，明確完成補強優先排序、既有選題及補強標記。保留現有題目輪替、難度及技能選題規則。
- 練習紀錄的策略、技能、路由及概念成效在本機引擎首次寫入時即存齊，移除先寫入再搜尋紀錄補寫的流程。保留原有儲存鍵及欄位。
- 相關 54 項測試通過，包括兩種載入順序、不替換函數、雲端計劃不被原地修改，以及本機引擎每筆練習紀錄一次寫入。
- 另以第二步版本（對應 PR commit `e5fa50ec04680bc58d9ba30edb31c4181ea2d493`）作比較：首頁與課堂各測試新用戶、弱項、補強失效、補救失效、補救有效、高掌握度六種狀態，共 12 組；每日計劃、選題、紀錄及補強狀態結果一致。
- 完整 `npm test` 693 項全數通過，Node 測試約 5.0 秒；產物及素材核對、`git diff --check` 通過。瀏覽器實測限制仍然適用。

## 已完成：技能選題與難度直接整合（第四步）

- 題庫選題入口直接呼叫技能選題政策；技能選題失敗時，保留原來的基礎選題及選項平衡備援。
- 題目輪替的 `rank`、`select`、`choose` 直接取得難度政策；難度模組不再於載入後替換三個函數。未載入難度模組時，保留原有輪替與選項平衡行為。
- 難度決策紀錄由選題入口直接呼叫；難度觀察模組僅保留獨立、可重入的 UI 安裝，移除 chooser 包裝及首頁重裝鉤子。
- 本機答題入口直接記錄難度校準，移除 `submit` 包裝及 DOMContentLoaded 安裝重試。統計更新、事件及雲端確認後記錄規則維持原有流程。
- 更新組合產物與入口快取版本。首頁核心為 39,997 bytes（未壓縮），仍在既有 40,000 bytes 預算內。
- 修正正式環境驗收腳本仍依賴舊題目輪替載入清單及題庫註解的檢查，改為核對首頁 loader 和實際 catalog 組合來源。新增 `npm run smoke:assets`（可透過 `MANJINGO_BASE_URL` 指向預覽站）；此模式只驗收靜態資源，在後端及 Firebase 帳戶請求前結束。
- 新增實際 HTTP 靜態資源驗收測試，確認不會呼叫 `/api/*`；子程序有明確逾時及清理。亦驗證載入後選題及答題函數保持同一參照、UI listener 不重複、兩種校準載入順序及技能選題備援。
- 與第三步版本（PR commit `ec3c6442ec94761c8231ada9db6322962c4d468a`）比較：首頁、課堂、首頁冷啟動各六種學習狀態，共 18 組；計劃、選題、難度排序、輪替、備援選題、答題／校準紀錄及補強狀態結果一致。
- 完整 `npm test` 697 項全數通過，Node 測試約 4.9 秒；實際 HTTP 靜態資源驗收、產物／素材核對及 `git diff --check` 通過。這仍不等於真實瀏覽器實測。

## 瀏覽器驗收（第五步）

- 新增 `npm run smoke:browser`，沿用既有 CDP 手機啟動腳本及 runner Chrome，沒有新增瀏覽器套件依賴。
- 以候選 checkout 的本機 HTTP 頁面執行實際 DOM、script 載入、觸控／滑鼠輸入及 localStorage；CSP 阻擋遠端服務，禁止後端路由。沒有建立或寫入正式帳戶。
- 手機尺寸 390 × 844 及桌面 1280 × 900：冷啟動、正答／錯答回饋、整輪完成、成果／弱點／路徑反覆切換、重新載入保留 XP、課堂介紹／答題／完成與答題次數持久化、水平溢出及未捕捉例外。
- Google 只驗證離線失敗後按鈕恢復及本機進度保留，沒有代替實際 OAuth 登入驗收。
- 正式環境等待條件改查實際 `catalog-runtime.js` 中的題庫標記；新增測試逐一用候選 public 檔案執行所有等待條件，避免等候已移除的 loader 註解。
- 真實 Chrome 抓到並修正兩處例外：成果摘要在 DOM ready 後延後載入，observer 改寫入工廠內已建立的 API；帳戶 UI 等待 Firebase 帳戶監聽註冊，SDK 無法載入時由既有本機模式錯誤處理承接，避免未處理的 Promise。兩者均補上針對性回歸測試。
- PR CI 新增獨立 browser job，有限時與瀏覽器清理，保存各畫面截圖及 `report.json` 14 天。最新完整 `npm test` 700 項及 CI 的 test／browser jobs 全部通過（[run 40826641401](https://github.com/cheukwing129/manyingo/actions/runs/40826641401)）。兩種尺寸各完成 10 題首頁與 3 題課堂；沒有未捕捉例外、靜態資源失敗或 `/api/*` 請求。手機首次觸控至第一題為 72.3 ms，僅為 CI 本機 HTTP 測量，不代表正式站網路效能或實體手機速度。

## 後續工作及邊界

1. Chrome 的桌面及手機尺寸觸控驗收已完成。合併／發布前仍需在預覽版本完成真實 Google OAuth 登入及實體手機驗收；CI 隔離雲端的測試不能代替這兩項。
2. 學習視圖的引擎函數包裝已因課堂漏通知問題移除，詳見第七步；帳戶練習上傳鉤子及路徑選題限制保留。
3. 首頁與課堂保留各自的延後載入器，尚未證實需要額外抽象。
4. 舊 Firebase Functions 暫留。雖然正式學習 API 使用 Cloudflare Worker，部署 workflow 仍支援透過 `ENABLE_FIREBASE_FUNCTIONS_DEPLOY` 發布 Functions；應先確認實際部署及外部呼叫狀況，才移除實作、parity 測試及部署選項。

學習資料格式、儲存鍵、Firestore 規則及學習演算法未在本輪修改。兩個既有未合併 PR（#122、#143）保留不動。

## 預覽環境準備（第六步）

- PR #178 的 `07b648b` 已由 Cloudflare Pages 成功部署；不可變 URL 為 `https://29494271.manyingo.pages.dev`。以該 URL 執行 `npm run smoke:assets` 通過，沒有建立測試帳戶或提交答案。
- 後續驗收固定使用分支別名 `https://refactor-explicit-runtime-en.manyingo.pages.dev`；別名會跟隨該 PR 分支的最新部署。
- 實際讀取預覽 `/api/health` 回報 `configured:false`；這表示預覽缺少所需後端憑證，不能宣稱雲端同步已驗收。
- Firebase 公開專案設定目前只授權 localhost、Firebase 預設網域及 manjingo／manyingo 正式網域，尚未包含上述預覽別名。
- 前端只在完全相符且為 HTTPS 的預覽別名使用同源 `authDomain`，沿用既有 `/__/auth/` 反向代理；正式網域和其他來源的設定保留。測試涵蓋正式／預覽、HTTP、隨機部署子網域、相似惡意網域及沒有 location 的環境。
- 參考：[Firebase redirect 最佳實務](https://firebase.google.com/docs/auth/web/redirect-best-practices)。同源代理仍需要控制台授權，程式碼不會代替這些設定。

### 控制台待辦

1. Cloudflare → Workers & Pages → manyingo → Settings → Variables and Secrets，選擇 **Preview** 環境，加入加密的 `FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY`（依原部署使用的 service-account JSON）。不要從對話傳送私鑰，也不要提交到 Git；完成後重新部署預覽。
2. Firebase → manjingo-95d9a → Authentication → Settings → Authorized domains，加入 `refactor-explicit-runtime-en.manyingo.pages.dev`。
3. Google Cloud → 同一專案的 Google Auth Platform → Clients（或 APIs & Services → Credentials）→ 正式站目前使用的 Web OAuth client，**保留既有設定並新增** redirect URI：`https://refactor-explicit-runtime-en.manyingo.pages.dev/__/auth/handler`。
4. 確認預覽 `/api/health` 為 `configured:true`，然後用實體手機瀏覽器開啟固定預覽別名，完成 Google 登入、答題、重新整理及另一裝置同步驗收。預覽仍連到現有 Firebase 專案，使用專用測試帳戶；不可將此環境稱為獨立資料庫。

使用者已於 2026-10-29 回報三項控制台設定全部完成。已透過 Firebase 公開設定確認預覽別名在 authorizedDomains；現有預覽部署仍回報 configured:false，先以本次進度更新觸發預覽重部署，核對新部署能否讀取憑證。尚未完成真實 OAuth／同步／實體手機驗收，PR 保持未合併。


## 學習更新通知直接整合（第七步，不依賴雲端 key）

- 已重現：普通課堂頁沒有載入 `learning-path-ui.js` 或難度校準時，本機答題沒有發出學習狀態事件；已載入的帳戶模組因此沒有收到答題後同步排程通知。
- 通知改由本機引擎在答題、補強紀錄、雲端知識點／技能／概念合併、XP 同步及錯誤模式修正完成後發出；路徑 UI 訂閱事件，不再替換六個引擎函數。
- 本機答題呼叫難度校準時，以內部靜默選項抑制中途通知，待統計完整寫入後由引擎發出一次；獨立校準呼叫仍保留通知。XP 同步直接共用內部合併函數，避免內外層各通知一次。
- 答題期間隱藏視圖的更新仍合併至離開學習模式時執行。保留路徑選題限制及帳戶練習上傳鉤子，沒有變更學習／計分規則或儲存格式。
- 與前一版本 `6d95126` 比較普通課堂、首頁冷啟動、已載入路徑三種情境，各十項操作（答題、同步、補強及每日計劃）的回傳值與儲存快照一致。普通課堂由零次通知／零次排程，變為一次通知／一次排程；路徑已開啟時由兩次通知減為一次。
- 重寫原先只對假引擎加包裝的測試，改執行真實引擎，驗證寫入後通知、無 UI 仍排程同步、穩定函數參照、校準去重及學習模式合併更新。完整 `npm test` 705 項通過；另修正同步保護測試的固定日期與本機時區不一致，於 UTC−3／UTC+14 均通過。
- Chrome 驗收新增逐題一次通知、路徑載入後引擎參照不變，以及沒有路徑／校準模組的課堂通知檢查。實際結果以 PR CI 的 browser job 為準；本輪不使用 key，不宣稱真實雲端同步成功。
- 第七步當時因使用者稍後才找 key，控制台及真實登入／同步驗收暫停；使用者後來回報三項設定已完成，現已接續第六步驗收。使用者確認中斷恢復之前已驗收，本輪不重做。PR 未合併，正式站未更新。


## 控制台完成後的驗收結果（第八步）

- Firebase 公開設定已確認包含固定預覽別名。實際開啟預覽的「使用 Google 同步」可到達 Google「選擇帳戶」頁，使用預覽同源 callback，沒有出現 unauthorized-domain 或 redirect_uri_mismatch；這只證明授權入口可開啟，並非 Google 登入完成。
- 已推送 `a080f10` 觸發預覽重新部署，Cloudflare 成功產生 `https://edf92bb3.manyingo.pages.dev`。重新部署後，固定預覽別名仍回報 `configured:false`，因此無法繼續宣稱後端及同步驗收成功。
- Worker 的 configured 僅檢查 `FIREBASE_CLIENT_EMAIL`、`FIREBASE_PRIVATE_KEY` 是否都有非空值。此結果表示至少一個預期 binding 未載入；不能據此判定私鑰格式或 IAM 權限有錯。
- Cloudflare 控制台在目前瀏覽器顯示登入頁，未取得控制台設定內容，也沒有讀取或修改任何憑證。待使用者核對 **manyingo 專案 → Preview 環境**下兩個 Secret 的完整名稱、非空值及儲存狀態，再重新部署並檢查 health。
- 未完成 Google 帳戶登入，未提交測試答案或驗證真實雲端寫入，PR 保持未合併。中斷恢復驗收依使用者指示略過，不重做。

## 憑證注入診斷（第九步）

- 使用者已再次核實設定；現有預覽 health 仍為 configured:false，因此新增 `missingBindings`，逐項列出未注入或空值的固定 binding 名稱。
- configured 的判定與原本一致，health 只讀取 binding 是否有值，不執行私鑰解析、OAuth 或 Firestore 連線，也不回傳任何憑證內容。HTTP 200 與 no-store 保留。
- 回歸測試覆蓋兩項全缺、只缺私鑰、只缺電郵、兩項齊備四種組合，同時驗證不會外連、不會洩漏測試憑證值。完整 npm test 706 項及本次 CI 的 test／browser 全部通過。
- 新版 f5adc1a 已由 Cloudflare 部署為 b56763ba；固定預覽 health 實際回傳 missingBindings 同時包含 FIREBASE_CLIENT_EMAIL 和 FIREBASE_PRIVATE_KEY。這表示兩項都未載入目前 Worker，並非已判定憑證格式或 IAM 失敗。
- 尚未取得 Cloudflare 控制台登入狀態，無法直接讀取設定；後續需查看不含值的設定畫面（專案、Preview 環境、變數名稱與類型），以定位環境／綁定差異。未讀取、輸出或修改私鑰，PR 保持未合併。

## 答題操作固定（第十步）

- 使用者已回報手機 Google 登入、答題後重新整理保留進度，以及第二裝置登入同步全部通過；這是使用者實測結果，代理先前的自動唯讀測試仍因 Cloudflare 1010 被攔截。
- 「下一題」原先排在答案回饋後，解說及進度展開時會被推下。首頁每日練習、微課堂、診斷驗證及進階閱讀現在共用固定底部操作列，作答前顯示停用按鈕，作答後在原位啟用；每輪最後的完成按鈕沿用同一位置。
- 內容保留底部捲動空間及手機安全區，解說可捲到操作列上方。進階閱讀操作列位於既有底部導航上方，保留切換功能；其操作列放在題目進場動畫容器外，避免 transform 改變 fixed 的定位基準。完成畫面隨題目 DOM 替換移除操作列。
- 沿用既有按鈕 ID、點擊及鍵盤操作，沒有更動答案評分、XP、學習紀錄或同步邏輯。進階閱讀的按鈕提前建立並停用，答題後只啟用，不再插入 aria-live 的解說區。
- 本機完整 npm test 706 項通過，git diff --check 通過。Chrome 驗收新增作答前後實際座標比較、展開解說／進度後不遮擋、320／768／1024／1440px 寬度、進階閱讀與底部導航不重疊，以及完成後移除操作列。實際瀏覽器結果以 PR CI 為準；未合併至 main。
