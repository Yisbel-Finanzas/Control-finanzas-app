import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { useAnalisisIA } from '../hooks/useAnalisisIA'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { IconGoal, IconRepeat } from '../components/icons/NavIcons'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}
function saludo(nombre) {
  const primer = (nombre || '').split(' ')[0]
  const h = new Date().getHours()
  if (h < 12) return `Buenos días, ${primer}`
  if (h < 19) return `Buenas tardes, ${primer}`
  return `Buenas noches, ${primer}`
}

function fmtCompact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0 })
}

const CHART_COLORS = ['#6FAE8A', '#D96B6B']

export default function Dashboard() {
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [balance, setBalance] = useState({ ingresos: {}, gastos: {} })
  const [deudaTotal, setDeudaTotal] = useState({})
  const [recientes, setRecientes] = useState([])
  const [metas, setMetas] = useState([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  useEffect(() => {
    const desde = `${year}-${String(month).padStart(2, '0')}-01`
    const hasta = new Date(year, month, 0).toISOString().split('T')[0]

    Promise.all([
      supabase
        .from('movimientos')
        .select('tipo, monto, moneda')
        .is('deleted_at', null)
        .gte('fecha', desde)
        .lte('fecha', hasta),
      supabase
        .from('deudas')
        .select('saldo_actual, moneda')
        .eq('activo', true),
      supabase
        .from('movimientos')
        .select('tipo, monto, moneda, concepto, subcategoria, fecha, categorias(nombre)')
        .is('deleted_at', null)
        .order('fecha', { ascending: false })
        .limit(5),
      supabase
        .from('metas_ahorro')
        .select('id, nombre, monto_objetivo, monto_actual, moneda, fecha_objetivo')
        .eq('activo', true)
        .order('created_at', { ascending: false })
        .limit(3),
    ]).then(([{ data: movs }, { data: deudas }, { data: rec }, { data: mts }]) => {
      const bal = { ingresos: {}, gastos: {} }
      ;(movs || []).forEach(m => {
        const b = m.tipo === 'ingreso' ? bal.ingresos : bal.gastos
        b[m.moneda] = (b[m.moneda] || 0) + Number(m.monto)
      })
      setBalance(bal)

      const dt = {}
      ;(deudas || []).forEach(d => {
        if (d.saldo_actual) dt[d.moneda] = (dt[d.moneda] || 0) + Number(d.saldo_actual)
      })
      setDeudaTotal(dt)
      setRecientes(rec || [])
      setMetas((mts || []).filter(m => Number(m.monto_actual) < Number(m.monto_objetivo)))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, month])

  const mesLabel = now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
  const monedas = [...new Set([...Object.keys(balance.ingresos), ...Object.keys(balance.gastos)])].sort()
  const hayDeudas = Object.keys(deudaTotal).length > 0

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      {/* Header */}
      <div className="ds-page-header">
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.60)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 'var(--space-1)' }}>
          Inicio
        </p>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, letterSpacing: '-0.01em' }}>
          {perfil?.nombre ? saludo(perfil.nombre) : 'Bienvenida'}
        </h1>
        <p style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)', marginTop: 'var(--space-1)' }}>
          Tus finanzas, siempre bajo control
        </p>
      </div>

      <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-6)' }}>
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <p className="ds-section-label" style={{ textTransform: 'capitalize', marginBottom: 'var(--space-4)' }}>
              {mesLabel}
            </p>

            {monedas.length === 0 ? (
              <div className="ds-card" style={{ padding: 'var(--space-8)', textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Sin movimientos este mes.
                </p>
              </div>
            ) : (
              monedas.map(mon => {
                const ing = balance.ingresos[mon] || 0
                const gas = balance.gastos[mon] || 0
                const bal = ing - gas
                const pieData = [
                  { name: 'Ingresos', value: ing },
                  { name: 'Gastos', value: gas },
                ]
                return (
                  <div key={mon} className="ds-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
                    <p className="ds-section-label">Balance {mon}</p>

                    {/* Donut chart + balance central */}
                    {(ing > 0 || gas > 0) && (
                      <div style={{ position: 'relative', height: 160, marginBottom: 'var(--space-4)' }}>
                        <ResponsiveContainer width="100%" height={160}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              innerRadius={46} outerRadius={64}
                              dataKey="value"
                              startAngle={90} endAngle={-270}
                              stroke="none"
                            >
                              {pieData.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v, name) => [fmt(v, mon), name]}
                              contentStyle={{
                                fontSize: '12px',
                                borderRadius: '10px',
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text-primary)',
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Centro del donut */}
                        <div style={{
                          position: 'absolute', top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          textAlign: 'center', pointerEvents: 'none',
                        }}>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
                            Balance
                          </p>
                          <p style={{
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                            color: bal >= 0 ? 'var(--color-primary-hover)' : 'var(--color-danger)',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {fmtCompact(Math.abs(bal))}
                          </p>
                          <p style={{ fontSize: '9px', color: 'var(--color-text-muted)', marginTop: '1px' }}>{mon}</p>
                        </div>
                      </div>
                    )}

                    {/* Ingresos / Gastos */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                      <div style={{
                        background: 'var(--color-success-light)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                      }}>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                          Ingresos
                        </p>
                        <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(ing, mon)}
                        </p>
                      </div>
                      <div style={{
                        background: 'var(--color-danger-light)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
                      }}>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>
                          Gastos
                        </p>
                        <p style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(gas, mon)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}

            {/* Deudas pendientes */}
            {hayDeudas && (
              <div className="ds-card" style={{
                padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
                borderLeft: '3px solid var(--color-danger)',
              }}>
                <p className="ds-section-label">Deudas pendientes</p>
                <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', marginTop: 'var(--space-2)' }}>
                  {Object.entries(deudaTotal).map(([moneda, total]) => (
                    <p key={moneda} style={{
                      fontWeight: 700, fontSize: 'var(--text-lg)',
                      color: 'var(--color-danger)', fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmt(total, moneda)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Gasto inusual detectado */}
            <AnomaliaWidget />

            {/* Dinero disponible real */}
            <DisponibleRealWidget year={year} month={month} />

            {/* Pagos recurrentes pendientes */}
            <RecurrentesWidget navigate={navigate} year={year} month={month} />

            {/* Presupuesto del mes */}
            <BudgetWidget navigate={navigate} />

            {/* Metas de ahorro */}
            {metas.length > 0 && (
              <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                  <p className="ds-section-label" style={{ margin: 0 }}>Metas de ahorro</p>
                  <button
                    onClick={() => navigate('/metas')}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Ver todas →
                  </button>
                </div>
                {metas.map(m => {
                  const pct = Math.min(100, Math.round((Number(m.monto_actual) / Number(m.monto_objetivo)) * 100))
                  return (
                    <div key={m.id} style={{ marginBottom: 'var(--space-3)', cursor: 'pointer' }} onClick={() => navigate('/metas')} role="button" tabIndex={0}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>{m.nombre}</span>
                        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                      </div>
                      <div className="ds-progress-track">
                        <div className="ds-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                        {fmt(m.monto_actual, m.moneda)} de {fmt(m.monto_objetivo, m.moneda)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Movimientos recientes */}
            {recientes.length > 0 && (
              <div className="ds-card" style={{ overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
                <div style={{ padding: 'var(--space-4) var(--space-4) var(--space-2)' }}>
                  <p className="ds-section-label">Movimientos recientes</p>
                </div>
                {recientes.map((m, i) => {
                  const esIngreso = m.tipo === 'ingreso'
                  const label = m.concepto || m.subcategoria || m.categorias?.nombre || '—'
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center',
                      padding: 'var(--space-3) var(--space-4)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--radius-full)', flexShrink: 0,
                        background: esIngreso ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '14px', marginRight: 'var(--space-3)',
                      }}>
                        <span style={{ color: esIngreso ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 700 }}>
                          {esIngreso ? '+' : '−'}
                        </span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          fontSize: 'var(--text-sm)', fontWeight: 500,
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        }}>
                          {label}
                        </p>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                          {m.fecha} · {m.categorias?.nombre || m.tipo}
                        </p>
                      </div>
                      <p style={{
                        fontSize: 'var(--text-sm)', fontWeight: 700, flexShrink: 0, marginLeft: 'var(--space-2)',
                        color: esIngreso ? 'var(--color-success)' : 'var(--color-danger)',
                        fontVariantNumeric: 'tabular-nums',
                      }}>
                        {fmt(m.monto, m.moneda)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Clave de identidad de un gasto recurrente: mismo texto (concepto o, en su defecto, subcategoría)
// dentro de la misma categoría. Sin texto identificable, se descarta (demasiado ambiguo).
function claveRecurrente(m) {
  const texto = (m.concepto || m.subcategoria || '').trim().toLowerCase()
  if (!texto) return null
  return `${m.categoria_id}|${texto}`
}

function RecurrentesWidget({ navigate, year, month }) {
  const [pendientes, setPendientes] = useState(null) // null=loading, []=nada pendiente

  useEffect(() => {
    const prevYear = month === 1 ? year - 1 : year
    const prevMonth = month === 1 ? 12 : month - 1
    const desdePrev = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
    const hastaPrev = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]
    const desdeCur = `${year}-${String(month).padStart(2, '0')}-01`
    const hastaCur = new Date(year, month, 0).toISOString().split('T')[0]

    const campos = 'categoria_id, concepto, subcategoria, monto, moneda, tipo, cuenta_id, categorias(nombre)'
    Promise.all([
      supabase.from('movimientos').select(campos)
        .eq('recurrente', true).eq('tipo', 'gasto').is('deleted_at', null)
        .gte('fecha', desdePrev).lte('fecha', hastaPrev),
      supabase.from('movimientos').select('categoria_id, concepto, subcategoria')
        .eq('recurrente', true).eq('tipo', 'gasto').is('deleted_at', null)
        .gte('fecha', desdeCur).lte('fecha', hastaCur),
    ]).then(([{ data: prev }, { data: cur }]) => {
      const clavesEsteMonth = new Set((cur || []).map(claveRecurrente).filter(Boolean))
      const vistos = new Set()
      const lista = []
      for (const m of prev || []) {
        const clave = claveRecurrente(m)
        if (!clave || vistos.has(clave) || clavesEsteMonth.has(clave)) continue
        vistos.add(clave)
        lista.push(m)
      }
      setPendientes(lista)
    })
  }, [year, month])

  if (!pendientes || pendientes.length === 0) return null

  function registrarAhora(m) {
    navigate('/movimientos', {
      state: {
        prefill: {
          tipo: m.tipo,
          categoria_id: m.categoria_id,
          subcategoria: m.subcategoria,
          concepto: m.concepto,
          monto: m.monto,
          moneda: m.moneda,
          cuenta_id: m.cuenta_id,
          recurrente: true,
          fecha: new Date().toISOString().split('T')[0],
        },
      },
    })
  }

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-warning)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        <IconRepeat size={16} aria-hidden="true" />
        <p className="ds-section-label" style={{ margin: 0 }}>Pagos recurrentes pendientes</p>
      </div>
      {pendientes.map((m, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-2) 0', borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
        }}>
          <div style={{ minWidth: 0, marginRight: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {m.concepto || m.subcategoria}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {m.categorias?.nombre} · {fmt(m.monto, m.moneda)}
            </p>
          </div>
          <button onClick={() => registrarAhora(m)} className="ds-btn ds-btn-sm" style={{
            flexShrink: 0,
            background: 'var(--color-primary-light)',
            border: '1px solid var(--color-primary-muted)',
            color: 'var(--color-primary)', fontWeight: 600,
          }}>Registrar</button>
        </div>
      ))}
    </div>
  )
}

// "Disponible para gastar libremente" = ingresos del mes − gastos ya registrados − lo que
// aún está reservado (sin gastar) dentro de los límites de presupuesto activos. No resta
// pagos futuros de deudas/metas que todavía no se han registrado — es una aproximación
// basada solo en compromisos de presupuesto, no en todo el flujo de caja proyectado.
// Detecta categorías cuyo gasto de este mes supera 1.5x el promedio de los últimos 3 meses
// (cálculo 100% local, sin IA). La explicación en lenguaje natural es opcional y se pide a
// Groq solo si la usuaria toca "Explicar" — payload mínimo, solo los 3 números ya agregados.
function AnomaliaWidget() {
  const perfil = usePerfil()
  const [anomalias, setAnomalias] = useState(null) // null=loading, []=nada que mostrar

  useEffect(() => {
    if (perfil?.rol !== 'administradora') { setAnomalias([]); return }
    const hoy = new Date()
    const desdeHistorico = new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1)
    supabase.from('movimientos').select('categoria_id, monto, moneda, fecha, categorias(nombre)')
      .eq('tipo', 'gasto').is('deleted_at', null)
      .gte('fecha', desdeHistorico.toISOString().split('T')[0])
      .then(({ data }) => {
        const porCategoria = {} // key catId:moneda -> { actual, previos:[m1,m2,m3], nombre }
        ;(data || []).forEach(m => {
          const fechaM = new Date(m.fecha + 'T12:00:00')
          const mesesAtras = (hoy.getFullYear() - fechaM.getFullYear()) * 12 + (hoy.getMonth() - fechaM.getMonth())
          if (mesesAtras < 0 || mesesAtras > 3) return
          const key = `${m.categoria_id}:${m.moneda}`
          if (!porCategoria[key]) porCategoria[key] = { actual: 0, previos: [0, 0, 0], nombre: m.categorias?.nombre || 'Sin categoría', moneda: m.moneda }
          if (mesesAtras === 0) porCategoria[key].actual += Number(m.monto)
          else porCategoria[key].previos[mesesAtras - 1] += Number(m.monto)
        })

        const lista = []
        Object.values(porCategoria).forEach(v => {
          const promedio = v.previos.reduce((a, b) => a + b, 0) / 3
          if (promedio <= 0) return
          const diferencia = v.actual - promedio
          if (v.actual > promedio * 1.5 && diferencia > 300) {
            lista.push({
              categoria: v.nombre, moneda: v.moneda,
              montoActual: Math.round(v.actual * 100) / 100,
              promedioHistorico: Math.round(promedio * 100) / 100,
            })
          }
        })
        setAnomalias(lista)
      })
  }, [perfil])

  if (!anomalias || anomalias.length === 0) return null

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)', borderLeft: '3px solid var(--color-warning)' }}>
      <p className="ds-section-label">Gasto inusual este mes</p>
      {anomalias.map((a, i) => (
        <AnomaliaCard key={`${a.categoria}:${a.moneda}`} anomalia={a} primero={i === 0} />
      ))}
    </div>
  )
}

function AnomaliaCard({ anomalia, primero }) {
  const { analisis, loading, error, explicarAnomalia } = useAnalisisIA()
  return (
    <div style={{ padding: 'var(--space-3) 0', borderTop: primero ? 'none' : '1px solid var(--color-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {anomalia.categoria}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-warning)', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
          {fmt(anomalia.montoActual, anomalia.moneda)}
        </span>
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
        Promedio habitual: {fmt(anomalia.promedioHistorico, anomalia.moneda)}
      </p>
      {!analisis && !loading && (
        <button
          onClick={() => explicarAnomalia(anomalia)}
          className="ds-btn ds-btn-ghost ds-btn-sm"
          style={{ marginTop: 'var(--space-2)', color: 'var(--color-primary)' }}
        >
          ✨ Explicar con IA
        </button>
      )}
      {loading && (
        <div className="ds-skeleton" style={{ height: 12, borderRadius: 6, width: '80%', marginTop: 'var(--space-2)' }} />
      )}
      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', marginTop: 'var(--space-2)' }}>{error}</p>
      )}
      {analisis && !loading && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5, marginTop: 'var(--space-2)' }}>
          {analisis}
        </p>
      )}
    </div>
  )
}

function DisponibleRealWidget({ year, month }) {
  const [porMoneda, setPorMoneda] = useState(null) // null=loading, []=nada que mostrar

  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'presupuesto_activo').maybeSingle()
      .then(({ data: cfg }) => {
        if (cfg?.valor !== 'true') { setPorMoneda([]); return }
        const desde = `${year}-${String(month).padStart(2, '0')}-01`
        const hasta = new Date(year, month, 0).toISOString().split('T')[0]
        Promise.all([
          supabase.from('movimientos').select('tipo, categoria_id, monto, moneda')
            .is('deleted_at', null).gte('fecha', desde).lte('fecha', hasta),
          supabase.from('presupuestos').select('categoria_id, monto_limite, moneda'),
        ]).then(([{ data: movs }, { data: presp }]) => {
          if (!presp?.length) { setPorMoneda([]); return }
          const ingresos = {}, gastosPorCategoria = {}
          ;(movs || []).forEach(m => {
            if (m.tipo === 'ingreso') {
              ingresos[m.moneda] = (ingresos[m.moneda] || 0) + Number(m.monto)
            } else {
              const k = `${m.categoria_id}:${m.moneda}`
              gastosPorCategoria[k] = (gastosPorCategoria[k] || 0) + Number(m.monto)
            }
          })
          const reservadoSinGastar = {}
          presp.forEach(p => {
            const gastado = gastosPorCategoria[`${p.categoria_id}:${p.moneda}`] || 0
            const restante = Math.max(0, Number(p.monto_limite) - gastado)
            reservadoSinGastar[p.moneda] = (reservadoSinGastar[p.moneda] || 0) + restante
          })
          const monedas = [...new Set([...Object.keys(ingresos), ...Object.keys(reservadoSinGastar)])]
          const list = monedas
            .map(mon => ({ moneda: mon, disponible: (ingresos[mon] || 0) - (reservadoSinGastar[mon] || 0) }))
            .filter(x => (reservadoSinGastar[x.moneda] || 0) > 0)
          setPorMoneda(list)
        })
      })
  }, [year, month])

  if (!porMoneda || porMoneda.length === 0) return null

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <p className="ds-section-label">Dinero disponible real</p>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
        Ingresos del mes, menos lo que ya está reservado (sin gastar) en tus límites de presupuesto.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
        {porMoneda.map(({ moneda, disponible }) => (
          <p key={moneda} style={{
            fontWeight: 700, fontSize: 'var(--text-lg)', fontVariantNumeric: 'tabular-nums',
            color: disponible < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
          }}>
            {disponible < 0 ? '−' : ''}{fmt(Math.abs(disponible), moneda)}
          </p>
        ))}
      </div>
    </div>
  )
}

function BudgetWidget({ navigate }) {
  const [items, setItems] = useState(null) // null=loading, []=inactive or no budgets

  useEffect(() => {
    supabase.from('configuracion').select('valor').eq('clave', 'presupuesto_activo').maybeSingle()
      .then(({ data: cfg }) => {
        if (cfg?.valor !== 'true') { setItems([]); return }
        const now = new Date()
        const desde = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const hasta = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
        const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
        const desdePrev = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
        const hastaPrev = new Date(prevYear, prevMonth, 0).toISOString().split('T')[0]
        Promise.all([
          supabase.from('presupuestos').select('*, categorias(nombre)'),
          supabase.from('movimientos').select('categoria_id, monto, moneda')
            .eq('tipo', 'gasto').is('deleted_at', null).gte('fecha', desde).lte('fecha', hasta),
          supabase.from('movimientos').select('categoria_id, monto, moneda')
            .eq('tipo', 'gasto').is('deleted_at', null).gte('fecha', desdePrev).lte('fecha', hastaPrev),
        ]).then(([{ data: presp }, { data: movs }, { data: movsPrev }]) => {
          if (!presp?.length) { setItems([]); return }
          const gastos = {}
          ;(movs || []).forEach(m => {
            const k = `${m.categoria_id}:${m.moneda}`
            gastos[k] = (gastos[k] || 0) + Number(m.monto)
          })
          const gastosPrev = {}
          ;(movsPrev || []).forEach(m => {
            const k = `${m.categoria_id}:${m.moneda}`
            gastosPrev[k] = (gastosPrev[k] || 0) + Number(m.monto)
          })
          const list = presp.map(p => {
            const gastado = gastos[`${p.categoria_id}:${p.moneda}`] || 0
            const gastadoPrev = gastosPrev[`${p.categoria_id}:${p.moneda}`] || 0
            const rollover = p.rollover_activo ? Math.max(0, Number(p.monto_limite) - gastadoPrev) : 0
            const limiteEfectivo = Number(p.monto_limite) + rollover
            return { ...p, gastado, limiteEfectivo, disponible: limiteEfectivo - gastado }
          }).sort((a, b) => (b.gastado / b.limiteEfectivo) - (a.gastado / a.limiteEfectivo))
          setItems(list.slice(0, 4))
        })
      })
  }, [])

  if (!items || items.length === 0) return null

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <p className="ds-section-label" style={{ margin: 0 }}>Presupuesto del mes</p>
        <button onClick={() => navigate('/config/presupuesto')}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
          Ver todo →
        </button>
      </div>
      {items.map(p => {
        const pct = Math.min(100, Math.round((p.gastado / p.limiteEfectivo) * 100))
        const excedido = p.gastado > p.limiteEfectivo
        const advertencia = !excedido && pct >= 80
        return (
          <div key={p.id} style={{ marginBottom: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {p.categorias?.nombre}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {excedido && <span className="ds-badge ds-badge-danger">Excedido</span>}
                {advertencia && <span className="ds-badge ds-badge-warning">Alerta</span>}
                <span style={{ fontSize: 'var(--text-xs)', fontVariantNumeric: 'tabular-nums',
                  color: excedido ? 'var(--color-danger)' : advertencia ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                  {pct}%
                </span>
              </div>
            </div>
            <div className="ds-progress-track" style={{ marginBottom: 'var(--space-1)' }}>
              <div className="ds-progress-fill" style={{
                width: `${pct}%`,
                background: excedido ? 'var(--color-danger)' : advertencia ? 'var(--color-warning)' : 'var(--color-primary)',
              }} />
            </div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: p.disponible < 0 ? 'var(--color-danger)' : 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
              {p.disponible < 0 ? '−' : ''}{fmt(Math.abs(p.disponible), p.moneda)} disponible
            </p>
          </div>
        )
      })}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      <div className="ds-skeleton" style={{ height: 10, width: 100, marginBottom: 'var(--space-4)' }} />
      <div className="ds-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-4)' }}>
        <div className="ds-skeleton" style={{ height: 10, width: 70, marginBottom: 'var(--space-4)' }} />
        <div className="ds-skeleton" style={{ height: 160, borderRadius: 'var(--radius-full)', width: 160, margin: '0 auto var(--space-4)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div className="ds-skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
          <div className="ds-skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
        </div>
      </div>
      <div className="ds-card" style={{ padding: 'var(--space-4)' }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderTop: i > 1 ? '1px solid var(--color-border)' : 'none' }}>
            <div className="ds-skeleton" style={{ width: 36, height: 36, borderRadius: 'var(--radius-full)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="ds-skeleton" style={{ height: 10, width: '60%', marginBottom: 'var(--space-2)' }} />
              <div className="ds-skeleton" style={{ height: 8, width: '40%' }} />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
