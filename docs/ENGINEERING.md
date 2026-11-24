# 攤位資料庫網站 — 工程文件

版本 2026-11-24（phase 6，Apps Script `VERSION = '2026-11-24-p6'`）｜對象：接手維護的工程師｜語言：繁體中文（程式註解同）

> 本文件說明架構、資料流程、資料收集、資料結構、API、登入、審核、安全、部署、設定與測試。
> 隱私權政策見 `docs/PRIVACY.md`（已由站長審閱）。使用說明：網站 `#/help`（攤主，三語）、站長後台「📘 使用說明」（中文）。
>
> **⚠ 營運規則：試算表編輯者＝全部權限**（可讀 HMAC_SECRET、改程式、直接改狀態欄）。只在網站審核的站長**不要**給試算表編輯權；試算表只分享給擁有者本人。後台「⚙️ 站長與安全」與選單「🧪 自我檢查」會顯示目前編輯者人數。

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
2. 認領（`claim`）：先以 `preview:true` 取得驗證碼 `JP-XXXXXX`（不寫入）；攤主選一種驗證方式後送出 → 認領申請新增一列「待審核」。驗證方式（p5）：① `sns` SNS 貼文（必須貼「含驗證碼的那則貼文」網址）；② `dm` 私訊 FB 粉專 https://www.facebook.com/JapariWeatherBureau/ 或 LINE 官方帳號 https://lin.ee/qo1OC8v；③ `discord` 在動漫同人展資訊組 Discord https://discord.gg/nFTsSR9HAf 的「攤位整理系統後台 攤主權限申請」頻道貼驗證碼。②③ 不收網址。已有待審核申請時再送出＝更新同一列的驗證方式／貼文／說明。三種方式一律要站長人工核准。
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
申請ID、申請時間、攤主ID、攤位名稱、申請者代號、驗證方式（`SNS 貼文`／`私訊粉專／LINE`／`Discord`；舊資料可能是 `私訊官方粉專`）、驗證連結（只有 SNS 貼文有）、驗證碼、說明、**狀態**（待審核／核准／拒絕／停權／撤銷，J 欄下拉）、審核時間、審核備註、角色、最後活動。
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
| `claim` | `ownerId, preview?, method(sns|dm|discord；舊值 post＝sns), proofUrl（sns 必填）, note?` | `preview:true`：只回傳 `{status: 未送出|待審核|已核准, code, method?}`，不寫入；否則新增或更新待審核認領，回傳 `{status, code, method, updated?}`。沒帶 method 的舊前端呼叫維持 p4 行為（建立 SNS 貼文申請、貼文選填）。 |
| `preview` | `changes{欄位:值}, old{欄位:值}` | 逐欄驗證結果 `{ok,value,risk,notes,block,sensitive}`，不寫入 |
| `edit` | `ownerId, rowName, changes` | 主資料修改 → 修改申請 |
| `eventfill` | `ownerId, event, booth, boothNo, changes` | 場次填寫（queue/live） |
| `checkThumb` | `url` | `{fileId, status: PUBLIC|NOT_PUBLIC|NOT_FOUND|NOT_IMAGE|BAD_LINK|ERROR}` |
| `thumb` | `ownerId, url, event?, booth?, boothNo?` | 縮圖申請（有 event 時等同 eventfill 的縮圖欄） |
| `report` | `a, b, kind(merge|split), note` | 關聯錯誤回報 |
| `withdraw` | | 清除本人所有申請者代號，回傳清除格數 |

頻率限制（`LIMITS`，每帳號）：login 20/小時、claim 3/日（送出，失敗也算）、claimcode 60/日（preview）、edit 20/日、eventfill 30/日、thumb 30/小時、report 10/日。超過時拒絕並通知站長。

## 6. 登入（Google Identity Services）

