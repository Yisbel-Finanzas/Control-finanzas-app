import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}
function fmtCompact(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0 })
}

const CHART_COLORS = ['#6FAE8A', '#D96B6B']

export default function Dashboard() {
  const perfil = usePerfil()
  const [balance, setBalance] = useState({ ingresos: {}, gastos: {} })
  const [deudaTotal, setDeudaTotal] = useState({})
  const [recientes, setRecientes] = useState([])
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
    ]).then(([{ data: movs }, { data: deudas }, { data: rec }]) => {
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
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, month])

  const mesLabel = now.toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
  const monedas = [...new Set([...Object.keys(balance.ingresos), ...Object.keys(balance.gastos)])].sort()
  const hayDeudas = Object.keys(deudaTotal).length > 0

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      {/* Header */}
      <div className="ds-page-header" style={{ position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${import.meta.env.BASE_URL}img/yisbel-portrait.png)`,
          backgroundSize: '220%',
          backgroundPosition: 'center 22%',
          opacity: 0.11,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1>Inicio</h1>
          {perfil?.nombre && (
            <p style={{ fontSize: 'var(--text-sm)', opacity: 0.82, marginTop: 'var(--space-1)', textTransform: 'capitalize' }}>
              Hola, {perfil.nombre}
            </p>
          )}
        </div>
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
