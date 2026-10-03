# Deudas financiera cuota fija + interés/capital Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un tercer tipo de deuda (`financiera_cuota_fija`, con cuota mensual que no baja aunque se abone a capital) y separar interés de capital en cada abono, para que el saldo de la deuda se reduzca correctamente.

**Architecture:** Dos migraciones SQL aditivas (`deudas.cuota_fija`/`cuotas_totales` + ampliar el CHECK de `tipo`; `abonos_deuda.interes`). `Deudas.jsx` reemplaza su estimación aproximada de interés por la suma del campo explícito `interes` de los abonos ya registrados, condiciona la UI de amortización/simulador al tipo de deuda, y el formulario de abono permite indicar cuánto de lo pagado fue interés.

**Tech Stack:** React 18, Supabase (Postgres + RLS + supabase-js). Sin framework de testing automatizado — verificación manual (build + navegador).

---

### Task 1: Migraciones SQL

**Files:**
- Create: `supabase/deudas_financiera_cuota_fija.sql`
- Create: `supabase/abonos_deuda_interes.sql`

- [ ] **Step 1: Escribir la migración de tipo de deuda + cuota fija**

```sql
-- Financieras no bancarias (ej. Finservices): cuota mensual FIJA durante toda la vida del
-- crédito, pactada sobre un número de cuotas establecido. A diferencia de un préstamo bancario,
-- un abono a capital no reduce la cuota (solo acorta el plazo o queda como excedente según la
-- política de la financiera) — por eso se modela aparte del amortizable 'prestamo'.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.deudas DROP CONSTRAINT deudas_tipo_check;
ALTER TABLE public.deudas ADD CONSTRAINT deudas_tipo_check
  CHECK (tipo IN ('prestamo', 'tarjeta_credito', 'financiera_cuota_fija'));

ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuota_fija NUMERIC CHECK (cuota_fija > 0);
ALTER TABLE public.deudas ADD COLUMN IF NOT EXISTS cuotas_totales INTEGER CHECK (cuotas_totales > 0);

COMMENT ON COLUMN public.deudas.cuota_fija IS 'Solo para tipo financiera_cuota_fija: monto de cuota fijo que no cambia aunque se abone a capital.';
COMMENT ON COLUMN public.deudas.cuotas_totales IS 'Solo para tipo financiera_cuota_fija: número total de cuotas pactadas.';
```

- [ ] **Step 2: Escribir la migración de interés en abonos**

```sql
-- Permite registrar la cuota completa (capital + interés) de un préstamo bancario. `monto` sigue
-- siendo el total pagado (lo que realmente salió de la cuenta); `interes` es la porción de ese
-- monto que fue interés. El saldo de la deuda solo debe reducirse por (monto - interes).
-- Para abonos puramente a capital (pago extra fuera de la cuota regular), interes queda en 0 —
-- comportamiento idéntico al que ya existía antes de este cambio.
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.abonos_deuda ADD COLUMN IF NOT EXISTS interes NUMERIC DEFAULT 0 CHECK (interes >= 0);
```

- [ ] **Step 3: Aplicar ambas migraciones en Supabase**

Use the Supabase MCP tools (load schemas via ToolSearch with query "select:mcp__Supabase__apply_migration,mcp__Supabase__execute_sql" first). Target project_id `ivfxnpafglgixyaknmxy` ("DraYisbelP12's Finanzas") — confirmed, do not ask about it.

Apply via `apply_migration`: one named `deudas_financiera_cuota_fija` with the exact SQL from Step 1, another named `abonos_deuda_interes` with the exact SQL from Step 2.

