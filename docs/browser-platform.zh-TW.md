# 瀏覽器繁體中文平台：原始碼盤點與建置順序

使用者已選定瀏覽器線上平台。本文件根據 2026-10-08 檢查的 `8thwall/8thwall` 提交 `909fefd861a54e8deb17c41b83a89d6475e5248c` 整理。完整雲端架構仍為後續目標；目前已新增本機瀏覽器開發入口、同源專案 API 與保存測試，尚未完成真實瀏覽器 3D 驗收或公網部署。啟動方式、已驗證項目與限制請見 [瀏覽器開發預覽版](browser-studio-quickstart.zh-TW.md)。

## 可沿用與需要補齊的部分

原版提供 React 編輯器、ECS 執行環境與 AR 引擎。現有應用程式的入口是 Electron 桌面模式；不能僅將編譯後的靜態檔案放到網站就得到原有雲端平台。

| 範圍 | 原始碼依據 | 線上版需要的處理 |
| --- | --- | --- |
| 原生視窗、外部導覽 | `apps/desktop/src/shell/preload.ts`、`reality/cloud/xrhome/src/client/desktop/desktop-app.tsx` | 建立瀏覽器入口與導覽；移除最小化、最大化及關閉原生視窗等操作 |
| 專案與檔案 | `reality/cloud/xrhome/src/client/studio/local-sync-api.ts`、`apps/desktop/src/file-sync/protocol.ts` | 替換 `file-sync://` 與本機位址；建立需要登入與專案權限驗證的 HTTPS API |
| 引擎資源 | `reality/cloud/xrhome/src/client/desktop/index.tsx` | 將 `desktop://dist/ecs-resources/` 改為網站受控的資源路徑，檢查 WASM 與 Worker 載入 |
| 檔案變更與裝置訊息 | `local-sync-context.tsx`、`editor/hooks/use-console-activity.ts`、`editor/hooks/use-device-broadcast.ts` | 以專案授權的 WebSocket 或 SSE 替換 Electron IPC；裝置連線使用短效配對碼 |
| 相依套件與預覽建置 | `apps/desktop/src/project/local-server.ts`、`run-commands.ts` | 建置佇列與隔離工作環境；限制 CPU、記憶體、時間、網路與可安裝套件 |
| 專案保存 | `apps/desktop/src/project/local-project-db.ts` | 改為伺服器專案資料與物件儲存，提供版本控制與備份；瀏覽器儲存只作草稿快取 |
| 原生檔案操作 | `local-sync-api.ts` 的開啟磁碟、Finder 與移動資料夾功能 | 改為素材上傳、專案匯入／匯出；不暴露伺服器路徑給使用者 |
| 發布作品 | 原版 `buildZip()` 可請求本機建置匯出 | 新增發布版本、作品網址、回復前版及刪除發布功能 |

這些服務必須與登入身分、專案擁有者及權限連動。直接公開桌面檔案處理器不是本方案。

## 建議的首版使用流程

登入 → 新增專案 → 上傳模型與圖片 → 編輯 3D 場景 → 儲存 → 手機預覽 → 發布作品。

首版聚焦於原版開源能力可支援的 3D、辨識圖 AR 與臉部效果。其他原有選單與舊雲端服務需逐一確認後再開放，不能以介面上有文字視為已完成。

## 建議架構

- **瀏覽器編輯器：**保留原版 React／ECS 場景工具與 `zh-TW` 語言資源，建立獨立 web entry。新平台第一次進入可指定 `zh-TW`，之後尊重使用者保存的選擇。
- **應用程式服務：**登入、專案資料、檔案版本、資產存取與發布記錄。所有讀寫皆在伺服器驗證專案成員資格，不信任前端傳入的擁有者 ID。
- **素材儲存：**模型、圖片、音訊與專案檔案存於物件儲存。原始專案預設私人；已發布作品僅公開發布版本需要的檔案。
- **建置服務：**獨立容器工作程序執行專案建置，不在 API 主程序中直接執行使用者程式碼；工作環境不帶主系統憑證。
- **作品服務：**以獨立來源提供預覽與公開作品，避免使用者程式碼讀取編輯器的登入 Cookie。發布與編輯器各自設定 CSP。

此拆分源自原版會安裝 npm 套件、執行建置程式及預覽使用者程式碼的行為。單純靜態網站託管不足以提供這些伺服器功能。

## 開源與授權界線

[主 repository README](https://github.com/8thwall/8thwall) 與 [MIT LICENSE](https://github.com/8thwall/8thwall/blob/main/LICENSE) 將開源程式與另行散布的 SLAM 二進位元件分開。修改與散布開源部分時保留著作權及授權聲明。

[引擎說明](https://github.com/8thwall/8thwall/blob/main/packages/engine/README.md) 列出開源能力包含 Image Targets、Face Effects 與 Sky Effects；不包含 VPS、Lightship Maps、Geospatial Browser 與 Hand Tracking。World Tracking 所需的 SLAM 另行提供。

[SLAM 所屬二進位引擎授權](https://github.com/8thwall/engine/blob/main/LICENSE) 第 1.2 節對特定收費用途、衍生修改及競爭產品設有限制。因此本分支的中文化與瀏覽器開發預覽版不納入該二進位元件。線上平台若要整合它，應依實際用途先確認授權；不能將它當成 MIT 元件使用。

## 實作里程碑與驗收

| 順序 | 工作 | 完成的判定 |
| --- | --- | --- |
| 1 | 建立使用者自己的 GitHub 副本，套用共享中文化修改 | 已完成，工作位於 PR #1 |
| 2 | 完成可在瀏覽器啟動的原版編輯器入口 | Web 入口、API、建置與服務測試已完成；真實 3D 操作驗收待完成 |
| 3 | 登入、專案權限、素材儲存與保存 API | 重新登入後資料仍存在；另一帳號無法讀寫私人專案 |
| 4 | 隔離建置、手機預覽與作品發布 | 可編輯後發布新版本；預覽程式無法取得編輯器登入資料 |
| 5 | 補齊其餘翻譯與移除不適用功能 | 中文主流程可操作，找不到失效的舊平台入口 |
| 6 | 完整實機驗收 | Chrome／Edge／Safari、手機相機、辨識圖、繁體字顯示、保存失敗復原與備份回復均通過 |

使用者已指定原始碼保存位置為 <https://github.com/aistudentpartner/8thwall>。部署帳號／主機尚未選定。本次沒有替使用者選定收費服務、建立雲端帳單或變更既有網站。
