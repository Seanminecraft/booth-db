# 測試報告 — 2026-11-23（Asia/Taipei）

## A. 端到端測試（Node 模擬 Apps Script）
`node tests/run-tests.js` — **71 passed, 0 failed**

```
PASS index 回傳成功
PASS index 含所有攤主（DB+場次紀錄）  — 6275 位，788 KB
PASS index 不含未公開／僅檔名縮圖  — 61 個隱藏的縮圖 ID
PASS 第二次讀取走快取  — 28 ms
PASS owner 詳細資料  — C00045：DB 3 列、出展 16 筆
PASS owner id 格式檢查
PASS Google 登入換取 session
PASS uid 為 HMAC 雜湊（不含 sub）
PASS 偽造 token 被拒
PASS 竄改 session 被拒
PASS 提出認領（待審核＋驗證碼）  — {"status":"待審核","code":"JP-3S9YA2"}
PASS 未核准前不能修改
PASS 站長核准後成為管理者
PASS 提出修改（逐欄進入修改申請）  — {"queued":2,"batch":"B261123184902-7f69"}
PASS 追蹤參數已移除
PASS 審核前主資料未變
PASS 改成「核准」→ onEdit 立即寫入新攤位資料庫  — row 2843
PASS 記錄套用位置與套用前值  — 新攤位資料庫!M2843
PASS 套用後網站資料版本更新
PASS 一鍵復原（狀態改「復原」）
PASS 拒絕：縮網址  — IG：不接受縮網址（bit.ly），請貼原始網址
PASS 拒絕：IG 欄位非 instagram 網域  — IG：IG 只接受 instagram.com 的網址
PASS 拒絕：javascript: 連結  — 官方網站：只接受 http(s):// 開頭的網址：javascript:alert(1)
PASS 拒絕：網址含帳密  — 官方網站：網址不可含帳號密碼
PASS 拒絕：IP 網址  — 官方網站：不接受 IP 位址網址
PASS 拒絕：Safe Browsing 判定危險  — 連結被判定為危險網站，已拒絕
PASS 拒絕：HTML 標籤  — 筆名：不可包含 HTML 標籤
PASS 拒絕：不可修改的欄位  — 此欄不可修改：攤主ID
PASS 取代身分欄位＋陌生網域 → 高風險待審核
PASS 可疑修改寄通知信給站長  — [攤位資料庫] 可疑修改待審核
PASS 敏感欄位未二次驗證 → 不套用（需人工）
PASS 二次驗證後核准 → 套用  — 已套用 → 新攤位資料庫!I2843
PASS 公式注入被轉為純文字
PASS 審核畫面可渲染
PASS 審核畫面把惡意字串逸出
PASS 一鍵復原某攤主近期所有修改  — C00045：復原 2 筆、失敗 0 筆、拒絕待審核 2 筆。建議同時使用「⛔ 停權」。
PASS 停權後無法再修改
PASS 恢復後可再修改
PASS 攤主鎖定後他人也無法認領
PASS 頻率限制（每日修改上限）
PASS 頻率限制觸發通知
PASS 測試攤位都在 FFK19 出展紀錄  — 魷魚祁聯盟=C06207@列4、心桃魅夢=C00968@列5、電玩狂熱份子=C06114@列6
PASS event API 回傳整理表  — 633 攤
PASS event API 不回傳非公開縮圖
PASS 審核制：魷魚祁聯盟 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123184902-9322"}
PASS 審核制：心桃魅夢 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123184902-bec0"}
PASS 審核制：電玩狂熱份子 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123184902-9dfa"}
PASS 審核前整理表未被寫入
PASS 不可填寫鎖定欄位（攤位編號）
PASS 不可填寫別人的攤位
PASS 套用後寫入正確的格子（列＝攤位、欄＝欄位標題）  — K4 AN4 H5 AS5 G6 K6
PASS 只寫入預期的格子  — 6 次寫入
PASS 即時制：低風險立即寫入、高風險仍待審核  — {"queued":1,"applied":1,"mode":"live","batch":"B261123184902-0111"}
PASS 即時制寫入可復原
PASS 整理表同名多列 → 拒絕自動寫入  — 整理表中有多列同名攤位，需站長處理
PASS 縮圖檢查：公開／未公開
PASS 場次縮圖：未公開連結被拒
PASS 名單解析（合併同名、依編號排序、日別）  — [["魷魚祁聯盟","A01,A03","A01,A03"],["心桃魅夢","A02",""],["全新的測試社團","","B10"],["=惡意公式社團","C05","C05"]]
PASS 建立 FF48 整理表（沿用範本格式）  — 4 攤，預先帶入 1，新攤主 2
PASS 陣列公式欄保留、每列公式重建
PASS 資料列＝名單攤位數（舊資料已清除）
PASS 預先帶入主資料庫 SNS
PASS 惡意名稱轉純文字
PASS 分頁名稱／操作手冊代碼更新
PASS 登記為整理中場次
PASS 寫入場次出展紀錄（沿用既有攤主ID）  — 魷魚祁聯盟→C06207（匯入：同名（出展紀錄））、心桃魅夢→C00968（匯入：同名（主資料庫））、全新的測試社團→C06276（匯入：新攤主）、=惡意公式社團→C06277（匯入：新攤主）
PASS 網站可讀到 FF48
PASS 場次 → 主資料庫併入（新攤主新增列、全部記錄可復原）  — {"filled":0,"conflicts":1,"appended":3}
PASS 使用者撤回 → 申請者代號清除  — 11 格
PASS 任何工作表都沒有 email／姓名／sub
PASS 自我檢查全部通過

71 passed, 0 failed
```

