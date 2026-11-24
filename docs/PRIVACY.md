<!-- 自動產生：請改 site/assets/privacy.js 後執行 node tools/build-privacy-md.js -->

# 隱私權政策

_最後更新: 2026-11-24_

## 1. 我們是誰、這份政策涵蓋什麼

我們是加帕利天藍怪預警中心，本網站為攤位查詢系統後台，亦是攤位資料庫，主要整理同人展攤位的公開資訊（攤名、筆名、SNS 連結、出展紀錄），並讓攤主登入後更正自己的資料。本政策說明網站會收集、使用、保存哪些資料。

## 2. 我們存什麼、不存什麼

登入時，Google 會把一個「ID token」交給我們的伺服器（Google Apps Script）。伺服器向 Google 確認真偽後，只取出其中的帳號編號（sub），用站方密鑰做 HMAC-SHA256 雜湊，產生一個無法還原的「申請者代號」（u_ 開頭）。token 本身用完即丟。

我們不儲存：你的 email、姓名、大頭貼、Google 帳號編號原文、IP 位址、裝置資訊。

我們儲存（在站方的 Google 試算表中）：申請者代號；你送出的認領申請（攤主ID、驗證方式、驗證貼文網址〔只有 SNS 方式〕、驗證碼、你寫的說明、時間、審核狀態）；你送出的修改申請（欄位、修改前後的值、風險檢查結果、時間、審核與套用紀錄）。

如果你選擇用私訊（FB 粉專、LINE 官方帳號）或動漫同人展資訊組 Discord 驗證，訊息會留在該平台，依該平台的規則處理；我們只用來核對驗證碼，不會把訊息內容或你的平台帳號存進網站。

攤位資料本身（攤名、筆名、SNS 連結、販售資訊、縮圖連結）是攤主在各場次公開發布的資訊，會公開顯示在本網站。

## 3. 使用目的

確認修改是由同一位、已通過認領的攤主送出；防止冒用與惡意修改（審核、頻率限制、停權、復原）；在本網站顯示攤位資訊；把攤主填寫的內容寫入對應場次的攤位整理表。

## 4. 保存期間

登入狀態（session）：最長 12 小時，存在你的瀏覽器分頁中，關閉分頁即消失。

頻率限制計數：存在伺服器快取，最長 24 小時自動消失。

認領與修改申請：作為修改歷史與復原依據保存，直到站方刪除或你要求刪除為止。

## 5. 刪除與更正

在「我的攤位」頁按「刪除我的登入紀錄」，系統會立即把你的申請者代號從所有申請紀錄中清除，之後無法再把那些紀錄連回你。已經套用到攤位資料的修改不會因此撤回；如需移除攤位資料，請聯絡我們。

攤主可登入申請更正自己的攤位資料，也可回報錯誤的關聯（不是同一位／應是同一位）。

## 6. 第三方服務

Google：Google 登入（Google Identity Services）、Google Apps Script（伺服器）、Google 試算表（資料儲存）、Google 雲端硬碟（縮圖，只顯示攤主已設為公開的檔案）、Google Safe Browsing（檢查你提交的連結是否為危險網站，會把連結傳給 Google）。各服務依 Google 隱私權政策處理資料。

GitHub Pages：託管本網站的靜態檔案。GitHub 可能依其隱私權聲明記錄連線資訊（例如 IP 位址）；本站無法取得這些紀錄。

你點擊的外部 SNS 連結會開啟該網站，並適用該網站的政策。

## 7. Cookie 與瀏覽器儲存

本站本身不設定 cookie。localStorage 只存介面語言與顯示主題（淺色／深色／跟隨系統，鍵名 theme）；sessionStorage 只存登入 session（12 小時內有效）。

使用 Google 登入時，Google 可能在 accounts.google.com 設定自己的 cookie。本站沒有廣告、沒有追蹤或分析工具。

## 8. 站方通知

發生高風險修改或異常時，系統會寄通知信給站長，內容包含申請者代號的前幾碼與被修改的攤位資訊，不含你的個人資料。

站長同樣以 Google 登入、只保存 HMAC 代號與站長自訂的暱稱；站長的每一個操作（誰、何時、修改前後的值）記錄在試算表「站長操作紀錄」分頁，供稽核與復原。

## 9. 聯絡我們

