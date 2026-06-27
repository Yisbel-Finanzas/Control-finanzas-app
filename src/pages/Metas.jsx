import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { usePerfil } from '../hooks/usePerfil'
import { IconGoal, IconPlus, IconX } from '../components/icons/NavIcons'

function fmt(n, moneda) {
  return Number(n).toLocaleString('es-DO', { minimumFractionDigits: 2 }) + ' ' + moneda
}

function diasRestantes(fecha) {
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fin = new Date(fecha + 'T12:00:00')
  const diff = Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24))
  return diff
}

export default function Metas() {
  const perfil = usePerfil()
  const [metas, setMetas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null) // null | 'nueva' | { meta } | { abono, meta }

  const fetchMetas = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('metas_ahorro')
      .select('*, cuentas(banco, producto)')
      .eq('activo', true)
      .order('created_at', { ascending: false })
    setMetas(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchMetas()
    supabase.from('cuentas').select('id,banco,producto').eq('activo', true)
      .then(({ data }) => setCuentas(data || []))
  }, [fetchMetas])

  const isAdmin = perfil?.rol === 'administradora'
  const metasActivas = metas.filter(m => Number(m.monto_actual) < Number(m.monto_objetivo))
  const metasCompletadas = metas.filter(m => Number(m.monto_actual) >= Number(m.monto_objetivo))

  return (
    <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto' }}>
      <div className="ds-page-header">
        <h1>Metas de ahorro</h1>
      </div>

      <div style={{ padding: 'var(--space-4)' }}>
        {loading && <LoadingSkeleton />}

        {!loading && metas.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon"><IconGoal size={40} /></div>
            <p style={{ fontWeight: 500 }}>Sin metas creadas aún.</p>
            <p>Toca + para definir tu primera meta de ahorro.</p>
          </div>
        )}

        {metasActivas.length > 0 && (
          <>
            <p className="ds-section-label" style={{ marginBottom: 'var(--space-3)' }}>En progreso</p>
            {metasActivas.map(m => (
              <MetaCard
                key={m.id}
                meta={m}
                isAdmin={isAdmin}
                onAbono={() => setSheet({ abono: true, meta: m })}
                onEdit={() => setSheet({ meta: m })}
                onArchivar={async () => {
                  await supabase.from('metas_ahorro').update({ activo: false }).eq('id', m.id)
                  fetchMetas()
                }}
              />
            ))}
          </>
        )}

        {metasCompletadas.length > 0 && (
          <>
            <p className="ds-section-label" style={{ marginBottom: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
              Completadas ✓
            </p>
            {metasCompletadas.map(m => (
              <MetaCard
                key={m.id}
                meta={m}
                isAdmin={isAdmin}
                completada
                onArchivar={async () => {
                  await supabase.from('metas_ahorro').update({ activo: false }).eq('id', m.id)
                  fetchMetas()
                }}
              />
            ))}
          </>
        )}
      </div>

      <button onClick={() => setSheet('nueva')} className="ds-fab" aria-label="Nueva meta">
        <IconPlus size={24} />
      </button>

      {/* Sheet: nueva meta o editar */}
      {(sheet === 'nueva' || sheet?.meta) && !sheet?.abono && (
        <MetaSheet
          meta={sheet?.meta}
          cuentas={cuentas}
          perfil={perfil}
          onClose={() => setSheet(null)}
          onSave={() => { setSheet(null); fetchMetas() }}
        />
      )}

      {/* Sheet: agregar abono */}
      {sheet?.abono && (
        <AbonoSheet
          meta={sheet.meta}
          perfil={perfil}
          onClose={() => setSheet(null)}
          onSave={() => { setSheet(null); fetchMetas() }}
        />
      )}
    </div>
  )
}

