# Balance real por cuenta

## Contexto

El módulo Cuentas (`src/pages/Cuentas.jsx`) hoy solo administra metadata de cada cuenta (`banco`, `producto`, `moneda`, `activo`). No muestra cuánto dinero hay realmente en cada una — solo se ven gastos/ingresos netos en otros módulos (Resumen, Dashboard), nunca el balance por cuenta individual.

El usuario quiere ver, dentro del módulo Cuentas, el balance real de cada cuenta.

## Objetivo

Mostrar en la tarjeta de cada cuenta (activa o inactiva) su balance actual, calculado a partir de un saldo inicial configurable más el neto de todos los movimientos vinculados a esa cuenta.

## Fuera de alcance

- No se agrega un total agregado por moneda en Cuentas.
- No se agrega ningún widget de balance en el Dashboard.
- No se toca la lógica de `deudas` ni `metas_ahorro` (sus balances ya se manejan de forma independiente).

## Modelo de datos

Nueva columna en `cuentas`:

```sql
ALTER TABLE public.cuentas ADD COLUMN saldo_inicial numeric NOT NULL DEFAULT 0;
```

- Representa el balance que tenía la cuenta al momento de empezar a registrarla en la app (o cualquier corrección manual posterior).
- Editable libremente desde el formulario de Cuentas, tanto al crear como al editar una cuenta existente — es el mecanismo de reconciliación si el balance calculado alguna vez no coincide con el banco real.

**El balance real nunca se persiste.** Se calcula siempre en el cliente como:

```
balance = saldo_inicial + Σ(monto de movimientos tipo 'ingreso') − Σ(monto de movimientos tipo 'gasto')
```

filtrando los movimientos por:
- `cuenta_id = <id de la cuenta>`
- `deleted_at is null` (respeta el soft-delete existente)
- `moneda = cuenta.moneda` (defensivo: por diseño actual del formulario, `moneda` de un movimiento se elige independientemente de la cuenta, así que en teoría podría quedar desalineada; se excluye cualquier movimiento cuya moneda no coincida con la de la cuenta para no contaminar el cálculo)

### Por qué calculado y no un campo `saldo_actual` mantenido por código

El patrón existente en `deudas.saldo_actual` funciona porque solo hay un punto de entrada (registrar un abono) que lo actualiza. Los movimientos de `cuentas`, en cambio, se crean/editan/borran desde múltiples lugares: `MovimientoForm` (alta y edición), el soft-delete en `Movimientos.jsx`, los abonos automáticos de `Deudas.jsx` y `Metas.jsx`. Mantener un contador sincronizado en todos esos puntos es frágil y propenso a desincronizarse. Calcularlo al vuelo es siempre exacto y no requiere modificar código en ningún otro módulo.

## Cambios de código

### 1. Migración SQL

Nuevo archivo `supabase/cuentas_saldo_inicial.sql` (aplicado manualmente en el editor SQL de Supabase, como registro histórico, igual que las demás migraciones del proyecto):

```sql
ALTER TABLE public.cuentas ADD COLUMN saldo_inicial numeric NOT NULL DEFAULT 0;
```

### 2. `src/pages/Cuentas.jsx`

- `emptyForm`: agregar `saldo_inicial: '0'`.
- Formulario (alta y edición): nuevo campo `.ds-input` numérico "Saldo inicial", con hint de que representa el balance de la cuenta al momento de registrarla (o para corregirlo manualmente después).
- `handleSubmit`: incluir `saldo_inicial: Number(form.saldo_inicial) || 0` en el `payload` de insert/update.
- `openEdit`: precargar `form.saldo_inicial` desde `c.saldo_inicial`.
- `fetchCuentas()`: además de `cuentas`, hacer un segundo fetch a `movimientos` (`cuenta_id, tipo, monto, moneda`, `deleted_at is null`) y construir un mapa `cuenta_id → neto` (ingresos − gastos, filtrando por la moneda de cada cuenta al agregar).
- `CuentaCard`: recibe el balance ya calculado (`saldo_inicial + neto`) y lo muestra con `fontVariantNumeric: 'tabular-nums'`; color `--color-danger` si es negativo, `--color-text-primary` (o el tono por defecto de la tarjeta) si es positivo o cero.

## Testing

Manual (no hay suite de tests automatizados en el proyecto):
1. Crear una cuenta nueva con saldo inicial > 0, sin movimientos → el balance mostrado debe ser igual al saldo inicial.
2. Registrar un ingreso y un gasto vinculados a esa cuenta → el balance debe reflejar `saldo_inicial + ingreso − gasto`.
3. Editar (borrar) uno de esos movimientos desde Movimientos → el balance debe actualizarse (el borrado es soft-delete, así que el movimiento debe dejar de contar).
4. Editar el saldo inicial de una cuenta existente con movimientos ya registrados → el balance debe ajustarse en consecuencia.
5. Confirmar que una cuenta inactiva también muestra su balance (no se oculta el cálculo, solo cambia la opacidad visual de la tarjeta).
6. `npm run build` sin errores antes de abrir el PR.
