# SPEC 13 — Autenticación con Supabase (registro, login, recuperación y perfiles)

> **Estado:** aprobado
> **Depende de:** 01-mvp-visual (pantalla `/auth` mock), 04-supabase-setup (clientes Supabase y `proxy.ts`), 06-leaderboard-catalogo-supabase (tabla `scores`)
> **Fecha:** 2026-10-02
> **Objetivo:** Reemplazar el login falso de `localStorage` por autenticación real con Supabase (email+contraseña con confirmación, Google y GitHub, recuperación de contraseña, cierre de sesión y nombre de jugador único en `profiles`) y vincular los scores al usuario autenticado.

## Por qué existe esta spec

Hoy `/auth` guarda un nombre en `localStorage` (`lib/auth.ts`, clave `av_user`): cualquiera puede ser cualquiera y `scores.user_id` es siempre `null`. La spec 04 dejó lista la infraestructura (clientes, `proxy.ts` refrescando la sesión) sin usarla. Esta spec la usa y hace que el nombre que aparece en el Salón de la Fama pertenezca a una cuenta real.

## Prerrequisitos manuales (los hace el usuario, no el agente)

Auth no se configura vía MCP. Antes del paso 3 del plan, en el dashboard de Supabase (proyecto `zxzqcdscjgwkponoqpiv`):

- **Authentication → URL Configuration:** `Site URL` = URL de producción; `Redirect URLs` incluye `http://localhost:3000/auth/callback` y `<URL de producción>/auth/callback`.
- **Authentication → Providers → Email:** `Confirm email` activado; longitud mínima de contraseña = 8.
- **Authentication → Providers → Google y GitHub:** habilitados con su `Client ID` / `Client Secret`. En Google Cloud Console y en la OAuth App de GitHub, la callback autorizada es `https://zxzqcdscjgwkponoqpiv.supabase.co/auth/v1/callback`.

Sin Google/GitHub configurados, los pasos 1–6 se pueden implementar y probar igual; solo el paso 7 los necesita.

## Alcance

**Incluido:**

- **Registro** con nombre de jugador + email + contraseña, con confirmación de email obligatoria (pantalla "revisa tu correo" con botón de reenviar).
- **Login** con email + contraseña.
- **Login/registro con Google y GitHub** (los botones que hoy están sin función).
- **Nombre de jugador único** guardado en `public.profiles`. Reglas: 3–10 caracteres, `A-Z 0-9 _`, guardado en mayúsculas, único.
- **Primer login con Google/GitHub sin perfil:** pantalla `/auth/nombre` donde se elige el nombre de jugador antes de continuar.
- **Recuperar contraseña:** `/auth/recuperar` (pide el email) y `/auth/nueva-contrasena` (fija la nueva).
- **Cerrar sesión** desde el Nav (desktop y panel móvil).
- **Ruta `app/auth/callback/route.ts`:** intercambia el `code` (PKCE) por sesión para confirmación de email, OAuth y recuperación, y redirige a donde corresponda.
- **`scores` vinculados al usuario:** con sesión, el servidor (trigger) fija `user_id` y `name` desde `profiles`; el cliente ya no decide su identidad. Invitado sigue funcionando (`user_id` null) con la restricción de que no puede usar el nombre de un usuario registrado.
- **Sesión en la UI:** `AuthProvider` (contexto cliente sobre `supabase.auth`) que consumen `Nav` y `GamePlayerClient`. Se elimina el mock de `localStorage`.
- **Botón "JUGAR COMO INVITADO"** se mantiene.
- Mensajes de error y estado en español, tono arcade, legibles en tema claro y oscuro.
- Actualizar `CLAUDE.md` (tabla de rutas, sección de datos y de auth).

**Fuera de alcance (para specs futuros):**

- Editar perfil (cambiar nombre de jugador, avatar, email, contraseña desde sesión iniciada).
- Eliminar cuenta.
- Proteger rutas: todo sigue público; `proxy.ts` solo refresca la sesión.
- Magic link / OTP / MFA.
- SMTP propio (se usa el SMTP por defecto de Supabase; ver riesgos).
- Historial de partidas por usuario, página de perfil, avatares.
- Migrar o reasignar los 15 scores existentes (quedan con `user_id` null y su `name`).
- Roles / admin.
- Tests automatizados (no hay test runner en el proyecto).

