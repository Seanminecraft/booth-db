# 攤位資料庫 Booth Database

以攤主為單位整合歷屆攤名・SNS・社團的同人展攤位資料庫。三語（中文／English／日本語）。

- **網站**：`site/`（GitHub Pages，純靜態）
- **後端**：`apps-script/code.gs`（綁定「攤位資料庫」試算表，整份貼上即可）
- **文件**：`docs/ENGINEERING.md`（架構、資料流程、API、安全、部署）、`docs/PRIVACY.md`（隱私權政策草稿）、`docs/TEST_REPORT.md`、`docs/CHANGELOG_WRITES.md`

## 快速部署（平板也可）
1. 試算表 → 擴充功能 → Apps Script → 貼上 `apps-script/code.gs` → 選單「🔑 初始化設定」。
2. 部署為網頁應用程式（執行身分：我；存取權：所有人），複製 `/exec` 網址。
3. GitHub → Settings → Pages → Source: GitHub Actions；Settings → Secrets and variables → Actions → Variables：`API_URL`、`OAUTH_CLIENT_ID`、`CONTACT`。
4. 推送到 `main` 自動部署。

詳見 `docs/ENGINEERING.md` §9。

## 本機開發
```
node tests/run-tests.js        # 需要 ../test-fixtures（不在 repo）
node tests/dev-server.js 8787  # http://localhost:8787/?devlogin=dev-owner-1#/me
```

密鑰不放在程式碼：後端用 Script Properties，前端只有公開值（由 Actions 產生 config.js）。
