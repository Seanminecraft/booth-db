# 攤位資料庫網站 — 工程文件

版本 2026-11-23（phase 2）｜對象：接手維護的工程師｜語言：繁體中文（程式註解同）

> 本文件說明架構、資料流程、資料收集、資料結構、API、登入、審核、安全、部署、設定與測試。
> 隱私權政策見 `docs/PRIVACY.md`（草稿，需站長與工程師審閱，非法律意見）。

---

## 1. 總覽

| 元件 | 位置 | 說明 |
|---|---|---|
| 靜態網站 | `site/`（GitHub Pages） | 三語（中／EN／日）單頁應用，hash 路由。純 HTML/CSS/JS，無建置步驟。 |
| 後端 API | `apps-script/code.gs` | 綁定在「攤位資料庫」試算表的 Apps Script。`doGet`（公開讀取）、`doPost`（登入後寫入）。 |
| 主資料 | 試算表 `1nwZIqcrSz-vVJidCFJLmvDPNZvg7n-NVwnsdRmDFRao` | 分頁：新攤位資料庫、場次出展紀錄、認領申請、修改申請（另有既有分頁）。 |
| 場次整理表 | 每個場次一個試算表（例 FFK19、PF45、FF48…） | 格式固定（第 1 列標題、M–P 陣列公式、AR 每列公式）。由「整理中場次」清單登記。 |
| 關聯資料 | `site/data/relations.json` | 自動推估的「微弱關聯」與「社團／合攤」關係（只含攤主ID與原因字串）。 |
| 測試 | `tests/` | Node 模擬 Apps Script 環境（`gas-mock.js`）、端到端測試（`run-tests.js`）、本機開發伺服器（`dev-server.js`）。 |

```
 瀏覽器（GitHub Pages）
   │  GET  ?action=meta|index|owner|event          （公開、快取）
   │  POST {action:login|me|claim|edit|eventfill|thumb|checkThumb|preview|report|withdraw}
   ▼
 Apps Script Web App（執行身分：擁有者；存取：所有人）
   ├─ 讀寫 攤位資料庫（同檔案）：新攤位資料庫／場次出展紀錄／認領申請／修改申請
   ├─ 讀寫 場次整理表（其他檔案，openById）
   ├─ UrlFetch：Google tokeninfo（驗證 ID token）、lh3（縮圖公開檢查）、Safe Browsing v4
   ├─ CacheService：資料快取（分段）、頻率限制計數
   └─ MailApp：可疑修改通知站長
 站長在試算表裡：
   ├─ 修改申請「狀態」下拉選「核准／拒絕／復原」→ onEdit 立即套用（同檔案）
   └─ 選單「🗂 攤位資料庫網站」→ 審核、套用跨檔案、復原、停權、匯入新場次、併入主資料庫…
```

限制（使用者帳號已無法新增觸發）：**只用** 簡易觸發 `onOpen`、`onEdit` 與 Web App `doGet`、`doPost`。沒有可安裝觸發、沒有時間觸發。因此：
- 跨檔案寫入（場次整理表）不能在 onEdit 內完成（簡易觸發無權限開其他檔案），改由站長按選單「✅ 套用所有核准的申請」，或在即時制時由 `doPost` 直接寫入。
- 沒有排程清理；快取靠 TTL 自然過期，版本號由 onEdit／寫入時更新。

## 2. 資料流程

### 2.1 網站讀取（雙向連動：試算表 → 網站）
1. 網站先打 `meta`（極小）取得 `v`（資料版本號）。
2. `index`：所有攤主的精簡索引（約 520 KB）。伺服器以 `index@版本號` 為鍵分段快取（每段 90 KB，CacheService 上限 100 KB／值），TTL 6 小時。瀏覽器 sessionStorage 也以版本號快取。
3. 任何人手動修改「新攤位資料庫／場次出展紀錄／認領申請」時，`onEdit` 會換新版本號 → 下一次 `meta` 就拿到新版本 → 網站重新抓 `index`。也就是說站長在試算表直接改資料，網站幾秒內反映。
4. 場次整理表在其他檔案，onEdit 抓不到 → `event` 用 5 分鐘 TTL 快取。
5. `owner&id=Cxxxxx`：單一攤主的主資料列＋出展紀錄＋最近套用的修改。

