import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { IconWallet, IconPlus } from '../components/icons/NavIcons'

const emptyCXC = { nombre_persona: '', nota: '', moneda: 'DOP', monto_original: '', saldo_pendiente: '' }
const emptyAbono = { monto: '', moneda: 'DOP', fecha: new Date().toISOString().split('T')[0], cuenta_destino_id: '', categoria_id: '' }

export default function CuentasPorCobrar() {
  const perfil = usePerfil()
  const [cxc, setCxc] = useState([])
  const [cuentasBanco, setCuentasBanco] = useState([])
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCXCForm, setShowCXCForm] = useState(false)
  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [editCXC, setEditCXC] = useState(null)
  const [cxcParaAbonar, setCxcParaAbonar] = useState(null)
  const [formCXC, setFormCXC] = useState(emptyCXC)
  const [formAbono, setFormAbono] = useState(emptyAbono)
  const [saving, setSaving] = useState(false)
  const [abonoError, setAbonoError] = useState(null)

  const isAdmin = perfil?.rol === 'administradora'

  async function fetchCXC() {
    setLoading(true)
    const { data } = await supabase
      .from('cuentas_por_cobrar').select('*').eq('activo', true)
      .order('created_at', { ascending: false })
    setCxc(data || [])
    setLoading(false)
  }

  async function fetchCuentasBanco() {
    const { data } = await supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
    setCuentasBanco(data || [])
  }

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('id,nombre').eq('tipo', 'ingreso').eq('activo', true).order('nombre')
    setCategorias(data || [])
  }

  useEffect(() => { fetchCXC(); fetchCuentasBanco(); fetchCategorias() }, [])

  function openNuevaCXC() { setEditCXC(null); setFormCXC(emptyCXC); setShowCXCForm(true) }
  function openEditCXC(c) {
    setEditCXC(c)
    setFormCXC({
      nombre_persona: c.nombre_persona,
      nota: c.nota || '',
      moneda: c.moneda,
      monto_original: c.monto_original ?? '',
      saldo_pendiente: c.saldo_pendiente ?? '',
    })
    setShowCXCForm(true)
  }
  function openAbono(c) {
    setCxcParaAbonar(c)
    setFormAbono({ ...emptyAbono, moneda: c.moneda, fecha: new Date().toISOString().split('T')[0] })
    setAbonoError(null)
    setShowAbonoForm(true)
  }

  function setC(k, v) {
    setFormCXC(f => {
      const next = { ...f, [k]: v }
      if (k === 'monto_original' && !editCXC) next.saldo_pendiente = v
      return next
    })
  }
  const setA = (k, v) => setFormAbono(f => ({ ...f, [k]: v }))

  async function handleSubmitCXC(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre_persona: formCXC.nombre_persona.trim(),
      nota: formCXC.nota.trim() || null,
      moneda: formCXC.moneda,
      monto_original: formCXC.monto_original !== '' ? parseFloat(formCXC.monto_original) : null,
      saldo_pendiente: formCXC.saldo_pendiente !== '' ? parseFloat(formCXC.saldo_pendiente) : null,
      fecha_ultima_actualizacion: new Date().toISOString().split('T')[0],
      activo: true,
    }
    let error
    if (editCXC) {
      ({ error } = await supabase.from('cuentas_por_cobrar').update(payload).eq('id', editCXC.id))
    } else {
      ({ error } = await supabase.from('cuentas_por_cobrar').insert(payload))
    }
    setSaving(false)
    if (error) { alert('Error al guardar: ' + (error.message || JSON.stringify(error))); return }
    setShowCXCForm(false)
    await fetchCXC()
  }

  async function handleSubmitAbono(e) {
    e.preventDefault()
    if (!formAbono.categoria_id) {
      setAbonoError('Selecciona una categoría para el ingreso.')
      return
    }
    setAbonoError(null)
    setSaving(true)
    const monto = parseFloat(formAbono.monto)
    const nuevoSaldo = (cxcParaAbonar.saldo_pendiente || 0) - monto
    const results = await Promise.all([
      supabase.from('abonos_cxc').insert({
        cuenta_cobrar_id: cxcParaAbonar.id,
        monto,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        cuenta_destino_id: formAbono.cuenta_destino_id || null,
        categoria_id: formAbono.categoria_id || null,
        created_by: perfil?.id,
      }),
      supabase.from('cuentas_por_cobrar').update({
        saldo_pendiente: nuevoSaldo,
        fecha_ultima_actualizacion: formAbono.fecha,
        activo: nuevoSaldo > 0,
      }).eq('id', cxcParaAbonar.id),
      supabase.from('movimientos').insert({
        tipo: 'ingreso',
        monto,
        moneda: formAbono.moneda,
        fecha: formAbono.fecha,
        concepto: `Cobro · ${cxcParaAbonar.nombre_persona}`,
        categoria_id: formAbono.categoria_id || null,
        cuenta_id: formAbono.cuenta_destino_id || null,
        created_by: perfil?.id,
        recurrente: false,
      }),
    ])
    setSaving(false)
    const abonoErr = results.find(r => r.error)?.error
    if (abonoErr) { alert('Error al registrar el cobro: ' + (abonoErr.message || JSON.stringify(abonoErr))); return }
    setShowAbonoForm(false)
    await fetchCXC()
  }

  async function handleMarcarCobrada(c) {
    if (!confirm(`¿Marcar "${c.nombre_persona}" como cobrada?`)) return
    await supabase.from('cuentas_por_cobrar').update({ activo: false }).eq('id', c.id)
    await fetchCXC()
  }

  const totalPorMoneda = cxc.reduce((acc, c) => {
    if (c.saldo_pendiente) acc[c.moneda] = (acc[c.moneda] || 0) + Number(c.saldo_pendiente)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Cuentas por cobrar</h1>
          <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>{cxc.length} activas</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Resumen total */}
        {Object.keys(totalPorMoneda).length > 0 && (
          <div style={{
            background: 'var(--color-success-light)',
            border: '1px solid var(--color-success)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="ds-section-label" style={{ color: 'var(--color-success)', margin: 0 }}>Total por cobrar</span>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {Object.entries(totalPorMoneda).map(([moneda, total]) => (
                <span key={moneda} style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--text-base)' }}>
                  {Number(total).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {moneda}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-10)' }}>
            Cargando...
          </p>
        )}

        {!loading && cxc.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconWallet size={40} /></div>
            <p style={{ fontWeight: 500 }}>No hay cuentas por cobrar activas.</p>
            {isAdmin && <p>Toca + para registrar una.</p>}
          </div>
        )}

        {cxc.map(c => (
          <CXCCard
            key={c.id}
            cxc={c}
            isAdmin={isAdmin}
            onEdit={openEditCXC}
            onAbono={openAbono}
            onMarcarCobrada={handleMarcarCobrada}
          />
        ))}
      </div>

      {isAdmin && (
        <button onClick={openNuevaCXC} className="ds-fab" aria-label="Nueva cuenta por cobrar"><IconPlus size={24} /></button>
      )}

      {/* Modal cuenta por cobrar */}
      {showCXCForm && (
        <SheetModal onClose={() => setShowCXCForm(false)} title={editCXC ? 'Editar cuenta por cobrar' : 'Nueva cuenta por cobrar'}>
          <form onSubmit={handleSubmitCXC}>
            <div className="ds-field">
              <label htmlFor="cxc-nombre" className="ds-label">Nombre de la persona</label>
              <input id="cxc-nombre" type="text" value={formCXC.nombre_persona}
                onChange={e => setC('nombre_persona', e.target.value)}
                placeholder="Ej: Juan Pérez"
                required className="ds-input" />
            </div>

            <div className="ds-field">
              <label htmlFor="cxc-nota" className="ds-label">
                Nota / motivo <span className="ds-label-hint">(opcional)</span>
              </label>
              <textarea id="cxc-nota" value={formCXC.nota}
                onChange={e => setC('nota', e.target.value)}
                placeholder="Ej: Préstamo personal, venta a crédito"
                rows={2} className="ds-input" />
            </div>

            <div className="ds-field">
              <p className="ds-label" id="moneda-cxc-label">Moneda</p>
              <div role="group" aria-labelledby="moneda-cxc-label" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {['DOP', 'USD'].map(m => (
                  <button key={m} type="button" aria-pressed={formCXC.moneda === m}
                    onClick={() => setC('moneda', m)}
                    style={{
                      flex: 1, padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${formCXC.moneda === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: formCXC.moneda === m ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: formCXC.moneda === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer',
                    }}>{m}</button>
                ))}
              </div>
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="cxc-monto" className="ds-label">Monto original</label>
                <input id="cxc-monto" type="number" step="0.01" min="0"
                  value={formCXC.monto_original}
                  onChange={e => setC('monto_original', e.target.value)}
                  placeholder="0.00" required className="ds-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="cxc-saldo" className="ds-label">Saldo pendiente</label>
                <input id="cxc-saldo" type="number" step="0.01" min="0"
                  value={formCXC.saldo_pendiente}
                  onChange={e => setC('saldo_pendiente', e.target.value)}
                  placeholder="0.00" required className="ds-input" />
              </div>
            </div>

            <SheetBotones onCancel={() => setShowCXCForm(false)} saving={saving}
              label={editCXC ? 'Guardar cambios' : 'Registrar cuenta'} />
          </form>
        </SheetModal>
      )}

      {/* Modal abono */}
      {showAbonoForm && (
        <SheetModal onClose={() => setShowAbonoForm(false)} title="Registrar cobro" subtitle={cxcParaAbonar?.nombre_persona}>
          <form onSubmit={handleSubmitAbono}>
            {abonoError && (
              <div role="alert" style={{
                background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
                fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5,
              }}>
                {abonoError}
              </div>
            )}
            <div className="ds-field">
              <label htmlFor="abono-fecha" className="ds-label">Fecha</label>
              <input id="abono-fecha" type="date" value={formAbono.fecha}
                onChange={e => setA('fecha', e.target.value)} required className="ds-input" />
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 2 }}>
                <label htmlFor="abono-monto" className="ds-label">Monto cobrado</label>
                <input id="abono-monto" type="number" step="0.01" min="0.01"
                  value={formAbono.monto}
                  onChange={e => setA('monto', e.target.value)}
                  required placeholder="0.00" className="ds-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="abono-moneda" className="ds-label">Moneda</label>
                <select id="abono-moneda" value={formAbono.moneda}
                  onChange={e => setA('moneda', e.target.value)} className="ds-input">
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div className="ds-field">
              <label htmlFor="abono-cuenta" className="ds-label">
                Cuenta destino <span className="ds-label-hint">(opcional)</span>
              </label>
              <select id="abono-cuenta" value={formAbono.cuenta_destino_id}
                onChange={e => setA('cuenta_destino_id', e.target.value)} className="ds-input">
                <option value="">Sin especificar</option>
                {cuentasBanco.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="ds-field">
              <label htmlFor="abono-cat" className="ds-label">Categoría del ingreso</label>
              <select id="abono-cat" value={formAbono.categoria_id}
                onChange={e => setA('categoria_id', e.target.value)} className="ds-input" required>
                <option value="">Seleccionar categoría…</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>

            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
              Se registrará automáticamente un ingreso en Movimientos.
            </p>

            <SheetBotones onCancel={() => setShowAbonoForm(false)} saving={saving} label="Registrar cobro" />
          </form>
        </SheetModal>
      )}
    </div>
  )
}

