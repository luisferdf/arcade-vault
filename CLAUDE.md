@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: this is not the Next.js you know

This project pins `next@16.2.12`, which has breaking changes vs. what's in your training data. **Before writing any Next.js code (routing, config, proxy/middleware, caching, data fetching), read the relevant page in `node_modules/next/dist/docs/01-app/` first.** Do not assume APIs from memory. Known deltas so far:

- **`middleware.ts` is gone — it's now `proxy.ts`** at the project root (same location, same purpose, exports `proxy()` instead of `middleware()`). Already in use: `proxy.ts` calls `updateSession()` in `lib/supabase/proxy.ts` (refreshes the Supabase session cookie, returns `{ response, hasSession }`) and redirects account routes (see Auth). See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Caching/PPR is unified under the `cacheComponents` config flag** (`next.config.ts`), replacing the old `experimental.ppr`, `experimental.useCache`, and `experimental.dynamicIO` flags. Enables the `use cache` directive, `cacheLife`, and `cacheTag`. Not enabled yet in this project. See `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`.
- Full docs tree lives at `node_modules/next/dist/docs/01-app/` (App Router — this project uses the App Router, not Pages Router). Check there before relying on remembered Next.js behavior for anything non-trivial (routing conventions, config options, data fetching, adapters).

## Project

Arcade Vault — a platform for playing arcade games online and competing for score (README.md is in Spanish). **The product UI, the specs, and all user-facing copy are in Spanish**; write new copy in Spanish and match the existing neon/CRT arcade tone.

