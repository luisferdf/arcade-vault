# SPEC 06 — Leaderboard y catálogo de juegos en Supabase

> **Estado:** aprobado
> **Depende de:** 04-supabase-setup (clientes de Supabase ya configurados), 05-juego-asteroides (motor real de Asteroides)
> **Fecha:** 2026-08-11
> **Objetivo:** Migrar el catálogo de juegos (`lib/games.ts`) y las puntuaciones (`localStorage`) a tablas reales de Supabase (`games` y `scores`), con leaderboard global y por juego calculados desde datos reales, sin requerir login todavía.

## Alcance

**Incluido:**

- Tablas nuevas en Postgres (Supabase) vía migración SQL: `games` (catálogo) y `scores` (puntuaciones), con RLS habilitado.
- Seed (dentro de la misma o siguiente migración) insertando los 9 juegos que hoy están en `lib/games.ts` (mismos `id`, `title`, `short`, `long`, `cat`, `cover`, `color`) — `best`/`plays` no se guardan como columnas, se calculan desde `scores`.
- `lib/games.ts`: se elimina el array `GAMES` hardcodeado y la función `seededScores`. Se reemplaza por funciones que consultan Supabase (server-side, usando `lib/supabase/server.ts`) para: listar juegos con `best`/`plays` calculados, obtener un juego por `id`, y obtener el top N de `scores` (global o filtrado por `game_id`).
- `lib/scores.ts`: se elimina `getStoredScores`/`addStoredScore` (localStorage). Se reemplaza por una función que inserta una fila en `scores` vía el cliente de Supabase de browser (`lib/supabase/client.ts`), con `user_id: null` siempre (no hay login todavía).
- `app/page.tsx` (Home) y `app/biblioteca/page.tsx`: pasan a recibir la lista de juegos desde Supabase (fetch server-side) en vez de importar `GAMES` estático; el filtrado por búsqueda/categoría se mantiene client-side sobre los datos ya cargados.
- `app/juego/[id]/page.tsx` (Detalle): sigue siendo Server Component; consulta el juego por `id` y su leaderboard real (top 10) filtrado por `game_id`, reemplazando `seededScores(hashSeed(id))`. Esto cubre el requisito de leaderboard **por juego**.
- `app/salon/page.tsx` (Salón de la Fama): consulta el top real de `scores` global (todos los juegos mezclados) desde Supabase, reemplazando `seededScores(GLOBAL_SEED, 30)` + lectura de `localStorage`. Esto cubre el leaderboard **global**.
- `app/juego/[id]/jugar/page.tsx`: al guardar puntuación (`saveScore`), inserta en `scores` vía Supabase en vez de `addStoredScore`. Necesita el `game.id` real desde Supabase (ya no desde el array estático).
- RLS: `games` con `select` público y sin `insert`/`update`/`delete` desde el cliente (el seed se carga por migración, no por la app). `scores` con `select` público e `insert` público (anónimo permitido, `user_id` nullable), sin `update`/`delete` desde el cliente.

**Fuera de alcance (para specs futuros):**

- Login/auth real con Supabase Auth — `user_id` en `scores` queda siempre `null` en esta spec.
- Dar motor real jugable a los otros 8 juegos — siguen usando el `game-arena` simulado, sin cambios de esa lógica.
- Migrar los datos que hoy existen en `localStorage` (`av_scores`) a Supabase — se descartan.
- Contar partidas jugadas que no terminan en un score guardado (`plays` = `COUNT(*)` de filas en `scores`, no un tracking de sesiones).
- Panel de administración para crear/editar juegos desde la UI.
- Cambios visuales/de diseño en Biblioteca, Detalle, Salón o el modal de guardado — el HTML/CSS existente se mantiene, solo cambia el origen de los datos.

## Modelo de datos

**Tabla `games`** (migración SQL nueva):

```sql
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games_select_public"
  on public.games for select
  to anon, authenticated
  using (true);
```

**Tabla `scores`**:

