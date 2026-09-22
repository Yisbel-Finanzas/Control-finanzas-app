# Balance real por cuenta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en cada tarjeta del módulo Cuentas el balance real de la cuenta, calculado como `saldo_inicial + ingresos − gastos` de sus movimientos.

**Architecture:** Se agrega una columna `saldo_inicial` a `cuentas` (editable desde el formulario). El balance nunca se persiste: `Cuentas.jsx` calcula, al cargar, un mapa `cuenta_id → neto` a partir de un fetch a `movimientos` (filtrado por `deleted_at is null` y moneda de la cuenta), y lo suma al `saldo_inicial` de cada cuenta antes de renderizar su tarjeta.

**Tech Stack:** React 18, Supabase (Postgres + supabase-js), sin framework de testing automatizado en el proyecto — la verificación es manual (build + navegador), siguiendo la convención existente del repo.

---

### Task 1: Migración SQL — columna `saldo_inicial`

**Files:**
- Create: `supabase/cuentas_saldo_inicial.sql`

- [ ] **Step 1: Escribir el archivo de migración**

```sql
-- Balance real por cuenta: saldo_inicial es el punto de partida sobre el cual se suma
-- el neto de los movimientos vinculados a la cuenta para calcular su balance actual.
-- El balance en sí NUNCA se persiste — se calcula en el cliente (ver Cuentas.jsx).
-- NOTA: esta migración ya fue aplicada directamente en el proyecto de Supabase.
-- Este archivo queda como registro histórico del cambio.

ALTER TABLE public.cuentas ADD COLUMN saldo_inicial numeric NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Aplicar la migración en el proyecto de Supabase**

Usar la herramienta MCP de Supabase (`apply_migration`) con el `project_id` del proyecto `DraYisbelP12's Finanzas` (`ivfxnpafglgixyaknmxy`), nombre `cuentas_saldo_inicial`, y el mismo SQL del Step 1.

Verificar aplicando `list_tables` (o `execute_sql` con `select column_name, data_type, column_default from information_schema.columns where table_name = 'cuentas'`) y confirmando que aparece `saldo_inicial | numeric | 0`.

- [ ] **Step 3: Commit**

```bash
git add supabase/cuentas_saldo_inicial.sql
git commit -m "feat: agregar saldo_inicial a cuentas (balance real)"
```

---

### Task 2: Estado del formulario — `saldo_inicial`

**Files:**
- Modify: `src/pages/Cuentas.jsx:20` (`emptyForm`)
- Modify: `src/pages/Cuentas.jsx:44` (`openEdit`)
- Modify: `src/pages/Cuentas.jsx:55` (`handleSubmit` payload)

- [ ] **Step 1: Agregar `saldo_inicial` a `emptyForm`**

En `src/pages/Cuentas.jsx:20`, reemplazar:

```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP' }
```

por:

```jsx
const emptyForm = { banco: '', producto: 'Cuenta corriente', moneda: 'DOP', saldo_inicial: '0' }
```

- [ ] **Step 2: Precargar `saldo_inicial` al editar**

En `src/pages/Cuentas.jsx:44`, reemplazar:

```jsx
function openEdit(c) { setEditItem(c); setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente', moneda: c.moneda || 'DOP' }); setShowForm(true) }
```

por:

```jsx
function openEdit(c) { setEditItem(c); setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente', moneda: c.moneda || 'DOP', saldo_inicial: String(c.saldo_inicial ?? 0) }); setShowForm(true) }
```

- [ ] **Step 3: Incluir `saldo_inicial` en el payload de guardado**

En `src/pages/Cuentas.jsx:55`, reemplazar:

```jsx
    const payload = { banco: form.banco.trim(), producto: form.producto, moneda: form.moneda }
```

por:

```jsx
    const payload = { banco: form.banco.trim(), producto: form.producto, moneda: form.moneda, saldo_inicial: Number(form.saldo_inicial) || 0 }
```

- [ ] **Step 4: Verificar que no hay errores de sintaxis**

Run: `npm run build`
Expected: build exitoso (mismo resultado que antes de este cambio — este task no modifica el JSX del formulario todavía, solo el estado).

- [ ] **Step 5: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: incluir saldo_inicial en el estado y guardado del formulario de Cuentas"
```

---

### Task 3: Campo "Saldo inicial" en el formulario

**Files:**
- Modify: `src/pages/Cuentas.jsx:162-168` (bloque del campo "Moneda", se agrega el nuevo campo justo después)

- [ ] **Step 1: Agregar el campo al JSX**

En `src/pages/Cuentas.jsx`, localizar el bloque del campo "Moneda" (líneas 162-168):

```jsx
              <div className="ds-field">
                <label htmlFor="moneda" className="ds-label">Moneda</label>
                <select id="moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)} className="ds-input">
                  <option value="DOP">DOP – Peso dominicano</option>
                  <option value="USD">USD – Dólar estadounidense</option>
                </select>
              </div>
```

Justo después de ese `</div>` de cierre, y antes del `<div style={{ display: 'flex', gap: 'var(--space-3)' }}>` de los botones, agregar:

```jsx
              <div className="ds-field">
                <label htmlFor="saldo_inicial" className="ds-label">
                  Saldo inicial
                  <span className="ds-label-hint"> (balance de la cuenta al registrarla, o para corregirlo)</span>
                </label>
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
              </div>
```

- [ ] **Step 2: Verificar visualmente en el navegador**

Run: `npm run dev`

Abrir `http://localhost:5173/Control-finanzas-app/cuentas`, iniciar sesión como administradora, tocar el botón `+` para abrir "Nueva cuenta".

Expected: el formulario muestra el nuevo campo "Saldo inicial" con hint "(balance de la cuenta al registrarla, o para corregirlo)", entre "Moneda" y los botones Cancelar/Agregar.

