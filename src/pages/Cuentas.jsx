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

const PRODUCTO_ICONS = {
  'Efectivo':          '💵',
  'Cuenta corriente':  '🏦',
  'Cuenta de ahorro':  '🏦',
  'Tarjeta de crédito': '💳',
  'Tarjeta de débito': '💳',
}

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
    const { data } = await supabase.from('cuentas').select('*').order('producto')
    setCuentas(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCuentas() }, [])

  function openNew()  { setEditItem(null); setForm(emptyForm); setShowForm(true) }
  function openEdit(c) { setEditItem(c); setForm({ banco: c.banco || '', producto: c.producto || 'Cuenta corriente' }); setShowForm(true) }
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

  const activas   = cuentas.filter(c => c.activo)
  const inactivas = cuentas.filter(c => !c.activo)

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Cuentas</h1>
          <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>{cuentas.length} registradas</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-10)' }}>
            Cargando...
          </p>
        )}

        {!loading && activas.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <p className="ds-section-label">Activas</p>
            {activas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {!loading && inactivas.length > 0 && (
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <p className="ds-section-label">Inactivas</p>
            {inactivas.map(c => (
              <CuentaCard key={c.id} c={c} isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActivo} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {!loading && cuentas.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon">🏦</div>
            <p style={{ fontWeight: 500 }}>No hay cuentas registradas.</p>
            {isAdmin && <p>Toca + para agregar la primera.</p>}
          </div>
        )}
      </div>

      {isAdmin && (
        <button onClick={openNew} className="ds-fab" aria-label="Nueva cuenta">+</button>
      )}

      {showForm && (
        <div className="ds-sheet-overlay" onClick={closeForm}>
          <div
            className="ds-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label={editItem ? 'Editar cuenta' : 'Nueva cuenta'}
            aria-modal="true"
          >
            <div className="ds-sheet-handle" />
            <h2>{editItem ? 'Editar cuenta' : 'Nueva cuenta'}</h2>

            <form onSubmit={handleSubmit}>
              <div className="ds-field">
                <label htmlFor="banco" className="ds-label">Banco / Institución</label>
                <input
                  id="banco"
                  type="text"
                  value={form.banco}
                  onChange={e => set('banco', e.target.value)}
                  placeholder="Ej: Banco Popular, Efectivo"
                  required
                  className="ds-input"
                />
              </div>

              <div className="ds-field">
                <label htmlFor="producto" className="ds-label">Producto</label>
                <select id="producto" value={form.producto} onChange={e => set('producto', e.target.value)} className="ds-input">
                  {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button type="button" onClick={closeForm} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
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
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem', flexShrink: 0,
        }}>
          {PRODUCTO_ICONS[c.producto] || '🏦'}
        </div>
        <div>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{c.banco}</p>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{c.producto}</p>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <button onClick={() => onEdit(c)} className="ds-btn ds-btn-ghost ds-btn-sm">Editar</button>
          <button onClick={() => onToggle(c)} className="ds-btn ds-btn-ghost ds-btn-sm">
            {c.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button onClick={() => onDelete(c)} className="ds-btn ds-btn-danger ds-btn-sm" aria-label={`Eliminar ${c.banco}`}>✕</button>
        </div>
      )}
    </div>
  )
}
