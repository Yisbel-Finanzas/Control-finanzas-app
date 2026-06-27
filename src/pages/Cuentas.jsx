import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'

const PRODUCTOS = [
  'Efectivo',
  'Cuenta corriente',
  'Cuenta de ahorro',
  'Tarjeta de crédito',
  'Tarjeta de débito',
]

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.95rem', background: '#fff',
  boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }
const fieldStyle = { marginBottom: '1rem' }

const emptyForm = { banco: '', producto: 'Cuenta corriente' }

export default function Cuentas() {
  const perfil = usePerfil()
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const isAdmin = perfil?.rol === 'administradora'

  async function fetchCuentas() {
    setLoading(true)
    const { data } = await supabase
      .from('cuentas')
      .select('*')
      .order('moneda')
      .order('producto')
    setCuentas(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCuentas() }, [])

  function openNew() {
    setEditItem(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  function openEdit(c) {
    setEditItem(c)
    setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente' })
    setShowForm(true)
  }

  function closeForm() { setShowForm(false); setEditItem(null) }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.banco.trim()) return
    setSaving(true)

    const payload = { banco: form.banco.trim(), producto: form.producto }

    if (editItem) {
      await supabase.from('cuentas').update(payload).eq('id', editItem.id)
    } else {
      await supabase.from('cuentas').insert({ ...payload, activo: true })
    }

    setSaving(false)
    closeForm()
    await fetchCuentas()
  }

  async function toggleActivo(c) {
    await supabase.from('cuentas').update({ activo: !c.activo }).eq('id', c.id)
    await fetchCuentas()
  }

  async function handleDelete(c) {
    if (!confirm(`¿Eliminar "${c.banco} · ${c.producto}"?`)) return
    await supabase.from('cuentas').delete().eq('id', c.id)
    await fetchCuentas()
  }

  const activas = cuentas.filter(c => c.activo)
  const inactivas = cuentas.filter(c => !c.activo)

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#2563eb', color: '#fff', padding: '1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Cuentas</h1>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{cuentas.length} registradas</span>
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {loading && <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Cargando...</p>}

        {/* Activas */}
        {!loading && activas.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Activas
            </p>
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {/* Inactivas */}
        {!loading && inactivas.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Inactivas
            </p>
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {!loading && cuentas.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</p>
            <p>No hay cuentas registradas.</p>
            {isAdmin && <p style={{ fontSize: '0.875rem' }}>Toca + para agregar la primera.</p>}
          </div>
        )}
      </div>

      {/* FAB solo admin */}
      {isAdmin && (
        <button onClick={openNew} style={{
          position: 'fixed', bottom: '76px', right: '1.25rem',
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#2563eb', color: '#fff', border: 'none',
          fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 50,
        }}>+</button>
      )}

      {/* Modal formulario */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'flex-end',
        }} onClick={closeForm}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', width: '100%', maxHeight: '90vh',
            borderRadius: '16px 16px 0 0', overflow: 'auto',
            padding: '1.25rem 1rem 2rem',
          }}>
            <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
              {editItem ? 'Editar cuenta' : 'Nueva cuenta'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={fieldStyle}>
                <label style={labelStyle}>Banco / Institución</label>
                <input
                  type="text"
                  value={form.banco}
                  onChange={e => set('banco', e.target.value)}
                  placeholder="Ej: Banco Popular, Efectivo"
                  required
                  style={inputStyle}
                />
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle}>Producto</label>
                <select value={form.producto} onChange={e => set('producto', e.target.value)} style={inputStyle}>
                  {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={closeForm} style={{
                  flex: 1, padding: '0.75rem', borderRadius: '8px',
                  border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500,
                }}>Cancelar</button>
                <button type="submit" disabled={saving} style={{
                  flex: 2, padding: '0.75rem', borderRadius: '8px',
                  border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600,
                  opacity: saving ? 0.7 : 1,
                }}>
                  {saving ? 'Guardando...' : editItem ? 'Guardar cambios' : 'Agregar cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function CuentaCard({ c, isAdmin, onEdit, onToggle, onDelete }) {
  const iconos = {
    'Efectivo': '💵',
    'Cuenta corriente': '🏦',
    'Cuenta de ahorro': '🏦',
    'Tarjeta de crédito': '💳',
    'Tarjeta de débito': '💳',
  }

  return (
    <div style={{
      background: '#fff', borderRadius: '10px', padding: '0.85rem 1rem',
      marginBottom: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      opacity: c.activo ? 1 : 0.5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{iconos[c.producto] || '🏦'}</span>
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.15rem' }}>{c.banco}</p>
          <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.producto}</p>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={() => onEdit(c)} style={{
            padding: '0.3rem 0.6rem', borderRadius: '6px',
            border: '1px solid #e5e7eb', background: '#f9fafb',
            cursor: 'pointer', fontSize: '0.75rem', color: '#374151',
          }}>Editar</button>
          <button onClick={() => onToggle(c)} style={{
            padding: '0.3rem 0.6rem', borderRadius: '6px',
            border: '1px solid #e5e7eb', background: '#f9fafb',
            cursor: 'pointer', fontSize: '0.75rem', color: '#374151',
          }}>{c.activo ? 'Desactivar' : 'Activar'}</button>
          <button onClick={() => onDelete(c)} style={{
            padding: '0.3rem 0.6rem', borderRadius: '6px',
            border: '1px solid #fee2e2', background: '#fff',
            cursor: 'pointer', fontSize: '0.75rem', color: '#dc2626',
          }}>✕</button>
        </div>
      )}
    </div>
  )
}
