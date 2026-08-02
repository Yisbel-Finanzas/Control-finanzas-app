# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Local dev server at http://localhost:5173/Control-finanzas-app/
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

Requires `.env.local` with (see `.env.example`):
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Deploy

Push to `main` → GitHub Actions builds and deploys to GitHub Pages automatically.
Live URL: `https://yisbel-finanzas.github.io/Control-finanzas-app/`

Build secrets (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) must exist in the repo's GitHub Actions secrets.

## Architecture

React 18 + Vite 5 SPA deployed to GitHub Pages under the `Yisbel-Finanzas` org. Supabase handles auth, database, and RLS.

**Routing:** `BrowserRouter` with `basename="/Control-finanzas-app"`. Route `/` redirects to `/dashboard`. A `public/404.html` redirects unknown paths back to `index.html` so client-side navigation survives page refreshes on GitHub Pages.

Active routes in `App.jsx`:
- `/dashboard` → `Dashboard.jsx`
- `/movimientos` → `Movimientos.jsx`
- `/cuentas` → `Cuentas.jsx`
- `/deudas` → `Deudas.jsx`
- `/resumen` → `Resumen.jsx`
- `/metas` → `Metas.jsx`
- `/config/categorias` → `config/Categorias.jsx` (admin only)
- `/config/presupuesto` → `config/Presupuesto.jsx` (admin manages toggle + limits; all users view)

**Auth flow:** Supabase invite-only (no open signups). `App.jsx` reads `window.location.hash` synchronously via `detectAuthFlow()` before any render. If the hash contains `type=invite` or `type=recovery`, it renders `SetPassword.jsx` instead of the normal app. `SetPassword.jsx` waits for `onAuthStateChange` → SIGNED_IN before showing the password form, then calls `supabase.auth.updateUser({ password })` and clears the hash.

**Layout:** Fixed top bar (`--topbar-h: 52px`, blue) with hamburger → `SideMenu`. Bottom tab nav (`--bottomnav-h: 64px`) with 4 tabs: Inicio (Dashboard), Movimientos, Deudas, Resumen. Main content receives `paddingTop: var(--topbar-h)` and `paddingBottom: var(--bottomnav-h)` from `Layout.jsx`. Config routes render inside `<Layout>` but have no bottom tab.

**Roles:** `administradora` | `auxiliar` — stored in `public.perfiles`. The `usePerfil` hook fetches the current user's profile from `perfiles` by `auth.uid()`. Admin-only UI (delete buttons, config menu, FAB on Deudas, toggle en Presupuesto) checks `perfil?.rol === 'administradora'`.

**RLS policies** use direct subqueries — never the `mi_rol()` function (unreliable in RLS context): `EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')`.

**Data conventions:**
- Soft-delete in `movimientos`: `deleted_at` / `deleted_by` columns — never hard DELETE
- Soft-delete in `deudas` and `metas_ahorro`: `activo: false` (no `deleted_at`)
- DOP and USD always in separate columns/records, never mixed or consolidated
- All monetary amounts: `monto` (numeric) + `moneda` ('DOP' | 'USD') as separate fields
- Dates stored as `YYYY-MM-DD` strings; always append `T12:00:00` when constructing `Date` objects to avoid timezone-shift bugs

**Supabase schema key points:**
- `categorias.tipo` check constraint: only `'ingreso'` or `'gasto'`; `activo` bool for soft-deactivation
- `perfiles.rol` check constraint: only `'administradora'` or `'auxiliar'`
- `movimientos` FK: `categoria_id → categorias`, `cuenta_id → cuentas`, `created_by → auth.users`; also has `subcategoria` (free text), `recurrente` (bool), `concepto` (free text)
- `deudas` fields: `nombre`, `moneda`, `tipo` (`'prestamo'` | `'tarjeta_credito'` — check constraint, never `'por_pagar'`), `saldo_actual`, `limite_o_monto_original`, `tasa_interes`, `activo`, `fecha_ultima_actualizacion`
- `abonos_deuda` FK: `deuda_id → deudas`, `cuenta_origen_id → cuentas`, `created_by → auth.users`; inserting an abono also manually updates `deudas.saldo_actual` AND inserts a `movimientos` record (tipo `'gasto'`, concepto `"Abono · {nombre deuda}"`) in the same Promise.all
- `cuentas` fields: `banco` (institution name), `producto` (one of 5 fixed strings: Efectivo, Cuenta corriente, Cuenta de ahorro, Tarjeta de crédito, Tarjeta de débito), `moneda` ('DOP' | 'USD', NOT NULL — required in form, default `'DOP'`), `activo`
- `metas_ahorro` fields: `nombre`, `descripcion`, `monto_objetivo`, `monto_actual`, `moneda`, `fecha_objetivo`, `cuenta_id`, `activo`, `created_by`
- `abonos_meta` FK: `meta_id → metas_ahorro`, `created_by → auth.users`; inserting an abono also manually updates `metas_ahorro.monto_actual` AND inserts a `movimientos` record (tipo `'gasto'`, concepto `"Meta · {nombre meta}"`) in the same Promise.all
- `presupuestos`: `categoria_id` (FK → categorias), `monto_limite`, `moneda`; UNIQUE(categoria_id, moneda) — one recurring monthly limit per category/currency
- `configuracion`: `clave` (PK text), `valor` (text) — key/value store for app-level settings; currently `presupuesto_activo: 'true'|'false'`
- New auth users trigger `handle_new_user()` which inserts into `perfiles` with role `'auxiliar'`

