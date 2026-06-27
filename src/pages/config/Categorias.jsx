import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('gasto')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null) // { msg, type: 'info'|'success'|'danger' }

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

  async function fetchCats() {
    const { data } = await supabase.from('categorias').select('*').order('tipo').order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { fetchCats() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    await supabase.from('categorias').insert({ nombre: nombre.trim(), tipo, activo: true })
    setNombre('')
    await fetchCats()
    setSaving(false)
    showToast('Categoría agregada', 'success')
  }

  async function toggleActivo(cat) {
    await supabase.from('categorias').update({ activo: !cat.activo }).eq('id', cat.id)
    await fetchCats()
    showToast(cat.activo ? `"${cat.nombre}" desactivada` : `"${cat.nombre}" activada`, 'info')
  }

  async function handleDelete(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) {
      // Tiene movimientos asociados — desactivar en su lugar
      await supabase.from('categorias').update({ activo: false }).eq('id', id)
      await fetchCats()
      showToast(`"${nombre}" tiene movimientos. Se desactivó en su lugar.`, 'info')
    } else {
      await fetchCats()
      showToast(`"${nombre}" eliminada`, 'success')
    }
  }

  const ingresos = categorias.filter(c => c.tipo === 'ingreso')
  const gastos   = categorias.filter(c => c.tipo === 'gasto')

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <h1>Categorías</h1>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Formulario nueva categoría */}
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
          <input
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Nombre de categoría"
            required
            aria-label="Nombre de la nueva categoría"
            className="ds-input"
            style={{ flex: 1, minWidth: '140px' }}
          />
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value)}
            aria-label="Tipo de categoría"
            className="ds-input"
            style={{ width: 'auto' }}
          >
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </select>
          <button type="submit" disabled={saving} className="ds-btn ds-btn-primary">
            {saving ? '...' : '+ Agregar'}
          </button>
        </form>

        {/* Lista por tipo */}
        {[
          { label: 'Gastos',   items: gastos,   color: 'var(--color-danger)'  },
          { label: 'Ingresos', items: ingresos, color: 'var(--color-success)' },
        ].map(({ label, items, color }) => (
          <div key={label} style={{ marginBottom: 'var(--space-6)' }}>
            <p className="ds-section-label" style={{ color }}>{label}</p>
            {items.length === 0 && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', padding: 'var(--space-2) 0' }}>
                Sin categorías aún.
              </p>
            )}
            {items.map(cat => (
              <div
                key={cat.id}
                className="ds-card"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-2)',
                  opacity: cat.activo ? 1 : 0.45,
                  transition: 'opacity 0.2s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {cat.nombre}
                  </span>
                  {!cat.activo && (
                    <span style={{
                      marginLeft: 'var(--space-2)',
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-muted)',
                      fontStyle: 'italic',
                    }}>
                      inactiva
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                  <button
                    onClick={() => toggleActivo(cat)}
                    className="ds-btn ds-btn-ghost ds-btn-sm"
                    aria-label={cat.activo ? `Desactivar ${cat.nombre}` : `Activar ${cat.nombre}`}
                  >
                    {cat.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id, cat.nombre)}
                    className="ds-btn ds-btn-danger ds-btn-sm"
                    aria-label={`Eliminar categoría ${cat.nombre}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Toast notification — fixed, siempre visible */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: `calc(var(--bottomnav-h) + var(--space-4))`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            background: toast.type === 'danger'
              ? 'var(--color-danger)'
              : toast.type === 'success'
                ? 'var(--color-success)'
                : '#1e293b',
            color: '#fff',
            padding: 'var(--space-3) var(--space-5)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - var(--space-8))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            animation: 'fadeInUp 0.2s ease',
          }}
        >
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
