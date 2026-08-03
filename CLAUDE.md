@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: this is not the Next.js you know

This project pins `next@16.2.12`, which has breaking changes vs. what's in your training data. **Before writing any Next.js code (routing, config, proxy/middleware, caching, data fetching), read the relevant page in `node_modules/next/dist/docs/01-app/` first.** Do not assume APIs from memory. Known deltas so far:

- **`middleware.ts` is gone — it's now `proxy.ts`** at the project root (same location, same purpose, exports `proxy()` instead of `middleware()`). See `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.
- **Caching/PPR is unified under the `cacheComponents` config flag** (`next.config.ts`), replacing the old `experimental.ppr`, `experimental.useCache`, and `experimental.dynamicIO` flags. Enables the `use cache` directive, `cacheLife`, and `cacheTag`. See `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`.
- Full docs tree lives at `node_modules/next/dist/docs/01-app/` (App Router — this project uses the App Router, not Pages Router). Check there before relying on remembered Next.js behavior for anything non-trivial (routing conventions, config options, data fetching, adapters).

## Project

Arcade Vault — a platform for playing games online and competing for score (per README.md, in Spanish). Currently an unmodified `create-next-app` scaffold: no custom routes, components, or logic exist yet beyond `app/layout.tsx` and `app/page.tsx`.

Development follows **Spec Driven Design** using the `/spec` and `/spec-impl` workflow from https://github.com/Klerith/fernando-skills (installed via `npx skills@latest add Klerith/fernando-skills`).

## Commands

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

No test runner is configured yet.

## Stack

- Next.js 16 App Router, React 19, TypeScript (strict mode)
- Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.*` — v4 is CSS-first, configured in `app/globals.css`)
- Path alias `@/*` → project root (`tsconfig.json`)
- ESLint flat config extending `eslint-config-next` (core-web-vitals + typescript)
