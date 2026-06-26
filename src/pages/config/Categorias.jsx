import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const inputStyle = {
  flex: 1, padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.9rem', background: '#fff',
}

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [nombre, setNombre] = useState('')
  const [tipo, setTipo] = useState('gasto')
  const [saving, setSaving] = useState(false)

  async function fetch() {
    const { data } = await supabase.from('categorias').select('*').order('tipo').order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { fetch() }, [])

  async function handleAdd(e) {
    e.preventDefault()
    if (!nombre.trim()) return
    setSaving(true)
    await supabase.from('categorias').insert({ nombre: nombre.trim(), tipo })
    setNombre('')
    await fetch()
    setSaving(false)
  }

  async function toggleActivo(cat) {
    await supabase.from('categorias').update({ activo: !cat.activo }).eq('id', cat.id)
    await fetch()
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta categoría?')) return
    await supabase.from('categorias').delete().eq('id', id)
    await fetch()
  }

  const ingresos = categorias.filter(c => c.tipo === 'ingreso')
  const gastos = categorias.filter(c => c.tipo === 'gasto')

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '1rem' }}>
      {/* Header */}
      <div style={{ background: '#2563eb', color: '#fff', padding: '1rem', borderRadius: '10px', marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1rem', fontWeight: 600 }}>Categorías</h1>
      </div>

      {/* Formulario nueva categoría */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Nombre de categoría" style={inputStyle} required
        />
        <select value={tipo} onChange={e => setTipo(e.target.value)} style={{
          padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
          borderRadius: '8px', fontSize: '0.9rem', background: '#fff',
        }}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <button type="submit" disabled={saving} style={{
          padding: '0.6rem 1.25rem', borderRadius: '8px',
          background: '#2563eb', color: '#fff', border: 'none',
          cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem',
        }}>
          {saving ? '...' : '+ Agregar'}
        </button>
      </form>

      {/* Lista por tipo */}
      {[{ label: 'Ingresos', items: ingresos, color: '#16a34a' }, { label: 'Gastos', items: gastos, color: '#dc2626' }].map(({ label, items, color }) => (
        <div key={label} style={{ marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            {label}
          </p>
          {items.length === 0 && (
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', padding: '0.5rem 0' }}>Sin categorías aún.</p>
          )}
          {items.map(cat => (
            <div key={cat.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff', borderRadius: '8px', padding: '0.65rem 0.875rem',
              marginBottom: '0.4rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              opacity: cat.activo ? 1 : 0.45,
            }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{cat.nombre}</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => toggleActivo(cat)} style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e5e7eb',
                  background: '#f9fafb', cursor: 'pointer', fontSize: '0.75rem', color: '#374151',
                }}>
                  {cat.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => handleDelete(cat.id)} style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #fee2e2',
                  background: '#fff', cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626',
                }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
