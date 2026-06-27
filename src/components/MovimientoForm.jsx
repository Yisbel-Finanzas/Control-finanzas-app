import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.95rem', background: '#fff',
  boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }
const fieldStyle = { marginBottom: '1rem' }

export default function MovimientoForm({ item, perfil, onSave, onClose }) {
  const [categorias, setCategorias] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    fecha: item?.fecha || new Date().toISOString().split('T')[0],
    tipo: item?.tipo || 'gasto',
    categoria_id: item?.categoria_id || '',
    subcategoria: item?.subcategoria || '',
    concepto: item?.concepto || '',
    monto: item?.monto || '',
    moneda: item?.moneda || 'DOP',
    cuenta_id: item?.cuenta_id || '',
    recurrente: item?.recurrente || false,
    centro: item?.centro || '',
  })

  useEffect(() => {
    supabase.from('categorias').select('id,nombre,tipo').eq('activo', true).then(({ data }) => setCategorias(data || []))
    supabase.from('cuentas').select('id,banco,producto').eq('activo', true).then(({ data }) => setCuentas(data || []))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const categoriasFiltered = categorias.filter(c => c.tipo === form.tipo || c.tipo === 'ambos')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = {
      ...form,
      monto: parseFloat(form.monto),
      created_by: perfil?.id,
    }
    let error
    if (item) {
      ({ error } = await supabase.from('movimientos').update(payload).eq('id', item.id))
    } else {
      ({ error } = await supabase.from('movimientos').insert(payload))
    }
    setLoading(false)
    if (!error) onSave()
    else alert('Error: ' + error.message)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', width: '100%', maxHeight: '90vh',
        borderRadius: '16px 16px 0 0', overflow: 'auto',
        padding: '1.25rem 1rem 2rem',
      }}>
        {/* Handle */}
        <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />

        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
          {item ? 'Editar movimiento' : 'Nuevo movimiento'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Tipo */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Tipo</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {['gasto', 'ingreso'].map(t => (
                <button key={t} type="button" onClick={() => set('tipo', t)} style={{
                  flex: 1, padding: '0.6rem', borderRadius: '8px', border: '2px solid',
                  borderColor: form.tipo === t ? (t === 'ingreso' ? '#16a34a' : '#dc2626') : '#e5e7eb',
                  background: form.tipo === t ? (t === 'ingreso' ? '#f0fdf4' : '#fef2f2') : '#fff',
                  color: form.tipo === t ? (t === 'ingreso' ? '#16a34a' : '#dc2626') : '#6b7280',
                  fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                }}>
                  {t === 'ingreso' ? 'Ingreso' : 'Gasto'}
                </button>
              ))}
            </div>
          </div>

          {/* Fecha */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} required style={inputStyle} />
          </div>

          {/* Monto y Moneda */}
          <div style={{ ...fieldStyle, display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Monto</label>
              <input type="number" step="0.01" min="0" value={form.monto}
                onChange={e => set('monto', e.target.value)} required style={inputStyle} placeholder="0.00" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Moneda</label>
              <select value={form.moneda} onChange={e => set('moneda', e.target.value)} style={inputStyle}>
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Categoría</label>
            <select value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} style={inputStyle}>
              <option value="">Seleccionar...</option>
              {categoriasFiltered.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>

          {/* Subcategoría */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Subcategoría <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
            <input type="text" value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}
              style={inputStyle} placeholder="Detalle dentro de la categoría · Ej: Laboratorio, Gasolina" />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>Úsala para clasificar más fino dentro de la categoría seleccionada.</p>
          </div>

          {/* Concepto */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Concepto <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
            <input type="text" value={form.concepto} onChange={e => set('concepto', e.target.value)}
              style={inputStyle} placeholder="¿Qué fue? · Ej: Pago nómina enero, Compra medicamentos" />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>Descripción breve del movimiento. Aparece como título en la lista.</p>
          </div>

          {/* Cuenta */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Cuenta</label>
            <select value={form.cuenta_id} onChange={e => set('cuenta_id', e.target.value)} style={inputStyle} required>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}</option>)}
            </select>
          </div>

          {/* Nota */}
          <div style={fieldStyle}>
            <label style={labelStyle}>Nota <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span></label>
            <input type="text" value={form.centro} onChange={e => set('centro', e.target.value)}
              style={inputStyle} placeholder="Cualquier aclaración adicional" />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.25rem' }}>Información extra que no encaja en los campos anteriores.</p>
          </div>

          {/* Recurrente */}
          <div style={{ ...fieldStyle, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" id="recurrente" checked={form.recurrente}
              onChange={e => set('recurrente', e.target.checked)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            <label htmlFor="recurrente" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>Movimiento recurrente</label>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px',
              border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500,
            }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{
              flex: 2, padding: '0.75rem', borderRadius: '8px',
              border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}>
              {loading ? 'Guardando...' : item ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
