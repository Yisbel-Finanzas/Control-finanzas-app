import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('login')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
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
    if (error) setError(error.message)
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
      {/* Logo / brand */}
      <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
        <div style={{
          width: 52, height: 52, borderRadius: 'var(--radius-lg)',
          background: 'var(--color-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto var(--space-3)',
          boxShadow: 'var(--shadow-md)',
        }}>
          <span style={{ fontSize: '1.5rem' }}>💰</span>
        </div>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
          Control de Finanzas
        </h1>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {mode === 'login' ? 'Inicia sesión para continuar' : 'Recupera tu contraseña'}
        </p>
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
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="ds-input"
              />
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