1. 網站載入 `https://accounts.google.com/gsi/client`，以 `OAUTH_CLIENT_ID` 顯示「用 Google 登入」按鈕，取得 ID token（JWT）。
2. `login` → 伺服器呼叫 `https://oauth2.googleapis.com/tokeninfo?id_token=…`，檢查 `aud == OAUTH_CLIENT_ID`、`iss ∈ {accounts.google.com, https://accounts.google.com}`、`exp` 未過期。
3. `uid = 'u_' + base64url(HMAC_SHA256('sub:'+sub, HMAC_SECRET))[0:22]`。只保留 uid；token、email、name 直接丟棄。
4. session = `base64url(JSON{u:uid, e:到期毫秒}) + '.' + base64url(HMAC_SHA256('sess:'+前段, HMAC_SECRET))`（無狀態，12 小時）。存在瀏覽器 sessionStorage，關閉分頁即消失。竄改簽章會被拒絕（測試 §2）。

## 7. 審核與復原

- **審核畫面**（選單 🔍）：HtmlService 範本，所有資料以 `<?= ?>` 自動跳脫；顯示每筆待審核的欄位、舊值→新值差異、正規化後網址的網域、風險分數與原因、Safe Browsing 結果。按鈕：核准、二次驗證後核准、拒絕。
- **身分欄位**（`IDENTITY_FIELDS`＝攤位名稱＋`FIELD_DOMAINS` 的所有 URL／SNS 欄位：FB (1)(2)、Bluesky (1)(2)、TWITTER (1)(2)、PLURK、Pixiv、Fanbox、Fantia、可洛斯、IG、YOUTUBE、TWITCH、LINE、DISCORD、巴哈姆特、縮圖、其他贊助平台、官方網站、Linktree、其他連結、預告、品書、預購/通販、賣場、試閱）：**取代或清空**既有值屬敏感修改；**空白欄位第一次填入不算**。審核備註需含「二次驗證OK」才會套用（審核畫面的「二次驗證後核准」會自動填），否則狀態變「需人工」。建議由第二位站長或用其他管道向攤主確認後再核准（two-person rule）。
- **套用**：寫入前會比對目標格目前值是否仍等於申請時的舊值（避免覆蓋別人的修改）；記錄套用位置、套用前值、套用時間。
- **復原**：狀態改「復原」（同檔案 onEdit 立即復原）或選單 ↩️（選取列）、⏪（某攤主近 N 小時所有已套用修改＋拒絕其待審核申請）。復原同樣會檢查目前值是否等於套用後的值。
- **只有出展紀錄的攤主（新列模式，2026-11-23-p2.1 起）**：有些攤主只出現在「場次出展紀錄」，「新攤位資料庫」還沒有資料列（例：C02492 加帕利天藍怪預警中心）。管理者送出修改時，伺服器以最近一屆攤名當列名、在備註加「新增主資料列」排入審核；第一筆被核准時才在「新攤位資料庫」最後新增一列（只寫攤位名稱＋攤主ID），再寫入該欄位，套用位置記錄在修改申請。之後的申請直接用這一列。復原只清該格，新增的列保留（要刪請手動刪整列）。
- **停權**：⛔ 選單，帳號或整個攤主。

## 8. 安全模型（防惡意接手）

| 威脅 | 對策 |
|---|---|
| 冒名認領 | 認領需站長核准；驗證連結必須是「一則貼文」網址（`POST_URL_RES`：X/Twitter status、FB posts/permalink、IG p/reel、噗浪 p、Bluesky post、Threads post）；系統只比對「帳號」（`snsKey_` 依平台取帳號鍵，主機名本身不算相符），相符時標示「帳號相符，仍需確認貼文含驗證碼」——站長仍要打開貼文確認驗證碼；鎖定攤主。 |
| 已核准帳號被盜／惡意修改 | 預設審核制；身分欄位需二次驗證；頻率限制；高風險與身分欄位修改寄通知信；一鍵復原某攤主近期全部修改；停權。 |
| 惡意連結 | 每欄網域白名單（`FIELD_DOMAINS`，例 IG 只接受 instagram.com）；只接受 http(s)；拒絕縮網址（bit.ly、reurl.cc、lihi…）、IP 網址、含帳密網址、`javascript:`；punycode（xn--）加風險；移除 utm/fbclid 等追蹤參數；Safe Browsing v4 檢查；網站端連結一律 `rel="noopener noreferrer nofollow ugc"`、`referrerpolicy=no-referrer`。 |
| XSS／HTML 注入 | 伺服器拒絕任何 `<` 後接字母、`/`、`!`、`?` 的內容（`/<\s*[A-Za-z\/!?]/`）；網站只用 `textContent` 建 DOM（無 innerHTML）；CSP 限制 script/connect/img 來源；審核畫面自動跳脫。 |
| 試算表公式注入 | 所有寫入值經 `safeCell_`：以 `= + - @` 開頭者前置 `'` 存成純文字（FFK19 測試副本實測 `'=1+1` 顯示為文字 `=1+1`，未被計算）。 |
| 不雅／非公開縮圖 | 只接受 Drive 連結；伺服器以匿名請求 lh3 確認公開且為圖片；未公開或只有檔名的縮圖不顯示；縮圖申請一律待審核（主資料）。 |
| 竄改 session | HMAC 簽章＋到期時間。 |
| 洗版 | 頻率限制（CacheService 計數）＋通知。 |
| 站長誤操作 | 所有寫入記錄在修改申請，可復原；寫入前備份（見 CHANGELOG_WRITES.md）。 |

