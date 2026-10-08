# 8th Wall 繁體中文 Windows 單機版

本分支目前改以 Windows 單機工作室為主要使用方式。採用 repository 原有的 Electron 桌面程式、React／Three.js 編輯器、本機專案資料庫與預覽工具，不需登入 8th Wall 或架設雲端服務。

## 安裝與開啟

開發版需要 Git（含 Git LFS）與 Node.js 22 以上；建議使用 Node.js 22。第一次準備與製作安裝檔需要網路下載相依套件。完成後，內建範本的新增、場景編輯、本機預覽與 ZIP 建置不會自動執行 npm 安裝。

在 Windows 命令提示字元執行：

```bat
cd /d C:\Users\yaolu\8thwall
git pull --ff-only origin feat/zh-tw-localization
Setup-Standalone.cmd
```

看到安裝完成後執行：

```bat
Start-Standalone.cmd
```

之後可直接在檔案總管雙擊 `Start-Standalone.cmd`。啟動器會自行切換至正確目錄，開啟獨立的繁體中文桌面視窗；不需要手動開啟 `127.0.0.1:8080` 或啟動 `apps/web`。更新前端或桌面程式後請重新執行 `Setup-Standalone.cmd`。

## 製作安裝檔

在完成上述安裝的 Windows x64 電腦執行 `Package-Standalone.cmd`。成功後安裝檔位於 `apps/desktop/out/standalone/8thWall-TW-Setup-1.0.2-x64.exe`。

安裝檔包含 Electron、介面、場景資源、本機資料庫、內建專案範本及其相依套件。安裝後使用者不需另外安裝 Node.js、npm、Git、Bash 或 Bazel。這個分支另設有 `Windows standalone Traditional Chinese` GitHub Actions 工作流程，在 Windows 執行建置、靜默安裝、啟動已安裝的程式並驗證，再上傳安裝檔；只有成功的工作流程才會產生可下載的安裝檔。它不會自動發布 GitHub Release。

## 匯入 3D 模型

開啟專案後，按編輯器左上角紫色的「匯入模型」。選擇包含貼圖的 `.glb` 檔，匯入完成後會出現在左側素材清單；將素材拖曳至中央場景即可加入，再使用移動、旋轉與縮放工具調整。模型存放在專案的 `src/assets`，場景修改會自動儲存。原有「＋ → 上傳」入口也保留，可用來匯入其他素材。

建議先使用單一 GLB 檔驗證。分離式 glTF 的 `.bin` 與貼圖必須保留引用路徑；此版不提供 OBJ／FBX 的通用轉檔流程。

## 1.0.2 預覽連線修正

1.0.1 的打包程序漏掉離線範本與 npm 內部的相依套件，使安裝版無法啟動本機預覽。1.0.2 改為完整複製並逐檔比對，更新後重新開啟原有專案即可補齊範本套件；不需要刪除專案或另外架設伺服器。

若預覽仍失敗，編輯器會顯示實際錯誤及「重新啟動本機預覽」。首次開啟會先複製離線套件，再啟動預覽；請等候底部記錄完成。模型匯入與場景編輯不需要連接 8th Wall 雲端伺服器。

## 本機資料與功能

- 預設專案：Windows 的「文件」目錄下 `8th Wall 繁體中文單機版`，也可使用原版的資料夾選擇功能指定位置。
- 專案列表與偏好設定：`%APPDATA%\8thWall-Standalone-TW`。
- 場景、素材、程式碼保留在專案資料夾；備份時請備份整個專案。
- 接回原版桌面的建立／開啟專案、場景與素材編輯、程式碼編輯器整合、預覽、圖片辨識目標處理與 ZIP 建置入口。
- 內建範本使用鎖定的 ECS 3.2.1；所需 npm 套件在準備階段一併下載，首次開啟專案時從本機複製。
- 關閉官方自動更新檢查及線上範本圖庫，不載入 Google 網頁字型。
- 執行環境面板直接顯示專案的本機版本，不查詢 npm；需要額外套件時可明確選擇專案選單的「安裝套件（需要網路）」。
- 離線範本沿用上游 `@8thwall/engine-binary`，保留其隨附 LICENSE；該套件與 MIT 授權的原始碼是不同項目。
- 原有 `apps/web/.data` 瀏覽器預覽資料保持原樣，**不會自動搬入桌面資料庫**。兩者專案格式不同，請先保留備份；不要把該目錄直接當作桌面專案開啟。

離線範本的套件會占用磁碟空間，首次開啟需要等待複製與建置。外部專案若缺少不同版本或額外套件，仍須先連線完成套件安裝；這時會顯示錯誤，不會在背景默默下載。原有文件連結、外部程式碼編輯器與手機連線功能依然有各自的安裝或網路需求。

## 黑畫面與錯誤資訊

介面啟動時會顯示「正在載入工作室」。若 JavaScript 載入失敗或等候超過 60 秒，會顯示錯誤資訊與重新載入按鈕。主程式也會提示缺少介面檔案、preload 失敗及畫面程序停止。

若只有 3D 區域黑色，請先用 `Start-Standalone-Software.cmd` 測試軟體繪圖模式；它可能比硬體加速慢。此模式不是所有黑畫面的通用修正。

可從「檢視 → 開發者工具」查看 Console，從「檔案 → 顯示應用程式紀錄」開啟記錄檔。回報時請附錯誤文字，並說明是整個視窗黑色，還是只有 3D 預覽區域黑色。

## 驗證狀態

目前開發環境已通過：

- Electron 主程式及 preload 打包。
- 桌面編輯器、語系與兩個 Worker 的 Webpack 建置。
- 6 項離線套件複製／保留現有檔案與缺件提示測試。
- 以 Electron 隨附 Node 執行主程式初始化及 SQLite 資料庫建立檢查（模擬視窗 API，並非圖形介面驗收）。
- 從隨附範本與套件建立實際專案，直接使用本機 Webpack 成功建置 runtime、XR 資源及可匯出的靜態頁面。

本開發容器沒有可用的圖形顯示環境。2026-10-08，GitHub Actions 的 Windows 機器已成功完成建置、5 項套件測試，以及在阻擋外部網路的條件下啟動繁體中文首頁、建立中文專案、載入編輯器畫布、本機預覽及 ZIP 匯出。該次測試使用開發版 Electron，未涵蓋安裝包，因而未抓到打包漏件。1.0.2 的工作流程改為靜默安裝 NSIS 安裝檔，在移除系統 Node.js 路徑、阻擋外部網頁請求的條件下測試可見匯入按鈕、GLB 寫入、拖曳至場景、重載後保存、本機預覽及包含模型的 ZIP 匯出，通過後才上傳安裝檔。**人工 3D 編輯操作及手機 AR 仍待驗收**。整套翻譯也尚未全部完成，部分進階頁面仍可能顯示英文。單機版不包含代管雲端服務、多人協作與帳號管理；實際 AR 模式仍取決於原引擎、攝影機及裝置支援，不應把建置成功視為所有 AR 功能已驗收。

## 開發命令

```sh
npm run standalone:setup --prefix apps/desktop
npm run standalone:build --prefix apps/desktop
npm run standalone:start --prefix apps/desktop
npm run standalone:test --prefix apps/desktop
npm run standalone:package --prefix apps/desktop
```
