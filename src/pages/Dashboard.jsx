import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}

export default function Dashboard() {
  const perfil = usePerfil()
  const [balance, setBalance] = useState({ ingresos: {}, gastos: {} })
  const [deudaTotal, setDeudaTotal] = useState({})
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
    ]).then(([{ data: movs }, { data: deudas }]) => {
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
        <h1>Inicio</h1>
        {perfil?.nombre && (
          <p style={{ fontSize: 'var(--text-sm)', opacity: 0.85, marginTop: 'var(--space-1)', textTransform: 'capitalize' }}>
            Hola, {perfil.nombre}
          </p>
        )}
      </div>

      <div style={{ padding: 'var(--space-3)' }}>
        {loading ? (
          <div>
            <div className="ds-skeleton" style={{ height: 10, width: 90, marginBottom: 'var(--space-3)' }} />
            <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
              <div className="ds-skeleton" style={{ height: 10, width: 60, marginBottom: 'var(--space-3)' }} />
              <div className="ds-skeleton" style={{ height: 34, width: '70%', marginBottom: 'var(--space-4)' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <div className="ds-skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
                <div className="ds-skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="ds-section-label" style={{ textTransform: 'capitalize', marginBottom: 'var(--space-3)' }}>
              {mesLabel}
            </p>

            {/* Balance cards — one per currency */}
            {monedas.length === 0 ? (
              <div className="ds-card" style={{ padding: 'var(--space-6)', textAlign: 'center', marginBottom: 'var(--space-3)' }}>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  Sin movimientos este mes.
                </p>
              </div>
            ) : (
              monedas.map(mon => {
                const ing = balance.ingresos[mon] || 0
                const gas = balance.gastos[mon] || 0
                const bal = ing - gas
                return (
                  <div key={mon} className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
                    <p className="ds-section-label">Balance {mon}</p>
                    <p style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 700,
                      color: bal >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                      marginBottom: 'var(--space-4)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmt(bal, mon)}
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                      <div style={{
                        background: 'var(--color-success-light)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3)',
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
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-3)',
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

            {/* Debt summary */}
            {hayDeudas && (
              <div className="ds-card" style={{
                padding: 'var(--space-4)',
                marginBottom: 'var(--space-3)',
                background: 'var(--color-danger-light)',
                borderColor: '#fecaca',
              }}>
                <p className="ds-section-label" style={{ color: '#991b1b' }}>Deudas pendientes</p>
                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {Object.entries(deudaTotal).map(([moneda, total]) => (
                    <p key={moneda} style={{
                      fontWeight: 700,
                      fontSize: 'var(--text-lg)',
                      color: 'var(--color-danger)',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {fmt(total, moneda)}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
