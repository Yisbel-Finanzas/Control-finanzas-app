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

const MILESTONES = [25, 50, 75, 100]

// Meses transcurridos entre dos fechas 'YYYY-MM-DD', mínimo 1
function mesesTranscurridos(desde, hasta) {
  const a = new Date(desde + 'T12:00:00')
  const b = new Date(hasta + 'T12:00:00')
  const meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  return Math.max(1, meses)
}

export default function Metas() {
  const perfil = usePerfil()
  const [metas, setMetas] = useState([])
  const [cuentas, setCuentas] = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet] = useState(null) // null | 'nueva' | { meta } | { abono, meta } | { reglas, meta }
  const [proyecciones, setProyecciones] = useState({}) // { [meta_id]: { mesesRestantes, sinAbonos } }
  const [toast, setToast] = useState(null) // { msg, type: 'info'|'success'|'danger' }
  const [perfilesMap, setPerfilesMap] = useState({})

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }, [])

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
    supabase.from('perfiles').select('id, nombre').then(({ data }) => {
      const map = {}
      ;(data || []).forEach(p => { map[p.id] = p.nombre })
      setPerfilesMap(map)
    })
  }, [fetchMetas])

  // Proyección de meses restantes por meta, basada en el ritmo promedio de abonos históricos
  useEffect(() => {
    if (metas.length === 0) { setProyecciones({}); return }
    const ids = metas.map(m => m.id)
    supabase
      .from('abonos_meta')
      .select('meta_id, monto, fecha')
      .in('meta_id', ids)
      .then(({ data }) => {
        const porMeta = {}
        for (const a of data || []) {
          if (!porMeta[a.meta_id]) porMeta[a.meta_id] = { total: 0, primeraFecha: a.fecha }
          porMeta[a.meta_id].total += Number(a.monto)
          if (a.fecha < porMeta[a.meta_id].primeraFecha) porMeta[a.meta_id].primeraFecha = a.fecha
        }
        const hoy = new Date().toISOString().split('T')[0]
        const resultado = {}
        for (const m of metas) {
          const info = porMeta[m.id]
          if (!info) { resultado[m.id] = { sinAbonos: true }; continue }
          const meses = mesesTranscurridos(info.primeraFecha, hoy)
          const promedioMensual = info.total / meses
          const falta = Math.max(0, Number(m.monto_objetivo) - Number(m.monto_actual))
          resultado[m.id] = promedioMensual > 0
            ? { mesesRestantes: Math.ceil(falta / promedioMensual), sinAbonos: false }
            : { sinAbonos: true }
        }
        setProyecciones(resultado)
      })
  }, [metas])

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
                proyeccion={proyecciones[m.id]}
                onAbono={() => setSheet({ abono: true, meta: m })}
                onEdit={() => setSheet({ meta: m })}
                onVerAportes={() => setSheet({ aportes: true, meta: m })}
                onAutomatizar={() => setSheet({ reglas: true, meta: m })}
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
                onVerAportes={() => setSheet({ aportes: true, meta: m })}
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
          onSave={(cruzado) => {
            setSheet(null)
            fetchMetas()
            if (cruzado) {
              showToast(
                cruzado === 100
                  ? `🎉 ¡Meta "${sheet.meta.nombre}" lograda!`
                  : `🎉 ¡Vas al ${cruzado}% de tu meta "${sheet.meta.nombre}"!`,
                'success'
              )
            }
          }}
        />
      )}

      {/* Sheet: aportes por usuario */}
      {sheet?.aportes && (
        <AportesSheet
          meta={sheet.meta}
          perfilesMap={perfilesMap}
          onClose={() => setSheet(null)}
        />
      )}

      {/* Sheet: reglas de ahorro automático */}
      {sheet?.reglas && (
        <ReglasSheet
          meta={sheet.meta}
          perfil={perfil}
          onClose={() => setSheet(null)}
          onSave={msg => { setSheet(null); showToast(msg) }}
        />
      )}

      {/* Toast de hitos */}
      {toast && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: `calc(var(--bottomnav-h) + var(--space-4))`,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 500,
            background: toast.type === 'danger'
              ? 'var(--color-danger)'
              : toast.type === 'success'
                ? 'var(--color-success)'
                : '#1e293b',
            color: '#fff',
            padding: 'var(--space-3) var(--space-5)',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100vw - var(--space-8))',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

