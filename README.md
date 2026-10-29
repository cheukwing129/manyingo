# Manyingo 文言年糕

Manyingo 文言年糕是一個以每日練習建立可遷移文言閱讀能力的 DSE 文言自主學習平台。
目前以 Duolingo 式遊戲化學習為設計核心，聚焦**文言字詞與句式**的自主複習；內容以 DSE 12 篇指定範文為主要例句來源，並擴充 12 篇以外的常見文言例句。

正式網站：<https://manyingo.pages.dev>

## 專案結構
- `data/` — CSV 內容範本（篇章資料、知識點、題目、文言語法起點資料、虛詞對照表）
- `scripts/` — Firebase 匯入與 smoke test 腳本
- `functions/` — legacy Firebase Functions implementation / parity tests
- `public/` — 前端與 Cloudflare Pages Advanced Mode Worker 部署目錄
- `wrangler.toml` / `package.json` — Cloudflare Pages 與本機開發設定

## 核心設計
- **知識架構**：以字詞（一詞多義、詞類活用、古今異義、通假字、18 個虛詞）與句式
  （判斷句、被動句、省略句、倒裝句）為主軸，範文主要作例句來源標籤
- **複習引擎**：依答題表現與掌握度安排複習、新知識及弱點補強
- **題型與內容**：涵蓋字義、句式、語譯、填空及其他文言理解練習
- **遊戲化機制**：XP、Streak、學習路徑、弱點診斷與學習成果
- **帳戶與同步**：Firebase Authentication + Firestore，server-side learning writes 經 Cloudflare Pages Worker 處理

## 部署與維運
詳見 [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)。

## 維護與架構整理

日常可按範圍執行 `npm run test:runtime`、`npm run test:learning`、`npm run test:content` 或 `npm run test:art`；發布前及 CI 維持完整 `npm test`。

載入入口、產物重建方式、驗證限制及後續工作見 [架構整理進度](./docs/architecture-cleanup.md)。
