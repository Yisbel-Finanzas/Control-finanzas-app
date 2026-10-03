# Límite de crédito en tarjetas + Transferencias entre cuentas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar límite de crédito a tarjetas de crédito (con barra de progreso y bloqueo de gastos que lo excedan) y transferencias entre cuentas propias (sin contar como ingreso/gasto) al módulo Cuentas.

**Architecture:** Dos migraciones SQL aditivas (`cuentas.limite_credito`, tabla `transferencias`). `Cuentas.jsx` calcula el balance de cada cuenta sumando movimientos y transferencias (nunca persistido), muestra una franja de balance total y botones de transferencia/historial, y `CuentaCard` muestra una barra de progreso cuando la cuenta es tarjeta de crédito con límite. `MovimientoForm.jsx` bloquea en el cliente un gasto que dejaría el disponible de una tarjeta en negativo.

**Tech Stack:** React 18, Supabase (Postgres + RLS + supabase-js). Sin framework de testing automatizado — verificación manual (build + navegador).

---

### Task 1: Migraciones SQL

**Files:**
- Create: `supabase/cuentas_limite_credito.sql`
- Create: `supabase/transferencias_entre_cuentas.sql`

- [ ] **Step 1: Escribir la migración de límite de crédito**

```sql
-- Límite de crédito de referencia, solo relevante para cuentas con producto = 'Tarjeta de
-- crédito'. El balance disponible ya se calcula en el cliente (saldo_inicial + ingresos -
-- gastos +/- transferencias); este campo solo sirve para mostrar "disponible de X límite" con
-- una barra de progreso, igual que el patrón ya usado en deudas (limite_o_monto_original).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.cuentas ADD COLUMN IF NOT EXISTS limite_credito NUMERIC CHECK (limite_credito > 0);
```

- [ ] **Step 2: Escribir la migración de transferencias**

```sql
-- Transferencias entre cuentas propias (ej. Popular -> BHD). No son ingreso ni gasto real —
-- no deben contar en Resumen/Presupuesto, solo mover el balance de una cuenta a otra. Por eso
-- viven en su propia tabla en vez de en movimientos (igual que abonos_deuda/abonos_meta).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

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

-- Igual que abonos_deuda/abonos_meta: cualquier autenticado puede registrar y ver transferencias.
CREATE POLICY "transferencias_all" ON public.transferencias
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 3: Aplicar ambas migraciones en Supabase**

Usar la herramienta MCP de Supabase (`apply_migration`, project_id `ivfxnpafglgixyaknmxy` — "DraYisbelP12's Finanzas"; confirmar con `list_projects` si hay dudas), una por el nombre `cuentas_limite_credito` y otra `transferencias_entre_cuentas`, con el SQL exacto de los Steps 1 y 2 respectivamente.

Verificar con `execute_sql`:
```sql
select column_name, data_type from information_schema.columns where table_name = 'cuentas' and column_name = 'limite_credito';
select table_name from information_schema.tables where table_name = 'transferencias';
select policyname from pg_policies where tablename = 'transferencias';
```
Esperado: una fila `limite_credito | numeric`, una fila `transferencias`, una fila `transferencias_all`.

- [ ] **Step 4: Commit**

```bash
git add supabase/cuentas_limite_credito.sql supabase/transferencias_entre_cuentas.sql
git commit -m "feat: agregar limite_credito a cuentas y tabla transferencias"
```

---

### Task 2: Cuentas.jsx — fetchCuentas con transferencias

**Files:**
- Modify: `src/pages/Cuentas.jsx`

- [ ] **Step 1: Agregar `limite_credito` a `emptyForm` y hacer `saldo_inicial` opcional**

Find:
```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP', saldo_inicial: '0' }
```

Replace with:
```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP', saldo_inicial: '', limite_credito: '' }
```

- [ ] **Step 2: Incluir `transferencias` en `fetchCuentas`**

Find:
```jsx
  async function fetchCuentas() {
    setLoading(true)
    const [{ data, error }, { data: movs, error: movsError }] = await Promise.all([
      supabase.from('cuentas').select('*').order('producto'),
      supabase.from('movimientos').select('cuenta_id, tipo, monto, moneda').is('deleted_at', null),
    ])
    if (error) console.error('Cuentas fetch error:', error)
    if (movsError) console.error('Movimientos fetch error:', movsError)

    const cuentasData = data || []
    const monedaPorCuenta = {}
    cuentasData.forEach(c => { monedaPorCuenta[c.id] = c.moneda })

    const neto = {}
    ;(movs || []).forEach(m => {
      if (!m.cuenta_id) return
      if (m.moneda !== monedaPorCuenta[m.cuenta_id]) return
      const delta = m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)
      neto[m.cuenta_id] = (neto[m.cuenta_id] || 0) + delta
    })

    setCuentas(cuentasData)
    setNetoPorCuenta(neto)
    setLoading(false)
  }