```sql
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id),
  user_id uuid null references auth.users(id),
  name text not null,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index scores_game_id_score_idx on public.scores (game_id, score desc);
create index scores_score_idx on public.scores (score desc);

alter table public.scores enable row level security;

create policy "scores_select_public"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores for insert
  to anon, authenticated
  with check (true);
```

**Seed** (misma migración o una siguiente): `insert into public.games (id, title, short, long, cat, cover, color) values (...)` con las 9 filas actuales de `lib/games.ts` (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroides`, `ranaria`, `duelo-pixel`).

**Tipos TypeScript nuevos** (reemplazan `Game`/`ScoreEntry` de `lib/games.ts`, mismos nombres para minimizar cambios en componentes):

```ts
export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number; // calculado: MAX(score) de scores para ese game_id, 0 si no hay filas
  plays: string; // calculado: COUNT(*) de scores para ese game_id, formateado igual que hoy (ej. "15.6K")
}

export interface ScoreEntry {
  rank: number;
  name: string;
  score: number;
  date: string; // formateado desde created_at
}
```

`CATS` (`["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"]`) se mantiene como constante en código, no en la base de datos.

## Plan de implementación

1. Crear la migración SQL de `games` (tabla + `enable row level security` + policy de `select` pública) y aplicarla al proyecto Supabase (`zxzqcdscjgwkponoqpiv`) vía `apply_migration`. Prueba manual: `list_tables` muestra `games` vacía; una query `select` anónima funciona, un `insert` desde el cliente anon falla por RLS.

2. Crear la migración SQL de `scores` (tabla + índices + policies de `select` e `insert` públicas) y aplicarla. Prueba manual: `list_tables` muestra `scores`; un `insert` de prueba vía SQL funciona y un `select` posterior lo devuelve.

3. Insertar el seed de los 9 juegos actuales de `lib/games.ts` en `games` (vía migración o `execute_sql`). Prueba manual: `select id, title from games` devuelve las 9 filas con los mismos `id` que usan hoy las rutas (`/juego/asteroides`, etc.).

4. Reescribir `lib/games.ts`: eliminar `GAMES` y `seededScores`; agregar `getGames()`, `getGameById(id)`, `getTopScoresByGame(gameId, limit)` y `getGlobalTopScores(limit)` usando `createClient()` de `lib/supabase/server.ts`, calculando `best`/`plays` por agregación sobre `scores`. Mantener `CATS`, `Game` y `ScoreEntry` con la misma forma que hoy. Prueba manual: `tsc --noEmit` sin errores; nada importa las funciones nuevas todavía.

5. Reescribir `lib/scores.ts`: eliminar `getStoredScores`/`addStoredScore`; agregar `saveScore({ gameId, name, score })` que hace `insert` en `scores` vía `createClient()` de `lib/supabase/client.ts` (browser), con `user_id: null`. Prueba manual: `tsc --noEmit` sin errores.

6. Convertir `app/biblioteca/page.tsx` y `app/page.tsx` en Server Components que hacen `await getGames()` y pasan la lista a un componente cliente hijo (`BibliotecaClient`/secciones de Home que usan `GAMES`) que conserva la búsqueda/filtro/animaciones actuales sin cambios de UI. Prueba manual: Biblioteca y Home muestran los 9 juegos reales desde Supabase; buscar y filtrar por categoría sigue funcionando igual que antes.

7. Actualizar `app/juego/[id]/page.tsx`: reemplazar `GAMES.find`/`seededScores` por `getGameById(id)` y `getTopScoresByGame(id, 10)`. Prueba manual: el Detalle de `asteroides` muestra info real y un leaderboard vacío (aún no hay partidas guardadas); un `id` inexistente sigue devolviendo `notFound()`.

8. Convertir `app/juego/[id]/jugar/page.tsx` en un Server Component que hace `await getGameById(id)` y pasa `game` como prop a un componente cliente (`GamePlayerClient`) que conserva toda la lógica actual (HUD, pausa, motor de Asteroides), y reemplazar `addStoredScore` por `saveScore(...)` de `lib/scores.ts`. Prueba manual: jugar, perder, guardar puntuación con nombre, sin errores de consola.

9. Actualizar `app/salon/page.tsx`: reemplazar `seededScores` + `getStoredScores` por `getGlobalTopScores(30)` desde Supabase. Prueba manual: el Salón muestra el ranking global real (vacío o con las partidas guardadas hasta el momento), sin datos falsos.

10. Verificación final: `npm run build` compila sin errores de TypeScript; recorrido completo Biblioteca → Detalle (`asteroides`) → Reproductor → Game Over → Guardar → la puntuación aparece en el Detalle de `asteroides` y en el Salón; recorrido de otro juego mock (ej. `bloque-buster`) confirma que sigue usando el `game-arena` simulado y que guardar su puntuación también funciona contra Supabase.

## Criterios de aceptación

- [ ] Existe una tabla `games` en Supabase con RLS habilitado, `select` público y sin `insert`/`update`/`delete` permitido desde el cliente anónimo.
- [ ] Existe una tabla `scores` en Supabase con RLS habilitado, `select` e `insert` públicos, sin `update`/`delete` permitido desde el cliente.
- [ ] `games` contiene las 9 filas correspondientes a los juegos actuales (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `asteroides`, `ranaria`, `duelo-pixel`).
- [ ] `lib/games.ts` ya no exporta `GAMES` (array estático) ni `seededScores`; expone `getGames()`, `getGameById()`, `getTopScoresByGame()` y `getGlobalTopScores()` consultando Supabase.
- [ ] `lib/scores.ts` ya no usa `localStorage`; `saveScore()` inserta una fila real en `scores` vía el cliente de Supabase de browser.
- [ ] La Biblioteca (`/biblioteca`) muestra los 9 juegos desde Supabase, y la búsqueda por nombre y el filtro por categoría siguen funcionando igual que antes.
- [ ] La Home (`/`) muestra los juegos destacados desde Supabase en la sección "JUEGOS DISPONIBLES AHORA".
- [ ] El Detalle de cada juego (`/juego/[id]`) muestra `best`/`plays` calculados desde `scores` (0 y "0" si el juego no tiene partidas guardadas) y un leaderboard real (top 10) filtrado por ese juego.
- [ ] El Salón de la Fama (`/salon`) muestra el ranking global real (mezcla de todos los juegos) desde `scores`, sin datos falsos de `seededScores`.
- [ ] Al terminar una partida (en `asteroides` o en cualquier otro juego mock) y guardar la puntuación con nombre, se inserta una fila real en `scores` con `user_id: null`.
- [ ] Una puntuación guardada aparece reflejada tanto en el Detalle del juego correspondiente como en el Salón de la Fama, sin necesitar una recarga manual incorrecta (navegación normal de Next.js).
- [ ] `npm run build` compila sin errores de TypeScript.
- [ ] No hay errores en la consola del navegador durante el recorrido Biblioteca → Detalle → Reproductor → Game Over → Guardar → Detalle/Salón.
- [ ] Los datos previamente guardados en `localStorage` (`av_scores`) ya no se leen ni se muestran en ninguna pantalla.

## Decisiones tomadas y descartadas

- **Sí:** Se migran `games` y `scores` a Supabase en esta spec, cerrando el pendiente dejado explícitamente por la spec 04. Razón: decisión explícita del usuario.
- **Sí:** Se siembran los 9 juegos actuales (no solo `asteroides`) en `games`, aunque solo `asteroides` tenga motor real jugable. Razón: decisión explícita del usuario — evitar reducir visualmente el catálogo; qué motor usar (real vs. simulado) sigue siendo una decisión de código por `id`, no de la base de datos.
- **Sí:** `games.id` es `text` (mismo slug que usa hoy el código: `asteroides`, `rocas`, etc.), no `uuid`. Razón: decisión explícita del usuario para no reescribir rutas ni referencias existentes (`/juego/[id]`, `lib/games/asteroids.ts`).
- **Sí:** `scores.game_id` es una FK real a `games.id` con constraint de integridad. Razón: decisión explícita del usuario, más seguro que el string libre que usaba `localStorage`.
- **No:** No se requiere login/Supabase Auth para guardar una puntuación en esta spec; `scores.user_id` queda siempre `null`. Razón: decisión explícita del usuario — la autenticación real se implementará en una spec futura.
- **Sí:** `best`/`plays` se calculan por agregación desde `scores` (`MAX(score)`, `COUNT(*)`) en vez de guardarse como columnas fijas en `games`. Razón: decisión explícita del usuario, evita datos duplicados/desincronizados.
- **Sí:** `plays` cuenta únicamente partidas donde el jugador guardó su puntuación (`COUNT(*)` de `scores`), no cada sesión jugada. Razón: decisión explícita del usuario — más simple, sin necesidad de una tabla o evento adicional de tracking.
- **No:** No se migran los datos mock de `seededScores` ni los que hoy existen en `localStorage` a Supabase. Razón: decisión explícita del usuario — ambos son datos de prueba del MVP, se descartan; las tablas arrancan vacías (salvo el seed de `games`) y crecen con partidas reales.
- **Sí:** El leaderboard "por juego" se resuelve en la página de Detalle existente (`/juego/[id]`), no como una pantalla nueva separada del Salón de la Fama. Razón: decisión explícita del usuario ("Global + por juego"); el Detalle ya tenía una sección de leaderboard mock, se reutiliza el mismo lugar en la UI.
- **Sí:** Las páginas `app/page.tsx`, `app/biblioteca/page.tsx` y `app/juego/[id]/jugar/page.tsx` se dividen en Server Component (fetch de datos) + Client Component (interactividad), en vez de fetchear desde el cliente vía route handler. Razón: sigue el patrón ya establecido en `app/juego/[id]/page.tsx` (Server Component `async`) y evita exponer una API HTTP adicional solo para leer `games`/`scores`.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                                                                              | Mitigación                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RLS mal configurado permite `insert`/`update`/`delete` no deseado en `games`, o `update`/`delete` en `scores` desde el cliente anónimo                                                                                                                              | Verificar explícitamente cada policy con una prueba manual (paso 1 y 2 del plan) antes de seguir; solo existen policies de `select` en `games` y de `select`/`insert` en `scores`.                              |
| `insert` público sin autenticación en `scores` permite que cualquiera guarde puntuaciones falsas o arbitrariamente altas, ensuciando el leaderboard                                                                                                                 | Aceptado como riesgo conocido para esta spec (no hay login todavía); se documenta para cuando se implemente auth real, que podría restringir `insert` a usuarios autenticados o agregar validación server-side. |
| Calcular `best`/`plays` con agregación en cada carga de página (sin caché) puede ser lento si `scores` crece mucho                                                                                                                                                  | Los índices `scores_game_id_score_idx` y `scores_score_idx` cubren las queries de agregación y de top-N; no se requiere optimización adicional con el volumen esperado del MVP.                                 |
| Migrar `app/page.tsx`, `app/biblioteca/page.tsx` y `app/juego/[id]/jugar/page.tsx` de "use client" puro a Server+Client Component puede romper la interactividad existente (búsqueda, animaciones `reveal`, HUD del Reproductor) si el split no se hace con cuidado | El paso 6, 8 y 10 del plan exigen probar manualmente que búsqueda/filtro/animaciones/HUD siguen funcionando igual que antes de la spec.                                                                         |
| Si la migración SQL falla a mitad de camino (ej. `scores` se crea pero el seed de `games` no se aplica), el catálogo queda vacío y rompe todas las pantallas que dependen de `getGames()`                                                                           | Aplicar las migraciones en el orden del plan (games → scores → seed) y verificar con `list_tables`/`execute_sql` después de cada paso antes de tocar código de la app.                                          |
