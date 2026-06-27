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
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #3D7A59 0%, #4E8C69 55%, #6FAE8A 100%)',
    }}>
      {/* Brand section */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'clamp(52px, 13vh, 88px) var(--space-6) clamp(36px, 9vh, 60px)',
        flex: '0 0 auto',
      }}>
        {/* Portrait watermark */}
        <div aria-hidden="true" style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${import.meta.env.BASE_URL}img/yisbel-portrait.png)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 18%',
          opacity: 0.13,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 72, height: 72,
          borderRadius: '22px',
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.30)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          marginBottom: 'var(--space-5)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}>
          <IconWallet size={36} />
        </div>
        <h1 style={{
          fontSize: 'clamp(1.6rem, 6vw, 2.1rem)',
          fontWeight: 800,
          color: '#fff',
          letterSpacing: '-0.03em',
          marginBottom: '6px',
          lineHeight: 1.1,
        }}>
          Finanzas
        </h1>
        <p style={{
          fontSize: 'var(--text-sm)',
          color: 'rgba(255,255,255,0.65)',
          fontWeight: 400,
          letterSpacing: '0.01em',
        }}>
          Control personal
        </p>
        </div>{/* /zIndex wrapper */}
      </div>

      {/* Form section */}
      <div style={{
        flex: 1,
        background: 'var(--color-surface)',
        borderRadius: '28px 28px 0 0',
        padding: 'var(--space-8) var(--space-6) var(--space-10)',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.10)',
        minHeight: '56vh',
      }}>
        <h2 style={{
          fontSize: 'var(--text-xl)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          letterSpacing: '-0.02em',
          marginBottom: 'var(--space-6)',
        }}>
          {mode === 'login' ? 'Iniciar sesión' : 'Recuperar contraseña'}
        </h2>

        {error && (
          <div role="alert" style={{
            background: 'var(--color-danger-light)',
            color: 'var(--color-danger)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-5)',
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}
        {message && (
          <div role="status" style={{
            background: 'var(--color-success-light)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)',
            marginBottom: 'var(--space-5)',
            lineHeight: 1.5,
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
                    width: '44px', height: '100%',
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
            style={{ width: '100%', marginTop: 'var(--space-2)', marginBottom: 'var(--space-5)' }}
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
              color: 'var(--color-primary-hover)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 500,
              display: 'block', margin: '0 auto', padding: 'var(--space-2)',
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
              color: 'var(--color-text-muted)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 500,
              display: 'block', margin: '0 auto', padding: 'var(--space-2)',
            }}
          >
            Volver al inicio de sesión
          </button>
        )}
      </div>
    </div>
  )
}
