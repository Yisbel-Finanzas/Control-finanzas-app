import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'

const inputStyle = {
  width: '100%', padding: '0.6rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '0.95rem', background: '#fff',
  boxSizing: 'border-box',
}
const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 500, color: '#374151', marginBottom: '0.3rem' }
const fieldStyle = { marginBottom: '1rem' }

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
      .from('deudas')
      .select('*')
      .eq('activo', true)
      .order('created_at', { ascending: false })
    setDeudas(data || [])
    setLoading(false)
  }

  async function fetchCuentas() {
    const { data } = await supabase
      .from('cuentas')
      .select('id,banco,producto')
      .eq('activo', true)
    setCuentas(data || [])
  }

  useEffect(() => { fetchDeudas(); fetchCuentas() }, [])

  function openNuevaDeuda() {
    setEditDeuda(null)
    setFormDeuda(emptyDeuda)
    setShowDeudaForm(true)
  }

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

    // Actualizar saldo_actual de la deuda manualmente
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
    if (d.saldo_actual) {
      acc[d.moneda] = (acc[d.moneda] || 0) + Number(d.saldo_actual)
    }
    return acc
  }, {})

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#2563eb', color: '#fff', padding: '1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Deudas</h1>
          <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>{deudas.length} activas</span>
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {/* Resumen totales */}
        {Object.keys(totalPorMoneda).length > 0 && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b', textTransform: 'uppercase' }}>Total pendiente</span>
            <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
              {Object.entries(totalPorMoneda).map(([moneda, total]) => (
                <span key={moneda} style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.95rem' }}>
                  {Number(total).toLocaleString('es-DO', { minimumFractionDigits: 2 })} {moneda}
                </span>
              ))}
            </div>
          </div>
        )}

        {loading && <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>Cargando...</p>}

        {!loading && deudas.length === 0 && (
          <div style={{ textAlign: 'center', color: '#6b7280', padding: '3rem 1rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</p>
            <p>No hay deudas activas.</p>
            {isAdmin && <p style={{ fontSize: '0.875rem' }}>Toca + para registrar una.</p>}
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

      {/* FAB */}
      {isAdmin && (
        <button onClick={openNuevaDeuda} style={{
          position: 'fixed', bottom: '76px', right: '1.25rem',
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#2563eb', color: '#fff', border: 'none',
          fontSize: '1.5rem', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50,
        }}>+</button>
      )}

      {/* Modal deuda */}
      {showDeudaForm && (
        <Modal onClose={() => setShowDeudaForm(false)}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            {editDeuda ? 'Editar deuda' : 'Nueva deuda'}
          </h2>
          <form onSubmit={handleSubmitDeuda}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Nombre / Descripción</label>
              <input type="text" value={formDeuda.nombre} onChange={e => setD('nombre', e.target.value)}
                placeholder="Ej: Banco Popular TC, Préstamo BanReservas" required style={inputStyle} />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Moneda</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['DOP', 'USD'].map(m => (
                  <button key={m} type="button" onClick={() => setD('moneda', m)} style={{
                    flex: 1, padding: '0.6rem', borderRadius: '8px', border: '2px solid',
                    borderColor: formDeuda.moneda === m ? '#2563eb' : '#e5e7eb',
                    background: formDeuda.moneda === m ? '#eff6ff' : '#fff',
                    color: formDeuda.moneda === m ? '#2563eb' : '#6b7280',
                    fontWeight: 600, cursor: 'pointer',
                  }}>{m}</button>
                ))}
              </div>
            </div>

            <div style={{ ...fieldStyle, display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Monto original / Límite</label>
                <input type="number" step="0.01" min="0" value={formDeuda.limite_o_monto_original}
                  onChange={e => setD('limite_o_monto_original', e.target.value)}
                  placeholder="0.00" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Saldo actual</label>
                <input type="number" step="0.01" min="0" value={formDeuda.saldo_actual}
                  onChange={e => setD('saldo_actual', e.target.value)}
                  placeholder="0.00" style={inputStyle} />
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Tasa de interés % (opcional)</label>
              <input type="number" step="0.01" min="0" value={formDeuda.tasa_interes}
                onChange={e => setD('tasa_interes', e.target.value)}
                placeholder="Ej: 36.00" style={inputStyle} />
            </div>

            <FormBotones onCancel={() => setShowDeudaForm(false)} saving={saving}
              label={editDeuda ? 'Guardar cambios' : 'Registrar deuda'} />
          </form>
        </Modal>
      )}

      {/* Modal abono */}
      {showAbonoForm && (
        <Modal onClose={() => setShowAbonoForm(false)}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.25rem' }}>Registrar abono</h2>
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.25rem' }}>{deudaParaAbonar?.nombre}</p>
          <form onSubmit={handleSubmitAbono}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Fecha</label>
              <input type="date" value={formAbono.fecha} onChange={e => setA('fecha', e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ ...fieldStyle, display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 2 }}>
                <label style={labelStyle}>Monto abonado</label>
                <input type="number" step="0.01" min="0.01" value={formAbono.monto}
                  onChange={e => setA('monto', e.target.value)} required placeholder="0.00" style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Moneda</label>
                <select value={formAbono.moneda} onChange={e => setA('moneda', e.target.value)} style={inputStyle}>
                  <option value="DOP">DOP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Cuenta de origen (opcional)</label>
              <select value={formAbono.cuenta_origen_id} onChange={e => setA('cuenta_origen_id', e.target.value)} style={inputStyle}>
                <option value="">Sin especificar</option>
                {cuentas.map(c => <option key={c.id} value={c.id}>{c.banco}{c.producto !== c.banco ? ` · ${c.producto}` : ''}</option>)}
              </select>
            </div>

            <FormBotones onCancel={() => setShowAbonoForm(false)} saving={saving} label="Registrar abono" />
          </form>
        </Modal>
      )}
    </div>
  )
}

function DeudaCard({ deuda: d, isAdmin, onEdit, onAbono, onDesactivar }) {
  const saldo = Number(d.saldo_actual || 0)
  const limite = Number(d.limite_o_monto_original || 0)
  const pct = limite > 0 ? Math.min((saldo / limite) * 100, 100) : null

  return (
    <div style={{ background: '#fff', borderRadius: '10px', padding: '0.9rem 1rem', marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{d.nombre}</p>
          {d.tasa_interes && (
            <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{d.tasa_interes}% interés anual</p>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 700, color: '#dc2626', fontSize: '1rem' }}>
            {saldo.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {d.moneda}
          </p>
          {limite > 0 && (
            <p style={{ fontSize: '0.72rem', color: '#6b7280' }}>
              de {limite.toLocaleString('es-DO', { minimumFractionDigits: 2 })} {d.moneda}
            </p>
          )}
        </div>
      </div>

      {/* Barra de progreso */}
      {pct !== null && (
        <div style={{ background: '#f3f4f6', borderRadius: '4px', height: '6px', marginBottom: '0.75rem' }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: '4px',
            background: pct > 75 ? '#dc2626' : pct > 40 ? '#f59e0b' : '#16a34a',
          }} />
        </div>
      )}

      {d.fecha_ultima_actualizacion && (
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
          Actualizado: {new Date(d.fecha_ultima_actualizacion + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button onClick={() => onAbono(d)} style={{
          flex: 2, padding: '0.45rem', borderRadius: '7px',
          background: '#eff6ff', border: '1px solid #bfdbfe',
          color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
        }}>+ Abono</button>
        {isAdmin && (
          <>
            <button onClick={() => onEdit(d)} style={{
              flex: 1, padding: '0.45rem', borderRadius: '7px',
              background: '#f9fafb', border: '1px solid #e5e7eb',
              color: '#374151', cursor: 'pointer', fontSize: '0.8rem',
            }}>Editar</button>
            <button onClick={() => onDesactivar(d)} style={{
              flex: 1, padding: '0.45rem', borderRadius: '7px',
              background: '#fff', border: '1px solid #fee2e2',
              color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem',
            }}>Saldar</button>
          </>
        )}
      </div>
    </div>
  )
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', width: '100%', maxHeight: '90vh', borderRadius: '16px 16px 0 0', overflow: 'auto', padding: '1.25rem 1rem 2rem' }}>
        <div style={{ width: '40px', height: '4px', background: '#e5e7eb', borderRadius: '2px', margin: '0 auto 1.25rem' }} />
        {children}
      </div>
    </div>
  )
}

function FormBotones({ onCancel, saving, label }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
      <button type="button" onClick={onCancel} style={{
        flex: 1, padding: '0.75rem', borderRadius: '8px',
        border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 500,
      }}>Cancelar</button>
      <button type="submit" disabled={saving} style={{
        flex: 2, padding: '0.75rem', borderRadius: '8px',
        border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontWeight: 600,
        opacity: saving ? 0.7 : 1,
      }}>{saving ? 'Guardando...' : label}</button>
    </div>
  )
}