有任何隱私問題或刪除要求，請聯絡：加帕利天藍怪預警中心 粉專 https://www.facebook.com/JapariWeatherBureau

## 10. 政策變更

政策若有修改，會更新本頁的「最後更新」日期；重大變更會在網站首頁公告。

---

# Privacy Policy

_Last updated: 2026-11-24_

## 1. Who we are and what this covers

We are 加帕利天藍怪預警中心 (Japari Weather Bureau). This site is the back end of our booth lookup system and is also the booth database itself. It mainly compiles public information about doujin-event booths (booth names, pen names, SNS links, exhibition history) and lets booth owners sign in to correct their own entries. This policy explains what the site collects, uses and keeps.

## 2. What we store and what we do not

When you sign in, Google gives our server (Google Apps Script) an "ID token". The server verifies it with Google, takes only the account number inside it (sub) and turns it into an irreversible "applicant code" (starting with u_) using HMAC-SHA256 with a site secret. The token itself is discarded.

We do NOT store your email, name, profile picture, raw Google account ID, IP address or device information.

We DO store, in the site's Google Sheet: the applicant code; claims you submit (owner ID, verification method, proof post URL [SNS method only], verification code, your note, time, review status); edit requests you submit (field, old and new value, risk check result, time, review and apply records).

If you verify by message (our Facebook page or LINE official account) or on the 動漫同人展資訊組 (Doujin Event Info) Discord, the message stays on that platform and follows its rules. We only use it to match your verification code and do not copy the message or your account on that platform into the site.

Booth data itself (booth name, pen name, SNS links, sales info, thumbnail link) is information booth owners published for events, and is shown publicly on this site.

## 3. Why

To confirm that edits come from the same, approved owner; to prevent impersonation and vandalism (review, rate limits, suspension, revert); to display booth information; and to write what owners fill in into the matching event booth sheet.

## 4. How long

Sign-in session: up to 12 hours, kept in your browser tab and gone when you close it.

Rate-limit counters: in server cache, expire automatically within 24 hours.

Claims and edit requests: kept as edit history and for reverting, until the site deletes them or you ask us to.

## 5. Deletion and correction

On "My booth", press "Delete my sign-in records". Your applicant code is removed from every request immediately, so those records can no longer be linked back to you. Edits already applied to booth data are not undone; contact us if you want booth data removed.

Owners can sign in to request corrections to their booth data, and can report wrong groupings.

## 6. Third parties

Google: Google Sign-In (Google Identity Services), Google Apps Script (server), Google Sheets (storage), Google Drive (thumbnails — only files the owner made public), Google Safe Browsing (links you submit are sent to Google to check for dangerous sites). Google handles data under its privacy policy.

GitHub Pages: hosts the site's static files. GitHub may log connection data such as IP addresses under its privacy statement; we do not receive those logs.

External SNS links you click open those sites, which have their own policies.

## 7. Cookies and browser storage

This site sets no cookies of its own. localStorage holds only your interface language and display theme (light / dark / follow system, key “theme”); sessionStorage holds only the sign-in session (valid for 12 hours).

When you use Google Sign-In, Google may set its own cookies on accounts.google.com. There are no ads, trackers or analytics on this site.

## 8. Admin alerts

For high-risk edits or anomalies the system emails the admin. The email contains the first characters of the applicant code and the booth data being changed, not your personal data.

Admins also sign in with Google; only their HMAC code and a self-chosen nickname are stored. Every admin action (who, when, old and new values) is recorded in the “站長操作紀錄” (admin log) tab for audit and undo.

## 9. Contact

For privacy questions or deletion requests: 加帕利天藍怪預警中心 粉專 https://www.facebook.com/JapariWeatherBureau

## 10. Changes

If this policy changes we update the "last updated" date on this page and announce major changes on the home page.

---

# プライバシーポリシー

_最終更新日: 2026-11-24_

## 1. 運営者と対象範囲

私たちは加帕利天藍怪預警中心（ジャパリ天藍怪予報センター）です。本サイトはブース検索システムのバックエンドであり、ブースデータベースそのものでもあります。主に同人イベントのスペースに関する公開情報（サークル名、ペンネーム、SNS リンク、出展履歴）を整理し、出展者がログインして自分の情報を修正できるサイトです。本ポリシーは、収集・利用・保存する情報について説明します。

