import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { usePerfil } from '../../hooks/usePerfil'
import { useConfig } from '../../hooks/useConfig'
import { IconPlus, IconX } from '../../components/icons/NavIcons'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}

export default function ConfigPresupuesto() {
  const perfil = usePerfil()
  const { valor: activo, loading: loadingConfig, update: setActivo } = useConfig('presupuesto_activo')
  const [presupuestos, setPresupuestos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [gastosActuales, setGastosActuales] = useState({})
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  const isActivo = activo === 'true'
  const isAdmin = perfil?.rol === 'administradora'

  const now = new Date()
  const desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const mesLabel = now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })

  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
  const desdePrev = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const hastaPrev = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]

  const [gastosMesAnterior, setGastosMesAnterior] = useState({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: presp }, { data: cats }, { data: movs }, { data: movsPrev }] = await Promise.all([
      supabase.from('presupuestos').select('*, categorias(nombre)').order('created_at'),
      supabase.from('categorias').select('id, nombre').eq('tipo', 'gasto').eq('activo', true).order('nombre'),
      supabase.from('movimientos')
        .select('categoria_id, monto, moneda')
        .eq('tipo', 'gasto')
        .is('deleted_at', null)
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase.from('movimientos')
        .select('categoria_id, monto, moneda')
        .eq('tipo', 'gasto')
        .is('deleted_at', null)
        .gte('fecha', desdePrev)
        .lte('fecha', hastaPrev),
    ])
    setPresupuestos(presp || [])
    setCategorias(cats || [])
    const gastos = {}
    ;(movs || []).forEach(m => {
      const key = `${m.categoria_id}:${m.moneda}`
      gastos[key] = (gastos[key] || 0) + Number(m.monto)
    })
    setGastosActuales(gastos)
    const gastosPrev = {}
    ;(movsPrev || []).forEach(m => {
      const key = `${m.categoria_id}:${m.moneda}`
      gastosPrev[key] = (gastosPrev[key] || 0) + Number(m.monto)
    })
    setGastosMesAnterior(gastosPrev)
    setLoading(false)
  }, [desde, hasta, desdePrev, hastaPrev])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleToggle() {
    const nuevo = isActivo ? 'false' : 'true'
    const { error } = await setActivo(nuevo)
    if (error) showToast('Error al guardar', 'danger')
    else showToast(nuevo === 'true' ? 'Módulo activado' : 'Módulo desactivado')
  }

  async function handleDelete(p) {
    const { error } = await supabase.from('presupuestos').delete().eq('id', p.id)
    if (error) showToast('Error al eliminar', 'danger')
    else { await fetchData(); showToast(`Límite de "${p.categorias?.nombre}" eliminado`) }
  }

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <h1>Presupuesto mensual</h1>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Toggle */}
        <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1, paddingRight: 'var(--space-4)' }}>
              <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-1)' }}>
                Módulo de presupuesto
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                {isActivo
                  ? 'Activo. Se muestran alertas cuando el gasto se acerca al límite.'
                  : 'Inactivo. Activa para controlar gastos por categoría.'}
              </p>
            </div>
            {isAdmin
              ? <Toggle on={isActivo} disabled={loadingConfig} onChange={handleToggle} />
              : (
                <span className={`ds-badge ${isActivo ? 'ds-badge-success' : ''}`}
                  style={!isActivo ? { background: 'var(--color-border)', color: 'var(--color-text-muted)' } : {}}>
                  {isActivo ? 'Activo' : 'Inactivo'}
                </span>
              )}
          </div>
        </div>

        {isActivo && (
          <>
            <p className="ds-section-label" style={{ marginBottom: 'var(--space-3)', textTransform: 'capitalize' }}>
              Límites — {mesLabel}
            </p>

            {loading && <SkeletonList />}

            {!loading && presupuestos.length === 0 && (
              <div className="ds-empty">
                <p style={{ fontWeight: 500 }}>Sin límites configurados.</p>
                {isAdmin && (
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                    Toca + para definir un límite de gasto por categoría.
                  </p>
                )}
              </div>
            )}

            {!loading && presupuestos.map(p => {
              const gastado = gastosActuales[`${p.categoria_id}:${p.moneda}`] || 0
              const gastadoPrev = gastosMesAnterior[`${p.categoria_id}:${p.moneda}`] || 0
              const rollover = p.rollover_activo
                ? Math.max(0, Number(p.monto_limite) - gastadoPrev)
                : 0
              const limiteEfectivo = Number(p.monto_limite) + rollover
              const disponible = limiteEfectivo - gastado
              const pct = Math.min(100, Math.round((gastado / limiteEfectivo) * 100))
              const excedido = gastado > limiteEfectivo
              const advertencia = !excedido && pct >= 80
              return (
                <div key={p.id} className="ds-card" style={{
                  padding: 'var(--space-4)', marginBottom: 'var(--space-3)',
                  borderLeft: `3px solid ${excedido ? 'var(--color-danger)' : advertencia ? 'var(--color-warning)' : 'var(--color-border)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
                        {p.categorias?.nombre}
                      </p>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        Límite: {fmt(p.monto_limite, p.moneda)}
                        {rollover > 0 && <> + {fmt(rollover, p.moneda)} del mes anterior</>}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      {p.rollover_activo && <span className="ds-badge" style={{ background: 'var(--color-border)', color: 'var(--color-text-muted)' }}>↻</span>}
                      {excedido && <span className="ds-badge ds-badge-danger">Excedido</span>}
                      {advertencia && <span className="ds-badge ds-badge-warning">Alerta</span>}
                      {isAdmin && (
                        <button onClick={() => handleDelete(p)} className="ds-btn ds-btn-ghost ds-btn-sm"
                          aria-label="Eliminar límite" style={{ padding: '4px 6px', color: 'var(--color-text-muted)' }}>
                          <IconX size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="ds-progress-track" style={{ marginBottom: 'var(--space-2)' }}>
                    <div className="ds-progress-fill" style={{
                      width: `${pct}%`,
                      background: excedido ? 'var(--color-danger)' : advertencia ? 'var(--color-warning)' : 'var(--color-primary)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: excedido ? 'var(--color-danger)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      Gastado: {fmt(gastado, p.moneda)}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: disponible < 0 ? 'var(--color-danger)' : 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                      {disponible < 0 ? '−' : ''}{fmt(Math.abs(disponible), p.moneda)} disponible
                    </span>
                  </div>
                </div>
              )
            })}

            {isAdmin && !loading && (
              <button onClick={() => setSheet(true)} className="ds-fab" aria-label="Agregar límite">
                <IconPlus size={24} />
              </button>
            )}
          </>
        )}
      </div>

      {sheet && (
        <PresupuestoSheet
          categorias={categorias}
          perfil={perfil}
          onClose={() => setSheet(null)}
          onSave={() => { setSheet(null); fetchData(); showToast('Límite guardado') }}
        />
      )}

      {toast && (
        <div role="alert" aria-live="polite" style={{
          position: 'fixed',
          bottom: `calc(var(--bottomnav-h) + var(--space-4))`,
          left: '50%', transform: 'translateX(-50%)',
          zIndex: 500,
          background: toast.type === 'danger' ? 'var(--color-danger)' : 'var(--color-success)',
          color: '#fff', padding: 'var(--space-3) var(--space-5)',
          borderRadius: 'var(--radius-full)', whiteSpace: 'nowrap',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function PresupuestoSheet({ categorias, perfil, onClose, onSave }) {
  const [categoriaId, setCategoriaId] = useState('')
  const [moneda, setMoneda] = useState('DOP')
  const [monto, setMonto] = useState('')
  const [rolloverActivo, setRolloverActivo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!categoriaId) { setError('Selecciona una categoría.'); return }
    if (!monto || Number(monto) <= 0) { setError('El monto debe ser mayor a 0.'); return }
    setLoading(true)
    const { error } = await supabase.from('presupuestos').upsert(
      { categoria_id: categoriaId, moneda, monto_limite: parseFloat(monto), rollover_activo: rolloverActivo, created_by: perfil?.id },
      { onConflict: 'categoria_id,moneda' }
    )
    setLoading(false)
    if (error) setError(error.message)
    else onSave()
  }

  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div className="ds-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Límite de gasto" aria-modal="true">
        <div className="ds-sheet-handle" />
        <h2>Límite de gasto</h2>
        <form onSubmit={handleSubmit}>
          {error && (
            <div role="alert" style={{
              background: 'var(--color-danger-light)', color: 'var(--color-danger)',
              borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}
          <div className="ds-field">
            <label className="ds-label">Categoría de gasto</label>
            <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="ds-input" required>
              <option value="">Seleccionar…</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 2 }}>
              <label className="ds-label">Límite mensual</label>
              <input type="number" step="0.01" min="1" value={monto}
                onChange={e => setMonto(e.target.value)} placeholder="0.00" className="ds-input" required />
            </div>
            <div style={{ flex: 1 }}>
              <label className="ds-label">Moneda</label>
              <select value={moneda} onChange={e => setMoneda(e.target.value)} className="ds-input">
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
            <input type="checkbox" checked={rolloverActivo} onChange={e => setRolloverActivo(e.target.checked)} />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
              Acumular sobrante al mes siguiente
            </span>
          </label>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
            Si ya existe un límite para esta categoría y moneda, se actualizará.
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
              {loading ? 'Guardando…' : 'Guardar límite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Toggle({ on, disabled, onChange }) {
  return (
    <button
      role="switch" aria-checked={on} disabled={disabled} onClick={onChange}
      style={{
        width: 44, height: 24, borderRadius: 12, flexShrink: 0,
        background: on ? 'var(--color-primary)' : 'var(--color-border-strong)',
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: on ? 22 : 2,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', display: 'block',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </button>
  )
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
          <div className="ds-skeleton" style={{ height: 12, width: '40%', marginBottom: 'var(--space-2)' }} />
          <div className="ds-skeleton" style={{ height: 8, borderRadius: 4, marginBottom: 'var(--space-2)' }} />
          <div className="ds-skeleton" style={{ height: 8, width: '60%' }} />
        </div>
      ))}
    </>
  )
}
