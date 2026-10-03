# Deudas tipo "financiera cuota fija" + interés/capital en abonos

## Contexto

Tercer sub-proyecto de la brecha de features con `jhta712-max/Finanzas_IngJohTaAr`. Primer sub-proyecto (fix `token_hash` + CI) mergeado en PR #33, segundo (límite de crédito + transferencias) mergeado en PR #34. Esta es, de nuevo, una feature ya construida y probada en el repo de referencia — el trabajo es portarla.

## Objetivo

1. Soportar un tercer tipo de deuda, `financiera_cuota_fija`: crédito con una financiera no bancaria (ej. Finservices) con cuota mensual fija que **no baja** aunque se abone a capital — a diferencia de `prestamo`, que sí recalcula el pago con el saldo decreciente.
2. Separar, en cada abono, cuánto del monto pagado fue interés vs. capital, para que el saldo de la deuda se reduzca correctamente por el capital real pagado (no por el total de la cuota, que suele incluir interés).

## Modelo de datos

### `deudas.tipo` — tercer valor permitido

```sql
ALTER TABLE public.deudas DROP CONSTRAINT deudas_tipo_check;
ALTER TABLE public.deudas ADD CONSTRAINT deudas_tipo_check
  CHECK (tipo IN ('prestamo', 'tarjeta_credito', 'financiera_cuota_fija'));
```

### `deudas.cuota_fija` / `deudas.cuotas_totales`

```sql
ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuota_fija NUMERIC CHECK (cuota_fija > 0);
ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuotas_totales INTEGER CHECK (cuotas_totales > 0);
```

Ambas nullable, solo tienen sentido cuando `tipo = 'financiera_cuota_fija'`. `cuota_fija` es el pago mensual pactado (fijo durante todo el plazo); `cuotas_totales` es el número de cuotas acordadas.

### `abonos_deuda.interes`

```sql
ALTER TABLE public.abonos_deuda ADD COLUMN IF NOT EXISTS interes NUMERIC DEFAULT 0 CHECK (interes >= 0);
```

`monto` sigue siendo el total que salió de la cuenta (como hoy). `interes` es la porción de ese `monto` que fue interés, no capital. El saldo de la deuda se reduce por `monto - interes`, nunca por `monto` completo. Un abono puramente a capital (pago extra fuera de la cuota regular) deja `interes` en 0 — comportamiento idéntico al actual, retrocompatible con todos los abonos ya registrados.

## Cambios de código (`src/pages/Deudas.jsx`)

### Reemplazar `calcularInteresEstimado`

La función actual reconstruye una aproximación del interés pagado recorriendo los abonos y aplicando la tasa anual mes a mes desde el monto original — una estimación, nunca exacta. Ahora que `interes` es un dato explícito por abono, se reemplaza por una simple suma: `abonosDetalle.reduce((s, a) => s + Number(a.interes || 0), 0)`. Se elimina la función `calcularInteresEstimado` por completo (ya no se usa en ningún lado).

### Carga de abonos y saldo proyectado

- El fetch de abonos para calcular meses transcurridos/proyección (`abonos_deuda.select(...)`) agrega `interes`, y el acumulado por deuda resta `interes` del `monto` antes de sumarlo (`porDeuda[a.deuda_id].total += Number(a.monto) - Number(a.interes || 0)`).
- El fetch del detalle de abonos (sheet de historial) también agrega `interes` a la selección.

### Formulario de deuda

- `emptyDeuda` gana `cuota_fija: ''` y `cuotas_totales: ''`.
- El selector de tipo (grupo de botones) gana una tercera opción "Financiera (cuota fija)"; cuando está seleccionada, aparece un hint explicando que la cuota no baja aunque se abone a capital, y dos campos nuevos ("Cuota fija mensual", "Cantidad de cuotas").
- Al guardar: `cuota_fija`/`cuotas_totales` solo se envían (parseados) cuando `tipo === 'financiera_cuota_fija'` y el campo no está vacío; en cualquier otro caso van `null`.

### `DeudaCard`

- Badge "Cuota fija" junto al nombre cuando `tipo === 'financiera_cuota_fija'`.
- Para ese tipo, la línea de detalle bajo el nombre muestra cuota + cantidad de cuotas + tasa (si hay) en vez de solo "X% interés anual".

### Sheet de detalle (historial de abonos)

- Para `tipo === 'financiera_cuota_fija'`: no se muestra `SimuladorPagoExtra` (el simulador de amortización de saldo decreciente no aplica — la cuota es fija); en su lugar, un aviso con la cuota fija, cantidad de cuotas, y la nota de que los abonos a capital no la reducen.
- Para los demás tipos: `SimuladorPagoExtra` sin cambios.
- El resumen de "interés pagado hasta la fecha" (antes `calcularInteresEstimado`) ahora suma `interes` de los abonos reales, y solo se muestra para tipos distintos de `financiera_cuota_fija` (ahí no aplica el concepto de "interés estimado" de la misma forma, ya que la cuota es fija).
- Cada fila de abono en el historial, si `interes > 0`, muestra un desglose "Capital: X · Interés: Y" debajo de la cuenta de origen.

### Formulario de abono

- `emptyAbono` gana `interes: ''`.
- Nuevo campo opcional "¿Cuánto de ese monto es interés?" con hint explicando que se deja vacío si el pago es 100% capital, y mostrando en vivo el capital resultante (`monto - interés`) mientras el usuario escribe.
- Al guardar: valida `interés ≤ monto` (si no, error "El interés no puede ser mayor que el monto pagado."); el saldo nuevo se calcula como `saldo_actual - capital` (antes `saldo_actual - monto`); el insert a `abonos_deuda` incluye `interes`.

## Fuera de alcance

- No se toca `Cuentas.jsx`, `MovimientoForm.jsx` ni nada de Sugerencias de correos bancarios — son sub-proyectos independientes.
- No se construye ninguna tabla de amortización real por financiera — el cálculo sigue siendo aproximado donde ya lo era (simulador de pago extra para `prestamo`/`tarjeta_credito`), y explícitamente "no aplica" para `financiera_cuota_fija`.

## Testing

Manual (no hay suite de tests automatizados en el proyecto):
1. Crear una deuda tipo "Financiera (cuota fija)" con cuota fija y cantidad de cuotas → la tarjeta debe mostrar el badge "Cuota fija" y la cuota/cantidad en vez de la tasa.
2. Abrir su detalle → no debe aparecer el simulador de pago extra; debe aparecer el aviso de cuota fija.
3. Registrar un abono a una deuda tipo "Préstamo" con monto 1000 e interés 200 → el saldo debe bajar solo 800 (capital), y el historial debe mostrar "Capital: 800.00 · Interés: 200.00".
4. Registrar un abono dejando el campo de interés vacío → debe comportarse exactamente igual que antes (saldo baja el monto completo).
5. Intentar registrar un abono con interés mayor al monto → debe bloquear con el error correspondiente.
6. El resumen "interés pagado hasta la fecha" en el detalle de una deuda tipo préstamo con abonos mixtos (algunos con interés, otros sin) debe sumar correctamente solo los valores de `interes` registrados.
7. `npm run build` sin errores antes de abrir el PR.
