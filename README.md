# Bland AI Proxy Backend

A lightweight Express server that proxies requests from your browser app to the Bland AI API — bypassing CORS restrictions.

---

## Deploy to Railway (5 minutes)

### Step 1 — Create a GitHub repo
1. Go to github.com and sign in (or create a free account)
2. Click **"New repository"**
3. Name it `bland-ai-proxy`, set it to **Public**, hit **Create**
4. Upload these two files: `server.js` and `package.json`
   - Click **"Add file" → "Upload files"**
   - Drag both files in → click **Commit changes**

### Step 2 — Deploy on Railway
1. Go to **railway.app** and sign in with GitHub
2. Click **"New Project" → "Deploy from GitHub repo"**
3. Select your `bland-ai-proxy` repo
4. Railway will auto-detect Node.js and start deploying

### Step 3 — Add your Bland API key
1. In Railway, click your project → **"Variables"** tab
2. Click **"Add Variable"**
3. Name: `BLAND_API_KEY`
4. Value: paste your Bland AI API key
5. Hit **Add** — Railway will redeploy automatically

### Step 4 — Get your backend URL
1. Click **"Settings"** tab in Railway
2. Under **"Domains"** click **"Generate Domain"**
3. You'll get a URL like: `https://bland-ai-proxy-production.up.railway.app`
4. Copy this URL

### Step 5 — Paste URL into the app
1. Go back to the Bland AI Auto-Caller app in Claude
2. In the **Setup tab**, paste your Railway URL into the **"Backend URL"** field
3. Hit **Save** then **Test Connection** — it should say ✓ Connected!

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/test` | Test Bland API connection |
| POST | `/call` | Send a new call |
| GET | `/call/:id` | Get call status |
| GET | `/calls` | List recent calls |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BLAND_API_KEY` | Yes | Your Bland AI API key |
| `PORT` | No | Port to run on (Railway sets this automatically) |

---

## Local Development

```bash
npm install
BLAND_API_KEY=your_key_here npm run dev
```

Then test at http://localhost:3000/test