function MetaCard({ meta, isAdmin, completada, onAbono, onEdit, onArchivar }) {
  const pct = Math.min(100, Math.round((Number(meta.monto_actual) / Number(meta.monto_objetivo)) * 100))
  const dias = diasRestantes(meta.fecha_objetivo)
  const vencida = dias !== null && dias < 0 && !completada

  return (
    <div className="ds-card" style={{
      padding: 'var(--space-4)',
      marginBottom: 'var(--space-3)',
      borderLeft: `3px solid ${completada ? 'var(--color-success)' : vencida ? 'var(--color-danger)' : 'var(--color-primary)'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-text-primary)', marginBottom: '2px' }}>
            {meta.nombre}
          </p>
          {meta.descripcion && (
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{meta.descripcion}</p>
          )}
        </div>
        <span className={`ds-badge ${completada ? 'ds-badge-success' : vencida ? 'ds-badge-danger' : 'ds-badge-primary'}`}>
          {completada ? 'Lograda' : vencida ? 'Vencida' : `${pct}%`}
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="ds-progress-track" style={{ marginBottom: 'var(--space-3)' }}>
        <div
          className="ds-progress-fill"
          style={{
            width: `${pct}%`,
            background: completada ? 'var(--color-success)' : vencida ? 'var(--color-danger)' : 'var(--color-primary)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Montos */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Ahorrado</p>
          <p style={{ fontWeight: 700, fontSize: 'var(--text-base)', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(meta.monto_actual, meta.moneda)}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Objetivo</p>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(meta.monto_objetivo, meta.moneda)}
          </p>
        </div>
      </div>

      {/* Faltante + cuenta + fecha */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          {!completada && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Faltan {fmt(Math.max(0, Number(meta.monto_objetivo) - Number(meta.monto_actual)), meta.moneda)}
            </span>
          )}
          {meta.cuentas && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              · {meta.cuentas.banco}
            </span>
          )}
          {dias !== null && (
            <span style={{ fontSize: 'var(--text-xs)', color: vencida ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
              · {dias < 0 ? `Venció hace ${Math.abs(dias)} días` : dias === 0 ? 'Vence hoy' : `${dias} días restantes`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          {!completada && (
            <button onClick={onAbono} className="ds-btn ds-btn-primary ds-btn-sm">
              + Abonar
            </button>
          )}
          {isAdmin && (
            <button onClick={onArchivar} className="ds-btn ds-btn-ghost ds-btn-sm">
              Archivar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function MetaSheet({ meta, cuentas, perfil, onClose, onSave }) {
  const [form, setForm] = useState({
    nombre: meta?.nombre || '',
    descripcion: meta?.descripcion || '',
    monto_objetivo: meta?.monto_objetivo || '',
    moneda: meta?.moneda || 'DOP',
    fecha_objetivo: meta?.fecha_objetivo || '',
    cuenta_id: meta?.cuenta_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.nombre.trim()) { setError('Escribe un nombre para la meta.'); return }
    if (!form.monto_objetivo || Number(form.monto_objetivo) <= 0) { setError('El monto objetivo debe ser mayor a 0.'); return }
    setLoading(true)
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      monto_objetivo: parseFloat(form.monto_objetivo),
      moneda: form.moneda,
      fecha_objetivo: form.fecha_objetivo || null,
      cuenta_id: form.cuenta_id || null,
      created_by: perfil?.id,
    }
    const { error } = meta
      ? await supabase.from('metas_ahorro').update(payload).eq('id', meta.id)
      : await supabase.from('metas_ahorro').insert(payload)
    setLoading(false)
    if (error) setError(error.message)
    else onSave()
  }

  return (
    <SheetModal onClose={onClose} title={meta ? 'Editar meta' : 'Nueva meta'}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}
        <div className="ds-field">
          <label className="ds-label">Nombre</label>
          <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
            placeholder="Ej: Vacaciones, Fondo de emergencia" className="ds-input" required />
        </div>
        <div className="ds-field">
          <label className="ds-label">Descripción <span className="ds-label-hint">(opcional)</span></label>
          <input value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
            placeholder="Notas adicionales" className="ds-input" />
        </div>
        <div className="ds-field" style={{ display: 'flex', gap: 'var(--space-3)' }}>
          <div style={{ flex: 2 }}>
            <label className="ds-label">Monto objetivo</label>
            <input type="number" step="0.01" min="1" value={form.monto_objetivo}
              onChange={e => set('monto_objetivo', e.target.value)}
              placeholder="0.00" className="ds-input" required />
          </div>
          <div style={{ flex: 1 }}>
            <label className="ds-label">Moneda</label>
            <select value={form.moneda} onChange={e => set('moneda', e.target.value)} className="ds-input">
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>
        <div className="ds-field">
          <label className="ds-label">Fecha límite <span className="ds-label-hint">(opcional)</span></label>
          <input type="date" value={form.fecha_objetivo}
            onChange={e => set('fecha_objetivo', e.target.value)} className="ds-input" />
        </div>
        <div className="ds-field">
          <label className="ds-label">Cuenta vinculada <span className="ds-label-hint">(opcional)</span></label>
          <select value={form.cuenta_id} onChange={e => set('cuenta_id', e.target.value)} className="ds-input">
            <option value="">Sin vincular</option>
            {cuentas.map(c => (
              <option key={c.id} value={c.id}>{c.banco} · {c.producto}</option>
            ))}
          </select>
        </div>
        <SheetBotones onClose={onClose} loading={loading} label={meta ? 'Guardar cambios' : 'Crear meta'} />
      </form>
    </SheetModal>
  )
}

function AbonoSheet({ meta, perfil, onClose, onSave }) {
  const [monto, setMonto] = useState('')
  const [nota, setNota] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) { setError('Ingresa un monto válido.'); return }
    setLoading(true)
    const nuevoTotal = Number(meta.monto_actual) + valor
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('abonos_meta').insert({
        meta_id: meta.id, monto: valor, fecha, nota: nota.trim() || null, created_by: perfil?.id,
      }),
      supabase.from('metas_ahorro').update({ monto_actual: nuevoTotal }).eq('id', meta.id),
    ])
    setLoading(false)
    if (e1 || e2) setError((e1 || e2).message)
    else onSave()
  }

  const falta = Math.max(0, Number(meta.monto_objetivo) - Number(meta.monto_actual))

  return (
    <SheetModal onClose={onClose} title={`Abonar a "${meta.nombre}"`}>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
        Faltan {fmt(falta, meta.moneda)} para completar esta meta.
      </p>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}
        <div className="ds-field">
          <label className="ds-label">Monto ({meta.moneda})</label>
          <input type="number" step="0.01" min="0.01" value={monto}
            onChange={e => setMonto(e.target.value)}
            placeholder="0.00" className="ds-input" required autoFocus />
        </div>
        <div className="ds-field">
          <label className="ds-label">Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="ds-input" />
        </div>
        <div className="ds-field">
          <label className="ds-label">Nota <span className="ds-label-hint">(opcional)</span></label>
          <input value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: Sueldo de junio" className="ds-input" />
        </div>
        <SheetBotones onClose={onClose} loading={loading} label="Registrar abono" />
      </form>
    </SheetModal>
  )
}

// ── Shared primitives ──────────────────────────────────────────
function SheetModal({ onClose, title, children }) {
  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div className="ds-sheet" onClick={e => e.stopPropagation()}
        role="dialog" aria-label={title} aria-modal="true">
        <div className="ds-sheet-handle" />
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

function SheetBotones({ onClose, loading, label }) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
      <button type="button" onClick={onClose} className="ds-btn ds-btn-ghost" style={{ flex: 1 }}>
        Cancelar
      </button>
      <button type="submit" disabled={loading} className="ds-btn ds-btn-primary" style={{ flex: 2 }}>
        {loading ? 'Guardando…' : label}
      </button>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div role="alert" style={{
      background: 'var(--color-danger-light)', color: 'var(--color-danger)',
      borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)',
      fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)', lineHeight: 1.5,
    }}>
      {msg}
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <>
      <div className="ds-skeleton" style={{ height: 10, width: 100, marginBottom: 'var(--space-3)' }} />
      {[0, 1].map(i => (
        <div key={i} className="ds-card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-3)' }}>
          <div className="ds-skeleton" style={{ height: 14, width: '50%', marginBottom: 'var(--space-3)' }} />
          <div className="ds-skeleton" style={{ height: 8, borderRadius: 4, marginBottom: 'var(--space-3)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="ds-skeleton" style={{ height: 20, width: '35%' }} />
            <div className="ds-skeleton" style={{ height: 20, width: '30%' }} />
          </div>
        </div>
      ))}
    </>
  )
}