## 2. 保存する情報・保存しない情報

ログイン時、Google から当サイトのサーバー（Google Apps Script）に「ID トークン」が渡されます。サーバーは Google に真正性を確認したうえで、その中のアカウント番号（sub）のみを取り出し、サイトの秘密鍵による HMAC-SHA256 で元に戻せない「申請者コード」（u_ で始まる）に変換します。トークン自体は破棄します。

保存しないもの：メールアドレス、氏名、プロフィール画像、Google アカウント ID の原文、IP アドレス、端末情報。

保存するもの（サイトの Google スプレッドシート）：申請者コード、出展者の申請（出展者ID、確認方法、確認投稿の URL〔SNS の場合のみ〕、確認コード、メモ、日時、審査状況）、修正申請（項目、変更前後の値、リスク判定、日時、審査・反映の記録）。

DM（Facebook ページ・LINE 公式アカウント）や動漫同人展資訊組（同人イベント情報グループ）の Discord で確認する場合、メッセージはそのサービス上に残り、そのサービスの規約に従って扱われます。私たちは確認コードの照合にだけ使い、メッセージの内容やそのサービスのアカウントをサイトに保存することはありません。

ブース情報（サークル名、ペンネーム、SNS リンク、頒布情報、サムネイルのリンク）は出展者が各イベント向けに公開した情報であり、当サイトで公開表示します。

## 3. 利用目的

修正が承認済みの同一出展者によるものか確認するため、なりすましや荒らしを防ぐため（審査、回数制限、停止、取り消し）、ブース情報を表示するため、出展者が入力した内容を該当イベントのスペース整理表へ書き込むため。

## 4. 保存期間

ログイン状態（セッション）：最長 12 時間。ブラウザのタブ内に保存され、タブを閉じると消えます。

回数制限のカウンター：サーバーのキャッシュに保存され、24 時間以内に自動で消えます。

申請と修正申請：修正履歴および取り消しの根拠として、サイトが削除するか、あなたが削除を求めるまで保存します。

## 5. 削除と訂正

「マイブース」で「ログイン記録を削除」を押すと、すべての申請からあなたの申請者コードが直ちに消去され、以後その記録をあなたと結び付けられなくなります。反映済みの変更は元に戻りません。ブース情報の削除を希望する場合はご連絡ください。

出展者はログインして自分のブース情報の訂正や、関連付けの誤りの報告ができます。

## 6. 第三者サービス

Google：Google ログイン（Google Identity Services）、Google Apps Script（サーバー）、Google スプレッドシート（保存先）、Google ドライブ（サムネイル。出展者が公開したファイルのみ表示）、Google セーフ ブラウジング（送信されたリンクが危険なサイトでないか確認するため、リンクを Google に送信します）。Google のプライバシーポリシーに従って取り扱われます。

GitHub Pages：サイトの静的ファイルを配信します。GitHub はプライバシーステートメントに基づき接続情報（IP アドレスなど）を記録する場合がありますが、当サイトはその記録を受け取りません。

外部 SNS へのリンクを開くと、そのサイトのポリシーが適用されます。

## 7. Cookie とブラウザ保存領域

当サイト自体は Cookie を設定しません。localStorage には表示言語と表示テーマ（ライト／ダーク／システムに従う、キー名 theme）のみ、sessionStorage にはログインセッション（12 時間有効）のみを保存します。

Google ログインを使うと、Google が accounts.google.com に独自の Cookie を設定する場合があります。広告・トラッキング・アクセス解析は使用していません。

## 8. 管理者への通知

リスクの高い修正や異常があった場合、管理者に通知メールが送られます。内容は申請者コードの先頭数文字と対象のブース情報のみで、あなたの個人情報は含みません。

管理者も Google でログインし、保存されるのは HMAC コードと本人が決めたニックネームのみです。管理者の操作（誰が・いつ・変更前後の値）はすべてシートの「站長操作紀錄」タブに記録され、監査と取り消しに使われます。

## 9. お問い合わせ

プライバシーに関するご質問や削除のご依頼：加帕利天藍怪預警中心 粉專 https://www.facebook.com/JapariWeatherBureau

## 10. 変更

本ポリシーを変更した場合、このページの「最終更新日」を更新し、重要な変更はトップページでお知らせします。

---

