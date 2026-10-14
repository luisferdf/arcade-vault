# SPEC 14 — Seguridad básica (headers, RLS, Auth y validación de credenciales)

> **Estado:** aprobado
> **Depende de:** 04-supabase-setup (clientes y `proxy.ts`), 06-leaderboard-catalogo-supabase (tabla `scores`), 13-auth-supabase (registro, `profiles`, funciones `security definer`)
> **Fecha:** 2026-10-13
> **Objetivo:** Aplicar el checklist de seguridad básico (`references/security/checklist.md`): headers de seguridad en Next.js, avisos de Supabase resueltos o aceptados, política de contraseñas y límite de signups configurados, validación con regex de email y contraseña en la UI antes de llamar a Supabase, y protección de las rutas de cuenta con `proxy.ts` (el antiguo `middleware.ts` de Next.js).

## Por qué existe esta spec

El checklist (`references/security/checklist.md`) lista medidas básicas pendientes. Estado verificado el 2026-10-13:

- **RLS:** ya activo con políticas en `games`, `scores` y `profiles` (spec 04/06/13). Solo se verifica.
- **`get_advisors` (security)** reporta: `rls_policy_always_true` en `scores_insert_public`; `rls_auto_enable()` y `username_available()` ejecutables por `anon` y `authenticated`; `auth_leaked_password_protection` desactivada.
- **`next.config.ts`** no define `headers()`.
- **`proxy.ts`** (en Next 16 reemplaza a `middleware.ts`) solo refresca la sesión de Supabase vía `updateSession()`; ninguna ruta está protegida (decisión de la spec 13). `/auth/nueva-contrasena` y `/auth/nombre` ya redirigen a `/auth` desde el cliente, con parpadeo.
- **Auth:** la contraseña mínima y los requisitos de complejidad viven en el dashboard de Supabase; el cliente no valida nada más allá del mínimo, así que se envían a Supabase contraseñas que se sabe que serán rechazadas.

## Prerrequisitos manuales (los hace el usuario, no el agente)

Auth no se configura vía MCP. En el dashboard de Supabase (proyecto `zxzqcdscjgwkponoqpiv`), antes del paso 4 del plan:

- **Authentication → Sign In / Providers → Email → Password requirements:** longitud mínima = 8 y requisitos = _"Lowercase, uppercase letters, digits and symbols (recommended)"_.
- **Authentication → Rate Limits → "Rate limit for sign-ups and sign-ins":** 10 por 5 minutos por IP (por defecto es 30).

Sin esto, los pasos 1–3 se pueden implementar igual; el paso 4 funciona en el cliente, pero el servidor no reforzaría la misma regla.

## Alcance

**Incluido:**

