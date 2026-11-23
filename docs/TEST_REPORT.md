# 測試報告 — 2026-11-23（Asia/Taipei）

## Phase 3（多位站長後台、站長直接編輯、關聯判定／合併、首頁關聯圖、主題）— 2026-11-23 20:40（Asia/Taipei）

### P3-A. 端到端測試（Node 模擬 Apps Script，真實 code.gs `2026-11-23-p3`）
`node tests/run-tests.js` — **152 passed, 0 failed**（phase 2 的 83 項＋站長後台 69 項）

完整輸出：

```
PASS index 回傳成功
PASS index 含所有攤主（DB+場次紀錄）  — 6275 位，788 KB
PASS index 不含未公開／僅檔名縮圖  — 61 個隱藏的縮圖 ID
PASS 第二次讀取走快取  — 17 ms
PASS owner 詳細資料  — C00045：DB 3 列、出展 16 筆
PASS owner id 格式檢查
PASS Google 登入換取 session
PASS uid 為 HMAC 雜湊（不含 sub）
PASS 偽造 token 被拒
PASS 竄改 session 被拒
PASS 提出認領（待審核＋驗證碼）  — {"status":"待審核","code":"JP-3S9YA2"}
PASS 未核准前不能修改
PASS 站長核准後成為管理者
PASS 提出修改（逐欄進入修改申請）  — {"queued":2,"batch":"B261123203332-08d8","newRow":false,"rowName":"貓頭鷹辦事處"}
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
PASS 審核制：魷魚祁聯盟 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123203332-d90a"}
PASS 審核制：心桃魅夢 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123203332-fe96"}
PASS 審核制：電玩狂熱份子 填寫進入待審核  — {"queued":2,"applied":0,"mode":"queue","batch":"B261123203332-d09e"}
PASS 審核前整理表未被寫入
PASS 不可填寫鎖定欄位（攤位編號）
PASS 不可填寫別人的攤位
PASS 套用後寫入正確的格子（列＝攤位、欄＝欄位標題）  — K4 AN4 H5 AS5 G6 L6
PASS 只寫入預期的格子  — 6 次寫入
PASS 即時制：低風險立即寫入、高風險仍待審核  — {"queued":1,"applied":1,"mode":"live","batch":"B261123203332-10f2"}
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
PASS 回歸：測試對象只在出展紀錄  — C02492
PASS 回歸：核准後「我的攤位」列出此攤主
PASS 回歸：無主資料列也能送出修改（新列模式）  — {"queued":2,"batch":"B261123203332-e7a3","newRow":true,"rowName":"加帕利天藍怪預警中心"}
PASS 回歸：rowName 留空也可以  — {"queued":1,"batch":"B261123203332-95a1","newRow":true,"rowName":"加帕利天藍怪預警中心"}
PASS 回歸：核准前主資料庫沒有新增列
PASS 回歸：核准後只新增一列、寫入攤名與攤主ID  — 1 列，攤名 加帕利天藍怪預警中心
PASS 回歸：三個欄位都寫進同一列
PASS 回歸：修改申請全部「已套用」並記錄位置  — 新攤位資料庫!B4869 新攤位資料庫!E4869 新攤位資料庫!C4869
PASS 回歸：網站讀得到新列
PASS 回歸：可復原
PASS 回歸：之後的修改走既有列  — {"queued":1,"batch":"B261123203332-fcc2","newRow":false,"rowName":"加帕利天藍怪預警中心"}
PASS 回歸：非管理者不能用新列模式
PASS 站長：未加入前沒有權限
PASS 站長：非擁有者不能初始化
PASS 站長：初始化建立 3 個分頁
PASS 站長：初始化先備份整份試算表（Drive 副本）
PASS 站長：重複初始化不覆蓋既有分頁
PASS 站長：取得配對碼  — JE47MMKF
PASS 站長：錯誤配對碼被拒
PASS 站長：非擁有者不能新增站長
PASS 站長：配對成功 2 位（第一位為擁有者）  — 小編A/owner 小編B/admin
PASS 站長：ADMIN_UIDS 只存 HMAC 代號（無 email）
PASS 站長：配對碼只能用一次
PASS 站長：summary 可讀、標示兩人規則  — {"queue":8,"relations":0,"owners":0}
PASS 站長：me 回傳 admin 旗標
PASS 站長：一般帳號被拒（伺服器檢查）
PASS 站長：偽造 session 被拒
PASS 站長：緊急停用開關
PASS 站長：登入超過 2 小時需重新登入
PASS 認領：twitter.com 與 x.com 視為同一帳號  — https://twitter.com/160ismyname vs https://x.com/160ismyname/status/1234567890
PASS 站長：待審核列出認領（含 SNS 比對）
PASS 站長：核准認領
PASS 站長：已處理的認領再按顯示由誰處理
PASS 站長：攤主送出修改（含身分欄位）  — {"queued":2,"batch":"B261123203332-407b","newRow":false,"rowName":"160 is my name"}
PASS 站長：佇列分批、標示身分欄位與將寫入的格子  — 筆名:新攤位資料庫!B80 TWITTER (1):新攤位資料庫!I80
PASS 併發：兩位站長同時核准同一筆，只套用一次  — 1 次寫入 B80
PASS 併發：第二位看到「已由 小編A 處理」  — [{"id":"ED261123203332-5572","status":"已套用","by":"站長 小編A"}]
PASS 站長：批次核准略過身分欄位
PASS 站長：身分欄位核准必填驗證方式
PASS 站長：高風險操作需 10 分鐘內重新登入
PASS 二審：第一位站長核准後狀態「待第二位確認」，尚未寫入
PASS 二審：同一位站長不能自己二審
PASS 二審：summary 提示另一位站長有待確認
PASS 二審：第二位站長確認後套用  — {"done":1,"skipped":0,"waiting":0,"handled":[],"results":[{"id":"ED261123203332-6789","ok":true,"where":"新攤位資料庫!I80","error":"","status":"已套用"}]}
PASS 覆核：一般站長不能覆核
PASS 覆核：必填理由
PASS 覆核：擁有者站長覆核後套用並記錄理由
PASS 直接修改：一樣擋縮網址
PASS 直接修改：一樣擋白名單外網域
PASS 直接修改：一般欄位立即套用（不進佇列）  — {"applied":2,"waiting":0,"failed":[],"batch":"B261123203333-59b5","items":[{"id":"AD261123203333-28ce","field":"筆名","status":"已套用","where":"新攤位資料庫!B96"},{"id":"AD261123203333-6add","field":"創作者類型","status":"已套用","where":"新攤位資料庫!C96"}]}
PASS 直接修改：身分欄位在 2 位站長時需第二位確認
PASS 直接修改：第二位站長確認後套用
PASS 稽核：記錄站長、動作、舊值→新值  — 17 列
PASS 直接修改：可復原
PASS 復原：再按一次不會重複
PASS 稽核 API：可搜尋、標示可復原  — 5 筆
PASS 場次：販售資訊必須是「💠類別【內容】」
PASS 場次：讀取後被別人改過會被擋
PASS 場次：站長直接寫入任何攤位（格式自動整理）  — {"applied":2,"waiting":0,"failed":[],"batch":"B261123203333-e3b1","items":[{"id":"AE261123203333-fd57","field":"販售資訊","status":"已套用","where":"FFK19!K2"},{"id":"AE261123203333-f970","field":"預告","status":"已套用","where":"FFK19!AN2"}]} "💠新刊【畫冊 Vol.2 NT$300】\n💠周邊【壓克力立牌、明信片】"
PASS 場次：寫入的格子正確並記錄位置
PASS 場次：可復原（跨檔案）
PASS 關聯：一般站長未重新登入不能合併
PASS 合併：B 的列改為 A 的攤主ID  — {"ok":true,"moved":1,"batch":"RM261123203333-a9e3"}
PASS 合併：舊ID 自動導向新ID
PASS 合併：ID 合併對照有記錄
PASS 合併：原本管理 B 的人可管理 A
PASS 合併：關聯覆蓋層含合併
PASS 合併：整批復原  — {"ok":1,"fail":0,"already":0}
PASS 關聯：確認無關後，公開覆蓋層移除此配對
PASS 關聯：即時共用帳號關聯是陣列
PASS 關聯：後台可讀判定紀錄
PASS 停權：網站後台停權帳號
PASS 停權：被停權後不能修改
PASS 停權：恢復後回到原本的管理權
PASS 停權：列表
PASS 場次：後台讀取整理中場次統計
PASS 模式：切換並記錄
PASS 站長：一般站長不能移除擁有者
PASS 站長：擁有者移除站長後立即失效
PASS 站長：只剩 1 位時身分欄位由唯一站長核准
PASS 稽核：所有網站後台動作都有站長暱稱
PASS 自我檢查全部通過

152 passed, 0 failed
```