## Modelo de datos

**Migración 1 — `profiles` (Postgres, vía MCP `apply_migration`):**

```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Z0-9_]{3,10}$'),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- select público: los nombres ya son públicos en el Salón.
create policy "profiles_select_all" on public.profiles
  for select to anon, authenticated using (true);

-- insert solo de la propia fila (flujo OAuth en /auth/nombre).
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

-- Sin update ni delete desde el cliente (editar perfil queda fuera de alcance).
```

```sql
-- ¿Está libre el nombre? Se llama antes de signUp y en /auth/nombre.
create function public.username_available(p_username text)
returns boolean language sql security definer set search_path = ''
as $$ select not exists (select 1 from public.profiles where username = upper(p_username)) $$;

grant execute on function public.username_available(text) to anon, authenticated;
```

```sql
-- Registro por email: signUp envía el nombre en options.data.username.
-- Crea el perfil en el mismo instante (aún no hay sesión por la confirmación de email).
-- Registro OAuth: no hay `username` en metadata → no se crea perfil; lo crea /auth/nombre.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.raw_user_meta_data ->> 'username' is not null then
    insert into public.profiles (id, username)
    values (new.id, upper(new.raw_user_meta_data ->> 'username'));
  end if;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

**Migración 2 — identidad de `scores` fijada por el servidor:**

```sql
create function public.scores_apply_identity()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare uid uuid := auth.uid();
begin
  if uid is not null then
    select username into new.name from public.profiles where id = uid;
    if not found then raise exception 'profile_required'; end if;
    new.user_id := uid;
  else
    new.user_id := null;
    if exists (select 1 from public.profiles where username = upper(new.name)) then
      raise exception 'name_reserved';
    end if;
  end if;
  return new;
end $$;

create trigger scores_identity
  before insert on public.scores
  for each row execute function public.scores_apply_identity();
```

La política RLS de insert de `scores` (pública, de la spec 06) no cambia: el trigger pisa `user_id` y `name` cuando hay sesión.

**TypeScript:**

```ts
// lib/auth.ts (reemplaza al mock; solo tipos y helpers puros)
export interface AuthUser {
  id: string;
  email: string;
  username: string | null; // null = sesión sin perfil (OAuth sin /auth/nombre completado)
}

// app/_components/AuthProvider.tsx
interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean; // true hasta resolver getUser() + perfil en el montaje
  signOut: () => Promise<void>;
}
```

Convenciones:

- `username` siempre en mayúsculas; el cliente lo normaliza con `toUpperCase()` antes de validar y enviar.
- El parámetro `next` del callback solo acepta rutas relativas que empiezan por `/` y no por `//`; si no, se usa `/`.
- Regex de validación del nombre compartida entre cliente y migración: `^[A-Z0-9_]{3,10}$`.

## Plan de implementación

1. **Migración 1 (`profiles`, `username_available`, `handle_new_user`).** Aplicar con `apply_migration`. Prueba manual: `list_tables` muestra `profiles` con RLS; `execute_sql` `select public.username_available('NUEVO')` → `true`; `get_advisors` (security) sin avisos nuevos. La app no cambia.

2. **Migración 2 (`scores_apply_identity`).** Aplicar con `apply_migration`. Prueba manual: con `execute_sql` (rol anon) un insert con `name = 'INVITADO'` funciona y deja `user_id` null; insertar en `profiles` un nombre de prueba y luego un insert anónimo con ese nombre lanza `name_reserved`; limpiar los datos de prueba. El guardado de scores en la app sigue funcionando para invitados.

3. **`AuthProvider` + `Nav` con sesión real.** Crear `app/_components/AuthProvider.tsx` (contexto cliente: `getUser()` + lectura de `profiles` + `onAuthStateChange`), montarlo en `app/layout.tsx`, y hacer que `Nav` use `useAuth()` en lugar de `lib/auth.ts`. Con sesión muestra `USERNAME` y botón `SALIR` (desktop) / "Cerrar sesión" (panel móvil), que llama `signOut()`; sin sesión, "Iniciar Sesión". Sesión sin perfil: enlace "ELIGE TU NOMBRE" a `/auth/nombre`. Prueba manual: la app carga igual que antes como invitado; el `/auth` mock sigue allí pero ya no produce sesión visible (se reemplaza en el paso 4).

