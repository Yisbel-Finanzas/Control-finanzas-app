import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { IconChart, IconCalendar } from '../components/icons/NavIcons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import AnalisisIA from '../components/AnalisisIA'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}
function fmtShort(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 0 })
}
function mesLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleDateString('es-DO', { month: 'long', year: 'numeric' })
}
function mesCorto(month) {
  return ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][month - 1]
}

function calcTotales(movs) {
  const t = { ingresos: {}, gastos: {} }
  movs.forEach(m => {
    const b = m.tipo === 'ingreso' ? t.ingresos : t.gastos
    b[m.moneda] = (b[m.moneda] || 0) + Number(m.monto)
  })
  return t
}

function calcCategorias(movs) {
  const cat = {}
  movs.forEach(m => {
    const nombre = m.categorias?.nombre || 'Sin categoría'
    if (!cat[nombre]) cat[nombre] = { ingreso: {}, gasto: {} }
    const b = cat[nombre][m.tipo]
    b[m.moneda] = (b[m.moneda] || 0) + Number(m.monto)
  })
  return cat
}

async function fetchMes(year, month) {
  const desde = `${year}-${String(month).padStart(2, '0')}-01`
  const hasta = new Date(year, month, 0).toISOString().split('T')[0]
  const { data } = await supabase
    .from('movimientos')
    .select('tipo, monto, moneda, categorias(nombre)')
    .is('deleted_at', null)
    .gte('fecha', desde)
    .lte('fecha', hasta)
  return data || []
}