### P3-B. UI 測試（puppeteer，dev-server 跑真實 code.gs，站長以配對碼流程加入）
`tests/ui-p3-admin.js`、`tests/ui-p3-reauth.js`、`tests/ui-regression-c02492.js` — **26 passed, 0 failed**

```
PASS 首頁關聯圖卡在數字統計下面 — true
PASS 關聯圖有畫出來（canvas）
PASS 「顯示兩兩相連」切換後副標題包含組數
PASS 手機：關聯圖要點一下才載入
PASS 佇列顯示「待第二位確認」與第二位確認按鈕
PASS 一審的站長 B 不能自己做第二位確認（按鈕停用或提示）
PASS 稽核紀錄顯示站長暱稱
PASS 站長在攤主頁看到「🛠 站長直接編輯」
PASS 站長直接寫入成功 — note good|已寫入 1 欄
PASS 短網址在站長編輯也會被擋 — 🛠 站長編輯主資料（C00968）🛠 站長直接修改：一般欄位按下確認後立即寫入（不進審核佇列），驗證規則與攤主相同；每一格都記錄在「站長操作紀錄」，可在後台稽核紀錄復原。身分欄位在有 2 位以上站長時會進入「待第二位確認」。要修改的攤名列Mionkokomo（第 3690 列）心桃魅夢（第 4401 列）攤位名稱筆
PASS 場次攤位列表每張卡有「🛠 站長編輯」
PASS 販售資訊用 💠類別【內容】編輯器
PASS 場次販售資訊直接寫入成功 — note good|已寫入 1 欄
PASS 稽核紀錄出現剛才的直接修改與復原按鈕
PASS 佇列顯示一審與第二位確認
PASS 找到一審按鈕 — 🔐 二次驗證（一審）
PASS 過期登入時跳出重新登入視窗 — ×🔐 重新登入「身分欄位核准」需要在 10 分鐘內重新登入 Google 才能執行重新登入後會自動繼續剛才的操作。（開發用）假登入（重新登入）取消
PASS 重新登入後自動繼續並完成一審
PASS 站長改身分欄位也要 10 分鐘內登入 — 🔐 重新登入「修改身分欄位」需要在 10 分鐘內重新登入 Google 才能執行重新登入後會自動繼續剛才的操作。（開發用）假登入（重新登入）取消
PASS 重新登入後回到原表單：身分欄位進入待第二位確認 — note good|已寫入 0 欄，1 欄身分欄位等待第二位站長確認
PASS 未登入顯示認領 — 這是我 → 認領
PASS 管理者在攤主頁看到「編輯」而不是「認領」 — ✏️ 編輯我的攤位資料
PASS 編輯表單打開（新列模式） — 24 欄
PASS 送出成功（進入審核佇列） — note good|已送出 1 項，等待站長審核
PASS 「我的攤位」頁的編輯也能打開表單 — 修改主資料
PASS 非自己的攤主仍顯示認領 — 這是我 → 認領
```

### P3-C. 沒有測到的
- 真正的 Google 登入（`iat` 由 Google 提供；本機用假 token 模擬）。
- 真實試算表上的 `ss.getOwner()`／`Session.getActiveUser()`（擁有者判斷）、`DriveApp.makeCopy` 備份：只在模擬環境測試。第一次在真實試算表執行「🧱 站長功能初始化」時請確認雲端硬碟出現備份檔。
- 沒有寫入任何真實試算表（正式 FFK19、攤位資料庫都沒動）。

---


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