function MetaCard({ meta, isAdmin, completada, proyeccion, onAbono, onEdit, onVerAportes, onAutomatizar, onArchivar }) {
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

      {/* Barra de progreso con marcadores de hitos */}
      <div className="ds-progress-track" style={{ marginBottom: 'var(--space-1)', position: 'relative' }}>
        <div
          className="ds-progress-fill"
          style={{
            width: `${pct}%`,
            background: completada ? 'var(--color-success)' : vencida ? 'var(--color-danger)' : 'var(--color-primary)',
            transition: 'width 0.4s ease',
          }}
        />
        {[25, 50, 75].map(h => (
          <div key={h} style={{
            position: 'absolute', top: 0, bottom: 0, left: `${h}%`,
            width: '1.5px', background: 'rgba(255,255,255,0.6)',
          }} />
        ))}
      </div>

      {!completada && proyeccion && (
        <p style={{ fontSize: 'var(--text-xs)', color: proyeccion.sinAbonos ? 'var(--color-text-muted)' : 'var(--color-primary)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
          {proyeccion.sinAbonos
            ? 'Registra abonos para ver una proyección'
            : proyeccion.mesesRestantes <= 0
              ? '✓ Al ritmo actual, ya deberías haberla alcanzado'
              : `≈${proyeccion.mesesRestantes} ${proyeccion.mesesRestantes === 1 ? 'mes' : 'meses'} restantes al ritmo actual`}
        </p>
      )}

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
          <button onClick={onVerAportes} className="ds-btn ds-btn-ghost ds-btn-sm">
            Ver aportes
          </button>
          {!completada && (
            <>
              <button onClick={onAutomatizar} className="ds-btn ds-btn-ghost ds-btn-sm">
                Automatizar
              </button>
              <button onClick={onAbono} className="ds-btn ds-btn-primary ds-btn-sm">
                + Abonar
              </button>
            </>
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
  const [categoriaId, setCategoriaId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('categorias').select('id,nombre').eq('tipo', 'gasto').eq('activo', true).order('nombre')
      .then(({ data }) => setCategorias(data || []))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    const valor = parseFloat(monto)
    if (!valor || valor <= 0) { setError('Ingresa un monto válido.'); return }
    if (!categoriaId) { setError('Selecciona una categoría para el gasto.'); return }
    setLoading(true)
    const nuevoTotal = Number(meta.monto_actual) + valor
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from('abonos_meta').insert({
        meta_id: meta.id, monto: valor, fecha, nota: nota.trim() || null, created_by: perfil?.id,
      }),
      supabase.from('metas_ahorro').update({ monto_actual: nuevoTotal }).eq('id', meta.id),
      supabase.from('movimientos').insert({
        tipo: 'gasto',
        monto: valor,
        moneda: meta.moneda,
        fecha,
        concepto: `Meta · ${meta.nombre}`,
        categoria_id: categoriaId || null,
        created_by: perfil?.id,
        recurrente: false,
      }),
    ])
    setLoading(false)
    if (e1 || e2 || e3) { setError((e1 || e2 || e3).message); return }

    const objetivo = Number(meta.monto_objetivo)
    let cruzado = null
    if (objetivo > 0) {
      const pctAntes = Math.min(100, (Number(meta.monto_actual) / objetivo) * 100)
      const pctDespues = Math.min(100, (nuevoTotal / objetivo) * 100)
      cruzado = MILESTONES.filter(hito => pctAntes < hito && pctDespues >= hito).pop() || null
    }
    onSave(cruzado)
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
          <label className="ds-label">Categoría del gasto</label>
          <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)} className="ds-input" required>
            <option value="">Seleccionar categoría…</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="ds-field">
          <label className="ds-label">Nota <span className="ds-label-hint">(opcional)</span></label>
          <input value={nota} onChange={e => setNota(e.target.value)}
            placeholder="Ej: Sueldo de junio" className="ds-input" />
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
          Se registrará automáticamente un gasto en Movimientos.
        </p>
        <SheetBotones onClose={onClose} loading={loading} label="Registrar abono" />
      </form>
    </SheetModal>
  )
}

function AportesSheet({ meta, perfilesMap, onClose }) {
  const [abonos, setAbonos] = useState(null) // null=loading

  useEffect(() => {
    supabase.from('abonos_meta')
      .select('id, monto, fecha, nota, created_by')
      .eq('meta_id', meta.id)
      .order('fecha', { ascending: false })
      .then(({ data }) => setAbonos(data || []))
  }, [meta.id])

  const porUsuario = {}
  for (const a of abonos || []) {
    const nombre = perfilesMap[a.created_by] || 'Sin asignar'
    porUsuario[nombre] = (porUsuario[nombre] || 0) + Number(a.monto)
  }
  const mostrarDesglose = Object.keys(porUsuario).length > 1

  return (
    <SheetModal onClose={onClose} title="Aportes" subtitle={meta.nombre}>
      {abonos === null && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>Cargando...</p>
      )}

      {abonos !== null && abonos.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>
          Todavía no se han registrado abonos.
        </p>
      )}

      {mostrarDesglose && (
        <div style={{
          background: 'var(--color-primary-light)', borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)', marginBottom: 'var(--space-4)',
        }}>
          <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-2)' }}>
            Aportado por usuario
          </p>
          {Object.entries(porUsuario)
            .sort((a, b) => b[1] - a[1])
            .map(([nombre, total]) => (
              <div key={nombre} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-1) 0' }}>
                <span style={{ fontSize: 'var(--text-sm)' }}>{nombre}</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(total, meta.moneda)}
                </span>
              </div>
            ))}
        </div>
      )}

      {abonos !== null && abonos.map(a => (
        <div key={a.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border)',
        }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
              {new Date(a.fecha + 'T12:00:00').toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              {perfilesMap[a.created_by] || 'Sin asignar'}{a.nota ? ` · ${a.nota}` : ''}
            </p>
          </div>
          <p style={{ fontWeight: 700, color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(a.monto, meta.moneda)}
          </p>
        </div>
      ))}
    </SheetModal>
  )
}

