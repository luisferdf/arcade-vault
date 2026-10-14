# SPEC 15 — Seguridad: actualizar Next.js, endurecer `/api/contact` y grants de tabla

> **Estado:** implementado
> **Depende de:** 03-about-contact-email (`/api/contact`), 04-supabase-setup, 14-seguridad-basica
> **Fecha:** 2026-10-14
> **Objetivo:** Cerrar los hallazgos abiertos de la auditoría del 2026-10-14 (`references/security/audit-log.md`): subir `next` a una versión sin advisories críticos, validar tipos y longitudes en `/api/contact` y reducir los grants de tabla de `anon`/`authenticated` a lo que usan las políticas.

## Por qué existe esta spec

Auditoría `security-auditor` del 2026-10-14:

- **SEC-006 (CRÍTICA):** `next@16.2.12` afectado por GHSA-p293-qw3h-jr36 (RCE sin autenticación en servidores Windows, <16.3.3), GHSA-cjq9-62q9-8jv4 (SSRF en Image Optimization, <16.3.8) y GHSA-vcvr-r3jv-pc5j (RCE en `next/og`, no usado). El desarrollo corre en Windows y se expone por ngrok (`allowedDevOrigins`). `npm audit` propone `next@16.4.0` (no-major).
- **SEC-007 (ALTA):** transitivas de producción `postcss`, `sharp`, `nanoid`, `source-map-js`; se resuelven con la misma subida.
- **SEC-008 (BAJA):** cadena de `eslint-config-next` en devDeps.
- **SEC-009 (MEDIA):** `app/api/contact/route.ts` no comprueba tipos (`body` `null` o campos no-string → `TypeError` → 500), no limita longitudes y mete `name` en el `subject` sin quitar saltos de línea.
- **SEC-010 (BAJA):** `anon` y `authenticated` tienen `INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES` en `games`, `scores` y `profiles`. RLS frena el DML sin política, pero `TRUNCATE` no está sujeto a RLS. Defensa en profundidad.

## Alcance

**Incluido:**

- Subir `next` y `eslint-config-next` a `16.4.0` (o la última 16.x sin advisories en el momento de implementar). Leer en `node_modules/next/dist/docs/` tras la subida los cambios que afecten a `proxy.ts`, `headers()` y `allowedDevOrigins`.
- Actualizar `CLAUDE.md` (línea "This project pins `next@16.2.12`").
- `/api/contact`: validar `body` objeto, campos `string`, longitudes máximas, quitar `\r`/`\n` del nombre usado en `subject`, `try/catch` alrededor de `resend.emails.send`. Mensajes de error en español, sin detalle interno.
- Migración de grants (abajo).
- Re-ejecutar `npm audit --omit=dev` y `get_advisors`.

**Fuera de alcance:**

- Rate limiting de `/api/contact` o de `scores` (aceptado en spec 14, SEC-020).
- CSP (SEC-018), anti-trampas (SEC-021), leaked password protection (SEC-019).
- SEC-011 (Secure password change): es un ajuste del dashboard, lo hace el usuario.
- SEC-012/013/015/016/017 (INFO): opcionales, otra spec o commit menor.
- Subir `@supabase/*`, `resend` o `react` (sin advisories; se puede hacer aparte).

## Modelo de datos

**Migración — grants mínimos (propuesta, aplicar con `apply_migration` en `/spec-impl`):**

```sql
-- games: solo lectura desde el cliente
revoke insert, update, delete, truncate, trigger, references
  on public.games from anon, authenticated;

-- scores: lectura + insert (política scores_insert_public)
revoke update, delete, truncate, trigger, references
  on public.scores from anon, authenticated;

-- profiles: lectura pública; insert solo authenticated (profiles_insert_own)
revoke insert, update, delete, truncate, trigger, references
  on public.profiles from anon;
revoke update, delete, truncate, trigger, references
  on public.profiles from authenticated;
```

