/**
 * Tema del sitio (chrome): oscuro por defecto, claro opcional.
 *
 * Es preferencia de cliente en `localStorage`, nunca dato de servidor. Se aplica
 * como `data-theme` en `<html>`; el script inline de `app/layout.tsx` lo lee antes
 * del primer paint para evitar parpadeo (FOUC).
 *
 * Eje independiente de las skins de juego (`lib/games/skins.ts`).
 */

export type ThemeId = "dark" | "light";

export const THEME_IDS: ThemeId[] = ["dark", "light"];
export const DEFAULT_THEME: ThemeId = "dark";

const STORAGE_KEY = "av_theme";
export const THEME_CHANGED_EVENT = "av:theme-changed";

function isThemeId(value: unknown): value is ThemeId {
  return value === "dark" || value === "light";
}

export function getStoredTheme(): ThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isThemeId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredTheme(theme: ThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage deshabilitado: el tema se aplica igual en esta sesión.
  }
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new Event(THEME_CHANGED_EVENT));
}

/** Snapshot para `useSyncExternalStore`: el tema efectivo, nunca `null`. */
export function getThemeSnapshot(): ThemeId {
  return getStoredTheme() ?? DEFAULT_THEME;
}

/** Snapshot de servidor: en SSR siempre el oscuro (default del sitio). */
export function getThemeServerSnapshot(): ThemeId {
  return DEFAULT_THEME;
}

export function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Script inline para `<head>`: fija `data-theme` antes del primer paint. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("av_theme");document.documentElement.setAttribute("data-theme",t==="light"?"light":"dark")}catch(e){document.documentElement.setAttribute("data-theme","dark")}`;
