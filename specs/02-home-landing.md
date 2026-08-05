# SPEC 02 — Home (landing) de Arcade Vault

> **Estado:** aprobado
> **Depende de:** 01-mvp-visual (Nav, tokens de tema en `globals.css`, `lib/games.ts`)
> **Fecha:** 2026-08-05
> **Objetivo:** Reemplazar la ruta `/` (hoy la Biblioteca) por una landing page fiel a `references/templates/home.jsx`, moviendo la Biblioteca a `/biblioteca` y dejando `/home` como redirect a `/`.

## Alcance

**Incluido:**

- Nueva landing page en `app/page.tsx`, migrada de `references/templates/home.jsx` (contenido real, recuperado del bundle empaquetado), con sus 6 secciones: Hero, Por qué Arcade Vault, Juegos disponibles ahora, Stats, Actividad en vivo, Precios + FAQ, CTA final.
- Mover el contenido actual de `app/page.tsx` (Biblioteca) a `app/biblioteca/page.tsx`.
- `app/home/page.tsx`: redirect server-side a `/` (usando `redirect()` de `next/navigation`).
- Actualizar `app/_components/Nav.tsx`: el link "Inicio" apunta a `/`, el link "Biblioteca" apunta a `/biblioteca`, y la detección de ruta activa (`isActive`) se ajusta a las nuevas rutas.
- Nuevos componentes en `app/_components/` para las piezas reutilizables del Home: tarjeta de feature, mini-card de juego (preview), ticker de actividad, lista de top jugadores, tarjeta de precio.
- Ampliar `app/globals.css` con las clases CSS del Home que hoy no existen (`.home-hero`, `.home-title`, `.feature-card`, `.mini-rail`, `.mini-card`, `.home-stats`, `.activity-grid`, `.tick-row`, `.top-row`, `.pricing-grid`, `.price-card`, `.faq-item`, `.home-final`, animación `.reveal`/`useReveal`, siluetas flotantes SVG, etc.), tomadas de `styles (1).css` (líneas 930–1070 y 1621–1725).
- Preview de "Juegos disponibles ahora" usa `GAMES.slice(0, 6)` de `lib/games.ts` (ya existente), cada mini-card navega a `/juego/[id]`.
- Sección "Actividad en vivo" con datos estáticos hardcodeados (ticker de puntuaciones recientes + top 5 jugadores del día), igual que el template — sin conexión a `localStorage` ni a `seededScores`.
- Efecto de aparición al hacer scroll (`useReveal`, basado en `IntersectionObserver`) para las secciones marcadas `reveal`, igual que el template.
- Botones del Hero y CTA final navegan con `next/link`/`useRouter` a `/biblioteca` y `/auth` según corresponda.

**Fuera de alcance (para specs futuros):**

- Página "Acerca de" (`about.jsx`) y su link en el Nav — explícitamente no se implementa en este spec.
- Datos reales/dinámicos en la sección de Actividad en vivo (derivarlos de `localStorage`/`seededScores` queda para otro spec si se decide más adelante).
- Cambios de contenido/copy respecto al template (textos, precios, FAQ) — se replica tal cual.
- Cualquier lógica de juego, backend o autenticación real (ya fuera de alcance en spec 01).

## Modelo de datos

No se introducen nuevas estructuras de datos persistentes ni tipos en `lib/`. Se reutiliza `Game`/`GAMES` de `lib/games.ts` (spec 01).

La sección "Actividad en vivo" usa dos arrays literales, locales al componente de Home (no exportados, no persistidos):

```ts
// ticker de puntuaciones recientes
interface ActivityRow {
  player: string;
  game: string;
  score: number;
  time: string; // ej. "hace 2 min"
  color: "cyan" | "magenta" | "yellow" | "green";
}

// top jugadores del día
interface TopPlayerRow {
  rank: number;
  player: string;
  score: number;
}
```

Ambos arrays se copian tal cual del template (`home.jsx`), como datos de ejemplo fijos.

## Plan de implementación

