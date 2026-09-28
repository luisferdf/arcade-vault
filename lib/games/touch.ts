/**
 * Detección reactiva de dispositivo táctil, para mostrar `TouchControls` solo
 * cuando el puntero primario es "coarse" (dedo), nunca por ancho de viewport
 * (evita falsos positivos en laptops táctiles con teclado/mouse).
 */

const QUERY = "(pointer: coarse)";

function getQuery(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  return window.matchMedia(QUERY);
}

/** Snapshot para `useSyncExternalStore`. */
export function getIsTouchDeviceSnapshot(): boolean {
  return getQuery()?.matches ?? false;
}

/** Snapshot de servidor: en SSR nunca hay puntero táctil detectable. */
export function getIsTouchDeviceServerSnapshot(): boolean {
  return false;
}

export function subscribeIsTouchDevice(onChange: () => void): () => void {
  const mql = getQuery();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