- **Headers de seguridad** en `next.config.ts` (`headers()`, `source: '/(.*)'`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security: max-age=31536000; includeSubDomains` y `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **RLS:** verificar que `games`, `scores` y `profiles` tienen RLS activo.
- **`scores_insert_public`:** reemplazar el `WITH CHECK (true)` por una condición mínima (score no negativo, nombre con formato válido, `game_id` existente). El insert sigue siendo público (los invitados guardan scores).
- **`rls_auto_enable()`:** revocar `EXECUTE` a `public`, `anon` y `authenticated` (función creada por Supabase, no usada por la app).
- **`username_available()`:** se mantiene ejecutable por `anon`/`authenticated` y el aviso se documenta como riesgo aceptado.
- **Configuración manual de Auth** (ver prerrequisitos): mínimo 8, requisitos de complejidad, límite de signups por IP.
- **Validación con regex en el cliente**, en `lib/auth.ts` (helpers puros):
  - **Email:** formato válido y máximo 254 caracteres. Se valida en crear cuenta, iniciar sesión y `/auth/recuperar`.
  - **Contraseña:** mínimo 8 y máximo 72 caracteres, con al menos una minúscula, una mayúscula, un dígito y un símbolo. Se valida **solo al crear cuenta** y en `/auth/nueva-contrasena` (ambas fijan una contraseña nueva). Login no valida complejidad.
- **UI:** si el email o la contraseña no cumplen, se muestra un mensaje de error en español bajo el campo y **no se llama a Supabase**. Legible en tema claro y oscuro y en móvil (360 px).
- **Protección de rutas con `proxy.ts`** (no `middleware.ts`: en Next 16 se renombró; ver `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). `updateSession()` pasa a devolver también si hay sesión, y `proxy()` redirige antes del render:
  - `/auth/nueva-contrasena` y `/auth/nombre` sin sesión → `/auth`.
  - `/auth` con sesión → `/`.
  - El resto de rutas sigue público, incluido `/juego/[id]/jugar` (los invitados siguen jugando y guardando scores).
  - Comprobación optimista (solo sesión sí/no, con `getClaims()`); no consulta `profiles`. Las redirecciones por perfil (`/auth/nombre` con perfil → `/`) siguen en la página.
  - Las redirecciones conservan las cookies de sesión refrescadas.
- Actualizar `CLAUDE.md` (sección Auth/seguridad, `proxy.ts` ya no "no protege ninguna ruta") y marcar el checklist.
- informacion de proxy aqui: https://nextjs.org/docs/app/getting-started/proxy
Ejemplo proxy.ts :
 ```ts 
 import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function proxy(request: NextRequest) {
  return NextResponse.redirect(new URL('/home', request.url))
}

// Alternatively, you can use a default export:
// export default function proxy(request: NextRequest) { ... }

export const config = {
  matcher: '/about/:path*',
}
 ```

**Fuera de alcance (para specs futuros):**

- Exigir sesión en `/juego/[id]/jugar` o en cualquier otra ruta de juego (eliminaría a los invitados).
- Protección basada en perfil o roles dentro de `proxy.ts`.
- **Leaked password protection:** requiere plan Pro de Supabase; queda pendiente y documentado.
- `Content-Security-Policy` (puede romper scripts inline de Next, Supabase, OAuth y fuentes; spec propia).
- Validación de score máximo por juego / anti-trampas (no hay validación del lado servidor).
- Mover `username_available` a un schema no expuesto o a un route handler.
- CAPTCHA, MFA, SMTP propio.
- Rate limiting propio en la app (`/api/contact`, scores).
- Tests automatizados (no hay test runner).

## Modelo de datos

**Migración 3 — `scores_insert_public` con condición mínima (vía MCP `apply_migration`).** Antes de aplicarla, el agente revisa el formato real de `name` (modal de `GamePlayerClient.tsx` y los 15 scores existentes) y fija la regex del nombre para que todos los nombres válidos de hoy pasen. Forma esperada:

```sql
drop policy "scores_insert_public" on public.scores;

create policy "scores_insert_public" on public.scores
  for insert to anon, authenticated
  with check (
    score >= 0
    and name ~ '<regex del nombre confirmada en el paso 2>'
    and exists (select 1 from public.games g where g.id = game_id)
  );
```

El trigger `before insert` (`scores_apply_identity`) corre antes de evaluar el `WITH CHECK`, así que con sesión el `name` ya es el `username` del perfil.

**Migración 4 — revocar `rls_auto_enable()`:**

```sql
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
```

Antes de aplicarla, `execute_sql` confirma de dónde cuelga la función (`pg_event_trigger`) y que revocar no la rompe (los event triggers se ejecutan como owner).

**Headers (`next.config.ts`):**

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];
// nextConfig.headers: async () => [{ source: "/(.*)", headers: securityHeaders }]
```

**TypeScript (`lib/auth.ts`, funciones puras):**

```ts
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // límite de bcrypt

// Símbolos = los que reconoce Supabase en "Password requirements".
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"|<>?,./`~]).{8,72}$/;

export function validateEmail(email: string): string | null; // mensaje en español o null
export function validatePassword(password: string): string | null; // indica el primer requisito que falta
```

**Proxy (`lib/supabase/proxy.ts` + `proxy.ts`):** `updateSession()` guarda el resultado de `getClaims()` y lo devuelve junto a la respuesta; `proxy()` decide:

```ts
// lib/supabase/proxy.ts
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse; // lleva las cookies refrescadas
  hasSession: boolean; // claims?.sub presente
}>;

// proxy.ts
const REQUIRE_SESSION = ["/auth/nueva-contrasena", "/auth/nombre"]; // sin sesión → /auth
const REDIRECT_IF_SESSION = ["/auth"]; // con sesión → /
// Coincidencia exacta de pathname: /auth/callback y /auth/recuperar NO se tocan.
```

Al redirigir, las cookies de `response` se copian a la `NextResponse.redirect(...)` para no perder el refresco de sesión. El `matcher` actual no cambia.

Convenciones:

- La regex de contraseña del cliente y la opción del dashboard deben exigir lo mismo; si Supabase cambia su set de símbolos, se actualiza la constante.
- Mensajes de error en español, tono arcade, p. ej. `LA CONTRASEÑA NECESITA UNA MAYÚSCULA`, `EMAIL NO VÁLIDO`.
- `authErrorMessage` mapea `weak_password` por `error.code` a un mensaje equivalente (red de seguridad si el servidor rechaza algo que el cliente dejó pasar).

## Plan de implementación

1. **Headers de seguridad.** Añadir `headers()` en `next.config.ts` con los 5 headers. Prueba manual: `npm run build && npm run start`, `curl -I http://localhost:3000/` y `curl -I http://localhost:3000/juego/snake` muestran los 5 headers; Inicio, Biblioteca, Juego, Jugar, Salón, About y Auth cargan sin errores de consola.