Development follows **Spec Driven Design** using the `/spec` and `/spec-impl` workflow from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`).

- Every feature starts as a spec in `specs/NN-<slug>.md` with an `**Estado:**` header (`Borrador` → `Aprobado` → `implementado`). The human, not the agent, promotes `Borrador` → `Aprobado`.
- `/spec-impl NN-<slug>` implements it on a branch `spec-NN-<slug>` (auto-created; see `specs/.spec-config.yml`), merged back via PR.
- Specs 01–12 are implemented: MVP visual, home landing, about + contact email, Supabase setup, catalog/leaderboard migration, games Asteroides, Tetris, Arkanoid and Snake, touch controls (10), Frogger performance (12). Spec 11 (physical-gamepad look for `TouchControls`) is also implemented.
- Frogger's spec lives outside the numbered list: `specs/Game-jam/Frogger/01-frogger-core.md` (`implementado`). `specs/Game-jam/<id>/` is where the `game-jam` agent drops alternative specs; pick one, move it to `specs/NN-juego-<slug>.md`, then `Aprobado` → `/spec-impl`.

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

| Route                    | What it is                                                                                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                      | Landing (`HomeClient`)                                                                                                                                           |
| `/home`                  | Redirect to `/`                                                                                                                                                  |
| `/biblioteca`            | Game catalog with search + category filter (`BibliotecaClient`)                                                                                                  |
| `/juego/[id]`            | Game detail + per-game top 10                                                                                                                                    |
| `/juego/[id]/jugar`      | The Player (`GamePlayerClient`)                                                                                                                                  |
| `/salon`                 | Salón de la Fama — global leaderboard, filterable by game                                                                                                        |
| `/about`                 | About + contact form                                                                                                                                             |
| `/auth`                  | Login / sign-up (email+password, Google, GitHub) or guest                                                                                                        |
| `/auth/callback`         | Route handler: PKCE `code` → session (email confirm, OAuth, recovery); redirects to `/auth/nombre` if the session has no profile; `next` must be a relative path |
| `/auth/recuperar`        | Asks for the email to send a password-reset link                                                                                                                 |
| `/auth/nueva-contrasena` | Sets the new password (needs recovery session, else → `/auth`)                                                                                                   |
| `/auth/nombre`           | Pick the player name (first OAuth login, no profile yet)                                                                                                         |
| `/api/contact`           | POST → sends the contact email via Resend                                                                                                                        |

Convention: server component pages fetch data (`lib/games.ts`) and pass it to a `*Client` component in `app/_components/`. Interactive state lives in the client component only.

### Data (Supabase)

Three tables; there is no hardcoded catalog.

- `games` — `id` (slug, PK, also the URL segment), `title`, `short`, `long`, `cat` (`ARCADE|PUZZLE|SHOOTER|VERSUS`), `cover` (a CSS class name, not an image), `color` (`cyan|magenta|yellow|green|lime`), `available`.
- `scores` — `game_id` (FK), `user_id` (null for guests), `name`, `score`, `created_at`. Trigger `scores_apply_identity` (before insert) overrides identity: with a session it sets `user_id` and `name` from `profiles` (raises `profile_required` if none); as guest it forces `user_id = null` and raises `name_reserved` if `name` is a registered username. The client never decides its identity.
- `profiles` — `id` (FK `auth.users`), `username` (unique, `^[A-Z0-9_]{3,10}$`, uppercase), `created_at`. Public select; insert only own row. Created by trigger `on_auth_user_created` (email sign-up, name via `options.data.username`) or by `/auth/nombre` (OAuth). `username_available(p_username)` RPC checks availability.

### Auth

Supabase Auth (email+password with email confirmation, Google, GitHub; password recovery; sign out). `app/_components/AuthProvider.tsx` is the client context (`useAuth()` → `{ user, loading, signOut }`, built on `supabase.auth` + `profiles`), mounted in `app/layout.tsx`; consumed by `Nav` and `GamePlayerClient`. `user.username === null` = session without profile. `lib/auth.ts` holds only types and pure helpers (`validateUsername`, `validateEmail`, `validatePassword`, `safeNext`, `authErrorMessage` — maps by `error.code`). Email/password are regex-validated in the UI before calling Supabase (password: 8–72 chars, lower+upper+digit+symbol, only on sign-up and `/auth/nueva-contrasena`; login does not check complexity); the server (Auth dashboard settings) stays the authority. `proxy.ts` does an optimistic `getClaims()` check (no `profiles` query): without session `/auth/nueva-contrasena` and `/auth/nombre` → `/auth`; with session `/auth` → `/` (exact pathname match; refreshed cookies are copied onto the redirect). Every other route stays public, including `/juego/[id]/jugar`: guests (`JUGAR COMO INVITADO`) can still play and save scores.

### Security

- `next.config.ts` `headers()` sets `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` on every route. No CSP yet (own spec).
- RLS is on in `games`, `scores`, `profiles`. `scores_insert_public` requires `score >= 0`, `name ~ '^[A-Z0-9_]{1,10}$'` and an existing `game_id` (guest names with spaces/accents are rejected). `rls_auto_enable()` has `EXECUTE` revoked.
- `username_available()` is `SECURITY INVOKER` (reads `profiles`, public select) and stays executable by anon/authenticated: sign-up needs it before having a session. Only accepted advisor warning (`get_advisors` security): `auth_leaked_password_protection` (needs Supabase Pro). Auth dashboard (manual, not via MCP): min length 8, all 4 character groups, 10 sign-ups/sign-ins per 5 min per IP. Checklist: `references/security/checklist.md`.

- `lib/games.ts` (server, via `lib/supabase/server.ts`): `getGames`, `getGameById`, `getTopScoresByGame`, `getGlobalTopScores`. Derived stats (`best`, `plays`) are computed from `scores`, not stored.
- `lib/scores.ts` (browser, via `lib/supabase/client.ts`): `saveScore()` (returns `{ ok, error?: "name_reserved" | "profile_required" | "unknown" }`).
- `lib/games-types.ts`: shared `Game` / `ScoreEntry` types and `CATS`.
- Schema changes go through the Supabase MCP server (`.mcp.json`, project `zxzqcdscjgwkponoqpiv`) with `apply_migration` / `execute_sql`.

### Game engines (`lib/games/`)

The Player is generic: it knows nothing about individual games.

- `engine.ts` — the contract. `ArcadeGame` (`start` / `pause` / `resume` / `destroy`, optional `setSkin(skin)` and `handleTouchInput(action, pressed)`) and `GameEngineEntry` (logical `width`/`height`, `create(ctx, callbacks, skin)`, optional `extraStats`, `usesLives`, `skins`, `unusedTouchActions`). `TouchAction` = `up|down|left|right|a|b`; `unusedTouchActions` dims/blocks those buttons in `TouchControls`. Engines are **pure TypeScript**: no React, no DOM beyond the `CanvasRenderingContext2D` passed in. Engine state is the source of truth; the HUD is a view fed by callbacks (`onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`, `onStatChange`).
- `registry.ts` — `GAME_ENGINES: Record<gameId, GameEngineEntry>`. **Adding a game = one entry here**; do not add `if (id === …)` branches to `GamePlayerClient.tsx`. Games absent from the registry fall back to the simulated `game-arena`.
- `skins.ts` — `SkinId`, `SKIN_IDS`, `SKIN_LABELS`, persistence (`av_skin` + `av:skin-changed`). `touch.ts` — touch-device detection for `TouchControls` (`app/_components/TouchControls.tsx`, gamepad look).
- Implemented engines: `asteroids.ts`, `tetris.ts`, `arkanoid.ts` (+ `arkanoid-levels.ts`), `snake.ts` (+ `snake-atlas.ts`), `frogger.ts`.
- Hard rules for a new engine: keyboard listeners registered on construction/`start()` and **removed in `destroy()`**; `resume()` discards the accumulated `dt` so physics don't jump; game-over overlays are React's job (the modal), not the canvas.
- Binary assets go to `public/games/<id>/` and load asynchronously (e.g. `public/games/snake/fruits.png`).

### Styling

`app/globals.css` (~3k lines) holds the whole design system: theme tokens in `@theme` / `:root`, the CRT/neon chrome (`.av-bg`, `.crt-screen`, `.flicker`, `.pixel`), and **game covers as pure CSS classes** (`cover-bricks`, `cover-tetro`, `cover-snake`, …) — the project uses no cover images. Neon palette: `--cyan #00f5ff`, `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, background `#0a0a0f`. All 5 engines already use skin palettes (status in `references/game-with-theme.md`); still pending: the `cover-*` classes use literal hex, not theme tokens.

