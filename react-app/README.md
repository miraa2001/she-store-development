# React Migration (Phase 1)

This folder is a new React/Vite app for She-Store.

## What is done
- React app scaffolded with routing.
- Existing static website copied into `public/legacy/`.
- You can open legacy pages from React routes (`#/legacy/index`, `#/legacy/finance`, etc.) while we migrate page-by-page.
- `#/orders` now reads orders from Supabase directly (auth/session + role + order totals) and is fully native React (orders/view/customers tabs).
- `#/orders` now renders native React purchases/details UI (load, add, edit, delete, undo, image lightbox, WhatsApp actions, arrived toggle).
- `#/orders` now renders native React customers tab (list/search/add/edit/delete + same phone validation rules).
- `#/orders` now renders native React view tab (arrived orders list, card/list mode, bag-size edit by role, placed-at-pickup toggle, WhatsApp actions, customer search).
- `#/orders` now exports PDF natively in React and runs Gemini image analysis natively inside add/edit purchase modal.
- Legacy bridge iframe was removed from the orders workflow (legacy pages still available under `#/legacy/:page`).
- Orders screen was refactored into dedicated components (`CommandHeader`, `OrdersSidebar`, `OrdersTab`, `PurchaseFormModal`, `LightboxModal`) for cleaner maintenance.
- `#/pickup-dashboard` is now a native React page (role-aware tabs/sidebar + embedded native homepickup/pickuppoint/collections panels).
- `#/finance` is now native React (role guard + per-order financial KPIs + monthly summary + spent editor).
- `#/archive` is now native React (role guard + archived orders list/details + storage cleanup parity).
- `#/collections` is now native React (role guard + collected purchases split by home/pickup with totals).
- `#/homepickup` is now native React (role guard + pickup toggles + paid-price edit + search + collect action + lightbox).
- `#/pickuppoint` is now native React (role guard + grouped orders for lara + pickup toggles + paid-price edit + collection actions).
- `#/pickup-dashboard` no longer embeds legacy iframes; it now mounts native React panels (`homepickup`, `pickuppoint`, `collections`) in-tab.
- `#/login` is now native React login (Supabase sign-in with username→email mapping).

## Run
```bash
cd react-app
npm install
# copy .env.example to .env and add your Gemini key
npm run dev
```

## Current route model
- `#/` migration dashboard
- `#/orders` fully native React dashboard
- `#/pickup-dashboard` native React dashboard with native embedded panels
- `#/finance`, `#/archive`, `#/collections`, `#/homepickup`, `#/pickuppoint` are native React pages
- `#/login` native React login
- `#/legacy/:page` iframe wrapper for legacy pages copied under `public/legacy`

## Validation
- Use `MIGRATION_CHECKLIST.md` after each migration slice to keep behavior parity.

## Next migration steps
1. Run full parity QA from `MIGRATION_CHECKLIST.md` across all roles/routes before cutover.
2. Decide GitHub Pages deployment model (legacy static vs `react-app/dist`) and switch branch settings.
3. Remove or archive unused legacy JS/CSS once parity QA is complete.
