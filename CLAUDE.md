@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: this is not the Next.js you know

This project pins `next@16.2.12`, which has breaking changes vs. what's in your training data. **Before writing any Next.js code (routing, config, proxy/middleware, caching, data fetching), read the relevant page in `node_modules/next/dist/docs/01-app/` first.** Do not assume APIs from memory. Known deltas so far:

- **`middleware.ts` is gone — it's now `proxy.ts`** at the project root (same location, same purpose, exports `proxy()` instead of `middleware()`). Already in use: `proxy.ts` delegates to `updateSession()` in `lib/supabase/proxy.ts` to refresh the Supabase session cookie. See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Caching/PPR is unified under the `cacheComponents` config flag** (`next.config.ts`), replacing the old `experimental.ppr`, `experimental.useCache`, and `experimental.dynamicIO` flags. Enables the `use cache` directive, `cacheLife`, and `cacheTag`. Not enabled yet in this project. See `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`.
- Full docs tree lives at `node_modules/next/dist/docs/01-app/` (App Router — this project uses the App Router, not Pages Router). Check there before relying on remembered Next.js behavior for anything non-trivial (routing conventions, config options, data fetching, adapters).

## Project

Arcade Vault — a platform for playing arcade games online and competing for score (README.md is in Spanish). **The product UI, the specs, and all user-facing copy are in Spanish**; write new copy in Spanish and match the existing neon/CRT arcade tone.

Development follows **Spec Driven Design** using the `/spec` and `/spec-impl` workflow from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`).

- Every feature starts as a spec in `specs/NN-<slug>.md` with an `**Estado:**` header (`Borrador` → `Aprobado` → `implementado`). The human, not the agent, promotes `Borrador` → `Aprobado`.
- `/spec-impl NN-<slug>` implements it on a branch `spec-NN-<slug>` (auto-created; see `specs/.spec-config.yml`), merged back via PR.
- Specs 01–09 are all implemented: MVP visual, home landing, about + contact email, Supabase setup, the Supabase catalog/leaderboard migration, and the games Asteroides, Tetris, Arkanoid and Snake.

No test runner is configured yet; verification is manual per each spec's "pruebas manuales" plus `npm run build`.

## Stack

- Next.js 16 App Router, React 19, TypeScript (strict mode)
- Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.*` — v4 is CSS-first, configured in `app/globals.css`)
- Supabase (`@supabase/supabase-js` + `@supabase/ssr`) for the game catalog and scores
- Resend for the contact form email
- Path alias `@/*` → project root (`tsconfig.json`)
- ESLint flat config extending `eslint-config-next` (core-web-vitals + typescript); Prettier for formatting

## Commands

```bash
npm run dev      # dev server
npm run build    # production build — the de-facto test suite
npm run start    # run production build
npm run lint     # eslint
```

## Architecture

### Routes (`app/`)

| Route               | What it is                                                      |
| ------------------- | --------------------------------------------------------------- |
| `/`                 | Landing (`HomeClient`)                                          |
| `/home`             | Redirect to `/`                                                 |
| `/biblioteca`       | Game catalog with search + category filter (`BibliotecaClient`) |
| `/juego/[id]`       | Game detail + per-game top 10                                   |
| `/juego/[id]/jugar` | The Player (`GamePlayerClient`)                                 |
| `/salon`            | Salón de la Fama — global leaderboard, filterable by game       |
| `/about`            | About + contact form                                            |
| `/auth`             | Fake login: stores a name in `localStorage` (`lib/auth.ts`)     |
| `/api/contact`      | POST → sends the contact email via Resend                       |

Convention: server component pages fetch data (`lib/games.ts`) and pass it to a `*Client` component in `app/_components/`. Interactive state lives in the client component only.

### Data (Supabase)

Two tables; there is no hardcoded catalog.

- `games` — `id` (slug, PK, also the URL segment), `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `cover` (a CSS class name, not an image), `color` (`cyan|magenta|yellow|green`), `available`.
- `scores` — `game_id` (FK), `user_id` (always `null` today), `name`, `score`, `created_at`.

- `lib/games.ts` (server, via `lib/supabase/server.ts`): `getGames`, `getGameById`, `getTopScoresByGame`, `getGlobalTopScores`. Derived stats (`best`, `plays`) are computed from `scores`, not stored.
- `lib/scores.ts` (browser, via `lib/supabase/client.ts`): `saveScore()`.
- `lib/games-types.ts`: shared `Game` / `ScoreEntry` types and `CATS`.
- Schema changes go through the Supabase MCP server (`.mcp.json`, project `zxzqcdscjgwkponoqpiv`) with `apply_migration` / `execute_sql`.

### Game engines (`lib/games/`)

The Player is generic: it knows nothing about individual games.

- `engine.ts` — the contract. `ArcadeGame` (`start` / `pause` / `resume` / `destroy`) and `GameEngineEntry` (logical `width`/`height`, `create(ctx, callbacks)`, optional `extraStats`, `usesLives`). Engines are **pure TypeScript**: no React, no DOM beyond the `CanvasRenderingContext2D` passed in. Engine state is the source of truth; the HUD is a view fed by callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`, `onStatChange`).
- `registry.ts` — `GAME_ENGINES: Record<gameId, GameEngineEntry>`. **Adding a game = one entry here**; do not add `if (id === …)` branches to `GamePlayerClient.tsx`. Games absent from the registry fall back to the simulated `game-arena`.
- Implemented engines: `asteroids.ts`, `tetris.ts`, `arkanoid.ts` (+ `arkanoid-levels.ts`), `snake.ts` (+ `snake-atlas.ts`).
- Hard rules for a new engine: keyboard listeners registered on construction/`start()` and **removed in `destroy()`**; `resume()` discards the accumulated `dt` so physics don't jump; game-over overlays are React's job (the modal), not the canvas.
- Binary assets go to `public/games/<id>/` and load asynchronously (e.g. `public/games/snake/fruits.png`).

### Styling

`app/globals.css` (~3k lines) holds the whole design system: theme tokens in `@theme` / `:root`, the CRT/neon chrome (`.av-bg`, `.crt-screen`, `.flicker`, `.pixel`), and **game covers as pure CSS classes** (`cover-bricks`, `cover-tetro`, `cover-snake`, …) — the project uses no cover images. Neon palette: `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, background `#0a0a0f`. Engines hardcode these same values.

### Reference material

- `references/started-games/` — original vanilla JS games used as the source when porting an engine.
- `references/templates/` — the original design mockups the screens were built from.

## Skills

- **`/frontend-design`** — always use it when designing or reshaping UI.
- **`/add-game <slug>`** — project skill (`.claude/skills/add-game/SKILL.md`). Interviews the user and writes `specs/NN-juego-<slug>.md` in `Borrador` state; it **never writes code and never touches Supabase**. Implementation goes through `/spec-impl`. Answers in Spanish throughout.
- `/spec` and `/spec-impl` own the spec format and process; `/add-game` only specializes `/spec` with game-domain knowledge — on any conflict, `/spec` wins.

## Conventions

- `.claude/settings.json` runs a PostToolUse hook: every Write/Edit is auto-formatted with Prettier and `eslint --fix`. Don't hand-format.
- Playwright screenshots always go in `.playwright-screenshots/`, never the project root.
- Secrets live in `.env.local` (`RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); keep `.env.example` in sync.