4. **Callback + registro y login por email.** Crear `app/auth/callback/route.ts` y reescribir `app/auth/page.tsx` (pestañas Iniciar sesión / Crear cuenta): campos nombre (solo registro), email, contraseña (mínimo 8); validación del nombre con `username_available` antes de `signUp` (con `options.data.username` y `emailRedirectTo` al callback); tras `signUp` muestra "REVISA TU CORREO" con botón de reenviar (`auth.resend`); login con `signInWithPassword`; errores traducidos (credenciales inválidas, email sin confirmar, nombre en uso, formato de nombre, límite de correos, contraseña débil). Eliminar `lib/auth.ts` (mock) dejando solo los tipos de la sección anterior. Prueba manual: registrar una cuenta real, confirmar el correo, entrar al Vault, ver el nombre en el Nav, cerrar sesión, volver a entrar.

5. **Scores con sesión.** En `lib/scores.ts`, `saveScore` deja de enviar `user_id` y devuelve `{ ok: boolean; error?: "name_reserved" | "profile_required" | "unknown" }` leyendo el error de Supabase. En `GamePlayerClient.tsx`: con sesión el nombre del modal de guardado es el `username` (no editable); invitado conserva `INVITADO`/nombre escrito. Si el insert falla, el modal muestra el mensaje en español (`ESE NOMBRE ESTÁ RESERVADO` / `ELIGE TU NOMBRE DE JUGADOR PRIMERO`). Prueba manual: con sesión guardar un score → fila en `scores` con `user_id` y `name = username`; como invitado → `user_id` null; como invitado escribir el nombre de un usuario registrado → error visible y no se guarda.

6. **Recuperar contraseña.** Crear `app/auth/recuperar/page.tsx` (email → `resetPasswordForEmail` con `redirectTo` = `/auth/callback?next=/auth/nueva-contrasena`; respuesta genérica "SI EL CORREO EXISTE, TE ENVIAMOS UN ENLACE", exista o no) y `app/auth/nueva-contrasena/page.tsx` (requiere sesión de recuperación; formulario nueva contraseña + repetir; `updateUser({ password })`; luego redirige a `/`). Enlace "¿Olvidaste tu contraseña?" en la pestaña de login. Prueba manual: pedir el correo, abrir el enlace, fijar contraseña nueva, cerrar sesión y entrar con la nueva; abrir `/auth/nueva-contrasena` sin sesión redirige a `/auth`.

7. **Google, GitHub y elección de nombre.** Conectar los botones `◆ GOOGLE` y `▣ GITHUB` con `signInWithOAuth` (`redirectTo` = `/auth/callback`). El callback, tras intercambiar el código, redirige a `/auth/nombre` si la sesión no tiene fila en `profiles`. Crear `app/auth/nombre/page.tsx`: input con validación y `username_available`, `insert` en `profiles`, luego a `/`. La página redirige a `/auth` sin sesión y a `/` si ya hay perfil. Prueba manual (requiere prerrequisitos de proveedores): entrar con Google y con GitHub desde cuenta nueva → pantalla de nombre → Nav con el nombre; nombre en uso muestra error; recargar `/auth/nombre` ya con perfil redirige a `/`.

8. **Documentación.** Actualizar `CLAUDE.md`: tabla de rutas (`/auth`, `/auth/callback`, `/auth/recuperar`, `/auth/nueva-contrasena`, `/auth/nombre`), tablas (`profiles`, triggers de `scores`), `AuthProvider`, y quitar la mención al fake login de `localStorage`. Prueba manual: `npm run build` y `npm run lint` pasan; recorrer Inicio, Biblioteca, Detalle, Jugar, Salón y About sin errores en consola.

## Criterios de aceptación