function ReglasSheet({ meta, perfil, onClose, onSave }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [redondeoActivo, setRedondeoActivo] = useState(false)
  const [redondeoValor, setRedondeoValor] = useState('50')
  const [porcentajeActivo, setPorcentajeActivo] = useState(false)
  const [porcentajeValor, setPorcentajeValor] = useState('10')

  useEffect(() => {
    supabase.from('reglas_ahorro_automatico').select('*').eq('meta_id', meta.id)
      .then(({ data }) => {
        const redondeo = (data || []).find(r => r.tipo === 'redondeo')
        const porcentaje = (data || []).find(r => r.tipo === 'porcentaje_ingreso')
        if (redondeo) { setRedondeoActivo(redondeo.activa); setRedondeoValor(String(redondeo.valor)) }
        if (porcentaje) { setPorcentajeActivo(porcentaje.activa); setPorcentajeValor(String(porcentaje.valor)) }
        setLoading(false)
      })
  }, [meta.id])

  async function guardarRegla(tipo, activa, valorStr) {
    const valor = parseFloat(valorStr)
    if (!valor || valor <= 0) return { error: { message: 'Ingresa un valor mayor a 0.' } }
    return supabase.from('reglas_ahorro_automatico').upsert(
      { meta_id: meta.id, tipo, valor, activa, created_by: perfil?.id },
      { onConflict: 'meta_id,tipo' }
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const resultados = await Promise.all([
      redondeoActivo ? guardarRegla('redondeo', true, redondeoValor) : Promise.resolve({ error: null }),
      porcentajeActivo ? guardarRegla('porcentaje_ingreso', true, porcentajeValor) : Promise.resolve({ error: null }),
    ])
    // Desactivar (no eliminar) las reglas destildadas, para conservar el historial de valores
    if (!redondeoActivo) await guardarRegla('redondeo', false, redondeoValor || '50')
    if (!porcentajeActivo) await guardarRegla('porcentaje_ingreso', false, porcentajeValor || '10')

    setSaving(false)
    const err = resultados.find(r => r.error)?.error
    if (err) { setError(err.message); return }
    onSave('Reglas de ahorro automático actualizadas')
  }

  if (loading) {
    return (
      <SheetModal onClose={onClose} title="Automatizar ahorro" subtitle={meta.nombre}>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>Cargando...</p>
      </SheetModal>
    )
  }

  return (
    <SheetModal onClose={onClose} title="Automatizar ahorro" subtitle={meta.nombre}>
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner msg={error} />}

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={redondeoActivo} onChange={e => setRedondeoActivo(e.target.checked)} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Redondear gastos hacia esta meta</span>
        </label>
        {redondeoActivo && (
          <div className="ds-field" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="ds-label">Redondear al múltiplo de ({meta.moneda})</label>
            <input type="number" step="1" min="1" value={redondeoValor}
              onChange={e => setRedondeoValor(e.target.value)} className="ds-input" />
            <p className="ds-field-hint" style={{ marginTop: 'var(--space-1)' }}>
              Ej: un gasto de 137 se redondea a 150, y los 13 extra se ofrecen para esta meta.
            </p>
          </div>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={porcentajeActivo} onChange={e => setPorcentajeActivo(e.target.checked)} />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>Ahorrar % de cada ingreso hacia esta meta</span>
        </label>
        {porcentajeActivo && (
          <div className="ds-field" style={{ marginBottom: 'var(--space-4)' }}>
            <label className="ds-label">Porcentaje de cada ingreso</label>
            <input type="number" step="0.1" min="0.1" max="100" value={porcentajeValor}
              onChange={e => setPorcentajeValor(e.target.value)} className="ds-input" />
          </div>
        )}

        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
          Solo aplica a movimientos en {meta.moneda}. Cada vez que registres un gasto o ingreso que coincida,
          te preguntaremos si quieres enviar el extra a esta meta — nunca se hace sin confirmar.
        </p>

        <SheetBotones onClose={onClose} loading={saving} label="Guardar reglas" />
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
