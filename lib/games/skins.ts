/**
 * Skins de los motores del Vault.
 *
 * Una skin repinta **solo el canvas del juego**; el tema del sitio (oscuro/claro,
 * `lib/theme.ts`) repinta solo el chrome. Son dos ejes independientes: no se mezclan.
 *
 * La skin entra siempre al motor por parámetro (`create(ctx, cb, skin)` o
 * `setSkin(skin)`); un motor nunca lee `document`, `window` ni CSS custom properties.
 */

export type SkinId = "clasico" | "neon" | "retro";

/** Orden de presentación en el selector del Reproductor. `clasico` es la default. */
export const SKIN_IDS: SkinId[] = ["clasico", "neon", "retro"];

export const SKIN_LABELS: Record<SkinId, string> = {
  clasico: "Clásico",
  neon: "Neón",
  retro: "Retro",
};

export const DEFAULT_SKIN: SkinId = "clasico";

const STORAGE_KEY = "av_skin";
export const SKIN_CHANGED_EVENT = "av:skin-changed";

function isSkinId(value: unknown): value is SkinId {
  return typeof value === "string" && (SKIN_IDS as string[]).includes(value);
}

export function getStoredSkin(): SkinId | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isSkinId(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function setStoredSkin(skin: SkinId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, skin);
  } catch {
    // localStorage puede estar deshabilitado; la skin sigue aplicándose en memoria.
  }
  window.dispatchEvent(new Event(SKIN_CHANGED_EVENT));
}

/** Snapshot para `useSyncExternalStore`: la skin efectiva, nunca `null`. */
export function getSkinSnapshot(): SkinId {
  return getStoredSkin() ?? DEFAULT_SKIN;
}

/** Snapshot de servidor: en SSR siempre la default (localStorage no existe). */
export function getSkinServerSnapshot(): SkinId {
  return DEFAULT_SKIN;
}

/** Suscripción para `useSyncExternalStore`: evento propio + `storage` (otras pestañas). */
export function subscribeSkin(onChange: () => void): () => void {
  window.addEventListener(SKIN_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SKIN_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
