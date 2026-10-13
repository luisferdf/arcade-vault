export interface AuthUser {
  id: string;
  email: string;
  username: string | null; // null = sesión sin perfil (OAuth sin /auth/nombre completado)
}

/** Regex del nombre de jugador, compartida con el `check` de `public.profiles`. */
export const USERNAME_REGEX = /^[A-Z0-9_]{3,10}$/;

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeUsername(raw: string): string {
  return raw.trim().toUpperCase();
}

/** Devuelve el mensaje de error en español, o null si el nombre es válido. */
export function validateUsername(username: string): string | null {
  if (username.length < 3 || username.length > 10) {
    return "EL NOMBRE DEBE TENER ENTRE 3 Y 10 CARACTERES";
  }
  if (!USERNAME_REGEX.test(username)) {
    return "SOLO LETRAS, NÚMEROS Y GUION BAJO (A-Z 0-9 _)";
  }
  return null;
}

/** Solo rutas relativas que empiezan por un único `/`; si no, `/`. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  if (next.startsWith("/\\")) return "/";
  return next;
}

/** Traduce un error de Supabase Auth por `code` (no por mensaje). */
export function authErrorMessage(error: {
  code?: string;
  message?: string;
}): string {
  switch (error.code) {
    case "invalid_credentials":
      return "CORREO O CONTRASEÑA INCORRECTOS";
    case "email_not_confirmed":
      return "TU CORREO AÚN NO ESTÁ CONFIRMADO. REVISA TU BANDEJA";
    case "user_already_exists":
    case "email_exists":
      return "ESE CORREO YA TIENE UNA CUENTA";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "DEMASIADOS INTENTOS. ESPERA UN MOMENTO";
    case "weak_password":
      return "CONTRASEÑA DÉBIL. USA AL MENOS 8 CARACTERES";
    case "signup_disabled":
      return "EL REGISTRO ESTÁ DESACTIVADO";
    case "validation_failed":
      return "REVISA LOS DATOS INGRESADOS";
    default:
      // El trigger handle_new_user falla por nombre duplicado (carrera).
      if (error.message?.includes("Database error saving new user")) {
        return "NOMBRE EN USO, ELIGE OTRO";
      }
      return "ALGO SALIÓ MAL. INTÉNTALO DE NUEVO";
  }
}
