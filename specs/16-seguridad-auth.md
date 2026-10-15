# SPEC 16 — Seguridad: endurecer el flujo de autenticación

> **Estado:** aprobado
> **Depende de:** 13-auth-supabase, 14-seguridad-basica, 15-seguridad-dependencias-contacto
> **Fecha:** 2026-10-15
> **Objetivo:** Cerrar los hallazgos de la revisión manual de autenticación del 2026-10-15: exigir reautenticación para cambiar la contraseña (_Secure password change_), corregir el `matcher` del proxy, aceptar documentadamente la enumeración de correos y limpiar la contraseña del estado de React.

## Por qué existe esta spec

Revisión de `proxy.ts`, `lib/supabase/proxy.ts`, `lib/auth.ts`, `AuthProvider`, `/auth/callback` y las páginas de `/auth/*`. Sin hallazgos críticos; PKCE, `safeNext`, `getUser()` y RLS están bien. Pendiente:

- **H1 (MEDIA):** `app/auth/nueva-contrasena/page.tsx` solo comprueba "hay sesión" (líneas 19-21) y llama a `updateUser({ password })` (línea 36). Cualquier sesión robada (XSS, equipo compartido) puede fijar una contraseña nueva sin conocer la anterior y quedarse con la cuenta. _Secure password change_ solo lo mitiga para sesiones de más de 24 h. Relacionado con SEC-011 (Secure password change, «SIN VERIFICAR» en el checklist).
- **H2 (BAJA):** `app/auth/page.tsx:123-126` responde «ESTE CORREO YA ESTÁ REGISTRADO» al registrarse con un correo existente; confirma qué correos tienen cuenta (el login ya es genérico).
- **H3 (BAJA):** `proxy.ts:26` — en un string normal `"\."` se convierte en `"."`, así que el filtro de extensiones del `matcher` es más amplio de lo previsto. No hay bypass (las rutas protegidas son pathnames exactos), pero el patrón no hace lo que dice.
- **H4 (INFO):** `pass` permanece en el estado de React en la pantalla «REVISA TU CORREO» (`app/auth/page.tsx:151-154`, reutilizada por `resend()`).
- **H5 (a verificar, solo lectura):** el trigger `on_auth_user_created` / `handle_new_user` lee `username` de `user_metadata` (controlado por el usuario); confirmar que valida la regex, es `SECURITY DEFINER` y fija `search_path`.

## Alcance

**Incluido:**

- **Dashboard de Supabase (manual, lo hace el usuario):** activar _Secure password change_ (reautenticación reciente para cambiar la contraseña). Confirmar _Redirect URLs_ sin comodines (solo dominios propios y `localhost`/ngrok de desarrollo).
- **`/auth/nueva-contrasena`:** manejar el error de reautenticación de Supabase con mensaje en español (opción A).
- **`proxy.ts`:** corregir el escape del `matcher` (`\\.` o `String.raw`).
- **`app/auth/page.tsx`:** borrar `pass` del estado al salir de la pantalla de confirmación. La enumeración en el registro se acepta como riesgo (sin cambio de código).
- **Verificación H5** con el `security-auditor` (SQL de solo lectura) y registrar el resultado en `references/security/audit-log.md`.
- Actualizar `references/security/checklist.md` (SEC-011) y `CLAUDE.md` si cambia el flujo descrito en «Auth».

**Fuera de alcance:**

- CSP (SEC-018): spec propia. Sube de prioridad porque las cookies de sesión de `createBrowserClient` no son HttpOnly; se recomienda como spec 17.
- Rate limiting propio (SEC-020), anti-trampas (SEC-021), leaked password protection (SEC-019, requiere Pro).
- Cambiar el modelo de sesión (p. ej. mover a cookies HttpOnly vía servidor).
- Pantalla de «cambiar contraseña» para usuarios con sesión normal (opción B descartada).

## Modelo de datos

Sin cambios de esquema. H5 es solo verificación; si falla, se corrige con una migración nueva (`apply_migration`) y se documenta aquí antes de aplicar.

## Plan de implementación

1. **Dashboard (usuario).** ~~Activar _Secure password change_~~ (hecho 2026-10-15). Pendiente: revisar _Redirect URLs_ (sin comodines) y anotar ambos en `checklist.md`.
2. **`/auth/nueva-contrasena`.** Opción A: leer `node_modules/next/dist/docs/` y la doc de Supabase (`search_docs`: «reauthentication», «recovery») para el comportamiento exacto de `updateUser` con _Secure password change_ activo; manejar `err.code` de reautenticación en `authErrorMessage`. Prueba manual: enlace de recuperación → cambia la contraseña; sesión normal sin reautenticación → error claro en español.
3. **`proxy.ts`.** Corregir el `matcher`. Prueba manual: `/auth/nombre` sin sesión → 307 `/auth`; `/auth` con sesión → 307 `/`; `logo.png` y `/_next/static/...` no pasan por el proxy.
4. **`app/auth/page.tsx`.** Limpiar `pass` al pulsar «INICIAR SESIÓN» en la pantalla de confirmación y en el reset del Nav (`av:auth-reset`). **No** se limpia tras `resend`: `resend()` necesita `pass` para detectar cuenta ya confirmada y reenvíos repetidos (decisión 2026-10-15) (el mensaje de correo existente no cambia). Prueba manual: registro con correo nuevo y existente; reenvío de correo; login normal.
5. **Verificación H5 y cierre.** `security-auditor`: definición de `handle_new_user`, `get_advisors`, `npm audit --omit=dev`. Registrar en `audit-log.md`.

