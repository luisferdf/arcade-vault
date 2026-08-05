# SPEC 01 — MVP visual de Arcade Vault

> **Estado:** implementado
> **Depende de:** Ninguno
> **Fecha:** 2026-08-04
> **Objetivo:** Construir las 5 pantallas visuales del MVP (Biblioteca, Detalle de juego, Reproductor, Auth, Salón de la Fama) migrando el diseño de `references/templates/` a Next.js 16 + Tailwind v4, sin implementar lógica real de ningún juego.

## Alcance

**Incluido:**

- 5 pantallas: Biblioteca (catálogo de juegos), Detalle de juego, Reproductor (CRT simulado), Auth (login/registro), Salón de la Fama.
- Rutas reales de Next.js App Router: `app/page.tsx`, `app/juego/[id]/page.tsx`, `app/juego/[id]/jugar/page.tsx`, `app/salon/page.tsx`, `app/auth/page.tsx`.
- Migración del diseño de `references/templates/` a utilidades de Tailwind v4, con tokens de tema (`@theme` en `globals.css`) para colores neón, fuentes pixel/mono, glows y animaciones.
- Componentes compartidos en `app/_components/`: `Nav`, `GameCard`, `LeaderboardRow`, `GameOverModal`, etc.
- Datos mock tipados en `lib/games.ts` (8 juegos ficticios, categorías, generador de puntuaciones simuladas).
- Sesión de usuario simulada vía `localStorage` (login/registro/invitado), sin validación real de credenciales.
- Puntuaciones del Reproductor simuladas (timer falso, modal de fin de juego, guardado en `localStorage`) y reflejadas en el Salón de la Fama.
- Navegación responsive (navbar con menú hamburguesa en móvil), fiel a los breakpoints del template.

**Fuera de alcance (para specs futuros):**

- Lógica real de cualquiera de los 8 juegos (Bloque Buster, Caída, Serpentina, etc.).
- Backend/autenticación real (API, base de datos, sesiones de servidor).
- Persistencia de puntuaciones compartida entre usuarios/dispositivos (leaderboard real).
- Login social real (Google/GitHub) — los botones son solo decorativos.
- Sistema de créditos/monedas funcional (el contador en el nav queda como mock estático).
- Sonido/música.
- Tests automatizados.

## Modelo de datos

Este spec introduce datos mock tipados en `lib/games.ts`, sin persistencia en servidor.

```ts
interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string;   // clase CSS/identificador del arte de portada generado
  color: string;   // acento de color asociado (cyan, magenta, yellow, green)
  best: number;
  plays: string;   // ej. "12.4K"
}

const GAMES: Game[] = [ /* 8 juegos, igual que el template */ ];
const CATS = ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];

interface ScoreEntry {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/AAAA"
}

function seededScores(seed: number, count?: number): ScoreEntry[];
```

Datos persistidos en `localStorage` (client-side, sin versionado — es MVP visual):

```ts
// clave: "av_user"
interface StoredUser { name: string }

// clave: "av_scores"
interface StoredScoreEntry { game: string; score: number; name: string; at: number }
```

Convenciones:

- IDs de juego en `kebab-case` (ej. `bloque-buster`).
- Colores de acento y clases `cover-*` se mapean 1:1 a utilidades/tokens Tailwind definidos en `@theme`.

## Plan de implementación

