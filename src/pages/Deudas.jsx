import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { IconList, IconPlus } from '../components/icons/NavIcons'

const emptyDeuda = { nombre: '', moneda: 'DOP', saldo_actual: '', limite_o_monto_original: '', tasa_interes: '' }
const emptyAbono = { monto: '', moneda: 'DOP', fecha: new Date().toISOString().split('T')[0], cuenta_origen_id: '' }

export default function Deudas() {
  const perfil = usePerfil()
  const [deudas, setDeudas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [showDeudaForm, setShowDeudaForm] = useState(false)
  const [showAbonoForm, setShowAbonoForm] = useState(false)
  const [editDeuda, setEditDeuda] = useState(null)
  const [deudaParaAbonar, setDeudaParaAbonar] = useState(null)
  const [formDeuda, setFormDeuda] = useState(emptyDeuda)
  const [formAbono, setFormAbono] = useState(emptyAbono)
  const [saving, setSaving] = useState(false)

  const isAdmin = perfil?.rol === 'administradora'

  async function fetchDeudas() {
    setLoading(true)
    const { data } = await supabase
      .from('deudas').select('*').eq('activo', true)
      .order('created_at', { ascending: false })
    setDeudas(data || [])
    setLoading(false)
  }

  async function fetchCuentas() {
    const { data } = await supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
    setCuentas(data || [])
  }

  useEffect(() => { fetchDeudas(); fetchCuentas() }, [])

  function openNuevaDeuda() { setEditDeuda(null); setFormDeuda(emptyDeuda); setShowDeudaForm(true) }
  function openEditDeuda(d) {
    setEditDeuda(d)
    setFormDeuda({
      nombre: d.nombre,
      moneda: d.moneda,
      saldo_actual: d.saldo_actual ?? '',
      limite_o_monto_original: d.limite_o_monto_original ?? '',
      tasa_interes: d.tasa_interes ?? '',
    })
    setShowDeudaForm(true)
  }
  function openAbono(d) {
    setDeudaParaAbonar(d)
    setFormAbono({ ...emptyAbono, moneda: d.moneda, fecha: new Date().toISOString().split('T')[0] })
    setShowAbonoForm(true)
  }

  const setD = (k, v) => setFormDeuda(f => ({ ...f, [k]: v }))
  const setA = (k, v) => setFormAbono(f => ({ ...f, [k]: v }))

  async function handleSubmitDeuda(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      nombre: formDeuda.nombre.trim(),
      moneda: formDeuda.moneda,
      tipo: 'por_pagar',
      saldo_actual: formDeuda.saldo_actual !== '' ? parseFloat(formDeuda.saldo_actual) : null,
      limite_o_monto_original: formDeuda.limite_o_monto_original !== '' ? parseFloat(formDeuda.limite_o_monto_original) : null,
      tasa_interes: formDeuda.tasa_interes !== '' ? parseFloat(formDeuda.tasa_interes) : null,
      fecha_ultima_actualizacion: new Date().toISOString().split('T')[0],
      activo: true,
    }
    if (editDeuda) {
      await supabase.from('deudas').update(payload).eq('id', editDeuda.id)
    } else {
      await supabase.from('deudas').insert(payload)
    }
    setSaving(false)
    setShowDeudaForm(false)
    await fetchDeudas()
  }

  async function handleSubmitAbono(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      deuda_id: deudaParaAbonar.id,
      monto: parseFloat(formAbono.monto),
      moneda: formAbono.moneda,
      fecha: formAbono.fecha,
      cuenta_origen_id: formAbono.cuenta_origen_id || null,
      created_by: perfil?.id,
    }
    await supabase.from('abonos_deuda').insert(payload)
    const nuevoSaldo = (deudaParaAbonar.saldo_actual || 0) - parseFloat(formAbono.monto)
    await supabase.from('deudas').update({
      saldo_actual: nuevoSaldo,
      fecha_ultima_actualizacion: formAbono.fecha,
    }).eq('id', deudaParaAbonar.id)
    setSaving(false)
    setShowAbonoForm(false)
    await fetchDeudas()
  }

  async function handleDesactivar(d) {
    if (!confirm(`¿Marcar "${d.nombre}" como saldada/inactiva?`)) return
    await supabase.from('deudas').update({ activo: false }).eq('id', d.id)
    await fetchDeudas()
  }

  const totalPorMoneda = deudas.reduce((acc, d) => {
    if (d.saldo_actual) acc[d.moneda] = (acc[d.moneda] || 0) + Number(d.saldo_actual)
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Deudas</h1>
          <span style={{ fontSize: 'var(--text-sm)', opacity: 0.85 }}>{deudas.length} activas</span>
        </div>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {/* Resumen total */}
        {Object.keys(totalPorMoneda).length > 0 && (
          <div style={{
            background: 'var(--color-danger-light)',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            marginBottom: 'var(--space-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span className="ds-section-label" style={{ color: '#991b1b', margin: 0 }}>Total pendiente</span>
            <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
              {Object.entries(totalPorMoneda).map(([moneda, total]) => (
                <span key={moneda} style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--text-base)' }}>
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

        {!loading && deudas.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconList size={40} /></div>
            <p style={{ fontWeight: 500 }}>No hay deudas activas.</p>
            {isAdmin && <p>Toca + para registrar una.</p>}
          </div>
        )}

        {deudas.map(d => (
          <DeudaCard
            key={d.id}
            deuda={d}
            isAdmin={isAdmin}
            onEdit={openEditDeuda}
            onAbono={openAbono}
            onDesactivar={handleDesactivar}
          />
        ))}
      </div>

      {isAdmin && (
        <button onClick={openNuevaDeuda} className="ds-fab" aria-label="Nueva deuda"><IconPlus size={24} /></button>
      )}

      {/* Modal deuda */}
      {showDeudaForm && (
        <SheetModal onClose={() => setShowDeudaForm(false)} title={editDeuda ? 'Editar deuda' : 'Nueva deuda'}>
          <form onSubmit={handleSubmitDeuda}>
            <div className="ds-field">
              <label htmlFor="deuda-nombre" className="ds-label">Nombre / Descripción</label>
              <input id="deuda-nombre" type="text" value={formDeuda.nombre}
                onChange={e => setD('nombre', e.target.value)}
                placeholder="Ej: Banco Popular TC, Préstamo BanReservas"
                required className="ds-input" />
            </div>

            <div className="ds-field">
              <p className="ds-label" id="moneda-deuda-label">Moneda</p>
              <div role="group" aria-labelledby="moneda-deuda-label" style={{ display: 'flex', gap: 'var(--space-2)' }}>
                {['DOP', 'USD'].map(m => (
                  <button key={m} type="button" aria-pressed={formDeuda.moneda === m}
                    onClick={() => setD('moneda', m)}
                    style={{
                      flex: 1, padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${formDeuda.moneda === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: formDeuda.moneda === m ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      color: formDeuda.moneda === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontWeight: 600, cursor: 'pointer',
                    }}>{m}</button>
                ))}
              </div>
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="deuda-limite" className="ds-label">Monto original / Límite</label>
                <input id="deuda-limite" type="number" step="0.01" min="0"
                  value={formDeuda.limite_o_monto_original}
                  onChange={e => setD('limite_o_monto_original', e.target.value)}
                  placeholder="0.00" className="ds-input" />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="deuda-saldo" className="ds-label">Saldo actual</label>
                <input id="deuda-saldo" type="number" step="0.01" min="0"
                  value={formDeuda.saldo_actual}
                  onChange={e => setD('saldo_actual', e.target.value)}
                  placeholder="0.00" className="ds-input" />
              </div>
            </div>

            <div className="ds-field">
              <label htmlFor="deuda-tasa" className="ds-label">
                Tasa de interés % <span className="ds-label-hint">(opcional)</span>
              </label>
              <input id="deuda-tasa" type="number" step="0.01" min="0"
                value={formDeuda.tasa_interes}
                onChange={e => setD('tasa_interes', e.target.value)}
                placeholder="Ej: 36.00" className="ds-input" />
            </div>

            <SheetBotones onCancel={() => setShowDeudaForm(false)} saving={saving}
              label={editDeuda ? 'Guardar cambios' : 'Registrar deuda'} />
          </form>
        </SheetModal>
      )}

      {/* Modal abono */}
      {showAbonoForm && (
        <SheetModal onClose={() => setShowAbonoForm(false)} title="Registrar abono" subtitle={deudaParaAbonar?.nombre}>
          <form onSubmit={handleSubmitAbono}>
            <div className="ds-field">
              <label htmlFor="abono-fecha" className="ds-label">Fecha</label>
              <input id="abono-fecha" type="date" value={formAbono.fecha}
                onChange={e => setA('fecha', e.target.value)} required className="ds-input" />
            </div>

            <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <div style={{ flex: 2 }}>
                <label htmlFor="abono-monto" className="ds-label">Monto abonado</label>
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
                Cuenta de origen <span className="ds-label-hint">(opcional)</span>
              </label>
              <select id="abono-cuenta" value={formAbono.cuenta_origen_id}
                onChange={e => setA('cuenta_origen_id', e.target.value)} className="ds-input">
                <option value="">Sin especificar</option>
                {cuentas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <SheetBotones onCancel={() => setShowAbonoForm(false)} saving={saving} label="Registrar abono" />
          </form>
        </SheetModal>
      )}
    </div>
  )
}

function DeudaCard({ deuda: d, isAdmin, onEdit, onAbono, onDesactivar }) {
  const saldo  = Number(d.saldo_actual || 0)
  const limite = Number(d.limite_o_monto_original || 0)
  const pct    = limite > 0 ? Math.min((saldo / limite) * 100, 100) : null
  const barColor = pct > 75 ? 'var(--color-danger)' : pct > 40 ? 'var(--color-warning)' : 'var(--color-success)'

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>{d.nombre}</p>
          {d.tasa_interes && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              {d.tasa_interes}% interés anual
            </p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 700, color: 'var(--color-danger)', fontSize: 'var(--text-lg)' }}>
            {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {d.moneda}
          </p>
          {limite > 0 && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              de {limite.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {d.moneda}
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
          aria-label={`${Math.round(pct)}% del límite utilizado`}
        >
          <div className="ds-progress-fill" style={{ width: `${pct}%`, background: barColor }} />
        </div>
      )}

      {d.fecha_ultima_actualizacion && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
          Actualizado: {new Date(d.fecha_ultima_actualizacion + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button onClick={() => onAbono(d)} className="ds-btn ds-btn-sm" style={{
          flex: 2, background: 'var(--color-primary-light)',
          border: '1px solid var(--color-primary-muted)',
          color: 'var(--color-primary)', fontWeight: 600,
        }}>+ Abono</button>
        {isAdmin && (
          <>
            <button onClick={() => onEdit(d)} className="ds-btn ds-btn-ghost ds-btn-sm" style={{ flex: 1 }}>Editar</button>
            <button onClick={() => onDesactivar(d)} className="ds-btn ds-btn-danger ds-btn-sm" style={{ flex: 1 }}>Saldar</button>
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