Two independent axes, don't conflate them: the **site theme** (dark/light, `[data-theme]` on `<html>`, `lib/theme.ts`, `av_theme`) recolors the chrome only; a **game skin** (`clasico`/`neon`/`retro`, per `lib/games/skins.ts`) recolors only that game's canvas.

### Reference material

- `references/started-games/` — original vanilla JS games used as the source when porting an engine.
- `references/templates/` — the original design mockups the screens were built from.
- `references/implemented-games.md` — catalog of shipped games (id, título, categoría, color).
- `references/game-suggestion-todo.md` — running backlog of game ideas, maintained by the `game-planner` subagent.
- `references/game-with-theme.md` — per-game skin status (`clasico`/`neon`/`retro`, contrast pass, notes), maintained by the `skin-designer` subagent.
- `references/game-mobile.md` — per-game mobile-port status (`handleTouchInput`, layout, desktop regression), maintained by the `mobile-porter` subagent.
- `references/gamepad-assets/` — gamepad mockup for spec 11 (`README.md` is actually the reference HTML/CSS, `gamepad-neon.png` the image). `references/source-assets/` — raw source art (snake).
- `references/game-performance.md` — per-game performance status (fps base/final, checklist C1–C8), maintained by the `game-performance-booster` subagent.

## Skills

- **`/frontend-design`** — always use it when designing or reshaping UI.
- **`/add-game <slug>`** — project skill (`.claude/skills/add-game/SKILL.md`). Interviews the user and writes `specs/NN-juego-<slug>.md` in `Borrador` state; it **never writes code and never touches Supabase**. Implementation goes through `/spec-impl`. Answers in Spanish throughout.
- **`/spec-impl-game <NN-juego-slug>`** — project skill (`.claude/skills/spec-impl-game/SKILL.md`). For game specs only: runs `/spec-impl`'s own Phases 1–4 verbatim (reads its SKILL.md at runtime rather than duplicating it), then, once acceptance criteria + `npm run build` are green, chains `skin-designer` and then `mobile-porter` **in series, never in parallel** — waits for `skin-designer` to fully finish before starting `mobile-porter`. Answers in Spanish throughout.
- `/spec` and `/spec-impl` own the spec format and process; `/add-game` and `/spec-impl-game` only specialize `/spec`/`/spec-impl` with game-domain knowledge — on any conflict, `/spec`/`/spec-impl` win.

## Subagents

One game at a time for the code-writing agents. Full behavior, rules and tracking files live in each definition (`.claude/agents/<name>.md`).

- **`game-planner`** — decides _what_ game to add next (catalog gaps, researched candidates, 1 pick + 2 alternatives); keeps its own memory and `references/game-suggestion-todo.md`. Never writes specs/code.
- **`game-jam`** — turns one example (folder, URL, pasted rules) into 2-3 alternative `Borrador` specs in `specs/Game-jam/<game-id>/`. No interview, never writes code.
- **`skin-designer`** — gives one game the `clasico`/`neon`/`retro` skins (WCAG-checked in dark + light); status in `references/game-with-theme.md`. Writes code.
- **`mobile-porter`** — ports one game to mobile browsers (`handleTouchInput`, touch layout, Playwright desktop-regression pass); status in `references/game-mobile.md`. Writes code.
- **`game-performance-booster`** — audits/optimizes one engine with zero visual change (ref: `specs/12-rendimiento-frogger.md`); status in `references/game-performance.md`. Writes code.

Flows: `game-planner` → `/add-game <slug>` (or `game-jam <example>` → move chosen variant to `specs/NN-juego-<slug>.md`) → `Aprobado` → `/spec-impl-game` (= `/spec-impl` → `skin-designer` → `mobile-porter`, in series) → optionally `game-performance-booster <id>`. The five agents never touch Supabase; `skin-designer`, `mobile-porter` and `game-performance-booster` never modify an engine other than the one named.

## Conventions

- `.claude/settings.json` runs a PostToolUse hook: every Write/Edit is auto-formatted with Prettier and `eslint --fix`. Don't hand-format.
- `.claude/worktrees/` holds agent worktrees; it's gitignored, never commit it.
- Playwright screenshots always go in `.playwright-screenshots/`, never the project root.
- Secrets live in `.env.local` (`RESEND_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); keep `.env.example` in sync.
