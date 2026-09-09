import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { useAnalisisIA } from '../hooks/useAnalisisIA'
import { IconSparkles, IconX } from './icons/NavIcons'

const now = new Date()
const CUR_YEAR = now.getFullYear()
const CUR_MONTH = now.getMonth() + 1

function mesLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}

// Últimos 12 meses para el selector
function ultimos12Meses() {
  const meses = []
  for (let i = 0; i < 12; i++) {
    let m = CUR_MONTH - i
    let y = CUR_YEAR
    if (m <= 0) { m += 12; y -= 1 }
    meses.push({ year: y, month: m, label: mesLabel(y, m) })
  }
  return meses
}

// Últimos 6 meses agregados por mes/moneda/categoría — nunca movimientos individuales,
// para mantener el payload del chat pequeño y no exponer texto libre (concepto/subcategoría).
async function fetchResumenMensual() {
  const hoy = new Date()
  const desde = new Date(hoy.getFullYear(), hoy.getMonth() - 5, 1)
  const { data } = await supabase
    .from('movimientos')
    .select('tipo, monto, moneda, fecha, categorias(nombre)')
    .is('deleted_at', null)
    .gte('fecha', desde.toISOString().split('T')[0])

  const porMes = {}
  ;(data || []).forEach(m => {
    const clave = m.fecha.slice(0, 7)
    if (!porMes[clave]) porMes[clave] = { mes: clave, ingresos: {}, gastos: {}, categorias: {} }
    const b = porMes[clave]
    if (m.tipo === 'ingreso') {
      b.ingresos[m.moneda] = (b.ingresos[m.moneda] || 0) + Number(m.monto)
    } else {
      b.gastos[m.moneda] = (b.gastos[m.moneda] || 0) + Number(m.monto)
      const catKey = `${m.categorias?.nombre || 'Sin categoría'}:${m.moneda}`
      b.categorias[catKey] = (b.categorias[catKey] || 0) + Number(m.monto)
    }
  })

  return Object.values(porMes)
    .map(b => ({
      mes: b.mes,
      ingresos: b.ingresos,
      gastos: b.gastos,
      gastoPorCategoria: Object.entries(b.categorias).map(([k, v]) => {
        const [categoria, moneda] = k.split(':')
        return { categoria, moneda, monto: Math.round(v * 100) / 100 }
      }),
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
}

export default function IAFloatingButton() {
  const perfil = usePerfil()
  const [open, setOpen] = useState(false)
  // 'seleccion' | 'mensual' | 'general' | 'chat'
  const [modo, setModo] = useState('seleccion')
  const [mesSelec, setMesSelec] = useState({ year: CUR_YEAR, month: CUR_MONTH })
  const [pregunta, setPregunta] = useState('')
  const [preguntaEnviada, setPreguntaEnviada] = useState(false)
  const { analisis, loading, error, analizar, preguntar, limpiar } = useAnalisisIA()

  if (perfil?.rol !== 'administradora') return null

  function abrirSheet() {
    setOpen(true)
    setModo('seleccion')
    setPregunta('')
    setPreguntaEnviada(false)
    limpiar()
  }

  function cerrarSheet() {
    setOpen(false)
    limpiar()
  }

  async function enviarPregunta(e) {
    e.preventDefault()
    if (!pregunta.trim()) return
    setPreguntaEnviada(true)
    const resumenMensual = await fetchResumenMensual()
    preguntar(pregunta.trim(), resumenMensual)
  }

  async function generarMensual(year, month) {
    setModo('mensual')
    limpiar()
    const desde = `${year}-${String(month).padStart(2, '0')}-01`
    const hasta = new Date(year, month, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('movimientos')
      .select('tipo, monto, moneda, fecha, categorias(nombre)')
      .is('deleted_at', null)
      .gte('fecha', desde)
      .lte('fecha', hasta)
    analizar(data || [], mesLabel(year, month))
  }

  async function generarGeneral() {
    setModo('general')
    limpiar()
    const { data } = await supabase
      .from('movimientos')
      .select('tipo, monto, moneda, fecha, categorias(nombre)')
      .is('deleted_at', null)
      .order('fecha', { ascending: false })
      .limit(150)
    analizar(data || [], `resumen general (últimos ${data?.length || 0} movimientos)`)
  }

  const meses = ultimos12Meses()

  return (
    <>
      {/* FAB */}
      <button
        onClick={abrirSheet}
        aria-label="Análisis IA"
        style={{
          position: 'fixed',
          bottom: 'calc(var(--bottomnav-h) + var(--space-4))',
          left: 'var(--space-4)',
          zIndex: 90,
          width: 52, height: 52,
          borderRadius: 'var(--radius-full)',
          background: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(124,58,237,0.40), 0 2px 8px rgba(124,58,237,0.22)',
          transition: 'transform 180ms ease-out',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <IconSparkles size={22} />
      </button>

      {/* Sheet */}
      {open && (
        <div className="ds-sheet-overlay" onClick={cerrarSheet} style={{ zIndex: 200 }}>
          <div
            className="ds-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Análisis financiero con IA"
            aria-modal="true"
            style={{ maxHeight: '85vh', overflowY: 'auto' }}
          >
            <div className="ds-sheet-handle" />

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <div>
                <h2 style={{ marginBottom: 'var(--space-1)' }}>Análisis con IA ✨</h2>
                {modo !== 'seleccion' && !loading && (
                  <button
                    onClick={() => { setModo('seleccion'); limpiar() }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', padding: 0 }}
                  >
                    ← Cambiar tipo
                  </button>
                )}
              </div>
              <button onClick={cerrarSheet} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} aria-label="Cerrar">
                <IconX size={20} />
              </button>
            </div>

            {/* ── SELECCIÓN ── */}
            {modo === 'seleccion' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                  ¿Qué deseas analizar?
                </p>

                {/* Opción: Resumen mensual */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)', color: 'var(--color-text-primary)' }}>
                    📅 Resumen mensual
                  </p>
                  <select
                    value={`${mesSelec.year}-${mesSelec.month}`}
                    onChange={e => {
                      const [y, m] = e.target.value.split('-').map(Number)
                      setMesSelec({ year: y, month: m })
                    }}
                    className="ds-input"
                    style={{ marginBottom: 'var(--space-3)', textTransform: 'capitalize' }}
                  >
                    {meses.map(({ year, month, label }) => (
                      <option key={`${year}-${month}`} value={`${year}-${month}`}>{label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => generarMensual(mesSelec.year, mesSelec.month)}
                    className="ds-btn ds-btn-primary"
                    style={{ width: '100%' }}
                  >
                    Analizar {mesLabel(mesSelec.year, mesSelec.month)}
                  </button>
                </div>

                {/* Opción: Resumen general */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                    📊 Resumen general
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                    Análisis de los últimos 150 movimientos registrados.
                  </p>
                  <button
                    onClick={generarGeneral}
                    className="ds-btn ds-btn-ghost"
                    style={{ width: '100%' }}
                  >
                    Analizar historial completo
                  </button>
                </div>

                {/* Opción: Chat */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)' }}>
                  <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)', color: 'var(--color-text-primary)' }}>
                    💬 Preguntar a tu asesora
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                    Ej: "¿cuánto gasté en comida este mes?" o "¿puedo permitirme una compra de RD$5,000?"
                  </p>
                  <button
                    onClick={() => setModo('chat')}
                    className="ds-btn ds-btn-ghost"
                    style={{ width: '100%' }}
                  >
                    Hacer una pregunta
                  </button>
                </div>
              </div>
            )}

            {/* ── CHAT: input ── */}
            {modo === 'chat' && !preguntaEnviada && (
              <form onSubmit={enviarPregunta} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <label htmlFor="pregunta-ia" className="ds-label">Tu pregunta</label>
                <textarea
                  id="pregunta-ia"
                  value={pregunta}
                  onChange={e => setPregunta(e.target.value)}
                  placeholder="¿Cuánto gasté en transporte los últimos 3 meses?"
                  className="ds-input"
                  rows={3}
                  autoFocus
                  style={{ resize: 'vertical' }}
                />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Se responde con base en un resumen de los últimos 6 meses, no con movimientos individuales.
                </p>
                <button type="submit" disabled={!pregunta.trim()} className="ds-btn ds-btn-primary" style={{ width: '100%' }}>
                  Preguntar
                </button>
              </form>
            )}

            {/* ── LOADING ── */}
            {(modo === 'mensual' || modo === 'general' || (modo === 'chat' && preguntaEnviada)) && loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '92%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '78%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '88%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '65%' }} />
                <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '82%' }} />
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-2)' }}>
                  Analizando tus finanzas…
                </p>
              </div>
            )}

            {/* ── ERROR ── */}
            {error && (
              <div role="alert" style={{
                background: 'var(--color-danger-light)', color: 'var(--color-danger)',
                borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                fontSize: 'var(--text-sm)', lineHeight: 1.5,
              }}>
                {error}
                <button
                  onClick={() => {
                    if (modo === 'general') generarGeneral()
                    else if (modo === 'chat') enviarPregunta({ preventDefault: () => {} })
                    else generarMensual(mesSelec.year, mesSelec.month)
                  }}
                  style={{ display: 'block', marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Reintentar
                </button>
              </div>
            )}

            {/* ── RESULTADO ── */}
            {analisis && !loading && (
              <>
                <div style={{
                  fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
                  lineHeight: 1.8, whiteSpace: 'pre-wrap',
                  marginBottom: 'var(--space-5)',
                }}>
                  {analisis}
                </div>
                <button
                  onClick={() => {
                    if (modo === 'chat') { setPregunta(''); setPreguntaEnviada(false); limpiar() }
                    else { setModo('seleccion'); limpiar() }
                  }}
                  className="ds-btn ds-btn-ghost"
                  style={{ width: '100%' }}
                >
                  {modo === 'chat' ? 'Nueva pregunta' : 'Nuevo análisis'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
