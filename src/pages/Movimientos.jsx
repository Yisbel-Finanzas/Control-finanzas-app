import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import MovimientoForm from '../components/MovimientoForm'
import { IconWallet, IconRepeat, IconPlus } from '../components/icons/NavIcons'

export default function Movimientos() {
  const perfil = usePerfil()
  const [movimientos, setMovimientos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)

  async function fetchMovimientos() {
    setLoading(true)
    const { data } = await supabase
      .from('movimientos')
      .select('*, categorias(nombre)')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(100)
    setMovimientos(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchMovimientos() }, [])

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

  const grouped = movimientos.reduce((acc, m) => {
    const key = m.fecha
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      {/* Header */}
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Movimientos</h1>
          <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85, fontWeight: 500 }}>
            {perfil?.nombre}
          </span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {loading && (
          <div>
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
          </div>
        )}

        {!loading && movimientos.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconWallet size={40} /></div>
            <p style={{ fontWeight: 500 }}>No hay movimientos registrados.</p>
            <p>Toca + para agregar el primero.</p>
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
              padding: '2px 0', marginTop: '2px',
              cursor: 'pointer',
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  )
}