1. Mover el contenido actual de `app/page.tsx` a `app/biblioteca/page.tsx` sin cambios funcionales. Prueba manual: `/biblioteca` muestra el catálogo con buscador y chips, igual que `/` mostraba antes.
2. Ampliar `app/globals.css` con las clases del Home (`.home-hero`, `.home-title`, `.hero-eyebrow`, `.home-sub`, `.home-ctas`, `.hero-scroll`, `.home-silos`, `.home-section`, `.section-head`, `.section-title`, `.section-rule`, `.feature-grid`, `.feature-card`, `.mini-rail`, `.mini-card`, `.mini-cover`, `.mini-meta`, `.home-stats`, `.stats-inner`, `.stat-block`, `.activity-grid`, `.activity-card`, `.ac-head`, `.ticker`, `.tick-row`, `.top-list`, `.top-row`, `.pricing-grid`, `.price-card`, `.pricing-faq`, `.faq-item`, `.home-final`, `.reveal`/`.reveal.in`), tomadas de `styles (1).css`. Prueba manual: el build sigue compilando sin cambios visuales todavía (clases sin uso).
3. Crear `app/_components/FeatureCard.tsx`, `MiniGameCard.tsx` (preview de juego para el rail), `ActivityTicker.tsx` y `TopPlayersList.tsx` como piezas independientes y reutilizables. Prueba manual: componentes compilan y aceptan props tipadas sin `any`.
4. Crear `app/page.tsx` con el nuevo Home: sección Hero (título, subtítulo, CTAs a `/biblioteca` y `/auth`, siluetas SVG flotantes) y hook `useReveal` para el scroll-reveal. Prueba manual: `/` muestra el Hero completo y funcional, sin errores en consola.
5. Agregar sección "Por qué Arcade Vault" (`FeatureCard` × 4) y "Juegos disponibles ahora" (`MiniGameCard` × 6 desde `GAMES.slice(0, 6)`, cada una navega a `/juego/[id]`). Prueba manual: clic en una mini-card lleva al detalle correcto del juego.
6. Agregar sección Stats (3 bloques numéricos) y sección "Actividad en vivo" (`ActivityTicker` + `TopPlayersList` con los datos de ejemplo fijos). Prueba manual: ambas secciones se ven completas y con la animación de aparición al hacer scroll.
7. Agregar sección Precios + FAQ y CTA final. Prueba manual: el botón final navega a `/biblioteca`.
8. Crear `app/home/page.tsx` que hace `redirect("/")` (Server Component, `next/navigation`). Prueba manual: visitar `/home` redirige a `/` sin parpadeo visible.
9. Actualizar `app/_components/Nav.tsx`: agregar link "Inicio" → `/`, cambiar el link "Biblioteca" para apuntar a `/biblioteca`, y ajustar `isActive`/lógica de ruta activa para las tres rutas (`/`, `/biblioteca`, `/juego/*`, `/salon`, `/auth`). Prueba manual: el link activo se resalta correctamente en cada ruta, en desktop y en el menú móvil.
10. Pasada de pulido responsive: verificar el Home en los breakpoints del template (`980px`, `900px`, `720px`, `600px`, `520px`) — grid de features, mini-rail, activity-grid, pricing-grid. Prueba manual: revisar `/` en viewport móvil y desktop sin overflow ni solapamientos.

## Criterios de aceptación