2. **Migración 3 (`scores_insert_public`).** Verificar RLS activo en las 3 tablas (`execute_sql` sobre `pg_class.relrowsecurity`), revisar el formato de `name`, aplicar con `apply_migration`. Prueba manual (`execute_sql` con rol anon, datos de prueba que se limpian después): insert válido funciona; `score = -1` falla; `game_id` inexistente falla; nombre con caracteres no permitidos falla; los 15 scores previos siguen visibles. Guardar un score como invitado y con sesión sigue funcionando en la app.

3. **Migración 4 (`rls_auto_enable`).** Confirmar con `execute_sql` qué es la función, aplicar el `revoke` con `apply_migration`. Prueba manual: `get_advisors` (security) ya no lista `rls_auto_enable`; la app y el registro siguen funcionando.

4. **Validación con regex en la UI.** Añadir las constantes y `validateEmail`/`validatePassword` a `lib/auth.ts`; usarlas en `app/auth/page.tsx` (crear cuenta: email + contraseña; login: solo email y contraseña no vacía), `app/auth/recuperar/page.tsx` (email) y `app/auth/nueva-contrasena/page.tsx` (contraseña nueva + repetir). Si falla, mensaje bajo el campo y sin llamada a Supabase. Prueba manual (con el Network del navegador abierto): `abc`, `abcdefgh`, `ABCDEFGH1`, `Abcdefg1` (sin símbolo) y una de 73 caracteres muestran su error y no generan petición a `auth/v1`; `Abcdef1!` pasa la validación del cliente; un email sin `@` o sin dominio muestra error; revisar en 360 px y en tema claro y oscuro.

5. **Protección de rutas con `proxy.ts`.** Leer la doc de Next 16 (`16-proxy.md`) y la de autenticación antes de tocar código. Cambiar `updateSession()` para devolver `{ response, hasSession }` y añadir la lógica de redirección en `proxy()` (rutas en el modelo de datos), copiando las cookies a la redirección. Prueba manual: sin sesión (ventana de incógnito) `/auth/nueva-contrasena` y `/auth/nombre` redirigen a `/auth` sin parpadeo (comprobar con `curl -I`: respuesta 307 con `location: /auth`); con sesión `/auth` redirige a `/`; `/auth/callback`, `/auth/recuperar`, `/`, `/biblioteca`, `/salon`, `/about` y `/juego/snake/jugar` cargan sin sesión; el flujo de recuperación (correo → callback → `/auth/nueva-contrasena`) sigue funcionando; el flujo OAuth sin perfil (callback → `/auth/nombre`) sigue funcionando; la sesión se sigue refrescando (no se pierde al navegar).

6. **Configuración manual en el dashboard (usuario).** Aplicar los prerrequisitos manuales. Prueba manual: intentar un signup con una contraseña que pasa el cliente pero se salta la regla (p. ej. con `curl` directo a `auth/v1/signup` con `abcdefgh`) → el servidor la rechaza con `weak_password`; `get_advisors` (security) solo conserva `username_available` (aceptado) y `auth_leaked_password_protection` (pendiente Pro).

7. **Documentación.** Actualizar `CLAUDE.md` (headers en `next.config.ts`, validación en `lib/auth.ts`, política de `scores` y avisos aceptados, rutas protegidas en `proxy.ts` y corrección de la línea "no route is protected") y marcar los ítems cumplidos en `references/security/checklist.md`. Prueba manual: `npm run build` y `npm run lint` pasan.

## Criterios de aceptación