已知限制：
- 擁有試算表編輯權的人都能改狀態欄＝核准、讀密鑰、改程式。**只把編輯權給擁有者本人**；網站站長不需要也不應有編輯權。
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
4. 推送到 `main` 即自動部署（`.github/workflows/deploy.yml`：語法檢查 → 產生 config.js → **公開資料快照** `tools/snapshot.js` → 發佈 `site/`）。另有每小時排程（cron `17 * * * *`）重新產生快照；repo 60 天沒有活動時 GitHub 會暫停排程，到 Actions 頁按「Enable workflow」即可。所有 Actions 都釘在 commit SHA（註解標示版本）。
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
| 🧱 站長功能初始化 | 先用雲端硬碟建立整份試算表的副本（`攤位資料庫 備份 <時間>（站長功能初始化前）`），再建立「站長操作紀錄」「關聯判定」「ID 合併對照」三個分頁（已存在則不動） |
| 👑 新增站長帳號（配對碼） | 只有試算表擁有者能執行；輸入網站產生的 8 碼配對碼（10 分鐘有效、一次性）。第一位站長會詢問是否為「擁有者站長」 |
| 👥 站長名單 | 列出 ADMIN_UIDS（代號前幾碼、暱稱、角色、加入時間） |

## 11. 測試

```
node tests/run-tests.js [fixtures 目錄]     # 端到端，152 項
node tests/dev-server.js 8787              # 本機網站＋真實 code.gs（假登入 dev-owner-1 管 C00968、dev-owner-2 管 C02492、dev-admin＝擁有者站長小編A、dev-admin-2＝站長小編B；`dev-admin~stale` 模擬 20 分鐘前登入）
NO_SEED=1 node tests/dev-server.js 8787    # 不放樣本申請
PUPPETEER_PATH=…/puppeteer-core node tests/ui-regression-c02492.js   # 攤主頁「編輯」按鈕與新列表單的 UI 回歸（需先開 dev-server）
```
- `gas-mock.js` 模擬 SpreadsheetApp、CacheService、PropertiesService、Utilities（HMAC/base64）、UrlFetchApp、ContentService、LockService、MailApp、DriveApp.makeCopy、HtmlService 範本。
- fixtures（`fixture_db.json`、`fixture_log.json`、`fixture_ffk19.json`）是真實試算表的匯出，**不放進 repo**（隱私與檔案大小），由維護者自行從試算表匯出放在 `../test-fixtures/`。
- 測試涵蓋：公開 API、快取、登入雜湊、認領／核准、修改／套用／復原、各種惡意連結、審核畫面跳脫、一鍵復原、停權、頻率限制、FFK19 場次填寫（審核制／即時制／鎖定欄位／別人的攤位／同名多列）、縮圖公開檢查、FF48 匯入（公式保留、預先帶入、沿用攤主ID）、併入主資料庫、撤回、只有出展紀錄的攤主（C02492 回歸：新列模式送出、核准後新增一列、復原、非管理者被拒）、全分頁個資掃描、自我檢查。
- `run-tests.js` 會輸出 `tests/ffk19_expected_writes.json`（預期寫入的格子），用來在真實 FFK19 **測試副本**重播並讀回驗證。2026-11-23 結果見 `docs/TEST_REPORT.md`。

