export interface StoredUser {
  name: string;
}

const STORAGE_KEY = "av_user";
export const USER_CHANGED_EVENT = "av:user-changed";

export function parseStoredUser(raw: string | null): StoredUser | null {
  try {
    return JSON.parse(raw ?? "null");
  } catch {
    return null;
  }
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredUser(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Snapshot para `useSyncExternalStore`: el JSON crudo (un string es estable
 * entre lecturas; el objeto parseado no). Se parsea con `parseStoredUser`.
 */
export function getUserSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Snapshot de servidor: sin sesión (localStorage no existe en SSR). */
export function getUserServerSnapshot(): string | null {
  return null;
}

/** Suscripción para `useSyncExternalStore`: evento propio + `storage` (otras pestañas). */
export function subscribeUser(onChange: () => void): () => void {
  window.addEventListener(USER_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(USER_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setStoredUser(user: StoredUser | null): void {
  if (typeof window === "undefined") return;
  if (user) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  window.dispatchEvent(new Event(USER_CHANGED_EVENT));
}