## Criterios de aceptación

- [x] _Secure password change_ activo en el dashboard (hecho 2026-10-15). Pendiente: anotarlo en `checklist.md`.
- [ ] El flujo completo de recuperación (correo → enlace → nueva contraseña) sigue funcionando con la opción activa.
- [ ] Cambiar la contraseña desde `/auth/nueva-contrasena` funciona con el enlace de recuperación y falla con mensaje en español si no hay reautenticación/recuperación válida.
- [ ] El `matcher` de `proxy.ts` excluye solo `_next/static`, `_next/image`, `favicon.ico` y archivos `.svg/.png/.jpg/.jpeg/.gif/.webp`; las redirecciones de spec 14 siguen igual (307).
- [ ] La enumeración de correos en el registro queda registrada como riesgo aceptado (`INFO`) en `audit-log.md`; el mensaje actual no cambia.
- [ ] `pass` no permanece en el estado de React tras salir de «REVISA TU CORREO».
- [ ] `handle_new_user` valida el `username` con `^[A-Z0-9_]{3,10}$`, es `SECURITY DEFINER` y tiene `search_path` fijo (o se abre migración).
- [ ] `npm run build` y `npm run lint` pasan; login, registro, OAuth (`/auth/nombre`), recuperación y guardar score como invitado y con sesión siguen funcionando.
- [ ] `get_advisors` (security) solo lista `auth_leaked_password_protection`.

## Decisiones tomadas y descartadas

- **Nota de proceso:** borrador redactado a partir de la revisión manual del 2026-10-15, sin la entrevista de `/spec`. Las decisiones 1 y 2 ya están resueltas (abajo); queda la aprobación humana.
- **Sí (decisión 1, opción A):** activar _Secure password change_ (_Require reauthentication when changing password_) en Supabase y mantener `/auth/nueva-contrasena` solo para el flujo de recuperación. Sin código nuevo salvo el mensaje de error. Razón: la barrera debe estar en el servidor. **Hecho por el usuario el 2026-10-15.**
- **Alcance real de A (doc de Supabase):** solo exige confirmar con código por correo (`reauthenticate()` + `nonce`) si la sesión tiene más de 24 h. Una sesión robada y reciente aún puede cambiar la contraseña, así que H1 se **mitiga**, no se cierra; la barrera contra el robo de sesión es el CSP (spec 17).
- **No:** _Require current password_ en el dashboard: rompería la recuperación («olvidé mi contraseña»). Solo tendría sentido junto con la opción B.
- **No:** opción B (pantalla «cambiar contraseña» con contraseña actual para sesiones normales). Razón: no existe esa pantalla hoy; ampliaría el alcance.
- **No:** opción C (distinguir la sesión de recuperación en el cliente con `PASSWORD_RECOVERY`). Razón: una comprobación de cliente no es una barrera de seguridad.
- **Sí (decisión 2, opción ii):** mantener «ESTE CORREO YA ESTÁ REGISTRADO» y aceptar el riesgo como `INFO` en `audit-log.md`. Razón: el correo no es un dato sensible en un juego arcade, Supabase ya limita 10 sign-ups por 5 min por IP, `username_available` ya expone los nombres, y el mensaje genérico dejaría sin respuesta a quien ya tiene cuenta (no se le envía correo).
- **No:** validar la fuerza de la contraseña en servidor propio; la autoridad es la configuración de Supabase Auth (spec 13).
- **No:** `proxy.ts` hace consultas a `profiles`; sigue siendo comprobación optimista (SEC-022) y la protección real son RLS y triggers.

## Riesgos identificados

| Riesgo                                                                                  | Mitigación                                                                                           |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| _Secure password change_ rompe el flujo de recuperación (pide reautenticar).            | Probar el enlace de recuperación completo antes de dar por buena la opción A; leer doc de Supabase.  |
| Corregir el `matcher` hace que el proxy corra en rutas que antes excluía por accidente. | Prueba manual de redirecciones y de assets estáticos; solo afecta a nombres que acaban en extensión. |
| Se mantiene la enumeración de correos en el registro (riesgo aceptado).                 | Rate limit de Supabase (10 sign-ups / 5 min / IP); registrar como `INFO` aceptado en `audit-log.md`. |
| `handle_new_user` incorrecto exige migración con posible impacto en altas.              | Verificar en solo lectura primero; probar registro email y OAuth tras cualquier cambio.              |
