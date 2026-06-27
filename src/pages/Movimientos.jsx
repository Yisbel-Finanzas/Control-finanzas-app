import { useEffect, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import MovimientoForm from '../components/MovimientoForm'
import { IconWallet, IconRepeat, IconPlus, IconX, IconDownload } from '../components/icons/NavIcons'

const FILTROS_INIT = {
  search: '',
  tipo: 'todos',
  categoria: '',
  moneda: 'todas',
  desde: '',
  hasta: '',
}

export default function Movimientos() {
  const perfil = usePerfil()
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [filtros, setFiltros] = useState(FILTROS_INIT)

  async function fetchMovimientos() {
    setLoading(true)
    const { data } = await supabase
      .from('movimientos')
      .select('*, categorias(nombre), cuentas(banco, producto)')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(500)
    setMovimientos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchMovimientos() }, [])

  const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }))

  // Categorías únicas derivadas de los datos ya cargados
  const categoriasDisponibles = useMemo(() => {
    const map = new Map()
    movimientos.forEach(m => {
      if (m.categoria_id && m.categorias) map.set(m.categoria_id, m.categorias.nombre)
    })
    return [...map.entries()]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [movimientos])

  // Filtrado client-side
  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      if (filtros.search) {
        const q = filtros.search.toLowerCase()
        const texto = `${m.concepto || ''} ${m.subcategoria || ''} ${m.categorias?.nombre || ''}`.toLowerCase()
        if (!texto.includes(q)) return false
      }
      if (filtros.tipo !== 'todos' && m.tipo !== filtros.tipo) return false
      if (filtros.categoria && m.categoria_id !== filtros.categoria) return false
      if (filtros.moneda !== 'todas' && m.moneda !== filtros.moneda) return false
      if (filtros.desde && m.fecha < filtros.desde) return false
      if (filtros.hasta && m.fecha > filtros.hasta) return false
      return true
    })
  }, [movimientos, filtros])

  const filtrosActivos = [
    filtros.tipo !== 'todos',
    filtros.categoria !== '',
    filtros.moneda !== 'todas',
    filtros.desde !== '',
    filtros.hasta !== '',
  ].filter(Boolean).length

  const hayFiltros = filtrosActivos > 0 || filtros.search !== ''

  const grouped = useMemo(() =>
    movimientosFiltrados.reduce((acc, m) => {
      if (!acc[m.fecha]) acc[m.fecha] = []
      acc[m.fecha].push(m)
      return acc
    }, {})
  , [movimientosFiltrados])

  function exportarExcel() {
    if (!movimientosFiltrados.length) return
    const rows = movimientosFiltrados.map(m => ({
      'Fecha':        m.fecha,
      'Tipo':         m.tipo === 'ingreso' ? 'Ingreso' : 'Gasto',
      'Categoría':    m.categorias?.nombre || '',
      'Subcategoría': m.subcategoria || '',
      'Concepto':     m.concepto || '',
      'Monto':        Number(m.monto),
      'Moneda':       m.moneda,
      'Cuenta':       m.cuentas ? `${m.cuentas.banco} · ${m.cuentas.producto}` : '',
      'Recurrente':   m.recurrente ? 'Sí' : 'No',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 12 }, { wch: 9 }, { wch: 20 }, { wch: 18 },
      { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 11 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
    const etiqueta = filtros.desde && filtros.hasta
      ? `_${filtros.desde}_${filtros.hasta}`
      : `_${new Date().toISOString().split('T')[0]}`
    XLSX.writeFile(wb, `movimientos${etiqueta}.xlsx`)
  }

  function handleNew() { setEditItem(null); setShowForm(true) }
  function handleEdit(m) { setEditItem(m); setShowForm(true) }
  function handleClose() { setShowForm(false); setEditItem(null) }
  async function handleSave() { await fetchMovimientos(); handleClose() }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este movimiento?')) return
    await supabase.from('movimientos').update({
      deleted_at: new Date().toISOString(),
      deleted_by: perfil?.id,
    }).eq('id', id)
    await fetchMovimientos()
  }

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Movimientos</h1>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            {!loading && movimientosFiltrados.length > 0 && (
              <button
                onClick={exportarExcel}
                aria-label="Exportar a Excel"
                title="Exportar a Excel"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.30)',
                  color: '#fff', borderRadius: 'var(--radius-sm)',
                  padding: '5px 10px', cursor: 'pointer',
                  fontSize: 'var(--text-xs)', fontWeight: 600,
                }}
              >
                <IconDownload size={13} /> Excel
              </button>
            )}
            <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85, fontWeight: 500 }}>
              {perfil?.nombre}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Barra de búsqueda y filtros */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: filtrosOpen ? 'var(--space-3)' : 0 }}>
            <input
              type="search"
              value={filtros.search}
              onChange={e => set('search', e.target.value)}
              placeholder="Buscar concepto, categoría…"
              className="ds-input"
              style={{ flex: 1 }}
              aria-label="Buscar movimientos"
            />
            <button
              onClick={() => setFiltrosOpen(v => !v)}
              className={filtrosActivos > 0 ? 'ds-btn ds-btn-primary ds-btn-sm' : 'ds-btn ds-btn-ghost ds-btn-sm'}
              style={{ flexShrink: 0, position: 'relative' }}
              aria-expanded={filtrosOpen}
            >
              Filtros
              {filtrosActivos > 0 && (
                <span style={{
                  position: 'absolute', top: -6, right: -6,
                  background: 'var(--color-danger)', color: '#fff',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '10px', fontWeight: 700,
                  width: 16, height: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}>
                  {filtrosActivos}
                </span>
              )}
            </button>
            {hayFiltros && (
              <button
                onClick={() => setFiltros(FILTROS_INIT)}
                className="ds-btn ds-btn-ghost ds-btn-sm"
                aria-label="Limpiar filtros"
                title="Limpiar filtros"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          {/* Panel de filtros expandido */}
          {filtrosOpen && (
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
            }}>
              {/* Tipo */}
              <div>
                <p style={labelStyle}>Tipo</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[['todos', 'Todos'], ['gasto', 'Gastos'], ['ingreso', 'Ingresos']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => set('tipo', val)}
                      className={filtros.tipo === val ? 'ds-btn ds-btn-primary ds-btn-sm' : 'ds-btn ds-btn-ghost ds-btn-sm'}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Moneda */}
              <div>
                <p style={labelStyle}>Moneda</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  {[['todas', 'Todas'], ['DOP', 'DOP'], ['USD', 'USD']].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => set('moneda', val)}
                      className={filtros.moneda === val ? 'ds-btn ds-btn-primary ds-btn-sm' : 'ds-btn ds-btn-ghost ds-btn-sm'}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Categoría */}
              {categoriasDisponibles.length > 0 && (
                <div>
                  <label style={labelStyle}>Categoría</label>
                  <select
                    value={filtros.categoria}
                    onChange={e => set('categoria', e.target.value)}
                    className="ds-input"
                  >
                    <option value="">Todas las categorías</option>
                    {categoriasDisponibles.map(c => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rango de fechas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>Desde</label>
                  <input
                    type="date"
                    value={filtros.desde}
                    onChange={e => set('desde', e.target.value)}
                    className="ds-input"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Hasta</label>
                  <input
                    type="date"
                    value={filtros.hasta}
                    onChange={e => set('hasta', e.target.value)}
                    className="ds-input"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Contador de resultados */}
        {hayFiltros && !loading && (
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
            {movimientosFiltrados.length} resultado{movimientosFiltrados.length !== 1 ? 's' : ''}
          </p>
        )}

        {loading && <LoadingSkeleton />}

        {!loading && movimientosFiltrados.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconWallet size={40} /></div>
            <p style={{ fontWeight: 500 }}>
              {hayFiltros ? 'Sin resultados para estos filtros.' : 'No hay movimientos registrados.'}
            </p>
            <p>{hayFiltros ? 'Prueba ajustando los filtros.' : 'Toca + para agregar el primero.'}</p>
          </div>
        )}

        {Object.entries(grouped).map(([fecha, items]) => (
          <div key={fecha} style={{ marginBottom: 'var(--space-5)' }}>
            <p className="ds-section-label">
              {new Date(fecha + 'T12:00:00').toLocaleDateString('es-DO', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>
            {items.map(m => (
              <MovimientoCard
                key={m.id}
                m={m}
                isAdmin={perfil?.rol === 'administradora'}
                onEdit={() => handleEdit(m)}
                onDelete={() => handleDelete(m.id)}
              />
            ))}
          </div>
        ))}
      </div>

      <button onClick={handleNew} className="ds-fab" aria-label="Nuevo movimiento">
        <IconPlus size={24} />
      </button>

      {showForm && (
        <MovimientoForm
          item={editItem}
          perfil={perfil}
          onSave={handleSave}
          onClose={handleClose}
        />
      )}
    </div>
  )
}

const labelStyle = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-text-muted)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  display: 'block',
  marginBottom: 'var(--space-2)',
}

function MovimientoCard({ m, isAdmin, onEdit, onDelete }) {
  const esIngreso = m.tipo === 'ingreso'
  return (
    <div
      className="ds-card"
      onClick={onEdit}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onEdit()}
      aria-label={`${m.concepto || m.categorias?.nombre || 'Movimiento'}, ${esIngreso ? '+' : '-'}${Number(m.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })} ${m.moneda}`}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: 'var(--space-4)', marginBottom: 'var(--space-2)',
        cursor: 'pointer',
        transition: 'box-shadow var(--transition)',
        borderLeft: `3px solid ${esIngreso ? 'var(--color-success)' : 'var(--color-danger)'}`,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
      onFocus={e => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
      onBlur={e => e.currentTarget.style.boxShadow = 'var(--shadow-sm)'}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '2px', color: 'var(--color-text-primary)' }}>
          {m.concepto || m.categorias?.nombre || '-'}
        </p>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span>
            {m.categorias?.nombre}
            {m.subcategoria ? ` · ${m.subcategoria}` : ''}
          </span>
          {m.recurrente && <IconRepeat size={11} aria-label="Recurrente" />}
        </p>
      </div>
      <div style={{ textAlign: 'right', marginLeft: 'var(--space-3)', flexShrink: 0 }}>
        <p style={{
          fontWeight: 700, fontSize: 'var(--text-base)',
          color: esIngreso ? 'var(--color-success)' : 'var(--color-danger)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {esIngreso ? '+' : '-'}{Number(m.monto).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {m.moneda}
        </p>
        {isAdmin && (
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            className="ds-btn ds-btn-sm"
            aria-label="Eliminar movimiento"
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-danger)', fontSize: 'var(--text-xs)',
              padding: '2px 0', marginTop: '2px', cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      <div className="ds-skeleton" style={{ height: 40, borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }} />
      <div className="ds-skeleton" style={{ height: 10, width: 140, marginBottom: 'var(--space-3)' }} />
      {[0, 1, 2].map(i => (
        <div key={i} className="ds-card" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-4)', marginBottom: 'var(--space-2)',
          borderLeft: '3px solid var(--color-border)',
        }}>
          <div style={{ flex: 1 }}>
            <div className="ds-skeleton" style={{ height: 13, width: '55%', marginBottom: 'var(--space-2)' }} />
            <div className="ds-skeleton" style={{ height: 10, width: '35%' }} />
          </div>
          <div className="ds-skeleton" style={{ height: 18, width: 80 }} />
        </div>
      ))}
    </>
  )
}
