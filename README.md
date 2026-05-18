# ECADRN Grant Studio

An AI-powered grant writing and management platform for ADR professionals. Features rich-text collaboration, version history, template systems, and a unified strategy calendar.

**Access is restricted to @ecadrn.org email addresses only.**

---

## Architecture

| Layer | Service | Cost |
|-------|---------|------|
| Frontend | GitHub Pages | Free |
| AI Backend | Vercel (serverless) | Free tier |
| Database | Firebase Firestore | Free tier |
| Auth | Firebase Auth (Google Sign-In) | Free |

---

## Setup Guide

### Step 1 — Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and open the project **gen-lang-client-0456143672** (already configured in `firebase-applet-config.json`)
2. Go to **Authentication → Sign-in method** → Enable **Google**
3. Under **Authentication → Settings → Authorized domains**, add:
   - `your-username.github.io`
   - `your-vercel-backend.vercel.app`
4. Go to **Firestore → Rules** → paste the contents of `firestore.rules` and **Publish**

> **Domain lock:** The Firestore rules enforce `@ecadrn.org` email addresses at the database level. Even if someone bypasses the UI, they cannot read or write any data unless their verified Google account is an @ecadrn.org address.

---

### Step 2 — Deploy the AI Backend to Vercel

The AI features (grant drafting, funder research, etc.) require a server-side Gemini API call. We host this on Vercel for free.

1. Install Vercel CLI: `npm i -g vercel`
2. In the project root, run: `vercel`
3. Follow the prompts to create a new project named `ecadrn-grant-studio-api`
4. After deployment, go to **Vercel Dashboard → Your Project → Settings → Environment Variables** and add:
   - `GEMINI_API_KEY` = your Gemini API key
   - `ALLOWED_ORIGIN` = `https://your-username.github.io` (locks CORS to your Pages domain)
5. Run `vercel --prod` to deploy to production
6. Copy your Vercel URL (e.g. `https://ecadrn-grant-studio-api.vercel.app`)

---

### Step 3 — Push to GitHub & Enable GitHub Pages

1. Create a new **private** GitHub repo named `ecadrn-grant-studio`
   - Private = only invited collaborators can see the source code
   - GitHub Pages will still serve the built site publicly, but only @ecadrn.org users can log in
2. Push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/ecadrn-grant-studio.git
   git push -u origin main
   ```
3. In your GitHub repo go to **Settings → Pages**:
   - Source: **GitHub Actions**
4. Go to **Settings → Variables (not Secrets)** and add:
   - `VITE_API_BASE_URL` = your Vercel URL from Step 2 (e.g. `https://ecadrn-grant-studio-api.vercel.app`)
   - `VITE_BASE_PATH` = `/ecadrn-grant-studio/` (must match your repo name with slashes)
5. Push any change to `main` to trigger the first deployment, or go to **Actions → Deploy to GitHub Pages → Run workflow**

Your app will be live at: `https://YOUR_USERNAME.github.io/ecadrn-grant-studio/`

---

### Step 4 — Invite Coworkers

1. Go to your GitHub repo → **Settings → Collaborators** → **Add people**
2. Add your @ecadrn.org coworkers' GitHub accounts so they can see the source/contribute
3. Share the GitHub Pages URL with them — they sign in with their @ecadrn.org Google account

---

## Local Development

```bash
npm install
cp .env.example .env.local
# Fill in your GEMINI_API_KEY in .env.local
npm run dev
```

The local server runs at `http://localhost:3000` with the Express AI backend bundled.

---

## Security Model

- **Authentication:** Google Sign-In restricted to `hd: ecadrn.org` (hosted domain parameter)
- **Post-auth check:** App immediately signs out any non-@ecadrn.org account that slips through
- **Database rules:** Firestore rejects reads/writes from any user whose `email` token doesn't match `.*@ecadrn\.org$`
- **Email verification:** Rules also require `email_verified == true`
- **CORS:** Vercel backend only accepts requests from your GitHub Pages domain
