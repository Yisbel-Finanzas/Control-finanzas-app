import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('gasto')
  const [saving, setSaving] = useState(false)

  async function fetchCats() {
    const { data } = await supabase.from('categorias').select('*').order('tipo').order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { fetchCats() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    await supabase.from('categorias').insert({ nombre: nombre.trim(), tipo })
    setNombre('')
    await fetchCats()
    setSaving(false)
  }

  async function toggleActivo(cat) {
    await supabase.from('categorias').update({ activo: !cat.activo }).eq('id', cat.id)
    await fetchCats()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categorias').delete().eq('id', id)
    await fetchCats()
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
          { label: 'Gastos',    items: gastos,    color: 'var(--color-danger)'  },
          { label: 'Ingresos',  items: ingresos,  color: 'var(--color-success)' },
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
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                  {cat.nombre}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button onClick={() => toggleActivo(cat)} className="ds-btn ds-btn-ghost ds-btn-sm">
                    {cat.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
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
    </div>
  )
}