```

Replace with:
```jsx
  async function fetchCuentas() {
    setLoading(true)
    const [{ data, error }, { data: movs, error: movsError }, { data: transfs, error: transfsError }] = await Promise.all([
      supabase.from('cuentas').select('*').order('producto'),
      supabase.from('movimientos').select('cuenta_id, tipo, monto, moneda').is('deleted_at', null),
      supabase.from('transferencias').select('cuenta_origen_id, cuenta_destino_id, monto'),
    ])
    if (error) console.error('Cuentas fetch error:', error)
    if (movsError) console.error('Movimientos fetch error:', movsError)
    if (transfsError) console.error('Transferencias fetch error:', transfsError)

    const cuentasData = data || []
    const monedaPorCuenta = {}
    cuentasData.forEach(c => { monedaPorCuenta[c.id] = c.moneda })

    const neto = {}
    ;(movs || []).forEach(m => {
      if (!m.cuenta_id) return
      if (m.moneda !== monedaPorCuenta[m.cuenta_id]) return
      const delta = m.tipo === 'ingreso' ? Number(m.monto) : -Number(m.monto)
      neto[m.cuenta_id] = (neto[m.cuenta_id] || 0) + delta
    })
    ;(transfs || []).forEach(t => {
      neto[t.cuenta_origen_id] = (neto[t.cuenta_origen_id] || 0) - Number(t.monto)
      neto[t.cuenta_destino_id] = (neto[t.cuenta_destino_id] || 0) + Number(t.monto)
    })

    setCuentas(cuentasData)
    setNetoPorCuenta(neto)
    setLoading(false)
  }
```

Nota: se conserva el nombre de estado `netoPorCuenta` (no se renombra a `balances`) y el guard de moneda (`if (m.moneda !== monedaPorCuenta[m.cuenta_id]) return`) ya existente — es una mejora de seguridad de datos de este repo que no está en la referencia, y no cambia el comportamiento en el caso normal.

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso. (`transferencias` no tiene RLS SELECT restringida a `authenticated` por rol — cualquier usuario logueado puede leerla, igual que `movimientos`.)

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: incluir transferencias en el cálculo de balance de Cuentas.jsx"
```

---

### Task 3: Cuentas.jsx — formulario con límite de crédito

**Files:**
- Modify: `src/pages/Cuentas.jsx`

- [ ] **Step 1: Precargar `limite_credito` en `openEdit`**

Find:
```jsx
  function openEdit(c) { setEditItem(c); setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente', moneda: c.moneda || 'DOP', saldo_inicial: String(c.saldo_inicial ?? 0) }); setShowForm(true) }
```

Replace with:
```jsx
  function openEdit(c) { setEditItem(c); setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente', moneda: c.moneda || 'DOP', saldo_inicial: c.saldo_inicial != null ? String(c.saldo_inicial) : '', limite_credito: c.limite_credito != null ? String(c.limite_credito) : '' }); setShowForm(true) }
```

- [ ] **Step 2: Validar y enviar `limite_credito` en `handleSubmit`**

