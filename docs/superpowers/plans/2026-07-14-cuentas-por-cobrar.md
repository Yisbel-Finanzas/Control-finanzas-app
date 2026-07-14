# Cuentas por Cobrar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Cuentas por cobrar" module so the user can track money that other people owe them, mirroring the existing "Deudas" module but inverted (receivable instead of payable, ingreso instead of gasto).

**Architecture:** Two new Supabase tables (`cuentas_por_cobrar`, `abonos_cxc`) with RLS following the project's direct-subquery convention, a new page `src/pages/CuentasPorCobrar.jsx` built as a single self-contained file (state + list + two bottom-sheet forms), wired into `App.jsx` routing and `SideMenu.jsx` navigation. No shared sheet component exists in this codebase — the sheet/button sub-components are copied into the new file, same as `Deudas.jsx` and `Metas.jsx` do.

**Tech Stack:** React 18, Vite 5, react-router-dom v6, Supabase JS client, existing design-system CSS classes (`ds-*`) and tokens.

**Note on testing:** This project has no test runner configured (`package.json` has only `dev`/`build`/`preview` scripts, no Jest/Vitest). Verification in this plan uses `npm run build` (Vite's production build fails loudly on JSX/import/syntax errors) plus manual browser QA via `npm run dev`, consistent with how `CLAUDE.md` describes verifying UI changes in this repo.

---

## File Structure

- **Create:** `supabase/cuentas_por_cobrar.sql` — migration defining `cuentas_por_cobrar` + `abonos_cxc` tables and RLS policies.
- **Create:** `src/pages/CuentasPorCobrar.jsx` — the module page (list, summary, create/edit form, abono form). Follows the exact structure of `src/pages/Deudas.jsx`.
- **Modify:** `src/App.jsx` — import the new page, add route `/cuentas-por-cobrar`.
- **Modify:** `src/components/SideMenu.jsx` — add a "Cobros" section with a link to the new page.

No changes to `NavIcons.jsx` — `IconWallet` already exists (`src/components/icons/NavIcons.jsx:15`) and is unused elsewhere, so it's free to represent this module.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/cuentas_por_cobrar.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Tabla principal de cuentas por cobrar (dinero que otras personas deben al usuario)
CREATE TABLE IF NOT EXISTS cuentas_por_cobrar (
  id                          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_persona              TEXT NOT NULL,
  nota                        TEXT,
  moneda                      TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  monto_original              NUMERIC NOT NULL CHECK (monto_original > 0),
  saldo_pendiente             NUMERIC NOT NULL CHECK (saldo_pendiente >= 0),
  activo                      BOOLEAN DEFAULT TRUE NOT NULL,
  fecha_ultima_actualizacion  DATE,
  created_by                  UUID REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cuentas_por_cobrar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden ver cuentas por cobrar"
  ON cuentas_por_cobrar FOR SELECT TO authenticated USING (true);

CREATE POLICY "administradora puede insertar cuentas por cobrar"
  ON cuentas_por_cobrar FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

CREATE POLICY "administradora puede actualizar cuentas por cobrar"
  ON cuentas_por_cobrar FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

CREATE POLICY "administradora puede eliminar cuentas por cobrar"
  ON cuentas_por_cobrar FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.perfiles WHERE id = auth.uid() AND rol = 'administradora')
  );

