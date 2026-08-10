# SPEC 04 — Setup de infraestructura Supabase

> **Estado:** implementado
> **Depende de:** Ninguno (usa el proyecto Supabase ya referenciado en `.mcp.json`, sin dependencias de specs anteriores)
> **Fecha:** 2026-08-10
> **Objetivo:** Dejar el proyecto conectado a Supabase (SDK, clientes de browser/servidor y refresco de sesión vía `proxy.ts`) sin implementar ninguna funcionalidad de auth ni de datos todavía.

## Alcance

**Incluido:**

- Dependencias nuevas en `package.json`: `@supabase/supabase-js` y `@supabase/ssr`.
- `lib/supabase/client.ts`: cliente de Supabase para browser (`createBrowserClient`), usando `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/server.ts`: cliente de Supabase para Server Components / Route Handlers (`createServerClient` + `cookies()` de `next/headers`).
- `lib/supabase/proxy.ts`: función `updateSession(request)` que refresca el token de sesión vía `supabase.auth.getClaims()` y propaga las cookies actualizadas.
- `proxy.ts` en la raíz del proyecto: importa `updateSession` y lo expone como `proxy()` (convención de Next.js 16, reemplaza al extinto `middleware.ts`), con un `matcher` que excluye assets estáticos (`_next/static`, `_next/image`, `favicon.ico`, imágenes).
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` agregadas a `.env.example` (placeholders vacíos) y a `.env.local` (valores reales del proyecto `zxzqcdscjgwkponoqpiv`, ya obtenidos vía MCP).
- Verificación de que `npm run build` compila sin errores con los archivos nuevos en el árbol, aunque nada los importe todavía.

**Fuera de alcance (para specs futuros):**

- Cualquier UI de login/registro real (`app/auth/page.tsx` sigue siendo mock en esta spec).
- Cualquier tabla, esquema o RLS en la base de datos Postgres del proyecto.
- Migrar el Salón de la Fama (`av_scores`) o el catálogo de juegos (`lib/games.ts`) a Supabase.
- Proteger rutas o redirigir según sesión en `proxy.ts` (por ahora solo refresca el token, no bloquea nada).
- Métodos de login (email/password, OAuth) — se definirán cuando se implemente la funcionalidad real.
- Tratar el archivo `base` en la raíz del repo (contiene lo que parece un secreto commiteado) — señalado aparte, no es parte de esta spec.

## Modelo de datos

Esta spec no introduce estructuras de datos nuevas (no se crean tablas ni tipos en `lib/`).

## Plan de implementación

1. Instalar `@supabase/supabase-js` y `@supabase/ssr` en `package.json`. Prueba manual: `npm install` corre sin errores.
2. Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr`. Prueba manual: el archivo compila (`tsc --noEmit`), no se importa desde ninguna página todavía.
3. Crear `lib/supabase/server.ts` con `createClient()` async usando `createServerClient` + `cookies()` de `next/headers`. Prueba manual: compila sin errores de tipos.
4. Crear `lib/supabase/proxy.ts` con `updateSession(request)`: instancia `createServerClient` con las cookies del request, llama a `supabase.auth.getClaims()` y devuelve la `NextResponse` con las cookies refrescadas. Prueba manual: compila sin errores de tipos.
5. Crear `proxy.ts` en la raíz del proyecto, que importa `updateSession` desde `@/lib/supabase/proxy`, la expone como `export async function proxy(request)`, y define `export const config = { matcher: [...] }` excluyendo `_next/static`, `_next/image`, `favicon.ico` e imágenes. Prueba manual: `npm run dev` levanta sin errores y navegar por cualquier ruta existente (`/`, `/biblioteca`, `/about`) sigue funcionando igual que antes.
6. Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` (vacíos) a `.env.example`, y los valores reales del proyecto `zxzqcdscjgwkponoqpiv` a `.env.local` (gitignorado). Prueba manual: `git status` no muestra `.env.local` como archivo a commitear.
7. Ejecutar `tsc --noEmit` sobre todo el proyecto para confirmar que ni los archivos nuevos ni los ya existentes (páginas, componentes, `lib/games.ts`, etc.) reportan errores de TypeScript. Prueba manual: la salida del comando no lista errores.
8. Verificación final: `npm run build` completa sin errores con toda la infraestructura nueva en el árbol, y ninguna de las 8 pantallas existentes cambia su comportamiento. Prueba manual: recorrer Biblioteca, Detalle, Reproductor, Auth, Salón, Home, About — sin errores en consola.

## Criterios de aceptación

- [x] `@supabase/supabase-js` y `@supabase/ssr` están en `dependencies` de `package.json`.
- [x] `lib/supabase/client.ts` exporta `createClient()` usando `createBrowserClient`.
- [x] `lib/supabase/server.ts` exporta `createClient()` async usando `createServerClient` y `cookies()` de `next/headers`.
- [x] `lib/supabase/proxy.ts` exporta `updateSession(request)` que llama a `supabase.auth.getClaims()` y devuelve la respuesta con cookies refrescadas.
- [x] `proxy.ts` existe en la raíz del proyecto, exporta `proxy()` (no `middleware()`) y usa `updateSession`.
- [x] `.env.example` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` sin valores.
- [x] `.env.local` contiene los valores reales del proyecto `zxzqcdscjgwkponoqpiv` y no aparece en `git status`.
- [x] `tsc --noEmit` no reporta errores en todo el proyecto.
- [x] `npm run build` completa sin errores.
- [x] Las 8 pantallas existentes (Biblioteca, Detalle, Reproductor, Auth, Salón, Home, About, redirect `/home`) funcionan exactamente igual que antes de esta spec, sin errores en consola del navegador.
- [x] Ningún archivo de `app/` importa `lib/supabase/*` todavía (la infraestructura queda lista pero sin usar).