Verificación previa (solo lectura): `information_schema.role_table_grants` y confirmar que `handle_new_user`/`scores_apply_identity` (DEFINER, owner `postgres`) no dependen de grants de `anon`/`authenticated`.

**`/api/contact` (límites propuestos, a confirmar):**

```ts
const LIMITS = { name: 60, email: 254, message: 2000 } as const;
// typeof body === "object" && body !== null; cada campo typeof === "string"
// subject: name.replace(/[\r\n]+/g, " ")
```

## Plan de implementación

1. **Subir Next.js.** `npm install next@16.4.0 eslint-config-next@16.4.0`; leer las notas/docs de 16.3–16.4 en `node_modules/next/dist/docs/`; `npm run build` y `npm run lint`. Prueba manual: todas las rutas cargan; `/auth/nombre` sin sesión → 307 `/auth`; `curl -I /` muestra los 5 headers; `npm audit --omit=dev` sin critical/high.
2. **`/api/contact`.** Añadir validación de tipos/longitudes y `try/catch`. Prueba manual con `curl`: body `null`, `{"name":1}`, mensaje de 5000 caracteres y nombre con `\r\n` → 400 con mensaje en español; envío válido desde `/about` sigue llegando.
3. **Grants.** Aplicar la migración. Prueba manual: guardar score como invitado y con sesión; registro email y OAuth (`/auth/nombre`) crean perfil; Biblioteca/Salón cargan; `role_table_grants` muestra solo `SELECT` (+ `INSERT` en `scores` y en `profiles` para `authenticated`).
4. **Documentación.** `CLAUDE.md` (versión de Next), checklist y re-auditoría con `security-auditor`.

## Criterios de aceptación

- [ ] `npm audit --omit=dev` sin vulnerabilidades critical ni high.
- [ ] `npm run build` y `npm run lint` pasan; `proxy.ts` sigue redirigiendo (307) igual que en spec 14.
- [ ] `curl -I /` devuelve los 5 headers de seguridad.
- [ ] `/api/contact` responde 400 (no 500) a body `null`, campos no-string y campos que superan el máximo; el envío válido funciona.
- [ ] El `subject` del correo no contiene saltos de línea.
- [ ] `anon` y `authenticated` no tienen `TRUNCATE`, `TRIGGER`, `REFERENCES`, `UPDATE` ni `DELETE` en ninguna tabla de `public`.
- [ ] Guardar score (invitado y con sesión), registro por email y elegir nombre tras OAuth siguen funcionando.
- [ ] `get_advisors` (security) solo lista `auth_leaked_password_protection`.

## Decisiones tomadas y descartadas

- **Nota de proceso:** borrador redactado por `security-auditor` a partir de la auditoría, sin la entrevista de `/spec`. Revisar alcance y límites antes de aprobar.
- **Sí:** subir `next` en minor (16.2 → 16.4). Razón: `npm audit` lo marca no-major y cierra el CRÍTICO; riesgo de cambios de API mitigado leyendo la doc local.
- **No:** `npm audit fix --force` para `eslint-config-next` (propone 14.2.35, un downgrade major).
- **Sí:** revocar grants aunque RLS ya bloquee el DML. Razón: `TRUNCATE` ignora RLS; defensa en profundidad.
- **Abierto:** límites exactos de `/api/contact` (60/254/2000 propuestos).

## Riesgos identificados

| Riesgo                                                               | Mitigación                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 16.4 cambia API de `proxy.ts`, `headers()` o config.                 | Leer la doc local tras instalar; build + pruebas de redirección y headers.                   |
| Revocar grants rompe un flujo que dependía de ellos (p. ej. upsert). | El código solo hace `select` e `insert`; probar invitado, sesión, registro y `/auth/nombre`. |
| Supabase restaura grants por defecto al crear tablas nuevas.         | Afecta solo a tablas nuevas; el auditor lo revisa en cada pasada.                            |
| Límites de longitud cortan mensajes legítimos.                       | Máximos generosos; error claro en español.                                                   |