-- Tabla de abonos (cobros recibidos) a cuentas por cobrar
CREATE TABLE IF NOT EXISTS abonos_cxc (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuenta_cobrar_id    UUID REFERENCES cuentas_por_cobrar(id) NOT NULL,
  monto               NUMERIC NOT NULL CHECK (monto > 0),
  moneda              TEXT NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  fecha               DATE DEFAULT CURRENT_DATE NOT NULL,
  cuenta_destino_id   UUID REFERENCES cuentas(id),
  categoria_id        UUID REFERENCES categorias(id),
  created_by          UUID REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE abonos_cxc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios autenticados pueden gestionar abonos_cxc"
  ON abonos_cxc FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/cuentas_por_cobrar.sql
git commit -m "Add cuentas_por_cobrar and abonos_cxc migration"
```

- [ ] **Step 3: Apply the migration manually**

This repo's convention (see `CLAUDE.md` → SQL Migrations) is to run new table migrations by hand in the Supabase SQL editor rather than via automated tooling. After merging, open the Supabase project's SQL editor and run the contents of `supabase/cuentas_por_cobrar.sql` once. Note this step for the user in the final summary — it is **not** something the implementing agent should run automatically against the live project.

---

### Task 2: Routing

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the import**

In `src/App.jsx`, after the existing `import Metas from './pages/Metas'` line (line 12), add:

```javascript
import CuentasPorCobrar from './pages/CuentasPorCobrar'
```

- [ ] **Step 2: Add the route**

In the same file, inside the `<Routes>` block, after the `/metas` route (`<Route path="/metas" element={<Metas />} />`, line 58), add:

```jsx
        <Route path="/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
```

The resulting `<Routes>` block should read (unchanged lines omitted for brevity — only the two new lines are additions):

```jsx
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/movimientos" element={<Movimientos />} />
        <Route path="/cuentas" element={<Cuentas />} />
        <Route path="/deudas" element={<Deudas />} />
        <Route path="/resumen" element={<Resumen />} />
        <Route path="/metas" element={<Metas />} />
        <Route path="/cuentas-por-cobrar" element={<CuentasPorCobrar />} />
        <Route path="/config/categorias" element={<ConfigCategorias />} />
        <Route path="/config/presupuesto" element={<ConfigPresupuesto />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
```

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "Register /cuentas-por-cobrar route"
```

(This will not build successfully in isolation — `CuentasPorCobrar.jsx` doesn't exist yet. Verification happens after Task 4.)

---

### Task 3: Side menu navigation

**Files:**
- Modify: `src/components/SideMenu.jsx`

- [ ] **Step 1: Add the icon import**

In `src/components/SideMenu.jsx:3`, change:

```javascript
import { IconTag, IconBank, IconMoon, IconSun, IconGoal, IconGauge } from './icons/NavIcons'
```

to:

```javascript
import { IconTag, IconBank, IconMoon, IconSun, IconGoal, IconGauge, IconWallet } from './icons/NavIcons'
```

- [ ] **Step 2: Add the "Cobros" section**

In `src/components/SideMenu.jsx`, after the "Ahorro" section block (lines 102-105:

```jsx
          <p className="ds-section-label" style={{ padding: 'var(--space-5) var(--space-5) var(--space-1)' }}>
            Ahorro
          </p>
          <MenuItem icon={<IconGoal size={18} />} label="Metas de ahorro" onClick={() => go('/metas')} />
```

) insert a new section immediately below it, before the "Apariencia" section:

```jsx

          <p className="ds-section-label" style={{ padding: 'var(--space-5) var(--space-5) var(--space-1)' }}>
            Cobros
          </p>
          <MenuItem icon={<IconWallet size={18} />} label="Cuentas por cobrar" onClick={() => go('/cuentas-por-cobrar')} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/SideMenu.jsx
git commit -m "Add Cuentas por cobrar link to side menu"
```

---

### Task 4: Page component — data layer, list view, summary card

**Files:**
- Create: `src/pages/CuentasPorCobrar.jsx`

This task writes the full page component in one shot (a single React component file isn't meaningfully splittable into independently-valid partial JSX). It includes: state, data fetching, the summary card, the list/card rendering, the create/edit sheet form, the abono sheet form, and the submit handlers.

- [ ] **Step 1: Write the complete file**

```jsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { IconWallet, IconPlus } from '../components/icons/NavIcons'

const emptyCXC = { nombre_persona: '', nota: '', moneda: 'DOP', monto_original: '', saldo_pendiente: '' }
const emptyAbono = { monto: '', moneda: 'DOP', fecha: new Date().toISOString().split('T')[0], cuenta_destino_id: '', categoria_id: '' }

export default function CuentasPorCobrar() {
  const perfil = usePerfil()
  const [cxc, setCxc] = useState([])
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCXCForm, setShowCXCForm] = useState(false)
  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [editCXC, setEditCXC] = useState(null)
  const [cxcParaAbonar, setCxcParaAbonar] = useState(null)
  const [formCXC, setFormCXC] = useState(emptyCXC)
  const [formAbono, setFormAbono] = useState(emptyAbono)
  const [saving, setSaving] = useState(false)
  const [abonoError, setAbonoError] = useState(null)

  const isAdmin = perfil?.rol === 'administradora'

  async function fetchCXC() {
    setLoading(true)
    const { data } = await supabase
      .from('cuentas_por_cobrar').select('*').eq('activo', true)
      .order('created_at', { ascending: false })
    setCxc(data || [])
    setLoading(false)
  }

  async function fetchCuentasBanco() {
    const { data } = await supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
    setCuentasBanco(data || [])
  }

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('id,nombre').eq('tipo', 'ingreso').eq('activo', true).order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { fetchCXC(); fetchCuentasBanco(); fetchCategorias() }, [])

  function openNuevaCXC() { setEditCXC(null); setFormCXC(emptyCXC); setShowCXCForm(true) }
  function openEditCXC(c) {
    setEditCXC(c)
    setFormCXC({
      nombre_persona: c.nombre_persona,
      nota: c.nota || '',
      moneda: c.moneda,
      monto_original: c.monto_original ?? '',
      saldo_pendiente: c.saldo_pendiente ?? '',
    })
    setShowCXCForm(true)
  }
  function openAbono(c) {
    setCxcParaAbonar(c)
    setFormAbono({ ...emptyAbono, moneda: c.moneda, fecha: new Date().toISOString().split('T')[0] })
    setAbonoError(null)
    setShowAbonoForm(true)
  }

  function setC(k, v) {
    setFormCXC(f => {
      const next = { ...f, [k]: v }
      if (k === 'monto_original' && !editCXC) next.saldo_pendiente = v
      return next
    })
  }
  const setA = (k, v) => setFormAbono(f => ({ ...f, [k]: v }))

  async function handleSubmitCXC(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre_persona: formCXC.nombre_persona.trim(),
      nota: formCXC.nota.trim() || null,
      moneda: formCXC.moneda,
      monto_original: formCXC.monto_original !== '' ? parseFloat(formCXC.monto_original) : null,
      saldo_pendiente: formCXC.saldo_pendiente !== '' ? parseFloat(formCXC.saldo_pendiente) : null,
      fecha_ultima_actualizacion: new Date().toISOString().split('T')[0],
      activo: true,
    }
    let error
    if (editCXC) {
      ({ error } = await supabase.from('cuentas_por_cobrar').update(payload).eq('id', editCXC.id))
    } else {
      ({ error } = await supabase.from('cuentas_por_cobrar').insert(payload))
    }
    setSaving(false)
    if (error) { alert('Error al guardar: ' + (error.message || JSON.stringify(error))); return }
    setShowCXCForm(false)
    await fetchCXC()
  }

  async function handleSubmitAbono(e) {
    e.preventDefault()
    if (!formAbono.categoria_id) {
      setAbonoError('Selecciona una categoría para el ingreso.')
      return
    }
    setAbonoError(null)
    setSaving(true)
    const monto = parseFloat(formAbono.monto)
    const nuevoSaldo = (cxcParaAbonar.saldo_pendiente || 0) - monto
    const results = await Promise.all([
      supabase.from('abonos_cxc').insert({
        cuenta_cobrar_id: cxcParaAbonar.id,
        monto,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        cuenta_destino_id: formAbono.cuenta_destino_id || null,
        categoria_id: formAbono.categoria_id || null,
        created_by: perfil?.id,
      }),
      supabase.from('cuentas_por_cobrar').update({
        saldo_pendiente: nuevoSaldo,
        fecha_ultima_actualizacion: formAbono.fecha,
        activo: nuevoSaldo > 0,
      }).eq('id', cxcParaAbonar.id),
      supabase.from('movimientos').insert({
        tipo: 'ingreso',
        monto,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        concepto: `Cobro · ${cxcParaAbonar.nombre_persona}`,
        categoria_id: formAbono.categoria_id || null,
        cuenta_id: formAbono.cuenta_destino_id || null,
        created_by: perfil?.id,
        recurrente: false,
      }),
    ])
    setSaving(false)
    const abonoErr = results.find(r => r.error)?.error
    if (abonoErr) { alert('Error al registrar el cobro: ' + (abonoErr.message || JSON.stringify(abonoErr))); return }
    setShowAbonoForm(false)
    await fetchCXC()
  }

  async function handleMarcarCobrada(c) {
    if (!confirm(`¿Marcar "${c.nombre_persona}" como cobrada?`)) return
    await supabase.from('cuentas_por_cobrar').update({ activo: false }).eq('id', c.id)
    await fetchCXC()
  }

  const totalPorMoneda = cxc.reduce((acc, c) => {
    if (c.saldo_pendiente) acc[c.moneda] = (acc[c.moneda] || 0) + Number(c.saldo_pendiente)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Cuentas por cobrar</h1>
          <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>{cxc.length} activas</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Resumen total */}
        {Object.keys(totalPorMoneda).length > 0 && (
          <div style={{
            background: 'var(--color-success-light)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="ds-section-label" style={{ color: 'var(--color-success)', margin: 0 }}>Total por cobrar</span>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {Object.entries(totalPorMoneda).map(([moneda, total]) => (
                <span key={moneda} style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--text-base)' }}>
                  {Number(total).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {moneda}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-10)' }}>
            Cargando...
          </p>
        )}

        {!loading && cxc.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconWallet size={40} /></div>
            <p style={{ fontWeight: 500 }}>No hay cuentas por cobrar activas.</p>
            {isAdmin && <p>Toca + para registrar una.</p>}
          </div>
        )}

        {cxc.map(c => (
          <CXCCard
            key={c.id}
            cxc={c}
            isAdmin={isAdmin}
            onEdit={openEditCXC}
            onAbono={openAbono}
            onMarcarCobrada={handleMarcarCobrada}
          />
        ))}
      </div>

      {isAdmin && (
        <button onClick={openNuevaCXC} className="ds-fab" aria-label="Nueva cuenta por cobrar"><IconPlus size={24} /></button>
      )}

      {/* Modal cuenta por cobrar */}
      {showCXCForm && (
        <SheetModal onClose={() => setShowCXCForm(false)} title={editCXC ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'}>
          <form onSubmit={handleSubmitCXC}>
            <div className="ds-field">
              <label htmlFor="cxc-nombre" className="ds-label">Nombre de la persona</label>
              <input id="cxc-nombre" type="text" value={formCXC.nombre_persona}
                onChange={e => setC('nombre_persona', e.target.value)}
                placeholder="Ej: Juan Pérez"
                required className="ds-input" />
            </div>

            <div className="ds-field">
              <label htmlFor="cxc-nota" className="ds-label">
                Nota / motivo <span className="ds-label-hint">(opcional)</span>
              </label>
              <textarea id="cxc-nota" value={formCXC.nota}
                onChange={e => setC('nota', e.target.value)}
                placeholder="Ej: Préstamo personal, venta a crédito"
                rows={2} className="ds-input" />
            </div>

            <div className="ds-field">
              <p className="ds-label" id="moneda-cxc-label">Moneda</p>
              <div role="group" aria-labelledby="moneda-cxc-label" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {['DOP', 'USD'].map(m => (
                  <button key={m} type="button" aria-pressed={formCXC.moneda === m}
                    onClick={() => setC('moneda', m)}
                    style={{
                      flex: 1, padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${formCXC.moneda === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: formCXC.moneda === m ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: formCXC.moneda === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer',
                    }}>{m}</button>
                ))}
              </div>
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="cxc-monto" className="ds-label">Monto original</label>
                <input id="cxc-monto" type="number" step="0.01" min="0"
                  value={formCXC.monto_original}
                  onChange={e => setC('monto_original', e.target.value)}
                  placeholder="0.00" required className="ds-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="cxc-saldo" className="ds-label">Saldo pendiente</label>
                <input id="cxc-saldo" type="number" step="0.01" min="0"
                  value={formCXC.saldo_pendiente}
                  onChange={e => setC('saldo_pendiente', e.target.value)}
                  placeholder="0.00" required className="ds-input" />
              </div>
            </div>

            <SheetBotones onCancel={() => setShowCXCForm(false)} saving={saving}
              label={editCXC ? 'Guardar cambios' : 'Registrar cuenta'} />
          </form>
        </SheetModal>
      )}

      {/* Modal abono */}
      {showAbonoForm && (
        <SheetModal onClose={() => setShowAbonoForm(false)} title="Registrar cobro" subtitle={cxcParaAbonar?.nombre_persona}>
          <form onSubmit={handleSubmitAbono}>
            {abonoError && (
              <div role="alert" style={{
                background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5,
              }}>
                {abonoError}
              </div>
            )}
            <div className="ds-field">
              <label htmlFor="abono-fecha" className="ds-label">Fecha</label>
              <input id="abono-fecha" type="date" value={formAbono.fecha}
                onChange={e => setA('fecha', e.target.value)} required className="ds-input" />
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 2 }}>
                <label htmlFor="abono-monto" className="ds-label">Monto cobrado</label>
                <input id="abono-monto" type="number" step="0.01" min="0.01"
                  value={formAbono.monto}
                  onChange={e => setA('monto', e.target.value)}
                  required placeholder="0.00" className="ds-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="abono-moneda" className="ds-label">Moneda</label>
                <select id="abono-moneda" value={formAbono.moneda}
                  onChange={e => setA('moneda', e.target.value)} className="ds-input">
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="ds-field">
              <label htmlFor="abono-cuenta" className="ds-label">
                Cuenta destino <span className="ds-label-hint">(opcional)</span>
              </label>
              <select id="abono-cuenta" value={formAbono.cuenta_destino_id}
                onChange={e => setA('cuenta_destino_id', e.target.value)} className="ds-input">
                <option value="">Sin especificar</option>
                {cuentasBanco.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="ds-field">
              <label htmlFor="abono-cat" className="ds-label">Categoría del ingreso</label>
              <select id="abono-cat" value={formAbono.categoria_id}
                onChange={e => setA('categoria_id', e.target.value)} className="ds-input" required>
                <option value="">Seleccionar categoría…</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
              Se registrará automáticamente un ingreso en Movimientos.
            </p>

            <SheetBotones onCancel={() => setShowAbonoForm(false)} saving={saving} label="Registrar cobro" />
          </form>
        </SheetModal>
      )}
    </div>
  )
}

function CXCCard({ cxc: c, isAdmin, onEdit, onAbono, onMarcarCobrada }) {
  const saldo   = Number(c.saldo_pendiente || 0)
  const original = Number(c.monto_original || 0)
  const pct     = original > 0 ? Math.min(((original - saldo) / original) * 100, 100) : null

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{c.nombre_persona}</p>
          {c.nota && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {c.nota}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--text-lg)', fontVariantNumeric: 'tabular-nums' }}>
            {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {c.moneda}
          </p>
          {original > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              de {original.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {c.moneda}
            </p>
          )}
        </div>
      </div>

      {pct !== null && (
        <div
          className="ds-progress-track"
          style={{ marginBottom: 'var(--space-3)' }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(pct)}% cobrado`}
        >
          <div className="ds-progress-fill" style={{ width: `${pct}%`, background: 'var(--color-success)' }} />
        </div>
      )}

      {c.fecha_ultima_actualizacion && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Actualizado: {new Date(c.fecha_ultima_actualizacion + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={() => onAbono(c)} className="ds-btn ds-btn-sm" style={{
          flex: 2, background: 'var(--color-success-light)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)', fontWeight: 600,
        }}>+ Cobro</button>
        {isAdmin && (
          <>
            <button onClick={() => onEdit(c)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ flex: 1 }}>Editar</button>
            <button onClick={() => onMarcarCobrada(c)} className="ds-btn ds-btn-danger ds-btn-sm" style={{ flex: 1 }}>Cobrada</button>
          </>
        )}
      </div>
    </div>
  )
}

function SheetModal({ children, onClose, title, subtitle }) {
  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div
        className="ds-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        aria-modal="true"
      >
        <div className="ds-sheet-handle" />
        <h2 style={{ marginBottom: subtitle ? 'var(--space-1)' : 'var(--space-5)' }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

function SheetBotones({ onCancel, saving, label }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
      <button type="button" onClick={onCancel} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
        {saving ? 'Guardando...' : label}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify the project builds**

Run: `npm run build`
Expected: Build completes with `✓ built in ...` and no errors (this catches JSX syntax errors, bad imports, and unused-import issues across `App.jsx`, `SideMenu.jsx`, and the new page together).

- [ ] **Step 3: Commit**

```bash
git add src/pages/CuentasPorCobrar.jsx
git commit -m "Add Cuentas por Cobrar page"
```

---

### Task 5: Manual QA in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Server starts at `http://localhost:5173/Control-finanzas-app/`.

- [ ] **Step 2: Apply the migration to the dev/test Supabase project (if not already done in Task 1 Step 3)**

Without the tables existing, the page will load but every fetch will silently return empty arrays (Supabase client swallows the error into `data: null` given the destructuring pattern used) — the empty state will show but creating a record will fail with an alert. Confirm the migration has been applied before testing writes.

- [ ] **Step 3: Walk through the golden path as `administradora`**

1. Log in as an `administradora` user, open ☰ menu → confirm a "Cobros" section appears with "Cuentas por cobrar".
2. Navigate to `/cuentas-por-cobrar`. Confirm the empty state renders ("No hay cuentas por cobrar activas." + "Toca + para registrar una.").
3. Tap the FAB, fill in a new cuenta (nombre, nota, moneda, monto original) — confirm saldo pendiente auto-fills to match monto original as you type.
4. Submit. Confirm the card appears with the green saldo, and the "Total por cobrar" summary card appears above the list.
5. Tap "+ Cobro" on the card, fill a partial amount, pick a categoría de ingreso, submit. Confirm: the card's saldo decreases, a new `ingreso` movimiento appears in `/movimientos` with concepto `Cobro · <nombre>`, and the card is still active (saldo > 0).
6. Repeat the cobro for the remaining saldo. Confirm the record disappears from the active list (auto-marked `activo = false` since saldo reached 0).
7. Create a second cuenta, then use "Cobrada" (admin button) to manually deactivate it without a payment — confirm it disappears from the list and no movimiento was created.

- [ ] **Step 4: Confirm role gating as `auxiliar`**

Log in as an `auxiliar` user. Confirm: FAB is not visible, "Editar"/"Cobrada" buttons are not visible on cards, but "+ Cobro" is visible and functional.

- [ ] **Step 5: Confirm dark mode and mobile viewport render correctly**

Toggle dark mode from the side menu; confirm the success-colored summary card and card text remain legible. Resize to a mobile viewport (or use browser device emulation) and confirm the sheet forms are not obscured by the bottom nav.

---

## Summary for the user after implementation

- Remind the user that `supabase/cuentas_por_cobrar.sql` must be run once in the Supabase SQL editor (Task 1, Step 3) — it is not applied automatically.
- No changes were made to Dashboard or Resumen widgets — out of scope per the approved spec.