### 2.2 攤主寫入（網站 → 試算表）
1. Google 登入 → `login` 取得 session。
2. 認領（`claim`）→ 認領申請新增一列「待審核」＋驗證碼 `JP-XXXXXX`。攤主用官方 SNS 發含驗證碼的貼文，貼上網址。
3. 站長在「認領申請」把狀態改「核准」→ 該帳號成為此攤主ID的管理者。
4. 攤主修改主資料（`edit`）或填寫場次（`eventfill`）：
   - 網站先呼叫 `preview` 顯示差異、正規化後的網址、風險分數、會被拒絕的欄位（不寫入）。
   - 送出後伺服器重新驗證（不信任前端），每一欄一列寫入「修改申請」。
   - **審核制（預設 `EVENT_FILL_MODE=queue`）**：全部「待審核」，站長核准後才寫入。
   - **即時制（`live`）**：已核准攤主、風險 < 30、非身分欄位 → 立即寫入場次整理表並記錄「套用位置／套用前值」（可一鍵復原）；其餘仍待審核。主資料庫（新攤位資料庫）的修改一律走審核。
5. 套用：同檔案（新攤位資料庫、場次出展紀錄）在 onEdit 立即套用；跨檔案（場次整理表）由選單套用。

### 2.3 新場次匯入（📥 匯入新場次攤位名單…）
1. 主辦方名單（xlsx/csv 先上傳雲端硬碟並以 Google 試算表開啟）。程式自動找標題列（攤位編號／社團名稱／參加日期／作者等關鍵字），同名攤位合併、依編號排序、分第一天／第二天。
2. 先 dry-run 顯示攤位數、同名命中數、前 5 筆，確認後才建立。
3. `DriveApp.makeCopy` 複製範本（預設為最近一個整理中場次的整理表，例如 FFK19），放在同一資料夾，命名「FF48 完整攤位整理」。
4. 清空資料列但保留：第 1 列 M–P 的 `BYROW/MAP` 陣列公式、AR「是否有縮圖」每列公式（以 R1C1 重建到每一列）、所有格式與其他分頁。操作手冊分頁的場次代碼（例 FFK19 → FF48）會被取代。
5. 依攤名比對主資料庫預先帶入創作者類型與 SNS；比對不到再用「場次出展紀錄」同名沿用既有攤主ID；都沒有則發新攤主ID（`NEXT_OWNER_SEQ`）。
6. 寫入「場次出展紀錄」（對應方式：匯入：同名（主資料庫）／匯入：同名（出展紀錄）／匯入：同名多攤主，需確認／匯入：新攤主），登記到 `ACTIVE_EVENTS`，網站「整理中場次」立即出現新分頁。
7. 匯入後請人工檢查：操作手冊文字、「整理進度」分頁的 IMPORTRANGE 來源、AR 欄縮圖試算表網址（新檔第一次需要按「允許存取」）。

### 2.4 場次結束 → 併入主資料庫（📤）
`mergeEventToDb_(code, policy)`：依「場次出展紀錄」的攤主ID對應主資料列。空白欄補上；衝突時 `event_wins`（預設，與 PF45 決策一致）或 `db_wins`；新攤主新增列。所有變更以「場次併入」類型寫入修改申請（同一批次ID，可整批復原）。

## 3. 資料收集（收什麼、存哪裡）

| 資料 | 來源 | 存放 | 公開？ |
|---|---|---|---|
| 攤名、筆名、創作者類型、SNS 連結、販售資訊、縮圖連結 | 攤主公開資訊、主辦名單、tw-doujin.info、各場次整理表 | 新攤位資料庫、場次整理表、場次出展紀錄 | 是（網站顯示） |
| 申請者代號 `u_…` | `HMAC-SHA256('sub:'+Google sub, HMAC_SECRET)` 前 22 字元（base64url） | 認領申請 E 欄、修改申請 J 欄 | 否（網站只顯示前 8 碼給本人） |
| 認領證據 | 攤主提交的貼文網址、說明 | 認領申請 | 否 |
| 修改內容 | 攤主提交 | 修改申請（舊值、新值、風險、套用位置） | 套用後的值公開 |
| 頻率限制計數 | 伺服器 | CacheService（≤ 24h） | 否 |

