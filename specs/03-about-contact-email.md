# SPEC 03 — About page y envío de correo de contacto

> **Estado:** implementado
> **Depende de:** 01-mvp-visual (Nav, tokens de tema en `globals.css`), 02-home-landing (Nav actualizado, convención de componentes en `app/_components/`)
> **Fecha:** 2026-08-05
> **Objetivo:** Implementar la ruta `/about` fiel a `references/templates/Home-about` (contenido real recuperado del archivo `download (1)`), con un formulario de contacto que envía un correo real vía Resend a `luisfernandodiazfernandez@gmail.com`.

## Alcance

**Incluido:**

- Nueva ruta `app/about/page.tsx`, migrada del componente `About` real recuperado en `references/templates/Home-about/download (1)` (el archivo `about.jsx` del template contiene en realidad CSS, no JSX — problema ya documentado en spec 02).
- Secciones "Acerca de" (hero + misión + 3 highlights) y "Contacto" (formulario), exactamente como en el template: mismos textos, mismas clases CSS (`about-hero`, `about-mission`, `highlight-row`, `about-divider`, `about-contact`, `contact-grid`, `contact-form`, `terminal-success`, etc.).
- Ampliar `app/globals.css` con las clases del About/Contact que aún no existen (ya están en `styles (1).css` líneas 1071–1150, según lo mapeado en spec 02).
- Componente `HighlightIcon` (los 3 iconos SVG pixelados: HEART, BROWSER, PLANT), migrado igual que el resto de iconos del proyecto.
- Scroll-reveal (`useReveal`, mismo hook ya usado en spec 02) para `.about-divider` y `.about-contact`.
- Endpoint real `app/api/contact/route.ts` (Route Handler POST) que usa el SDK `resend` para enviar un correo a `luisfernandodiazfernandez@gmail.com` desde `onboarding@resend.dev`, con asunto dinámico `"Arcade Vault: mensaje de {nombre}"` y el nombre/email/mensaje del formulario en el cuerpo.
- Dependencia nueva `resend` en `package.json`.
- Variable de entorno `RESEND_API_KEY`, documentada en un `.env.example` nuevo (sin valor real) y cargada en `.env.local` (gitignorado) durante la implementación.
- El formulario (`contact-form`) pasa de mock a real: `onSubmit` hace `fetch("/api/contact", { method: "POST", ... })`; mientras se espera la respuesta se deshabilita el botón de envío; si la API responde error (o `RESEND_API_KEY` falta/Resend falla), se muestra un mensaje de error simple dentro del propio formulario (mismo estilo visual, sin romper el layout del template) y el usuario puede reintentar; si responde éxito, se muestra la pantalla `terminal-success` ya existente en el template.
- Validación server-side básica en el Route Handler (nombre/email/mensaje no vacíos, formato de email) antes de llamar a Resend, devolviendo 400 con mensaje si falla.
- Actualizar `app/_components/Nav.tsx`: agregar link "Acerca de" → `/about`, al final de los links (después de "Salón de la Fama"), en desktop y menú móvil, con su lógica de `isActive`.

**Fuera de alcance (para specs futuros):**

- Verificar un dominio propio en Resend (se usa `onboarding@resend.dev`, con la limitación conocida de que solo puede enviar a la dirección de la cuenta Resend registrada).
- Rate limiting / protección anti-spam (captcha, honeypot) en el formulario de contacto.
- Guardar los mensajes de contacto en alguna base de datos o `localStorage` — solo se envían por correo, no se persisten.
- Notificación/confirmación por correo al usuario que llenó el formulario (solo se le notifica en la UI, no recibe copia por email).
- Cambios de contenido/copy respecto al template — se replica tal cual, en español.
- Cualquier lógica de autenticación real para restringir quién puede usar el formulario.

## Modelo de datos

Este spec introduce un contrato de request/response para el endpoint de contacto (no hay persistencia, no hay tipos en `lib/`):

```ts
// app/api/contact/route.ts

interface ContactRequestBody {
  name: string;
  email: string;
  message: string;
}

// éxito: 200 { ok: true }
// error de validación: 400 { ok: false; error: string }
// error de envío (Resend falla / falta RESEND_API_KEY): 500 { ok: false; error: string }
```

En el cliente (`app/about/page.tsx`), el estado del formulario se amplía respecto al mock del template:

```ts
type ContactStatus = "idle" | "sending" | "sent" | "error";

const [status, setStatus] = useState<ContactStatus>("idle");
const [errorMsg, setErrorMsg] = useState<string | null>(null);
// se mantiene form { name, email, msg } y shake, igual que el template
```