Find:
```jsx
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.banco.trim()) return
    setSaving(true)
    // Diagnóstico: verificar rol antes de insertar
    const { data: rolData } = await supabase.rpc('mi_rol')
    console.log('mi_rol() result:', rolData)
    const payload = { banco: form.banco.trim(), producto: form.producto, moneda: form.moneda, saldo_inicial: Number(form.saldo_inicial) || 0 }
    let error
    if (editItem) {
      ({ error } = await supabase.from('cuentas').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('cuentas').insert({ ...payload, activo: true }))
    }
    setSaving(false)
    if (error) { console.error('Cuentas insert error:', error); alert('Error al guardar: ' + (error.message || error.details || JSON.stringify(error))); return }
    closeForm()
    await fetchCuentas()
  }
```

Replace with:
```jsx
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.banco.trim()) return
    if (form.producto === 'Tarjeta de crédito' && form.limite_credito === '') {
      alert('Ingresa el límite de crédito de la tarjeta.')
      return
    }
    setSaving(true)
    const payload = {
      banco: form.banco.trim(),
      producto: form.producto,
      moneda: form.moneda,
      saldo_inicial: form.saldo_inicial !== '' ? parseFloat(form.saldo_inicial) : 0,
      limite_credito: form.producto === 'Tarjeta de crédito' && form.limite_credito !== '' ? parseFloat(form.limite_credito) : null,
    }
    let error
    if (editItem) {
      ({ error } = await supabase.from('cuentas').update(payload).eq('id', editItem.id))
    } else {
      ({ error } = await supabase.from('cuentas').insert({ ...payload, activo: true }))
    }
    setSaving(false)
    if (error) { console.error('Cuentas insert error:', error); alert('Error al guardar: ' + (error.message || error.details || JSON.stringify(error))); return }
    closeForm()
    await fetchCuentas()
  }
```

(Esto también elimina el `console.log` de diagnóstico de `mi_rol()` que quedó de una depuración anterior — ya no aporta nada y estamos reescribiendo toda la función.)

- [ ] **Step 3: Agregar el campo "Límite de crédito" y re-etiquetar "Saldo inicial" en el formulario**

Find:
```jsx
              <div className="ds-field">
                <label htmlFor="saldo_inicial" className="ds-label">Saldo inicial</label>
                <input
                  id="saldo_inicial"
                  type="number"
                  step="0.01"
                  value={form.saldo_inicial}
                  onChange={e => set('saldo_inicial', e.target.value)}
                  placeholder="0.00"
                  className="ds-input"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                />
                <p className="ds-field-hint">Balance de la cuenta al registrarla, o para corregirlo.</p>
              </div>
```

Replace with:
```jsx
              {form.producto === 'Tarjeta de crédito' && (
                <div className="ds-field">
                  <label htmlFor="limite-credito" className="ds-label">Límite de crédito</label>
                  <input
                    id="limite-credito"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={form.limite_credito}
                    onChange={e => set('limite_credito', e.target.value)}
                    placeholder="0.00"
                    required
                    className="ds-input"
                  />
                  <p className="ds-field-hint">
                    El tope máximo de la tarjeta — no cambia con el uso. Se usa para la barra de disponible/usado y para que un gasto no pueda registrarse por encima de lo disponible.
                  </p>
                </div>
              )}

              <div className="ds-field">
                <label htmlFor="saldo_inicial" className="ds-label">
                  {form.producto === 'Tarjeta de crédito' ? 'Disponible actual' : 'Saldo inicial'} <span className="ds-label-hint">(opcional)</span>
                </label>
                <input
                  id="saldo_inicial"
                  type="number"
                  step="0.01"
                  value={form.saldo_inicial}
                  onChange={e => set('saldo_inicial', e.target.value)}
                  placeholder="0.00"
                  className="ds-input"
                />
                <p className="ds-field-hint">
                  {form.producto === 'Tarjeta de crédito'
                    ? 'Cuánto te queda disponible en la tarjeta ahora mismo (límite menos lo que ya tengas consumido). Cada gasto que registres contra esta tarjeta lo irá reduciendo.'
                    : 'El saldo con el que arrancas a usar la app. El balance disponible se calcula sumándole los ingresos y restándole los gastos registrados en esta cuenta.'}
                </p>
              </div>
```