- [ ] `curl -I` de `/` y de una ruta interna devuelve `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` y `Permissions-Policy`.
- [ ] `games`, `scores` y `profiles` tienen `relrowsecurity = true`.
- [ ] La política `scores_insert_public` ya no usa `WITH CHECK (true)`; `get_advisors` (security) no reporta `rls_policy_always_true`.
- [ ] Un insert anónimo en `scores` con `score` negativo, `game_id` inexistente o nombre de formato inválido falla.
- [ ] Guardar un score como invitado y con sesión sigue funcionando; los 15 scores previos siguen visibles en el Salón.
- [ ] `get_advisors` (security) no reporta `rls_auto_enable` y la app (registro incluido) funciona igual.
- [ ] `username_available` sigue ejecutable por `anon` (el registro valida el nombre antes de `signUp`).
- [ ] En el dashboard: mínimo 8, requisitos "minúsculas, mayúsculas, dígitos y símbolos" y 10 signups/5 min por IP (verificado por el usuario).
- [ ] Una contraseña que incumple la regla (sin mayúscula, minúscula, dígito, símbolo, o < 8, o > 72) muestra error en español bajo el campo al crear cuenta y en `/auth/nueva-contrasena`, y **no genera ninguna petición** a `auth/v1`.
- [ ] Un email con formato inválido muestra error en español en crear cuenta, login y `/auth/recuperar`, sin petición a Supabase.
- [ ] Login con una contraseña de cuenta existente (aunque sea más débil que la regla) no se bloquea por la regex.
- [ ] Una petición directa a `auth/v1/signup` con una contraseña débil es rechazada por el servidor (`weak_password`) y la UI muestra un mensaje en español si llega ese error.
- [ ] Sin sesión, `/auth/nueva-contrasena` y `/auth/nombre` responden con redirección a `/auth` desde `proxy.ts` (`curl -I` → 307, `location: /auth`).
- [ ] Con sesión, `/auth` redirige a `/`.
- [ ] Sin sesión siguen cargando `/`, `/biblioteca`, `/salon`, `/about`, `/auth/recuperar`, `/auth/callback` y `/juego/[id]/jugar`; "JUGAR COMO INVITADO" sigue permitiendo jugar y guardar score.
- [ ] Los flujos de recuperación de contraseña y de OAuth sin perfil (→ `/auth/nombre`) siguen funcionando con el proxy activo.
- [ ] La sesión se sigue refrescando en `proxy.ts` (las cookies de sesión no se pierden en las redirecciones).
- [ ] Los mensajes de error se leen bien en móvil (360 px) y en tema claro y oscuro.
- [ ] `get_advisors` (security) solo conserva avisos aceptados y documentados: `username_available` y `auth_leaked_password_protection` (pendiente de plan Pro).
- [ ] Sin errores en la consola del navegador durante registro, login, recuperación y navegación general.
- [ ] `npm run build` compila sin errores y `npm run lint` pasa.

## Decisiones tomadas y descartadas

- **Sí:** headers = los 3 del checklist + `Strict-Transport-Security` + `Permissions-Policy`. Razón: decisión del usuario; bajo riesgo de romper la app.
- **No:** `Content-Security-Policy` en esta spec. Razón: puede romper scripts inline de Next, Supabase, OAuth y fuentes; spec propia.
- **Sí:** reemplazar `WITH CHECK (true)` de `scores_insert_public` por una condición mínima. Razón: decisión del usuario; limpia el aviso y frena datos basura obvios sin romper a los invitados.
- **No:** tope máximo de score por juego. Razón: sin validación del lado servidor requiere una spec anti-trampas.
- **Sí:** revocar `EXECUTE` de `rls_auto_enable()`. Razón: decisión del usuario; la creó Supabase y la app no la necesita.
- **Sí:** mantener `username_available()` público y documentar el aviso como aceptado. Razón: el registro la necesita antes de tener sesión; los nombres ya son públicos en el Salón.
- **No:** mover `username_available` a un schema no expuesto o a un route handler. Razón: más código sin ganancia real de seguridad.
- **Sí:** leaked password protection queda pendiente. Razón: requiere plan Pro de Supabase; decisión del usuario.
- **Sí:** configuración de Auth (mínimo 8, complejidad, límite de signups = 10 por 5 min por IP) como pasos manuales del usuario. Razón: no se puede aplicar por MCP.
- **Sí:** regex de contraseña en el cliente = misma regla que el dashboard (min 8, minúscula, mayúscula, dígito, símbolo) más máximo 72. Razón: decisión del usuario; evitar enviar a Supabase contraseñas que se sabe que serán rechazadas. El máximo 72 es el límite de bcrypt.
- **Sí:** regex de contraseña solo al crear cuenta y en `/auth/nueva-contrasena`; login no la valida. Razón: decisión del usuario (validar al crear cuenta); una cuenta existente con contraseña más débil no debe quedar bloqueada, y `/auth/nueva-contrasena` fija una contraseña nueva que el servidor rechazaría igual.
- **Sí:** el servidor sigue siendo la autoridad; la validación del cliente solo evita peticiones inútiles. Razón: el cliente no es confiable.
- **Sí:** proteger solo las rutas de cuenta (`/auth/nueva-contrasena`, `/auth/nombre`, y `/auth` con sesión) en `proxy.ts`. Razón: decisión del usuario (opción a); elimina el parpadeo de las redirecciones hechas en el cliente sin tocar el modelo de invitados.
- **No:** exigir sesión en `/juego/[id]/jugar`. Razón: decisión del usuario; mantiene "JUGAR COMO INVITADO" de la spec 13. Si algún día se quiere, spec propia.
- **Sí:** esta protección va en la spec 14 y no en una aparte. Razón: decisión del usuario; es un cambio pequeño en dos archivos.
- **Sí:** se usa `proxy.ts`, no `middleware.ts`. Razón: en Next 16 el middleware se renombró a proxy (aclarado por el usuario).
- **Sí:** comprobación optimista con `getClaims()` (sesión sí/no) y sin consultar `profiles`. Razón: la doc de Next indica que el proxy no debe ser la única defensa ni hacer fetch lento; el perfil sigue validándose en la página y en el trigger de `scores`.
- **Nota de proceso:** la spec se redactó de una sola vez, no sección por sección, a pedido del usuario ("crea el spec y revisamos ahí"). Solo la cabecera se mostró antes de escribirla.