No se agregan interfaces a `lib/`, ya que este contrato es local al endpoint y al componente `About`.

## Plan de implementación

1. Instalar la dependencia `resend` (`npm install resend`) y crear `.env.example` con `RESEND_API_KEY=` (sin valor). Prueba manual: `npm run build` sigue compilando sin cambios funcionales todavía.
2. Ampliar `app/globals.css` con las clases del About/Contact (`.about-hero`, `.about-title`, `.about-mission`, `.highlight-row`, `.highlight`, `.about-divider`, `.div-bar`, `.div-pixels`, `.about-contact`, `.contact-grid`, `.contact-intro`, `.contact-title`, `.contact-sub`, `.contact-tips`, `.contact-form`, `.terminal-success`, `.term-bar`, `.term-body`), tomadas de `styles (1).css` líneas 1071–1150. Prueba manual: build sigue compilando sin cambios visuales todavía (clases sin uso).
3. Crear `app/_components/HighlightIcon.tsx` con los 3 iconos SVG (HEART, BROWSER, PLANT), migrado del componente `HighlightIcon` de `download (1)`. Prueba manual: componente compila y acepta la prop `kind` tipada.
4. Crear `app/about/page.tsx` (Client Component) con la sección "Acerca de" (hero, misión, highlight-row con los 3 `HighlightIcon`) y el divisor animado, usando el hook `useReveal` ya existente. Prueba manual: `/about` muestra el hero y los 3 highlights sin errores en consola.
5. Agregar la sección "Contacto" en la misma página: formulario controlado (`name`, `email`, `msg`), validación cliente (shake si falta algún campo, igual que el template) y estado `status` (`idle | sending | sent | error`). Por ahora el `onSubmit` simula el envío localmente (sin llamar a la API todavía). Prueba manual: enviar el formulario vacío dispara el shake; llenarlo y enviar pasa a un estado "enviando" temporal.
6. Crear `app/api/contact/route.ts` (Route Handler `POST`): valida `name`/`email`/`message` no vacíos y formato de email básico (devuelve 400 si falla), y si pasa, llama a `resend.emails.send()` con `from: "onboarding@resend.dev"`, `to: "luisfernandodiazfernandez@gmail.com"`, `subject: "Arcade Vault: mensaje de {nombre}"` y el cuerpo con nombre/email/mensaje. Devuelve 200 `{ ok: true }` en éxito o 500 `{ ok: false, error }` si Resend falla. Prueba manual: probar el endpoint directamente (`curl`/Thunder Client) con body válido e inválido, confirmando los códigos de estado.
7. Conectar el formulario de `app/about/page.tsx` al endpoint real: `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })`; en éxito pasa a `sent` (muestra `terminal-success` ya existente en el template); en error pasa a `error` y muestra el mensaje debajo del formulario, permitiendo reintentar. Prueba manual: con `RESEND_API_KEY` configurada en `.env.local`, enviar el formulario real y confirmar que llega el correo a `luisfernandodiazfernandez@gmail.com`; luego probar el caso de error quitando temporalmente la API key.
8. Actualizar `app/_components/Nav.tsx`: agregar link "Acerca de" → `/about` al final de los links (desktop y menú móvil), con su propia variable `isAbout` para resaltar el link activo. Prueba manual: el link se resalta correctamente al visitar `/about`, en desktop y en el menú móvil.
9. Pasada de pulido responsive: verificar `/about` en los breakpoints ya usados en el resto del sitio (`900px`, `720px`, `520px` — grid de highlights y contact-grid a una columna). Prueba manual: revisar `/about` en viewport móvil y desktop sin overflow ni solapamientos.
10. Verificación final: `npm run build` compila sin errores de TypeScript, y no hay errores en consola del navegador al navegar a `/about` desde el Nav y volver.

## Criterios de aceptación

