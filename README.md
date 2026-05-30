# TripSplit

TripSplit 是一個旅遊分帳工具，前端以純 HTML、CSS、JavaScript 撰寫，後端使用 Google Apps Script 串接 Google Sheet 與 Google Drive。使用者可以建立不同旅程、管理成員與支出分類、記錄多幣別消費、上傳收據圖片，並查看每位成員的結餘與建議結清方式。

## 功能特色

- 旅程管理：建立、切換、封存與還原旅程。
- 成員管理：新增或移除旅程成員。
- 分類管理：自訂支出分類與圖示。
- 付款方式管理：自訂現金、信用卡、電子支付等付款方式。
- 多幣別支出：支援 JPY、USD、KRW、EUR、THB、TWD，並換算為 TWD。
- 分帳方式：支援平均分攤、百分比分攤、自訂金額分攤。
- 收據上傳：可選擇圖片或使用相機拍照，上傳至 Google Drive。
- 雲端資料：透過 Google Apps Script 將資料寫入 Google Sheet。
- 離線備援：Google Apps Script 無法讀取時，前端會使用內建 fallback 資料顯示頁面。
- 結清建議：依照目前支出計算每位成員應收或應付金額。

## 專案結構

```text
.
├── index.html                  # 首頁與工具入口
├── README.md
└── TripSplit
    ├── TripSplit.html          # 主要分帳頁面
    ├── css
    │   ├── base.css
    │   ├── forms.css
    │   └── hero.css
    ├── js
    │   ├── api.js              # GAS JSONP / POST 呼叫
    │   ├── balance.js          # 結餘與結清建議計算
    │   ├── config.js           # GAS endpoint、初始狀態與 fallback 資料
    │   ├── data.js             # 旅程與資料載入
    │   ├── events.js           # 表單與互動事件
    │   ├── normalize.js        # 後端資料格式正規化
    │   ├── receipt.js          # 收據預覽、壓縮、上傳 payload
    │   ├── render.js           # 畫面渲染
    │   ├── split.js            # 分帳設定與驗證
    │   └── sync.js             # 儲存後重新同步
    └── GS
        └── GS.gs               # Google Apps Script 後端
```

## 快速開始

這個專案不需要 npm 或建置流程，可以直接用瀏覽器開啟。

1. 下載或 clone 專案。
2. 開啟 `index.html` 作為首頁。
3. 或直接開啟 `TripSplit/TripSplit.html` 使用分帳工具。

如果瀏覽器對本機檔案有限制，建議用簡單的靜態伺服器啟動：

```powershell
python -m http.server 8000
```

然後在瀏覽器開啟：

```text
http://localhost:8000/
```

## Google Apps Script 設定

後端程式位於 `TripSplit/GS/GS.gs`，目前會使用：

- Google Sheet：儲存旅程、成員、分類、付款方式、匯率、支出、收據關聯與參與者資料。
- Google Drive：儲存收據圖片。
- Apps Script Web App：提供前端 JSONP 讀取與 POST 寫入。

部署流程：

1. 建立一份 Google Sheet。
2. 建立一個 Google Drive 資料夾，用來存放收據圖片。
3. 在 Google Apps Script 專案中貼上 `TripSplit/GS/GS.gs`。
4. 修改 `GS.gs` 內的設定：

```javascript
const SPREADSHEET_ID = '你的 Google Sheet ID';
const RECEIPT_FOLDER_ID = '你的 Google Drive 資料夾 ID';
```

5. 執行 `setupSheets()` 初始化工作表。
6. 部署為 Web App。
7. 將部署 ID 更新到 `TripSplit/js/config.js`：

```javascript
const GAS_DEPLOYMENT_ID = '你的 Apps Script 部署 ID';
```

## Google Sheet 資料表

`setupSheets()` 會建立以下工作表：

- `trips`
- `members`
- `categories`
- `payment_methods`
- `exchange_rates`
- `expenses`
- `expense_receipts`
- `expense_participants`

其中 `exchange_rates` 可透過 `syncExchangeRates()` 從 `open.er-api.com` 更新匯率；也可以在 Apps Script 中執行 `createDailyRateTrigger()` 建立每日更新排程。

## 前端資料流程

1. `events.js` 啟動頁面初始化。
2. `data.js` 從 Apps Script 載入旅程與目前旅程資料。
3. `normalize.js` 將 Google Sheet rows 轉成前端使用格式。
4. `render.js` 更新畫面。
5. 使用者送出表單後，`sync.js` 呼叫 Apps Script 儲存資料。
6. 儲存完成後重新載入目前旅程資料。

## 收據上傳流程

1. 使用者選取圖片或使用相機拍攝。
2. `receipt.js` 會先將圖片壓縮成 JPEG。
3. 前端把圖片轉成 base64，隨支出資料送到 Apps Script。
4. `GS.gs` 將圖片建立為 Google Drive 檔案。
5. Drive 檔案連結會寫回 `expense_receipts` 工作表。

目前前端限制最多上傳 `4` 張收據圖片，設定在 `TripSplit/js/config.js` 的 `MAX_RECEIPT_FILES`。

## 部署到 GitHub Pages

此專案是靜態網站，可直接部署到 GitHub Pages。

建議設定：

- Source：目前分支
- Root：repository root
- 首頁：`index.html`
- 工具頁：`TripSplit/TripSplit.html`

部署後請確認 `TripSplit/js/config.js` 的 Apps Script Web App URL 已可公開存取。

## 已知狀態

- 目前多個 HTML 與 JavaScript 檔案中的中文文案出現編碼亂碼，但功能結構仍可從程式碼辨識。
- `config.js` 內含目前使用中的 Apps Script deployment ID；若要改用自己的後端，需要替換該設定。
- Apps Script 的 `SPREADSHEET_ID` 與 `RECEIPT_FOLDER_ID` 是部署環境設定，公開專案時建議改成自己的資源 ID。

## 開發備註

- 專案目前沒有 package manager、build script 或測試框架。
- 前端以全域函式與全域狀態組成，載入順序依賴 `TripSplit/TripSplit.html` 底部的 `<script>` 順序。
- 若新增 JS 檔案，需要在 `TripSplit/TripSplit.html` 中手動加入引用。
- 若修改 GAS action 名稱，需同步更新前端呼叫端，例如 `addTrip`、`addMember`、`addExpense` 等。

