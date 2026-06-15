# Fun Fitness Premium 課表系統 Redesign

> **極簡日式雜誌風 · 行動優先 · 免登入的 Fun Fitness 第三方週課表優化實作**
>
> 🌐 前端預覽：[fun-fitness-redesign.vercel.app](https://fun-fitness-redesign.vercel.app)
> ⚡ 後端API：`https://fun-fitness-backend.onrender.com`

---

## 💡 專案緣由 (Motivation)

身為 **Fun Fitness** 健身房的會員與愛好者，每次想要在手機上查閱當日或當週的課表時，原官方網站 (https://www.funfitness.com.tw/) 的經典約課系統在行動裝置上的瀏覽體驗顯得較為繁瑣。

每次查課都必須先手動進行多層下拉選單（包含「分館選擇、課程大類、特定日期」）的額外篩選，且介面資訊密度極高、在小螢幕上容易產生橫向滾動。在路上或通勤中想要「快速瞄一眼今天晚點有什麼課」時，相當不夠直覺。

為了徹底解決這個日常查課痛點，本專案以 **「行動優先 (Mobile-First)」** 與 **「日系雜誌排版美學 (Minimalist Editorial Style)」** 為起點進行二創。我們大刀闊斧地剝離了所有複雜的會員登入與預約按鈕，將核心焦點凝聚在「無干擾的極速課表查閱」，重新打造一版溫潤、直覺且極致流暢的課表瀏覽體驗。

---

## ✨ 核心特色 (Key Features)

### 📖 1. 日系雜誌排版美學
* **極簡視覺配置**：採用低飽和度、舒適溫潤的暖白背景色 (`#ffffff` 與 `#fbfbfa`)，搭配現代高雅的無襯線字型 (`Inter` & `Outfit`)。
* **經典幾何線條**：利用纖細的線條與留白進行區塊劃分，並以專屬深紅色 (`#b33939`) 的「扣兩堂」與「已滿」標籤進行視覺點綴，營造低調的編輯質感。
* **深淺色自適應 Favicon**：精心設計的品牌 SVG 網站 icon 支援 prefers-color-scheme，能隨系統主題自動在深黑與亮白線條間切換。

### 📱 2. 行動優先的極致排版
* **水平對齊單行排版**：在手機上，每一堂課的「時間區塊」與「課程名稱 / 老師名稱」被完美規劃在單一網格中，完全隱藏不必要的欄位與位置資訊，防範行高重疊，實現極佳的資訊流動。
* **智慧隱藏過濾欄**：在行動裝置上自動收起所有搜尋與篩選輸入框，只保留頂部最精簡的「公館/士林」分館切換與「重新整理」按鈕，把 100% 的螢幕空間還給課表本身。

### 🔄 3. 滾動式 14 天日程與雙週自動合併
* **打破週一至週日限制**：日期選單以「今天 (Today)」為起始點，滾動式載入整整 14 天的日程。
* **後端三週自動合併**：由於 14 天滾動日程不論在星期幾，最多都可能會橫跨 3 個不同的星期。後端 API 會自動爬取並合併本週、下週與下下週這三週的課表，確保 14 天日程內絕無空白邊界漏洞。

### ⏱️ 4. 已過去課程灰階淡出
* **實時時間比對**：前端會根據瀏覽器的當下時間，實時與每一堂課程的日期與開始時間進行比對。
* **灰階淡出效果**：已經過去的課程會自動套用 `.is-past` 樣式，大幅降低透明度，變為淡淡的底色並停用所有 hover 互動與點擊，讓您一眼即可鎖定今天剩下哪些課可以上。

### ⚡ 5. 免登入的 Puppeteer 自動化抓取與快取
* **無登入負擔**：拋棄了需要帳號密碼的會員 API，後端直接帶入公開的 Studio ID 存取經典課表網頁。
* **雙層快取策略**：後端採用快取優先 (Cache-First) 機制。首次查閱時會透過 Puppeteer 自動化爬取，並自動寫入快取，後續請求享有毫秒級的載入速度。

### 📊 6. Vercel Analytics 流量分析
* 整合 Vercel Web Analytics 官方模組，免任何 Tracking ID 配置即可在 Vercel 後台隨時監測即時訪客流量。

---

## 🛠️ 技術棧 (Tech Stack)

### 前端 Client
* **Core**: React 18, Vite 6, TypeScript
* **Styling**: Vanilla CSS (精準響應式適配)
* **Analytics**: `@vercel/analytics`

### 後端 Server
* **Core**: Node.js, Express, TypeScript, ts-node
* **Scraper**: Puppeteer + Puppeteer Stealth (人機防護繞過)
* **Parser**: Cheerio
* **Container**: Docker (Render 部署相容)

---

## 💻 本地開發 (Local Development)

### 1. 後端啟動
```bash
cd backend
npm install
npm run dev
```
後端將運行於 `http://localhost:3001`。

### 2. 前端啟動
```bash
cd frontend
npm install
npm run dev
```
前端將運行於 `http://localhost:5173`。

---

## 🚀 部署上線 (Deployment)

### 前端部署 (Vercel)
1. 將根目錄 `frontend` 設定為 Vercel 的專案目錄。
2. 在 Vercel 後台配置環境變數 `VITE_API_BASE_URL` 指向您的後端 API 網址 (結尾請勿加上斜線 `/`)。

### 後端部署 (Render - Docker)
1. 由於 Puppeteer 需要豐富的 Chromium 系統依賴，後端直接在 Render 上使用 **Docker** 部署。
2. Render 會讀取 `backend/Dockerfile`。此 Dockerfile 使用官方 Puppeteer 鏡像，以預設非 root 的 `pptruser` 身份進行安全的 npm 安裝與編譯，保證 100% 部署成功。

---

## ⚖️ 免責聲明 (Disclaimer)

本專案為非官方（Unofficial）的第三方優化查課工具，純屬技術研究與二創設計交流。
課表資料皆即時爬取自 Fun Fitness 官方公開經典網頁，版權歸 Fun Fitness 健身房所有。
專案中不包含任何預約、儲值、會員登入等商業交易功能。