export default function Resumen() {
  const perfil = usePerfil()
  const isAdmin = perfil?.rol === 'administradora'
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab] = useState('mes')
  const [movs, setMovs] = useState([])
  const [movsPrev, setMovsPrev] = useState([])
  const [movsAnio, setMovsAnio] = useState([])
  const [loading, setLoading] = useState(true)

  const prevYear = month === 1 ? year - 1 : year
  const prevMonth = month === 1 ? 12 : month - 1
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchMes(year, month),
      fetchMes(prevYear, prevMonth),
    ]).then(([cur, prev]) => {
      setMovs(cur)
      setMovsPrev(prev)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [year, month])

  useEffect(() => {
    const desde = `${year}-01-01`
    const hasta = `${year}-12-31`
    supabase
      .from('movimientos')
      .select('tipo, monto, moneda, fecha')
      .is('deleted_at', null)
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .then(({ data }) => setMovsAnio(data || []))
  }, [year])

  function prevMes() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  function nextMes() {
    if (isCurrentMonth) return
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const totales = calcTotales(movs)
  const totalesPrev = calcTotales(movsPrev)
  const porCategoria = calcCategorias(movs)
  const monedas = [...new Set(movs.map(m => m.moneda))].sort()
  const hayDatos = movs.length > 0

  const gastosCat = Object.entries(porCategoria)
    .map(([nombre, v]) => {
      const totalDOP = v.gasto['DOP'] || 0
      const totalUSD = v.gasto['USD'] || 0
      return { nombre, montos: v.gasto, totalDOP, totalUSD }
    })
    .filter(x => x.totalDOP > 0 || x.totalUSD > 0)
    .sort((a, b) => (b.totalDOP - a.totalDOP) || (b.totalUSD - a.totalUSD))

  const ingresosCat = Object.entries(porCategoria)
    .map(([nombre, v]) => {
      const totalDOP = v.ingreso['DOP'] || 0
      const totalUSD = v.ingreso['USD'] || 0
      return { nombre, montos: v.ingreso, totalDOP, totalUSD }
    })
    .filter(x => x.totalDOP > 0 || x.totalUSD > 0)
    .sort((a, b) => (b.totalDOP - a.totalDOP) || (b.totalUSD - a.totalUSD))

  const totalGastosDOP = gastosCat.reduce((s, c) => s + c.totalDOP, 0)
  const totalGastosUSD = gastosCat.reduce((s, c) => s + c.totalUSD, 0)

  const datosPorMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mesMov = movsAnio.filter(x => parseInt(x.fecha.split('-')[1]) === m)
    const t = calcTotales(mesMov)
    return { mes: m, ingresos: t.ingresos, gastos: t.gastos }
  })

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      {/* Header */}
      <div className="ds-page-header">
        <h1 style={{ marginBottom: 'var(--space-3)' }}>Resumen</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <button onClick={prevMes} style={navBtnStyle} aria-label="Mes anterior">‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 500, fontSize: 'var(--text-sm)', textTransform: 'capitalize' }}>
            {mesLabel(year, month)}
          </span>
          <button
            onClick={nextMes}
            style={{ ...navBtnStyle, opacity: isCurrentMonth ? 0.3 : 1 }}
            disabled={isCurrentMonth}
            aria-label="Mes siguiente"
          >›</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {['mes', 'anual'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              style={{
                flex: 1, padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: 'none',
                background: tab === t ? 'var(--color-surface)' : 'rgba(255,255,255,0.2)',
                color: tab === t ? 'var(--color-primary)' : 'var(--color-text-inverse)',
                fontWeight: 600, fontSize: 'var(--text-xs)', cursor: 'pointer',
              }}
            >{t === 'mes' ? 'Este mes' : 'Vista anual'}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: 'var(--space-3)' }}>
        {loading && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-12)' }}>
            Cargando...
          </p>
        )}

        {/* ── TAB MES ── */}
        {!loading && tab === 'mes' && (
          <>
            {!hayDatos && (
              <div className="ds-empty">
                <div className="ds-empty-icon"><IconChart size={40} /></div>
                <p style={{ fontWeight: 500 }}>Sin movimientos en {mesLabel(year, month)}.</p>
              </div>
            )}

            {hayDatos && (
              <>
                {/* Balance por moneda */}
                {monedas.map(mon => {
                  const ing = totales.ingresos[mon] || 0
                  const gas = totales.gastos[mon] || 0
                  const bal = ing - gas
                  const ingPrev = totalesPrev.ingresos[mon] || 0
                  const gasPrev = totalesPrev.gastos[mon] || 0
                  const balPrev = ingPrev - gasPrev
                  return (
                    <div key={mon} className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                      <p className="ds-section-label">Balance {mon}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                        <Stat label="Ingresos" value={fmt(ing, mon)} color="var(--color-success)" />
                        <Stat label="Gastos" value={fmt(gas, mon)} color="var(--color-danger)" />
                        <Stat label="Balance" value={fmt(bal, mon)} color={bal >= 0 ? 'var(--color-primary)' : 'var(--color-danger)'} bold />
                      </div>
                      {(ingPrev > 0 || gasPrev > 0) && (
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-2)', display: 'flex', gap: 'var(--space-2)' }}>
                          <DiffChip label="Ingresos" actual={ing} anterior={ingPrev} />
                          <DiffChip label="Gastos" actual={gas} anterior={gasPrev} invertir />
                          <DiffChip label="Balance" actual={bal} anterior={balPrev} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Mayor gasto del mes */}
                {gastosCat.length > 0 && (
                  <div className="ds-card" style={{
                    padding: 'var(--space-4)', marginBottom: 'var(--space-3)',
                    background: 'var(--color-danger-light)', borderColor: '#fecaca',
                  }}>
                    <p className="ds-section-label" style={{ color: '#991b1b' }}>Mayor gasto del mes</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)' }}>
                        {gastosCat[0].nombre}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        {gastosCat[0].totalDOP > 0 && (
                          <p style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(gastosCat[0].totalDOP, 'DOP')}</p>
                        )}
                        {gastosCat[0].totalUSD > 0 && (
                          <p style={{ fontWeight: 700, color: 'var(--color-danger)' }}>{fmt(gastosCat[0].totalUSD, 'USD')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Gastos por categoría */}
                {gastosCat.length > 0 && (
                  <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <p className="ds-section-label">Gastos por categoría</p>
                    {gastosCat.map(({ nombre, totalDOP, totalUSD }) => {
                      const pctDOP = totalGastosDOP > 0 ? (totalDOP / totalGastosDOP) * 100 : 0
                      const pctUSD = totalGastosUSD > 0 ? (totalUSD / totalGastosUSD) * 100 : 0
                      return (
                        <div key={nombre} style={{ marginBottom: 'var(--space-3)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{nombre}</span>
                            <div style={{ textAlign: 'right' }}>
                              {totalDOP > 0 && (
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)', display: 'block' }}>
                                  {fmt(totalDOP, 'DOP')}
                                </span>
                              )}
                              {totalUSD > 0 && (
                                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-danger)', display: 'block' }}>
                                  {fmt(totalUSD, 'USD')}
                                </span>
                              )}
                            </div>
                          </div>
                          {totalDOP > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                              <div className="ds-progress-track">
                                <div className="ds-progress-fill" style={{ width: `${pctDOP}%`, background: 'var(--color-danger)' }} />
                              </div>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', minWidth: '32px', textAlign: 'right' }}>
                                {pctDOP.toFixed(0)}%
                              </span>
                            </div>
                          )}
                          {totalUSD > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '2px' }}>
                              <div className="ds-progress-track">
                                <div className="ds-progress-fill" style={{ width: `${pctUSD}%`, background: 'var(--color-warning)' }} />
                              </div>
                              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', minWidth: '32px', textAlign: 'right' }}>
                                {pctUSD.toFixed(0)}%
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Ingresos por categoría */}
                {ingresosCat.length > 0 && (
                  <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <p className="ds-section-label">Ingresos por categoría</p>
                    {ingresosCat.map(({ nombre, totalDOP, totalUSD }) => (
                      <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--color-border)' }}>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{nombre}</span>
                        <div style={{ textAlign: 'right' }}>
                          {totalDOP > 0 && (
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)', display: 'block' }}>
                              {fmt(totalDOP, 'DOP')}
                            </span>
                          )}
                          {totalUSD > 0 && (
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-success)', display: 'block' }}>
                              {fmt(totalUSD, 'USD')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}


              </>
            )}
          </>
        )}

        {/* ── TAB ANUAL ── */}
        {!loading && tab === 'anual' && (
          <>
            {['DOP', 'USD'].map(mon => {
              const filas = datosPorMes.filter(d => (d.ingresos[mon] || 0) > 0 || (d.gastos[mon] || 0) > 0)
              if (filas.length === 0) return null
              const totalIng = filas.reduce((s, d) => s + (d.ingresos[mon] || 0), 0)
              const totalGas = filas.reduce((s, d) => s + (d.gastos[mon] || 0), 0)
              const totalBal = totalIng - totalGas
              const barData = datosPorMes.map(d => ({
                mes: mesCorto(d.mes),
                Ingresos: d.ingresos[mon] || 0,
                Gastos: d.gastos[mon] || 0,
              }))
              return (
                <div key={mon} className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                  <p className="ds-section-label">Resumen anual {year} · {mon}</p>
                  {/* Bar chart */}
                  <div style={{ marginBottom: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={barData} margin={{ top: 0, right: 4, left: -24, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          formatter={(v, name) => [fmtShort(v) + ' ' + mon, name]}
                          contentStyle={{ fontSize: '11px', borderRadius: '10px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                        />
                        <Bar dataKey="Ingresos" fill="var(--color-success)" radius={[4, 4, 0, 0]} maxBarSize={20} />
                        <Bar dataKey="Gastos"   fill="var(--color-danger)"  radius={[4, 4, 0, 0]} maxBarSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                          <th style={thStyle}>Mes</th>
                          <th style={{ ...thStyle, color: 'var(--color-success)' }}>Ingresos</th>
                          <th style={{ ...thStyle, color: 'var(--color-danger)' }}>Gastos</th>
                          <th style={{ ...thStyle, color: 'var(--color-primary)' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosPorMes.map(({ mes, ingresos, gastos }) => {
                          const ing = ingresos[mon] || 0
                          const gas = gastos[mon] || 0
                          const bal = ing - gas
                          const esMesActual = mes === month && year === now.getFullYear()
                          if (ing === 0 && gas === 0) return (
                            <tr key={mes} style={{ borderBottom: '1px solid var(--color-border)', opacity: 0.35 }}>
                              <td style={tdStyle}>{mesCorto(mes)}</td>
                              <td style={tdStyle}>-</td>
                              <td style={tdStyle}>-</td>
                              <td style={tdStyle}>-</td>
                            </tr>
                          )
                          return (
                            <tr key={mes} style={{ borderBottom: '1px solid var(--color-border)', background: esMesActual ? 'var(--color-primary-light)' : 'transparent' }}>
                              <td style={{ ...tdStyle, fontWeight: esMesActual ? 700 : 400, color: esMesActual ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}>
                                {mesCorto(mes)}{esMesActual ? ' ●' : ''}
                              </td>
                              <td style={{ ...tdStyle, color: 'var(--color-success)', fontWeight: 500 }}>{fmtShort(ing)}</td>
                              <td style={{ ...tdStyle, color: 'var(--color-danger)', fontWeight: 500 }}>{fmtShort(gas)}</td>
                              <td style={{ ...tdStyle, color: bal >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 600 }}>{fmtShort(bal)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid var(--color-border)', background: 'var(--color-bg)' }}>
                          <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--color-text-primary)' }}>Total</td>
                          <td style={{ ...tdStyle, color: 'var(--color-success)', fontWeight: 700 }}>{fmtShort(totalIng)}</td>
                          <td style={{ ...tdStyle, color: 'var(--color-danger)', fontWeight: 700 }}>{fmtShort(totalGas)}</td>
                          <td style={{ ...tdStyle, color: totalBal >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 700 }}>{fmtShort(totalBal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })}
            {movsAnio.length === 0 && (
              <div className="ds-empty">
                <div className="ds-empty-icon"><IconCalendar size={40} /></div>
                <p>Sin movimientos en {year}.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, color, bold }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-1)' }}>{label}</p>
      <p style={{ fontSize: 'var(--text-sm)', fontWeight: bold ? 700 : 600, color }}>{value}</p>
    </div>
  )
}

function DiffChip({ label, actual, anterior, invertir }) {
  const diff = actual - anterior
  const pct = anterior !== 0 ? Math.abs((diff / anterior) * 100) : null
  const sube = diff > 0
  const esBueno = invertir ? !sube : sube
  if (diff === 0) return null
  return (
    <div style={{
      flex: 1,
      background: esBueno ? 'var(--color-success-light)' : 'var(--color-danger-light)',
      borderRadius: 'var(--radius-sm)',
      padding: 'var(--space-1) var(--space-2)',
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '2px' }}>{label}</p>
      <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: esBueno ? 'var(--color-success)' : 'var(--color-danger)' }}>
        {sube ? '↑' : '↓'} {pct !== null ? `${pct.toFixed(0)}%` : ''}
      </p>
    </div>
  )
}

const navBtnStyle = {
  background: 'rgba(255,255,255,0.2)', border: 'none', color: 'var(--color-text-inverse)',
  width: '44px', height: '44px', borderRadius: 'var(--radius-sm)', fontSize: '1.2rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const thStyle = {
  padding: 'var(--space-1) var(--space-2)', textAlign: 'right', fontWeight: 700,
  color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)',
}
const tdStyle = {
  padding: 'var(--space-1) var(--space-2)', textAlign: 'right',
  fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
}
