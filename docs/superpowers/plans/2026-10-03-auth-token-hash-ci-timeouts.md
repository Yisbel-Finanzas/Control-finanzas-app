# Fix de seguridad invite/recovery (token_hash) + timeouts CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la vulnerabilidad de consumo automático de tokens de invite/recovery por escáneres de enlaces de correo, y agregar límites de tiempo a los workflows de GitHub Actions.

**Architecture:** `App.jsx` gana una detección previa de `token_hash`/`type` en la query string (canjeado explícitamente vía `supabase.auth.verifyOtp()`, que solo corre con JS real en el navegador), cayendo de vuelta al formato `#access_token` existente si no hay `token_hash` — cambio puramente aditivo y retrocompatible. Los workflows de GitHub Actions ganan `timeout-minutes` y un `permissions` explícito, sin tocar su lógica.

**Tech Stack:** React 18, Supabase Auth (`supabase-js`), GitHub Actions. Sin framework de testing automatizado en el proyecto — verificación manual (build + revisión de comportamiento).

---

### Task 1: Flujo invite/recovery con `token_hash` en App.jsx

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Renombrar `detectAuthFlow` a `detectAuthFlowFromHash`**

En `src/App.jsx:17-23`, reemplazar:

```jsx
// Detectar flujo de invitación o recuperación antes de cualquier render
function detectAuthFlow() {
  const hash = window.location.hash
  if (hash.includes('type=invite')) return 'invite'
  if (hash.includes('type=recovery')) return 'recovery'
  return null
}
```

por:

```jsx
// Detecta el flujo de invitación/recuperación desde el hash (links antiguos,
// ya resueltos automáticamente por supabase-js al cargar el cliente).
function detectAuthFlowFromHash() {
  const hash = window.location.hash
  if (hash.includes('type=invite')) return 'invite'
  if (hash.includes('type=recovery')) return 'recovery'
  return null
}
```

- [ ] **Step 2: Cambiar el estado inicial de `authFlow` y agregar `checkingLink`**

En `src/App.jsx:25-27`, reemplazar:

```jsx
export default function App() {
  const [session, setSession] = useState(undefined)
  const [authFlow, setAuthFlow] = useState(detectAuthFlow)
```

por:

```jsx
export default function App() {
  const [session, setSession] = useState(undefined)
  const [authFlow, setAuthFlow] = useState(null)
  const [checkingLink, setCheckingLink] = useState(true)
```

- [ ] **Step 3: Agregar `procesarLinkDeCorreo()` dentro del `useEffect` de montaje**

En `src/App.jsx:29-33`, reemplazar:

```jsx
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])
```

por:

```jsx
  useEffect(() => {
    async function procesarLinkDeCorreo() {
      // Los links de invitación/recuperación ahora llegan como
      // ?token_hash=...&type=invite (ver plantillas de correo en Supabase),
      // en vez del formato #access_token=... que Supabase resuelve solo con
      // un GET — eso permite que un escáner de enlaces del correo (Gmail,
      // antivirus, etc.) consuma el token antes de que la usuaria lo toque.
      // Con token_hash, el canje solo ocurre acá, vía JS en un navegador real.
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (tokenHash && (type === 'invite' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        window.history.replaceState(null, '', window.location.pathname)
        if (!error) setAuthFlow(type)
      } else {
        setAuthFlow(detectAuthFlowFromHash())
      }
      setCheckingLink(false)
    }
    procesarLinkDeCorreo()

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])
```

- [ ] **Step 4: No renderizar nada mientras se resuelve el link**

En `src/App.jsx`, inmediatamente después del bloque del `useEffect` del Step 3 (antes del comentario `// Flujo de invitación o recuperación de contraseña`), agregar:

```jsx

  if (checkingLink) return null
```

El archivo debe quedar así en esa sección (para referencia, no un paso separado — ya cubierto por los Steps 2-4):

