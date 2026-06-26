# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Local dev server at http://localhost:5173/Control-finanzas-app/
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

Requires `.env.local` with:
```
VITE_SUPABASE_URL=https://ivfxnpafglgixyaknmxy.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_4SCgEd3SQKhkNO5m44pFew_K5HkYfal
```

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically.
Live URL: `https://yisbel-finanzas.github.io/Control-finanzas-app/`

Build secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must exist in the repo's GitHub Actions secrets.

## Architecture

React 18 + Vite 5 SPA deployed to GitHub Pages under the `Yisbel-Finanzas` org. Supabase handles auth, database, and RLS.

**Routing:** `BrowserRouter` with `basename="/Control-finanzas-app"`. A `public/404.html` redirects unknown paths back to `index.html` so client-side navigation survives page refreshes on GitHub Pages.

**Auth flow:** Supabase invite-only (no open signups). `App.jsx` listens to `onAuthStateChange` and gates all routes behind session check. Unauthenticated users see only `Login`. Password recovery uses `resetPasswordForEmail` with redirect to the GitHub Pages URL.

**Layout:** Fixed top bar (48px, blue) with hamburger `☰` → `SideMenu`. Bottom tab nav (64px). Main content has `paddingTop: 48px` and `paddingBottom: 64px`.

**Roles:** `administradora` | `auxiliar` — stored in `public.perfiles`. The `usePerfil` hook fetches the current user's profile from `perfiles` by `auth.uid()`. Admin-only UI (delete buttons, config menu) checks `perfil?.rol === 'administradora'`.

**Data conventions:**
- Soft-delete only: `deleted_at` / `deleted_by` columns — never hard DELETE from `movimientos`
- DOP and USD always in separate columns/records, never mixed or consolidated
- All monetary amounts: `monto` (numeric) + `moneda` ('DOP' | 'USD') as separate fields

**Supabase schema key points:**
- `categorias.tipo` check constraint: only `'ingreso'` or `'gasto'`
- `perfiles.rol` check constraint: only `'administradora'` or `'auxiliar'`
- `movimientos` FK: `categoria_id → categorias`, `cuenta_id → cuentas`, `created_by → auth.users`
- New auth users trigger `handle_new_user()` which inserts into `perfiles` with role `'auxiliar'`

**Config module:** `src/pages/config/Categorias.jsx` — CRUD for categories, accessible via `☰` menu only to `administradora`. Route: `/config/categorias`.