## Riesgos identificados

| Riesgo                                                                                              | Mitigación                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `X-Frame-Options: DENY` o HSTS rompen algún embed o el acceso por HTTP en dev (ngrok, IP local).    | HSTS solo se aplica sobre HTTPS (los navegadores lo ignoran en HTTP); probar rutas en local y en el despliegue; sin `preload`.                                |
| El regex de `name` en la política de `scores` rechaza nombres válidos de invitados o de `profiles`. | Revisar el modal y los 15 scores existentes antes de aplicar; el criterio exige que guardar como invitado y con sesión siga funcionando.                      |
| El `WITH CHECK` se evalúa antes del trigger y rechaza el nombre que el trigger iba a corregir.      | En Postgres los triggers `BEFORE INSERT` corren antes del `WITH CHECK` de RLS; se prueba con sesión enviando un nombre distinto al `username`.                |
| `revoke` de `rls_auto_enable()` rompe un event trigger de Supabase.                                 | Confirmar su origen en `pg_event_trigger` antes; los event triggers se ejecutan como owner, no como `anon`/`authenticated`.                                   |
| El set de símbolos del cliente difiere del de Supabase (el cliente acepta, el servidor rechaza).    | Usar el set documentado por Supabase; `weak_password` mapeado a un mensaje en español como red de seguridad.                                                  |
| La regex de contraseña rechaza espacios u otros caracteres válidos para el servidor.                | Solo exige los 4 grupos y la longitud; no restringe los demás caracteres.                                                                                     |
| El límite de 10 signups/5 min por IP afecta a varias personas tras la misma IP (red compartida).    | Valor ajustable en el dashboard; el error de límite se traduce y se muestra en español (ya cubierto en spec 13).                                              |
| Una redirección del proxy descarta las cookies de sesión refrescadas y cierra la sesión.            | Copiar las cookies de la respuesta de `updateSession()` a la `NextResponse.redirect`; criterio de aceptación sobre el refresco de sesión.                     |
| Bucle de redirecciones (`/auth` ↔ otra ruta) o bloqueo del flujo de recuperación/OAuth.             | Coincidencia exacta de ruta; `/auth/callback` y `/auth/recuperar` fuera de la lista; sesión sin perfil en `/auth` va a `/` (el Nav ofrece "ELIGE TU NOMBRE"). |
| `getClaims()` valida el JWT localmente: una sesión revocada puede pasar hasta que expire el token.  | Aceptado: es una comprobación optimista; los datos sensibles siguen protegidos por RLS y los triggers.                                                        |
| Leaked password protection sigue desactivada hasta tener plan Pro.                                  | Documentado como pendiente; la complejidad obligatoria reduce el riesgo mientras tanto.                                                                       |

## Lo que **no** está en esta spec

- Leaked password protection (plan Pro).
- `Content-Security-Policy`.
- Validación de score máximo / anti-trampas.
- Mover `username_available` fuera de la API expuesta.
- CAPTCHA, MFA, SMTP propio.
- Rate limiting propio en la app (`/api/contact`, scores).
- Exigir sesión para jugar (`/juego/[id]/jugar`) o protección por perfil/roles en el proxy.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