## 12. 前端

- `site/index.html`：CSP、載入順序 config → i18n → privacy → help → admin → app。vis-network 不在首頁載入，需要畫圖時才由 `loadVis()` 動態載入。
- `assets/app.js`：路由 `#/`（搜尋、統計、整理中場次、曾改名攤主）、`#/o/Cxxxxx`（攤主頁、關聯圖、出展紀錄、認領、回報）、`#/events/CODE`（各整理中場次分頁、攤位卡、填寫）、`#/me`（登入、我管理的攤主、修改、撤回）、`#/privacy`、`#/help`（使用說明，可 `#/help/claim` 直接跳到某一節）。
- `assets/admin.js`：站長後台 `#/admin/(queue|events|relations|owners|audit|settings|help)`，只有中文；權限由伺服器判斷（非站長只看到拒絕畫面）。
- `assets/theme.js`：淺色／深色／跟隨系統，在 `<head>` 同步執行避免閃爍；`?theme=` 可指定。
- 首頁：數字統計下方是全站關聯圖（`relations.json` ＋伺服器 `relations` 覆蓋層）；手機（≤720px）點一下才載入；可勾選顯示兩兩相連的小關係。`#/all`：全部攤位列表。
- `assets/i18n.js`：介面文字三語。資料本身不翻譯；伺服器錯誤訊息為中文。
- `assets/privacy.js`：隱私權政策單一來源 → `node tools/build-privacy-md.js` 產生 `docs/PRIVACY.md` 與 `site/privacy.html`。
- 瀏覽器儲存：localStorage `lang`、`theme`（light／dark／system）；sessionStorage `bdb_pairs`（首頁是否顯示兩兩相連）、`bdb_devsub`（僅開發模式）、sessionStorage `bdb_session`、`bdb_index`（依版本號）、`bdb_q`（搜尋字）。不使用 cookie。
- 縮圖：`https://lh3.googleusercontent.com/d/<id>=w480`，只對伺服器回報為公開的 ID。

## 13. 維運備忘

- 改欄位標題：程式以標題比對，改名後請同步修改 `DB_EDITABLE`／`EVENT_EDITABLE`／`FIELD_DOMAINS`。
- 新增白名單網域：`FIELD_DOMAINS`（限定欄位）或 `KNOWN_DOMAINS`（降低風險分數）。
- `relations.json` 由 `linkage_v2.py`（資料整理工具，不在 repo）產生；更新後推送即可。
- 備份：任何批次寫入前用雲端硬碟「建立副本」並匯出 xlsx。

## 14. 多位站長後台（phase 3）

### 14.1 站長帳號
- Script Property `ADMIN_UIDS`：`[{u, label, role:'owner'|'admin', added}]`。`u` 是 HMAC 代號（和攤主一樣不存 email 或 Google sub）；`label` 是站長自訂暱稱。
- 加入：站長在網站「我的攤位 › 👑 取得站長配對碼」→ 伺服器把 8 碼配對碼放進 CacheService 10 分鐘 → 試算表擁有者在選單「👑 新增站長帳號」輸入。`isSheetOwner_` 比對 `Session.getActiveUser()` 與 `ss.getOwner()` 的 email。
- 移除：後台「站長與安全」；擁有者站長可移除一般站長，任何人可自己退出，擁有者站長不能被別人移除。全部移除後，試算表擁有者仍可用配對碼重新加入。
- 緊急開關：Script Property `ADMIN_WEB_DISABLED=1` → 網站後台全部拒絕（試算表選單仍可用）。

### 14.2 登入時效
- 站長 session 2 小時（一般攤主 12 小時）；session 內含 Google 實際登入時間 `t`（ID token 的 `iat`）。
- 高風險操作（身分欄位核准／修改、批次核准、整批復原、合併攤主、停權／恢復、匯入新場次、併入主資料庫、移除站長）需要 `t` 在 10 分鐘內，否則回 `REAUTH:…`；網站跳出重新登入視窗，登入後自動重試同一個操作。

