import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { IconEye, IconEyeOff, IconWallet } from '../components/icons/NavIcons'

function friendlyError(msg) {
  if (!msg) return 'Ocurrió un error. Intenta de nuevo.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de iniciar sesión.'
  if (m.includes('too many requests') || m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  if (m.includes('user not found')) return 'No existe una cuenta con ese correo.'
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Verifica tu internet.'
  return msg
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(friendlyError(error.message))
    setLoading(false)
  }

  async function handleRecovery(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://yisbel-finanzas.github.io/Control-finanzas-app/',
    })
    if (error) setError(friendlyError(error.message))
    else setMessage('Revisa tu correo para restablecer tu contraseña.')
    setLoading(false)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', padding: 'var(--space-4)',
      background: 'var(--color-bg)',
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--space-3)',
          boxShadow: 'var(--shadow-md)',
          color: '#fff',
        }}>
          <IconWallet size={26} />
        </div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Control de Finanzas
        </h1>
        {mode === 'recovery' && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
            Recupera tu contraseña
          </p>
        )}
      </div>

      {/* Card */}
      <div className="ds-card" style={{ width: '100%', maxWidth: '360px', padding: 'var(--space-8) var(--space-6)' }}>
        {error && (
          <div role="alert" style={{
            background: 'var(--color-danger-light)', color: 'var(--color-danger)',
            border: '1px solid #fecaca', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)',
          }}>
            {error}
          </div>
        )}
        {message && (
          <div role="status" style={{
            background: 'var(--color-success-light)', color: 'var(--color-success)',
            border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)',
          }}>
            {message}
          </div>
        )}

        <form onSubmit={mode === 'login' ? handleLogin : handleRecovery}>
          <div className="ds-field">
            <label htmlFor="email" className="ds-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              className="ds-input"
            />
          </div>

          {mode === 'login' && (
            <div className="ds-field">
              <label htmlFor="password" className="ds-label">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="ds-input"
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  style={{
                    position: 'absolute', right: '0', top: '0',
                    width: '44px', height: '44px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {showPwd ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="ds-btn ds-btn-primary"
            style={{ width: '100%', marginBottom: 'var(--space-4)' }}
          >
            {loading
              ? 'Procesando...'
              : mode === 'login'
                ? 'Entrar'
                : 'Enviar correo de recuperación'}
          </button>
        </form>

        {mode === 'login' ? (
          <button
            type="button"
            onClick={() => { setMode('recovery'); setError(null) }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-primary)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', textDecoration: 'underline',
              display: 'block', margin: '0 auto',
            }}
          >
            Olvidé mi contraseña
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setMessage(null) }}
            style={{
              background: 'none', border: 'none',
              color: 'var(--color-primary)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', textDecoration: 'underline',
              display: 'block', margin: '0 auto',
            }}
          >
            ← Volver al inicio de sesión
          </button>
        )}
      </div>
    </div>
  )
}