**不儲存**：email、姓名、大頭貼、Google sub 原文、IP、User-Agent。`verifyIdToken_` 只取 `sub`；測試 §11「任何工作表都沒有 email／姓名／sub」會掃描所有分頁確認。
**刪除**：`withdraw` 清除所有列中的申請者代號（逐格寫入，保留其餘稽核資料）。

## 4. 資料結構

### 4.1 新攤位資料庫（sheetId 5760389）
原有 A–Y 欄（攤位名稱、筆名、創作者類型、FB (1)、FB (2)、Bluesky (1)…其他連結 等），**Z 欄「攤主ID」**（2026-11-23 新增）。資料列 2–4865（4,864 列）。同一攤主可有多列（改名），以攤主ID群組。欄位以「標題文字」定位（`headerMap_`，忽略空白與全形括號），不依賴欄位字母。

### 4.2 場次出展紀錄（sheetId 949560322）
| 欄 | 標題 | 說明 |
|---|---|---|
| A | 紀錄ID | E00001… |
| B | 場次 | 代碼，例 FF47、PF45、FFK19 |
| C | 場次名稱 | |
| D | 日期 | YYYY-MM-DD |
| E | 當屆攤名 | |
| F | 攤位號 | 「第一天 / 第二天」 |
| G | 攤主ID | |
| H | 對應方式 | 同名（主資料庫同名列）／僅場次紀錄（未入主資料庫）／關聯分析（SNS／筆名）／匯入：… |
| I | 信心 | high／medium／single |
| J | 同名DB列(寫入時) | 寫入當下主資料庫的列號（參考用，之後可能變動） |
| K | 來源 | tw-doujin.info／PF45 整理表／主辦攤位名單匯入… |
| L | 縮圖檔案ID | Drive 檔案 ID |
| M | 縮圖狀態 | 公開／未公開（網站隱藏）／僅檔名（網站隱藏） |
| N | 備註 | |

### 4.3 認領申請（sheetId 833105830）
申請ID、申請時間、攤主ID、攤位名稱、申請者代號、驗證方式、驗證連結、驗證碼、說明、**狀態**（待審核／核准／拒絕／停權／撤銷，J 欄下拉）、審核時間、審核備註、角色、最後活動。
- 停權單一帳號：狀態改「停權」（或選單 ⛔ 輸入 `u_…`）。
- 鎖定整個攤主（任何人都不能認領或修改）：選單 ⛔ 輸入 `C…`，會新增一列申請者代號為 `*`、狀態「停權」。恢復：輸入 `+C…`。

### 4.4 修改申請（sheetId 1572054327）
申請ID、申請時間、類型（主資料／場次填寫／縮圖／關聯回報／場次併入）、攤主ID、目標（分頁或場次代碼）、目標鍵（攤名或紀錄ID）、欄位、舊值、新值、申請者代號、風險（0–100）、風險說明、**狀態**（待審核／核准／拒絕／已套用／復原／已復原／需人工，M 欄下拉）、審核時間、審核備註、套用位置（例 `新攤位資料庫!M2843`、`FFK19!K4`）、套用前值、套用時間、批次ID。

### 4.5 場次整理表（每場次一檔）
第 1 列標題（攤位名稱、筆名、第一天、第二天、…、FB (1)…其他連結、預告、品書、預購/通販、縮圖[請備註]、是否有縮圖、試閱、Bot用）。
- 攤主可填：`EVENT_EDITABLE`（筆名、創作者類型、商品年齡分類、作品類型、二創參考作品、販售資訊、特殊標籤或備註、所有 SNS、預告、品書、預購/通販、賣場、縮圖[請備註]、試閱）。
- 不可填：攤位名稱、第一天／第二天／第三天、有無…（公式）、資料信心度、是否有縮圖（公式）、Bot用、印量調查。
- 列定位 `locateEventRow_`：攤名完全相符 → 正規化攤名相符 → 攤位號相符；若同名多列（例「神之熾火」）→ 拒絕自動寫入，交站長處理。