### 14.3 審核規則
- 身分欄位（SNS、官方網站、Linktree 等）：有 2 位以上站長時，第一位按「一審」→ 狀態 `待第二位確認`（審核備註記 `一審:代號`）；**另一位**站長按「第二位確認」才套用。同一人不能兩次。
- 擁有者站長可「覆核」跳過第二位，備註至少 4 字，會記在稽核紀錄。
- 只有 1 位站長時沿用 phase 2 的「二次驗證後核准」。
- 批次核准會略過身分欄位。
- 同時操作：寫入都在 `LockService` 內重新讀取狀態；已被處理的項目回 `handled:[{id,status,by}]`，網站顯示「已由 X 處理」。

### 14.4 站長直接編輯
- 攤主頁「🛠 站長直接編輯」→ `admin.ownerEdit`；場次攤位卡「🛠 站長編輯」→ `admin.eventEdit`（帶 `expect` 舊值，若期間被別人改過則拒絕）。
- 與攤主相同的 `validateField_`（網域白名單、縮網址、公式注入、風險分數）。一般欄位立即寫入；身分欄位在 2 位以上站長時進入「待第二位確認」。
- 每次寫入都記成「修改申請」列（類型 主資料修改／場次填寫，ID `AD…`／`AE…`）並寫一列「站長操作紀錄」（舊值、新值、位置、站長代號與暱稱），後台稽核可逐列復原；復原時若此格之後又被改過則拒絕。
- 販售資訊格式：單品每行 `💠類別【內容】`；套組（p6）`💠套組名稱` 下接 `1. 商品名`、`2. 商品名`…（`salesFormat_`，最多 80 行，見 §18）。網站用逐列編輯器，舊格式自動轉換並提示檢查。

### 14.5 關聯判定與合併
- 後台「關聯判定」：可疑配對（`relations.json` 的弱關聯＋使用者回報）→ 合併（任一方向）／確認無關／略過，寫入「關聯判定」分頁。
- 合併 B→A：把新攤位資料庫與場次出展紀錄中 B 的攤主ID 改成 A（每格記成「修改申請」類型 `攤主合併`、批次 `RM…`），並在「ID 合併對照」加一列 `有效`。GET `owner?id=B` 回 `{redirect:A}`，網站自動導向。認領 B 的管理者會被視為管理 A（`claimsOf_` 透過對照表）。整批復原會把對照列改成 `已復原`。
- GET `action=relations`（快取）回 `{unrelated, merged, live}`：`live` 是主資料庫裡目前共用同一 SNS 帳號的不同攤主ID（2–4 個），讓合併／無關判定和新資料不用等重新產生 `relations.json` 就生效。

### 14.6 站長 API（POST，皆需 `session` 且為站長）
讀取（不鎖）：`admin.summary`、`admin.queue`、`admin.relations`、`admin.suspensions`、`admin.events`、`admin.audit`（`q`、`kind`、`from`）。
寫入（`LockService`）：`admin.decide`（`ids, decision: approve|approve2|override|reject|suspend, note`）、`admin.revert`（`ids` 或 `batch`）、`admin.ownerEdit`、`admin.eventEdit`、`admin.relationDecide`（`merge|unrelated|skip`）、`admin.suspend`、`admin.mode`、`admin.eventAdd`、`admin.eventRemove`、`admin.importPreview`、`admin.importCreate`、`admin.mergeEvent`、`admin.adminRemove`、`admin.adminLabel`。
另：`admin.pairStart`（任何登入者，限 10 次／日）。站長操作頻率上限 300 次／小時。

### 14.7 新分頁
| 分頁 | 欄位 |
|---|---|
| 站長操作紀錄 | 時間、站長代號、站長暱稱、動作、對象、欄位、舊值、新值、位置、批次ID、相關申請ID、備註 |
| 關聯判定 | 判定ID、時間、攤主A（保留）、攤主B、判定、站長代號、站長暱稱、備註、狀態、批次ID |
| ID 合併對照 | 舊攤主ID、新攤主ID、時間、站長代號、批次ID、狀態 |

## 15. 安全稽核修正（phase 4，2026-11-23）