## B. FFK19 測試副本實測（真實 Google 試算表）
副本：「【測試副本・請勿使用】FFK19 完整攤位整理」
https://docs.google.com/spreadsheets/d/1WCHYHNi2AOVNf0VUVlPtgCQKXYKByESF4culHiHM_CM/edit
（與正式 FFK19 在同一個雲端資料夾；正式 FFK19 **未寫入任何資料**。）

把模擬測試算出的「應寫入格子」（`tests/ffk19_expected_writes.json`，由 locateEventRow_＋標題對應產生）重播到副本，再讀回：

| 格子 | 攤位（列） | 欄位（標題） | 寫入值 | 讀回結果 |
|---|---|---|---|---|
| K4 | 魷魚祁聯盟（4） | 販售資訊 | 【FFK19 測試】緣結：吊飾、飯友；秋月祁：立牌 | ✅ 一致，同列其他欄不變 |
| AN4 | 魷魚祁聯盟（4） | 預告 | https://x.com/test_account/status/1111111111111111111 | ✅；O4「有無預告」陣列公式自動變 TRUE |
| H5 | 心桃魅夢（5） | 商品年齡分類 | 一般 | ✅；N5「有無販售資訊」自動變 TRUE |
| AS5 | 心桃魅夢（5） | 試閱 | https://www.pixiv.net/artworks/123456789（utm 已移除） | ✅ |
| G6 | 電玩狂熱份子（6） | 創作者類型 | 繪師 | ✅ |
| K6 | 電玩狂熱份子（6） | 販售資訊 | `'=1+1`（公式注入測試） | ✅ 顯示為文字「=1+1」，未計算成 2 |
| L451 | 本土英雄-寶島轟雷（451，攤位 P19） | 特殊標籤或備註 | 【網站填寫測試】本土英雄-寶島轟雷 P19 | ✅ 深層列定位正確 |
| L602 | ZEN（602，攤位 I22） | 特殊標籤或備註 | 【網站填寫測試】ZEN I22 | ✅ |

另外確認：
- M1:P1 四個陣列公式（BYROW/MAP）與 AR4:AR6 每列 IMPORTRANGE 公式未被改動。
- 「神之熾火」同名兩列 → 系統拒絕自動寫入（需站長處理），未寫入。
- 原本計畫用含外部連結的 HYPERLINK 公式測注入，被安全檢查擋下（避免在共用試算表放外部連結），改用無害的 `'=1+1`。

副本裡的測試值可以保留作為證據，或整份副本刪除；**不要**把副本登記成正式整理中場次。

## C. 網站畫面（本機開發伺服器＋模擬 API）
（壓縮檔內 `screens/`，未放進 repo）：zh／en／ja 各 9 張（首頁、攤主頁＋關聯圖、整理中場次、我的攤位、隱私權政策、登入後場次頁、填寫預覽（縮網址被拒、身分欄位標示二次驗證）、送出結果、認領驗證碼），另有 privacy_static.png（不需 JS 的 privacy.html）。

## D. 2026-11-23 晚：C02492 無法編輯（p2.1）
- 原因：C02492 只在「場次出展紀錄」，主資料庫沒有列 → 前端 editFlow 直接 return（只跳「—」），伺服器 submitEdit_ 也會拒絕；攤主頁永遠顯示「這是我 → 認領」。
- 修正：code.gs VERSION 2026-11-23-p2.1 新列模式；前端攤主頁依 me.owned 顯示「編輯」、審核中顯示狀態，表單支援新列。
- `node tests/run-tests.js`：83 passed, 0 failed（新增 12 項回歸，用真實 fixture 的 C02492）。
- `tests/ui-regression-c02492.js`（dev-server＋Chrome）：6/6 PASS。
