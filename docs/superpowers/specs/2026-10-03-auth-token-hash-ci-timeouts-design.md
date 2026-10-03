# Fix de seguridad invite/recovery (token_hash) + timeouts de CI

## Contexto

Comparando este repositorio contra `jhta712-max/Finanzas_IngJohTaAr` (fork más adelantado de la misma app, backend de Supabase distinto), se identificó un conjunto grande de features pendientes de portar (Dashboard: anomalías/recurrentes/disponible real; Cuentas: límite de crédito y transferencias; Deudas: financiera cuota fija; Metas: aportes y reglas de ahorro automático; Sugerencias de movimiento desde correos bancarios; etc.). Dado el tamaño, se decidió descomponer en sub-proyectos independientes. Este es el primero: el único que no depende de qué proyecto de Supabase se use, porque es puro código de cliente/CI — seguro de aplicar ya.

## Objetivo

1. Cerrar una vulnerabilidad real en el flujo de invitación/recuperación de contraseña: hoy un escáner de enlaces de correo (Gmail, antivirus corporativo, etc.) puede consumir el token de invite/recovery automáticamente al visitar el link, sin que la usuaria haga nada — invalidando el link antes de que lo use.
2. Agregar `timeout-minutes` a los jobs de GitHub Actions para evitar que un job colgado consuma minutos de Actions indefinidamente.

## Fuera de alcance

- No se toca `supabase/functions/analizar-gastos/index.ts` ni `src/hooks/useAnalisisIA.js` — ya son idénticos entre ambos repos (confirmado por diff), no hay nada que portar ahí.
- No se actualiza la plantilla de correo de invitación/recuperación en el dashboard de Supabase — es un paso manual separado, fuera del alcance de este cambio de código, pendiente hasta confirmar el proyecto de Supabase correcto.
- No se porta `backup.yml` (dump de la base de datos a una rama del repo) — decisión explícita previa del usuario: este repositorio es público y no debe contener datos de Supabase.
- No se tocan `vite.config.js`, `index.html`, `public/404.html`, `src/main.jsx`, `Login.jsx` — sus diffs contra el otro repo son solo identidad de app/dominio (nombre, `base`, URL de redirect), ya correctos en este repo.

## Cambio 1: Flujo invite/recovery con `token_hash`

### Mecanismo

Supabase Auth soporta dos formatos para los links de invitación/recuperación:
- **Formato viejo (actual):** hash fragment `#access_token=...&type=invite`. `supabase-js` lo resuelve automáticamente apenas el cliente carga — un `GET` anónimo de un escáner de enlaces ya dispara esa resolución, sin ejecutar JS de la página.
- **Formato nuevo:** query params `?token_hash=...&type=invite` (o `recovery`). No se resuelve solo — requiere una llamada explícita a `supabase.auth.verifyOtp({ token_hash, type })`, que solo corre si el navegador ejecuta el JavaScript de la página. Un escáner automatizado que solo sigue el link (sin ejecutar JS) no consume el token.

### Cambios en `src/App.jsx`

- Renombrar `detectAuthFlow()` a `detectAuthFlowFromHash()` (detección del formato viejo, sin cambios de lógica interna).
- Nuevo estado `checkingLink` (default `true`) — evita renderizar la app antes de resolver el link, para no mostrar un flash del dashboard si había un `token_hash` pendiente de canjear.
- En el `useEffect` de montaje, nueva función `procesarLinkDeCorreo()`:
  - Lee `token_hash` y `type` de `window.location.search` (`URLSearchParams`).
  - Si ambos existen y `type` es `'invite'` o `'recovery'`: llama `supabase.auth.verifyOtp({ token_hash, type })`, limpia la query string con `window.history.replaceState(null, '', window.location.pathname)`, y si no hubo error, `setAuthFlow(type)`.
  - Si no: cae al comportamiento actual, `setAuthFlow(detectAuthFlowFromHash())` (retrocompatible con links viejos ya enviados o aún no actualizados en las plantillas de correo).
  - Al terminar (cualquier rama): `setCheckingLink(false)`.
- Mientras `checkingLink` es `true`: `return null` (no renderizar nada) antes de la lógica existente de `authFlow`/`session`.
- El resto del componente (render de `SetPassword`, rutas, etc.) no cambia — `SetPassword.jsx` ya es idéntico entre ambos repos, no requiere modificación.

### Por qué es seguro desplegar ya

El cambio es puramente aditivo: si las plantillas de correo del proyecto de Supabase siguen generando links con `#access_token=...` (formato viejo, porque las plantillas no se han actualizado), `token_hash`/`type` nunca aparecen en la query string, y el código cae directo a `detectAuthFlowFromHash()` — el comportamiento actual, sin cambios. El flujo nuevo solo se activa cuando exista un link que efectivamente use `?token_hash=...`, lo cual depende de que las plantillas de correo se actualicen — paso manual, posterior, en el dashboard de Supabase del proyecto correcto (pendiente de confirmar).

## Cambio 2: Timeouts en GitHub Actions

### `.github/workflows/deploy.yml`

- Job `build`: agregar `timeout-minutes: 15`.
- Job `deploy`: agregar `timeout-minutes: 5`.

### `.github/workflows/ci.yml`

- Agregar a nivel de workflow:
  ```yaml
  permissions:
    contents: read
  ```

Sin cambios funcionales en los pasos existentes de ningún workflow — solo los límites de tiempo y el permiso explícito (principio de menor privilegio: el CI de este repo solo lee código, no necesita permisos de escritura).

## Testing

Manual (no hay suite de tests automatizados en el proyecto):
1. `npm run build` sin errores.
2. Login normal (sin `token_hash` ni hash fragment en la URL) funciona exactamente igual que antes — se ve el dashboard tras autenticarse.
3. Simular un link viejo con `#access_token=...&type=recovery` (si se tiene uno de prueba, o inspeccionando manualmente que `detectAuthFlowFromHash()` sigue corriendo cuando no hay `token_hash` en query) — debe mostrar `SetPassword` igual que antes.
4. Confirmar que `npm run build` no reporta warnings nuevos relacionados a este cambio.
5. Verificar que los workflows YAML son sintácticamente válidos (GitHub Actions los valida al hacer push; revisar la pestaña Actions tras el merge).

No se puede probar el flujo `token_hash` end-to-end sin que las plantillas de correo del proyecto de Supabase ya lo generen — eso queda pendiente para cuando se actualicen las plantillas (fuera de este cambio).