| # | 問題 | 修正 | 位置（code.gs 函式） | 測試 |
|---|---|---|---|---|
| 1 HIGH | 欄位名稱繞過（大小寫／空白／相似名稱） | 所有寫入路徑只接受**完全相同**的正式欄位名稱（`exactField_`、`ALL_FIELDS`）：攤主修改、站長直接修改、場次填寫、套用前再驗證 | `exactField_`、`validateField_`、`prepareDbEdit_`、`submitEventFill_`、`adminEventEdit_`、`applyEventCell_` | run-tests §14 [1] |
| 2 MED | 反斜線／主機解析差異 | 拒絕 `\`、空白與 RFC 3986 以外字元（`URL_CHARS`）；主機必須符合 `^[a-z0-9.-]+$`（非 ASCII 主機一律拒絕，路徑的非 ASCII 自動百分比編碼）；前端 `safeUrl` 同規則 | `hostOf_`、`validateField_`；`site/assets/app.js safeUrl` | [2] |
| 3 MED | 併入主資料庫未驗證 | `mergeEventToDb_` 每格重新驗證＋`safeCell_`；不合格、身分欄位、風險 ≥ 30 → 變成「修改申請」待審核，不直接寫 | `mergeEventToDb_` | [3] |
| 4 MED | 「相符」誤導 | 只接受貼文網址；只比對帳號鍵；標示改為「帳號相符，仍需確認貼文含驗證碼」 | `isPostUrl_`、`snsKey_`、`submitClaim_`；`admin.js` | [4] |
| 5 MED | 匯入公式注入 | 匯入每個字串 `safeCell_`；代碼 `^[A-Z0-9_-]{2,16}$`；所有 `setValues` 已稽核 | `importEvent_` | [5] |
| 6 LOW | 登入暴力嘗試 | JWT 形狀預檢（3 段、100–4096 字、RS256、aud/iss/exp/sub）再送 tokeninfo；全站失敗上限 100 次／15 分鐘，達上限暫停登入並寄通知 | `precheckIdToken_`、`verifyIdToken_`、`loginFailKey_` | [6] |
| 7 LOW | 身分欄位不完整 | `IDENTITY_FIELDS` 涵蓋所有 URL／SNS 欄位（見 §7）；空白第一次填入不算 | `IDENTITY_FIELDS` | [7] |
| 8 LOW | 新增場次／匯入範圍過大 | 只有擁有者站長；檔案必須在允許資料夾（指令碼屬性 `ALLOWED_FOLDER_IDS`，逗號分隔；未設定＝整理中場次檔案所在資料夾，即 FFK19 整理表的資料夾）；預覽在檢查通過前不回傳任何內容 | `allowedFolders_`、`assertDriveScope_`、`adminEventAdd_`、`adminImport_` | [8] |
| 9 LOW | `isSheetOwner_` 失敗時放行 | 改為失敗即拒絕（fail closed） | `isSheetOwner_` | [9] |
| 其他 | HTML 規則、公開欄位、Actions | 嚴格 HTML 規則；`ownerDetail_` 只回傳 `PUBLIC_DB_FIELDS`；Actions 釘 SHA；營運警告（本文件開頭、後台設定頁、自我檢查） | `ownerDetail_`、`deploy.yml` | [other]、[ops] |

不需要重新執行選單初始化（沒有新分頁）。貼上 code.gs → 部署新版本即可。`ALLOWED_FOLDER_IDS` 選填。

## 16. 速度（phase 4）

量測（2026-11-23 22:01，Asia/Taipei；`perf/before.txt`）：Apps Script `meta` ≈1.7 秒、`index` 952KB（gzip 260KB）≈1.5–1.75 秒、`relations` ≈1.5–2.5 秒、攤主頁 `owner` 冷啟動 ≈10.6 秒／熱 ≈1.9 秒；首頁先等 meta 再等 index（串連）；每頁都載入 vis-network（689KB，gzip 164KB）。

改法：
- **靜態快照**：部署時與每小時由 GitHub Actions 執行 `tools/snapshot.js`，把 `meta`／`index`／`relations` 存成 `site/data/meta.json`、`index.json`、`reloverlay.json`（GitHub Pages CDN＋gzip）。網站先用快照畫面，同時向 Apps Script 要 `meta` 版本號；版本不同才在背景重抓 `index`。快照抓不到時自動改回直接讀 Apps Script。快照檔不進 git（`.gitignore`）。**沒有新增任何 Apps Script 觸發器。**
- 需要登入或即時的資料（攤主頁詳細資料、場次資料、所有寫入）仍走 Apps Script；伺服器端既有 `CacheService` 分段快取（`cachePutBig_`）不變。
- vis-network 改成需要時才載入；首頁關聯圖進入畫面才畫（`IntersectionObserver`）。
- 攤主頁：先用 index 顯示名稱＋骨架，詳細資料回來再補；滑過／按住攤主卡時預先抓取（2 分鐘快取，寫入後清除）。
- 骨架畫面（`.sk`）取代空白轉圈；meta 與 index 平行請求。
- 全部攤位列表本來就分頁。

## 17. 認領驗證方式（phase 5，2026-11-24）

- 前端 `claimFlow`（`site/assets/app.js`）：打開視窗即以 `preview` 取得驗證碼（含「複製」鈕）；三種方式以單選呈現，SNS 方式在前端先檢查是貼文網址才送出；送出後隱藏表單，只顯示結果、目前方式、特別提醒「按下申請後請盡速與加帕利主編聯繫，我們會盡快幫您進行查驗。」與對應連結。
- 後端相容：前端讀 `meta.version`；後端仍是 p4 時，Discord 改送 `method:'dm'` 並在說明前加 `[Discord]`，並提示把驗證碼與方式寫在訊息裡（p4 會在取得驗證碼時就建立申請，之後的送出會被忽略）。
- 站長佇列：驗證方式以 🔗／💬／🎮 標示；沒有貼文網址時顯示該到哪裡核對驗證碼。
- 認領申請分頁沒有新增欄位；不需要重跑任何初始化。貼上 code.gs 並部署新版本即可。
- p4 以前的小問題一併修正：取得驗證碼時已建立申請，之後送出的貼文網址不會被記錄；p5 會更新同一列。

## 18. 販售資訊「套組」（phase 6，2026-11-24）

- 格式（寫進整理表的文字，單品與套組可混用、任意順序）：
  ```
  💠套組名稱
  1. 商品名
  2. 商品名
  💠類別【內容】
  ```
  使用者訊息裡的 `(套組名稱)`、`[商品名]` 是「填這裡」的占位符號，實際不寫括號（FFK19 既有資料也是 `💠名稱` 下接 `1. 品項`）。
- 後端 `salesFormat_`（`apps-script/code.gs`）：單品 `💠類別【內容】`（兩邊都要有）；套組標題 `💠名稱`（不能有【】）後至少 1 個商品；商品必須在套組下、編號從 1 連號、不能有【】、每組最多 30 個；全部最多 80 行；其他文字一律擋下並說明第幾行。編號寫法 `1.`／`1．`／`1、`／`1)` 都接受，存檔時統一成 `1. `。p5 的其他驗證（HTML、控制字元、1000 字、`safeCell_`、次數限制）不變。
- 前端（`site/assets/app.js`）：`parseSales` 把儲存格拆成 單品／套組／其他文字 區塊，不丟字：沒有【】的 `💠文字` 轉成單品（類別預設「商品」並提示）；看不懂的行原樣放進「其他文字」框，可「把每一行轉成單品」，否則伺服器預覽會擋下（不會默默寫入或刪除）。`serSales` 輸出上面格式；空的商品／套組自動略過、編號自動重排。編輯器：「＋單品」「＋套組」、套組內「＋加商品」（Enter 也會新增下一個）、↑↓× 排序與刪除、下方即時顯示寫入文字。只有動過的編輯器才會送出。站長編輯（`adminFillFlow`）一律中文標籤。
- 顯示：`renderSales` 在攤位卡上把套組畫成「💠名稱＋套組標籤＋編號清單（`<ol>`）」，單品一行，其他文字原樣（全部 textContent，不插入 HTML）。
- 相容：前端讀 `meta.version`；後端還沒到 `2026-11-24-p6` 時「＋套組」停用並說明（p5 後端會擋套組格式）。單品與既有資料照常可存。
- 不需要新增欄位或重跑初始化；貼上 code.gs 並部署新版本即可。