### 4.6 Script Properties（設定與密鑰）
| 鍵 | 必填 | 說明 |
|---|---|---|
| `HMAC_SECRET` | ✔ | 選單「🔑 初始化設定」自動產生 64 字元隨機值。**更換會讓所有既有 session 與申請者代號失效**（等於所有攤主需重新認領）。 |
| `OAUTH_CLIENT_ID` | ✔ | Google OAuth 用戶端 ID（網頁應用程式）。伺服器用來比對 ID token 的 `aud`。 |
| `EVENT_FILL_MODE` | | `queue`（預設）／`live`。選單可切換。 |
| `ACTIVE_EVENTS` | | 整理中場次 JSON：`[{code,name,start,sheetId,tab,status}]`。選單維護。 |
| `SAFE_BROWSING_API_KEY` | | 未設定時略過，審核畫面顯示「Safe Browsing 未檢查」。 |
| `ALERT_EMAIL` | | 通知信箱；未設定時寄給指令碼擁有者。 |
| `SITE_ORIGIN` | | 通知信中的網站連結。 |
| `NEXT_OWNER_SEQ` | 自動 | 新攤主ID流水號。 |

程式碼中**沒有任何密鑰**。網站端 `config.js` 只有公開值（API 網址、OAuth Client ID、聯絡方式），由 GitHub Actions 依 repository variables 產生。

## 5. API

所有回應 `{"ok":true,...}` 或 `{"ok":false,"error":"..."}`（HTTP 一律 200，Apps Script 限制）。POST 使用 `Content-Type: text/plain`（避免 CORS 預檢；Apps Script 不處理 OPTIONS）。

### GET
| action | 參數 | 回應 |
|---|---|---|
| `meta` | | `version, v, active[], fillMode, clientId` |
| `index` | | `data: {v, built, events{code:[name,date]}, active[], owners[[id,name,variants,type,events,thumb,platforms,dbRows,handles]], fields}` |
| `owner` | `id=C\d{5,}` | `data: {id, dbRows[{row,fields}], history[{ev,evName,date,name,booth,how,conf,thumb,thumbHidden}], recentEdits[]}` |
| `event` | `code` | `data: {code,name,start,mode,booths[{row,name,day1,day2,id,fields,thumb}]}`（只有整理中場次） |

### POST（除 `login` 外都需要 `session`）
| action | body | 說明 |
|---|---|---|
| `login` | `idToken` | 驗證 Google ID token → `session`（12h）、`me` |
| `me` | | `{uid(前 8 碼), owned[], pending[], suspended, fillMode, active[]}` |
| `claim` | `ownerId, proofUrl?, method(post|dm), note?` | 新增／查詢認領，回傳 `{status, code}` |
| `preview` | `changes{欄位:值}, old{欄位:值}` | 逐欄驗證結果 `{ok,value,risk,notes,block,sensitive}`，不寫入 |
| `edit` | `ownerId, rowName, changes` | 主資料修改 → 修改申請 |
| `eventfill` | `ownerId, event, booth, boothNo, changes` | 場次填寫（queue/live） |
| `checkThumb` | `url` | `{fileId, status: PUBLIC|NOT_PUBLIC|NOT_FOUND|NOT_IMAGE|BAD_LINK|ERROR}` |
| `thumb` | `ownerId, url, event?, booth?, boothNo?` | 縮圖申請（有 event 時等同 eventfill 的縮圖欄） |
| `report` | `a, b, kind(merge|split), note` | 關聯錯誤回報 |
| `withdraw` | | 清除本人所有申請者代號，回傳清除格數 |

頻率限制（`LIMITS`，每帳號）：login 20/小時、claim 3/日、edit 20/日、eventfill 30/日、thumb 30/小時、report 10/日。超過時拒絕並通知站長。

## 6. 登入（Google Identity Services）