- [ ] **Step 4: Verificar en el navegador**

Run: `npm run dev`

Abrir `/cuentas` como admin, tocar `+`, cambiar "Producto" a "Tarjeta de crédito".

Expected: aparece el campo "Límite de crédito" (requerido) arriba del campo que ahora dice "Disponible actual (opcional)". Cambiar "Producto" a cualquier otro valor: el campo "Límite de crédito" desaparece y el otro campo vuelve a decir "Saldo inicial (opcional)".

Intentar guardar una tarjeta de crédito sin límite: debe bloquear con el alert "Ingresa el límite de crédito de la tarjeta."

- [ ] **Step 5: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: agregar límite de crédito al formulario de Cuentas"
```

---

### Task 4: Cuentas.jsx — balance total, transferencias e historial

**Files:**
- Modify: `src/pages/Cuentas.jsx`

- [ ] **Step 1: Importar `IconRepeat` y agregar estado de transferencias**

Find:
```jsx
import { IconBank, IconCash, IconCreditCard, IconX, IconPlus } from '../components/icons/NavIcons'
```

Replace with:
```jsx
import { IconBank, IconCash, IconCreditCard, IconX, IconPlus, IconRepeat } from '../components/icons/NavIcons'
```

(`IconRepeat` ya existe en `src/components/icons/NavIcons.jsx` — no requiere cambios ahí.)

Find:
```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP', saldo_inicial: '', limite_credito: '' }
```

Replace with:
```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP', saldo_inicial: '', limite_credito: '' }
const emptyTransferencia = { cuenta_origen_id: '', cuenta_destino_id: '', monto: '', fecha: new Date().toISOString().split('T')[0], concepto: '' }
```

Find:
```jsx
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
```

Replace with:
```jsx
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [formTransferencia, setFormTransferencia] = useState(emptyTransferencia)
  const [transferError, setTransferError] = useState(null)
  const [savingTransfer, setSavingTransfer] = useState(false)
  const [showHistorial, setShowHistorial] = useState(false)
  const [transferencias, setTransferencias] = useState([])
  const [loadingHistorial, setLoadingHistorial] = useState(false)
```

- [ ] **Step 2: Agregar las funciones de transferencia después de `useEffect(() => { fetchCuentas() }, [])`**

Find:
```jsx
  useEffect(() => { fetchCuentas() }, [])

  function openNew()  { setEditItem(null); setForm(emptyForm); setShowForm(true) }
```

Replace with:
```jsx
  useEffect(() => { fetchCuentas() }, [])

  function openTransferir() {
    setFormTransferencia(emptyTransferencia)
    setTransferError(null)
    setShowTransferForm(true)
  }
  const setT = (k, v) => setFormTransferencia(f => ({ ...f, [k]: v }))

  async function handleSubmitTransferencia(e) {
    e.preventDefault()
    const { cuenta_origen_id, cuenta_destino_id, monto, fecha, concepto } = formTransferencia
    if (!cuenta_origen_id || !cuenta_destino_id) {
      setTransferError('Selecciona cuenta de origen y destino.')
      return
    }
    if (cuenta_origen_id === cuenta_destino_id) {
      setTransferError('La cuenta de origen y destino no pueden ser la misma.')
      return
    }
    const origen = cuentas.find(c => c.id === cuenta_origen_id)
    const destino = cuentas.find(c => c.id === cuenta_destino_id)
    if (origen?.moneda !== destino?.moneda) {
      setTransferError('Ambas cuentas deben tener la misma moneda.')
      return
    }
    setTransferError(null)
    setSavingTransfer(true)
    const { error } = await supabase.from('transferencias').insert({
      cuenta_origen_id,
      cuenta_destino_id,
      monto: parseFloat(monto),
      moneda: origen.moneda,
      fecha,
      concepto: concepto.trim() || null,
      created_by: perfil?.id,
    })
    setSavingTransfer(false)
    if (error) { alert('Error al registrar transferencia: ' + error.message); return }
    setShowTransferForm(false)
    await fetchCuentas()
  }

  async function openHistorial() {
    setShowHistorial(true)
    setLoadingHistorial(true)
    const { data } = await supabase
      .from('transferencias')
      .select('id, monto, moneda, fecha, concepto, origen:cuenta_origen_id(banco, producto), destino:cuenta_destino_id(banco, producto)')
      .order('fecha', { ascending: false })
      .limit(50)
    setTransferencias(data || [])
    setLoadingHistorial(false)
  }

  function openNew()  { setEditItem(null); setForm(emptyForm); setShowForm(true) }