## Decisiones tomadas y descartadas

- **Solo infraestructura, sin funcionalidad:** se decidió separar el setup de Supabase (SDK, clientes, proxy) de su uso real (login, scores) para poder revisar/aprobar la conexión antes de tocar UI o datos de usuarios. La funcionalidad se hará en specs futuros dedicados.
- **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en vez de `NEXT_PUBLIC_SUPABASE_ANON_KEY`:** se usa la key pública moderna (`sb_publishable_...`) recomendada actualmente por Supabase para proyectos nuevos, en vez de la legacy `anon` (JWT), aunque ambas están disponibles en el proyecto.
- **`lib/supabase/` en vez de `utils/supabase/`:** se sigue la convención ya establecida en el proyecto (`lib/games.ts`), en vez del nombre `utils/` que aparece en ejemplos más antiguos de Supabase.
- **Sin esquema de base de datos todavía:** se descartó crear tablas (`profiles`, `scores`) en esta spec — el proyecto Supabase queda vacío en cuanto a datos, y el esquema se definirá junto con la spec que implemente la funcionalidad real que lo necesite.
- **`proxy.ts` sin lógica de protección de rutas:** solo refresca el token de sesión (`getClaims`); no redirige ni bloquea ninguna ruta en esta spec, ya que no hay auth real que proteger todavía.
- **No se toca el archivo `base` en la raíz:** aunque contiene lo que parece un secreto commiteado al repo, queda fuera de esta spec por decisión explícita del usuario; se trata como un tema aparte.

## Riesgos identificados

- **`.env.local` con credenciales reales:** si `.gitignore` fallara en excluirlo, se filtrarían las credenciales del proyecto Supabase. Mitigación: verificar `git status` explícitamente en el paso 6 del plan (ya está en los criterios de aceptación).
- **`matcher` de `proxy.ts` demasiado amplio:** al correr en casi todas las rutas, un error en `updateSession` podría romper la navegación de las 7 pantallas existentes aunque no usen Supabase. Mitigación: el paso 8 del plan exige recorrer manualmente todas las pantallas antes de dar la spec por terminada.
- **Cambio futuro de key recomendada:** Supabase está migrando de `anon key` (JWT legacy) a `publishable key`; si el proyecto remoto llegara a deshabilitar la publishable key usada aquí, la app dejaría de autenticar silenciosamente. No se mitiga en esta spec (fuera de alcance), pero queda documentado para specs futuros que dependan de auth real.
