# 8th Wall 繁體中文瀏覽器開發預覽版

這個版本將原有 React／Three.js 場景編輯器接上瀏覽器入口與 Node.js 專案服務。
它是線上平台移植的第二階段：**目前只能在執行伺服器的電腦上使用，不是已部署的雲端平台。**

## 本階段內容

- 繁體中文專案首頁、專案名稱輸入、列表、刪除確認及語言切換。
- 使用原始場景編輯器；預設場景包含方塊、攝影機、環境光與平行光。
- 同源 `/api` 讀寫、素材上傳、重新命名、檔案摘要與 SSE 變更通知。
- 專案儲存在伺服器磁碟；重新啟動服務不會清除資料。
- 場景採原子檔案替換；前端依序送出寫入，顯示儲存中／已儲存／儲存失敗，失敗可重試。
- 頁面切換與關閉前，若仍有未儲存內容，瀏覽器會提示。
- 獨立 Webpack 建置，包含原始編輯器、分析／模型處理 Worker，以及鎖定版本 `@8thwall/ecs@3.2.1` 的資源；不需要建置 Electron 或 Bazel。

**仍未提供：**帳號登入、不同使用者的資料隔離、多人同時編輯、AR／程式執行預覽、手機連線、公開發布、專案 ZIP 匯入匯出、桌面程式碼編輯器與套件安裝。播放器、發布、執行環境更新與裝置除錯入口在這個網頁入口隱藏。部分原有進階面板仍需逐項驗收，不能將可見選項視為功能已完成。

## 安裝與啟動

需求：Git（含 Git LFS）、Node.js 22 以上、npm。此分支在 Node.js 24.19.0 驗證過開發建置與測試。第一次安裝需要網路，原編輯器相依套件較多。

若尚未下載 repository：

```sh
git clone --branch feat/zh-tw-localization https://github.com/aistudentpartner/8thwall.git
cd 8thwall
git lfs pull
```

在 repository 根目錄執行：

```sh
npm ci --prefix apps/web
npm ci --prefix reality/cloud/xrhome --legacy-peer-deps
npm run build:web --prefix reality/cloud/xrhome
npm start --prefix apps/web
```

開啟 <http://127.0.0.1:8080/?lang=zh-TW>。這是你自己電腦的網址，並非公網展示網址。

`build:web` 第一次會建置原有 Semantic UI 樣式。修改前端後須重新執行建置，再重新整理瀏覽器。`npm ci` 會套用上游的 `patch-package` 修補；目前上游 Three.js 修補有版本名稱警告，這次建置中能成功套用。

如已下載此分支，先保存自己的未提交變更，再 `git pull --ff-only`，接著重新安裝與建置。

### Windows：`spawnSync npm ENOENT`

早期的 `build-web.cjs` 直接以 `execFileSync('npm', ...)` 安裝 Semantic UI 相依套件，
無法在 Windows 正確啟動 npm 的 `.cmd` 入口。已改成透過目前 Node 執行 npm 提供的 CLI 路徑，
也支援 `Program Files` 等含空白的路徑。

若遇到這個錯誤，在現有 repository 的命令提示字元執行：

```bat
git pull --ff-only origin feat/zh-tw-localization
npm run build:web --prefix reality/cloud/xrhome
```

建置成功後再執行 `npm start --prefix apps/web`。不需要重新下載 repository 或重新安裝 Node.js。
`Run npm audit for details` 是 npm 的套件稽核提示，與這個程序啟動錯誤是不同問題。
這項修正已驗證 CLI 啟動、含空白路徑、失敗傳遞與首次樣式建置；尚未完成 Windows 實機驗收。

## 資料與範圍

預設專案目錄為 `apps/web/.data/`，已排除 Git 追蹤；備份整個目錄才能備份專案。可用環境變數 `STUDIO_DATA_DIR` 指定其他資料位置，`PORT` 改變監聽埠。

服務固定監聽 `127.0.0.1`，檢查 Host、Origin 與跨站請求；拒絕路徑穿越及符號連結。單檔上限 32 MB。素材使用限制腳本執行的回應標頭，API 不執行使用者的 npm 或建置程式。

**請勿直接用反向代理或通道公開這個服務。**它還沒有登入與專案權限管理，所有本機使用者共用專案目錄。公網版必須先完成帳號／授權、隔離建置與獨立預覽來源。此版限定單一編輯者；SSE 通知不是多人協作或衝突合併機制。直接從磁碟修改檔案後須重新載入頁面。

## 驗證結果與限制

2026-10-08 的驗證：

| 項目 | 結果 |
| --- | --- |
| 原版編輯器與 2 個 Worker 的開發建置 | 通過 |
| 原有語系與繁體中文資源測試 | 15 項通過 |
| 瀏覽器儲存佇列、離頁狀態與失敗重試測試 | 4 項通過 |
| 專案 CRUD、重啟保存、素材、SSE、路徑／跨站防護測試 | 11 項通過 |
| 首頁與編輯器 DOM 初始化 | 能呈現繁體中文首頁、場景物件樹與設定面板；測試環境無法下載原樣式引用的 Google 字型，會使用本機後備字型 |
| 全 repository TypeScript 檢查 | 未通過：有既有 ECS／Bazel 產物相依與舊測試型別錯誤；本次修改的前端檔案未出現診斷 |
| 真實瀏覽器 3D 畫面與編輯後重載 | **尚未驗收**：執行環境無法啟動本機 Chromium，遠端瀏覽器也無法存取本機服務 |
| 正式壓縮建置、Electron、手機 AR、公網部署 | 未驗證／未完成 |

後端測試：

```sh
npm test --prefix apps/web
```

語系與儲存測試（在 `reality/cloud/xrhome` 執行）：

```sh
npm run test-file-serial -- test/i18n-locales-test.ts test/i18n-zh-tw-test.ts test/web-save-state-test.ts
```

## 真實瀏覽器待驗收步驟

1. 以上述命令啟動，在 Chrome 或 Edge 開啟繁體中文首頁。
2. 建立「中文驗收專案」，確認出現原有 3D 編輯器與預設方塊。
3. 選取方塊，修改名稱與 X 座標，等待頂端顯示「已儲存」。
4. 重新整理，確認名稱與座標保留；關閉再啟動服務，確認專案仍可開啟。
5. 連續修改同一物件，確認最後一筆內容保存；修改後立即離頁，確認未儲存提示。
6. 暫停服務後修改內容，確認「儲存失敗」；恢復服務後按「重試儲存」，再重新整理確認保存。
7. 上傳一張圖片與一個 GLB，檢查素材呈現、重新命名與刪除；檢查中文顯示是否截斷。

這些步驟列為待驗收，不代表已在真實瀏覽器通過。問題修正與公網部署須繼續在此分支完成。