```

- [ ] **Step 3: Calcular `totalPorMoneda` antes del `return`**

Find:
```jsx
  const activas   = cuentas.filter(c => c.activo)
  const inactivas = cuentas.filter(c => !c.activo)

  return (
```

Replace with:
```jsx
  const activas   = cuentas.filter(c => c.activo)
  const inactivas = cuentas.filter(c => !c.activo)

  const totalPorMoneda = activas.reduce((acc, c) => {
    const balance = Number(c.saldo_inicial || 0) + (netoPorCuenta[c.id] || 0)
    acc[c.moneda] = (acc[c.moneda] || 0) + balance
    return acc
  }, {})

  return (
```

- [ ] **Step 4: Agregar la franja de balance y los botones de transferir/historial**

Find:
```jsx
      <div style={{ padding: 'var(--space-4)' }}>
        {loading && (
```

Replace with:
```jsx
      <div style={{ padding: 'var(--space-4)' }}>
        {!loading && Object.keys(totalPorMoneda).length > 0 && (
          <div style={{
            background: 'var(--color-success-light)',
            border: '1px solid #bbf0d0',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="ds-section-label" style={{ color: 'var(--color-success)', margin: 0 }}>Balance disponible</span>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {Object.entries(totalPorMoneda).map(([moneda, total]) => (
                <span key={moneda} style={{
                  fontWeight: 700, fontSize: 'var(--text-base)', fontVariantNumeric: 'tabular-nums',
                  color: total < 0 ? 'var(--color-danger)' : 'var(--color-success)',
                }}>
                  {fmt(total, moneda)}
                </span>
              ))}
            </div>
          </div>
        )}

        {!loading && activas.length >= 2 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
            <button onClick={openTransferir} className="ds-btn ds-btn-sm" style={{
              flex: 2, background: 'var(--color-primary-light)',
              border: '1px solid var(--color-primary-muted)',
              color: 'var(--color-primary)', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
            }}>
              <IconRepeat size={16} /> Transferir entre cuentas
            </button>
            <button onClick={openHistorial} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ flex: 1 }}>
              Historial
            </button>
          </div>
        )}

        {loading && (
```

(`fmt` ya existe al final del archivo — se usa aquí sin cambios; el siguiente task no la toca.)

- [ ] **Step 5: Agregar los sheets de transferencia e historial antes del cierre del componente**

Find:
```jsx
      )}
    </div>
  )
}

function fmt(monto, moneda) {
```

Replace with:
```jsx
      )}

      {showTransferForm && (
        <div className="ds-sheet-overlay" onClick={() => setShowTransferForm(false)}>
          <div
            className="ds-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Transferir entre cuentas"
            aria-modal="true"
          >
            <div className="ds-sheet-handle" />
            <h2>Transferir entre cuentas</h2>

            <form onSubmit={handleSubmitTransferencia}>
              {transferError && (
                <div role="alert" style={{
                  background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                  borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
                  fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5,
                }}>
                  {transferError}
                </div>
              )}

              <div className="ds-field">
                <label htmlFor="transf-origen" className="ds-label">Desde</label>
                <select id="transf-origen" value={formTransferencia.cuenta_origen_id}
                  onChange={e => setT('cuenta_origen_id', e.target.value)} className="ds-input" required>
                  <option value="">Seleccionar cuenta de origen…</option>
                  {activas.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''} ({c.moneda})
                    </option>
                  ))}
                </select>
              </div>

              <div className="ds-field">
                <label htmlFor="transf-destino" className="ds-label">Hacia</label>
                <select id="transf-destino" value={formTransferencia.cuenta_destino_id}
                  onChange={e => setT('cuenta_destino_id', e.target.value)} className="ds-input" required>
                  <option value="">Seleccionar cuenta de destino…</option>
                  {activas.filter(c => c.id !== formTransferencia.cuenta_origen_id).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''} ({c.moneda})
                    </option>
                  ))}
                </select>
              </div>

              <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 2 }}>
                  <label htmlFor="transf-monto" className="ds-label">Monto</label>
                  <input id="transf-monto" type="number" step="0.01" min="0.01"
                    value={formTransferencia.monto}
                    onChange={e => setT('monto', e.target.value)}
                    required placeholder="0.00" className="ds-input" />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="transf-fecha" className="ds-label">Fecha</label>
                  <input id="transf-fecha" type="date" value={formTransferencia.fecha}
                    onChange={e => setT('fecha', e.target.value)} required className="ds-input" />
                </div>
              </div>

              <div className="ds-field">
                <label htmlFor="transf-concepto" className="ds-label">
                  Nota <span className="ds-label-hint">(opcional)</span>
                </label>
                <input id="transf-concepto" type="text" value={formTransferencia.concepto}
                  onChange={e => setT('concepto', e.target.value)}
                  placeholder="Ej: Ahorro del mes" className="ds-input" />
              </div>

              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                No se registra como ingreso ni gasto — solo mueve el balance de una cuenta a otra.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button type="button" onClick={() => setShowTransferForm(false)} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingTransfer} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
                  {savingTransfer ? 'Guardando...' : 'Transferir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showHistorial && (
        <div className="ds-sheet-overlay" onClick={() => setShowHistorial(false)}>
          <div
            className="ds-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Historial de transferencias"
            aria-modal="true"
          >
            <div className="ds-sheet-handle" />
            <h2 style={{ marginBottom: 'var(--space-5)' }}>Historial de transferencias</h2>

            {loadingHistorial && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                Cargando...
              </p>
            )}

            {!loadingHistorial && transferencias.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
                Todavía no se han registrado transferencias.
              </p>
            )}

            {!loadingHistorial && transferencias.map(t => (
              <div key={t.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)',
              }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {t.origen?.banco} → {t.destino?.banco}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                    {new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {t.concepto ? ` · ${t.concepto}` : ''}
                  </p>
                </div>
                <p style={{ fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(t.monto, t.moneda)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(monto, moneda) {
```

- [ ] **Step 6: Verificar en el navegador**

Run: `npm run dev` (si no sigue corriendo)

Con al menos 2 cuentas activas de la misma moneda: la franja "Balance disponible" debe aparecer con el total correcto, y los botones "Transferir entre cuentas"/"Historial" deben mostrarse. Abrir el formulario de transferencia, seleccionar origen/destino distintos de la misma moneda, y un monto — al guardar, el sheet debe cerrarse y los balances de ambas cuentas deben actualizarse (origen baja, destino sube). Abrir "Historial" y confirmar que la transferencia aparece con los nombres de banco correctos.

Con cuentas de distinta moneda: intentar transferir entre ellas debe mostrar "Ambas cuentas deben tener la misma moneda."

- [ ] **Step 7: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: transferencias entre cuentas (UI, formulario, historial)"
```

---

### Task 5: Cuentas.jsx — barra de progreso en CuentaCard

**Files:**
- Modify: `src/pages/Cuentas.jsx`

- [ ] **Step 1: Pasar `balance` (ya calculado) en vez de `neto` a `CuentaCard`**

Find:
```jsx
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} neto={netoPorCuenta[c.id] || 0} />
            ))}
```

Replace with:
```jsx
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} balance={Number(c.saldo_inicial || 0) + (netoPorCuenta[c.id] || 0)} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
```

Find:
```jsx
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} neto={netoPorCuenta[c.id] || 0} />
            ))}
```

Replace with:
```jsx
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} balance={Number(c.saldo_inicial || 0) + (netoPorCuenta[c.id] || 0)} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
```

- [ ] **Step 2: Reescribir `CuentaCard` para recibir `balance` y mostrar la barra de progreso**

Find:
```jsx
function CuentaCard({ c, isAdmin, onEdit, onToggle, onDelete, neto }) {
  const balance = Number(c.saldo_inicial || 0) + neto
  return (
    <div
      className="ds-card"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--space-4)', marginBottom: 'var(--space-2)',
        opacity: c.activo ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: 'var(--color-primary-light)',
          color: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <ProductoIcon producto={c.producto} size={20} />
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{c.banco}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.producto} · {c.moneda}</p>
          <p style={{
            fontSize: 'var(--text-sm)', fontWeight: 700, marginTop: 'var(--space-1)',
            fontVariantNumeric: 'tabular-nums',
            color: balance < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
          }}>
            {fmt(balance, c.moneda)}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={() => onEdit(c)} className="ds-btn ds-btn-ghost ds-btn-sm">Editar</button>
          <button onClick={() => onToggle(c)} className="ds-btn ds-btn-ghost ds-btn-sm">
            {c.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => onDelete(c)} className="ds-btn ds-btn-danger ds-btn-sm" aria-label={`Eliminar ${c.banco}`}>
            <IconX size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
```

Replace with:
```jsx
function CuentaCard({ c, balance, isAdmin, onEdit, onToggle, onDelete }) {
  const esTarjetaCredito = c.producto === 'Tarjeta de crédito'
  const limite = Number(c.limite_credito || 0)
  const disponible = Math.max(0, balance)
  const pctUsado = esTarjetaCredito && limite > 0 ? Math.min(100, Math.max(0, (1 - disponible / limite) * 100)) : null
  const barColor = pctUsado > 85 ? 'var(--color-danger)' : pctUsado > 60 ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div
      className="ds-card"
      style={{
        padding: 'var(--space-4)', marginBottom: 'var(--space-2)',
        opacity: c.activo ? 1 : 0.5,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ProductoIcon producto={c.producto} size={20} />
          </div>
          <div>
            <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{c.banco}</p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.producto} · {c.moneda}</p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p style={{
            fontWeight: 700, fontSize: 'var(--text-base)', fontVariantNumeric: 'tabular-nums',
            color: balance < 0 ? 'var(--color-danger)' : 'var(--color-text-primary)',
          }}>
            {fmt(balance, c.moneda)}
          </p>
          {pctUsado !== null && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              de {fmt(limite, c.moneda)}
            </p>
          )}
        </div>

        {isAdmin && (
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button onClick={() => onEdit(c)} className="ds-btn ds-btn-ghost ds-btn-sm">Editar</button>
            <button onClick={() => onToggle(c)} className="ds-btn ds-btn-ghost ds-btn-sm">
              {c.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button onClick={() => onDelete(c)} className="ds-btn ds-btn-danger ds-btn-sm" aria-label={`Eliminar ${c.banco}`}>
              <IconX size={14} />
            </button>
          </div>
        )}
      </div>

      {pctUsado !== null && (
        <div
          className="ds-progress-track"
          style={{ marginTop: 'var(--space-3)' }}
          role="progressbar"
          aria-valuenow={Math.round(pctUsado)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(pctUsado)}% del límite de crédito usado`}
        >
          <div className="ds-progress-fill" style={{ width: `${pctUsado}%`, background: barColor }} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verificar en el navegador**

Crear o editar una cuenta "Tarjeta de crédito" con límite de crédito y un "Disponible actual" menor al límite. Volver a Cuentas.

Expected: la tarjeta muestra el disponible, debajo "de {límite} {moneda}", y una barra de progreso coloreada según qué tan cerca está del límite (verde <60% usado, amarillo 60-85%, rojo >85%). Una cuenta que no es tarjeta de crédito (o que es tarjeta pero sin límite configurado) no debe mostrar la barra.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: barra de progreso de límite de crédito en CuentaCard"
```

---

### Task 6: MovimientoForm.jsx — bloquear gastos que excedan el límite

**Files:**
- Modify: `src/components/MovimientoForm.jsx`

- [ ] **Step 1: Traer `saldo_inicial` y `limite_credito` junto con las cuentas**

Find:
```jsx
    supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
      .then(({ data }) => setCuentas(data || []))
```

Replace with:
```jsx
    supabase.from('cuentas').select('id,banco,producto,saldo_inicial,limite_credito').eq('activo', true)
      .then(({ data }) => setCuentas(data || []))
```

- [ ] **Step 2: Agregar `excedeLimiteTarjeta` antes de `handleSubmit`**

Find:
```jsx
  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!form.cuenta_id) { setFormError('Selecciona una cuenta antes de continuar.'); return }
    const monto = parseFloat(form.monto)

    if (!item) {
```

Replace with:
```jsx
  // Para tarjetas de crédito con límite configurado, un gasto no puede dejar el disponible
  // en negativo: ese "gasto" no sería real, la tarjeta simplemente lo rechazaría.
  async function excedeLimiteTarjeta(cuentaId, monto) {
    const cuenta = cuentas.find(c => c.id === cuentaId)
    if (!cuenta || cuenta.producto !== 'Tarjeta de crédito' || !cuenta.limite_credito) return null

    let movsQuery = supabase.from('movimientos').select('tipo, monto')
      .eq('cuenta_id', cuentaId).is('deleted_at', null)
    if (item) movsQuery = movsQuery.neq('id', item.id)

    const [{ data: movs }, { data: transfs }] = await Promise.all([
      movsQuery,
      supabase.from('transferencias').select('monto, cuenta_origen_id, cuenta_destino_id')
        .or(`cuenta_origen_id.eq.${cuentaId},cuenta_destino_id.eq.${cuentaId}`),
    ])

    let neto = 0
    for (const m of movs || []) neto += (m.tipo === 'ingreso' ? 1 : -1) * Number(m.monto)
    for (const t of transfs || []) {
      if (t.cuenta_origen_id === cuentaId) neto -= Number(t.monto)
      if (t.cuenta_destino_id === cuentaId) neto += Number(t.monto)
    }

    const disponible = Number(cuenta.saldo_inicial || 0) + neto
    return monto > disponible ? disponible : null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!form.cuenta_id) { setFormError('Selecciona una cuenta antes de continuar.'); return }
    const monto = parseFloat(form.monto)

    if (form.tipo === 'gasto') {
      const disponible = await excedeLimiteTarjeta(form.cuenta_id, monto)
      if (disponible !== null) {
        setFormError(`Este gasto excede el disponible de la tarjeta (${disponible.toFixed(2)} ${form.moneda}).`)
        return
      }
    }

    if (!item) {
```

- [ ] **Step 3: Verificar en el navegador**

Registrar un gasto contra una tarjeta de crédito con límite configurado, por un monto mayor al disponible actual.

Expected: el submit se bloquea y aparece el error "Este gasto excede el disponible de la tarjeta (X.XX MONEDA)." con el disponible real. Un gasto por un monto menor o igual al disponible debe guardarse normalmente. Un gasto contra una cuenta que no es tarjeta de crédito (o que lo es pero sin límite) nunca debe bloquearse por este motivo.

- [ ] **Step 4: Commit**

```bash
git add src/components/MovimientoForm.jsx
git commit -m "feat: bloquear gastos que excedan el límite de crédito de una tarjeta"
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

Usar la herramienta de GitHub (`create_pull_request`) contra `Yisbel-Finanzas/Control-finanzas-app`, `base: main`, título `feat: límite de crédito en tarjetas + transferencias entre cuentas`, cuerpo describiendo el cambio (columna `limite_credito`, tabla `transferencias`, UI en Cuentas, bloqueo de gastos en MovimientoForm) y referenciando el spec en `docs/superpowers/specs/2026-10-03-limite-credito-transferencias-design.md`.

- [ ] **Step 4: Verificar el check de build y mergear**

Usar `pull_request_read` (`get_check_runs`) hasta que el check `build` esté `completed`/`success`, luego `merge_pull_request` (`squash`) a `main`.
