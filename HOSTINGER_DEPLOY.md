# Hostinger Deployment Guide — ChinguSpeak Admin + PHP Backend

## ✅ What I just fixed in the repo

1. **`frontend/public/.htaccess`** — SPA rewrite rules + Authorization header preservation + caching + security headers. Gets copied into `build/` automatically by `yarn build`, so the deployed `public_html/.htaccess` will Just Work.
2. **`frontend/.env.production`** — `REACT_APP_BACKEND_URL=` (empty). This makes the production build use **relative** `/api` paths, so it calls the PHP backend on the **same domain** as the React app. Works for `linen-wolf-239815.hostingersite.com` AND any custom domain you connect later.
3. **`frontend/src/lib/api.js`** — gracefully defaults to `/api` when no env var is set.

## 📦 Target folder layout on Hostinger `public_html/`

```
public_html/
├── .htaccess               ← from React build (SPA fallback)
├── index.html              ← React build
├── asset-manifest.json
├── favicon.ico
├── static/                 ← React build assets (CSS/JS)
│   ├── css/
│   └── js/
├── mobile/                 ← Optional: Expo Web export (live preview embed)
│   ├── index.html
│   ├── _expo/
│   └── assets/
└── api/                    ← PHP backend (uploaded separately or by GitHub deploy)
    ├── .htaccess           ← PHP routing
    ├── index.php
    ├── config/
    ├── db/
    ├── lib/
    └── api/
```

## 🚀 Redeploy steps

### Step 1: Push the latest repo to GitHub
Use the **"Save to GitHub"** button in this chat to push the new `.htaccess`, `.env.production`, and the updated `api.js` to your `Nadwap1/chinguspeak` repo.

### Step 2: Redeploy frontend on Hostinger
1. Open Hostinger hPanel → **Websites → linen-wolf-239815.hostingersite.com**
2. Open the **GitHub deployment** card (the same one you used the first time).
3. Click **"Deploy now"** (or "Redeploy"). It will:
   - Pull the latest commit from GitHub
   - Run `yarn install && yarn build` inside `/frontend`
   - Copy `/frontend/build/*` into `public_html/`
   - That copy includes the new `.htaccess` automatically.

### Step 3: Verify it worked
After redeploy:
1. Visit `https://linen-wolf-239815.hostingersite.com/` → should redirect to `/login` (admin login page).
2. Visit `https://linen-wolf-239815.hostingersite.com/login` directly → should now load (no 404).
3. Open DevTools → Network tab → log in. The POST should hit `https://linen-wolf-239815.hostingersite.com/api/admin-auth/login` (same-domain `/api/`), NOT my Emergent preview URL.
4. Visit `https://linen-wolf-239815.hostingersite.com/api/health` → should return `{"status":"ok","ts":"..."}` from your PHP backend.

## 🔍 If anything still fails

### Symptom: 404 on /login after redeploy
- `.htaccess` didn't make it into `public_html/`. Check `public_html/.htaccess` in Hostinger File Manager. If missing, manually copy the file `/frontend/public/.htaccess` from the repo into `public_html/`.

### Symptom: Login form submits but does nothing / network error
- DevTools → Network → click the login request → see which URL it called.
- If it called `https://a9bcfa8c...preview.emergentagent.com/...` → the build still has the old env baked in. Make sure `.env.production` exists in `/frontend` and **redeploy**.
- If it called `https://linen-wolf-239815.hostingersite.com/api/admin-auth/login` and got 404 → your PHP backend is missing or `api/.htaccess` isn't routing. Check the response — if it's HTML it's hitting React, meaning Apache didn't honor the `^api(/.*)?$` skip.

### Symptom: Login works but every other admin page (e.g. /llm-keys) 404s on refresh
- This is exactly what the SPA fallback fixes. Confirm `public_html/.htaccess` exists and contains `RewriteRule ^ /index.html [L]` near the bottom. If your Hostinger plan doesn't have `mod_rewrite` enabled, ask Hostinger support to enable it — it's on by default on shared hosting.

### Symptom: "CORS error" in DevTools
- This shouldn't happen because frontend and backend share the same domain. If it does, check `php-backend/config/config.php` → `CORS_ORIGIN`. Set to `'*'` while debugging, then tighten to `'https://linen-wolf-239815.hostingersite.com'` once stable.

## 🔐 Recommended config.php tightening (after first login)

```php
define('CORS_ORIGIN', 'https://linen-wolf-239815.hostingersite.com');
define('SHOW_ERRORS', false);     // hide stack traces in production
// Change SEED_ADMIN_PASSWORD to a NEW value, then re-upload config.php once,
// log in with the new password, then optionally restore the original value.
```

## 🌐 When you connect a custom domain

Nothing in the build changes — because `.env.production` makes the React app use **relative** `/api/*` URLs, the same `public_html/` works on any domain. Just:
1. Point your domain at Hostinger.
2. Issue an SSL cert (Hostinger does it for free).
3. Uncomment the "Force HTTPS" block at the bottom of `.htaccess`.