- [ ] La tabla `public.profiles` existe con RLS activo, `username` único y restricción de formato `^[A-Z0-9_]{3,10}$`.
- [ ] `get_advisors` (security) no reporta avisos nuevos atribuibles a esta spec.
- [ ] Registrar una cuenta nueva con nombre, email y contraseña (≥ 8) muestra "REVISA TU CORREO" y no inicia sesión hasta confirmar el email.
- [ ] Tras abrir el enlace de confirmación el usuario queda con sesión iniciada y su nombre aparece en el Nav.
- [ ] Registrarse con un nombre ya usado (en cualquier combinación de mayúsculas/minúsculas) muestra error en español y no envía correo.
- [ ] Un nombre con menos de 3 o más de 10 caracteres, o con caracteres fuera de `A-Z 0-9 _`, es rechazado con mensaje en español.
- [ ] Login con credenciales válidas entra; con credenciales inválidas muestra error en español; con email sin confirmar muestra un mensaje que lo indica.
- [ ] El botón de reenviar en "REVISA TU CORREO" envía otro correo o muestra el error de límite.
- [ ] "Recuperar contraseña" muestra el mismo mensaje con un email registrado y con uno que no existe.
- [ ] El enlace del correo de recuperación lleva a `/auth/nueva-contrasena`, y tras fijar la nueva contraseña se puede iniciar sesión con ella y no con la anterior.
- [ ] `/auth/nueva-contrasena` y `/auth/nombre` sin sesión redirigen a `/auth`.
- [ ] Entrar con Google y con GitHub desde una cuenta sin perfil lleva a `/auth/nombre`; tras elegir nombre el Nav lo muestra; en un segundo login ya no pasa por `/auth/nombre`.
- [ ] El botón "SALIR" (desktop) y "Cerrar sesión" (panel móvil) cierran la sesión y el Nav vuelve a "Iniciar Sesión".
- [ ] "JUGAR COMO INVITADO" lleva a `/` sin sesión y se puede jugar y guardar score.
- [ ] Con sesión, un score guardado queda en `scores` con `user_id` = id del usuario y `name` = su `username`, aunque el cliente envíe otro nombre.
- [ ] Como invitado, un score queda con `user_id` null; si el nombre coincide con un `username` registrado el insert falla con `name_reserved` y el modal lo muestra.
- [ ] Un parámetro `next` externo (`//evil.com`, `https://evil.com`) en el callback redirige a `/`.
- [ ] `lib/auth.ts` ya no usa `localStorage` ni existe la clave `av_user` en el código.
- [ ] Los 15 scores previos siguen visibles en el Salón sin cambios.
- [ ] El flujo de auth se ve y funciona en móvil (360 px) y en tema claro y oscuro.
- [ ] Sin errores en la consola del navegador durante registro, login, recuperación y cierre de sesión.
- [ ] `npm run build` compila sin errores y `npm run lint` pasa.

## Decisiones tomadas y descartadas

- **Sí:** email + contraseña **y** Google + GitHub. Razón: decisión del usuario; los botones ya existían en el diseño.
- **No:** magic link. Razón: no pedido; otro flujo de UI y de correos.
- **Sí:** nombre de jugador en `profiles` y login por email. Razón: Supabase Auth autentica por email; el nombre es una identidad pública aparte, la que ven Nav y Salón.
- **No:** login con usuario o email. Razón: exige resolver usuario→email en servidor; complejidad sin pedido.
- **Sí:** confirmación de email obligatoria. Razón: decisión del usuario; evita cuentas con correos ajenos.
- **Sí:** dejar el SMTP por defecto de Supabase. Razón: decisión del usuario; suficiente para desarrollo (ver riesgos).
- **Sí:** crear el perfil de registro por email con un trigger en `auth.users` (nombre vía `options.data.username`). Razón: con confirmación de email no hay sesión tras `signUp`, así que RLS impediría insertar el perfil desde el cliente.
- **Sí:** el perfil OAuth lo crea el propio usuario en `/auth/nombre` (insert con RLS `auth.uid() = id`). Razón: decisión del usuario (1.a); mismo flujo que el registro por email; descartado autogenerar nombres desde el proveedor.
- **Sí:** reglas de nombre 3–10, `A-Z 0-9 _`, mayúsculas, único, forzadas por `check` + `unique` en Postgres además de la validación del cliente. Razón: el cliente no es confiable; la restricción cubre carreras entre dos registros.
- **Sí:** `username_available` como función `security definer` invocable por `anon`. Razón: dar feedback antes de `signUp`. Enumerar nombres no filtra nada nuevo: ya son públicos en el Salón.
- **Sí:** `user_id` y `name` de `scores` los fija un trigger `before insert`. Razón: decisión del usuario; el cliente no puede suplantar a otro usuario.
- **Sí:** invitado no puede usar el nombre de un usuario registrado (`name_reserved`). Razón: sin ello cualquiera se hace pasar por un registrado escribiendo su nombre en el modal.
- **No:** vincular o renombrar los scores históricos con un usuario. Razón: no hay forma fiable de saber de quién eran.
- **Sí:** `AuthProvider` cliente sobre `supabase.auth` (como el store externo de tema), no lectura de sesión en el layout servidor. Razón: leer cookies en el layout forzaría render dinámico en todas las rutas; el parpadeo inicial "Iniciar Sesión" ya existía con el mock.
- **Sí:** botón `SALIR` explícito junto al nombre en vez de cerrar sesión al hacer clic en `NOMBRE ▾`. Razón: con sesión real, un clic accidental no debe cerrarla; evita construir un dropdown.
- **Sí:** la recuperación responde igual exista o no el correo. Razón: no revelar qué emails están registrados.
- **Sí:** sin protección de rutas; `proxy.ts` no cambia. Razón: decisión del usuario; todo sigue público.
- **Sí:** vinculación automática de identidades con el mismo email verificado (comportamiento por defecto de Supabase). Razón: una persona que se registró con contraseña y luego entra con Google debe seguir siendo la misma cuenta.
- **No:** editar perfil, eliminar cuenta, SMTP propio. Razón: fuera de alcance; specs propias.
- **Sí:** especificada en una sola spec aunque es grande. Razón: decisión del usuario de incluir recuperación y cierre de sesión; el plan separa email/contraseña (pasos 3–6) de OAuth (paso 7) para poder partirla.
- **Nota de proceso:** la spec se redactó de una sola vez y no sección por sección, a pedido del usuario, que la revisará al terminar.

