# Límite de crédito en tarjetas + Transferencias entre cuentas

## Contexto

Segundo sub-proyecto de la brecha de features con `jhta712-max/Finanzas_IngJohTaAr` (fork más adelantado de la misma app). Primer sub-proyecto (fix `token_hash` + timeouts CI) ya mergeado. Al re-verificar el inventario completo con el repo local actualizado a `main`, se confirmó que Dashboard, Metas, Movimientos, Resumen, Categorías, Presupuesto, IAFloatingButton, `useAnalisisIA` y el edge function `analizar-gastos` **ya son idénticos** entre ambos repos — esas features ya estaban mergeadas de sesiones anteriores. Los sub-proyectos genuinamente pendientes son: este (Cuentas: límite de crédito + transferencias), Deudas (financiera cuota fija + interés/capital), y Sugerencias de correos bancarios.

Esta es una feature ya construida y probada en el repo de referencia — el trabajo es portarla, no diseñarla desde cero.

## Objetivo

1. Permitir marcar cuentas con `producto = 'Tarjeta de crédito'` con un límite de crédito fijo, mostrar una barra de "disponible de X límite" en su tarjeta, y bloquear el registro de un gasto que dejaría el disponible en negativo.
2. Permitir transferir dinero entre cuentas propias (ej. Popular → BHD) sin que cuente como ingreso/gasto en Resumen/Presupuesto.

## Modelo de datos

### `cuentas.limite_credito`

```sql
ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS limite_credito NUMERIC CHECK (limite_credito > 0);
```

Nullable — solo se espera un valor cuando `producto = 'Tarjeta de crédito'`. No participa en el cálculo del balance (que sigue siendo `saldo_inicial + movimientos +/- transferencias`); es un dato aparte usado únicamente para (a) la barra de progreso en `CuentaCard`, y (b) el bloqueo de gastos en `MovimientoForm.jsx`.

### Tabla `transferencias`