1. 網站載入 `https://accounts.google.com/gsi/client`，以 `OAUTH_CLIENT_ID` 顯示「用 Google 登入」按鈕，取得 ID token（JWT）。
2. `login` → 伺服器呼叫 `https://oauth2.googleapis.com/tokeninfo?id_token=…`，檢查 `aud == OAUTH_CLIENT_ID`、`iss ∈ {accounts.google.com, https://accounts.google.com}`、`exp` 未過期。
3. `uid = 'u_' + base64url(HMAC_SHA256('sub:'+sub, HMAC_SECRET))[0:22]`。只保留 uid；token、email、name 直接丟棄。
4. session = `base64url(JSON{u:uid, e:到期毫秒}) + '.' + base64url(HMAC_SHA256('sess:'+前段, HMAC_SECRET))`（無狀態，12 小時）。存在瀏覽器 sessionStorage，關閉分頁即消失。竄改簽章會被拒絕（測試 §2）。

## 7. 審核與復原

- **審核畫面**（選單 🔍）：HtmlService 範本，所有資料以 `<?= ?>` 自動跳脫；顯示每筆待審核的欄位、舊值→新值差異、正規化後網址的網域、風險分數與原因、Safe Browsing 結果。按鈕：核准、二次驗證後核准、拒絕。
- **身分欄位**（攤位名稱，或「取代」FB (1)／TWITTER (1)／IG／Pixiv／PLURK／Bluesky (1) 的既有值）屬敏感修改：審核備註需含「二次驗證OK」才會套用（審核畫面的「二次驗證後核准」會自動填），否則狀態變「需人工」。建議由第二位站長或用其他管道向攤主確認後再核准（two-person rule）。
- **套用**：寫入前會比對目標格目前值是否仍等於申請時的舊值（避免覆蓋別人的修改）；記錄套用位置、套用前值、套用時間。
- **復原**：狀態改「復原」（同檔案 onEdit 立即復原）或選單 ↩️（選取列）、⏪（某攤主近 N 小時所有已套用修改＋拒絕其待審核申請）。復原同樣會檢查目前值是否等於套用後的值。
- **只有出展紀錄的攤主（新列模式，2026-11-23-p2.1 起）**：有些攤主只出現在「場次出展紀錄」，「新攤位資料庫」還沒有資料列（例：C02492 加帕利天藍怪預警中心）。管理者送出修改時，伺服器以最近一屆攤名當列名、在備註加「新增主資料列」排入審核；第一筆被核准時才在「新攤位資料庫」最後新增一列（只寫攤位名稱＋攤主ID），再寫入該欄位，套用位置記錄在修改申請。之後的申請直接用這一列。復原只清該格，新增的列保留（要刪請手動刪整列）。
- **停權**：⛔ 選單，帳號或整個攤主。

## 8. 安全模型（防惡意接手）

| 威脅 | 對策 |
|---|---|
| 冒名認領 | 認領需站長核准；驗證碼需由官方 SNS 發文，系統比對貼文帳號是否在資料庫既有 SNS 中並標示「相符／⚠ 不在資料庫」；鎖定攤主。 |
| 已核准帳號被盜／惡意修改 | 預設審核制；身分欄位需二次驗證；頻率限制；高風險與身分欄位修改寄通知信；一鍵復原某攤主近期全部修改；停權。 |
| 惡意連結 | 每欄網域白名單（`FIELD_DOMAINS`，例 IG 只接受 instagram.com）；只接受 http(s)；拒絕縮網址（bit.ly、reurl.cc、lihi…）、IP 網址、含帳密網址、`javascript:`；punycode（xn--）加風險；移除 utm/fbclid 等追蹤參數；Safe Browsing v4 檢查；網站端連結一律 `rel="noopener noreferrer nofollow ugc"`、`referrerpolicy=no-referrer`。 |
| XSS／HTML 注入 | 伺服器拒絕含 HTML 標籤的內容；網站只用 `textContent` 建 DOM（無 innerHTML）；CSP 限制 script/connect/img 來源；審核畫面自動跳脫。 |
| 試算表公式注入 | 所有寫入值經 `safeCell_`：以 `= + - @` 開頭者前置 `'` 存成純文字（FFK19 測試副本實測 `'=1+1` 顯示為文字 `=1+1`，未被計算）。 |
| 不雅／非公開縮圖 | 只接受 Drive 連結；伺服器以匿名請求 lh3 確認公開且為圖片；未公開或只有檔名的縮圖不顯示；縮圖申請一律待審核（主資料）。 |
| 竄改 session | HMAC 簽章＋到期時間。 |
| 洗版 | 頻率限制（CacheService 計數）＋通知。 |
| 站長誤操作 | 所有寫入記錄在修改申請，可復原；寫入前備份（見 CHANGELOG_WRITES.md）。 |

