# She-Store React App

This repository contains the React/Vite staff app for She-Store.

## What Is Done
- Core pages are native React: `#/orders`, `#/pickup-dashboard`, `#/pickuppoint`, `#/finance`, `#/archive`, `#/collections`, `#/homepickup`, `#/login`.
- Orders screen is fully native (orders/view/customers tabs, add/edit/delete, undo, lightbox, WhatsApp actions, PDF export, Gemini extraction).
- Pickup dashboard mounts native React panels (home pickup, pickup point, collections) instead of legacy iframes.
- Shared helpers are extracted for auth profile, navigation/session, pickup semantics/notifications, date formatting, and search utilities.
- 15-minute inactivity session timeout is enabled app-wide.
- Legacy pages are still available under `#/legacy/:page` as fallback.

## Local Run
```bash
npm install
# copy .env.example to .env and add your values
npm run dev
```

Required `.env` keys:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY` (optional unless Gemini extraction is used)

## Current Routes
- `#/` redirects to `#/login`
- `#/migration` migration dashboard
- `#/orders` native React orders dashboard
- `#/pickup-dashboard` native React pickup dashboard
- `#/finance`, `#/archive`, `#/collections`, `#/homepickup`, `#/pickuppoint` native React pages
- `#/login` native React login
- `#/legacy/:page` legacy iframe wrapper (`public/legacy`)

## Validation
- Use `MIGRATION_CHECKLIST.md` for role-based parity testing.

## GitHub Pages Deploy
Workflow: `.github/workflows/deploy-react-pages.yml`

1. In repo settings, set Pages source to `GitHub Actions`.
2. Add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY`
3. Push to `main` (or run workflow manually).
4. Workflow builds the root Vite app and deploys `dist`.

## Go-Live
1. Run parity QA from `MIGRATION_CHECKLIST.md` for all roles.
2. Verify login/logout + 15-minute inactivity timeout.
3. Verify PDF/Gemini/WhatsApp actions on production URL.
4. Keep `#/legacy/*` only as temporary fallback until final sign-off.