1. Definir tokens de tema en `app/globals.css` con el bloque `@theme` de Tailwind v4 (colores neón, fuentes pixel/mono, variables de glow) y cargar las fuentes (Press Start 2P, JetBrains Mono) en `app/layout.tsx`. Prueba manual: la app sigue compilando y corriendo sin cambios visuales aún.
2. Crear `lib/games.ts` con las interfaces `Game`/`ScoreEntry`, el array `GAMES` (8 juegos), `CATS` y `seededScores`. Prueba manual: `tsc`/build no falla, se puede importar desde cualquier página.
3. Crear `app/_components/Nav.tsx` (logo, links, contador de créditos mock, botón auth, menú hamburguesa responsive) y montarlo en `app/layout.tsx` junto con el footer. Prueba manual: navbar visible en `/` con menú funcional en móvil.
4. Crear `app/_components/GameCard.tsx` e implementar `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría, grid de `GameCard` filtrable. Prueba manual: buscar/filtrar cambia el grid en el navegador.
5. Implementar `app/juego/[id]/page.tsx` (Detalle): portada, tags, descripción, stat strip, botones de acción y tabla de leaderboard usando `seededScores`. Prueba manual: navegar desde una `GameCard` lleva al detalle correcto.
6. Implementar `app/auth/page.tsx` (Auth): tabs login/registro, botón "jugar como invitado", envío simulado que guarda `av_user` en `localStorage` y redirige a Biblioteca. Prueba manual: iniciar sesión cambia el estado del Nav (nombre de usuario visible).
7. Implementar `app/juego/[id]/jugar/page.tsx` (Reproductor): HUD (puntuación/vidas/nivel), CRT con arena falsa animada, pausa, botón "Fin" y modal de game over que guarda en `av_scores`. Prueba manual: jugar, pausar, terminar y guardar puntuación sin errores en consola.
8. Implementar `app/salon/page.tsx` (Salón de la Fama): podio top 3 + tabla completa, resaltando la fila del usuario actual si tiene puntuaciones guardadas. Prueba manual: tras guardar una puntuación en el paso 7, aparece reflejada aquí.
9. Pasada de pulido responsive: verificar los breakpoints del template (menú hamburguesa, grid de tarjetas, tabla de salón) en las 5 pantallas y ajustar utilidades Tailwind donde falten. Prueba manual: revisar cada pantalla en viewport móvil y desktop.

## Criterios de aceptación

- [x ] `app/page.tsx` muestra el catálogo de 8 juegos mock con buscador y chips de categoría funcionales (filtran el grid).
- [ x] Cada `GameCard` navega a `app/juego/[id]/page.tsx` con la información correcta del juego (título, descripción, mejor puntuación).
- [x ] `app/juego/[id]/page.tsx` muestra una tabla de leaderboard generada con `seededScores` para ese juego.
- [ x] Desde el detalle se puede entrar a `app/juego/[id]/jugar/page.tsx`.
- [ ] En el Reproductor, la puntuación sube sola con un timer simulado, el botón de pausa detiene el incremento, y el botón "Fin" abre el modal de game over.
- [ x] Guardar la puntuación en el modal de game over la persiste en `localStorage` (`av_scores`) sin recargar la página.
- [ x] `app/auth/page.tsx` permite "iniciar sesión" con cualquier usuario/contraseña y redirige a Biblioteca, mostrando el nombre de usuario en el Nav.
- [ x] El botón "Jugar como invitado" en Auth entra sin requerir credenciales.
- [ x] `app/salon/page.tsx` muestra el podio top 3 y una tabla de posiciones, resaltando la fila del usuario actual si guardó alguna puntuación.
- [ x] El Nav muestra menú hamburguesa funcional en viewport móvil (< 840px) y los links normales en desktop.
- [ x] No hay errores en la consola del navegador al navegar entre las 5 pantallas.
- [ x] `npm run build` (o `next build`) compila sin errores de TypeScript.

## Decisiones tomadas y descartadas

- **Sí:** Rutas reales de Next.js App Router en vez de router por hash. Razón: es lo idiomático en Next 16 y da URLs limpias/compartibles; el template usaba hash solo por ser una demo estática sin servidor.
- **No:** Mantener el router por hash del template. Descartado por no ser idiomático en App Router y complicar el SEO/deep-linking a futuro.
- **Sí:** Migrar los estilos a utilidades Tailwind v4 con tokens en `@theme`, en vez de portar `styles.css` tal cual. Razón: coherencia con el resto del proyecto (ya usa Tailwind v4 CSS-first) aunque implique más esfuerzo de migración.
- **Sí:** Mantener `localStorage` para usuario y puntuaciones, igual que el template. Razón: es un MVP visual, no hay backend aún; permite demostrar el flujo completo sin infraestructura adicional.
- **Sí:** Interfaces explícitas (`Game`, `ScoreEntry`) en `lib/games.ts`. Razón: el proyecto usa TypeScript strict; tipar explícitamente evita `any` implícitos y documenta la forma de los datos mock.
- **Sí:** Componentes compartidos en `app/_components/` en vez de `components/` en la raíz. Razón: sigue la convención de carpetas privadas del App Router, manteniendo la UI junto a las rutas que la consumen.
- **Sí:** Reconstruir las pantallas de Detalle y Salón de la Fama a partir de las clases CSS existentes (`.av-detail`, `.leaderboard`, `.av-hall`, `.podium`, `.hall-table`) y de cómo `App` las invocaba, dado que los archivos de referencia para esas dos pantallas no contenían su contenido real (los nombres de archivo en `references/templates/` estaban desplazados respecto a su contenido).
- **No:** Pausar el spec para corregir los archivos de referencia. Descartado por el usuario para no bloquear el avance; se documenta como riesgo.

## Riesgos identificados

| Riesgo                                                                 | Mitigación                                                                                          |
| ------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------ |
| Las pantallas de Detalle y Salón de la Fama se reconstruyen sin el .jsx original, pudiendo diferir del diseño previsto por el usuario | Revisar visualmente contra las clases CSS (`.av-detail`, `.leaderboard`, `.av-hall`, `.podium`, `.hall-table`) durante la implementación; el usuario revisa el resultado antes de aprobar el spec como Implementado |
| `localStorage` deshabilitado (modo privado/incógnito)                 | La app sigue funcionando en memoria durante la sesión; solo se pierde la persistencia al recargar, sin romper la UI |
| Migrar clip-path/glow/animaciones custom del template a utilidades Tailwind puede perder fidelidad visual | Usar `@theme` para centralizar tokens y comparar visualmente cada pantalla contra el mockup HTML original antes de dar por cerrado cada paso del plan |

## Lo que **no** está en este spec

- Lógica real de cualquiera de los 8 juegos.
- Backend/autenticación real (API, base de datos, sesiones de servidor).
- Persistencia de puntuaciones compartida entre usuarios/dispositivos.
- Login social real (Google/GitHub).
- Sistema de créditos/monedas funcional.
- Sonido/música.
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
