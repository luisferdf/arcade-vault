# SPEC 17 — Donaciones («Invítame un café»)

> **Estado:** aprobado
> **Depende de:** 02-home-landing, 03-about-contacto, 14-seguridad-basica
> **Fecha:** 2026-10-15
> **Objetivo:** Añadir una vía de donación voluntaria (enlace externo a una plataforma de terceros) para cubrir costos de hosting/Supabase, sin cobros propios, sin cuentas de pago y sin afectar el juego.

## Por qué existe esta spec

Salió del brainstorming de monetización (2026-10-15). Objetivo del usuario: **ingreso extra pequeño**, mínimo esfuerzo, sin dañar la experiencia arcade. Donaciones es la fase 1 del plan: cero código de pagos, cero riesgo, validable en horas. Afiliados, ads y cosméticos quedan para specs futuras.

## Alcance

**Incluido:**

- Constante única con la URL de donación en `lib/donate.ts` (`DONATE_URL`, leída de `NEXT_PUBLIC_DONATE_URL`). Si no está definida, **ninguna superficie de donación se renderiza** (la feature queda apagada sin tocar código).
- Componente `DonateButton` (`app/_components/DonateButton.tsx`) con estilo neon coherente (`btn`/neon existentes), `target="_blank"` y `rel="noopener noreferrer"`. Texto en español: «☕ INVÍTAME UN CAFÉ».
- Superficies (discretas, nunca durante la partida):
  1. **Footer** (`app/layout.tsx`): enlace de texto junto al copyright.
  2. **`/about`**: bloque breve «APOYA EL PROYECTO» explicando que el dinero va a hosting y nuevos juegos.
  3. **Modal de game over** (`GamePlayerClient`): línea pequeña y secundaria bajo los botones existentes; no compite con «JUGAR DE NUEVO» ni con guardar score.
- Documentar la variable en `.env.example` y en `CLAUDE.md` (Secrets / Arquitectura).

**Fuera de alcance:**

- Cobros propios (Stripe, Mercado Pago), webhooks, tabla `donations` o cualquier cambio de esquema Supabase.
- Beneficios para donantes (badge, skins, quitar anuncios): spec futura (cosméticos / Vault Pass).
- Anuncios, afiliados, merch.
- Contador de donaciones o «muro de donantes».
- Pop-ups, banners flotantes o interrupciones durante el juego.

## Modelo de datos

Sin cambios. No se guarda nada en Supabase ni en `localStorage`.

## Plan de implementación

1. **Decisión previa (usuario):** elegir plataforma y crear la cuenta (ver «Decisiones»). URL pública (hecho 2026-10-15): `https://ko-fi.com/luisferdev`.
2. **`lib/donate.ts`:** exportar `DONATE_URL` (`process.env.NEXT_PUBLIC_DONATE_URL ?? null`). Añadir la variable a `.env.example` y `.env.local`.
3. **`DonateButton`:** componente sin estado; devuelve `null` si no hay `DONATE_URL`. Variantes `button` (about, modal) y `link` (footer). Estilos en `app/globals.css` reutilizando tokens (`--yellow`/`--magenta`) y funcionando en tema claro y oscuro.
4. **Footer y `/about`:** integrar el componente; copy en español con el tono neon/CRT.
5. **Modal de game over:** integrar en `GamePlayerClient` solo como enlace secundario; verificar que no desplaza ni oculta los botones en móvil (TouchControls) ni en desktop.
6. **Documentación:** `.env.example`, `CLAUDE.md`.

## Criterios de aceptación

- [ ] Con `NEXT_PUBLIC_DONATE_URL` definida: aparece el enlace en footer, el bloque en `/about` y la línea en el modal de game over.
- [ ] Sin la variable: no se renderiza ninguna de las tres superficies y no hay errores en consola.
- [ ] Todos los enlaces abren en pestaña nueva con `rel="noopener noreferrer"`.
- [ ] Nada de donaciones visible en el canvas ni durante la partida (solo tras game over).
- [ ] El modal de game over mantiene sus botones visibles y usables en móvil y desktop; guardar score no se ve afectado.
- [ ] Contraste legible en tema oscuro y claro.
- [ ] La URL es `https` y apunta a la plataforma elegida; no se envía ningún dato del usuario al enlace (sin parámetros de email/usuario).
- [ ] `npm run build` y `npm run lint` pasan.

## Decisiones tomadas y descartadas

- **Nota de proceso:** borrador redactado desde el brainstorming, sin la entrevista completa de `/spec`; decisiones abiertas resueltas el 2026-10-15; queda la aprobación humana.
- **Sí:** enlace externo a plataforma de terceros. Razón: sin cumplimiento de pagos, sin PCI, sin facturación propia; el esfuerzo es de horas.
- **Sí:** feature apagable por variable de entorno. Razón: poder publicar el código antes de tener la cuenta creada.
- **Sí:** mostrar el modal de donación solo tras game over y como enlace secundario. Razón: es el momento de mayor emoción sin interrumpir el juego.
- **No:** widget/iframe/script embebido de la plataforma. Razón: carga JS de terceros, pelea con la futura CSP (SEC-018, spec 18 del plan de seguridad) y con el rendimiento de los motores.
- **No:** pop-up o banner intrusivo. Razón: choca con la experiencia arcade y con el objetivo de no dañarla.
- **Sí (decidido 2026-10-15):** plataforma **Ko-fi** (sin comisión en donaciones, PayPal/Stripe). Descartadas: Cafecito y Buy Me a Coffee (~5%).
- **Sí (decidido 2026-10-15):** textos de esta spec aprobados («☕ INVÍTAME UN CAFÉ», bloque «APOYA EL PROYECTO»); footer con enlace de texto.
- **Sí (decidido 2026-10-15):** numeración 17 se mantiene; el CSP pasa a ser la spec 18 (actualizar la mención en la spec 16).

## Riesgos identificados

| Riesgo                                                                    | Mitigación                                                                     |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| El enlace del modal estorba o desplaza los botones de game over en móvil. | Prueba manual en emulación móvil y desktop; enlace pequeño y secundario.       |
| La spec 16 aún nombra «spec 17» al CSP.                                   | Resuelto: esta es la 17; el CSP será la 18 (corregir mención en spec 16).      |
| Plataforma elegida cambia comisiones/cierra la cuenta.                    | URL en una sola variable de entorno; cambiar de plataforma = cambiar el valor. |
| Futura CSP bloquea navegación externa.                                    | Es un `<a>` normal (no `form-action`/`frame`); la CSP de scripts no lo afecta. |
| Expectativa de ingresos nula con poco tráfico.                            | Es fase 1 de bajo costo; medir clics antes de invertir en fases 2–3.           |