## Riesgos identificados

| Riesgo                                                                                                                     | Mitigación                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El SMTP por defecto de Supabase tiene un límite bajo de correos por hora y puede no entregar a todos.                      | Aceptado para esta etapa (decisión del usuario). El error de límite se traduce y se muestra; antes de producción real, spec de SMTP propio (Resend ya está en el proyecto). |
| El trigger `handle_new_user` falla (nombre duplicado por carrera) y el registro devuelve "Database error saving new user". | Validación previa con `username_available`; si aun así falla, mapear ese error a "NOMBRE EN USO, ELIGE OTRO".                                                               |
| Usuario con sesión OAuth que abandona `/auth/nombre`: sesión sin perfil.                                                   | El Nav muestra "ELIGE TU NOMBRE" con enlace; `scores_apply_identity` lanza `profile_required` y el modal lo explica en vez de guardar un score anónimo por error.           |
| Redirección abierta vía `next` en `/auth/callback`.                                                                        | Solo se aceptan rutas relativas que empiezan por un único `/`; criterio de aceptación explícito.                                                                            |
| URLs de redirección mal configuradas en el dashboard → los enlaces de correo/OAuth fallan.                                 | Prerrequisitos manuales listados arriba; el plan los exige antes del paso 3 y 7.                                                                                            |
| Funciones `security definer` mal acotadas escalan privilegios.                                                             | `set search_path = ''`, nombres de tabla calificados, solo `grant execute` a lo necesario; revisar con `get_advisors`.                                                      |
| Un nombre de usuario nuevo coincide con el `name` de scores históricos de invitados.                                       | Aceptado: esos scores quedan con `user_id` null; no se reasignan.                                                                                                           |
| Parpadeo "Iniciar Sesión" → nombre al cargar (sesión resuelta en el cliente).                                              | `loading` en `AuthProvider`: el Nav no pinta ninguno de los dos estados hasta resolver, para no mostrar un estado falso.                                                    |
| Los errores de Supabase Auth cambian de texto/código entre versiones del SDK.                                              | Mapear por `error.code` (no por el mensaje) con un `default` genérico en español.                                                                                           |

## Lo que **no** está en esta spec

- Editar perfil, cambiar nombre/avatar/email/contraseña desde sesión iniciada.
- Eliminar cuenta.
- Protección de rutas o redirecciones según sesión.
- Magic link, OTP o MFA.
- SMTP propio.
- Páginas de perfil, historial por usuario o avatares.
- Reasignar los scores históricos.
- Tests automatizados.

Cada uno, si llega, va en su propia spec.