```sql
CREATE TABLE IF NOT EXISTS public.transferencias (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_origen_id  UUID REFERENCES public.cuentas(id) NOT NULL,
  cuenta_destino_id UUID REFERENCES public.cuentas(id) NOT NULL,
  monto             NUMERIC NOT NULL CHECK (monto > 0),
  moneda            TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  fecha             DATE DEFAULT CURRENT_DATE NOT NULL,
  concepto          TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  CHECK (cuenta_origen_id <> cuenta_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_transferencias_origen ON public.transferencias (cuenta_origen_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_destino ON public.transferencias (cuenta_destino_id);

ALTER TABLE public.transferencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transferencias_all" ON public.transferencias
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

Vive en su propia tabla (no en `movimientos`) porque una transferencia no es ingreso ni gasto real — mismo patrón que `abonos_deuda`/`abonos_meta`, que tampoco son "el" movimiento sino una operación que *genera* (o en este caso, no genera) un movimiento. RLS permisiva para cualquier `authenticated`, igual que el resto de tablas operativas del proyecto — la restricción de quién puede hacer qué vive en la UI (`isAdmin`), no en RLS, siguiendo la convención ya establecida (ej. registrar un movimiento tampoco está restringido a admin).

## Cambios de código

### `src/pages/Cuentas.jsx`

- `emptyForm` gana `limite_credito: ''`; `saldo_inicial` pasa de requerido-con-default-'0' a opcional (string vacío por default, se envía `0` si queda vacío al guardar).
- Nuevo estado para el flujo de transferencias: `showTransferForm`, `formTransferencia` (origen, destino, monto, fecha, concepto), `transferError`, `savingTransfer`, `showHistorial`, `transferencias`, `loadingHistorial`.
- `fetchCuentas()`: además de `cuentas` y `movimientos`, trae `transferencias` (`cuenta_origen_id, cuenta_destino_id, monto`) y las resta del balance de la cuenta origen / suma al de la cuenta destino. **Se conserva el guard de moneda** ya existente en nuestro `fetchCuentas()` actual (filtra movimientos cuya `moneda` no coincide con la de la cuenta) — la referencia lo quitó al reescribir la función, pero es una mejora de seguridad de datos que ya pasó una revisión de calidad en este repo y no cambia el comportamiento en el caso normal (donde `moneda` del movimiento siempre coincide con la de su cuenta).
- `openTransferir()`, `handleSubmitTransferencia()` (valida cuentas distintas, misma moneda, inserta en `transferencias`, refresca), `openHistorial()` (trae últimas 50 transferencias con joins a banco/producto de origen y destino).
- `openEdit()`/`handleSubmit()`: incluyen `limite_credito` en el payload; `handleSubmit` exige `limite_credito` (con `alert()`, igual que la validación de `banco` ya existente) cuando `producto === 'Tarjeta de crédito'`.
- Franja "Balance disponible" (suma de balances por moneda de cuentas activas) sobre la lista.
- Botones "Transferir entre cuentas" / "Historial" (solo si hay ≥2 cuentas activas) — sin restricción de admin, igual que registrar movimientos.
- Formulario: nuevo campo "Límite de crédito" (solo visible/requerido si `producto === 'Tarjeta de crédito'`); el campo "Saldo inicial" se re-etiqueta "Disponible actual" para tarjetas de crédito, con hint distinto según el tipo de cuenta.
- Dos sheets nuevos: formulario de transferencia, e historial de transferencias (ambos siguiendo el patrón `SheetModal`/`ds-sheet` ya usado en el resto de la app).
- `CuentaCard`: recibe `balance` ya calculado (antes recibía `neto` y calculaba `balance` internamente — se mueve el cálculo al padre para poder reusarlo también en la franja de "Balance disponible"). Si es tarjeta de crédito con `limite_credito`, muestra el disponible, el límite, y una barra `.ds-progress-track`/`.ds-progress-fill` coloreada según % usado (verde <60%, amarillo 60-85%, rojo >85%).

### `src/components/MovimientoForm.jsx`

- El fetch de `cuentas` para el selector incluye ahora `saldo_inicial, limite_credito` (antes solo `id, banco, producto`).
- Nueva función `excedeLimiteTarjeta(cuentaId, monto)`: si la cuenta no es tarjeta de crédito o no tiene `limite_credito`, retorna `null` (no bloquea). Si lo es, recalcula el disponible actual (saldo_inicial + neto de movimientos no borrados + neto de transferencias, excluyendo el propio registro vía `.neq('id', item.id)` si se está editando) y retorna el disponible si el monto lo excede (para mostrarlo en el mensaje de error), o `null` si no hay problema.
- `handleSubmit()`: para `tipo === 'gasto'`, llama `excedeLimiteTarjeta` antes de las demás validaciones; si retorna un valor (no `null`), bloquea el submit con `setFormError` mostrando el disponible real.

## Fuera de alcance

- No se toca `Deudas.jsx` (tipo `financiera_cuota_fija`, interés/capital) — es el siguiente sub-proyecto, independiente.
- No se toca nada de Sugerencias de correos bancarios.
- No hay conversión de tipo de cambio en transferencias — origen y destino deben tener la misma moneda, validado en el cliente antes de insertar.

## Testing

Manual (no hay suite de tests automatizados en el proyecto):
1. Crear una cuenta con `producto = 'Tarjeta de crédito'` sin poner límite → debe bloquear el guardado con el alert de "Ingresa el límite de crédito de la tarjeta."
2. Crear la misma cuenta con límite de crédito y un "disponible actual" inicial → la tarjeta debe mostrar la barra de progreso con el % correcto.
3. Registrar un gasto contra esa tarjeta que no exceda el disponible → debe guardar normalmente y la barra debe actualizarse.
4. Registrar un gasto que exceda el disponible → debe bloquearse con el mensaje de error mostrando el disponible real.
5. Con 2 cuentas activas de la misma moneda, hacer una transferencia → el balance de origen debe bajar y el de destino subir exactamente el monto transferido; no debe aparecer en Movimientos ni en Resumen.
6. Intentar transferir entre cuentas de monedas distintas → debe bloquearse con el error correspondiente.
7. Abrir "Historial" → debe listar la transferencia recién creada con los nombres de banco correctos.
8. `npm run build` sin errores antes de abrir el PR.