function CXCCard({ cxc: c, isAdmin, onEdit, onAbono, onMarcarCobrada }) {
  const saldo   = Number(c.saldo_pendiente || 0)
  const original = Number(c.monto_original || 0)
  const pct     = original > 0 ? Math.min(((original - saldo) / original) * 100, 100) : null

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{c.nombre_persona}</p>
          {c.nota && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {c.nota}
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: 'var(--text-lg)', fontVariantNumeric: 'tabular-nums' }}>
            {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {c.moneda}
          </p>
          {original > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              de {original.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {c.moneda}
            </p>
          )}
        </div>
      </div>

      {pct !== null && (
        <div
          className="ds-progress-track"
          style={{ marginBottom: 'var(--space-3)' }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${Math.round(pct)}% cobrado`}
        >
          <div className="ds-progress-fill" style={{ width: `${pct}%`, background: 'var(--color-success)' }} />
        </div>
      )}

      {c.fecha_ultima_actualizacion && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Actualizado: {new Date(c.fecha_ultima_actualizacion + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={() => onAbono(c)} className="ds-btn ds-btn-sm" style={{
          flex: 2, background: 'var(--color-success-light)',
          border: '1px solid var(--color-success)',
          color: 'var(--color-success)', fontWeight: 600,
        }}>+ Cobro</button>
        {isAdmin && (
          <>
            <button onClick={() => onEdit(c)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ flex: 1 }}>Editar</button>
            <button onClick={() => onMarcarCobrada(c)} className="ds-btn ds-btn-danger ds-btn-sm" style={{ flex: 1 }}>Cobrada</button>
          </>
        )}
      </div>
    </div>
  )
}

function SheetModal({ children, onClose, title, subtitle }) {
  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div
        className="ds-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label={title}
        aria-modal="true"
      >
        <div className="ds-sheet-handle" />
        <h2 style={{ marginBottom: subtitle ? 'var(--space-1)' : 'var(--space-5)' }}>{title}</h2>
        {subtitle && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-5)' }}>
            {subtitle}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

function SheetBotones({ onCancel, saving, label }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
      <button type="button" onClick={onCancel} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
        {saving ? 'Guardando...' : label}
      </button>
    </div>
  )
}
