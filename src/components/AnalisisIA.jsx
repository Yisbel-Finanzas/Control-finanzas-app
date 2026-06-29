import { useAnalisisIA } from '../hooks/useAnalisisIA'

export default function AnalisisIA({ movimientos, periodo }) {
  const { analisis, loading, error, analizar, limpiar } = useAnalisisIA()

  if (!movimientos || movimientos.length === 0) return null

  function handleAnalizar() {
    analizar(movimientos, periodo)
  }

  return (
    <div className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: analisis || loading || error ? 'var(--space-3)' : 0 }}>
        <div>
          <p className="ds-section-label" style={{ margin: 0 }}>Análisis con IA</p>
          {!analisis && !loading && !error && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
              {movimientos.length} movimientos · {periodo}
            </p>
          )}
        </div>
        {!loading && (
          <button
            onClick={analisis ? limpiar : handleAnalizar}
            className="ds-btn ds-btn-sm"
            style={{
              background: analisis ? 'var(--color-surface)' : 'var(--color-primary)',
              color: analisis ? 'var(--color-text-muted)' : 'var(--color-text-inverse)',
              border: analisis ? '1px solid var(--color-border)' : 'none',
              fontWeight: 600,
            }}
          >
            {analisis ? 'Limpiar' : '✨ Analizar'}
          </button>
        )}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '90%' }} />
          <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '75%' }} />
          <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '85%' }} />
          <div className="ds-skeleton" style={{ height: 14, borderRadius: 6, width: '60%' }} />
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 'var(--space-1)' }}>
            Analizando tus finanzas…
          </p>
        </div>
      )}

      {error && (
        <div role="alert" style={{
          background: 'var(--color-danger-light)', color: 'var(--color-danger)',
          borderRadius: 'var(--radius-md)', padding: 'var(--space-3)',
          fontSize: 'var(--text-sm)', lineHeight: 1.5,
        }}>
          {error}
          <button onClick={handleAnalizar} style={{
            display: 'block', marginTop: 'var(--space-2)',
            fontSize: 'var(--text-xs)', color: 'var(--color-danger)',
            background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
          }}>Reintentar</button>
        </div>
      )}

      {analisis && (
        <div style={{
          fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)',
          lineHeight: 1.7, whiteSpace: 'pre-wrap',
        }}>
          {analisis}
        </div>
      )}
    </div>
  )
}
