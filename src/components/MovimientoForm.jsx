import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MovimientoForm({ item, perfil, onSave, onClose }) {
  const [categorias, setCategorias] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState(null)
  const [form, setForm] = useState({
    fecha:       item?.fecha       || new Date().toISOString().split('T')[0],
    tipo:        item?.tipo        || 'gasto',
    categoria_id: item?.categoria_id || '',
    subcategoria: item?.subcategoria || '',
    concepto:    item?.concepto    || '',
    monto:       item?.monto       || '',
    moneda:      item?.moneda      || 'DOP',
    cuenta_id:   item?.cuenta_id   || '',
    recurrente:  item?.recurrente  || false,
    centro:      item?.centro      || '',
  })

  useEffect(() => {
    supabase.from('categorias').select('id,nombre,tipo').eq('activo', true)
      .then(({ data }) => setCategorias(data || []))
    supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
      .then(({ data }) => setCuentas(data || []))
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const categoriasFiltered = categorias.filter(c => c.tipo === form.tipo || c.tipo === 'ambos')

  async function handleSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!form.cuenta_id) { setFormError('Selecciona una cuenta antes de continuar.'); return }
    setLoading(true)
    const payload = {
      ...form,
      monto:    parseFloat(form.monto),
      cuenta_id: form.cuenta_id || null,
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
    else setFormError(error.message)
  }

  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div
        className="ds-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={item ? 'Editar movimiento' : 'Nuevo movimiento'}
        aria-modal="true"
      >
        <div className="ds-sheet-handle" />
        <h2>{item ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>

        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <div role="alert" style={{
              background: 'var(--color-danger-light)', color: 'var(--color-danger)',
              border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3) var(--space-4)',
              fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)',
            }}>
              {formError}
            </div>
          )}
          {/* Tipo */}
          <div className="ds-field">
            <p className="ds-label" id="tipo-label">Tipo</p>
            <div role="group" aria-labelledby="tipo-label" style={{ display: 'flex', gap: 'var(--space-2)' }}>
              {[
                { value: 'gasto',   label: 'Gasto',   color: 'var(--color-danger)'  },
                { value: 'ingreso', label: 'Ingreso', color: 'var(--color-success)' },
              ].map(({ value, label, color }) => {
                const active = form.tipo === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('tipo', value)}
                    aria-pressed={active}
                    style={{
                      flex: 1, padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${active ? color : 'var(--color-border)'}`,
                      background: active ? (value === 'ingreso' ? 'var(--color-success-light)' : 'var(--color-danger-light)') : 'var(--color-surface)',
                      color: active ? color : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer',
                      transition: 'border-color var(--transition), background var(--transition), color var(--transition)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fecha */}
          <div className="ds-field">
            <label htmlFor="fecha" className="ds-label">Fecha</label>
            <input
              id="fecha"
              type="date"
              value={form.fecha}
              onChange={e => set('fecha', e.target.value)}
              required
              className="ds-input"
            />
          </div>

          {/* Monto + Moneda */}
          <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
            <div style={{ flex: 2 }}>
              <label htmlFor="monto" className="ds-label">Monto</label>
              <input
                id="monto"
                type="number"
                step="0.01"
                min="0"
                value={form.monto}
                onChange={e => set('monto', e.target.value)}
                required
                placeholder="0.00"
                className="ds-input"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="moneda" className="ds-label">Moneda</label>
              <select id="moneda" value={form.moneda} onChange={e => set('moneda', e.target.value)} className="ds-input">
                <option value="DOP">DOP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>

          {/* Categoría */}
          <div className="ds-field">
            <label htmlFor="categoria" className="ds-label">Categoría</label>
            <select id="categoria" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)} className="ds-input">
              <option value="">Seleccionar...</option>
              {categoriasFiltered.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          {/* Subcategoría */}
          <div className="ds-field">
            <label htmlFor="subcategoria" className="ds-label">
              Subcategoría <span className="ds-label-hint">(opcional)</span>
            </label>
            <input
              id="subcategoria"
              type="text"
              value={form.subcategoria}
              onChange={e => set('subcategoria', e.target.value)}
              placeholder="Ej: Laboratorio, Gasolina"
              className="ds-input"
            />
            <p className="ds-field-hint">Clasifica más fino dentro de la categoría.</p>
          </div>

          {/* Concepto */}
          <div className="ds-field">
            <label htmlFor="concepto" className="ds-label">
              Concepto <span className="ds-label-hint">(opcional)</span>
            </label>
            <input
              id="concepto"
              type="text"
              value={form.concepto}
              onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Pago nómina enero"
              className="ds-input"
            />
            <p className="ds-field-hint">Descripción breve que aparece como título en la lista.</p>
          </div>

          {/* Cuenta */}
          <div className="ds-field">
            <label htmlFor="cuenta" className="ds-label">Cuenta</label>
            <select id="cuenta" value={form.cuenta_id} onChange={e => set('cuenta_id', e.target.value)} className="ds-input" required>
              <option value="">Seleccionar cuenta...</option>
              {cuentas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Nota */}
          <div className="ds-field">
            <label htmlFor="nota" className="ds-label">
              Nota <span className="ds-label-hint">(opcional)</span>
            </label>
            <input
              id="nota"
              type="text"
              value={form.centro}
              onChange={e => set('centro', e.target.value)}
              placeholder="Cualquier aclaración adicional"
              className="ds-input"
            />
          </div>

          {/* Recurrente */}
          <div className="ds-field" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <input
              type="checkbox"
              id="recurrente"
              checked={form.recurrente}
              onChange={e => set('recurrente', e.target.checked)}
              style={{ width: 18, height: 18, cursor: 'pointer', accentColor: 'var(--color-primary)' }}
            />
            <label htmlFor="recurrente" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer', color: 'var(--color-text-primary)' }}>
              Movimiento recurrente
            </label>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
            <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
              {loading ? 'Guardando...' : item ? 'Guardar cambios' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
