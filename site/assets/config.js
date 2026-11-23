// 網站設定。部署時由 GitHub Actions 依 repository variables 產生（見 .github/workflows/deploy.yml）；這裡只放預留值。
// 不放任何密鑰：OAuth Client ID 與 Apps Script 網址本來就是公開值。
window.BOOTH_CONFIG = {
  API_URL: '__API_URL__',            // Apps Script 網頁應用程式網址（…/exec）
  OAUTH_CLIENT_ID: '__OAUTH_CLIENT_ID__', // Google Identity Services 的 OAuth 用戶端 ID
  SITE_NAME: '攤位資料庫',
  CONTACT: '加帕利天藍怪預警中心 粉專 https://www.facebook.com/JapariWeatherBureau（待站長確認）',
  DEV_LOGIN: false                   // 只在本機開發伺服器設為 true（假登入按鈕）
};