已知限制：
- 擁有試算表編輯權的人都能改狀態欄＝核准。請只把編輯權給站長。
- Apps Script Web App 無法取得用戶 IP，頻率限制以帳號為單位；攻擊者可開多個 Google 帳號，但每個帳號都需先通過人工認領才能修改資料。
- Safe Browsing 需要 API 金鑰（選填）。
- 簡易觸發 onEdit 無法寄信或開其他檔案，跨檔案套用需按選單。

## 9. 部署

### 9.1 Apps Script（後端）
1. 開啟「攤位資料庫」試算表 → 擴充功能 → Apps Script。
2. 把 `apps-script/code.gs` **整份貼上**取代原本的 code.gs，儲存。
3. 回到試算表重新整理 → 選單「🗂 攤位資料庫網站」→「🔑 初始化設定」（產生 HMAC_SECRET、可順便輸入 OAuth Client ID；第一次會要求授權）。四個分頁（含 攤主ID 欄）已於 2026-11-23 建好。
4. 專案設定 → 指令碼屬性：填 `OAUTH_CLIENT_ID`（見 9.2），選填 `SAFE_BROWSING_API_KEY`、`ALERT_EMAIL`、`SITE_ORIGIN`。
5. 選單「🧪 自我檢查（不寫入）」確認分頁、標題、設定都正確。
6. 部署 → 新增部署 → 類型「網頁應用程式」→ 執行身分「我」、存取權「所有人」→ 部署，複製 `/exec` 網址。之後改程式要「管理部署 → 編輯 → 新版本」，網址不變。
7. 選單「⚙️ 整理中場次設定」→ `add FFK19｜Fancy Frontier 開拓動漫祭 高雄場 19｜2026-12-05｜<FFK19 整理表網址>`（正式上線前先用測試副本）。

### 9.2 Google OAuth 用戶端
Google Cloud Console（與 Apps Script 同一專案或任一專案）→ API 和服務 → OAuth 同意畫面（外部、只需 `openid`／基本範圍；隱私權政策網址填 `https://<網站>/privacy.html`）→ 憑證 → 建立 OAuth 用戶端 ID → 網頁應用程式 → 已授權的 JavaScript 來源：`https://<帳號>.github.io`（以及自訂網域）。不需要重新導向 URI。複製用戶端 ID。

### 9.3 GitHub Pages（前端）
1. 建立 repo，推送本資料夾（**尚未推送，等待站長同意**）。
2. Settings → Pages → Source：GitHub Actions。
3. Settings → Secrets and variables → Actions → **Variables**：`API_URL`（9.1 的 /exec 網址）、`OAUTH_CLIENT_ID`、`CONTACT`。
4. 推送到 `main` 即自動部署（`.github/workflows/deploy.yml`：語法檢查 → 產生 config.js → 發佈 `site/`）。
5. 平板操作：以上都能在 GitHub 網頁版完成；改設定只需改 Variables 後在 Actions 按「Run workflow」。

## 10. 站長選單