**Linked flows (abonos → movimientos):** Both `Deudas.jsx` and `Metas.jsx` create a `movimientos` gasto record automatically when registering an abono. The category selector in the abono form is **required** — the gasto won't be properly tracked in Resumen and Presupuesto otherwise. The three operations (insert abono, update saldo/monto_actual, insert movimiento) run in `Promise.all`.

**Movimientos module:** Loads up to 500 records with `cuentas(banco, producto)` and `categorias(nombre)` joins. Client-side filtering via `useMemo` (search, tipo, moneda, categoría, date range). Export to Excel via `xlsx` (SheetJS) — exports the currently filtered list; button appears in the blue page header when results exist.

**Presupuesto module:** Admin toggles via `useConfig('presupuesto_activo')`. Budget limits are recurring (no `mes` column) — compared each month against the current month's `movimientos` gastos grouped by `categoria_id + moneda`. Dashboard shows a lazy `BudgetWidget` component that fetches independently and renders only when the module is active.

**Config modules:** `src/pages/config/Categorias.jsx` and `src/pages/config/Presupuesto.jsx` — both accessible via `☰` menu, admin only. Smart delete in Categorias: tries hard delete → FK error → auto-deactivates with toast.

**Page patterns:** Pages that need a bottom sheet define `SheetModal` and `SheetBotones` as private components at the bottom of the file (see `Deudas.jsx`, `Metas.jsx`). There is no shared sheet component — copy the pattern if adding sheets to a new page. The `.ds-sheet` CSS already has `padding-bottom: calc(var(--bottomnav-h) + var(--space-8))` so buttons are never hidden behind the bottom nav.

**Hooks:**
- `usePerfil()` — fetches `perfiles` row for the current auth user
- `useConfig(clave)` — reads/writes a row in `configuracion`; returns `{ valor, loading, update }`. `update()` does an upsert on conflict.
- `useDarkMode()` — persists dark mode preference to localStorage
- `useAnalisisIA()` — calls Edge Function `analizar-gastos`; returns `{ analisis, loading, error, analizar(movimientos, periodo), limpiar }`

**IA Financiera:** Groq API accessed securely via Supabase Edge Function (never from the frontend directly).
- `supabase/functions/analizar-gastos/index.ts` — Deno proxy to Groq (`llama-3.1-8b-instant`). Verifies JWT, trims movimientos to `{ fecha, tipo, categoria, monto, moneda }` to reduce tokens, returns `{ analisis }`. Requires `GROQ_API_KEY` Supabase secret.
- `src/components/IAFloatingButton.jsx` — purple gradient FAB fixed `bottom-left`, admin-only. Three states: `seleccion` (pick monthly or general) → `mensual` / `general` (fetch + analyze). Fetches movimientos directly from Supabase.
- `src/components/AnalisisIA.jsx` — inline card variant used in `Resumen.jsx`; accepts `{ movimientos, periodo }` props.

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

All icons live in `src/components/icons/NavIcons.jsx` as thin wrappers around `lucide-react` components. All export a `size` prop and `aria-hidden="true"`. Global `strokeWidth` is `1.75`.

Available icons: `IconHome`, `IconMoney`, `IconBank`, `IconList`, `IconChart`, `IconMenu`, `IconWallet`, `IconCalendar`, `IconCash`, `IconCreditCard`, `IconRepeat`, `IconX`, `IconPlus`, `IconEye`, `IconEyeOff`, `IconTag`, `IconMoon`, `IconSun`, `IconDashboard`, `IconGoal`, `IconDownload`, `IconGauge`, `IconSparkles`.

When adding a new icon: import it from `lucide-react` and add a one-line export to `NavIcons.jsx` following the same pattern. One icon family only — do not import from other icon libraries.

## SQL Migrations

New table migrations live in `supabase/`. Run them manually in the Supabase SQL editor:
- `supabase/metas_ahorro.sql` — creates `metas_ahorro` + `abonos_meta` tables with RLS
- `supabase/presupuesto.sql` — creates `configuracion` + `presupuestos` tables with RLS