- [ ] `/about` muestra la sección "Acerca de" (hero + misión + 3 highlights: HEART, BROWSER, PLANT) idéntica al template.
- [ ] `/about` muestra la sección "Contacto" (intro + tips + formulario) idéntica al template.
- [ ] Enviar el formulario con algún campo vacío dispara la animación `shake` y no llama a la API.
- [ ] Enviar el formulario completo llama a `POST /api/contact` y, mientras espera respuesta, el botón de envío queda deshabilitado.
- [ ] Si `POST /api/contact` responde éxito, se muestra la pantalla `terminal-success` con el nombre del usuario, igual que el template.
- [ ] Si `POST /api/contact` responde error (validación server-side o fallo de Resend), se muestra un mensaje de error dentro del formulario y el usuario puede reintentar sin perder los datos ya escritos.
- [ ] Con `RESEND_API_KEY` válida configurada en `.env.local`, enviar el formulario real hace llegar un correo a `luisfernandodiazfernandez@gmail.com` con asunto `"Arcade Vault: mensaje de {nombre}"` y el contenido del mensaje.
- [ ] `POST /api/contact` devuelve 400 si `name`, `email` o `message` vienen vacíos o el email tiene formato inválido, sin llamar a Resend.
- [ ] El Nav muestra el link "Acerca de" al final (después de "Salón de la Fama"), en desktop y en el menú móvil, y se resalta como activo en `/about`.
- [ ] Las secciones marcadas `reveal` (`.about-divider`, `.about-contact`) aparecen con la animación de fade/translate al hacer scroll.
- [ ] No hay errores en la consola del navegador al cargar `/about`, enviar el formulario (éxito y error) y navegar de vuelta a `/`.
- [ ] `npm run build` (`next build`) compila sin errores de TypeScript.
- [ ] `/about` se ve sin overflow horizontal ni solapamientos en viewport móvil (< 520px) y desktop.
- [ ] `.env.local` (con la `RESEND_API_KEY` real) no queda incluido en ningún commit — se verifica que `.env*` sigue en `.gitignore`.

## Decisiones tomadas y descartadas

- **Sí:** Recuperar el componente `About` real desde `references/templates/Home-about/download (1)` en vez del archivo con nombre engañoso `about.jsx` (que en realidad contiene CSS completo). Razón: mismo problema ya documentado y resuelto en spec 02 — el bundle empaquetado desordenó los nombres de archivo.
- **Sí:** Usar Resend con el dominio de pruebas `onboarding@resend.dev` en vez de verificar un dominio propio ahora. Razón: permite tener el envío de correos funcionando de inmediato; verificar dominio queda para un spec/tarea futura si se necesita enviar a más de un destinatario.
- **Sí:** Enviar el correo a `luisfernandodiazfernandez@gmail.com` (la cuenta con la que se registró la API key de Resend), no a `lfdfplays@gmail.com` como se propuso inicialmente. Razón: con el dominio de pruebas, Resend solo permite enviar a la dirección de la cuenta registrada; usar otra dirección haría fallar el envío en producción real.
- **Sí:** Ruta `/about` (en inglés) en vez de `/acerca-de`, aunque el copy del sitio es en español. Razón: decisión explícita del usuario.
- **Sí:** Agregar estado de error real en el formulario (en vez de solo loguear en consola) cuando el envío falla. Razón: decisión explícita del usuario — mejor UX que dejar el formulario en un estado ambiguo sin feedback.
- **Sí:** Endpoint propio `app/api/contact/route.ts` (Route Handler de Next.js) en vez de llamar a Resend directamente desde el cliente. Razón: la API key de Resend es secreta y no puede exponerse en código de cliente; los Route Handlers corren en servidor.
- **Sí:** No persistir los mensajes de contacto en ningún storage (ni servidor ni cliente) — solo se envían por correo. Razón: consistente con el enfoque "MVP visual, sin backend real" de specs 01 y 02; agregar persistencia real es una decisión de infraestructura fuera del alcance de este spec.
- **No:** Verificar dominio propio en Resend en este spec. Descartado por alcance — se documenta como riesgo/mejora futura.
- **No:** Rate limiting o protección anti-spam (captcha, honeypot). Descartado por alcance — el sitio no tiene tráfico real todavía.

## Riesgos identificados

| Riesgo | Mitigación |
|---|---|
| Con el dominio de pruebas de Resend, el envío a `luisfernandodiazfernandez@gmail.com` puede fallar si esa no es exactamente la cuenta con la que se registró la API key `re_5kgrr...` | Probar el endpoint temprano en la implementación (paso 6 del plan) antes de conectar la UI; si falla, verificar en el dashboard de Resend cuál es la dirección permitida |
| La API key de Resend quedó guardada en texto plano en `specs/llave`, dentro de una carpeta versionada por git | No commitear ese archivo; moverla a `.env.local` (ya en `.gitignore`) durante la implementación y idealmente borrar `specs/llave` después |
| El Route Handler puede quedar sin `RESEND_API_KEY` en algunos entornos (ej. si se despliega sin configurar la variable) y fallar en silencio | El endpoint valida que `RESEND_API_KEY` exista antes de llamar a Resend y devuelve 500 con mensaje claro si falta, en vez de un error genérico |
| Migrar las clases CSS del About/Contact puede perder fidelidad visual respecto al template (glow, animación `shake`, `terminal-success` con efecto typewriter) | Comparar visualmente cada sección contra `arcade-vault-standalone.html` (el bundle original) durante la implementación, igual que se hizo en spec 02 |
