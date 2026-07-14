# Módulo de Cuentas por Cobrar

**Fecha:** 2026-07-14
**Estado:** Aprobado, pendiente de implementación

## Contexto

La app ya tiene un módulo de "Deudas" (`src/pages/Deudas.jsx`) que trackea dinero que **el usuario debe** a terceros (bancos, tarjetas). Este spec agrega el módulo inverso: **Cuentas por Cobrar**, para trackear dinero que **otras personas deben al usuario** (préstamos personales hechos, ventas a crédito, etc.).

El diseño sigue deliberadamente el mismo patrón arquitectónico de Deudas/Metas de Ahorro (tabla principal + tabla de abonos + vínculo automático a `movimientos`), documentado en `CLAUDE.md`.

## Modelo de datos

Nueva migración: `supabase/cuentas_por_cobrar.sql` (se ejecuta manualmente en el SQL editor de Supabase, como el resto de migraciones del repo).

### Tabla `cuentas_por_cobrar`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `nombre_persona` | text NOT NULL | Nombre de quien debe |
| `nota` | text | Motivo de la deuda, opcional |
| `moneda` | text NOT NULL | CHECK IN ('DOP', 'USD') |
| `monto_original` | numeric NOT NULL | CHECK > 0 |
| `saldo_pendiente` | numeric NOT NULL | CHECK >= 0 |
| `activo` | bool NOT NULL | default true |
| `fecha_ultima_actualizacion` | date | |
| `created_by` | uuid → auth.users | |
| `created_at` | timestamptz | default now() |

### Tabla `abonos_cxc`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `cuenta_cobrar_id` | uuid → cuentas_por_cobrar NOT NULL | |
| `monto` | numeric NOT NULL | CHECK > 0 |
| `moneda` | text NOT NULL | |
| `fecha` | date NOT NULL | default CURRENT_DATE |
| `cuenta_destino_id` | uuid → cuentas | Opcional — dónde se recibió el pago |
| `categoria_id` | uuid → categorias | Requerido en el form (tipo='ingreso') |
| `created_by` | uuid → auth.users | |
| `created_at` | timestamptz | default now() |

### RLS

Siguiendo la convención del proyecto (subquery directa, nunca `mi_rol()`):

- `cuentas_por_cobrar`: SELECT abierto a `authenticated`. INSERT/UPDATE/DELETE restringidos a administradora:
  `EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')`.
- `abonos_cxc`: ALL abierto a `authenticated` (cualquier rol puede registrar un cobro recibido, igual que los abonos de Deudas).

## UI y navegación

- **Página nueva:** `src/pages/CuentasPorCobrar.jsx`.
- **Ruta:** `/cuentas-por-cobrar`, agregada en `App.jsx`.
- **Acceso:** enlace en `SideMenu.jsx`, nueva sección "Cobros" (junto a "Ahorro"), ícono `IconWallet` (ya existe en `NavIcons.jsx`).
- No se agrega a la barra inferior (4 tabs fijos ya definidos).

### Estructura de la página (calcada de `Deudas.jsx`)

- `ds-page-header` con título "Cuentas por cobrar" y contador de cuentas activas.
- Tarjeta resumen "Total por cobrar" (una por moneda presente), en verde: `--color-success-light` / `--color-success` — inverso visual del rojo usado en Deudas.
- Lista de `CuentaCobrarCard`: nombre, nota (si existe), saldo pendiente en verde grande, monto original debajo, barra de progreso (`ds-progress-track`/`ds-progress-fill`) mostrando cuánto se ha cobrado del monto original.
- Botón **"+ Abono"** visible para todos los roles.
- Botones **Editar** / **Marcar cobrada** solo si `perfil?.rol === 'administradora'`.
- FAB `+` (nueva cuenta por cobrar) solo admin.
- Empty state: "No hay cuentas por cobrar activas." + hint "Toca + para registrar una." (solo admin).

### Sheet modal — Nueva/Editar cuenta por cobrar

Campos: nombre_persona (text, requerido), nota (textarea, opcional, label con `ds-label-hint`), moneda (toggle DOP/USD), monto_original (number), saldo_pendiente (number, precargado = monto_original al crear).

### Sheet modal — Registrar abono

Campos: fecha (date), monto abonado + moneda, cuenta destino (select opcional, "dónde recibiste el pago"), categoría de ingreso (select requerido, filtrado `tipo='ingreso' AND activo=true`). Mensaje de ayuda: "Se registrará automáticamente un ingreso en Movimientos."

Reutiliza los mismos componentes privados `SheetModal` / `SheetBotones` (copiados dentro del archivo, como indica `CLAUDE.md` — no hay componente de sheet compartido).

## Lógica de negocio

### Registrar abono (cobro recibido)

`Promise.all` con tres operaciones, igual que el patrón de Deudas/Metas:

1. `INSERT` en `abonos_cxc`.
2. `UPDATE cuentas_por_cobrar` — `saldo_pendiente = saldo_pendiente - monto`, `fecha_ultima_actualizacion = fecha`. Si el saldo resultante es `<= 0`, además `activo = false` (se marca cobrada automáticamente — cubre tanto abonos parciales como un pago único que salda todo).
3. `INSERT` en `movimientos` — `tipo: 'ingreso'`, `monto`, `moneda`, `fecha`, `concepto: "Cobro · {nombre_persona}"`, `categoria_id`, `cuenta_id: cuenta_destino_id`, `created_by`, `recurrente: false`.

Validación: si no se seleccionó categoría, se bloquea el submit con mensaje de error inline (igual que Deudas).

### Marcar cobrada (manual, admin)

Botón admin equivalente al "Saldar" de Deudas: `UPDATE cuentas_por_cobrar SET activo = false` sin exigir que el saldo sea 0 (cubre el caso de deuda perdonada). No genera movimiento. Confirmación con `confirm()` antes de ejecutar.

### Crear/editar cuenta por cobrar

Formulario estándar controlado (`formCuenta` state), `INSERT`/`UPDATE` directo sobre `cuentas_por_cobrar`, sin`Promise.all` (no toca otras tablas).

## Fuera de alcance

- No se agrega widget de resumen en Dashboard ni en Resumen (puede evaluarse en una iteración futura).
- No hay fecha de compromiso/vencimiento ni campo de teléfono/contacto — se descartaron explícitamente en el diseño.
- No hay exportación a Excel (a diferencia de Movimientos).
