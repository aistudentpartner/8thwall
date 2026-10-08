# 8th Wall 繁體中文化：第一階段

> 本文件保留第一階段的交付紀錄。第二階段新增 27 筆瀏覽器介面文字，並補上 3 筆原有面板文字，目前 JSON 資源合計 1,362／4,101；詳見 [瀏覽器開發預覽版](browser-studio-quickstart.zh-TW.md)。

目標是沿用原始編輯器，建立瀏覽器操作的繁體中文 AR／3D 平台。本次交付為共享介面的中文化修改；**尚未提供可登入、儲存或發布作品的線上平台，也不是桌面安裝包。**

檢查日期：2026-10-08（臺灣時間）。來源：<https://github.com/8thwall/8thwall>；基準提交：`909fefd861a54e8deb17c41b83a89d6475e5248c`。

## 已完成的修改

- 正式語言清單新增 `zh-TW`，選項顯示「繁體中文（臺灣）」。
- 臺灣、香港、澳門及 `zh-Hant` 瀏覽器語系可辨識為繁體中文。保留原本的優先順序：網址參數、已儲存設定、瀏覽器語系、英文後備。
- 可用 `?lang=zh-TW` 指定繁體中文；已存在的其他查詢參數後使用 `&lang=zh-TW`。也可透過原本偏好設定切換語言。
- HTML 語言標記隨語言切換，支援輔助閱讀工具與中文排版選字。
- 加入本機繁體中文字型後備：Noto Sans TC、PingFang TC、Microsoft JhengHei。沒有新增字型下載服務。
- 提供 1,332 筆本地化資源，保留插值、連結標籤、格式名稱與必要技術識別字。
- 尚未翻譯的命名空間保留空 JSON，由既有 i18next 英文資源後備；沒有以英文複本冒充已翻譯內容。

## 資源涵蓋範圍

此表只統計 `src/client/i18n/en-US` 的 JSON 鍵值，並非整套軟體的完成度；硬編碼文字、原生選單、引擎套件內提示與外部文件不在此分母內。

| 資源 | 已提供本地化／原有鍵數 | 狀態 |
| --- | ---: | --- |
| 場景編輯器 `cloud-studio-pages` | 1,155／1,155 | 本階段完成 |
| 共用按鈕 `common` | 81／81 | 本階段完成 |
| 原專案首頁與偏好設定 `studio-desktop-pages` | 90／90 | 本階段完成；線上版需改接服務 |
| 錯誤提示 `caught-error-page` | 6／6 | 本階段完成 |
| 功能提示 `studio-tooltips` | 0／456 | 英文後備 |
| 程式碼編輯器 `cloud-editor-pages` | 0／715 | 英文後備 |
| 應用程式管理 `app-pages` | 0／710 | 英文後備 |
| 帳號頁面 `account-pages` | 0／436 | 英文後備；須依新的登入服務調整 |
| 展示頁面 `public-featured-pages` | 0／229 | 英文後備 |
| 素材實驗室 `asset-lab` | 0／196 | 英文後備；原版部分功能旗標關閉 |
| 合計 | 1,332／4,074（32.7%） | 尚餘 2,742 筆 |

部分原有文字涉及 VPS、Niantic Maps、手部追蹤或舊雲端服務。翻譯這些鍵值不代表功能已可用，也沒有啟用原本關閉的功能旗標。

## 統一術語

| 原文 | 本地化用語 |
| --- | --- |
| Project / Workspace | 專案／工作區 |
| Asset / Texture / Material | 素材／貼圖／材質 |
| Scene / Space | 場景／空間 |
| Mesh / Geometry | 網格／幾何形狀 |
| Prefab / Instance | 預製物件／實例 |
| Inspector / Component | 屬性檢視器／元件 |
| Image Target | 辨識圖 |
| Camera | 攝影機；裝置前後鏡頭依語境翻譯 |
| Collider / Rigidbody | 碰撞體／剛體 |
| Build / Deploy | 建置／部署 |
| Source-control Client | 工作副本 |
| Land | 合併 |

## 驗證結果

已執行原本 4 項語系測試與新增 11 項測試，共 **15 項通過**。包含正式環境選單、繁體語系辨識、語言優先順序、儲存功能被停用、英文後備、切換語言、複數數量、變數插值，以及全部新增文字的標籤一致性。另完成 JSON 解析與差異空白檢查。

測試使用與原專案相同主要版本的 i18next 21.8.9、TypeScript 4.6.4、ts-node 8.10.2 與 Mocha 9.1.4，在隔離的驗證環境執行。本次沒有安裝整個 Bazel／Electron 建置環境，**未完成整套應用程式建置、實機 AR 測試或畫面溢位檢查**。

在依官方指南安裝完整開發環境後，可於 `reality/cloud/xrhome` 執行：

```sh
npm run test-file-serial -- test/i18n-locales-test.ts test/i18n-zh-tw-test.ts
```

## 套用修改包

修改包附有 `zh-TW-phase1.patch`、逐檔修改內容、此說明、線上移植盤點與原版 MIT LICENSE。請在上述基準版本或相容版本的乾淨工作分支中，先檢查再套用：

```sh
git apply --check /path/to/zh-TW-phase1.patch
git apply /path/to/zh-TW-phase1.patch
```

也可以使用壓縮檔 `changed-files/` 內保留相對路徑的檔案，但有自己的修改時應採差異合併。若上游已更新，不要強制覆蓋；先比對新增與移除的翻譯鍵。

## 後續

下一步請參閱 [瀏覽器線上平台移植盤點](browser-platform.zh-TW.md)。使用者副本為 <https://github.com/aistudentpartner/8thwall>，工作分支為 `feat/zh-tw-localization`。本階段只交付中文化修改與移植盤點，不代表線上平台已部署；不向原作者的 repository 提交變更。