```jsx
export default function App() {
  const [session, setSession] = useState(undefined)
  const [authFlow, setAuthFlow] = useState(null)
  const [checkingLink, setCheckingLink] = useState(true)

  useEffect(() => {
    async function procesarLinkDeCorreo() {
      const params = new URLSearchParams(window.location.search)
      const tokenHash = params.get('token_hash')
      const type = params.get('type')

      if (tokenHash && (type === 'invite' || type === 'recovery')) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        window.history.replaceState(null, '', window.location.pathname)
        if (!error) setAuthFlow(type)
      } else {
        setAuthFlow(detectAuthFlowFromHash())
      }
      setCheckingLink(false)
    }
    procesarLinkDeCorreo()

    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (checkingLink) return null

  // Flujo de invitación o recuperación de contraseña
  if (authFlow) {
    return <SetPassword mode={authFlow} onDone={() => setAuthFlow(null)} />
  }

  if (session === undefined) return null
  ...
```

- [ ] **Step 5: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 6: Verificación manual del comportamiento sin link pendiente**

Run: `npm run dev`

Abrir `http://localhost:5173/Control-finanzas-app/` (sin `#access_token` ni `?token_hash` en la URL) e iniciar sesión normalmente.

Expected: la app muestra el login y, tras autenticar, el dashboard — exactamente igual que antes de este cambio. No debe quedar una pantalla en blanco permanente (`checkingLink` debe pasar a `false` incluso cuando no hay ningún link que procesar, porque la rama `else` del `if` en `procesarLinkDeCorreo()` siempre llama `setCheckingLink(false)`).

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "fix: usar token_hash para invite/recovery, evita consumo por escáneres de correo"
```

---

### Task 2: Timeouts y permisos en GitHub Actions

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Agregar `timeout-minutes` al job `build` de deploy.yml**

En `.github/workflows/deploy.yml:17-20`, reemplazar:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
```

por:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
```

- [ ] **Step 2: Agregar `timeout-minutes` al job `deploy` de deploy.yml**

En `.github/workflows/deploy.yml:40-43` (ahora desplazado +1 línea por el Step 1 — buscar por contenido, no por número de línea), reemplazar:

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
```

por:

```yaml
  deploy:
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 5
    environment:
```

- [ ] **Step 3: Agregar `permissions: contents: read` a ci.yml**

En `.github/workflows/ci.yml:1-7`, reemplazar:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  build:
```

por:

```yaml
name: CI

on:
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  build:
```

- [ ] **Step 4: Validar sintaxis YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML válido')"`

Expected: `YAML válido` (sin excepción). Si `python3`/`yaml` no están disponibles en el entorno, alternativamente confirmar visualmente que la indentación de los bloques nuevos (`timeout-minutes:`, `permissions:`) coincide exactamente con el nivel de indentación de las claves hermanas ya existentes en cada archivo (`runs-on:` para los `timeout-minutes`, `on:`/`jobs:` para `permissions:` en ci.yml).

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml .github/workflows/ci.yml
git commit -m "ci: agregar timeout-minutes a los jobs y permissions explícitos a CI"
```

---

### Task 3: Build final, PR y merge

**Files:** ninguno nuevo — solo verificación y flujo de git/GitHub.

- [ ] **Step 1: Build final**

Run: `npm run build`
Expected: build exitoso, sin errores.

- [ ] **Step 2: Push de la rama**

```bash
git push -u origin <nombre-de-la-rama-usada-para-este-trabajo>
```

- [ ] **Step 3: Crear PR**

Usar la herramienta de GitHub (`create_pull_request`) contra `Yisbel-Finanzas/Control-finanzas-app`, `base: main`, título `fix: token_hash en invite/recovery + timeouts de CI`, cuerpo describiendo el cambio (vulnerabilidad de escáneres de correo, mecanismo `token_hash`/`verifyOtp`, retrocompatibilidad, timeouts de Actions) y mencionando que la plantilla de correo de Supabase debe actualizarse por separado (paso manual, pendiente de confirmar el proyecto correcto) para que el flujo nuevo entre en efecto — referenciar el spec en `docs/superpowers/specs/2026-10-03-auth-token-hash-ci-timeouts-design.md`.

- [ ] **Step 4: Verificar el check de build y mergear**

Usar `pull_request_read` (`get_check_runs`) hasta que el check `build` esté `completed`/`success`, luego `merge_pull_request` (`squash`) a `main`.