- [ ] `/` muestra la nueva landing page (Home) con las 6 secciones: Hero, Por qué Arcade Vault, Juegos disponibles ahora, Stats, Actividad en vivo, Precios + FAQ, CTA final.
- [ ] `/biblioteca` muestra el catálogo de juegos (buscador + chips + grid) que antes vivía en `/`.
- [ ] `/home` redirige automáticamente a `/`.
- [ ] Los botones "Explorar juegos" (Hero y CTA final) navegan a `/biblioteca`.
- [ ] El botón "Crear cuenta" del Hero navega a `/auth`.
- [ ] La sección "Juegos disponibles ahora" muestra 6 mini-cards desde `GAMES` y cada una navega a `/juego/[id]` con el `id` correcto.
- [ ] El botón "Ver todos los juegos" de esa sección navega a `/biblioteca`.
- [ ] El link "Ver salón →" de la sección Actividad en vivo navega a `/salon`.
- [ ] Las secciones marcadas como `reveal` aparecen con la animación de fade/translate al hacer scroll (no están visibles de golpe al cargar).
- [ ] El Nav resalta "Inicio" como activo en `/` y "Biblioteca" como activo en `/biblioteca` y en `/juego/*` (desktop y menú móvil).
- [ ] No hay errores en la consola del navegador al cargar `/`, navegar a `/biblioteca`, `/juego/[id]`, `/salon`, `/auth` y volver a `/`.
- [ ] `npm run build` (`next build`) compila sin errores de TypeScript.
- [ ] La página se ve sin overflow horizontal ni solapamientos en viewport móvil (< 520px) y desktop.

## Decisiones tomadas y descartadas

- **Sí:** Mover la Biblioteca de `/` a `/biblioteca` en vez de poner el Home en otra ruta. Razón: `/` es la URL canónica para la landing de un producto; la Biblioteca como subruta es más idiomático y coincide con lo que pidió el usuario.
- **Sí:** `/home` como redirect a `/` en vez de servir contenido duplicado. Razón: evita contenido duplicado (dos URLs con el mismo HTML) y mantiene una sola fuente de verdad para la landing; el usuario pidió explícitamente que ambas rutas lleven a la Home.
- **Sí:** Replicar las 6 secciones del Home tal cual el template, sin recortar ninguna (incluyendo Precios + FAQ, aunque el producto es gratuito — el mensaje "100% gratis" ya es parte del copy original). Razón: el usuario pidió fidelidad exacta al template.
- **Sí:** Sección "Actividad en vivo" con datos estáticos hardcodeados, igual que el template, en vez de derivarlos de `seededScores`/`localStorage`. Razón: consistente con el enfoque "MVP visual" de spec 01 (sin lógica real todavía) y así lo eligió el usuario.
- **No:** Implementar la página "Acerca de" (`about.jsx`) en este spec. Descartado explícitamente por el usuario ("no necesito la página de acerca de por los momentos"); queda para un spec futuro.
- **Sí:** Reutilizar los archivos de referencia reales encontrados dentro del bundle empaquetado (`references/templates/Home-about/nav.jsx`, cuyo contenido real es un bundle HTML autoextraíble) en vez de los archivos con nombre engañoso (`about.jsx` contenía en realidad `styles.css`, `home.jsx` contenía el componente `Nav`, etc.). Razón: ya se había documentado este problema como riesgo en spec 01; para este spec se resolvió decodificando el bundle y extrayendo el contenido real de `home.jsx`, `data.jsx`, `app.jsx` y el CSS completo, evitando reconstruir el Home a ciegas.
- **Sí:** Nuevos componentes de Home (`FeatureCard`, `MiniGameCard`, `ActivityTicker`, `TopPlayersList`) en `app/_components/`, siguiendo la convención ya establecida en spec 01 en vez de `components/` en la raíz.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Migrar las animaciones custom del Home (siluetas SVG flotantes, ticker con `animation-delay` escalonado, scroll-reveal con `IntersectionObserver`) puede perder fidelidad visual respecto al template | Comparar visualmente cada sección contra `arcade-vault-standalone.html` (el bundle original) durante la implementación, antes de dar por cerrado cada paso del plan |
| Mover `/` de Biblioteca a Home rompe cualquier enlace/bookmark existente que asumiera que `/` es el catálogo | Es un proyecto nuevo sin usuarios en producción todavía; no requiere redirect adicional, pero se documenta por si surge en el futuro |
| Las clases CSS nuevas (`.home-*`, `.feature-*`, `.activity-*`, `.pricing-*`) pueden chocar en nombre con clases futuras si no se revisan contra las ya existentes en `globals.css` | Revisar `globals.css` antes de pegar las nuevas clases para evitar duplicados o colisiones de nombre |
