// 使用說明（攤主：中／EN／日；站長：只有中文）。每個任務：短步驟＋一張截圖（site/help/）。
window.HELP = {
  zh: {
    title: '使用說明', intro: '給攤主的簡單教學。每件事只要幾步。', toc: '目錄', faq_t: '常見問題',
    tasks: [
      { id: 'search', t: '找到你的攤位', img: 'zh-search', s: ['打開首頁。', '在上方搜尋框輸入攤名、筆名或 SNS 帳號。', '點結果卡片，就會打開攤主頁。'] },
      { id: 'claim', t: '認領攤位：拿驗證碼、選方式', img: 'zh-claim', s: ['按右上「我的攤位」，用 Google 登入。', '回到你的攤主頁，按「這是我 → 認領」。', '畫面會出現你的驗證碼（例：JP-AB12CD），可以按「複製」。', '選一種方式：① SNS 貼文：用攤位資料上的 SNS 帳號發文附上驗證碼，再貼上「那則貼文」的網址。② 私訊加帕利天藍怪預警中心的 FB 粉專或 LINE 官方帳號，傳驗證碼。③ 動漫同人展資訊組 Discord：選「社團攤主」身分 → 往下到「管理事務區」→ 進「攤位整理系統後台 攤主權限申請」頻道，提醒管理員並貼上驗證碼。', '按「送出申請」。'] },
      { id: 'contact', t: '送出後：聯繫加帕利主編', img: 'zh-claim-done', s: ['送出後畫面會顯示「已送出申請」和你的驗證碼。', '⚠ 特別提醒：按下申請後請盡速與加帕利主編聯繫，我們會盡快幫您進行查驗。', '用你選的方式（粉專、LINE 或 Discord）把驗證碼傳給我們。', '站長確認後，攤位就會出現在「我的攤位」。'] },
      { id: 'edit', t: '修改我的攤位資料', img: 'zh-edit', s: ['到「我的攤位」，在你的攤位按「修改主資料」。', '只改你要改的格子。', '按「預覽變更」看一遍，再按「確認送出」。', '一般欄位可能馬上生效；換掉 SNS 主帳號、攤位名稱等身分資料，要等站長確認。'] },
      { id: 'thumb', t: '放攤位縮圖（Google 雲端連結）', img: 'zh-thumb', s: ['把圖片上傳到 Google 雲端硬碟。', '在圖片上按「共用」，把一般存取權改成「知道連結的任何人」。', '複製連結，貼到「縮圖」格。', '按「檢查是否公開」。看到 ✅ 才代表別人看得到。'] },
      { id: 'sales', t: '填寫販售資訊', img: 'zh-sales', s: ['到「整理中場次」，找到你的攤位按「填寫我的攤位」。', '販售資訊一列寫一項：左邊填類別，右邊填內容。', '系統會自動寫成「💠類別【內容】」，例如「💠新刊【畫冊 Vol.2 NT$300】」。', '按「新增一項」可以再加一列，最後按送出。'] },
      { id: 'status', t: '查看審核狀態', img: 'zh-status', s: ['打開「我的攤位」。', '「待審核的認領」：還在等站長確認。點它可以再看一次驗證碼。', '「我管理的攤主」：已經通過，可以修改資料。', '送出修改後，畫面會告訴你幾項已生效、幾項在等審核。通過後攤主頁就會更新。'] }
    ],
    faq: [
      ['要付錢嗎？', '不用，全部免費。'],
      ['網站會存我的 email 嗎？', '不會。登入只用來確認是同一個人，詳見「隱私權政策」。'],
      ['驗證貼文可以刪嗎？', '站長確認通過後就可以刪。'],
      ['沒有 SNS 帳號怎麼辦？', '選「私訊粉專或 LINE」或「Discord」，不需要貼文網址。'],
      ['為什麼我的修改還沒出現？', '可能在等站長審核，或網頁還沒更新。請稍等幾分鐘再重新整理。'],
      ['資料有錯但我不是攤主？', '在攤主頁按「回報關聯錯誤」，或私訊加帕利天藍怪預警中心粉專。']
    ]
  },
  en: {
    title: 'How to use', intro: 'A simple guide for booth owners. Each task takes only a few steps.', toc: 'Contents', faq_t: 'FAQ',
    tasks: [
      { id: 'search', t: 'Find your booth', img: 'en-search', s: ['Open the home page.', 'Type a booth name, pen name or SNS account in the search box at the top.', 'Tap a result card to open the owner page.'] },
      { id: 'claim', t: 'Claim your booth: get a code, pick a method', img: 'en-claim', s: ['Tap "My booth" at the top and sign in with Google.', 'Go back to your owner page and tap "This is me → claim".', 'You will see your verification code (e.g. JP-AB12CD). Tap "Copy" to copy it.', 'Pick one method: ① SNS post — post the code from an SNS account listed on your booth, then paste the link to that post. ② Message the 加帕利天藍怪預警中心 (Japari Weather Bureau) Facebook page or LINE official account with the code. ③ 動漫同人展資訊組 (Doujin Event Info) Discord — pick the 「社團攤主」 (booth owner) role → scroll to 「管理事務區」 (admin area) → open the 「攤位整理系統後台 攤主權限申請」 channel, tell an admin and paste the code.', 'Tap "Submit request".'] },
      { id: 'contact', t: 'After you submit: contact the Japari editor', img: 'en-claim-done', s: ['The screen shows "Request sent" and your code.', '⚠ Important: please contact the 加帕利 (Japari) editor as soon as possible so we can verify you quickly.', 'Send us the code using the method you picked (Facebook, LINE or Discord).', 'Once an admin approves, the booth appears under "My booth".'] },
      { id: 'edit', t: 'Edit my booth info', img: 'en-edit', s: ['Go to "My booth" and tap "Edit master data" on your booth.', 'Change only the boxes you need.', 'Tap "Preview changes", check it, then tap "Confirm & submit".', 'Normal fields may update right away. Changing your main SNS account or booth name waits for an admin.'] },
      { id: 'thumb', t: 'Add a booth thumbnail (Google Drive link)', img: 'en-thumb', s: ['Upload the image to Google Drive.', 'Tap "Share" on the image and set General access to "Anyone with the link".', 'Copy the link and paste it into the "Thumbnail" box.', 'Tap "Check if public". Only ✅ means others can see it.'] },
      { id: 'sales', t: 'Fill in sales info', img: 'en-sales', s: ['Go to "Ongoing events", find your booth and tap "Fill in my booth".', 'Sales info is one item per row: category on the left, details on the right.', 'It is saved as "💠Category【Details】", e.g. "💠新刊【Art book Vol.2 NT$300】".', 'Tap "Add item" for another row, then submit.'] },
      { id: 'status', t: 'Check review status', img: 'en-status', s: ['Open "My booth".', '"Pending claims": still waiting for an admin. Tap it to see your code again.', '"Owners I manage": approved — you can edit.', 'After you submit edits, the page tells you how many went live and how many wait for review. The owner page updates once approved.'] }
    ],
    faq: [
      ['Does it cost anything?', 'No. It is free.'],
      ['Do you store my email?', 'No. Sign-in only checks that you are the same person. See the Privacy Policy.'],
      ['Can I delete the verification post?', 'Yes, after an admin has approved your claim.'],
      ['I don\'t have an SNS account?', 'Choose "Facebook page / LINE" or "Discord" — no post link needed.'],
      ['Why don\'t I see my change yet?', 'It may be waiting for review, or the page has not refreshed. Wait a few minutes and reload.'],
      ['Something is wrong but I am not the owner?', 'Tap "Report wrong grouping" on the owner page, or message the 加帕利天藍怪預警中心 Facebook page.']
    ]
  },
  ja: {
    title: '使い方', intro: '出展者向けのかんたんなガイドです。どれも数ステップで終わります。', toc: '目次', faq_t: 'よくある質問',
    tasks: [
      { id: 'search', t: '自分のブースを探す', img: 'ja-search', s: ['ホームを開きます。', '上の検索欄にサークル名・ペンネーム・SNS アカウントを入力します。', '結果のカードを押すと出展者ページが開きます。'] },
      { id: 'claim', t: 'ブースを申請：コードを受け取り、方法を選ぶ', img: 'ja-claim', s: ['上の「マイブース」から Google でログインします。', '自分の出展者ページに戻り、「自分です → 申請」を押します。', '確認コード（例：JP-AB12CD）が表示されます。「コピー」で写せます。', '方法を 1 つ選びます：① SNS 投稿：ブース情報にある SNS アカウントでコードを投稿し、その投稿の URL を貼る。② 加帕利天藍怪預警中心の Facebook ページか LINE 公式アカウントにコードを DM。③ 動漫同人展資訊組（同人イベント情報グループ）の Discord：「社團攤主」ロールを選ぶ →「管理事務區」までスクロール →「攤位整理系統後台 攤主權限申請」チャンネルで管理者に伝え、コードを貼る。', '「申請を送信」を押します。'] },
      { id: 'contact', t: '送信後：加帕利の編集担当に連絡', img: 'ja-claim-done', s: ['画面に「申請しました」と確認コードが表示されます。', '⚠ 申請後は、できるだけ早く加帕利（ジャパリ）の編集担当にご連絡ください。すぐに確認いたします。', '選んだ方法（Facebook・LINE・Discord）でコードを送ってください。', '管理者が承認すると、「マイブース」にブースが表示されます。'] },
      { id: 'edit', t: 'ブース情報を修正する', img: 'ja-edit', s: ['「マイブース」で自分のブースの「マスターデータの編集」を押します。', '変えたい欄だけ書き換えます。', '「変更をプレビュー」で確認し、「確認して送信」を押します。', '一般の欄はすぐ反映されることがあります。メインの SNS アカウントやサークル名の変更は管理者の確認待ちになります。'] },
      { id: 'thumb', t: 'サムネイルを登録する（Google ドライブのリンク）', img: 'ja-thumb', s: ['画像を Google ドライブにアップロードします。', '画像の「共有」で一般的なアクセスを「リンクを知っている全員」にします。', 'リンクをコピーして「サムネイル」欄に貼ります。', '「公開状態を確認」を押します。✅ が出れば他の人にも見えます。'] },
      { id: 'sales', t: '頒布情報を入力する', img: 'ja-sales', s: ['「整理中のイベント」で自分のブースの「自分のブースを入力」を押します。', '頒布情報は 1 行に 1 つ：左にカテゴリ、右に内容を書きます。', '「💠カテゴリ【内容】」の形で保存されます。例：「💠新刊【画集 Vol.2 NT$300】」。', '「項目を追加」で行を増やし、最後に送信します。'] },
      { id: 'status', t: '審査の状況を見る', img: 'ja-status', s: ['「マイブース」を開きます。', '「審査中の申請」：管理者の確認待ちです。押すとコードをもう一度見られます。', '「管理している出展者」：承認済みで、修正できます。', '修正を送ると、すぐ反映された数と審査待ちの数が表示されます。承認後に出展者ページが更新されます。'] }
    ],
    faq: [
      ['お金はかかりますか？', 'かかりません。無料です。'],
      ['メールアドレスは保存されますか？', 'されません。ログインは同じ人かどうかの確認だけに使います。プライバシーポリシーをご覧ください。'],
      ['確認用の投稿は消してもいいですか？', '管理者が承認した後なら消して大丈夫です。'],
      ['SNS アカウントがありません', '「Facebook ページ／LINE」か「Discord」を選べば、投稿の URL は不要です。'],
      ['修正がまだ表示されません', '審査待ちか、ページがまだ更新されていない可能性があります。数分待ってから再読み込みしてください。'],
      ['出展者ではないけど情報が間違っています', '出展者ページの「関連の誤りを報告」を押すか、加帕利天藍怪預警中心の Facebook ページに連絡してください。']
    ]
  }
};
window.ADMIN_HELP = {
  title: '站長使用說明', intro: '每件事只要幾步。不確定時，先不要按，問擁有者站長。',
  tasks: [
    { id: 'pair', t: '新增站長（配對碼）', img: 'admin-pair', s: ['新站長在網站登入，到「我的攤位」按「取得站長配對碼」。', '把配對碼給試算表擁有者（10 分鐘內有效）。', '擁有者在試算表選單「🗂 攤位資料庫網站 › 👑 新增站長帳號」輸入配對碼。', '新站長重新整理網頁，就會看到「站長後台」。'] },
    { id: 'queue', t: '審核待審核', img: 'admin-queue', s: ['打開「📥 待審核」。', '看每筆的舊值、新值和風險說明；連結先看預覽再點。', '認領會標示驗證方式：🔗 SNS 貼文（打開貼文確認驗證碼）、💬 私訊粉專／LINE、🎮 Discord（到對應的訊息或頻道核對驗證碼）。', '沒問題按「✅ 核准」，有問題按「✖ 拒絕」並寫原因。', '可以勾選多筆一起處理（需 10 分鐘內登入）。'] },
    { id: 'second', t: '第二位站長確認', img: 'admin-second', s: ['身分欄位（攤位名稱、SNS／網址欄位被換掉或清空）要兩位不同站長核准。', '第一位按「🔐 二次驗證（一審）」並寫確認方式，狀態變「待第二位確認」。', '另一位站長在待審核最上面按「🔐 第二位確認並套用」。', '只有 1 位站長時，擁有者站長要填理由才能覆核。'] },
    { id: 'relogin', t: '重新登入', img: 'admin-relogin', s: ['重要操作（批次核准、身分欄位、合併、匯入、停權）要在 10 分鐘內登入過。', '跳出 Google 登入視窗時，選你的站長帳號。', '登入完成後，剛剛的操作會自動再做一次。'] },
    { id: 'revert', t: '復原修改', img: 'admin-revert', s: ['打開「🧾 稽核紀錄」。', '找到要撤回的那筆，按「↩️ 復原」（一整批的話按「↩️ 整批復原」）。', '系統會把格子改回舊值，並留下紀錄。'] },
    { id: 'suspend', t: '停權／鎖定', img: 'admin-suspend', s: ['打開「⛔ 停權／鎖定」。', '輸入申請者代號（u_…）或攤主ID（C00045），寫原因後按「⛔ 停權／鎖定」。', '被停權的帳號不能再送出申請；要解除，在同一頁按「恢復」。'] },
    { id: 'event', t: '新增場次／匯入整理表', img: 'admin-event', s: ['只有擁有者站長能做，而且試算表必須在允許的雲端資料夾裡（預設：FFK19 整理表所在的資料夾）。', '打開「🗓 整理中場次」，在下面「➕ 新增整理中場次」填代碼、名稱、開始日期。', '已經有整理表：貼上網址，按「檢查並登記」。', '只有主辦名單：貼上名單網址，先按「🔍 預覽（不寫入）」看一遍，再按「✅ 建立整理表並登記」。', '整理完要併入主資料庫時按「📤 併入主資料庫…」；格式不對或身分欄位會自動轉成待審核。'] },
    { id: 'merge', t: '關聯判定（合併／無關）', img: 'admin-merge', s: ['打開「🔗 關聯判定」。', '確定是同一位：按「🔗 合併（B → A）」或「🔗 合併（A → B）」，箭頭指向要保留的攤主ID。', '確定不是同一位：按「🚫 確認無關」並寫原因，關聯圖就不再顯示。'] },
    { id: 'editors', t: '⚠ 不要給網站站長試算表編輯權', img: 'admin-editors', s: ['試算表的編輯者可以看到密鑰、改程式碼，等於擁有全部權限。', '只在網站上審核的站長，不要加成試算表編輯者。', '試算表只分享給擁有者本人。「⚙️ 站長與安全」會顯示目前有幾位編輯者。'] }
  ],
  faq: [
    ['兩位站長同時按同一筆會怎樣？', '只會套用一次，後按的人會看到「已由 X 處理」。'],
    ['按錯核准了？', '到「🧾 稽核紀錄」按「↩️ 復原」。'],
    ['網站後台被盜用怎麼辦？', '擁有者在指令碼屬性設 ADMIN_WEB_DISABLED=1，網站後台會全部停用。']
  ]
};
