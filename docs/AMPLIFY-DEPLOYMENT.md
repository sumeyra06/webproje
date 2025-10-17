# AWS Amplify Deployment (Static Hosting)

This repo is a static site (HTML/JS/CSS) using Supabase for backend. No build step is required.

## 1) Connect GitHub repo
1. Go to AWS Amplify Console → Hosting → Create new app → Host web app.
2. Choose GitHub and authorize. Pick your repo `sumeyra06/webproje` and branch `main`.
3. Amplify will detect `amplify.yml` and use it automatically.

## 2) Build settings
- We provide `amplify.yml` at the repo root:
  - No build step (static site)
  - Publish the repository root (`baseDirectory: .`)
  - Custom security headers (CSP, HSTS, etc.)
  - Long cache for `/assets/*`
  - Pretty URL rewrites (e.g., `/admin` → `/admin-panel.html`)

If you need to adjust, edit `amplify.yml` and push to `main`.

## 3) Rewrites & redirects
`amplify.yml` includes 200-status rewrites to serve HTML files without the `.html` extension:
- `/admin` → `/admin-panel.html`
- `/login` → `/login.html`
- `/signup` → `/signup.html`
- `/user` → `/user-home.html`
- `/support` → `/support.html`
- `/gizlilik` → `/gizlilik.html`
- `/hakkimizda` → `/hakkimizda.html`
- `/iletisim` → `/iletisim.html`
- `/referanslar` → `/referanslar.html`
- `/xml-progress` → `/xml-progress.html`
- `/kisisel-verileri-koruma` → `/kisisel-verileri-koruma.html`
- `/bilgi-veri-guvenligi` → `/bilgi-veri-guvenligi.html`
- `/hizmetler` → `/hizmetler.html`
- `/urunler` → `/urunler.html`

You can add more routes as needed.

## 4) Environment variables (Supabase)
- This app reads Supabase keys from `env.local.js` (conditionally loaded) and `supabaseClient.js` which expects public anon key and project URL.
- For production, ensure your public Supabase URL and anon key are inlined in `supabaseClient.js` or served via a publicly accessible config file. Do not expose service role keys.
- CSP (in `amplify.yml`) already allows `connect-src https://*.supabase.co`.

## 5) Cache & security
- `/assets/*` are cached for 1 year with `immutable`.
- Global headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `CSP`.

If you need to allow additional CDNs/APIs, extend CSP in `amplify.yml` (`script-src`, `style-src`, `connect-src`, etc.).

## 6) Verify after deploy
- Open `/admin` and browse panels.
- Dashboard should show Genel Bakış (with KDV Dağılımı chips).
- Invoices page should show filters and list only (no overview cards).
- Browser console should be clean of CSP errors.

## 7) Optional: Custom domain
- In Amplify Console, add your domain, create subdomain, and attach to your app. Enable redirects from `www` to apex domain if desired.

## 8) Rollback
- Amplify keeps previous deployments. You can redeploy any prior commit from the console.