Repetir tocando "Editar" en una cuenta existente — el campo debe precargar `0.00` (o el valor guardado si ya se aplicó Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: agregar campo saldo inicial al formulario de Cuentas"
```

---

### Task 4: Calcular el neto de movimientos por cuenta

**Files:**
- Modify: `src/pages/Cuentas.jsx:22-39` (estado del componente y `fetchCuentas`)

- [ ] **Step 1: Agregar estado para el neto por cuenta**

En `src/pages/Cuentas.jsx:24-25`, reemplazar:

```jsx
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
```

por:

```jsx
  const [cuentas, setCuentas] = useState([])
  const [netoPorCuenta, setNetoPorCuenta] = useState({})
  const [loading, setLoading] = useState(true)
```

- [ ] **Step 2: Calcular el neto en `fetchCuentas`**

En `src/pages/Cuentas.jsx:33-39`, reemplazar:

```jsx
  async function fetchCuentas() {
    setLoading(true)
    const { data, error } = await supabase.from('cuentas').select('*').order('producto')
    if (error) console.error('Cuentas fetch error:', error)
    setCuentas(data || [])
    setLoading(false)
  }
```

por:

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

- [ ] **Step 3: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin warnings nuevos.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: calcular neto de movimientos por cuenta en Cuentas.jsx"
```

---

### Task 5: Mostrar el balance en cada tarjeta de cuenta

**Files:**
- Modify: `src/pages/Cuentas.jsx:101-102` y `110-111` (pasar `netoPorCuenta` a `CuentaCard`)
- Modify: `src/pages/Cuentas.jsx:186-225` (componente `CuentaCard`)

- [ ] **Step 1: Pasar `netoPorCuenta` como prop**

En `src/pages/Cuentas.jsx:101-102`, reemplazar:

```jsx
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
```

por:

```jsx
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} neto={netoPorCuenta[c.id] || 0} />
            ))}
```

Y en `src/pages/Cuentas.jsx:110-111`, reemplazar:

```jsx
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
```

por:

```jsx
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} neto={netoPorCuenta[c.id] || 0} />
            ))}
```

- [ ] **Step 2: Importar el formateador de moneda**

Este proyecto usa un formateador de montos en otros módulos (por ejemplo `Dashboard.jsx` tiene una función `fmt(monto, moneda)`). Verificar si `Cuentas.jsx` ya tiene acceso a un formateador compartido:

Run: `grep -rn "function fmt" src/`

Si no existe un formateador compartido (esperado — cada página define el suyo o usa `toLocaleString` inline), agregar una función local `fmt` al final de `src/pages/Cuentas.jsx`, antes de `CuentaCard`:

```jsx
function fmt(monto, moneda) {
  return new Intl.NumberFormat('es-DO', { style: 'currency', currency: moneda }).format(monto)
}
```

- [ ] **Step 3: Actualizar `CuentaCard` para recibir y mostrar el balance**

En `src/pages/Cuentas.jsx:186`, reemplazar la firma:

```jsx
function CuentaCard({ c, isAdmin, onEdit, onToggle, onDelete }) {
```

por:

```jsx
function CuentaCard({ c, isAdmin, onEdit, onToggle, onDelete, neto }) {
  const balance = Number(c.saldo_inicial || 0) + neto
```

En `src/pages/Cuentas.jsx:206-209`, reemplazar:

```jsx
        <div>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{c.banco}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.producto} · {c.moneda}</p>
        </div>
```

por:

```jsx
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
```

- [ ] **Step 4: Verificar visualmente en el navegador**

Run: `npm run dev` (si no sigue corriendo del Task 3)

Abrir `http://localhost:5173/Control-finanzas-app/cuentas`.

Expected: cada tarjeta de cuenta muestra, debajo de "Producto · Moneda", el balance formateado como moneda (ej. "RD$1,500.00"), en rojo si es negativo.

Flujo de verificación completo:
1. Editar una cuenta y ponerle "Saldo inicial" = `1000`. Guardar. Confirmar que la tarjeta muestra `RD$1,000.00` (o la moneda correspondiente).
2. Ir a Movimientos, registrar un ingreso de `500` vinculado a esa misma cuenta. Volver a Cuentas → la tarjeta debe mostrar `RD$1,500.00`.
3. Registrar un gasto de `200` vinculado a la misma cuenta. Volver a Cuentas → debe mostrar `RD$1,300.00`.
4. Borrar (soft-delete) ese gasto desde Movimientos. Volver a Cuentas → debe volver a `RD$1,500.00`.
5. Editar el saldo inicial de la cuenta a `0`. Volver a Cuentas → debe mostrar `RD$500.00`.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Cuentas.jsx
git commit -m "feat: mostrar balance real en la tarjeta de cada cuenta"
```

---

### Task 6: Build final, PR y merge

**Files:** ninguno nuevo — solo verificación y flujo de git/GitHub.

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 2: Push de la rama**

```bash
git push -u origin <nombre-de-la-rama-usada-para-este-trabajo>
```

- [ ] **Step 3: Crear PR**

Usar la herramienta de GitHub (`create_pull_request`) contra `Yisbel-Finanzas/Control-finanzas-app`, `base: main`, título `feat: balance real por cuenta en módulo Cuentas`, cuerpo describiendo el cambio (columna `saldo_inicial`, cálculo del balance vía movimientos, campo nuevo en el formulario) y referenciando el spec en `docs/superpowers/specs/2026-09-22-balance-real-cuentas-design.md`.

- [ ] **Step 4: Verificar el check de build y mergear**

Usar `pull_request_read` (`get_check_runs`) hasta que el check `build` esté `completed`/`success`, luego `merge_pull_request` (`squash`) a `main`.
