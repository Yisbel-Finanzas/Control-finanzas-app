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

**Routing:** `BrowserRouter` with `basename="/Control-finanzas-app"`. Route `/` redirects to `/movimientos`. A `public/404.html` redirects unknown paths back to `index.html` so client-side navigation survives page refreshes on GitHub Pages. `Dashboard.jsx` exists but is **not** imported or routed in `App.jsx`.

**Auth flow:** Supabase invite-only (no open signups). `App.jsx` listens to `onAuthStateChange` and gates all routes behind session check. Unauthenticated users see only `Login`. Password recovery uses `resetPasswordForEmail` with redirect to the GitHub Pages URL.

**Layout:** Fixed top bar (`--topbar-h: 52px`, blue) with hamburger → `SideMenu`. Bottom tab nav (`--bottomnav-h: 64px`) with 4 tabs: Movimientos, Cuentas, Deudas, Resumen. Main content receives `paddingTop: var(--topbar-h)` and `paddingBottom: var(--bottomnav-h)` from `Layout.jsx`. The `/config/categorias` route renders inside `<Layout>` but has no bottom tab.

**Roles:** `administradora` | `auxiliar` — stored in `public.perfiles`. The `usePerfil` hook fetches the current user's profile from `perfiles` by `auth.uid()`. Admin-only UI (delete buttons, config menu, FAB on Deudas) checks `perfil?.rol === 'administradora'`.

**Data conventions:**
- Soft-delete in `movimientos`: `deleted_at` / `deleted_by` columns — never hard DELETE
- Soft-delete in `deudas`: `activo: false` (different pattern — no `deleted_at`)
- DOP and USD always in separate columns/records, never mixed or consolidated
- All monetary amounts: `monto` (numeric) + `moneda` ('DOP' | 'USD') as separate fields
- Dates stored as `YYYY-MM-DD` strings; always append `T12:00:00` when constructing `Date` objects to avoid timezone-shift bugs

**Supabase schema key points:**
- `categorias.tipo` check constraint: only `'ingreso'` or `'gasto'`
- `perfiles.rol` check constraint: only `'administradora'` or `'auxiliar'`
- `movimientos` FK: `categoria_id → categorias`, `cuenta_id → cuentas`, `created_by → auth.users`
- `movimientos` also has `subcategoria` (free text), `recurrente` (bool), `concepto` (free text)
- `deudas` fields: `nombre`, `moneda`, `tipo` (always `'por_pagar'`), `saldo_actual`, `limite_o_monto_original`, `tasa_interes`, `activo`, `fecha_ultima_actualizacion`
- `abonos_deuda` FK: `deuda_id → deudas`, `cuenta_origen_id → cuentas`, `created_by → auth.users`; inserting an abono also manually updates `deudas.saldo_actual` in the same operation
- `cuentas` fields: `banco` (institution name), `producto` (one of 5 fixed strings: Efectivo, Cuenta corriente, Cuenta de ahorro, Tarjeta de crédito, Tarjeta de débito), `activo`
- New auth users trigger `handle_new_user()` which inserts into `perfiles` with role `'auxiliar'`

**Config module:** `src/pages/config/Categorias.jsx` — CRUD for categories, accessible via `☰` menu only to `administradora`. Route: `/config/categorias`.

**Page patterns:** Pages that need a bottom sheet define `SheetModal` and `SheetBotones` as private components at the bottom of the file (see `Deudas.jsx`). There is no shared sheet component — copy the pattern if adding sheets to a new page.

## Design System

All styles use CSS custom properties defined in `src/styles/design-system.css`. Component utility classes are in `src/styles/components.css`. Never use raw hex values in components — always use tokens.

**Key tokens:**
- Colors: `--color-primary`, `--color-primary-light`, `--color-primary-muted`, `--color-success`, `--color-success-light`, `--color-danger`, `--color-danger-light`, `--color-warning`, `--color-warning-light`
- Surfaces: `--color-bg`, `--color-surface`, `--color-border`, `--color-border-strong`
- Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`
- Spacing: `--space-1` through `--space-12` (4px base scale)
- Radii: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px), `--radius-xl` (20px), `--radius-full` (9999px)
- Layout: `--topbar-h: 52px`, `--bottomnav-h: 64px`, `--max-w: 600px`
- Typography: `--text-xs` through `--text-2xl`

**Component classes to use:**
- `.ds-card` — white card with border + shadow
- `.ds-btn .ds-btn-primary` / `.ds-btn-ghost` / `.ds-btn-danger` / `.ds-btn-sm` — buttons
- `.ds-input` — form inputs and selects
- `.ds-label`, `.ds-label-hint`, `.ds-field`, `.ds-field-hint` — form field wrappers (`ds-label-hint` for "(opcional)" suffix)
- `.ds-page-header` — sticky blue page header strip (sticks below topbar via `top: var(--topbar-h)`)
- `.ds-empty` + `.ds-empty-icon` — empty state with SVG icon
- `.ds-section-label` — uppercase section label
- `.ds-sheet-overlay` + `.ds-sheet` + `.ds-sheet-handle` — bottom sheet modal
- `.ds-fab` — floating action button (positioned `fixed`, `bottom: calc(var(--bottomnav-h) + var(--space-4))`)
- `.ds-progress-track` + `.ds-progress-fill` — progress bar
- `.ds-badge .ds-badge-success` / `-danger` / `-warning` / `-primary` — status badges
- `.ds-skeleton` — shimmer placeholder for loading states

**Financial numbers** must use `fontVariantNumeric: 'tabular-nums'` inline style.

## Icon System

All icons live in `src/components/icons/NavIcons.jsx` as inline SVG components with a `size` prop and `aria-hidden="true"`. Never use emoji as structural UI elements.

Available icons: `IconMoney`, `IconBank`, `IconList`, `IconChart`, `IconMenu`, `IconWallet`, `IconCalendar`, `IconCash`, `IconCreditCard`, `IconRepeat`, `IconX`, `IconPlus`, `IconEye`, `IconEyeOff`.

When adding a new icon, add it to `NavIcons.jsx` following the same pattern (SVG with `stroke="currentColor"`, `fill="none"`, `aria-hidden="true"`).
