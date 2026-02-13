# React Migration (Phase 1)

This folder is a new React/Vite app for She-Store.

## What is done
- React app scaffolded with routing.
- Existing static website copied into `public/legacy/`.
- You can open legacy pages from React routes (`#/legacy/index`, `#/legacy/finance`, etc.) while we migrate page-by-page.
- `#/orders` now reads orders from Supabase directly (auth/session + role + order totals) and syncs selection/search/mode to the legacy iframe adapter.
- `#/orders` now renders native React purchases/details UI (load, add, edit, delete, undo, image lightbox, WhatsApp actions, arrived toggle).
- `#/orders` now renders native React customers tab (list/search/add/edit/delete + same phone validation rules).
- `#/orders` now renders native React view tab (arrived orders list, card/list mode, bag-size edit by role, placed-at-pickup toggle, WhatsApp actions, customer search).
- `#/orders` now exports PDF natively in React and runs Gemini image analysis natively inside add/edit purchase modal.
- Legacy bridge iframe was removed from the orders workflow (legacy pages still available under `#/legacy/:page`).

## Run
```bash
cd react-app
npm install
npm run dev
```

## Current route model
- `#/` migration dashboard
- `#/orders` React-native orders shell + legacy adapter bridge (WIP)
- `#/legacy/:page` iframe wrapper for legacy pages copied under `public/legacy`

## Validation
- Use `MIGRATION_CHECKLIST.md` after each migration slice to keep behavior parity.

## Next migration steps
1. Port remaining pages (`pickup-dashboard`, `finance`, etc.) one by one and remove legacy dependency.
2. Split `OrdersPage.jsx` into smaller components/hooks (header shell, orders list, purchase modal, workspace cards).
3. Add parity checks from `MIGRATION_CHECKLIST.md` for all roles before cutting over.