Verify with `execute_sql`:
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'deudas_tipo_check';
select column_name, data_type from information_schema.columns where table_name = 'deudas' and column_name in ('cuota_fija', 'cuotas_totales');
select column_name, data_type, column_default from information_schema.columns where table_name = 'abonos_deuda' and column_name = 'interes';
```
Expected: the constraint def includes `'financiera_cuota_fija'`; two rows for `deudas` (`cuota_fija numeric`, `cuotas_totales integer`); one row for `abonos_deuda` (`interes numeric`, default `0`).

This is a LIVE PRODUCTION database with real debts/payments. Only run the SQL specified.

- [ ] **Step 4: Commit**

```bash
git add supabase/deudas_financiera_cuota_fija.sql supabase/abonos_deuda_interes.sql
git commit -m "feat: agregar tipo financiera_cuota_fija a deudas e interes a abonos_deuda"
```

---

### Task 2: Interés real en vez de estimado

**Files:**
- Modify: `src/pages/Deudas.jsx`

- [ ] **Step 1: Eliminar `calcularInteresEstimado`**

Find:
```jsx
// Estima cuánto de lo abonado hasta ahora fue interés vs. capital, reconstruyendo el saldo
// abono por abono desde el monto original. Es una aproximación: asume que el saldo antes del
// primer abono registrado es `limite_o_monto_original` y que el interés se acumula linealmente
// entre fechas de abono — no reemplaza la tabla de amortización real del banco.
function calcularInteresEstimado(abonos, montoOriginal, tasaAnualPct) {
  if (!montoOriginal || montoOriginal <= 0 || abonos.length === 0) return null
  const tasaMensual = (Number(tasaAnualPct) || 0) / 100 / 12
  const ordenados = [...abonos].sort((a, b) => a.fecha.localeCompare(b.fecha))
  let saldo = Number(montoOriginal)
  let interesTotal = 0
  let fechaAnterior = null
  for (const a of ordenados) {
    if (fechaAnterior) {
      const dias = (new Date(a.fecha + 'T12:00:00') - new Date(fechaAnterior + 'T12:00:00')) / 86400000
      const meses = dias / 30.4368
      const interesPeriodo = saldo * tasaMensual * meses
      interesTotal += interesPeriodo
      saldo -= (Number(a.monto) - interesPeriodo)
    } else {
      saldo -= Number(a.monto)
    }
    fechaAnterior = a.fecha
  }
  return Math.max(0, interesTotal)
}

