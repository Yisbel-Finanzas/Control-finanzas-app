import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
    // Cargar año completo para tab anual
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

  // Categoría top por gastos (DOP primero, luego USD)
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

  // % de gastos por categoría
  const totalGastosDOP = gastosCat.reduce((s, c) => s + c.totalDOP, 0)
  const totalGastosUSD = gastosCat.reduce((s, c) => s + c.totalUSD, 0)

  // Datos anuales por mes
  const datosPorMes = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    const mesMov = movsAnio.filter(x => parseInt(x.fecha.split('-')[1]) === m)
    const t = calcTotales(mesMov)
    return { mes: m, ingresos: t.ingresos, gastos: t.gastos }
  })

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ background: '#2563eb', color: '#fff', padding: '1rem', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Resumen</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <button onClick={prevMes} style={navBtnStyle}>‹</button>
          <span style={{ flex: 1, textAlign: 'center', fontWeight: 500, fontSize: '0.9rem', textTransform: 'capitalize' }}>
            {mesLabel(year, month)}
          </span>
          <button onClick={nextMes} style={{ ...navBtnStyle, opacity: isCurrentMonth ? 0.3 : 1 }} disabled={isCurrentMonth}>›</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['mes', 'anual'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '0.4rem', borderRadius: '8px', border: 'none',
              background: tab === t ? '#fff' : 'rgba(255,255,255,0.2)',
              color: tab === t ? '#2563eb' : '#fff',
              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
            }}>{t === 'mes' ? 'Este mes' : 'Vista anual'}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '0.75rem' }}>
        {loading && <p style={{ textAlign: 'center', color: '#6b7280', padding: '3rem' }}>Cargando...</p>}

        {/* ── TAB MES ── */}
        {!loading && tab === 'mes' && (
          <>
            {!hayDatos && (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '4rem 1rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
                <p>Sin movimientos en {mesLabel(year, month)}.</p>
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
                    <div key={mon} style={cardStyle}>
                      <p style={sectionLabel}>Balance {mon}</p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <Stat label="Ingresos" value={fmt(ing, mon)} color="#16a34a" />
                        <Stat label="Gastos" value={fmt(gas, mon)} color="#dc2626" />
                        <Stat label="Balance" value={fmt(bal, mon)} color={bal >= 0 ? '#2563eb' : '#dc2626'} bold />
                      </div>
                      {/* Comparación mes anterior */}
                      {(ingPrev > 0 || gasPrev > 0) && (
                        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: '0.6rem', display: 'flex', gap: '0.5rem' }}>
                          <DiffChip label="Ingresos" actual={ing} anterior={ingPrev} moneda={mon} />
                          <DiffChip label="Gastos" actual={gas} anterior={gasPrev} moneda={mon} invertir />
                          <DiffChip label="Balance" actual={bal} anterior={balPrev} moneda={mon} />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Categoría top */}
                {gastosCat.length > 0 && (
                  <div style={{ ...cardStyle, background: '#fef2f2', border: '1px solid #fecaca' }}>
                    <p style={{ ...sectionLabel, color: '#991b1b' }}>Mayor gasto del mes</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>
                        {gastosCat[0].nombre}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        {gastosCat[0].totalDOP > 0 && (
                          <p style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(gastosCat[0].totalDOP, 'DOP')}</p>
                        )}
                        {gastosCat[0].totalUSD > 0 && (
                          <p style={{ fontWeight: 700, color: '#dc2626' }}>{fmt(gastosCat[0].totalUSD, 'USD')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Gastos por categoría con % */}
                {gastosCat.length > 0 && (
                  <div style={cardStyle}>
                    <p style={sectionLabel}>Gastos por categoría</p>
                    {gastosCat.map(({ nombre, totalDOP, totalUSD }) => {
                      const pctDOP = totalGastosDOP > 0 ? (totalDOP / totalGastosDOP) * 100 : 0
                      const pctUSD = totalGastosUSD > 0 ? (totalUSD / totalGastosUSD) * 100 : 0
                      return (
                        <div key={nombre} style={{ marginBottom: '0.65rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                            <span style={{ fontSize: '0.85rem', color: '#374151' }}>{nombre}</span>
                            <div style={{ textAlign: 'right' }}>
                              {totalDOP > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', display: 'block' }}>{fmt(totalDOP, 'DOP')}</span>}
                              {totalUSD > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#dc2626', display: 'block' }}>{fmt(totalUSD, 'USD')}</span>}
                            </div>
                          </div>
                          {totalDOP > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '4px', height: '5px' }}>
                                <div style={{ width: `${pctDOP}%`, height: '100%', borderRadius: '4px', background: '#dc2626' }} />
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', minWidth: '32px', textAlign: 'right' }}>{pctDOP.toFixed(0)}%</span>
                            </div>
                          )}
                          {totalUSD > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: '4px', height: '5px' }}>
                                <div style={{ width: `${pctUSD}%`, height: '100%', borderRadius: '4px', background: '#f59e0b' }} />
                              </div>
                              <span style={{ fontSize: '0.7rem', color: '#9ca3af', minWidth: '32px', textAlign: 'right' }}>{pctUSD.toFixed(0)}%</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Ingresos por categoría */}
                {ingresosCat.length > 0 && (
                  <div style={cardStyle}>
                    <p style={sectionLabel}>Ingresos por categoría</p>
                    {ingresosCat.map(({ nombre, totalDOP, totalUSD }) => (
                      <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: '0.85rem', color: '#374151' }}>{nombre}</span>
                        <div style={{ textAlign: 'right' }}>
                          {totalDOP > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#16a34a', display: 'block' }}>{fmt(totalDOP, 'DOP')}</span>}
                          {totalUSD > 0 && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#16a34a', display: 'block' }}>{fmt(totalUSD, 'USD')}</span>}
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
              return (
                <div key={mon} style={cardStyle}>
                  <p style={sectionLabel}>Resumen anual {year} · {mon}</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                          <th style={thStyle}>Mes</th>
                          <th style={{ ...thStyle, color: '#16a34a' }}>Ingresos</th>
                          <th style={{ ...thStyle, color: '#dc2626' }}>Gastos</th>
                          <th style={{ ...thStyle, color: '#2563eb' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datosPorMes.map(({ mes, ingresos, gastos }) => {
                          const ing = ingresos[mon] || 0
                          const gas = gastos[mon] || 0
                          const bal = ing - gas
                          const esMesActual = mes === month && year === now.getFullYear()
                          if (ing === 0 && gas === 0) return (
                            <tr key={mes} style={{ borderBottom: '1px solid #f3f4f6', opacity: 0.35 }}>
                              <td style={tdStyle}>{mesCorto(mes)}</td>
                              <td style={tdStyle}>—</td>
                              <td style={tdStyle}>—</td>
                              <td style={tdStyle}>—</td>
                            </tr>
                          )
                          return (
                            <tr key={mes} style={{ borderBottom: '1px solid #f3f4f6', background: esMesActual ? '#eff6ff' : 'transparent' }}>
                              <td style={{ ...tdStyle, fontWeight: esMesActual ? 700 : 400, color: esMesActual ? '#2563eb' : '#374151' }}>
                                {mesCorto(mes)}{esMesActual ? ' ●' : ''}
                              </td>
                              <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 500 }}>{fmtShort(ing)}</td>
                              <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 500 }}>{fmtShort(gas)}</td>
                              <td style={{ ...tdStyle, color: bal >= 0 ? '#2563eb' : '#dc2626', fontWeight: 600 }}>{fmtShort(bal)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ borderTop: '2px solid #e5e7eb', background: '#f9fafb' }}>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>Total</td>
                          <td style={{ ...tdStyle, color: '#16a34a', fontWeight: 700 }}>{fmtShort(totalIng)}</td>
                          <td style={{ ...tdStyle, color: '#dc2626', fontWeight: 700 }}>{fmtShort(totalGas)}</td>
                          <td style={{ ...tdStyle, color: totalBal >= 0 ? '#2563eb' : '#dc2626', fontWeight: 700 }}>{fmtShort(totalBal)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )
            })}
            {movsAnio.length === 0 && (
              <div style={{ textAlign: 'center', color: '#6b7280', padding: '4rem 1rem' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</p>
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
      <p style={{ fontSize: '0.68rem', color: '#6b7280', marginBottom: '0.2rem' }}>{label}</p>
      <p style={{ fontSize: '0.78rem', fontWeight: bold ? 700 : 600, color }}>{value}</p>
    </div>
  )
}

function DiffChip({ label, actual, anterior, moneda, invertir }) {
  const diff = actual - anterior
  const pct = anterior !== 0 ? Math.abs((diff / anterior) * 100) : null
  const sube = diff > 0
  const esBueno = invertir ? !sube : sube
  if (diff === 0) return null
  return (
    <div style={{ flex: 1, background: esBueno ? '#f0fdf4' : '#fef2f2', borderRadius: '6px', padding: '0.3rem 0.4rem', textAlign: 'center' }}>
      <p style={{ fontSize: '0.65rem', color: '#6b7280', marginBottom: '0.1rem' }}>{label}</p>
      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: esBueno ? '#16a34a' : '#dc2626' }}>
        {sube ? '↑' : '↓'} {pct !== null ? `${pct.toFixed(0)}%` : ''}
      </p>
    </div>
  )
}

const cardStyle = {
  background: '#fff', borderRadius: '12px', padding: '1rem',
  marginBottom: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
}
const sectionLabel = {
  fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem',
}
const navBtnStyle = {
  background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
  width: '32px', height: '32px', borderRadius: '8px', fontSize: '1.2rem',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const thStyle = {
  padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 700,
  color: '#6b7280', fontSize: '0.75rem',
}
const tdStyle = {
  padding: '0.45rem 0.5rem', textAlign: 'right', fontSize: '0.82rem', color: '#374151',
}