| 項目 | 用途 |
|---|---|
| 🔍 審核待處理申請 | 預覽差異與連結、核准／二次驗證後核准／拒絕 |
| ✅ 套用所有「核准」的申請 | 處理跨檔案（場次整理表）與 onEdit 未處理的核准列 |
| ↩️ 復原選取的修改申請列 | 選取列後執行 |
| ⏪ 一鍵復原某攤主的近期修改 | 輸入 `C00045 72`（小時，預設 72） |
| ⛔ 停權／恢復 | `u_…`（帳號）或 `C…`（攤主）；恢復加 `+` |
| 📥 匯入新場次攤位名單 | 見 2.3 |
| 📤 場次整理表 → 併入新攤位資料庫 | 見 2.4；`FFK19` 或 `FFK19 db` |
| ⚙️ 整理中場次設定 | `add 代碼｜名稱｜開始日｜網址`、`remove 代碼` |
| ⚙️ 切換場次填寫模式 | queue ↔ live |
| 🔄 清除網站快取 | 換新版本號 |
| 🧪 自我檢查 | 不寫入的設定檢查 |
| 🔑 初始化設定 | 產生 HMAC_SECRET（不覆蓋既有值）、輸入 OAuth Client ID、預設審核制、可選擇登記第一個整理中場次 |

## 11. 測試

```
node tests/run-tests.js [fixtures 目錄]     # 端到端，83 項
node tests/dev-server.js 8787              # 本機網站＋模擬 API（假登入 dev-owner-1 管 C00968、dev-owner-2 管 C02492）
PUPPETEER_PATH=…/puppeteer-core node tests/ui-regression-c02492.js   # 攤主頁「編輯」按鈕與新列表單的 UI 回歸（需先開 dev-server）
```
- `gas-mock.js` 模擬 SpreadsheetApp、CacheService、PropertiesService、Utilities（HMAC/base64）、UrlFetchApp、ContentService、LockService、MailApp、DriveApp.makeCopy、HtmlService 範本。
- fixtures（`fixture_db.json`、`fixture_log.json`、`fixture_ffk19.json`）是真實試算表的匯出，**不放進 repo**（隱私與檔案大小），由維護者自行從試算表匯出放在 `../test-fixtures/`。
- 測試涵蓋：公開 API、快取、登入雜湊、認領／核准、修改／套用／復原、各種惡意連結、審核畫面跳脫、一鍵復原、停權、頻率限制、FFK19 場次填寫（審核制／即時制／鎖定欄位／別人的攤位／同名多列）、縮圖公開檢查、FF48 匯入（公式保留、預先帶入、沿用攤主ID）、併入主資料庫、撤回、只有出展紀錄的攤主（C02492 回歸：新列模式送出、核准後新增一列、復原、非管理者被拒）、全分頁個資掃描、自我檢查。
- `run-tests.js` 會輸出 `tests/ffk19_expected_writes.json`（預期寫入的格子），用來在真實 FFK19 **測試副本**重播並讀回驗證。2026-11-23 結果見 `docs/TEST_REPORT.md`。

## 12. 前端

- `site/index.html`：CSP、載入順序 config → i18n → privacy → vis-network → app。
- `assets/app.js`：路由 `#/`（搜尋、統計、整理中場次、曾改名攤主）、`#/o/Cxxxxx`（攤主頁、關聯圖、出展紀錄、認領、回報）、`#/events/CODE`（各整理中場次分頁、攤位卡、填寫）、`#/me`（登入、我管理的攤主、修改、撤回）、`#/privacy`。
- `assets/i18n.js`：介面文字三語。資料本身不翻譯；伺服器錯誤訊息為中文。
- `assets/privacy.js`：隱私權政策單一來源 → `node tools/build-privacy-md.js` 產生 `docs/PRIVACY.md` 與 `site/privacy.html`。
- 瀏覽器儲存：localStorage `lang`；sessionStorage `bdb_session`、`bdb_index`（依版本號）、`bdb_q`（搜尋字）。不使用 cookie。
- 縮圖：`https://lh3.googleusercontent.com/d/<id>=w480`，只對伺服器回報為公開的 ID。

## 13. 維運備忘

- 改欄位標題：程式以標題比對，改名後請同步修改 `DB_EDITABLE`／`EVENT_EDITABLE`／`FIELD_DOMAINS`。
- 新增白名單網域：`FIELD_DOMAINS`（限定欄位）或 `KNOWN_DOMAINS`（降低風險分數）。
- `relations.json` 由 `linkage_v2.py`（資料整理工具，不在 repo）產生；更新後推送即可。
- 備份：任何批次寫入前用雲端硬碟「建立副本」並匯出 xlsx。