// Simulación simple de amortización: aplica interés mensual sobre el saldo y resta el pago,
```

Replace with:
```jsx
// Simulación simple de amortización: aplica interés mensual sobre el saldo y resta el pago,
```

(This removes the function entirely — only its definition and the blank line before the next comment; the `simularAmortizacion` function and everything else stays.)

- [ ] **Step 2: Agregar `interes` al fetch de proyección y restarlo del acumulado**

Find:
```jsx
    supabase
      .from('abonos_deuda')
      .select('deuda_id, monto, fecha')
      .in('deuda_id', ids)
      .then(({ data }) => {
        const porDeuda = {}
        for (const a of data || []) {
          if (!porDeuda[a.deuda_id]) porDeuda[a.deuda_id] = { total: 0, primeraFecha: a.fecha }
          porDeuda[a.deuda_id].total += Number(a.monto)
          if (a.fecha < porDeuda[a.deuda_id].primeraFecha) porDeuda[a.deuda_id].primeraFecha = a.fecha
        }
```

Replace with:
```jsx
    supabase
      .from('abonos_deuda')
      .select('deuda_id, monto, interes, fecha')
      .in('deuda_id', ids)
      .then(({ data }) => {
        const porDeuda = {}
        for (const a of data || []) {
          if (!porDeuda[a.deuda_id]) porDeuda[a.deuda_id] = { total: 0, primeraFecha: a.fecha }
          porDeuda[a.deuda_id].total += Number(a.monto) - Number(a.interes || 0)
          if (a.fecha < porDeuda[a.deuda_id].primeraFecha) porDeuda[a.deuda_id].primeraFecha = a.fecha
        }
```

- [ ] **Step 3: Agregar `interes` al fetch del detalle de abonos**

Find:
```jsx
    const { data } = await supabase
      .from('abonos_deuda')
      .select('id, monto, moneda, fecha, cuentas(banco, producto)')
      .eq('deuda_id', d.id)
      .order('fecha', { ascending: false })
```

Replace with:
```jsx
    const { data } = await supabase
      .from('abonos_deuda')
      .select('id, monto, interes, moneda, fecha, cuentas(banco, producto)')
      .eq('deuda_id', d.id)
      .order('fecha', { ascending: false })
```

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build exitoso. (`calcularInteresEstimado` ya no se usa en ningún lado en este punto del plan — su único call site, en el sheet de detalle, se reemplaza en el Task 5; si el build fallara por una referencia rota a `calcularInteresEstimado`, significa que el Task 5 todavía no se aplicó, lo cual es esperado en este punto — pasar a Task 5 antes de considerar esto un problema real. Si da error de referencia no definida, es correcto: avanzar de inmediato al Task 5 sin detenerse aquí.)

- [ ] **Step 5: Commit**

```bash
git add src/pages/Deudas.jsx
git commit -m "feat: usar interes real de abonos en vez de estimado"
```

Nota: el build puede fallar en este punto porque `calcularInteresEstimado` todavía se usa más abajo en el archivo (Task 5 lo reemplaza). Si el build falla únicamente por esa referencia, commitear de todas formas — es un estado intermedio esperado entre tasks de este plan, y Task 5 lo resuelve inmediatamente después. Si el build falla por cualquier OTRA razón, no commitear — investigar primero.

---

### Task 3: Formulario de deuda con tipo "financiera cuota fija"

**Files:**
- Modify: `src/pages/Deudas.jsx`

- [ ] **Step 1: Agregar `cuota_fija`/`cuotas_totales` a `emptyDeuda`**

Find:
```jsx
const emptyDeuda = { nombre: '', tipo: 'prestamo', moneda: 'DOP', saldo_actual: '', limite_o_monto_original: '', tasa_interes: '' }
```

Replace with:
```jsx
const emptyDeuda = { nombre: '', tipo: 'prestamo', moneda: 'DOP', saldo_actual: '', limite_o_monto_original: '', tasa_interes: '', cuota_fija: '', cuotas_totales: '' }
```

- [ ] **Step 2: Precargar en `openEditDeuda`**

Find:
```jsx
  function openEditDeuda(d) {
    setEditDeuda(d)
    setFormDeuda({
      nombre: d.nombre,
      tipo: d.tipo || 'prestamo',
      moneda: d.moneda,
      saldo_actual: d.saldo_actual ?? '',
      limite_o_monto_original: d.limite_o_monto_original ?? '',
      tasa_interes: d.tasa_interes ?? '',
    })
    setShowDeudaForm(true)
  }
```

Replace with:
```jsx
  function openEditDeuda(d) {
    setEditDeuda(d)
    setFormDeuda({
      nombre: d.nombre,
      tipo: d.tipo || 'prestamo',
      moneda: d.moneda,
      saldo_actual: d.saldo_actual ?? '',
      limite_o_monto_original: d.limite_o_monto_original ?? '',
      tasa_interes: d.tasa_interes ?? '',
      cuota_fija: d.cuota_fija ?? '',
      cuotas_totales: d.cuotas_totales ?? '',
    })
    setShowDeudaForm(true)
  }
```

- [ ] **Step 3: Enviar `cuota_fija`/`cuotas_totales` en `handleSubmitDeuda`**

Find:
```jsx
    const payload = {
      nombre: formDeuda.nombre.trim(),
      tipo: formDeuda.tipo,
      moneda: formDeuda.moneda,
      saldo_actual: formDeuda.saldo_actual !== '' ? parseFloat(formDeuda.saldo_actual) : null,
      limite_o_monto_original: formDeuda.limite_o_monto_original !== '' ? parseFloat(formDeuda.limite_o_monto_original) : null,
      tasa_interes: formDeuda.tasa_interes !== '' ? parseFloat(formDeuda.tasa_interes) : null,
      fecha_ultima_actualizacion: new Date().toISOString().split('T')[0],
      activo: true,
    }
```

Replace with:
```jsx
    const payload = {
      nombre: formDeuda.nombre.trim(),
      tipo: formDeuda.tipo,
      moneda: formDeuda.moneda,
      saldo_actual: formDeuda.saldo_actual !== '' ? parseFloat(formDeuda.saldo_actual) : null,
      limite_o_monto_original: formDeuda.limite_o_monto_original !== '' ? parseFloat(formDeuda.limite_o_monto_original) : null,
      tasa_interes: formDeuda.tasa_interes !== '' ? parseFloat(formDeuda.tasa_interes) : null,
      cuota_fija: formDeuda.tipo === 'financiera_cuota_fija' && formDeuda.cuota_fija !== '' ? parseFloat(formDeuda.cuota_fija) : null,
      cuotas_totales: formDeuda.tipo === 'financiera_cuota_fija' && formDeuda.cuotas_totales !== '' ? parseInt(formDeuda.cuotas_totales, 10) : null,
      fecha_ultima_actualizacion: new Date().toISOString().split('T')[0],
      activo: true,
    }
```

- [ ] **Step 4: Tercer botón de tipo + hint + campos condicionales en el formulario**

Find:
```jsx
            <div className="ds-field">
              <p className="ds-label" id="tipo-deuda-label">Tipo</p>
              <div role="group" aria-labelledby="tipo-deuda-label" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {[['prestamo', 'Préstamo'], ['tarjeta_credito', 'Tarjeta de crédito']].map(([val, label]) => (
                  <button key={val} type="button" aria-pressed={formDeuda.tipo === val}
                    onClick={() => setD('tipo', val)}
                    style={{
                      flex: 1, padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${formDeuda.tipo === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: formDeuda.tipo === val ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: formDeuda.tipo === val ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-sm)',
                    }}>{label}</button>
                ))}
              </div>
            </div>
```

Replace with:
```jsx
            <div className="ds-field">
              <p className="ds-label" id="tipo-deuda-label">Tipo</p>
              <div role="group" aria-labelledby="tipo-deuda-label" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {[['prestamo', 'Préstamo'], ['tarjeta_credito', 'Tarjeta de crédito'], ['financiera_cuota_fija', 'Financiera (cuota fija)']].map(([val, label]) => (
                  <button key={val} type="button" aria-pressed={formDeuda.tipo === val}
                    onClick={() => setD('tipo', val)}
                    style={{
                      flex: '1 1 30%', padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${formDeuda.tipo === val ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: formDeuda.tipo === val ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: formDeuda.tipo === val ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-sm)',
                    }}>{label}</button>
                ))}
              </div>
              {formDeuda.tipo === 'financiera_cuota_fija' && (
                <p className="ds-field-hint" style={{ marginTop: 'var(--space-2)' }}>
                  Cuota mensual fija durante todo el plazo — no baja aunque abones a capital.
                </p>
              )}
            </div>
```

- [ ] **Step 5: Campos "Cuota fija mensual" / "Cantidad de cuotas", condicionales**

Find:
```jsx
            <div className="ds-field">
              <label htmlFor="deuda-tasa" className="ds-label">
                Tasa de interés % <span className="ds-label-hint">(opcional)</span>
              </label>
              <input id="deuda-tasa" type="number" step="0.01" min="0"
                value={formDeuda.tasa_interes}
                onChange={e => setD('tasa_interes', e.target.value)}
                placeholder="Ej: 36.00" className="ds-input" />
            </div>

            <SheetBotones onCancel={() => setShowDeudaForm(false)} saving={saving}
              label={editDeuda ? 'Guardar cambios' : 'Registrar deuda'} />
```

Replace with:
```jsx
            <div className="ds-field">
              <label htmlFor="deuda-tasa" className="ds-label">
                Tasa de interés % <span className="ds-label-hint">(opcional)</span>
              </label>
              <input id="deuda-tasa" type="number" step="0.01" min="0"
                value={formDeuda.tasa_interes}
                onChange={e => setD('tasa_interes', e.target.value)}
                placeholder="Ej: 36.00" className="ds-input" />
            </div>

            {formDeuda.tipo === 'financiera_cuota_fija' && (
              <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="deuda-cuota-fija" className="ds-label">Cuota fija mensual</label>
                  <input id="deuda-cuota-fija" type="number" step="0.01" min="0.01"
                    value={formDeuda.cuota_fija}
                    onChange={e => setD('cuota_fija', e.target.value)}
                    placeholder="0.00" className="ds-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="deuda-cuotas-totales" className="ds-label">Cantidad de cuotas</label>
                  <input id="deuda-cuotas-totales" type="number" step="1" min="1"
                    value={formDeuda.cuotas_totales}
                    onChange={e => setD('cuotas_totales', e.target.value)}
                    placeholder="Ej: 24" className="ds-input" />
                </div>
              </div>
            )}

            <SheetBotones onCancel={() => setShowDeudaForm(false)} saving={saving}
              label={editDeuda ? 'Guardar cambios' : 'Registrar deuda'} />
```

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev`. If no Supabase credentials available in this sandbox, do a build-only check instead and note that explicitly. If you can check visually: open "Nueva deuda", select "Financiera (cuota fija)" — the hint and the two new fields ("Cuota fija mensual", "Cantidad de cuotas") should appear; switching back to another type should hide them.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Deudas.jsx
git commit -m "feat: agregar tipo financiera cuota fija al formulario de deuda"
```

---

### Task 4: DeudaCard con badge y detalle de cuota fija

**Files:**
- Modify: `src/pages/Deudas.jsx`

- [ ] **Step 1: Badge y línea de detalle condicional**

Find:
```jsx
          <div>
            <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{d.nombre}</p>
            {d.tasa_interes && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {d.tasa_interes}% interés anual
              </p>
```

Replace with:
```jsx
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{d.nombre}</p>
              {d.tipo === 'financiera_cuota_fija' && (
                <span className="ds-badge ds-badge-warning">Cuota fija</span>
              )}
            </div>
            {d.tipo === 'financiera_cuota_fija' ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {d.cuota_fija ? `${Number(d.cuota_fija).toLocaleString('es-DO', { minimumFractionDigits: 2 })} ${d.moneda}/mes` : ''}
                {d.cuota_fija && d.cuotas_totales ? ' · ' : ''}
                {d.cuotas_totales ? `${d.cuotas_totales} cuotas` : ''}
                {d.tasa_interes ? ` · ${d.tasa_interes}% fijo` : ''}
              </p>
            ) : d.tasa_interes && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {d.tasa_interes}% interés anual
              </p>
```

(The closing `)}` for the original `{d.tasa_interes && (...)}` conditional, a few lines below this find/replace block, does NOT need to change — it already correctly closes the new `... : d.tasa_interes && ( ... )` ternary branch, since both the old and new code have exactly one opening `(` per `&&`/ternary branch here. Only the content shown above changes; leave everything after it in `DeudaCard` untouched.)

- [ ] **Step 2: Verificar en el navegador**

Build-only if no live access (note explicitly which). If live: a deuda with `tipo = 'financiera_cuota_fija'` should show the "Cuota fija" badge and the cuota/cuotas/tasa line instead of just "X% interés anual". A `prestamo`/`tarjeta_credito` deuda should look exactly as before (no badge, same tasa-only line).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Deudas.jsx
git commit -m "feat: badge y detalle de cuota fija en DeudaCard"
```

---

### Task 5: Sheet de detalle — interés real y vista de cuota fija

**Files:**
- Modify: `src/pages/Deudas.jsx`

- [ ] **Step 1: Condicionar el simulador / mostrar aviso de cuota fija**

Find:
```jsx
        <SheetModal onClose={() => setShowDetalle(false)} title="Historial de abonos" subtitle={deudaDetalle?.nombre}>
          <SimuladorPagoExtra
            deuda={deudaDetalle}
            proyeccion={proyecciones[deudaDetalle?.id]}
            extra={extraSimulado}
            onExtraChange={setExtraSimulado}
          />

          {!loadingAbonos && abonosDetalle.length > 0 && (() => {
            const interesEstimado = calcularInteresEstimado(
              abonosDetalle, deudaDetalle?.limite_o_monto_original, deudaDetalle?.tasa_interes
            )
            if (interesEstimado === null) return null
            return (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Interés pagado hasta la fecha (estimado): <strong style={{ color: 'var(--color-text-secondary)' }}>
                  {interesEstimado.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {deudaDetalle?.moneda}
                </strong>
              </p>
            )
          })()}
```

Replace with:
```jsx
        <SheetModal onClose={() => setShowDetalle(false)} title="Historial de abonos" subtitle={deudaDetalle?.nombre}>
          {deudaDetalle?.tipo === 'financiera_cuota_fija' ? (
            <div style={{
              background: 'var(--color-warning-light)', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-4)',
              fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5,
            }}>
              Cuota fija: {deudaDetalle.cuota_fija
                ? `${Number(deudaDetalle.cuota_fija).toLocaleString('es-DO', { minimumFractionDigits: 2 })} ${deudaDetalle.moneda}/mes`
                : 'no especificada'}
              {deudaDetalle.cuotas_totales ? ` durante ${deudaDetalle.cuotas_totales} cuotas` : ''}.
              Los abonos a capital no reducen esta cuota — solo el saldo pendiente.
            </div>
          ) : (
            <SimuladorPagoExtra
              deuda={deudaDetalle}
              proyeccion={proyecciones[deudaDetalle?.id]}
              extra={extraSimulado}
              onExtraChange={setExtraSimulado}
            />
          )}

          {deudaDetalle?.tipo !== 'financiera_cuota_fija' && !loadingAbonos && abonosDetalle.length > 0 && (() => {
            const interesTotal = abonosDetalle.reduce((s, a) => s + Number(a.interes || 0), 0)
            if (interesTotal <= 0) return null
            return (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Interés pagado hasta la fecha (registrado en tus abonos): <strong style={{ color: 'var(--color-text-secondary)' }}>
                  {interesTotal.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {deudaDetalle?.moneda}
                </strong>
              </p>
            )
          })()}
```

(This removes the last remaining call to `calcularInteresEstimado` — after this step, the function no longer exists anywhere in the file, matching Task 2's removal of its definition. If `npm run build` failed after Task 2 specifically due to a missing `calcularInteresEstimado` reference, it must succeed now.)

- [ ] **Step 2: Mostrar desglose capital/interés en cada fila del historial**

Find:
```jsx
                {a.cuentas && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {a.cuentas.banco}{a.cuentas.producto !== a.cuentas.banco ? ` · ${a.cuentas.producto}` : ''}
                  </p>
                )}
              </div>
              <p style={{ fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                {Number(a.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {a.moneda}
              </p>
```

Replace with:
```jsx
                {a.cuentas && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {a.cuentas.banco}{a.cuentas.producto !== a.cuentas.banco ? ` · ${a.cuentas.producto}` : ''}
                  </p>
                )}
                {Number(a.interes || 0) > 0 && (
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    Capital: {(Number(a.monto) - Number(a.interes)).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                    {' · '}Interés: {Number(a.interes).toLocaleString('es-DO', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
              <p style={{ fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                {Number(a.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {a.moneda}
              </p>
```

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso — ya no debe haber ninguna referencia a `calcularInteresEstimado`. Run `grep -n "calcularInteresEstimado" src/pages/Deudas.jsx` and confirm it returns nothing.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Deudas.jsx
git commit -m "feat: interés real en el detalle de deuda y desglose en historial de abonos"
```

---

### Task 6: Formulario de abono con interés/capital

**Files:**
- Modify: `src/pages/Deudas.jsx`

- [ ] **Step 1: Agregar `interes` a `emptyAbono`**

Find:
```jsx
const emptyAbono = { monto: '', moneda: 'DOP', fecha: new Date().toISOString().split('T')[0], cuenta_origen_id: '', categoria_id: '' }
```

Replace with:
```jsx
const emptyAbono = { monto: '', interes: '', moneda: 'DOP', fecha: new Date().toISOString().split('T')[0], cuenta_origen_id: '', categoria_id: '' }
```

- [ ] **Step 2: Validar interés y calcular capital en `handleSubmitAbono`**

Find:
```jsx
  async function handleSubmitAbono(e) {
    e.preventDefault()
    if (!formAbono.categoria_id) {
      setAbonoError('Selecciona una categoría para el gasto.')
      return
    }
    setAbonoError(null)
    setSaving(true)
    const monto = parseFloat(formAbono.monto)
    const nuevoSaldo = (deudaParaAbonar.saldo_actual || 0) - monto
    const results = await Promise.all([
      supabase.from('abonos_deuda').insert({
        deuda_id: deudaParaAbonar.id,
        monto,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        cuenta_origen_id: formAbono.cuenta_origen_id || null,
        created_by: perfil?.id,
      }),
```

Replace with:
```jsx
  async function handleSubmitAbono(e) {
    e.preventDefault()
    if (!formAbono.categoria_id) {
      setAbonoError('Selecciona una categoría para el gasto.')
      return
    }
    const monto = parseFloat(formAbono.monto)
    const interes = formAbono.interes !== '' ? parseFloat(formAbono.interes) : 0
    const capital = monto - interes
    if (interes < 0 || capital < 0) {
      setAbonoError('El interés no puede ser mayor que el monto pagado.')
      return
    }
    setAbonoError(null)
    setSaving(true)
    const nuevoSaldo = (deudaParaAbonar.saldo_actual || 0) - capital
    const results = await Promise.all([
      supabase.from('abonos_deuda').insert({
        deuda_id: deudaParaAbonar.id,
        monto,
        interes,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        cuenta_origen_id: formAbono.cuenta_origen_id || null,
        created_by: perfil?.id,
      }),
```

(The rest of `handleSubmitAbono` — the `deudas` update, the `movimientos` insert with the full `monto`, the milestone-toast logic — is unchanged. The `movimientos` insert still uses `monto`, not `capital`, since the movimiento must reflect the full cash outflow, per the spec.)

- [ ] **Step 3: Campo "¿Cuánto de ese monto es interés?" en el formulario**

Find:
```jsx
            <div className="ds-field">
              <label htmlFor="abono-cuenta" className="ds-label">
                Cuenta de origen <span className="ds-label-hint">(opcional)</span>
              </label>
```

Replace with:
```jsx
            <div className="ds-field">
              <label htmlFor="abono-interes" className="ds-label">
                De ese monto, ¿cuánto es interés? <span className="ds-label-hint">(opcional)</span>
              </label>
              <input id="abono-interes" type="number" step="0.01" min="0"
                value={formAbono.interes}
                onChange={e => setA('interes', e.target.value)}
                placeholder="0.00" className="ds-input" />
              <p className="ds-field-hint">
                Déjalo vacío si este pago es 100% abono a capital. Si estás pagando tu cuota
                regular (capital + interés), indica aquí la parte de interés — el saldo de la
                deuda solo bajará por la diferencia (el capital).
                {formAbono.monto !== '' && formAbono.interes !== '' && (
                  <> Capital de este pago: <strong>
                    {(parseFloat(formAbono.monto || 0) - parseFloat(formAbono.interes || 0)).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {formAbono.moneda}
                  </strong>.</>
                )}
              </p>
            </div>

            <div className="ds-field">
              <label htmlFor="abono-cuenta" className="ds-label">
                Cuenta de origen <span className="ds-label-hint">(opcional)</span>
              </label>
```

- [ ] **Step 4: Verificar en el navegador**

Build-only if no live access (note explicitly). If live: registrar un abono con monto 1000 e interés 200 debe mostrar "Capital de este pago: 800.00 MONEDA" en vivo mientras se escribe, y al guardar el saldo de la deuda debe bajar solo 800. Registrar un abono con interés mayor al monto debe bloquear con "El interés no puede ser mayor que el monto pagado." Dejar el campo de interés vacío debe comportarse igual que antes (saldo baja el monto completo).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Deudas.jsx
git commit -m "feat: separar interés y capital en el formulario de abono"
```

---

### Task 7: Build final, PR y merge

**Files:** ninguno nuevo — solo verificación y flujo de git/GitHub.

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 2: Push de la rama**

```bash
git push -u origin <nombre-de-la-rama-usada-para-este-trabajo>
```

- [ ] **Step 3: Crear PR**

Usar la herramienta de GitHub (`create_pull_request`) contra `Yisbel-Finanzas/Control-finanzas-app`, `base: main`, título `feat: deudas tipo financiera cuota fija + interés/capital en abonos`, cuerpo describiendo el cambio (tercer tipo de deuda, columnas `cuota_fija`/`cuotas_totales`/`interes`, UI condicional en DeudaCard y el sheet de detalle, formulario de abono) y referenciando el spec en `docs/superpowers/specs/2026-10-03-deudas-cuota-fija-interes-design.md`.

- [ ] **Step 4: Verificar el check de build y mergear**

Usar `pull_request_read` (`get_check_runs`) hasta que el check `build` esté `completed`/`success`, luego `merge_pull_request` (`squash`) a `main`.
